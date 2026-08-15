'use strict';

/**
 * Every customer/admin facing string.
 * Pure templates: product details are always passed in, never looked up here.
 */

const config = require('../config');

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

const messages = {
  welcome(products) {
    return `Hey bhai 👋
Welcome!

Kya chahiye?

${numberedList(products.map((p) => p.name))}

Bas option ya product ka naam bhej do.`;
  },

  productNotUnderstood(products) {
    return `Bhai samajh nahi aaya 😅

${numberedList(products.map((p) => p.name))}

Number bhej do ya product ka naam likh do.`;
  },

  chooseColor(product, colors) {
    return `Perfect bhai ${product.emoji || ''}🔥

Kaunsa color chahiye?

${numberedList(colors)}`;
  },

  colorNotUnderstood(colors) {
    return `Bhai color samajh nahi aaya 😅

${numberedList(colors)}`;
  },

  chooseSize(sizes) {
    return `Size bata do bhai:

${sizes.join('\n')}`;
  },

  /** "bhai reel wali black tshirt chahiye" - product + colour in one message. */
  colorPickedNowSize(product, color, sizes) {
    return `Bilkul bhai ${product.emoji || ''}🔥

${describe(product.name, color, '')} available hai.

Size bata do:
${sizes.join(' / ')}`;
  },

  sizeNotUnderstood(sizes) {
    return `Bhai size samajh nahi aaya 😅

Ye sizes hain:
${sizes.join(' / ')}`;
  },

  available(product, color, size, price) {
    return `Haan bhai ✅
${describe(product.name, color, size)} available hai.

Price: ${money(price)}

Kitni quantity chahiye?`;
  },

  outOfStock(product, color, size, sizesLeft) {
    const head = `Sorry bhai 😕
${describe(product.name, color, size)} abhi out of stock hai.`;
    if (!sizesLeft.length) {
      return `${head}

Is color me abhi kuch available nahi hai. Dusra color try karo ya "menu" bhej do.`;
    }
    return `${head}

Dusra size try kar sakte ho:
${sizesLeft.join(' / ')}`;
  },

  colorOutOfStock(product, color, colorsLeft) {
    const head = `Sorry bhai 😕
${describe(product.name, color, '')} abhi out of stock hai.`;
    if (!colorsLeft.length) {
      return `${head}

Abhi ye product available nahi hai. "menu" bhej ke dusra product dekh lo.`;
    }
    return `${head}

Ye color available hain:
${colorsLeft.join(' / ')}`;
  },

  quantityPrompt: () => 'Kitni quantity chahiye bhai?',

  quantityNotUnderstood: () => `Bhai number me bata do 🙏

Jaise: 1, 2, 3`,

  quantityTooHigh: (max) => `Bhai ek baar me max ${pieces(max)} hi le sakte ho.

Itne me se kitne chahiye?`,

  onlyNAvailable: (count) => `Bhai abhi sirf ${pieces(count)} available hain ❤️

${count} kar dein?`,

  askDetails: () => `Order complete karne ke liye details bhej do bhai:

Name:
Full Address:
City:
State:
PIN Code:`,

  /** Repeat customer: ask before reusing the saved address. */
  confirmSavedAddress: (saved) => `Bhai aapki purani details ye hain 👇

${saved.name}
${saved.address}
${saved.city}, ${saved.state} - ${saved.pin}

Isi address par bhej dein?

YES - same address
NO - nayi details bhejunga`,

  askField(field) {
    return (
      {
        name: 'Aapka pura naam bata do bhai:',
        address: 'Full address bhej do bhai (house/flat, street, landmark):',
        city: 'City ka naam bata do:',
        state: 'State ka naam bata do:',
        pin: 'PIN code bhej do (6 digit):',
      }[field] || 'Details bhej do bhai:'
    );
  },

  invalidField(field) {
    return (
      {
        name: 'Bhai naam thoda sahi se likh do (sirf naam) 🙏',
        address: 'Address thoda detail me bhej do bhai (house/flat, street, landmark) 🙏',
        city: 'City ka naam sahi se likh do bhai 🙏',
        state: 'State ka naam sahi se likh do bhai 🙏',
        pin: 'PIN code 6 digit ka hota hai bhai. Dobara bhej do 🙏',
      }[field] || 'Ye detail sahi nahi lagi bhai, dobara bhej do 🙏'
    );
  },

  orderSummary(draft, product) {
    const lines = ['🛍️ ORDER SUMMARY', '', `Product: ${product.name}`, `Color: ${draft.color}`];
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
      'Sab details correct hain?',
      '',
      'YES / NO'
    );
    return lines.join('\n');
  },

  summaryNotUnderstood: () => `Bhai YES ya NO bhej do 🙏

YES - order confirm
NO - details dobara bhejunga`,

  yesOrNo: () => 'Bhai YES ya NO bhej do 🙏',

  paymentInstructions(order) {
    const link = config.PAYMENT_LINK || '[PAYMENT LINK ABHI SET NAHI HUA]';
    return `Order #${order.order_id} ready hai bhai ❤️

Total Amount: ${money(order.total)}

Payment yahan karo:

${link}

Payment complete hone ke baad screenshot yahin WhatsApp par bhej dena.

⚠️ Payment screenshot zaroor bhejna.`;
  },

  waitingForPayment(order) {
    const link = config.PAYMENT_LINK || '[PAYMENT LINK ABHI SET NAHI HUA]';
    return `Bhai order #${order.order_id} abhi payment ka wait kar raha hai.

Total: ${money(order.total)}

Payment link:
${link}

Payment ke baad screenshot yahin bhej dena 🙏`;
  },

  paymentProofReceived: () => `Payment proof mil gaya bhai ❤️

Abhi hamari team payment verify karegi.

Thoda sa wait karo 🙏`,

  verificationPending: (order) => `Bhai aapka order #${order.order_id} verify ho raha hai ⏳

Team check kar rahi hai. Thoda sa wait karo ❤️`,

  orderConfirmed(order) {
    const item = itemOf(order);
    const lines = [
      'Payment received successfully bhai ❤️✅',
      '',
      `Aapka order #${order.order_id} confirm ho gaya! 🎉`,
      '',
      `Product: ${item.product_name_snapshot || '-'}`,
      `Color: ${item.color_snapshot || '-'}`,
    ];
    if (item.size_snapshot) lines.push(`Size: ${item.size_snapshot}`);
    lines.push(
      `Quantity: ${item.quantity || 1}`,
      '',
      `Total Paid: ${money(order.total)}`,
      '',
      'Abhi aapko hamara agent personally assist karega.',
      'Thoda sa wait karo bhai ❤️'
    );
    return lines.join('\n');
  },

  paymentRejected: () => `Bhai payment verify nahi ho paayi 😕
Hamari team abhi aapse personally baat karegi.

Thoda sa wait karo ❤️`,

  handoff: () => `Bilkul bhai ❤️

Abhi aapko hamari team ka agent personally assist karega.

Thoda sa wait karo 🙏`,

  cancelled: () => `Theek hai bhai 👍
Current order process cancel kar diya.

Dobara order karna ho toh "start" bhej dena.`,

  help: () => `Repli help 🙌

Order karne ke liye bas product ka naam likho.

Ye commands use kar sakte ho:
• start / menu - naya order shuru
• address - delivery details badalna
• cancel - current order cancel
• help - ye message
• human - team se baat karna`,

  technicalError: () => `Bhai ek small technical issue aa gaya 😅

Main aapko team se connect kar raha hoon.
Thoda sa wait karo ❤️`,

  needOrderFirst: () => `Bhai abhi koi pending order nahi hai 🙂

Order karne ke liye "start" bhej do.`,

  // ------------------------------------------------------------------ admin

  adminPaymentAlert(order) {
    const item = itemOf(order);
    const lines = [
      '🚨 PAYMENT VERIFICATION',
      '',
      `Order: #${order.order_id}`,
      '',
      `Customer: ${order.customer_name || '-'}`,
      `Phone: ${order.phone}`,
      '',
      `Product: ${item.product_name_snapshot || '-'}`,
      `Color: ${item.color_snapshot || '-'}`,
    ];
    if (item.size_snapshot) lines.push(`Size: ${item.size_snapshot}`);
    lines.push(
      `Quantity: ${item.quantity || 1}`,
      '',
      `Expected Amount: ${money(order.total)}`,
      '',
      `Address: ${[order.address, order.city, order.state, order.pin].filter(Boolean).join(', ')}`,
      '',
      'Payment Proof: 👆',
      '',
      'Use:',
      '',
      `/paid ${order.order_id}`,
      '',
      'or',
      '',
      `/reject ${order.order_id}`
    );
    return lines.join('\n');
  },

  adminHelp: () => `🛠️ REPLI ADMIN COMMANDS

BOT
/bot on | /bot off          automated replies on/off

HANDOFF
/human NUMBER               bot stop, human takes over
/resume NUMBER              bot dobara chalu

BYPASS (personal numbers)
/bypass add NUMBER NAME
/bypass remove NUMBER
/bypass list

ORDERS
/orders                     last 10 orders
/order ORDER_ID             order details + proof
/paid ORDER_ID              payment verified -> CONFIRMED
/reject ORDER_ID            payment rejected

CATALOGUE
/product                    products aur prices
/stock                      current stock

/help                       ye message

Example:
/paid ${config.ORDER_PREFIX}-1001`,

  adminOrderView(order) {
    const item = itemOf(order);
    const payments = (order.payments || [])
      .slice()
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const lines = [
      `📦 ORDER #${order.order_id}`,
      '',
      `Status: ${order.status}`,
      `Payment: ${payments.length ? payments[payments.length - 1].status : '-'}`,
      '',
      `Customer: ${order.customer_name || '-'}`,
      `Phone: ${order.phone}`,
      `Address: ${
        [order.address, order.city, order.state, order.pin].filter(Boolean).join(', ') || '-'
      }`,
      '',
      `Product: ${item.product_name_snapshot || '-'}`,
      `Color: ${item.color_snapshot || '-'}`,
      `Size: ${item.size_snapshot || '-'}`,
      `Qty: ${item.quantity || 1}`,
      '',
      `Subtotal: ${money(order.subtotal)}`,
      `Shipping: ${money(order.shipping)}`,
      `TOTAL: ${money(order.total)}`,
      '',
      `Created: ${order.created_at}`,
    ];
    if (payments.length) {
      lines.push('', 'Payment log:');
      for (const p of payments) {
        lines.push(`• ${p.created_at} ${p.status}${p.verified_by ? ` by ${p.verified_by}` : ''}`);
      }
    }
    return lines.join('\n');
  },

  adminOrderList(orders) {
    if (!orders.length) return 'Abhi tak koi order nahi hai.';
    const lines = ['📋 RECENT ORDERS', ''];
    for (const o of orders) {
      const item = itemOf(o);
      lines.push(
        `#${o.order_id}`,
        `${money(o.total)}`,
        `${o.status}`,
        `   ${item.product_name_snapshot || '-'}${item.color_snapshot ? ` ${item.color_snapshot}` : ''}${
          item.size_snapshot ? ` ${item.size_snapshot}` : ''
        } x${item.quantity || 1}`,
        `   ${o.customer_name || '-'} (${o.phone})`,
        ''
      );
    }
    return lines.join('\n').trim();
  },

  adminStock(groups) {
    if (!groups.length) return 'Koi product configure nahi hai.';
    const lines = ['📊 STOCK', ''];
    for (const group of groups) {
      lines.push(`${group.product}${group.active ? '' : ' (inactive)'}`);
      if (!group.rows.length) lines.push('  (koi variant nahi)');
      for (const row of group.rows) {
        const label = row.size ? `${row.color} ${row.size}` : `${row.color}`;
        lines.push(`  ${row.quantity > 0 ? '✅' : '❌'} ${label}: ${row.quantity}`);
      }
      lines.push('');
    }
    lines.push('Edit: Supabase → Table editor → product_variants');
    return lines.join('\n');
  },

  adminProducts(rows) {
    if (!rows.length) return 'Koi product configure nahi hai.';
    const lines = ['🧾 PRODUCTS', ''];
    for (const row of rows) {
      lines.push(
        `${row.active ? '✅' : '⛔'} ${row.name} (${row.code}) - ${money(row.price)}`,
        `   Colors: ${row.colors.join(', ') || '-'}`,
        `   Sizes: ${row.sizes.length ? row.sizes.join(', ') : '(no sizes)'}`,
        ''
      );
    }
    lines.push('Edit: Supabase → Table editor → products / product_variants');
    return lines.join('\n');
  },

  adminBypassList(rows) {
    const active = rows.filter((r) => r.active);
    if (!active.length) {
      return `🚫 BYPASS LIST khali hai.

Add karne ke liye:
/bypass add 919876543210 Brother`;
    }
    return `🚫 BYPASS NUMBERS (${active.length})

${active.map((r) => `• ${r.phone}${r.name ? ` - ${r.name}` : ''}`).join('\n')}

Repli in numbers ko kabhi reply nahi karta.`;
  },

  adminError: (context, error) => `⚠️ REPLI ERROR

Where: ${context}

${error}`,

  money,
  describe,
};

/**
 * Pick the pack for a customer's language.
 *
 * Both packs expose identical keys and signatures, so callers hold one or the
 * other and never branch on language themselves. Anything that is not 'en'
 * falls back to Hinglish - an unknown value must never blank out a message.
 */
messages.for = function packFor(language) {
  return language === 'en' ? require('./messages.en') : messages;
};

module.exports = messages;
