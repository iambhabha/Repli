'use strict';

/**
 * Rule engine: plain keyword/pattern matching. No AI, no model, no network.
 * Understands English, Hinglish and basic Devanagari Hindi.
 *
 * Everything here is synchronous and pure - the catalogue is passed in.
 */

/** Lowercase, strip punctuation/emoji, collapse whitespace. */
function normalize(text) {
  return String(text == null ? '' : text)
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/[^\p{L}\p{N}\s/+]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const tokens = (text) => normalize(text).split(' ').filter(Boolean);
const hasWord = (text, word) => tokens(text).includes(word);
const hasAnyWord = (text, words) => {
  const list = tokens(text);
  return words.some((w) => list.includes(w));
};
const hasPhrase = (text, phrase) => normalize(text).includes(normalize(phrase));

const YES_WORDS = [
  'yes', 'y', 'yeah', 'yep', 'yup', 'ok', 'okay', 'okey', 'k',
  'haan', 'han', 'haa', 'ha', 'hn', 'hanji', 'ji', 'jee', 'bilkul',
  'theek', 'thik', 'thk', 'sahi', 'sure', 'confirm', 'confirmed', 'done',
  'kardo', 'krdo', 'chalega', 'accha', 'acha', 'correct', 'हां', 'हाँ', 'ठीक', 'सही',
];

const NO_WORDS = [
  'no', 'n', 'nope', 'nah', 'nahi', 'nahin', 'nai', 'na', 'nhi',
  'galat', 'wrong', 'नहीं', 'नही', 'ना',
];

const NUMBER_WORDS = {
  ek: 1, one: 1, ik: 1, 'एक': 1,
  do: 2, two: 2, 'दो': 2,
  teen: 3, three: 3, 'तीन': 3,
  char: 4, chaar: 4, four: 4, 'चार': 4,
  panch: 5, paanch: 5, five: 5, 'पांच': 5, 'पाँच': 5,
  che: 6, chhe: 6, six: 6, 'छह': 6,
  saat: 7, seven: 7, 'सात': 7,
  aath: 8, eight: 8, 'आठ': 8,
  nau: 9, nine: 9, 'नौ': 9,
  das: 10, dus: 10, ten: 10, 'दस': 10,
};

/**
 * Extra spellings, keyed on the product `code` column.
 *
 * Note what is deliberately absent: plain "tshirt" and "hoodie". A design is
 * the choice, and "I need a T-shirt" names a category, not a design - it has
 * to fall through so the bot shows both designs and lets the customer pick,
 * which is exactly what the sales memory asks for. The colour words are here
 * because for these products the colour IS the design: one is the red one,
 * the other is the black one.
 */
const PRODUCT_KEYWORDS = {
  'AES-TS-SPIDER': [
    'spiderman', 'spider man', 'spider', 'spidey', 'red tshirt', 'red t shirt',
    'lal tshirt', 'स्पाइडरमैन',
  ],
  'AES-TS-VENOM': [
    'venom', 'vennom', 'black tshirt', 'black t shirt', 'kala tshirt', 'वेनम',
  ],
  'AES-HD-BAPE-S': ['bape single', 'single hood', 'single hoodie', 'bape single hood'],
  'AES-HD-BAPE-D': ['bape double', 'double hood', 'double hoodie', 'bape double hood'],

  // Retired demo catalogue, kept so old conversations still resolve.
  TS001: ['tshirt', 'tshirts', 't shirt', 'tee', 'tees', 'टीशर्ट'],
  BAG001: ['bag', 'bags', 'baig', 'jhola', 'बैग'],
};

/**
 * Category words. "T-shirt chahiye" must show the T-shirt designs and
 * nothing else - not the hoodies, and not a guess at which design.
 */
const CATEGORY_KEYWORDS = {
  tshirt: ['tshirt', 'tshirts', 't shirt', 't shirts', 'shirt', 'shirts', 'tee', 'tees', 'टीशर्ट', 'टी शर्ट'],
  hoodie: ['hoodie', 'hoodies', 'hood', 'hoody', 'sweatshirt', 'हुडी'],
  bag: ['bag', 'bags', 'baig', 'jhola', 'backpack', 'बैग'],
};

/** Returns 'tshirt' | 'hoodie' | 'bag' | null. */
function detectCategory(text) {
  const t = normalize(text);
  if (!t) return null;
  for (const [category, words] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const word of words) {
      if (word.includes(' ') ? hasPhrase(t, word) : hasWord(t, word)) return category;
    }
  }
  return null;
}

