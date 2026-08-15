'use strict';

/**
 * English message pack.
 *
 * Same keys and same signatures as messages.js, so the two are
 * interchangeable - the state machine never knows which one it is holding.
 * Only customer-facing strings live here; admin messages stay in one language
 * because there is exactly one admin and he picked it.
 *
 * The tone is deliberately plainer than the Hinglish pack: "bhai" has no
 * English equivalent that is not either cold or fake-chummy.
 */

const config = require('../config');

const NUM_EMOJI = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

const money = (amount) => `${config.CURRENCY}${Math.round(Number(amount || 0))}`;

const numberedList = (items) =>
  items.map((item, i) => `${NUM_EMOJI[i] || `${i + 1}.`} ${item}`).join('\n');

const pieces = (n) => (n === 1 ? '1 piece' : `${n} pieces`);

function describe(productName, color, size) {
  const parts = [];
  if (color) parts.push(color);
  parts.push(productName);
  if (size) parts.push(`- ${size}`);
  return parts.join(' ');
}

const itemOf = (order) =>
  order && order.order_items && order.order_items.length ? order.order_items[0] : {};

const messages = {
  welcome(products) {
    return `Hey 👋
Welcome!

What are you looking for?

${numberedList(products.map((p) => p.name))}

Just send the number or the product name.`;
  },

  productNotUnderstood(products) {
    return `Sorry, I didn't catch that 😅

${numberedList(products.map((p) => p.name))}

Send the number or type the product name.`;
  },

  chooseColor(product, colors) {
    return `Great choice ${product.emoji || ''}🔥

Which colour would you like?

${numberedList(colors)}`;
  },

  colorNotUnderstood(colors) {
    return `I didn't catch the colour 😅

${numberedList(colors)}`;
  },

  chooseSize(sizes) {
    return `Which size?

${sizes.join('\n')}`;
  },

  colorPickedNowSize(product, color, sizes) {
    return `Perfect ${product.emoji || ''}🔥

${describe(product.name, color, '')} is available.

Which size?
${sizes.join(' / ')}`;
  },

  sizeNotUnderstood(sizes) {
    return `I didn't catch the size 😅

Available sizes:
${sizes.join(' / ')}`;
  },

  available(product, color, size, price) {
    return `Yes ✅
${describe(product.name, color, size)} is available.

Price: ${money(price)}

How many would you like?`;
  },

  outOfStock(product, color, size, sizesLeft) {
    const head = `Sorry 😕
${describe(product.name, color, size)} is out of stock right now.`;
    if (!sizesLeft.length) {
      return `${head}

Nothing is available in this colour at the moment. Try another colour, or send "menu".`;
    }
    return `${head}

These sizes are still available:
${sizesLeft.join(' / ')}`;
  },

  colorOutOfStock(product, color, colorsLeft) {
    const head = `Sorry 😕
${describe(product.name, color, '')} is out of stock right now.`;
    if (!colorsLeft.length) {
      return `${head}

This product is not available at the moment. Send "menu" to see the others.`;
    }
    return `${head}

These colours are available:
${colorsLeft.join(' / ')}`;
  },

  quantityPrompt: () => 'How many would you like?',

  quantityNotUnderstood: () => `Please send a number 🙏

For example: 1, 2, 3`,

  quantityTooHigh: (max) => `You can order up to ${pieces(max)} at a time.

How many of those would you like?`,

  onlyNAvailable: (count) => `Only ${pieces(count)} are available right now ❤️

Shall I make it ${count}?`,

  askDetails: () => `To complete your order, please send:

Name:
Full Address:
City:
State:
PIN Code:`,

  confirmSavedAddress: (saved) => `Here are your saved details 👇

${saved.name}
${saved.address}
${saved.city}, ${saved.state} - ${saved.pin}

Should I ship to this address?

YES - same address
NO - I'll send new details`,

  askField(field) {
    return (
      {
        name: 'What is your full name?',
        address: 'Please send your full address (house/flat, street, landmark):',
        city: 'Which city?',
        state: 'Which state?',
        pin: 'Please send your PIN code (6 digits):',
      }[field] || 'Please send your details:'
    );
  },

  invalidField(field) {
    return (
      {
        name: 'Please send just your name 🙏',
        address: 'Please send a more complete address (house/flat, street, landmark) 🙏',
        city: 'Please send a valid city name 🙏',
        state: 'Please send a valid state name 🙏',
        pin: 'A PIN code has 6 digits. Please send it again 🙏',
      }[field] || "That detail didn't look right, please send it again 🙏"
    );
  },

  orderSummary(draft, product) {
    const lines = ['🛍️ ORDER SUMMARY', '', `Product: ${product.name}`, `Colour: ${draft.color}`];
    if (draft.size) lines.push(`Size: ${draft.size}`);
    lines.push(
      `Quantity: ${draft.quantity}`,
      '',
      `Price: ${money(draft.unitPrice)} × ${draft.quantity}`,
      `Subtotal: ${money(draft.subtotal)}`,
      '',
      `Shipping: ${money(draft.shipping)}`,
      '',
      `TOTAL: ${money(draft.total)}`,
      '',
      `Name: ${draft.name}`,
      `Address: ${draft.address}`,
      `City: ${draft.city}`,
      `State: ${draft.state}`,
      `PIN: ${draft.pin}`,
      '',
      'Is everything correct?',
      '',
      'YES / NO'
    );
    return lines.join('\n');
  },

  summaryNotUnderstood: () => `Please reply YES or NO 🙏

YES - confirm the order
NO - I'll send the details again`,

  yesOrNo: () => 'Please reply YES or NO 🙏',

  paymentInstructions(order) {
    const link = config.PAYMENT_LINK || '[PAYMENT LINK NOT SET YET]';
    return `Order #${order.order_id} is ready ❤️

Total Amount: ${money(order.total)}

Pay here:

${link}

Once you have paid, send the screenshot here on WhatsApp.

⚠️ The payment screenshot is required.`;
  },

  waitingForPayment(order) {
    const link = config.PAYMENT_LINK || '[PAYMENT LINK NOT SET YET]';
    return `Order #${order.order_id} is still waiting for payment.

Total: ${money(order.total)}

Payment link:
${link}

Please send the screenshot here once you have paid 🙏`;
  },

  paymentProofReceived: () => `Got your payment proof ❤️

Our team will verify it now.

Please give us a moment 🙏`,

  verificationPending: (order) => `Your order #${order.order_id} is being verified ⏳

The team is checking it. Please hold on ❤️`,

  orderConfirmed(order) {
    const item = itemOf(order);
    const lines = [
      'Payment received successfully ❤️✅',
      '',
      `Your order #${order.order_id} is confirmed! 🎉`,
      '',
      `Product: ${item.product_name_snapshot || '-'}`,
      `Colour: ${item.color_snapshot || '-'}`,
    ];
    if (item.size_snapshot) lines.push(`Size: ${item.size_snapshot}`);
    lines.push(
      `Quantity: ${item.quantity || 1}`,
      '',
      `Total Paid: ${money(order.total)}`,
      '',
      'Our agent will assist you personally from here.',
      'Please hold on ❤️'
    );
    return lines.join('\n');
  },

  paymentRejected: () => `We could not verify your payment 😕
Our team will get in touch with you personally.

Please hold on ❤️`,

  handoff: () => `Of course ❤️

Someone from our team will assist you personally.

Please hold on 🙏`,

  cancelled: () => `No problem 👍
The current order has been cancelled.

Send "start" whenever you want to order again.`,

  help: () => `Repli help 🙌

To order, just type the product name.

You can also use:
• start / menu - start a new order
• address - change delivery details
• cancel - cancel the current order
• help - this message
• human - talk to the team`,

  technicalError: () => `Sorry, we hit a small technical issue 😅

I'm connecting you to our team.
Please hold on ❤️`,

  needOrderFirst: () => `You don't have a pending order right now 🙂

Send "start" to place one.`,

  money,
  describe,
};

module.exports = messages;
