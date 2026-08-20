'use strict';

/**
 * Everything the shop is allowed to say, in one block of text.
 *
 * Assembled from the database on every use: the live catalogue with prices
 * and booking amounts, which sizes actually have stock, the business facts
 * the owner edits in the panel, and - when there is one - this customer's
 * own order.
 *
 * It exists so the AI reply composer has a single source of truth. Nothing
 * in here is written in code; change a price in the panel and the next
 * message the model composes uses the new one.
 */

const config = require('../config');
const logger = require('../logger');
const productService = require('../services/productService');
const categoryService = require('../services/categoryService');
const faq = require('./faq');

const money = (amount) => `${config.CURRENCY}${Math.round(Number(amount || 0))}`;

/**
 * @param {object} [options]
 * @param {object} [options.order]   the customer's open order, if any
 * @param {string} [options.phone]
 * @returns {Promise<string>}
 */
async function shopFacts({ order = null } = {}) {
  const lines = [];

  try {
    const [products, categories, stored] = await Promise.all([
      productService.activeProducts(),
      categoryService.availableCategories(),
      faq.facts(),
    ]);

    lines.push(`Shop: ${stored.greeting_brands || config.BUSINESS_NAME}`);
    if (stored.location_city) lines.push(`Based in: ${stored.location_city}`);
    if (stored.shipping_note) lines.push(`Shipping: ${stored.shipping_note}`);
    lines.push(`Categories: ${categories.map((c) => c.label).join(', ') || 'none'}`);
    lines.push('');

    lines.push('PRODUCTS (only these exist):');
    for (const product of products) {
      const sizes = await productService.sizesOf(product);
      const inStock = [];
      for (const size of sizes) {
        const colours = await productService.colorsOf(product);
        const stock = await productService.stockOf(product.id, colours[0] || null, size);
        if (product.made_to_order || stock > 0) inStock.push(size);
      }

      const parts = [
        `- ${product.design || product.name}`,
        `price ${money(product.price)}`,
        Number(product.booking_amount) > 0
          ? `booking ${money(product.booking_amount)} now, ${money(
              Number(product.price) - Number(product.booking_amount)
            )} when ready`
          : 'paid in full',
        inStock.length ? `sizes available: ${inStock.join(', ')}` : 'currently sold out',
      ];
      if (product.cod_available) {
        parts.push(
          `COD +${money(product.cod_charge)} (total ${money(
            Number(product.price) + Number(product.cod_charge)
          )})`
        );
      }
      lines.push(parts.join(' | '));
    }

    lines.push('');
    if (stored.tshirt_material) lines.push(`Material: ${stored.tshirt_material}`);
    if (stored.tshirt_lead_time) lines.push(`Wait time: ${stored.tshirt_lead_time}`);
    if (stored.hoodie_lead_time) lines.push(`Hoodies: ${stored.hoodie_lead_time}`);
    if (stored.hoodie_brands) lines.push(`Hoodie brands: ${stored.hoodie_brands}`);
    if (stored.lot_note) lines.push(`Stock policy: ${stored.lot_note}`);
    lines.push('Prices are fixed. The shop does not give discounts.');
    lines.push('Payment is verified by a person before an order is confirmed.');

    if (order) {
      lines.push('');
      lines.push('THIS CUSTOMER\'S ORDER:');
      lines.push(`- Order ${order.order_id}, status ${order.status}`);
      lines.push(`- Total ${money(order.total)}`);
      if (Number(order.booking_amount) > 0) {
        lines.push(
          `- Booking ${money(order.booking_amount)} paid or pending, ${money(
            order.remaining_amount
          )} due when the piece is ready`
        );
      }
      lines.push(
        '- Refunds, cancellations after payment, and delivery dates are decided by a person, not by you.'
      );
    }
  } catch (err) {
    logger.warn('context.facts_failed', { error: err.message });
  }

  return lines.join('\n');
}

// ------------------------------------------------------- the scoped version

/**
 * Only the facts this turn can possibly need.
 *
 * `shopFacts()` above is the whole shop in one block - every product, every
 * lead time, the material, the hoodie brands, the pickup city - because it
 * was written for a composer that could be asked anything. Measured, it is
 * 1408 characters, and it was being sent on every single call: a customer
 * asking "XL hai?" was paying to have hoodie lead times and a sold-out
 * backpack explained to a model that had no use for either.
 *
 * This builds the same kind of block from the same database, but only from
 * what the current turn is about. The extras are keyed off the question the
 * customer actually asked, so "kitne din lagenge" gets the lead time and
 * nothing else does.
 *
 * It returns the allow-lists alongside the text on purpose. The lists are
 * what the model is permitted to name, and they have to shrink WITH the
 * facts - showing it a colour that is no longer described is how you get an
 * answer about something that was never in scope.
 */

/** Which stored fact answers which question. Everything else is left out. */
const EXTRA_FOR = {
  waiting: ['tshirt_lead_time', 'hoodie_lead_time'],
  material: ['tshirt_material'],
  brands: ['hoodie_brands'],
  stock: ['lot_note'],
  location: ['location_city', 'shipping_note'],
};

const LABEL = {
  tshirt_lead_time: 'Wait',
  hoodie_lead_time: 'Hoodies',
  tshirt_material: 'Material',
  hoodie_brands: 'Hoodie brands',
  lot_note: 'Stock',
  location_city: 'Based in',
  shipping_note: 'Shipping',
};

