'use strict';

/**
 * Reads a whole sentence at once.
 *
 * `understand.pick` answers one question - "which of these colours?" - and is
 * right for a step that is already waiting for an answer. But a customer's
 * first message is rarely an answer to anything:
 *
 *   "bhai ye 3pointer club hai? spider man wali red tshirt hai kya?"
 *   "hoodie chahiye XL me, kitne ki hai"
 *   "kala wala dikha do bada size"
 *
 * Each of those carries several things at once - a category, a design, a
 * size, a question - and the rule parser can only find the ones somebody
 * thought to list. This pulls all of them out in one call.
 *
 * Everything it returns is constrained to lists supplied by the caller, taken
 * from the live catalogue. It cannot name a product the shop does not sell,
 * because it is never shown one.
 */

const logger = require('../logger');
const client = require('./client');

const QUESTIONS = [
  'price', 'bargain', 'refund', 'material', 'waiting', 'cod', 'location', 'stock', 'brands',
];

const SYSTEM = [
  'You read one WhatsApp message sent to an Indian clothing shop and pull out',
  'what the customer is asking for. They write Hinglish, Hindi or English,',
  'casually, with typos, often several things in one line.',
  '',
  'Return JSON with these keys, using null when the message does not say:',
  '  category  - one of the given category keys',
  '  design    - one of the given design names, copied exactly',
  '  size      - one of the given sizes, copied exactly',
  '  question  - one of: price, bargain, refund, material, waiting, cod, location, stock, brands',
  '  wantsToBook - true only if they clearly say they want to buy/book/order now',
  '',
  'Rules:',
  '- Copy names exactly from the lists. Never invent one.',
  '- Choose null over a guess. A wrong guess costs the shop an order.',
  '- "hai kya?", "available hai?", "stock hai?" about a product = question "stock".',
  '- "kitne ka", "price", "how much" = question "price".',
  '- Asking for a discount, a lower rate, "kam kar do", "last price",',
  '  "kuch kam hoga" = question "bargain", not "price".',
  '- Refund, return, exchange, "paisa wapas" = question "refund".',
  '- A plain greeting with nothing else = all nulls.',
].join('\n');

/**
 * @param {object}   input
 * @param {string}   input.text
 * @param {object[]} input.categories  [{key, label}]
 * @param {string[]} input.designs     design names currently sold
 * @param {string[]} input.sizes
 * @param {string}   [input.phone]
 * @returns {Promise<{category:string|null,design:string|null,size:string|null,
 *                    question:string|null,wantsToBook:boolean}|null>}
 */
async function read({ text, categories = [], designs = [], sizes = [], phone = null }) {
  const message = String(text || '').trim();
  if (!message || !client.isConfigured()) return null;
  if (message.length > 400) return null;

  const answer = await client.complete({
    purpose: 'intent',
    phone,
    system: SYSTEM,
    json: true,
    temperature: 0,
    maxTokens: 90,
    user: [
      `Categories: ${JSON.stringify(categories.map((c) => ({ key: c.key, label: c.label })))}`,
      `Designs: ${JSON.stringify(designs)}`,
      `Sizes: ${JSON.stringify(sizes)}`,
      `Message: ${JSON.stringify(message)}`,
    ].join('\n'),
  });

  if (!answer) return null;

  let parsed;
  try {
    parsed = JSON.parse(answer);
  } catch (err) {
    logger.warn('ai.intent_unparsable', { message: answer.slice(0, 100) });
    return null;
  }

  // Anything not on the lists is dropped rather than corrected: the point of
  // giving the model a menu is that the answer has to come off the menu.
  const pick = (value, allowed) => {
    if (value === null || value === undefined) return null;
    const wanted = String(value).trim().toLowerCase();
    return allowed.find((option) => String(option).toLowerCase() === wanted) || null;
  };

  const result = {
    category: pick(parsed.category, categories.map((c) => c.key)),
    design: pick(parsed.design, designs),
    size: pick(parsed.size, sizes),
    question: pick(parsed.question, QUESTIONS),
    wantsToBook: parsed.wantsToBook === true,
  };

  logger.info('ai.intent', {
    message: message.slice(0, 50),
    action: [
      result.category && `cat=${result.category}`,
      result.design && `design=${result.design}`,
      result.size && `size=${result.size}`,
      result.question && `q=${result.question}`,
      result.wantsToBook && 'book',
    ]
      .filter(Boolean)
      .join(' ') || 'nothing',
  });

  return result;
}

module.exports = { read, QUESTIONS };