const COLOR_KEYWORDS = {
  Black: ['black', 'blk', 'kala', 'kaala', 'kali', 'kaali', 'काला', 'काली'],
  White: ['white', 'wht', 'safed', 'safeed', 'सफेद', 'सफ़ेद'],
  Blue: ['blue', 'neela', 'nila', 'नीला'],
  Red: ['red', 'lal', 'laal', 'लाल'],
  Green: ['green', 'hara', 'हरा'],
};

const SIZE_KEYWORDS = {
  S: ['s', 'small', 'chota', 'chhota'],
  M: ['m', 'medium'],
  L: ['l', 'large', 'bada'],
  XL: ['xl', 'extra large', 'extralarge', 'x large'],
  XXL: ['xxl', '2xl', 'double xl', 'xx large'],
};

const HUMAN_PATTERNS = [
  /\bhuman\b/, /\bagent\b/, /\bowner\b/, /\bmanager\b/, /\bsupport\b/,
  /\bcustomer care\b/, /\bcall me\b/, /\bcall back\b/, /\bcall karo\b/,
  /\bcall kar\b/, /\bphone karo\b/, /\breal person\b/, /\bperson se\b/,
  /\bbanda\b/, /\binsaan\b/, /\bkisi se baat\b/, /\bbaat karni hai\b/,
  /\bbaat karna hai\b/, /\bbaat karo\b/, /\bbaat kara\b/, /\btalk to\b/,
  /\bbot nahi\b/, /बात कर/, /\bइंसान\b/,
];

const CUSTOMER_COMMANDS = {
  menu: ['menu', 'start', 'restart', 'shuru', 'मेनू', 'शुरू'],
  help: ['help', 'madad', 'sahayata', 'मदद'],
  cancel: ['cancel', 'cancle', 'kancel', 'रद्द'],
  address: ['address', 'pata'],
};

/**
 * Questions the shop answers from fixed facts.
 *
 * These are checked before the sales flow so that "kitne ka hai?" in the
 * middle of choosing a size is answered rather than read as a size. Order
 * matters: the first match wins, so the specific patterns sit above the
 * general ones.
 */
const FAQ_PATTERNS = [
  /**
   * Bargaining. Sits first so it beats the price pattern - "kam se kam
   * kitne ka doge" is a negotiation, not a price question, and answering it
   * with the price alone reads as an invitation to keep pushing.
   */
  [
    'refund',
    [
      /\brefund/, /\breffund/, /\brefnd/, /paisa wapas/, /paise wapas/,
      /\breturn/, /\bexchange/, /\breplace/, /order cancel karna/,
      /wapas kar/, /wapis kar/, /money back/, /cancel karke paisa/,
    ],
  ],
  [
    'bargain',
    [
      /\bdiscount\b/, /\boffer\b/, /\bsale\b/, /\bchhut\b/, /\bchoot\b/,
      /kam (kar|karo|kardo|kr|hoga|hogi|me|mein|karke)/, /kuch kam/, /thoda kam/,
      /\bsasta/, /\bsaste/, /last price/, /best price/, /final price/,
      /lowest price/, /kam se kam/, /\bbargain/, /price kam/, /rate kam/,
      /\bnegotiab/, /kam nahi hoga/, /\bcheap/, /kam me de/, /me de do/,
      /\bkam karo\b/, /\bkam kar do\b/,
    ],
  ],
  /**
   * "photo bhej do", "red wali kaisi lagegi" - a request to SEE the thing.
   *
   * Deliberately specific. "kaise ho bhai" is a greeting, not a photo
   * request, so only phrasings that are unambiguously about appearance are
   * listed here; anything vaguer is left to the model, which has the whole
   * sentence to judge by.
   */
  [
    'image',
    [
      /\bphotos?\b/, /\bpics?\b/, /\bpictures?\b/, /\bimages?\b/, /\bsnaps?\b/,
      /\btasveer/, /\bfoto/,
      /dikha ?(do|o|dijiye|de)\b/, /dikhao/, /dekhna hai/, /dekh sakta/,
      /kaisi lag(egi|ti|ta)/, /kaisa lag(ega|ta)/, /kaisi dikh/, /kaisa dikh/,
      /show me/, /can i see/, /let me see/, /send.{0,12}(photo|pic|image)/,
    ],
  ],
  ['cod', [/\bcod\b/, /cash on delivery/, /delivery pe (paisa|payment)/, /ghar pe pay/]],
  [
    'waiting',
    [
      /\b(delivery|shipping) (time|days)\b/, /kitne din/, /kitna time/, /how (long|many days)/,
      /\bwaiting\b/, /kab (tak )?(milega|aayega|ayega)/, /when will i get/, /\bdispatch\b/,
    ],
  ],
  [
    'material',
    [
      /\bmaterial\b/, /\bfabric\b/, /\bcotton\b/, /\bquality\b/, /kapda/, /kaisa hai/,
      /\bprint\b/, /kaisi quality/,
    ],
  ],
  [
    // No bare "deliver" or "shipping", and no city names: "haan bhai deliver
    // kar do" is a customer confirming an order, and it was being answered
    // with the shop's address while the YES never reached the order step.
    'location',
    [
      /\bpickup\b/, /\bpick up\b/, /\bshop (kahan|kaha|address)/, /\bstore kahan/,
      /\b(aap|tum|shop|store) kahan (ho|hai|se)/, /\bwhere are you\b/,
      /\byour location\b/, /\blocation kya\b/, /\bkahan se ho\b/,
      /\bdeliver karte ho\b/, /\bdelivery kahan\b/, /\bship (karte|karoge)\b/,
    ],
  ],
  ['stock', [/\bstock\b/, /\blimited\b/, /\bavailable hai\b/, /\blot\b/, /\bsold out\b/, /bach(a|e) hai/]],
  // Only question forms. "bape single hood M" is a customer choosing a
  // product and a size, not asking which brands the shop carries - and
  // answering it with a brand list buried the size they had just given.
  [
    'brands',
    [
      /kaunsi brand/, /konsi brand/, /which brand/, /brand kaunsi/,
      /\bbrands? (hai|hain|available|kya|do you|are)\b/, /kaun kaun si brand/,
    ],
  ],
  [
    'price',
    [
      /\bprice\b/, /\brate\b/, /\bcost\b/, /kitne? ka/, /kitne? ki/, /kitna hai/, /how much/,
      /\bkeemat\b/, /\bdaam\b/, /\bmrp\b/, /\bkitne rupay/,
    ],
  ],
];

