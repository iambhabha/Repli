'use strict';

/**
 * One call that both reads the message and writes the answer.
 *
 * The entry branch used to need up to three: `intent.read` to work out what
 * was being asked, `understand.pick` when that still left the product
 * unclear, and `reply.compose` when neither produced anything to say. Three
 * round trips, three waits, three bills - for one line of WhatsApp.
 *
 * They are one question, so this asks it once: here is the shop, here is
 * where the conversation is, here is what they just said - what do they mean,
 * and what would you say back?
 *
 * What has NOT changed is who decides. Every rule check still runs first, and
 * a message the rules understand never reaches this file at all. What comes
 * back is a suggestion: the state machine reads the intent and takes its own
 * deterministic path, prices and stock come from the database as they always
 * did, and the reply is only ever used at the point where the script had
 * nothing left to say. If any part of the answer fails validation the whole
 * object is thrown away - never repaired - and the old path runs unchanged.
 */

const logger = require('../logger');
const client = require('./client');
const { safe } = require('./reply');

/**
 * Deliberately fixed lists. The model is shown them and may return nothing
 * else; anything off the list is a rejection, not something to correct.
 */
const INTENTS = [
  'greet', 'browse', 'pick_product', 'pick_colour', 'pick_size',
  'ask_price', 'ask_stock', 'ask_image', 'ask_cod', 'ask_delivery',
  'ask_material', 'ask_location', 'ask_brands',
  'bargain', 'refund', 'confirm', 'cancel', 'address', 'human', 'other',
];

const ACTIONS = ['reply', 'continue_flow', 'show_image', 'clarify', 'handover'];

/**
 * Which stored FAQ answer an intent corresponds to.
 *
 * These are the topics `bot/faq.js` already answers from the database, so an
 * intent that maps here is answered with the shop's own stored words rather
 * than the model's.
 */
const QUESTION_FOR = {
  ask_price: 'price',
  ask_stock: 'stock',
  ask_cod: 'cod',
  ask_delivery: 'waiting',
  ask_material: 'material',
  ask_location: 'location',
  ask_brands: 'brands',
  bargain: 'bargain',
  refund: 'refund',
};

/** A WhatsApp reply, not an essay. */
const MAX_WORDS = 40;

/**
 * Deliberately dense.
 *
 * This text is identical on every call, so every word in it is a word the
 * shop pays for on every message a customer sends. It was written as prose
 * first; what is left is the same rules with the padding removed. Nothing
 * safety-bearing was cut - the five things the model may never do are all
 * still here, and the enum lists are still spelled out in full, because
 * naming a list without showing it is exactly what made the first version
 * invent its own intents.
 */
const SYSTEM = [
  'You own an Indian clothing shop, replying on WhatsApp yourself.',
  '',
  'Voice: one or two sentences, max 40 words, like a shopkeeper types -',
  '"Haan bhai, red wali hai. Kaunsa size?". Hinglish in Roman script if they',
  'wrote Hinglish, else English. Answer only what was asked. No greeting unless',
  'greeted, no sign-off, no "Certainly", no bullets, max one emoji, and never',
  're-ask something already given.',
  '',
  'NEVER: a price, stock, booking amount or date not in FACTS exactly as',
  'written; a product, colour or size outside the lists; a promised restock,',
  'discount, refund or date; a link, UPI id or phone number; saying an order is',
  'placed, paid or confirmed.',
  '',
  'JSON:',
  ` intent  ${INTENTS.join(' ')}`,
  ` action  ${ACTIONS.join(' ')}`,
  ' confidence 0-1 | language hi|en',
  /**
   * Spelled out one field at a time because lumping them together cost real
   * rejections: shown "category product colour size: copied from the lists",
   * the model read the WORD "category" as "what kind of thing is this" and
   * answered "size". A whole valid reply was thrown away for it.
   */
  ' category: which department, from the categories list only (never a word',
  '           like "size", "colour" or "product"). null if unsure.',
  ' product:  a design name, from the designs list only. null if unsure.',
  ' colour:   from the colours list only. null if unsure.',
  ' size:     from the sizes list only. null if unsure.',
  ' reply:    your message - never empty. Use action continue_flow with',
  '           reply "" ONLY when the shop should answer, not you.',
  'Copy intent/action exactly, else "other". Null beats a guess.',
].join('\n');

/**
 * Validate the whole object, or reject the whole object.
 *
 * There is no partial acceptance and no repair. A model that returned a size
 * the shop does not stock has demonstrated it was guessing, and the rest of
 * what it said is not more trustworthy for having been formatted correctly.
 *
 * @param {object}   lists
 * @param {string[]} lists.categories  category KEYS, not rows
 * @returns {{value: object}|{reason: string}}
 */
