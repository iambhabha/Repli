'use strict';

/**
 * Every customer-facing sentence Repli can say, as an editable template.
 *
 * The owner edits these in the admin panel; the defaults below are only the
 * starting point. On startup any missing row is copied into
 * `message_templates`, and existing rows are never touched - a wording the
 * owner chose must survive a deploy.
 *
 * Templates use {{placeholders}}. Anything a message needs is passed in
 * already formatted (prices with the currency symbol, lists already
 * numbered), so the owner never has to write logic - only words.
 */

const { supabase } = require('../db/supabase');
const logger = require('../logger');

const LANGUAGES = ['hi', 'en'];
const TTL_MS = 15000;

/**
 * key, what it is for, which {{placeholders}} it may use, and the default
 * wording in both languages.
 */
const CATALOGUE = [
  // ------------------------------------------------------------- greeting
  {
    key: 'welcome',
    category: 'greeting',
    label: 'Welcome / menu',
    description: 'First reply when Repli cannot tell which product they mean.',
    placeholders: ['products'],
    hi: `Hey bhai 👋
Welcome!

Kya chahiye?

{{products}}

Bas option ya product ka naam bhej do.`,
    en: `Hey 👋
Welcome!

What are you looking for?

{{products}}

Just send the number or the product name.`,
  },
  {
    key: 'productNotUnderstood',
    category: 'greeting',
    label: 'Product not understood',
    description: 'They replied, but it did not match any product.',
    placeholders: ['products'],
    hi: `Bhai samajh nahi aaya 😅

{{products}}

Number bhej do ya product ka naam likh do.`,
    en: `Sorry, I didn't catch that 😅

{{products}}

Send the number or type the product name.`,
  },

  // -------------------------------------------------------------- product
  {
    key: 'chooseColor',
    category: 'product',
    label: 'Ask for colour',
    description: 'Product picked, more than one colour available.',
    placeholders: ['emoji', 'colors'],
    hi: `Perfect bhai {{emoji}}🔥

Kaunsa color chahiye?

{{colors}}`,
    en: `Great choice {{emoji}}🔥

Which colour would you like?

{{colors}}`,
  },
  {
    key: 'colorNotUnderstood',
    category: 'product',
    label: 'Colour not understood',
    description: 'Their reply did not match any available colour.',
    placeholders: ['colors'],
    hi: `Bhai color samajh nahi aaya 😅

{{colors}}`,
    en: `I didn't catch the colour 😅

{{colors}}`,
  },
  {
    key: 'chooseSize',
    category: 'product',
    label: 'Ask for size',
    description: 'Colour picked, now the size.',
    placeholders: ['sizes'],
    hi: `Size bata do bhai:

{{sizes}}`,
    en: `Which size?

{{sizes}}`,
  },
  {
    key: 'colorPickedNowSize',
    category: 'product',
    label: 'Colour understood, ask size',
    description: 'They named product and colour in one message ("black tshirt chahiye").',
    placeholders: ['emoji', 'item', 'sizes'],
    hi: `Bilkul bhai {{emoji}}🔥

{{item}} available hai.

Size bata do:
{{sizes}}`,
    en: `Perfect {{emoji}}🔥

{{item}} is available.

Which size?
{{sizes}}`,
  },
  {
    key: 'sizeNotUnderstood',
    category: 'product',
    label: 'Size not understood',
    description: 'Their reply did not match any available size.',
    placeholders: ['sizes'],
    hi: `Bhai size samajh nahi aaya 😅

Ye sizes hain:
{{sizes}}`,
    en: `I didn't catch the size 😅

Available sizes:
{{sizes}}`,
  },
  {
    key: 'available',
    category: 'product',
    label: 'In stock, ask quantity',
    description: 'Everything picked and in stock.',
    placeholders: ['item', 'price'],
    hi: `Haan bhai ✅
{{item}} available hai.

Price: {{price}}

Kitni quantity chahiye?`,
    en: `Yes ✅
{{item}} is available.

Price: {{price}}

How many would you like?`,
  },
  {
    key: 'outOfStock',
    category: 'product',
    label: 'Out of stock (other sizes left)',
    description: 'That size is gone, but the colour has other sizes.',
    placeholders: ['item', 'sizesLeft'],
    hi: `Sorry bhai 😕
{{item}} abhi out of stock hai.

Dusra size try kar sakte ho:
{{sizesLeft}}`,
    en: `Sorry 😕
{{item}} is out of stock right now.

These sizes are still available:
{{sizesLeft}}`,
  },
  {
    key: 'outOfStockNothingLeft',
    category: 'product',
    label: 'Out of stock (nothing left in colour)',
    description: 'That colour has nothing left at all.',
    placeholders: ['item'],
    hi: `Sorry bhai 😕
{{item}} abhi out of stock hai.

Is color me abhi kuch available nahi hai. Dusra color try karo ya "menu" bhej do.`,
    en: `Sorry 😕
{{item}} is out of stock right now.

Nothing is available in this colour at the moment. Try another colour, or send "menu".`,
  },
  {
    key: 'colorOutOfStock',
    category: 'product',
    label: 'Colour out of stock',
    description: 'The whole colour is gone, other colours remain.',
    placeholders: ['item', 'colorsLeft'],
    hi: `Sorry bhai 😕
{{item}} abhi out of stock hai.

Ye color available hain:
{{colorsLeft}}`,
    en: `Sorry 😕
{{item}} is out of stock right now.

These colours are available:
{{colorsLeft}}`,
  },
  {
    key: 'colorOutOfStockNothingLeft',
    category: 'product',
    label: 'Product fully out of stock',
    description: 'No colour of this product is available.',
    placeholders: ['item'],
    hi: `Sorry bhai 😕
{{item}} abhi out of stock hai.

Abhi ye product available nahi hai. "menu" bhej ke dusra product dekh lo.`,
    en: `Sorry 😕
{{item}} is out of stock right now.

This product is not available at the moment. Send "menu" to see the others.`,
  },

  // ------------------------------------------------------------- quantity
  {
    key: 'quantityPrompt',
    category: 'quantity',
    label: 'Ask quantity',
    description: 'Asking how many pieces.',
    placeholders: [],
    hi: 'Kitni quantity chahiye bhai?',
    en: 'How many would you like?',
  },
  {
    key: 'quantityNotUnderstood',
    category: 'quantity',
    label: 'Quantity not understood',
    description: 'Their reply was not a number.',
    placeholders: [],
    hi: `Bhai number me bata do 🙏

Jaise: 1, 2, 3`,
    en: `Please send a number 🙏

For example: 1, 2, 3`,
  },
  {
    key: 'quantityTooHigh',
    category: 'quantity',
    label: 'Above the per-order limit',
    description: 'They asked for more than MAX_QTY.',
    placeholders: ['max'],
    hi: `Bhai ek baar me max {{max}} hi le sakte ho.

Itne me se kitne chahiye?`,
    en: `You can order up to {{max}} at a time.

How many of those would you like?`,
  },
  {
    key: 'onlyNAvailable',
    category: 'quantity',
    label: 'Less stock than asked',
    description: 'They asked for more than is in stock.',
    placeholders: ['count', 'countNumber'],
    hi: `Bhai abhi sirf {{count}} available hain ❤️

{{countNumber}} kar dein?`,
    en: `Only {{count}} are available right now ❤️

Shall I make it {{countNumber}}?`,
  },

  // -------------------------------------------------------------- details
  {
    key: 'askDetails',
    category: 'details',
    label: 'Ask for delivery details',
    description: 'Asking for name and address in one go.',
    placeholders: [],
    hi: `Order complete karne ke liye details bhej do bhai:

Name:
Full Address:
City:
State:
PIN Code:`,
    en: `To complete your order, please send:

Name:
Full Address:
City:
State:
PIN Code:`,
  },
  {
    key: 'confirmSavedAddress',
    category: 'details',
    label: 'Reuse saved address?',
    description: 'A repeat customer - confirm the address already on file.',
    placeholders: ['name', 'address', 'city', 'state', 'pin'],
    hi: `Bhai aapki purani details ye hain 👇

{{name}}
{{address}}
{{city}}, {{state}} - {{pin}}

Isi address par bhej dein?

YES - same address
NO - nayi details bhejunga`,
    en: `Here are your saved details 👇

{{name}}
{{address}}
{{city}}, {{state}} - {{pin}}

Should I ship to this address?

YES - same address
NO - I'll send new details`,
  },
  {
    key: 'askName',
    category: 'details',
    label: 'Ask name',
    description: '',
    placeholders: [],
    hi: 'Aapka pura naam bata do bhai:',
    en: 'What is your full name?',
  },
  {
    key: 'askAddress',
    category: 'details',
    label: 'Ask address',
    description: '',
    placeholders: [],
    hi: 'Full address bhej do bhai (house/flat, street, landmark):',
    en: 'Please send your full address (house/flat, street, landmark):',
  },
  {
    key: 'askCity',
    category: 'details',
    label: 'Ask city',
    description: '',
    placeholders: [],
    hi: 'City ka naam bata do:',
    en: 'Which city?',
  },
  {
    key: 'askState',
    category: 'details',
    label: 'Ask state',
    description: '',
    placeholders: [],
    hi: 'State ka naam bata do:',
    en: 'Which state?',
  },
  {
    key: 'askPin',
    category: 'details',
    label: 'Ask PIN code',
    description: '',
    placeholders: [],
    hi: 'PIN code bhej do (6 digit):',
    en: 'Please send your PIN code (6 digits):',
  },
  {
    key: 'invalidName',
    category: 'details',
    label: 'Name looked wrong',
    description: '',
    placeholders: [],
    hi: 'Bhai naam thoda sahi se likh do (sirf naam) 🙏',
    en: 'Please send just your name 🙏',
  },
  {
    key: 'invalidAddress',
    category: 'details',
    label: 'Address looked wrong',
    description: '',
    placeholders: [],
    hi: 'Address thoda detail me bhej do bhai (house/flat, street, landmark) 🙏',
    en: 'Please send a more complete address (house/flat, street, landmark) 🙏',
  },
  {
    key: 'invalidCity',
    category: 'details',
    label: 'City looked wrong',
    description: '',
    placeholders: [],
    hi: 'City ka naam sahi se likh do bhai 🙏',
    en: 'Please send a valid city name 🙏',
  },
  {
    key: 'invalidState',
    category: 'details',
    label: 'State looked wrong',
    description: '',
    placeholders: [],
    hi: 'State ka naam sahi se likh do bhai 🙏',
    en: 'Please send a valid state name 🙏',
  },
  {
    key: 'invalidPin',
    category: 'details',
    label: 'PIN looked wrong',
    description: '',
    placeholders: [],
    hi: 'PIN code 6 digit ka hota hai bhai. Dobara bhej do 🙏',
    en: 'A PIN code has 6 digits. Please send it again 🙏',
  },
  {
    key: 'invalidField',
    category: 'details',
    label: 'Detail looked wrong (other)',
    description: 'Fallback when a detail does not fit any of the above.',
    placeholders: [],
    hi: 'Ye detail sahi nahi lagi bhai, dobara bhej do 🙏',
    en: "That detail didn't look right, please send it again 🙏",
  },

  // ---------------------------------------------------------------- order
  {
    key: 'orderSummary',
    category: 'order',
    label: 'Order summary',
    description: 'The confirm-before-ordering summary. {{sizeLine}} disappears for products without sizes.',
    placeholders: [
      'product', 'color', 'sizeLine', 'quantity', 'unitPrice',
      'subtotal', 'shipping', 'total', 'name', 'address', 'city', 'state', 'pin',
    ],
    hi: `🛍️ ORDER SUMMARY

Product: {{product}}
Color: {{color}}
{{sizeLine}}
Quantity: {{quantity}}

Price: {{unitPrice}} × {{quantity}}
Subtotal: {{subtotal}}

Shipping: {{shipping}}

TOTAL: {{total}}

Name: {{name}}
Address: {{address}}
City: {{city}}
State: {{state}}
PIN: {{pin}}

Sab details correct hain?

YES / NO`,
    en: `🛍️ ORDER SUMMARY

Product: {{product}}
Colour: {{color}}
{{sizeLine}}
Quantity: {{quantity}}

Price: {{unitPrice}} × {{quantity}}
Subtotal: {{subtotal}}

Shipping: {{shipping}}

TOTAL: {{total}}

Name: {{name}}
Address: {{address}}
City: {{city}}
State: {{state}}
PIN: {{pin}}

Is everything correct?

YES / NO`,
  },
  {
    key: 'summaryNotUnderstood',
    category: 'order',
    label: 'Summary reply not understood',
    description: 'They replied to the summary with something other than yes/no.',
    placeholders: [],
    hi: `Bhai YES ya NO bhej do 🙏

YES - order confirm
NO - details dobara bhejunga`,
    en: `Please reply YES or NO 🙏

YES - confirm the order
NO - I'll send the details again`,
  },
  {
    key: 'yesOrNo',
    category: 'order',
    label: 'Yes or no',
    description: 'Short nudge when a yes/no answer is expected.',
    placeholders: [],
    hi: 'Bhai YES ya NO bhej do 🙏',
    en: 'Please reply YES or NO 🙏',
  },
  {
    key: 'cancelled',
    category: 'order',
    label: 'Order cancelled',
    description: 'They sent "cancel".',
    placeholders: [],
    hi: `Theek hai bhai 👍
Current order process cancel kar diya.

Dobara order karna ho toh "start" bhej dena.`,
    en: `No problem 👍
The current order has been cancelled.

Send "start" whenever you want to order again.`,
  },
  {
    key: 'needOrderFirst',
    category: 'order',
    label: 'No pending order',
    description: 'They sent a payment screenshot with no open order.',
    placeholders: [],
    hi: `Bhai abhi koi pending order nahi hai 🙂

Order karne ke liye "start" bhej do.`,
    en: `You don't have a pending order right now 🙂

Send "start" to place one.`,
  },

  // -------------------------------------------------------------- payment
  {
    key: 'paymentInstructions',
    category: 'payment',
    label: 'Payment link',
    description: 'Sent the moment an order is created.',
    placeholders: ['orderId', 'total', 'link'],
    hi: `Order #{{orderId}} ready hai bhai ❤️

Total Amount: {{total}}

Payment yahan karo:

{{link}}

Payment complete hone ke baad screenshot yahin WhatsApp par bhej dena.

⚠️ Payment screenshot zaroor bhejna.`,
    en: `Order #{{orderId}} is ready ❤️

Total Amount: {{total}}

Pay here:

{{link}}

Once you have paid, send the screenshot here on WhatsApp.

⚠️ The payment screenshot is required.`,
  },
  {
    key: 'waitingForPayment',
    category: 'payment',
    label: 'Payment reminder',
    description: 'They wrote again while an order is still unpaid.',
    placeholders: ['orderId', 'total', 'link'],
    hi: `Bhai order #{{orderId}} abhi payment ka wait kar raha hai.

Total: {{total}}

Payment link:
{{link}}

Payment ke baad screenshot yahin bhej dena 🙏`,
    en: `Order #{{orderId}} is still waiting for payment.

Total: {{total}}

Payment link:
{{link}}

Please send the screenshot here once you have paid 🙏`,
  },
  {
    key: 'paymentProofReceived',
    category: 'payment',
    label: 'Screenshot received',
    description: 'Their payment proof arrived. Nothing is confirmed yet.',
    placeholders: [],
    hi: `Payment proof mil gaya bhai ❤️

Abhi hamari team payment verify karegi.

Thoda sa wait karo 🙏`,
    en: `Got your payment proof ❤️

Our team will verify it now.

Please give us a moment 🙏`,
  },
  {
    key: 'verificationPending',
    category: 'payment',
    label: 'Still verifying',
    description: 'They asked again while you were verifying.',
    placeholders: ['orderId'],
    hi: `Bhai aapka order #{{orderId}} verify ho raha hai ⏳

Team check kar rahi hai. Thoda sa wait karo ❤️`,
    en: `Your order #{{orderId}} is being verified ⏳

The team is checking it. Please hold on ❤️`,
  },
  {
    key: 'orderConfirmed',
    category: 'payment',
    label: 'Payment verified',
    description: 'Sent when you verify the payment - from WhatsApp or the panel.',
    placeholders: ['orderId', 'product', 'color', 'sizeLine', 'quantity', 'total'],
    hi: `Payment received successfully bhai ❤️✅

Aapka order #{{orderId}} confirm ho gaya! 🎉

Product: {{product}}
Color: {{color}}
{{sizeLine}}
Quantity: {{quantity}}

Total Paid: {{total}}

Abhi aapko hamara agent personally assist karega.
Thoda sa wait karo bhai ❤️`,
    en: `Payment received successfully ❤️✅

Your order #{{orderId}} is confirmed! 🎉

Product: {{product}}
Colour: {{color}}
{{sizeLine}}
Quantity: {{quantity}}

Total Paid: {{total}}

Our agent will assist you personally from here.
Please hold on ❤️`,
  },
  {
    key: 'paymentRejected',
    category: 'payment',
    label: 'Payment rejected',
    description: 'Sent when you reject a payment.',
    placeholders: [],
    hi: `Bhai payment verify nahi ho paayi 😕
Hamari team abhi aapse personally baat karegi.

Thoda sa wait karo ❤️`,
    en: `We could not verify your payment 😕
Our team will get in touch with you personally.

Please hold on ❤️`,
  },
  {
    key: 'orderCancelledByAdmin',
    category: 'payment',
    label: 'Order cancelled by you',
    description: 'Sent when you cancel an order from the panel.',
    placeholders: ['orderId'],
    hi: `Bhai aapka order #{{orderId}} cancel kar diya gaya hai.

Koi dikkat ho toh yahin message karo, hamari team help karegi ❤️`,
    en: `Your order #{{orderId}} has been cancelled.

If something is wrong, just message us here and our team will help ❤️`,
  },

  // -------------------------------------------------------------- closing
  {
    key: 'handoff',
    category: 'closing',
    label: 'Handing over to a human',
    description: 'They asked for a person, or you took over.',
    placeholders: [],
    hi: `Bilkul bhai ❤️

Abhi aapko hamari team ka agent personally assist karega.

Thoda sa wait karo 🙏`,
    en: `Of course ❤️

Someone from our team will assist you personally.

Please hold on 🙏`,
  },
  {
    key: 'help',
    category: 'closing',
    label: 'Help',
    description: 'They sent "help".',
    placeholders: [],
    hi: `Repli help 🙌

Order karne ke liye bas product ka naam likho.

Ye commands use kar sakte ho:
• start / menu - naya order shuru
• address - delivery details badalna
• cancel - current order cancel
• help - ye message
• human - team se baat karna`,
    en: `Repli help 🙌

To order, just type the product name.

You can also use:
• start / menu - start a new order
• address - change delivery details
• cancel - cancel the current order
• help - this message
• human - talk to the team`,
  },
  {
    key: 'technicalError',
    category: 'closing',
    label: 'Something broke',
    description: 'Shown when Repli hits an error. The customer is handed to a human.',
    placeholders: [],
    hi: `Bhai ek small technical issue aa gaya 😅

Main aapko team se connect kar raha hoon.
Thoda sa wait karo ❤️`,
    en: `Sorry, we hit a small technical issue 😅

I'm connecting you to our team.
Please hold on ❤️`,
  },
];