/**
 * Returns 'price' | 'material' | 'waiting' | 'cod' | 'location' | 'stock' |
 * 'brands' | null.
 */
function detectQuestion(text) {
  const t = normalize(text);
  if (!t) return null;
  for (const [topic, patterns] of FAQ_PATTERNS) {
    if (patterns.some((re) => re.test(t))) return topic;
  }
  return null;
}

/**
 * A greeting and nothing else.
 *
 * Needed because "Hy" arrived while the bot was collecting an address and was
 * saved as the customer's name - it passes every name rule there is. People
 * say hello again mid-conversation; that is not an answer to the question.
 */
const GREETING_WORDS = [
  'hi', 'hii', 'hiii', 'hy', 'hey', 'heyy', 'hello', 'helo', 'hlo', 'hallo',
  'yo', 'namaste', 'namaskar', 'salam', 'salaam', 'gm', 'gn',
  'हाय', 'हैलो', 'नमस्ते',
];

function isGreeting(text) {
  const list = tokens(text);
  if (!list.length || list.length > 3) return false;
  // Every word has to be a greeting: "hi bhai" is still just a hello,
  // "hi my name is Rahul" is an answer.
  return list.every((word) => GREETING_WORDS.includes(word) || word === 'bhai' || word === 'sir');
}

/**
 * Words that mean "no" on their own but are only a tag inside a sentence.
 *
 * Hinglish hangs "na" on the end of agreements constantly - "haan bhej do
 * na", "ok na", "confirm kar do na" - and reading that as a refusal turned
 * every one of those into a cancelled order with the draft wiped.
 */
const TAG_WORDS = new Set(['na', 'naa', 'n']);

const isNo = (text) => {
  const list = tokens(text);
  if (!list.length) return false;

  // An unambiguous no anywhere in the message settles it.
  if (list.some((word) => NO_WORDS.includes(word) && !TAG_WORDS.has(word))) return true;

  // "na" by itself is a refusal; "…kar do na" is agreement with a tag.
  return list.length === 1 && TAG_WORDS.has(list[0]);
};

const isYes = (text) => !isNo(text) && hasAnyWord(text, YES_WORDS);

/** Quantity from free text: "2", "2 chahiye", "do piece". */
function parseQuantity(text) {
  for (const token of tokens(text)) {
    if (/^\d{1,3}$/.test(token)) {
      const n = parseInt(token, 10);
      if (n > 0) return n;
    }
  }
  for (const token of tokens(text)) {
    if (NUMBER_WORDS[token]) return NUMBER_WORDS[token];
  }
  return null;
}

