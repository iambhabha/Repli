'use strict';

/**
 * Builds a language pack out of the editable templates.
 *
 * Each function's only job is to turn Repli's objects into flat, already
 * formatted strings and hand them to the template. All wording lives in
 * src/bot/templates.js (and, once the owner edits it, in the database) - none
 * of it is written here.
 */

const config = require('../config');
const templates = require('./templates');

const NUM_EMOJI = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

const money = (amount) => `${config.CURRENCY}${Math.round(Number(amount || 0))}`;

const numberedList = (items) =>
  items.map((item, i) => `${NUM_EMOJI[i] || `${i + 1}.`} ${item}`).join('\n');

const pieces = (n) => (n === 1 ? '1 piece' : `${n} pieces`);

/** "Black T-Shirt - L" / "Black Bag" */
function describe(productName, color, size) {
  const parts = [];
  if (color) parts.push(color);
  parts.push(productName);
  if (size) parts.push(`- ${size}`);
  return parts.join(' ');
}

const itemOf = (order) =>
  order && order.order_items && order.order_items.length ? order.order_items[0] : {};

/** Optional "Size: M" line - empty for products that have no sizes. */
const sizeLine = (size) => (size ? `Size: ${size}` : '');

function createPack(language) {
  const t = (key, vars) => templates.render(key, language, vars);

  return {
    language,

    welcome: (products) => t('welcome', { products: numberedList(products.map((p) => p.name)) }),

    productNotUnderstood: (products) =>
      t('productNotUnderstood', { products: numberedList(products.map((p) => p.name)) }),

    chooseColor: (product, colors) =>
      t('chooseColor', { emoji: product.emoji || '', colors: numberedList(colors) }),

    colorNotUnderstood: (colors) => t('colorNotUnderstood', { colors: numberedList(colors) }),

    chooseSize: (sizes) => t('chooseSize', { sizes: sizes.join('\n') }),

    colorPickedNowSize: (product, color, sizes) =>
      t('colorPickedNowSize', {
        emoji: product.emoji || '',
        item: describe(product.name, color, ''),
        sizes: sizes.join(' / '),
      }),

    sizeNotUnderstood: (sizes) => t('sizeNotUnderstood', { sizes: sizes.join(' / ') }),

    available: (product, color, size, price) =>
      t('available', { item: describe(product.name, color, size), price: money(price) }),

    outOfStock: (product, color, size, sizesLeft) => {
      const item = describe(product.name, color, size);
      return sizesLeft.length
        ? t('outOfStock', { item, sizesLeft: sizesLeft.join(' / ') })
        : t('outOfStockNothingLeft', { item });
    },

    colorOutOfStock: (product, color, colorsLeft) => {
      const item = describe(product.name, color, '');
      return colorsLeft.length
        ? t('colorOutOfStock', { item, colorsLeft: colorsLeft.join(' / ') })
        : t('colorOutOfStockNothingLeft', { item });
    },

    quantityPrompt: () => t('quantityPrompt', {}),

    quantityNotUnderstood: () => t('quantityNotUnderstood', {}),

    quantityTooHigh: (max) => t('quantityTooHigh', { max: pieces(max), maxNumber: max }),

    onlyNAvailable: (count) =>
      t('onlyNAvailable', { count: pieces(count), countNumber: count }),

    askDetails: () => t('askDetails', {}),

    confirmSavedAddress: (saved) =>
      t('confirmSavedAddress', {
        name: saved.name,
        address: saved.address,
        city: saved.city,
        state: saved.state,
        pin: saved.pin,
      }),

    askField(field) {
      const key = {
        name: 'askName',
        address: 'askAddress',
        city: 'askCity',
        state: 'askState',
        pin: 'askPin',
      }[field];
      return key ? t(key, {}) : t('askDetails', {});
    },

    invalidField(field) {
      const key = {
        name: 'invalidName',
        address: 'invalidAddress',
        city: 'invalidCity',
        state: 'invalidState',
        pin: 'invalidPin',
      }[field];
      return t(key || 'invalidField', {});
    },

    orderSummary: (draft, product) =>
      t('orderSummary', {
        product: product.name,
        color: draft.color,
        sizeLine: sizeLine(draft.size),
        quantity: draft.quantity,
        unitPrice: money(draft.unitPrice),
        subtotal: money(draft.subtotal),
        shipping: money(draft.shipping),
        total: money(draft.total),
        name: draft.name,
        address: draft.address,
        city: draft.city,
        state: draft.state,
        pin: draft.pin,
      }),

    summaryNotUnderstood: () => t('summaryNotUnderstood', {}),

    yesOrNo: () => t('yesOrNo', {}),

    paymentInstructions: (order) =>
      t('paymentInstructions', {
        orderId: order.order_id,
        total: money(order.total),
        link: config.PAYMENT_LINK || '[PAYMENT LINK ABHI SET NAHI HUA]',
      }),

    waitingForPayment: (order) =>
      t('waitingForPayment', {
        orderId: order.order_id,
        total: money(order.total),
        link: config.PAYMENT_LINK || '[PAYMENT LINK ABHI SET NAHI HUA]',
      }),

    paymentProofReceived: () => t('paymentProofReceived', {}),

    verificationPending: (order) => t('verificationPending', { orderId: order.order_id }),

    orderConfirmed(order) {
      const item = itemOf(order);
      return t('orderConfirmed', {
        orderId: order.order_id,
        product: item.product_name_snapshot || '-',
        color: item.color_snapshot || '-',
        sizeLine: sizeLine(item.size_snapshot),
        quantity: item.quantity || 1,
        total: money(order.total),
      });
    },

    paymentRejected: () => t('paymentRejected', {}),

    orderCancelledByAdmin: (orderCode) => t('orderCancelledByAdmin', { orderId: orderCode }),

    handoff: () => t('handoff', {}),

    cancelled: () => t('cancelled', {}),

    help: () => t('help', {}),

    technicalError: () => t('technicalError', {}),

    needOrderFirst: () => t('needOrderFirst', {}),

    money,
    describe,
  };
}

module.exports = { createPack, money, describe, numberedList, pieces, itemOf };
