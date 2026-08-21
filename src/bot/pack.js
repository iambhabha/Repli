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

/**
 * Past this many colours, the printed card is a better interface than a list.
 *
 * The numbered list runs out of emoji at ten and runs out of screen well
 * before that. The bag has twenty-four, and the card carrying all of them is
 * already on the customer's screen - so above this threshold the shop asks
 * them to mark the card rather than reciting the names at them.
 */
const CHART_THRESHOLD = 8;

const money = (amount) => `${config.CURRENCY}${Math.round(Number(amount || 0))}`;

const numberedList = (items) =>
  items.map((item, i) => `${NUM_EMOJI[i] || `${i + 1}.`} ${item}`).join('\n');

const pieces = (n) => (n === 1 ? '1 piece' : `${n} pieces`);

/**
 * "🔴 Spider-Man — Red" — how the sales memory wants options shown.
 *
 * Designs are listed, not numbered products with prices. The customer picks a
 * design by name; the price is not part of this list on purpose, because the
 * agent must never lead with it.
 */
/**
 * "1️⃣ 👕 T-Shirts" - numbered, because a category is chosen by number as
 * often as by name, and the emoji and label both come from the database.
 */
const categoryList = (categories) =>
  categories
    .map((category, index) => {
      const number = NUM_EMOJI[index] || `${index + 1}.`;
      return `${number} ${category.emoji ? `${category.emoji} ` : ''}${category.label}`;
    })
    .join('\n');

const designList = (products) =>
  products
    .map((product) => {
      const name = product.design || product.name;
      const colour = product.colour || product.color;
      return `${product.emoji || '•'} ${name}${colour ? ` — ${colour}` : ''}`;
    })
    .join('\n');

/** "Black T-Shirt - L" / "Black Bag" */
function describe(productName, color, size) {
  const parts = [];
  // "Default" is the placeholder for a product with no colour of its own.
  // It belongs in the database, never in a sentence a customer reads.
  if (color && color !== 'Default') parts.push(color);
  parts.push(productName);
  if (size) parts.push(`- ${size}`);
  return parts.join(' ');
}

const itemOf = (order) =>
  order && order.order_items && order.order_items.length ? order.order_items[0] : {};

/** Optional "Size: M" line - empty for products that have no sizes. */
const sizeLine = (size) => (size ? `Size: ${size}` : '');

/** The typed payment destination, for when there is no scanner to send. */
const payToText = () =>
  config.PAYMENT_LINK
    ? `UPI: ${config.PAYMENT_LINK}`
    : '[PAYMENT LINK ABHI SET NAHI HUA]';

/**
 * An empty {{payTo}} leaves the blank lines that were around it behind.
 * Two blank lines in a row is not a paragraph break, it is a gap.
 */
const collapseBlankLines = (text) =>
  String(text).replace(/[\r\n]{3,}/g, '\n\n').trim();