/** Menu index: "1", "2", "1️⃣" (the emoji is stripped by normalize). */
function parseMenuIndex(text, max) {
  const match = /^(\d{1,2})$/.exec(normalize(text));
  if (!match) return null;
  const index = parseInt(match[1], 10);
  return index >= 1 && index <= max ? index : null;
}

/**
 * Every word this product answers to.
 *
 * `products.keywords` comes first: that column is edited in the admin panel,
 * so a product added there is understood without touching this file. The
 * table below is only a fallback for the original demo rows.
 */
const keywordsForProduct = (product) => {
  const fromDatabase = Array.isArray(product.keywords) ? product.keywords.map(normalize) : [];
  return [
    ...fromDatabase,
    ...(PRODUCT_KEYWORDS[product.code] || []),
    normalize(product.design || ''),
    normalize(product.name),
  ].filter(Boolean);
};

/** Product named by word ("tshirt", "bag"). Plain numbers are ignored. */
function detectProductByKeyword(text, products) {
  const t = normalize(text);
  if (!t) return null;
  for (const product of products) {
    for (const keyword of keywordsForProduct(product)) {
      if (!keyword) continue;
      if (keyword.includes(' ') ? hasPhrase(t, keyword) : hasWord(t, keyword)) return product;
    }
  }
  return null;
}

/** Product chosen from the menu: number OR keyword. */
function detectProductChoice(text, products) {
  const index = parseMenuIndex(text, products.length);
  if (index) return products[index - 1];
  return detectProductByKeyword(text, products);
}

function detectColorByKeyword(text, colors) {
  const t = normalize(text);
  if (!t) return null;
  for (const color of colors) {
    const keywords = COLOR_KEYWORDS[color] || [normalize(color)];
    if (keywords.some((k) => hasWord(t, k))) return color;
  }
  return null;
}

function detectColorChoice(text, colors) {
  const index = parseMenuIndex(text, colors.length);
  if (index) return colors[index - 1];
  return detectColorByKeyword(text, colors);
}

/** Size, restricted to the sizes the product actually has. */
function detectSize(text, sizes) {
  const t = normalize(text);
  if (!t) return null;

  // longest keyword first, so "xxl" wins over "l" in the same message
  const candidates = [];
  for (const size of sizes) {
    for (const keyword of SIZE_KEYWORDS[size] || [normalize(size)]) {
      candidates.push({ size, keyword });
    }
  }
  candidates.sort((a, b) => b.keyword.length - a.keyword.length);

  for (const { size, keyword } of candidates) {
    if (keyword.includes(' ') ? hasPhrase(t, keyword) : hasWord(t, keyword)) return size;
  }
  return null;
}

/**
 * Quantity inside a free-text order like "2 black tshirt".
 * Only whitespace-delimited 1-3 digit numbers count, so a PIN code or a
 * phone number can never be read as a quantity.
 */
function freeTextQuantity(text) {
  const numeric = /(^|\s)(\d{1,3})(\s|$)/.exec(normalize(text));
  if (numeric) {
    const parsed = parseInt(numeric[2], 10);
    return parsed > 0 && parsed <= 99 ? parsed : null;
  }
  const word = tokens(text).find((token) => NUMBER_WORDS[token]);
  return word ? NUMBER_WORDS[word] : null;
}

function wantsHuman(text) {
  const t = normalize(text);
  return Boolean(t) && HUMAN_PATTERNS.some((re) => re.test(t));
}

