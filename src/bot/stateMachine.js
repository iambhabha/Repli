'use strict';

/**
 * The controlled conversation flow.
 *
 * State lives in Supabase (`conversations`), one row per normalised phone,
 * so conversations never mix and a restart loses nothing.
 *
 * Access control (bypass / admin / HUMAN mode / bot switch) happens in
 * router.js before anything here runs.
 */

const config = require('../config');
const logger = require('../logger');
const parser = require('./parser');
const messages = require('./messages');
const conversationService = require('../services/conversationService');
const customerService = require('../services/customerService');
const productService = require('../services/productService');
const orderService = require('../services/orderService');
const paymentService = require('../services/paymentService');

const { MODE, STATES } = conversationService;
const DETAIL_FIELDS = customerService.DETAIL_FIELDS;

const NAME_LIKE = /^[\p{L}\p{M}][\p{L}\p{M}.'\-\s]{1,59}$/u;

const VALIDATORS = {
  name: (v) => NAME_LIKE.test(v),
  address: (v) => v.length >= 6 && v.length <= 300,
  city: (v) => NAME_LIKE.test(v) && v.length <= 50,
  state: (v) => NAME_LIKE.test(v) && v.length <= 50,
  pin: (v) => /^\d{6}$/.test(v),
};

function cleanField(field, raw) {
  const value = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
  if (field === 'pin') return value.replace(/\D/g, '').slice(0, 10);
  if (field === 'address') return String(raw).replace(/[ \t]+/g, ' ').trim().slice(0, 300);
  return value.slice(0, 60);
}

const draftOf = (convo) => (convo.data && convo.data.draft) || {};
const colorOf = (convo) => (convo.data && convo.data.color) || null;
const sizeOf = (convo) => (convo.data && convo.data.size) || null;

// --------------------------------------------------------------- flow steps

async function sendWelcome(bot, phone) {
  const products = await productService.activeProducts();
  await bot.sendMessage(phone, bot.t.welcome(products));
  await conversationService.save(
    phone,
    conversationService.clearedCart({ state: STATES.SELECT_PRODUCT })
  );
}

/** Product chosen -> ask colour, or skip when there is only one. */
async function afterProductSelected(bot, phone, product) {
  const colors = await productService.colorsOf(product);

  if (colors.length === 1) {
    return afterColorSelected(bot, phone, product, colors[0]);
  }

  await bot.sendMessage(phone, bot.t.chooseColor(product, colors));
  await conversationService.save(
    phone,
    conversationService.clearedCart({
      state: STATES.SELECT_COLOR,
      selected_product_id: product.id,
    })
  );
  return 'product_selected';
}

/** Colour chosen -> ask size, or run the stock check for sizeless products. */
async function afterColorSelected(bot, phone, product, color, extra = {}) {
  const hasSizes = await productService.hasSizes(product);

  if (hasSizes) {
    const sizesLeft = await productService.availableSizes(product.id, color);
    if (!sizesLeft.length) {
      await bot.sendMessage(
        phone,
        bot.t.colorOutOfStock(product, color, await productService.availableColors(product.id))
      );
      await conversationService.save(phone, {
        state: STATES.SELECT_COLOR,
        selected_product_id: product.id,
        selected_variant_id: null,
        data: { color },
      });
      return 'out_of_stock';
    }

    const allSizes = await productService.sizesOf(product);
    await bot.sendMessage(
      phone,
      extra.combined
        ? bot.t.colorPickedNowSize(product, color, sizesLeft)
        : bot.t.chooseSize(allSizes)
    );
    await conversationService.save(phone, {
      state: STATES.SELECT_SIZE,
      selected_product_id: product.id,
      selected_variant_id: null,
      quantity: null,
      data: { color },
    });
    return 'color_selected';
  }

  // sizeless product (Bag)
  const variant = await productService.findVariant(product.id, color, null);
  const stock = await productService.stockOf(product.id, color, null);

  if (stock <= 0) {
    await bot.sendMessage(
      phone,
      bot.t.colorOutOfStock(product, color, await productService.availableColors(product.id))
    );
    await conversationService.save(phone, {
      state: STATES.SELECT_COLOR,
      selected_product_id: product.id,
      data: { color },
    });
    return 'out_of_stock';
  }

  await bot.sendMessage(
    phone,
    bot.t.available(product, color, '', productService.priceOf(product))
  );
  await conversationService.save(phone, {
    state: STATES.SELECT_QUANTITY,
    selected_product_id: product.id,
    selected_variant_id: variant ? variant.id : null,
    quantity: null,
    data: { color, size: null },
  });
  return 'color_selected';
}

/** Everything picked -> reuse the saved address (after asking) or collect it. */
async function goToDetails(bot, phone, convo) {
  const draft = draftOf(convo);
  const complete = DETAIL_FIELDS.every((field) => draft[field]);
  if (complete) return showSummary(bot, phone, convo);

  const customer = await customerService.getByPhone(phone);
  if (customerService.hasFullAddress(customer)) {
    await bot.sendMessage(phone, bot.t.confirmSavedAddress(customer));
    await conversationService.save(phone, {
      state: STATES.COLLECT_DETAILS,
      data: { ...convo.data, awaiting: 'address_confirm' },
    });
    return 'ask_saved_address';
  }

  await bot.sendMessage(phone, bot.t.askDetails());
  const missing = DETAIL_FIELDS.find((field) => !draft[field]) || 'name';
  await conversationService.save(phone, {
    state: STATES.COLLECT_DETAILS,
    data: { ...convo.data, awaiting: missing },
  });
  return 'ask_details';
}

/** Build the priced draft used by the summary and by order creation. */
async function buildDraft(convo) {
  const product = await productService.getById(convo.selected_product_id);
  if (!product) return null;

  const quantity = Math.max(1, Math.floor(Number(convo.quantity) || 1));
  const unitPrice = productService.priceOf(product);
  const subtotal = unitPrice * quantity;
  const shipping = Math.max(0, Math.floor(config.SHIPPING_CHARGE));

  return {
    ...draftOf(convo),
    productId: product.id,
    variantId: convo.selected_variant_id,
    color: colorOf(convo),
    size: sizeOf(convo),
    quantity,
    unitPrice,
    subtotal,
    shipping,
    total: subtotal + shipping,
    product,
  };
}

async function showSummary(bot, phone, convo) {
  const draft = await buildDraft(convo);
  if (!draft) {
    await sendWelcome(bot, phone);
    return 'restart_missing_product';
  }

  // stock can move while the customer is typing - re-check before confirming
  const available = await productService.stockOf(draft.productId, draft.color, draft.size);
  if (available < draft.quantity) {
    return handleShortStock(bot, phone, convo, draft, available);
  }

  await bot.sendMessage(phone, bot.t.orderSummary(draft, draft.product));
  await conversationService.save(phone, {
    state: STATES.ORDER_SUMMARY,
    data: { ...convo.data, awaiting: null, draft: pickDetails(draft) },
  });
  return 'summary';
}

const pickDetails = (source) => {
  const out = {};
  for (const field of DETAIL_FIELDS) if (source[field]) out[field] = source[field];
  return out;
};

/** Shared "not enough stock" routing used by several states. */
async function handleShortStock(bot, phone, convo, draft, available) {
  const product = draft.product || (await productService.getById(convo.selected_product_id));

  if (available > 0) {
    await bot.sendMessage(phone, bot.t.onlyNAvailable(available));
    await conversationService.save(phone, {
      state: STATES.SELECT_QUANTITY,
      data: { ...convo.data, offeredQty: available },
    });
    return 'quantity_capped';
  }

  if (await productService.hasSizes(product)) {
    await bot.sendMessage(
      phone,
      bot.t.outOfStock(
        product,
        draft.color,
        draft.size,
        await productService.availableSizes(product.id, draft.color)
      )
    );
    await conversationService.save(phone, {
      state: STATES.SELECT_SIZE,
      selected_variant_id: null,
      data: { ...convo.data, size: null },
    });
  } else {
    await bot.sendMessage(
      phone,
      bot.t.colorOutOfStock(product, draft.color, await productService.availableColors(product.id))
    );
    await conversationService.save(phone, { state: STATES.SELECT_COLOR, data: convo.data });
  }
  return 'out_of_stock';
}

async function createOrderAndAskPayment(bot, phone, convo) {
  const draft = await buildDraft(convo);
  if (!draft) {
    await sendWelcome(bot, phone);
    return 'restart_missing_product';
  }

  const available = await productService.stockOf(draft.productId, draft.color, draft.size);
  if (available < draft.quantity) {
    return handleShortStock(bot, phone, convo, draft, available);
  }

  const order = await orderService.create(phone, draft);
  await bot.sendMessage(phone, bot.t.paymentInstructions(order));
  await conversationService.save(phone, {
    state: STATES.WAITING_FOR_PAYMENT,
    current_order_id: order.id,
    data: { ...convo.data, awaiting: null },
  });

  if (!paymentService.isPaymentLinkConfigured()) {
    await bot.notifyAdmins(
      `⚠️ PAYMENT_LINK .env me set nahi hai. Order #${order.order_id} bina payment link ke gaya.`
    );
  }
  return 'order_created';
}

/** Hand the customer to a human and stop replying. */
async function goToHuman(bot, phone, reason, { announce = true } = {}) {
  await conversationService.save(phone, { mode: MODE.HUMAN, state: STATES.HUMAN_HANDOFF });
  if (announce) await bot.sendMessage(phone, bot.t.handoff());

  const order = await orderService.openFor(phone);
  await bot.notifyAdmins(
    `🙋 HUMAN MODE\n\nCustomer: ${phone}\nReason: ${reason}` +
      (order ? `\nOpen order: #${order.order_id} (${order.status})` : '') +
      `\n\nRepli ne is customer ko reply karna band kar diya hai.\nBot wapas chalu karne ke liye: /resume ${phone}`
  );
  logger.info('conversation.human', { phone, action: reason });
  return 'human_mode';
}

// ------------------------------------------------------------ state handlers

async function handleDetails(bot, phone, convo, text) {
  const awaiting = (convo.data && convo.data.awaiting) || 'name';
  let draft = { ...draftOf(convo) };

  if (awaiting === 'address_confirm') {
    if (parser.isYes(text)) {
      const customer = await customerService.getByPhone(phone);
      draft = customerService.addressOf(customer) || {};
      return showSummary(bot, phone, { ...convo, data: { ...convo.data, draft, awaiting: null } });
    }
    if (parser.isNo(text)) {
      await bot.sendMessage(phone, bot.t.askDetails());
      await conversationService.save(phone, {
        state: STATES.COLLECT_DETAILS,
        data: { ...convo.data, draft: {}, awaiting: 'name' },
      });
      return 'address_new';
    }
    await bot.sendMessage(phone, bot.t.yesOrNo());
    return 'address_unclear';
  }

  let found = parser.parseLabelledDetails(text);
  if (!Object.keys(found).length) {
    const block = parser.parsePlainDetailBlock(text);
    if (block) found = block;
  }

  const invalid = [];

  if (Object.keys(found).length) {
    for (const [field, raw] of Object.entries(found)) {
      const value = cleanField(field, raw);
      if (VALIDATORS[field](value)) draft[field] = value;
      else invalid.push(field);
    }
  } else {
    const value = cleanField(awaiting, text);
    if (!VALIDATORS[awaiting](value)) {
      await bot.sendMessage(phone, bot.t.invalidField(awaiting));
      return 'detail_invalid';
    }
    draft[awaiting] = value;
  }

  const missing = DETAIL_FIELDS.filter((field) => !draft[field]);

  if (!missing.length) {
    await customerService.saveDetails(phone, draft);
    return showSummary(bot, phone, { ...convo, data: { ...convo.data, draft, awaiting: null } });
  }

  await conversationService.save(phone, {
    state: STATES.COLLECT_DETAILS,
    data: { ...convo.data, draft, awaiting: missing[0] },
  });
  if (invalid.length) await bot.sendMessage(phone, bot.t.invalidField(invalid[0]));
  await bot.sendMessage(phone, bot.t.askField(missing[0]));
  return 'detail_saved';
}

async function handleQuantity(bot, phone, convo, text) {
  const product = await productService.getById(convo.selected_product_id);
  if (!product) {
    await sendWelcome(bot, phone);
    return 'restart_missing_product';
  }

  const color = colorOf(convo);
  const size = sizeOf(convo);
  const offered = convo.data && convo.data.offeredQty;

  let quantity = parser.parseQuantity(text);
  if (quantity === null && offered && parser.isYes(text)) quantity = offered;

  if (quantity === null) {
    await bot.sendMessage(phone, bot.t.quantityNotUnderstood());
    return 'quantity_unclear';
  }
  if (quantity > config.MAX_QTY) {
    await bot.sendMessage(phone, bot.t.quantityTooHigh(config.MAX_QTY));
    return 'quantity_too_high';
  }

  const available = await productService.stockOf(product.id, color, size);
  if (available < quantity) {
    return handleShortStock(
      bot,
      phone,
      convo,
      { color, size, product, quantity },
      available
    );
  }

  const updated = await conversationService.save(phone, {
    state: STATES.SELECT_QUANTITY,
    quantity,
    data: { ...convo.data, offeredQty: null },
  });
  return goToDetails(bot, phone, { ...updated, data: updated.data || {} });
}

async function handleSize(bot, phone, convo, text) {
  const product = await productService.getById(convo.selected_product_id);
  if (!product) {
    await sendWelcome(bot, phone);
    return 'restart_missing_product';
  }

  const sizes = await productService.sizesOf(product);
  const size = parser.detectSize(text, sizes);
  if (!size) {
    await bot.sendMessage(phone, bot.t.sizeNotUnderstood(sizes));
    return 'size_unclear';
  }

  const color = colorOf(convo);
  if ((await productService.stockOf(product.id, color, size)) <= 0) {
    await bot.sendMessage(
      phone,
      bot.t.outOfStock(
        product,
        color,
        size,
        await productService.availableSizes(product.id, color)
      )
    );
    return 'out_of_stock';
  }

  const variant = await productService.findVariant(product.id, color, size);
  await bot.sendMessage(
    phone,
    bot.t.available(product, color, size, productService.priceOf(product))
  );
  await conversationService.save(phone, {
    state: STATES.SELECT_QUANTITY,
    selected_variant_id: variant ? variant.id : null,
    data: { ...convo.data, size },
  });
  return 'size_set';
}

/** A photo/PDF can only mean one thing here: payment proof. */
async function handleMedia(bot, phone, convo, msg) {
  const order = await orderService.openFor(phone);

  if (!order) {
    await bot.sendMessage(phone, bot.t.needOrderFirst());
    return 'proof_without_order';
  }

  await paymentService.handlePaymentProof(bot, order, msg.media, messages);
  await bot.sendMessage(phone, bot.t.paymentProofReceived());
  await conversationService.save(phone, {
    state: STATES.PAYMENT_VERIFYING,
    current_order_id: order.id,
  });
  return 'payment_proof';
}

/** Product (and maybe colour/size/quantity) named in one free-text message. */
async function handleFreeTextOrder(bot, phone, text, product) {
  const colors = await productService.colorsOf(product);
  const color = parser.detectColorByKeyword(text, colors);

  if (!color) return afterProductSelected(bot, phone, product);

  const hasSizes = await productService.hasSizes(product);
  if (!hasSizes) return afterColorSelected(bot, phone, product, color);

  const allSizes = await productService.sizesOf(product);
  const size = parser.detectSize(text, allSizes);

  if (size && (await productService.stockOf(product.id, color, size)) > 0) {
    const variant = await productService.findVariant(product.id, color, size);
    await bot.sendMessage(
      phone,
      bot.t.available(product, color, size, productService.priceOf(product))
    );
    await conversationService.save(
      phone,
      conversationService.clearedCart({
        state: STATES.SELECT_QUANTITY,
        selected_product_id: product.id,
        selected_variant_id: variant ? variant.id : null,
        data: { color, size },
      })
    );
    return 'product_color_size_selected';
  }

  return afterColorSelected(bot, phone, product, color, { combined: true });
}

// ------------------------------------------------------------- entry point

/**
 * Handle one customer message. Returns the detected action, for logging.
 */
async function handleMessage(bot, msg) {
  const phone = config.normalisePhone(msg.phone);
  const convo = await conversationService.get(phone);
  const text = String(msg.text || '');
  const command = parser.detectCommand(text);

  // customer asks for a person
  if (!msg.isMedia && parser.wantsHuman(text)) {
    return goToHuman(bot, phone, 'customer asked for a human');
  }

  if (msg.isMedia) return handleMedia(bot, phone, convo, msg);

  if (command === 'help') {
    await bot.sendMessage(phone, bot.t.help());
    return 'help';
  }
  if (command === 'cancel') {
    await orderService.cancelOpen(phone);
    await conversationService.save(
      phone,
      conversationService.clearedCart({ state: STATES.CANCELLED })
    );
    await bot.sendMessage(phone, bot.t.cancelled());
    return 'cancel';
  }
  if (command === 'menu') {
    await sendWelcome(bot, phone);
    return 'menu';
  }
  if (
    command === 'address' &&
    (convo.state === STATES.ORDER_SUMMARY || convo.state === STATES.COLLECT_DETAILS)
  ) {
    await bot.sendMessage(phone, bot.t.askDetails());
    await conversationService.save(phone, {
      state: STATES.COLLECT_DETAILS,
      data: { ...convo.data, draft: {}, awaiting: 'name' },
    });
    return 'redo_details';
  }

  switch (convo.state) {
    case STATES.START:
    case STATES.CANCELLED:
    case STATES.SELECT_PRODUCT: {
      const products = await productService.activeProducts();
      const byKeyword = parser.detectProductByKeyword(text, products);
      if (byKeyword) return handleFreeTextOrder(bot, phone, text, byKeyword);

      if (convo.state !== STATES.SELECT_PRODUCT) {
        await sendWelcome(bot, phone);
        return 'welcome';
      }

      const product = parser.detectProductChoice(text, products);
      if (!product) {
        await bot.sendMessage(phone, bot.t.productNotUnderstood(products));
        return 'product_unclear';
      }
      return afterProductSelected(bot, phone, product);
    }

    case STATES.SELECT_COLOR: {
      const product = await productService.getById(convo.selected_product_id);
      if (!product) {
        await sendWelcome(bot, phone);
        return 'restart_missing_product';
      }
      const colors = await productService.colorsOf(product);
      const color = parser.detectColorChoice(text, colors);
      if (!color) {
        await bot.sendMessage(phone, bot.t.colorNotUnderstood(colors));
        return 'color_unclear';
      }
      return afterColorSelected(bot, phone, product, color);
    }

    case STATES.SELECT_SIZE:
      return handleSize(bot, phone, convo, text);

    case STATES.SELECT_QUANTITY:
      return handleQuantity(bot, phone, convo, text);

    case STATES.COLLECT_DETAILS:
      return handleDetails(bot, phone, convo, text);

    case STATES.ORDER_SUMMARY: {
      if (parser.isYes(text)) return createOrderAndAskPayment(bot, phone, convo);
      if (parser.isNo(text)) {
        await bot.sendMessage(phone, bot.t.askDetails());
        await conversationService.save(phone, {
          state: STATES.COLLECT_DETAILS,
          data: { ...convo.data, draft: {}, awaiting: 'name' },
        });
        return 'summary_declined';
      }
      await bot.sendMessage(phone, bot.t.summaryNotUnderstood());
      return 'summary_unclear';
    }

    case STATES.WAITING_FOR_PAYMENT: {
      const order =
        (await orderService.getById(convo.current_order_id)) || (await orderService.openFor(phone));
      if (!order) {
        await sendWelcome(bot, phone);
        return 'restart_missing_order';
      }
      await bot.sendMessage(phone, bot.t.waitingForPayment(order));
      return 'awaiting_payment_reminder';
    }

    case STATES.PAYMENT_VERIFYING: {
      const order =
        (await orderService.getById(convo.current_order_id)) || (await orderService.openFor(phone));
      if (!order) {
        await sendWelcome(bot, phone);
        return 'restart_missing_order';
      }
      await bot.sendMessage(phone, bot.t.verificationPending(order));
      return 'verification_pending';
    }

    default: {
      await sendWelcome(bot, phone);
      return 'welcome_fallback';
    }
  }
}

module.exports = { MODE, STATES, handleMessage, goToHuman };