function createPack(language) {
  const t = (key, vars) => templates.render(key, language, vars);

  return {
    language,

    greeting: (brands) => t('greeting', { brands }),

    chooseCategory: (categories) => t('chooseCategory', { categories: categoryList(categories) }),

    categoryNotUnderstood: (categories) =>
      t('categoryNotUnderstood', { categories: categoryList(categories) }),

    welcome: (products) => t('welcome', { products: designList(products) }),

    productNotUnderstood: (products) => t('productNotUnderstood', { products: designList(products) }),

    // ---- answers to questions, straight from the business memory --------
    //
    // Every one of these is a fixed string the owner can edit. Nothing here
    // is generated, because "never invent details" applies hardest to the
    // facts customers ask about: price, wait, material, COD, pickup.

    priceAnswer: (product) =>
      t('priceAnswer', {
        item: product.design || product.name,
        price: money(product.price),
        booking: money(product.booking_amount),
        remaining: money(Number(product.price || 0) - Number(product.booking_amount || 0)),
      }),

    /**
     * "book karni hai to karna kya hoga" - the three steps, in order.
     *
     * A live customer asked this after choosing a size and got nothing: the
     * shop had a stored answer for the price, the wait and the material, but
     * none for its own booking process, so the question fell through to free
     * prose. The steps are the ones in the sales memory - advance, scanner,
     * screenshot, balance on completion - and the figures come from the
     * product, so a hoodie quotes a hoodie's advance.
     */
    bookingProcessAnswer: (product) =>
      t('bookingProcessAnswer', {
        item: product.design || product.name,
        booking: money(product.booking_amount),
        remaining: money(Number(product.price || 0) - Number(product.booking_amount || 0)),
      }),

    refundAnswer: () => t('refundAnswer', {}),

    priceFixedAnswer: (product) =>
      t('priceFixedAnswer', {
        item: product.design || product.name,
        price: money(product.price),
        booking: money(product.booking_amount),
      }),

    whichPhoto: (products) =>
      t('whichPhoto', {
        products: products
          .map((p, i) => `${i + 1}. ${p.emoji || ''} ${p.design || p.name}`.trim())
          .join('\n'),
      }),

    photoHere: (product) => t('photoHere', { item: product.design || product.name }),
    noPhoto: (product) => t('noPhoto', { item: product.design || product.name }),

    materialAnswer: (text) => t('materialAnswer', { material: text }),
    waitingTimeAnswer: (text) => t('waitingTimeAnswer', { leadTime: text }),
    limitedPiecesAnswer: (text) => t('limitedPiecesAnswer', { lotNote: text }),
    hoodieBrandsAnswer: (text) => t('hoodieBrandsAnswer', { brands: text }),
    locationAnswer: (city, note) => t('locationAnswer', { city, shipping: note }),

    codAnswer: (product) =>
      t('codAnswer', {
        charge: money(product.cod_charge),
        total: money(Number(product.price || 0) + Number(product.cod_charge || 0)),
      }),

    /**
     * How many colours can be read as a list before it stops being one.
     *
     * Past this the names are a wall of text and the printed card is the
     * better interface - see chooseColorOnChart. Eight is roughly where a
     * numbered list stops fitting on a phone without scrolling.
     */
    chooseColor: (product, colors) =>
      colors.length > CHART_THRESHOLD
        ? t('chooseColorOnChart', { emoji: product.emoji || '' })
        : t('chooseColor', { emoji: product.emoji || '', colors: numberedList(colors) }),

    colorNotUnderstood: (colors) =>
      colors.length > CHART_THRESHOLD
        ? t('colorNotUnderstoodOnChart', {})
        : t('colorNotUnderstood', { colors: numberedList(colors) }),

    chooseSize: (sizes) => t('chooseSize', { sizes: sizes.join('\n') }),

    colorPickedNowSize: (product, color, sizes) =>
      t('colorPickedNowSize', {
        emoji: product.emoji || '',
        item: describe(product.name, color, ''),
        sizes: sizes.join(' / '),
      }),

    sizeNotUnderstood: (sizes) => t('sizeNotUnderstood', { sizes: sizes.join(' / ') }),

    /**
     * Design and size are locked in, so this is where price is finally
     * allowed to appear - together with the booking split, because "₹2,499"
     * on its own reads like money due today and it is not.
     */
    available: (product, color, size, price) => {
      const booking = Number(product.booking_amount || 0);
      return t('available', {
        item: describe(product.design || product.name, color, size),
        price: money(price),
        booking: money(booking),
        remaining: money(Number(price || 0) - booking),
      });
    },

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

    confirmName: (name) => t('confirmName', { name }),

    askDetailsKnownName: (name) => t('askDetailsKnownName', { name }),

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

    /**
     * Where to pay - the scanner, or words, never both.
     *
     * `scanner` says a QR image is going out with this message, and when one
     * is the typed UPI id is left out entirely. Sending both gave the
     * customer two payment destinations for one payment, and this shop's two
     * did not even match: the text named one account and the QR another.
     *
     * The words are the fallback, not the default. A shop with no QR set, or
     * a bucket that would not answer, must still tell somebody where to send
     * money - a booking message with no destination at all is worse than an
     * ugly one.
     */
    paymentInstructions: (order, { scanner = false } = {}) =>
      collapseBlankLines(
        t('paymentInstructions', {
          orderId: order.order_id,
          total: money(order.total),
          // What is due right now. Falls back to the full total for anything
          // sold outright, so the message is never silent about the amount.
          booking: money(order.booking_amount || order.total),
          remaining: money(order.remaining_amount || 0),
          payTo: scanner ? '' : payToText(),
        })
      ),

    waitingForPayment: (order, { scanner = false } = {}) =>
      collapseBlankLines(
        t('waitingForPayment', {
          orderId: order.order_id,
          total: money(order.total),
          payTo: scanner ? '' : payToText(),
        })
      ),

    confirmSwitch: (item) => t('confirmSwitch', { item }),

    paymentProofReceived: () => t('paymentProofReceived', {}),

    paymentProofRead: (amount) => t('paymentProofRead', { amount }),

    proofNotAPayment: () => t('proofNotAPayment', {}),

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

    paidBeforeDetails: () => t('paidBeforeDetails', {}),

    chartReceived: (product) =>
      t('chartReceived', {
        item: product.design || product.name,
        price: money(product.price),
        booking: money(product.booking_amount),
        remaining: money(Number(product.price || 0) - Number(product.booking_amount || 0)),
      }),

    needOrderFirst: () => t('needOrderFirst', {}),

    money,
    describe,
  };
}

module.exports = { createPack, money, describe, numberedList, pieces, itemOf, CHART_THRESHOLD };