/** Returns 'menu' | 'help' | 'cancel' | 'address' | null. */
function detectCommand(text) {
  const t = normalize(text).replace(/^\//, '');
  if (!t) return null;
  for (const [command, words] of Object.entries(CUSTOMER_COMMANDS)) {
    if (words.includes(t)) return command;
  }
  // short messages like "cancel kar do" still count, long sentences do not
  if (t.split(' ').length <= 3) {
    for (const [command, words] of Object.entries(CUSTOMER_COMMANDS)) {
      if (command === 'address') continue;
      if (hasAnyWord(t, words)) return command;
    }
  }
  return null;
}

const FIELD_LABELS = {
  name: ['name', 'naam', 'नाम'],
  address: ['full address', 'address', 'addres', 'adress', 'pata', 'पता'],
  city: ['city', 'shehar', 'sheher', 'शहर'],
  state: ['state', 'rajya', 'राज्य'],
  pin: ['pin code', 'pincode', 'pin', 'postal code', 'zip', 'पिन'],
};

/** Labelled block: "Name: Rahul\nCity: Jaipur\n..." */
function parseLabelledDetails(text) {
  const found = {};
  const lines = String(text || '').split(/\r?\n/);

  const assign = (rawLabel, rawValue) => {
    const label = normalize(rawLabel);
    const value = String(rawValue || '').trim();
    if (!value) return;
    for (const [field, labels] of Object.entries(FIELD_LABELS)) {
      if (labels.includes(label) && !found[field]) {
        found[field] = value;
        return;
      }
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    // "Name: Rahul Sharma"
    const inline = /^\s*([^:：\-]{2,20})\s*[:：]\s*(.+?)\s*$/.exec(lines[i]);
    if (inline) {
      assign(inline[1], inline[2]);
      continue;
    }

    /**
     * "Name:" on its own line, the answer underneath.
     *
     * This is how the form the bot sends actually comes back - the template
     * prints bare labels, so people reply under them. Reading only the
     * inline form meant the whole block fell through to the positional
     * parser, which stored "Name:" as the customer's name and "PIN Code:"
     * as their state.
     */
    const bare = /^\s*([^:：\-]{2,20})\s*[:：]\s*$/.exec(lines[i]);
    if (bare) {
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j += 1;
      // The next line has to be an answer, not the following label.
      if (j < lines.length && !/[:：]\s*$/.test(lines[j])) {
        assign(bare[1], lines[j]);
        i = j;
      }
    }
  }

  return found;
}

/**
 * Unlabelled 5-line paste (name / address / city / state / pin).
 * Accepted only when the last line is a valid 6 digit PIN, so it cannot fire
 * on ordinary chatter.
 */
function parsePlainDetailBlock(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 5) return null;

  // A line that is only a label means this is a filled-in form, and the
  // labelled parser owns it. Splitting it positionally is what turned
  // "PIN Code:" into somebody's state.
  if (lines.some((line) => /[:：]\s*$/.test(line))) return null;

  const pin = lines[lines.length - 1].replace(/\D/g, '');
  if (!/^\d{6}$/.test(pin)) return null;

  const head = lines.slice(0, -1);
  const [name, ...rest] = head;
  const state = rest.pop();
  const city = rest.pop();
  const address = rest.join(', ');
  if (!name || !address || !city || !state) return null;
  return { name, address, city, state, pin };
}

/**
 * "payment kahan karun?" - asked while a payment is outstanding.
 *
 * Deliberately narrow, and deliberately NOT part of detectQuestion(): this
 * only ever runs inside WAITING_FOR_PAYMENT, where the answer is always the
 * same and always safe to repeat. A customer at that step who says anything
 * resembling "where do I send it" wants the scanner back on their screen.
 *
 * "paid", "kar diya", "ho gaya" are excluded on purpose - those are people
 * telling the shop they HAVE paid, and answering that with the QR again
 * reads as not having listened.
 */
const WHERE_TO_PAY = [
  /\b(kaha|kahan|kidhar|where)\b[^?]{0,24}\b(pay|payment|bhej|send|karu|karun|karna|paisa|paise)\b/i,
  /\b(pay|payment|paisa|paise)\b[^?]{0,24}\b(kaha|kahan|kidhar|where|kaise|how)\b/i,
  /\b(qr|scanner|barcode)\b/i,
  /\bupi\s*(id)?\b/i,
  /\b(gpay|g pay|phonepe|phone pe|paytm|bhim)\b/i,
  /\bpayment\s*(details|link|number)\b/i,
  /\bscan\s*(karne|karu|code)\b/i,
];

const ALREADY_PAID = /\b(kar diya|ho gaya|hogaya|done|paid|bhej diya|bhejdiya|sent)\b/i;

function asksWhereToPay(text) {
  const value = String(text || '');
  if (!value.trim()) return false;
  if (ALREADY_PAID.test(value)) return false;
  return WHERE_TO_PAY.some((pattern) => pattern.test(value));
}

module.exports = {
  normalize,
  tokens,
  isYes,
  isNo,
  parseQuantity,
  parseMenuIndex,
  detectProductByKeyword,
  detectProductChoice,
  detectColorByKeyword,
  detectColorChoice,
  detectSize,
  freeTextQuantity,
  wantsHuman,
  isGreeting,
  detectCategory,
  detectQuestion,
  asksWhereToPay,
  detectCommand,
  parseLabelledDetails,
  parsePlainDetailBlock,
};