const BY_KEY = new Map(CATALOGUE.map((entry) => [entry.key, entry]));

// ------------------------------------------------------------------ cache
let overrides = new Map(); // `${key}:${lang}` -> body
let loadedAt = 0;

function cacheKey(key, language) {
  return `${key}:${language}`;
}

/** Reload the owner's edits. Cheap: one small table, cached for TTL_MS. */
async function refresh(force = false) {
  if (!force && Date.now() - loadedAt < TTL_MS) return overrides;

  const { data, error } = await supabase.from('message_templates').select('key,language,body');
  if (error) {
    // Keep serving whatever we had; defaults still work if we never loaded.
    logger.error('templates.load_failed', { error: error.message });
    return overrides;
  }

  overrides = new Map((data || []).map((row) => [cacheKey(row.key, row.language), row.body]));
  loadedAt = Date.now();
  return overrides;
}

function startTemplateSync(intervalMs = TTL_MS) {
  const timer = setInterval(() => {
    refresh(true).catch((err) => logger.error('templates.sync_failed', { error: err.message }));
  }, intervalMs);
  if (timer.unref) timer.unref();
  return () => clearInterval(timer);
}

/**
 * Startup: make sure every template exists in the table so the panel can list
 * them. Insert-only - an existing row belongs to the owner.
 */