/** One product on one line: name, price, what is due now, what is in stock. */
async function productLine(product, { colour = null, prices = true } = {}) {
  const colours = await productService.colorsOf(product);
  const useColour = colour || colours[0] || null;

  const sizes = await productService.sizesOf(product);
  const inStock = [];
  for (const size of sizes) {
    const stock = await productService.stockOf(product.id, useColour, size);
    if (product.made_to_order || stock > 0) inStock.push(size);
  }

  const booking = Number(product.booking_amount) || 0;
  const price = Number(product.price) || 0;

  /**
   * Money is left out unless the turn is about money.
   *
   * Two reasons, and the second matters more than the tokens: the sales
   * memory says never lead with price, and a model cannot quote a number it
   * was never shown - the reply guard rejects any digit that is not in these
   * facts. So withholding prices here does not merely save characters, it
   * enforces the shop's own rule.
   */
  return [
    product.design || product.name,
    prices ? money(price) : '',
    prices && booking > 0
      ? `book ${money(booking)} now, ${money(price - booking)} later`
      : '',
    inStock.length ? inStock.join('/') : 'sold out',
    prices && product.cod_available ? `COD +${money(product.cod_charge)}` : '',
  ]
    .filter(Boolean)
    .join(' | ');
}

/**
 * @param {object}  [options]
 * @param {object}  [options.product]  the product this turn is about
 * @param {string}  [options.colour]
 * @param {string}  [options.topic]    the FAQ topic asked, if any
 * @param {object}  [options.order]    the customer's open order, if any
 * @param {boolean} [options.catalogue] include every product, for a customer
 *                  who has not chosen one yet
 * @param {object}  [options.requested] {productId, product, colour, size} - what
 *                  they asked for, so availability and any real alternative
 *                  can be stated from the database rather than guessed
 * @returns {Promise<{facts: string, designs: string[], colours: string[], sizes: string[]}>}
 */
async function forTurn({
  product = null,
  colour = null,
  topic = null,
  order = null,
  catalogue = false,
  prices = true,
  requested = null,
} = {}) {
  const lines = [];
  const designs = [];
  const colours = new Set();
  const sizes = new Set();

  try {
    const stored = await faq.facts();

    if (product) {
      // One product in play: describe that, and nothing else.
      lines.push(await productLine(product, { colour, prices }));
      designs.push(product.design || product.name);
      for (const value of await productService.colorsOf(product)) {
        if (value && value !== 'Default') colours.add(value);
      }
      for (const value of await productService.sizesOf(product)) sizes.add(value);
    } else if (catalogue) {
      const [products, categories] = await Promise.all([
        productService.activeProducts(),
        categoryService.availableCategories(),
      ]);

      lines.push(`Shop: ${stored.greeting_brands || config.BUSINESS_NAME}`);

      for (const item of products) {
        lines.push(await productLine(item, { prices }));
        designs.push(item.design || item.name);
        for (const value of await productService.sizesOf(item)) sizes.add(value);

        /**
         * Colours, but only where the choice is real.
         *
         * The backpack alone has twenty-four of them, which measured 328
         * characters - more than a fifth of the whole prompt, for a product
         * that is currently sold out. A design with one colour is not a
         * question the customer is being asked, so its colour is not a word
         * the model needs.
         */
        const own = await productService.colorsOf(item);
        if (own.length > 1 && own.length <= 6) {
          for (const value of own) if (value && value !== 'Default') colours.add(value);
        } else if (own.length === 1 && own[0] !== 'Default') {
          colours.add(own[0]);
        }
      }
    }

    // The stored fact that answers THIS question, if it is one of ours.
    for (const key of EXTRA_FOR[topic] || []) {
      if (stored[key]) lines.push(`${LABEL[key]}: ${stored[key]}`);
    }

    /**
     * What they asked for, and what the shop can actually do instead.
     *
     * Both halves come from the database. The model is told "XL is not
     * available" and given a list of live variants; it may choose the words,
     * it may not choose the facts. Without this it either guessed at an
     * alternative or answered a flat "nahi hai" and lost the sale.
     *
     * Kept to three lines. The whole point of this file is that the catalogue
     * does not travel with every message, and an alternatives list is exactly
     * the sort of thing that quietly grows back into one.
     */
    if (requested && requested.productId) {
      const have = await productService.stockOf(
        requested.productId,
        requested.colour || null,
        requested.size || null
      );

      const wanted = [requested.colour, requested.product, requested.size]
        .filter(Boolean)
        .join(' ');

      if (have > 0) {
        lines.push(`Asked for ${wanted}: available.`);
      } else {
        lines.push(`Asked for ${wanted}: NOT available.`);
        const options = await productService.alternativesFor({
          productId: requested.productId,
          color: requested.colour || null,
          size: requested.size || null,
        });
        if (options.length) {
          lines.push(
            `In stock instead: ${options
              .map((o) => [o.colour, o.product, o.size].filter(Boolean).join(' '))
              .join('; ')}`
          );
        } else {
          // Said explicitly, so the model cannot fill the silence itself.
          lines.push('No alternative is in stock. Do not suggest one.');
        }
      }
    }

    // A business rule, not a fact about a product: it applies to every turn
    // and it is six words.
    lines.push('Prices fixed, no discounts.');

    if (order) {
      lines.push(
        `Their order ${order.order_id} is ${order.status}, ${money(order.total)} total` +
          (Number(order.booking_amount) > 0
            ? `, ${money(order.booking_amount)} booking and ${money(order.remaining_amount)} later`
            : '') +
          '. Refunds, cancellations and dates are a person\'s decision, not yours.'
      );
    }
  } catch (err) {
    logger.warn('context.turn_facts_failed', { error: err.message });
  }

  return {
    facts: lines.join('\n'),
    designs,
    colours: [...colours],
    sizes: [...sizes],
  };
}

module.exports = { shopFacts, forTurn };
