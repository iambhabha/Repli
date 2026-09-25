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

const nodePath = require('path');
const config = require('../config');
const logger = require('../logger');
const productService = require('../services/productService');
const orderService = require('../services/orderService');
const customerService = require('../services/customerService');
const conversationService = require('../services/conversationService');
const paymentService = require('../services/paymentService');

/**
 * A picture that lives in the repo, not a link to it.
 *
 * These three used to paste a raw.githubusercontent.com URL into the message.
 * A customer who asks for the QR wants the QR: a github.com link in a WhatsApp
 * chat looks like a scam, most phones will not preview it, and nobody scans a
 * URL. The file is sitting in assets/, so send the file.
 *
 * The URL survives as the fallback only - if the media send fails, a link the
 * customer can open beats silence.
 */
const ASSETS = {
  spiderman_qr: 'spiderman_qr.jpg',
  spiderman_size_chart: 'spiderman_size_chart.jpg',
};

const assetPath = (key) => nodePath.join(config.ROOT, 'assets', ASSETS[key]);

const money = (n) => `${config.CURRENCY}${Math.round(Number(n) || 0)}`;

/**
 * What each status actually means for the customer standing in front of you.
 *
 * Handed over as a sentence rather than left for the model to infer from the
 * name, because one of these inferences is dangerous: PAYMENT_VERIFYING reads
 * like good news and is not. It means a picture of a payment is sitting with
 * the owner, unchecked. A model guessing from the word "payment" tells a
 * customer their money has landed, and that is the one thing this whole
 * design exists to prevent.
 */
const STATUS_MEANS = {
  PENDING_PAYMENT:
    'Order is placed but no money has been received. They still need to pay.',
  PAYMENT_VERIFYING:
    'Their payment proof is with the owner and has NOT been checked yet. It is not confirmed. Do not say it is.',
  CONFIRMED:
    'The owner has verified the payment. The order is accepted and is being prepared. Use the making time from ABOUT THE SHOP for when it will be ready.',
  CANCELLED: 'This order was cancelled. Nothing is owed and nothing is coming.',
  PAYMENT_FAILED:
    'The owner looked at the payment and rejected it. This needs a person - do not explain why yourself.',
};

const OPEN = ['PENDING_PAYMENT', 'PAYMENT_VERIFYING'];

/** "14 Sep" - a date a person reads, not a timestamp. */
const shortDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

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

/**
 * The shape every product answer takes, so the model sees one format.
 *
 * Everything the shop knows about the thing, because the model is forbidden
 * from inventing and so cannot answer a question about a detail it was not
 * handed. "Cotton hai?", "kaunsa brand?", "print kaisa hai?", "advance kitna?"
 * are all ordinary questions, and a shop that goes quiet on them is the shop
 * that feels like a bot.
 *
 * Sizes are per colour rather than one flat list. They used to be read for
 * colours[0] only and labelled `sizes_in_stock`, which is a quiet lie the
 * moment the red is sold out in L and the black is not - the model would
 * promise an L that the order path then refuses.
 */