async function ensureTemplates() {
  const { data, error } = await supabase.from('message_templates').select('key,language');
  if (error) {
    logger.error('templates.ensure_failed', { error: error.message });
    return 0;
  }

  const existing = new Set((data || []).map((row) => cacheKey(row.key, row.language)));
  const missing = [];

  CATALOGUE.forEach((entry, index) => {
    for (const language of LANGUAGES) {
      if (existing.has(cacheKey(entry.key, language))) continue;
      missing.push({
        key: entry.key,
        language,
        body: entry[language],
        default_body: entry[language],
        label: entry.label,
        description: entry.description || null,
        placeholders: entry.placeholders,
        category: entry.category,
        sort_order: index,
      });
    }
  });

  if (missing.length) {
    const { error: insertError } = await supabase.from('message_templates').insert(missing);
    if (insertError) {
      logger.error('templates.seed_failed', { error: insertError.message });
      return 0;
    }
    logger.info('templates.seeded', { action: `${missing.length} rows` });
  }

  await refresh(true);
  return missing.length;
}

/**
 * Fill {{placeholders}}.
 *
 * Unknown placeholders are left visible on purpose: a typo showing up as
 * `{{totl}}` in a test message is far easier to spot and fix than a silently
 * empty line in a real customer's chat.
 */
function fill(template, vars) {
  return String(template).replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name] ?? '') : match
  );
}

/** Optional lines like {{sizeLine}} leave a blank line behind when empty. */
function tidy(text) {
  return text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

/** The owner's text if they edited it, otherwise the default from above. */
function render(key, language, vars = {}) {
  const entry = BY_KEY.get(key);
  const lang = LANGUAGES.includes(language) ? language : 'hi';
  const template = overrides.get(cacheKey(key, lang)) || (entry && entry[lang]) || '';

  if (!template) {
    logger.error('templates.missing', { action: `${key}:${lang}` });
    return '';
  }

  return tidy(fill(template, vars));
}

module.exports = {
  CATALOGUE,
  LANGUAGES,
  render,
  refresh,
  ensureTemplates,
  startTemplateSync,
};
