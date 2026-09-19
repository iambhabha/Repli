'use strict';

/**
 * What the agent is allowed to do, and the check on each one.
 *
 * The model works in words - "black spiderman tee, large, 2 pieces". The shop
 * works in uuids and stock counts. Every tool here is the join between the
 * two, and the join is where the safety lives: the model NAMES something and
 * this file decides whether that name exists, is active, and has stock. A
 * product the model invented resolves to nothing and the tool says so, in
 * words the model can act on.
 *
 * So the rule for every handler below:
 *
 *   never trust an argument, always re-read the database, and return
 *   { ok: false, reason } rather than throwing - a refusal the model can
 *   recover from beats an exception the customer sees.
 *
 * Three things are deliberately NOT tools, and adding them later should be a
 * decision someone argues for rather than a convenience:
 *
 *   confirming a payment   only an admin's /paid does this, through
 *                          confirm_order_payment(). A model cannot be allowed
 *                          to decide that money arrived - a screenshot is a
 *                          picture, and a convincing picture is cheap.
 *   moving stock           follows from confirming a payment, in the same
 *                          transaction, for the same reason.
 *   rejecting a payment     the other half of the same admin decision.
 */

const config = require('../config');
const logger = require('../logger');
const productService = require('../services/productService');
const orderService = require('../services/orderService');
const customerService = require('../services/customerService');
const conversationService = require('../services/conversationService');
const paymentService = require('../services/paymentService');

const money = (n) => `${config.CURRENCY}${Math.round(Number(n) || 0)}`;

/** Loose match on a name the model typed, against names the shop really has. */
const slug = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Resolve a product NAME to a live row.
 *
 * Exact slug first, then "every word the model said appears in the name" -
 * which is what makes "spiderman tshirt" find "Spider-Man T-Shirt" without a
 * keyword table. Ambiguity is reported rather than guessed: two matches means
 * the model has to ask, and picking one for it is how a customer ends up
 * buying the wrong thing.
 */
async function resolveProduct(name) {
  const products = await productService.activeProducts();
  const want = slug(name);
  if (!want) return { error: 'no product name given' };

  const exact = products.filter((p) => slug(p.name) === want || slug(p.code) === want);
  if (exact.length === 1) return { product: exact[0] };

  const words = want.split(' ').filter(Boolean);
  const partial = products.filter((p) => {
    const haystack = `${slug(p.name)} ${slug(p.code)} ${slug(p.design)} ${slug(p.brand)}`;
    return words.every((w) => haystack.includes(w));
  });

  if (partial.length === 1) return { product: partial[0] };
  if (partial.length > 1) {
    return {
      error: `"${name}" matches more than one product: ${partial
        .map((p) => p.name)
        .join(', ')}. Ask the customer which one.`,
    };
  }
  return {
    error: `no product called "${name}". The shop sells: ${products
      .map((p) => p.name)
      .join(', ')}.`,
  };
}

/** The shape every product answer takes, so the model sees one format. */
async function describe(product) {
  const colours = await productService.availableColors(product.id);
  const sizes = await productService.availableSizes(product.id, colours[0] || null);
  return {
    name: product.name,
    price: money(productService.priceOf(product)),
    category: product.category || null,
    made_to_order: Boolean(product.made_to_order),
    colours_in_stock: colours,
    sizes_in_stock: sizes,
    cod_available: Boolean(product.cod_available),
    booking_amount: product.booking_amount ? money(product.booking_amount) : null,
  };
}

// --------------------------------------------------------------- definitions

const DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'list_products',
      description:
        'Everything the shop sells right now, with live prices and the colours and sizes that are actually in stock. Call this before naming any product, price or option to the customer.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_stock',
      description:
        'Whether one specific product/colour/size can be sold right now, and how many. Call this before promising a customer that something is available.',
      parameters: {
        type: 'object',
        properties: {
          product: { type: 'string', description: 'Product name as the shop lists it' },
          colour: { type: 'string', description: 'Colour, if the customer chose one' },
          size: { type: 'string', description: 'Size, if the product has sizes' },
        },
        required: ['product'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_product_photos',
      description:
        'Send the customer photographs of a product. Use when they ask to see it, or when showing is clearly better than describing.',
      parameters: {
        type: 'object',
        properties: {
          product: { type: 'string' },
          colour: { type: 'string', description: 'Limits the photos to one colour' },
        },
        required: ['product'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_saved_details',
      description:
        "The delivery details this customer gave on a previous order, if any. Call before asking them to type an address again - ask them to confirm the saved one instead.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_details',
      description:
        'Store delivery details the customer has given. Send only the fields they actually stated; never invent or guess a field.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          address: { type: 'string', description: 'House/street line' },
          city: { type: 'string' },
          state: { type: 'string' },
          pin: { type: 'string', description: '6-digit Indian PIN code' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_order',
      description:
        'Place the order, once the customer has clearly confirmed what they want AND full delivery details are saved. This reserves nothing and takes no money - it creates a PENDING_PAYMENT order and returns the order id and amount to collect. Never call this speculatively.',
      parameters: {
        type: 'object',
        properties: {
          product: { type: 'string' },
          colour: { type: 'string' },
          size: { type: 'string' },
          quantity: { type: 'integer', minimum: 1 },
          payment_mode: {
            type: 'string',
            enum: ['FULL', 'COD'],
            description: 'Only for products where cod_available is true and the customer chose',
          },
        },
        required: ['product', 'quantity'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_open_order',
      description:
        "This customer's current unfinished order and its status, or nothing if they have none.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_order',
      description: 'Cancel the open order. Only when the customer has clearly asked to cancel.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_payment_details',
      description:
        'Send the payment link or QR for the open order. Call after create_order, and again if the customer says they lost it.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'handoff_to_human',
      description:
        'Stop answering and hand this conversation to a person. Use when the customer asks for a human, is upset, is asking about money already paid, or is asking something you genuinely cannot resolve. The shop owner is alerted. After this you must not reply again.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Short reason, for the owner' },
        },
        required: ['reason'],
      },
    },
  },
];

// ------------------------------------------------------------------ handlers

/**
 * @param {object} bot   the WhatsApp adapter, for tools that send something
 * @param {string} phone the customer, already normalised
 */
function handlers(bot, phone) {
  return {
    async list_products() {
      const products = await productService.activeProducts();
      if (!products.length) return { ok: false, reason: 'the shop has nothing active right now' };
      return {
        ok: true,
        shipping: config.SHIPPING_CHARGE ? money(config.SHIPPING_CHARGE) : 'free',
        products: await Promise.all(products.map(describe)),
      };
    },

    async check_stock({ product, colour, size }) {
      const found = await resolveProduct(product);
      if (found.error) return { ok: false, reason: found.error };

      const info = await describe(found.product);
      if (!colour && !size) return { ok: true, ...info };

      const quantity = await productService.stockOf(found.product.id, colour || null, size || null);
      return {
        ok: true,
        product: found.product.name,
        colour: colour || null,
        size: size || null,
        available: quantity > 0,
        quantity,
        price: info.price,
        // So a "no" is never a dead end.
        colours_in_stock: info.colours_in_stock,
        sizes_in_stock: await productService.availableSizes(found.product.id, colour || null),
      };
    },

    async send_product_photos({ product, colour }) {
      const found = await resolveProduct(product);
      if (found.error) return { ok: false, reason: found.error };

      let variant = null;
      if (colour) variant = await productService.findVariant(found.product.id, colour, null);

      const paths = await productService.imagesFor(found.product, variant);
      if (!paths.length) {
        return { ok: false, reason: `no photos on file for ${found.product.name}` };
      }

      for (const path of paths.slice(0, 5)) {
        await bot.sendImage(phone, path, '').catch((err) =>
          logger.warn('agent.photo_failed', { phone, error: err.message })
        );
      }
      return {
        ok: true,
        sent: Math.min(paths.length, 5),
        product: found.product.name,
        note: 'Photos are already on their way. Do not describe them, just say something short.',
      };
    },

    async get_saved_details() {
      const customer = await customerService.getByPhone(phone);
      const address = customer ? customerService.addressOf(customer) : null;
      if (!address) return { ok: true, saved: false };
      return {
        ok: true,
        saved: true,
        complete: customerService.hasFullAddress(customer),
        details: address,
      };
    },

    async save_details(fields) {
      const clean = {};
      for (const key of ['name', 'address', 'city', 'state', 'pin']) {
        const value = String((fields && fields[key]) || '').trim();
        if (value) clean[key] = value;
      }
      if (!Object.keys(clean).length) return { ok: false, reason: 'nothing to save' };

      if (clean.pin && !/^\d{6}$/.test(clean.pin)) {
        return { ok: false, reason: `"${clean.pin}" is not a 6-digit PIN code - ask again` };
      }

      const customer = await customerService.saveDetails(phone, clean);
      const missing = ['name', 'address', 'city', 'state', 'pin'].filter((k) => !customer[k]);
      return { ok: true, saved: Object.keys(clean), still_missing: missing };
    },

    async create_order({ product, colour, size, quantity, payment_mode: paymentMode }) {
      const existing = await orderService.openFor(phone);
      if (existing) {
        return {
          ok: false,
          reason: `they already have order ${existing.order_id} open (${existing.status}). Deal with that one instead of making another.`,
        };
      }

      const found = await resolveProduct(product);
      if (found.error) return { ok: false, reason: found.error };

      const customer = await customerService.getByPhone(phone);
      if (!customer || !customerService.hasFullAddress(customer)) {
        const missing = ['name', 'address', 'city', 'state', 'pin'].filter(
          (k) => !(customer && customer[k])
        );
        return {
          ok: false,
          reason: `cannot place an order yet - still missing ${missing.join(', ')}. Ask for those first and save them.`,
        };
      }

      const qty = Math.max(1, Math.floor(Number(quantity) || 1));
      if (qty > config.MAX_QTY) {
        return { ok: false, reason: `most we sell in one order is ${config.MAX_QTY}` };
      }

      /**
       * Checked here and not only at /paid.
       *
       * confirm_order_payment() is the real gate - it will refuse to move
       * stock that is not there. But finding that out AFTER the customer has
       * paid is the worst possible moment, so the same question is asked
       * before the order exists.
       */
      const available = await productService.stockOf(found.product.id, colour || null, size || null);
      if (available < qty) {
        return {
          ok: false,
          reason:
            available > 0
              ? `only ${available} left of that - offer them ${available}, or another option`
              : 'that exact colour/size is out of stock - offer an alternative',
          colours_in_stock: await productService.availableColors(found.product.id),
          sizes_in_stock: await productService.availableSizes(found.product.id, colour || null),
        };
      }

      const variant = await productService.findVariant(
        found.product.id,
        colour || null,
        size || null
      );

      const order = await orderService.create(
        phone,
        {
          productId: found.product.id,
          variantId: variant ? variant.id : null,
          quantity: qty,
          color: colour || null,
          size: size || null,
          ...customerService.addressOf(customer),
        },
        { paymentMode: paymentMode || undefined }
      );

      await conversationService.save(phone, {
        current_order_id: order.id,
        state: 'WAITING_FOR_PAYMENT',
      });

      logger.info('agent.order_created', {
        phone,
        orderId: order.order_id,
        action: `${found.product.name} ${colour || ''} ${size || ''} x${qty}`.trim(),
      });

      return {
        ok: true,
        order_id: order.order_id,
        product: found.product.name,
        colour: colour || null,
        size: size || null,
        quantity: qty,
        total: money(order.total),
        pay_now: money(order.booking_amount || order.total),
        pay_later: order.remaining_amount ? money(order.remaining_amount) : null,
        payment_mode: order.payment_mode,
        next: 'Tell them the order id and the amount, then call send_payment_details.',
      };
    },

    async get_open_order() {
      const order = await orderService.openFor(phone);
      if (!order) return { ok: true, has_order: false };
      const item = orderService.itemOf(order);
      return {
        ok: true,
        has_order: true,
        order_id: order.order_id,
        status: order.status,
        product: item && item.product_name_snapshot,
        colour: item && item.color_snapshot,
        size: item && item.size_snapshot,
        quantity: item && item.quantity,
        total: money(order.total),
        pay_now: money(order.booking_amount || order.total),
        payment_status: (orderService.paymentOf(order) || {}).status || null,
      };
    },

    async cancel_order() {
      const order = await orderService.cancelOpen(phone);
      if (!order) return { ok: false, reason: 'they have no open order to cancel' };
      await conversationService.save(phone, {
        ...conversationService.clearedCart(),
        state: 'CANCELLED',
      });
      return { ok: true, cancelled: order.order_id };
    },

    async send_payment_details() {
      const order = await orderService.openFor(phone);
      if (!order) return { ok: false, reason: 'no open order to pay for' };

      const amount = money(order.booking_amount || order.total);
      const qr = await paymentService.paymentQrImage().catch(() => null);

      if (qr) {
        await bot.sendImage(phone, qr, `${order.order_id} — ${amount}`);
        return { ok: true, sent: 'qr', amount, order_id: order.order_id };
      }
      if (paymentService.isPaymentLinkConfigured()) {
        await bot.sendMessage(phone, `${order.order_id} — ${amount}\n${config.PAYMENT_LINK}`);
        return { ok: true, sent: 'link', amount, order_id: order.order_id };
      }
      return {
        ok: false,
        reason:
          'the shop has no payment link or QR configured. Tell the customer the owner will send payment details, and hand off to a human.',
      };
    },

    async handoff_to_human({ reason }) {
      await conversationService.setMode(phone, conversationService.MODE.HUMAN);
      await conversationService.save(phone, { state: 'HUMAN_HANDOFF' });
      await bot
        .notifyAdmins(`🙋 ${phone} needs a person.\nReason: ${reason || 'not given'}`)
        .catch(() => {});
      logger.info('agent.handoff', { phone, action: reason });
      return { ok: true, handed_off: true, note: 'Say one short closing line, then stop.' };
    },
  };
}

module.exports = { DEFINITIONS, handlers, resolveProduct };