function validate(raw, { categories, designs, colours, sizes, facts }) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { reason: 'unparsable' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { reason: 'not_an_object' };
  }

  for (const field of ['intent', 'confidence', 'language', 'action']) {
    if (parsed[field] === undefined) return { reason: `missing_${field}` };
  }

  if (!INTENTS.includes(parsed.intent)) return { reason: 'bad_intent' };
  if (!ACTIONS.includes(parsed.action)) return { reason: 'bad_action' };
  if (parsed.language !== 'hi' && parsed.language !== 'en') return { reason: 'bad_language' };

  const confidence = Number(parsed.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    return { reason: 'bad_confidence' };
  }

  /** Off the supplied list means rejected, not corrected. */
  const fromList = (value, allowed) => {
    if (value === null || value === undefined || value === '') return { ok: true, value: null };
    const wanted = String(value).trim().toLowerCase();
    const match = allowed.find((option) => String(option).toLowerCase() === wanted);
    return match ? { ok: true, value: match } : { ok: false };
  };

  const category = fromList(parsed.category, categories);
  if (!category.ok) return { reason: 'bad_category' };
  const product = fromList(parsed.product, designs);
  if (!product.ok) return { reason: 'bad_product' };
  const colour = fromList(parsed.colour, colours);
  if (!colour.ok) return { reason: 'bad_colour' };
  const size = fromList(parsed.size, sizes);
  if (!size.ok) return { reason: 'bad_size' };

  const reply = typeof parsed.reply === 'string' ? parsed.reply.trim() : '';

  if (reply) {
    if (reply.split(/\s+/).length > MAX_WORDS) return { reason: 'reply_too_long' };
    /**
     * The same gate a composed reply has always passed: every number in it
     * must appear in the shop's own facts, and it may not contain a link.
     * This is what stops an invented price or a made-up UPI id.
     */
    if (!safe(reply, facts)) return { reason: 'unsafe_reply' };
  } else if (parsed.action !== 'continue_flow') {
    // Any other action promised the customer words and did not produce them.
    return { reason: 'empty_reply' };
  }

  return {
    value: {
      intent: parsed.intent,
      confidence,
      category: category.value,
      product: product.value,
      colour: colour.value,
      size: size.value,
      language: parsed.language,
      action: parsed.action,
      reply,
      // What the state machine actually branches on, derived rather than
      // asked for separately: the FAQ topic this intent corresponds to.
      question: QUESTION_FOR[parsed.intent] || null,
    },
  };
}

/**
 * @param {object}   input
 * @param {string}   input.text        what the customer just said
 * @param {string}   input.facts       the only things the shop may state
 * @param {string}   input.phase       where the conversation is, in plain words
 * @param {object[]} input.categories  [{key, label}]
 * @param {string[]} input.designs
 * @param {string[]} input.colours
 * @param {string[]} input.sizes
 * @param {string[]} [input.history]   recent turns, ALREADY REDACTED
 * @param {string}   [input.known]     what they have given, as flags not values
 * @param {string}   [input.language]  the language the conversation is already in
 * @param {string}   [input.phone]
 * @returns {Promise<object|null>} the validated answer, or null
 */
async function read({
  text,
  facts,
  phase,
  categories = [],
  designs = [],
  colours = [],
  sizes = [],
  history = [],
  known = '',
  language = null,
  phone = null,
}) {
  const message = String(text || '').trim();
  if (!message || !client.isConfigured()) return null;
  if (message.length > 400) return null;

  const categoryKeys = categories.map((c) => c.key);
  let accepted = null;

  const answer = await client.complete({
    purpose: 'converse',
    phone,
    system: SYSTEM,
    json: true,
    temperature: 0.4,
    maxTokens: 220,
    /**
     * The allow-lists are one line, not four JSON blobs, and they no longer
     * repeat what the facts block already says. Measured, the old shape spent
     * a quarter of the user prompt naming the same designs and sizes twice.
     * Only names the model has to copy character-for-character are listed;
     * everything else it needs is in FACTS.
     */
    user: [
      'FACTS (only these may be stated):',
      facts,
      `ONLY these names: designs ${designs.join(', ') || 'none'}` +
        (colours.length ? ` | colours ${colours.join(', ')}` : '') +
        (sizes.length ? ` | sizes ${sizes.join(',')}` : '') +
        (categoryKeys.length ? ` | categories ${categoryKeys.join(',')}` : ''),
      `PHASE: ${phase}${language ? ` | already speaking ${language}` : ''}`,
      known ? `ALREADY GIVEN: ${known} - never ask again.` : '',
      history.length ? `RECENT:\n${history.join('\n')}` : '',
      `CUSTOMER: ${JSON.stringify(message)}`,
    ]
      .filter((line) => line !== '')
      .join('\n'),
    verify: (raw) => {
      const result = validate(raw, { categories: categoryKeys, designs, colours, sizes, facts });
      if (result.reason) return result.reason;
      accepted = result.value;
      return null;
    },
  });

  if (!answer || !accepted) return null;

  logger.info('ai.converse', {
    message: message.slice(0, 50),
    action: [
      accepted.intent,
      `conf=${accepted.confidence.toFixed(2)}`,
      accepted.category && `cat=${accepted.category}`,
      accepted.product && `design=${accepted.product}`,
      accepted.size && `size=${accepted.size}`,
      accepted.reply ? 'has-reply' : 'no-reply',
    ]
      .filter(Boolean)
      .join(' '),
  });

  return accepted;
}

module.exports = { read, validate, INTENTS, ACTIONS, QUESTION_FOR, MAX_WORDS };
