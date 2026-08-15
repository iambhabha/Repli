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

/** Extra spellings, keyed on the product `code` column. */
const PRODUCT_KEYWORDS = {
  TS001: [
    'tshirt', 'tshirts', 't shirt', 't shirts', 'shirt', 'shirts', 'tee', 'tees',
    'tisht', 'टीशर्ट', 'टी शर्ट', 'शर्ट',
  ],
  BAG001: ['bag', 'bags', 'baig', 'jhola', 'purse', 'backpack', 'बैग', 'झोला'],
};

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

const isNo = (text) => hasAnyWord(text, NO_WORDS);
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

const keywordsForProduct = (product) =>
  (PRODUCT_KEYWORDS[product.code] || []).concat([normalize(product.name)]);

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
  for (const line of String(text || '').split(/\r?\n/)) {
    const match = /^\s*([^:：\-]{2,20})\s*[:：]\s*(.+?)\s*$/.exec(line);
    if (!match) continue;
    const label = normalize(match[1]);
    const value = match[2].trim();
    if (!value) continue;
    for (const [field, labels] of Object.entries(FIELD_LABELS)) {
      if (labels.includes(label) && !found[field]) {
        found[field] = value;
        break;
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
  detectCommand,
  parseLabelledDetails,
  parsePlainDetailBlock,
};