async function describe(product) {
  const colours = await productService.availableColors(product.id);

  const options = [];
  for (const colour of colours) {
    options.push({
      colour,
      sizes_in_stock: await productService.availableSizes(product.id, colour),
    });
  }
  // A product with no colour variants still has sizes worth knowing.
  if (!colours.length) {
    const sizes = await productService.availableSizes(product.id, null);
    if (sizes.length) options.push({ colour: null, sizes_in_stock: sizes });
  }

  return {
    name: product.name,
    code: product.code,
    price: money(productService.priceOf(product)),
    category: product.category || null,
    brand: product.brand || null,
    design: product.design || null,
    description: product.description || null,
    made_to_order: Boolean(product.made_to_order),
    in_stock: options.some((o) => o.sizes_in_stock.length) || colours.length > 0,
    options,
    cod_available: Boolean(product.cod_available),
    cod_charge: product.cod_charge ? money(product.cod_charge) : null,
    booking_amount: product.booking_amount ? money(product.booking_amount) : null,
    photos_available: Boolean(product.image_path),
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
      name: 'send_colour_chart',
      description:
        'Send the printed colour chart for a product whose range is chosen off a sheet instead of a list - the hoodies, whose patterns have no names, and the bag. Use it whenever the customer asks which colours there are, or asks to see the colours, for one of those. The customer picks by ticking a colour on the chart and sending the picture back.',
      parameters: {
        type: 'object',
        properties: {
          product: { type: 'string' },
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
      name: 'get_my_orders',
      description:
        "Every order this customer has ever placed, newest first, with its exact status and what that status means, what was ordered, what it cost, what they have paid and what is left. Call this for any question about an order - 'mera order kahan hai', 'kitna pending hai', 'kab aayega', 'maine kya liya tha', or when they quote an order id.",
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
      name: 'send_aesthura_master_booking_message',
      description:
        'Send the exact approved AESTHURA T-shirt master booking message. Call this when the customer asks for full details, price, or booking process for AESTHURA T-shirts. Do NOT summarize or explain it yourself; just call this tool.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_bag_master_message',
      description:
        'Send the exact approved BAG promotional message. Call this when the customer asks about ANY Bag (Elite Bag, Nike Bag, Utility, etc). Do NOT summarize or explain it yourself; just call this tool.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_spiderman_scanner',
      description:
        'CRITICAL: Call this IMMEDIATELY when the customer confirms the size they want to book for the Spider-Man T-shirt, OR when they explicitly ask for a payment scanner/QR. EVEN IF you have already called this tool in a previous turn, you MUST CALL IT AGAIN if the customer asks for the QR/scanner again. Do NOT generate your own text; this tool will send the instructions automatically.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_bag_scanner',
      description:
        'CRITICAL: Call this IMMEDIATELY when the customer says they want to book a bag (like Elite Bag) OR when they explicitly ask for a payment scanner for bags. EVEN IF you have already called this tool in a previous turn, you MUST CALL IT AGAIN if the customer asks for the QR/scanner again. Do NOT generate your own text.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_spiderman_size_chart',
      description:
        'Send the specific size chart image for the Spider-Man T-shirt. Call this when the customer asks about the size chart or measurements for the Spider-Man T-shirt.',
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
        // So a "no" is never a dead end: whatever they asked for, the shop
        // can name what it does have in the same breath.
        options: info.options,
      };
    },

    async send_product_photos({ product, colour }) {
      const found = await resolveProduct(product);
      if (found.error) return { ok: false, reason: found.error };

      // BAG OVERRIDE: Send the Instagram video link instead of photos
      if (found.product.name.toLowerCase().includes('bag') || found.product.name.toLowerCase().includes('backpack')) {
        const msg = "Bhai, bag ka complete video is Instagram link pe hai: https://www.instagram.com/reel/DcY0wtnt4RL/?stkn=YTBod29rcGpoemZv . iss mein sab bags ke patterns aapko dikh gayege aapko jo bhi bag chaye aap iss mein se dekh kr scanner pr payment kr do hum dispatch kr dege.";
        await bot.sendMessage(phone, msg);
        return { ok: true, reason: 'Success. YOU MUST REPLY EXACTLY WITH "[SILENT]" AND NOTHING ELSE.' };
      }

      // T-SHIRT OVERRIDE: Send a message + link instead of photos
      if (found.product.name.toLowerCase().includes('shirt') || found.product.name.toLowerCase().includes('hoodie')) {
        const msg = "Bhai, T-Shirt ka design aur photos is link pe hai: [TSHIRT_LINK_HERE] . Aap yahan se design dekh lo, aur fir mujhe size bata do confirm karne ke liye!";
        await bot.sendMessage(phone, msg);
        return { ok: true, reason: 'Success. YOU MUST REPLY EXACTLY WITH "[SILENT]" AND NOTHING ELSE.' };
      }

      let variant = null;
      if (colour) variant = await productService.findVariant(found.product.id, colour, null);

      const paths = await productService.imagesFor(found.product, variant);
      if (!paths.length) {
        return { ok: false, reason: `no photos on file for ${found.product.name}` };
      }

      let sent = 0;
      for (const path of paths.slice(0, 5)) {
        const went = await bot
          .sendImage(phone, path, '')
          .catch((err) => {
            logger.warn('agent.photo_failed', { phone, error: err.message });
            return false;
          });
        if (went) sent += 1;
      }

      /**
       * Counted, not assumed. WhatsApp refuses media often enough - a bad
       * upload, a session that needs a reload - that "we tried" and "they
       * have it" are different facts, and the customer is looking at the one
       * we do not control.
       */
      if (!sent) {
        return {
          ok: false,
          reason:
            `photos of ${found.product.name} would not send just now. Say the photo is not going ` +
            'through, describe it briefly instead, and offer to have the owner send it.',
        };
      }

      return {
        ok: true,
        sent,
        product: found.product.name,
        note: 'Photos are already on their way. Do not describe them, just say something short.',
      };
    },

    /**
     * The printed sheet, for a range that cannot be listed.
     *
     * The hoodies are about forty camo patterns with no names and the bag is
     * twenty-four colours off one card. Reading either out is not an option
     * and naming them would be inventing the shop's catalogue, so the sheet
     * goes across and the customer marks it.
     *
     * Sent with an empty caption like every other file here: what the
     * customer has to do next is a sentence the model writes, in whatever
     * language the conversation is already in.
     */
    async send_colour_chart({ product }) {
      const found = await resolveProduct(product);
      if (found.error) return { ok: false, reason: found.error };

      const chart = await productService.chartFor(found.product);
      if (!chart) {
        return {
          ok: false,
          reason:
            `no colour chart on file for ${found.product.name}. Do not describe the colours ` +
            'from memory - offer to have the owner send the chart.',
        };
      }

      const count = await productService.chartSize(found.product);

      const sent = await bot.sendImage(phone, chart, '').catch((err) => {
        logger.warn('agent.chart_failed', { phone, error: err.message });
        return false;
      });

      /** Same reason as the photos: "we tried" and "they have it" differ. */
      if (!sent) {
        return {
          ok: false,
          reason:
            `the colour chart for ${found.product.name} would not send just now. Say it is not ` +
            'going through and offer to have the owner send it.',
        };
      }

      return {
        ok: true,
        product: found.product.name,
        colours: count || undefined,
        note:
          'The chart is already on its way. Tell them to tick or mark the colour they want on ' +
          'it and send the picture back - that is how they choose. One or two lines, and do ' +
          'not list the colours, they are on the chart.',
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

    async get_my_orders() {
      const orders = await orderService.historyFor(phone, 10);
      if (!orders.length) return { ok: true, orders: [], note: 'They have never ordered.' };

      return {
        ok: true,
        orders: orders.map((order) => {
          const item = orderService.itemOf(order);
          const payment = orderService.paymentOf(order) || {};
          return {
            order_id: order.order_id,
            status: order.status,
            // The status name alone tells the model nothing safe; this is the
            // difference between "checking" and "confirmed", which is the one
            // distinction it must never get wrong.
            means: STATUS_MEANS[order.status] || 'status unknown - hand this to a person',
            still_open: OPEN.includes(order.status),
            placed_on: shortDate(order.created_at),
            product: item && item.product_name_snapshot,
            colour: (item && item.color_snapshot) || null,
            size: (item && item.size_snapshot) || null,
            quantity: item && item.quantity,
            total: money(order.total),
            pay_now: money(order.booking_amount || order.total),
            remaining: order.remaining_amount ? money(order.remaining_amount) : null,
            payment_mode: order.payment_mode || null,
            payment_status: payment.status || null,
            delivering_to: order.city ? `${order.city}, ${order.state} ${order.pin}` : null,
          };
        }),
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

      /**
       * The QR first, the link if the QR will not go, a person if neither
       * works. A customer who has decided to pay and is handed nothing is the
       * most expensive failure in the shop, so this does not stop at the
       * first thing that did not work.
       */
      if (qr && (await bot.sendImage(phone, qr, `${order.order_id} — ${amount}`))) {
        return { ok: true, sent: 'qr', amount, order_id: order.order_id };
      }

      if (paymentService.isPaymentLinkConfigured()) {
        await bot.sendMessage(phone, `${order.order_id} — ${amount}\n${config.PAYMENT_LINK}`);
        logger.warn('agent.qr_fallback_link', { phone, orderId: order.order_id });
        return { ok: true, sent: 'link', amount, order_id: order.order_id };
      }

      await bot
        .notifyAdmins(
          `⚠️ ${phone} ko ${order.order_id} ka payment detail nahi bhej paaye (QR fail, link set nahi hai).`
        )
        .catch(() => {});
      return {
        ok: false,
        reason:
          'payment details could not be sent. Tell the customer the owner will send them in a moment, then call handoff_to_human.',
      };
    },

    async send_aesthura_master_booking_message() {
      const msg = `🚨 *ONLY LIMITED DROP — LAST CHANCE* 🚨
🔥 *Last time jo book nahi kar paya tha, NOW IS THE TIME!* 🕷️

*✅ALL SIZES AVAILABLE*

🕷️ *SPIDER-MAN T-SHIRT BOOKING OPEN* 🕷️

Jisko bhi *AESTHURA Spider-Man T-shirt* leni hai, *abhi DM karke booking kar do.*

💰 *T-Shirt Price:* ₹2,499
💵 *Booking Amount:* Only ₹300
📦 *Remaining Payment:* T-shirt India aane ke baad hi

⏳ *Approx 1–2 months waiting* after booking, kyunki ye premium T-shirts *out of India manufacture hoke aati hain* aur premium quality ke saath banayi jaati hain.

✨ *Ye T-shirt hamare alawa kahin aur available nahi milegi.*

📏 *SIZES ARE LIMITED!*
Ek baar kisi size ka slot full ho gaya, toh us size ki booking *next booking cycle* mein hi open hogi. Tab tak wait karna padega.

⚠️ *BOOKING SE PEHLE IMPORTANT:*
❌ Booking ke baad *size change nahi hoga*
❌ *Booking amount refund nahi hoga*
❌ Sirf wahi book kare jo *1–2 months wait kar sakta hai*

Agar last time booking miss ho gayi thi, *ye chance miss mat karna.* 🔥

*Apna size book karne ke liye abhi DM karo 📩🕷️*

*DM @9321684451* ✅`;

      const msg2 = `Yaha par payment kar do warna bro jaldi se book kar lo, booking slots full ho jayenge warna fir se wait karna padega 1-2 months! 🕷️

Payment Scanner:
https://raw.githubusercontent.com/iambhabha/Repli/main/assets/spiderman_qr.jpg

Abhi payment karke screenshot bhejo. Main check karke aapki booking confirm karta hoon.`;
      
      await bot.sendMessage(phone, msg);
      await bot.sendMessage(phone, msg2);
      return { ok: true, reason: 'Success. YOU MUST REPLY EXACTLY WITH "[SILENT]" AND NOTHING ELSE. Do not generate any other text.' };
    },

    async send_bag_master_message() {
      const msg = `(🔥 **SPECIAL OFFER — LIMITED TIME ONLY** 🔥

🎒 **Elite Bag — ~~₹3,499~~ ₹2,599**

🎧 **Apple Earphones — ₹1,999 → ₹0 FREE GIFT 🎁**

🚚 **FREE All-India Shipping **→ ₹0

💰 **TOTAL YOU SAVE: ₹2,899 DISCOUNT 🔥**
₹900 Bag Discount + ₹1,999 Earphones FREE

⚠️ Limited pieces only — offer stock khatam hone se pehle book kar lo! 👊)`;

      const msg2 = `Yahan par pay karke screenshot bhej do, aur jo bhi bag chahiye uska bhi screenshot bhej do. Baaki hamare owner aakar aapse baat kar lenge.

Payment Scanner:
https://raw.githubusercontent.com/iambhabha/Repli/main/assets/spiderman_qr.jpg`;

      await bot.sendMessage(phone, msg);
      await bot.sendMessage(phone, msg2);
      return { ok: true, reason: 'Success. YOU MUST REPLY EXACTLY WITH "[SILENT]" AND NOTHING ELSE. Do not generate any other text.' };
    },

    async send_spiderman_scanner() {
      const msg =
        'Great! Book fast, warna booking slots full ho jayenge aur phir next booking cycle ka wait karna padega. ' +
        'Jaldi book kar do, warna 1–2 months ka wait ho sakta hai. 🕷️\n\n' +
        'Payment Scanner:\nhttps://raw.githubusercontent.com/iambhabha/Repli/main/assets/spiderman_qr.jpg\n\n' +
        'Abhi payment karke screenshot bhejo. Main check karke aapki booking confirm karta hoon.';

      await bot.sendMessage(phone, msg);

      return {
        ok: true,
        reason: 'Success. YOU MUST REPLY EXACTLY WITH "[SILENT]" AND NOTHING ELSE. Do not generate any other text.',
      };
    },

    async send_bag_scanner() {
      const msg =
        'Yahan par pay karke screenshot bhej do, aur jo bhi bag chahiye uska bhi screenshot bhej do. ' +
        'Baaki hamare owner aakar aapse baat kar lenge.\n\n' +
        'Payment Scanner:\nhttps://raw.githubusercontent.com/iambhabha/Repli/main/assets/spiderman_qr.jpg';

      await bot.sendMessage(phone, msg);

      return {
        ok: true,
        reason: 'Success. YOU MUST REPLY EXACTLY WITH "[SILENT]" AND NOTHING ELSE. Do not generate any other text.',
      };
    },

    async send_spiderman_size_chart() {
      const msg = 'Spider-Man T-Shirt Size Chart 🕷️\n\nhttps://raw.githubusercontent.com/iambhabha/Repli/main/assets/spiderman_size_chart.jpg';
      
      await bot.sendMessage(phone, msg);

      return {
        ok: true,
        reason: 'Success. YOU MUST REPLY EXACTLY WITH "[SILENT]" AND NOTHING ELSE. Do not generate any other text.',
      };
    },

    async handoff_to_human({ reason }) {
      await conversationService.setMode(phone, conversationService.MODE.HUMAN);
      await conversationService.save(phone, { state: 'HUMAN_HANDOFF' });
      await bot
        /**
         * The way back is in the message.
         *
         * HUMAN mode is permanent until an admin lifts it, and an alert that
         * does not say how to lift it leaves the owner holding a conversation
         * the bot will never speak in again.
         */
        .notifyAdmins(
          `🙋 ${phone} ko banda chahiye.\nReason: ${reason || 'not given'}\n\n` +
            `Wapas bot par dene ke liye: /resume ${phone}`
        )
        .catch(() => {});
      logger.info('agent.handoff', { phone, action: reason });
      return { ok: true, handed_off: true, note: 'Say one short closing line, then stop.' };
    },
  };
}

module.exports = { DEFINITIONS, handlers, resolveProduct };
