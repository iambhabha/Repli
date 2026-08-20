'use strict';

/**
 * The one place a customer's message is understood.
 *
 * Everything before this file read messages by matching strings. A dictionary
 * decided which design they meant ('spidey', 'lal tshirt', 'jhola'), a second
 * one decided the department, a third the colour, a fourth whether they had
 * asked for a photo - and each of them ran BEFORE any model saw the sentence,
 * so the model never got to disagree. One live afternoon showed what that
 * costs: seventeen model calls, thirteen of them rewording a line the lists
 * had already chosen, and "Red" answered with the hoodie menu because a
 * category matcher ran before a colour matcher.
 *
 * The lists could always be made longer. That was the problem: every phrasing
 * nobody thought of was a customer who was not understood, and the fix was
 * always another string.
 *
 * So this is the brain, and it decides. It is given what is true right now -
 * the live catalogue, where the conversation is, what they already chose,
 * what was last shown to them - and it answers with a decision the backend
 * then validates and carries out. It resolves the reference too: "iska", "ye
 * wala", "pehla wala" mean nothing to a matcher and everything in context.
 *
 * What it is NOT allowed to do has not changed:
 *
 *   - It cannot invent a product, colour or size. Every name it returns is
 *     checked against the live catalogue here, and the whole decision is
 *     thrown away if any part of it is not real.
 *   - It cannot state a price, a stock count or an order status. Those are
 *     read from the database by the executor, never copied from a model.
 *   - It cannot place an order or confirm a payment. It may REQUEST the
 *     confirmation step; the backend still requires the customer's own yes.
 *
 * And it is allowed to say it does not know. "Red" when three designs have a
 * red variant is a question, not a selection, and `needsClarification` is how
 * it says so rather than picking one.
 */

const logger = require('../logger');
const client = require('./client');
const { safe } = require('./reply');

/**
 * What the customer is doing. Kept close to the old intent list so the
 * stored FAQ answers still map cleanly.
 */
const INTENTS = [
  'greet', 'browse', 'pick_product', 'pick_colour', 'pick_size', 'pick_quantity',
  'ask_price', 'ask_stock', 'ask_image', 'ask_cod', 'ask_delivery',
  'ask_material', 'ask_location', 'ask_brands',
  'bargain', 'refund', 'confirm', 'cancel', 'address', 'human', 'chitchat', 'other',
];

/**
 * What the backend should DO about it.
 *
 * Deliberately a short list of things this shop can actually carry out. A
 * decision outside it is a decision nobody can execute, so it is rejected
 * rather than approximated.
 */
const DECISIONS = [
  /**
   * Deliberately absent: anything that restarts the conversation.
   *
   * The brain was given a "show the menu" decision and used it for "1",
   * "I need a t-shirt" and "hoodie" - each time throwing a customer who had
   * named what they wanted back to the department list they had just come
   * from. Sending somebody back to the start is not a reading of their
   * message, so it is not the brain's to decide; `menu` and the greeting
   * path still do it, from the customer's own word.
   */
  'show_products',     // one department's designs
  'show_image',        // photographs of a product
  'select_product',    // they named a design
  'select_colour',
  'select_size',
  'select_quantity',
  'answer_question',   // a question the shop has a stored answer for
  'collect_details',   // they want to order - start the form
  'confirm_order',     // REQUEST the confirmation step; never the order itself
  'cancel_order',
  'handoff',           // a person should take over
  'clarify',           // ambiguous - ask
  'reply',             // nothing to do but say something
  'continue',          // the rules already handle this; carry on
];

/** Which stored FAQ answer an intent corresponds to. */
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

/** Which photograph they asked for, when they were specific. */
const IMAGE_KINDS = ['front', 'back', 'all'];

const MAX_WORDS = 40;

const SYSTEM = [
  'You are the brain of an Indian clothing shop on WhatsApp. You read one',
  'customer message and decide what the shop should do about it.',
  '',
  'You are given: the shop facts, the live catalogue, where the conversation',
  'is, what this customer has already chosen, what was last shown to them,',
  'and the last few messages. Decide from ALL of it, not from the message',
  'alone.',
  '',
  'RESOLVE REFERENCES. "iska", "ye wala", "wo", "pehla wala", "jo dikhaya',
  'tha" refer to something already in the conversation - the selected design,',
  'or one of the products last shown. Work out which and name it.',
  '',
  'A bare colour is NOT automatically a design. "Red" while choosing a size',
  'for a chosen design is a request to see or switch to red; "Red" when two',
  'designs both have red is a question you must ask, not guess.',
  '',
  'SAY YOU DO NOT KNOW. If more than one thing fits, set needsClarification',
  'true and write the question in clarification. Never pick one at random.',
  '',
  'NEVER: a price, stock count, date or amount not in FACTS exactly as',
  'written; a product, colour or size outside the lists; a promised restock,',
  'discount or refund; a link, UPI id or phone number; saying an order is',
  'placed, paid or confirmed - you may only ASK to confirm.',
  '',
  'Voice, when you write words: one or two sentences, max 40 words, like a',
  'shopkeeper types. Hinglish in Roman script if they wrote Hinglish, else',
  'English. No greeting unless greeted, no sign-off, max one emoji.',
  '',
  'JSON:',
  ` intent    ${INTENTS.join(' ')}`,
  ` decision  ${DECISIONS.join(' ')}`,
  ' confidence 0-1 | language hi|en',
  ' category: a department key, from the categories list only. null if unsure.',
  ' product:  a design name, from the designs list only. null if unsure.',
  ' colour:   from the colours list only. null if unsure.',
  ' size:     from the sizes list only. null if unsure.',
  ' quantity: a whole number, or null.',
  ` imageKind: ${IMAGE_KINDS.join('|')} or null - which photo they asked for.`,
  ' needsClarification: true when more than one thing fits.',
  ' clarification: the question to ask them. null unless needsClarification.',
  ' reply: your message, or "" when the shop should answer instead.',
  '',
  'Use decision "continue" when the message is already handled by the shop',
  'flow and you have nothing to add. Copy intent/decision exactly. Null beats',
  'a guess.',
].join('\n');

/**
 * Validate the whole decision, or throw all of it away.
 *
 * Same rule as everywhere else in this codebase: a model that named a size
 * the shop does not stock was guessing, and the rest of what it said is not
 * more trustworthy for being well formed.
 *
 * @param {object} lists  the live catalogue this turn was shown
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

  for (const field of ['intent', 'decision', 'confidence', 'language']) {
    if (parsed[field] === undefined) return { reason: `missing_${field}` };
  }

  if (!INTENTS.includes(parsed.intent)) return { reason: 'bad_intent' };
  if (!DECISIONS.includes(parsed.decision)) return { reason: 'bad_decision' };
  if (parsed.language !== 'hi' && parsed.language !== 'en') return { reason: 'bad_language' };

  const confidence = Number(parsed.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    return { reason: 'bad_confidence' };
  }

  /** Off the supplied list means rejected, never corrected. */
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
  const imageKind = fromList(parsed.imageKind, IMAGE_KINDS);
  if (!imageKind.ok) return { reason: 'bad_image_kind' };

  let quantity = null;
  if (parsed.quantity !== null && parsed.quantity !== undefined && parsed.quantity !== '') {
    const count = Number(parsed.quantity);
    if (!Number.isInteger(count) || count < 1 || count > 99) return { reason: 'bad_quantity' };
    quantity = count;
  }

  const needsClarification = parsed.needsClarification === true;
  const clarification =
    typeof parsed.clarification === 'string' ? parsed.clarification.trim() : '';

  /**
   * Saying "I need to ask" without asking anything is the one failure mode
   * that would leave a customer with silence.
   */
  if (needsClarification && !clarification) return { reason: 'clarify_without_question' };

  const reply = typeof parsed.reply === 'string' ? parsed.reply.trim() : '';

  /** Every word the shop says passes the same gate it always has. */
  for (const words of [reply, needsClarification ? clarification : '']) {
    if (!words) continue;
    if (words.split(/\s+/).length > MAX_WORDS) return { reason: 'reply_too_long' };
    if (!safe(words, facts)) return { reason: 'unsafe_reply' };
  }

  if (!reply && !needsClarification && parsed.decision === 'reply') {
    return { reason: 'empty_reply' };
  }

  return {
    value: {
      intent: parsed.intent,
      decision: needsClarification ? 'clarify' : parsed.decision,
      confidence,
      selection: {
        category: category.value,
        product: product.value,
        colour: colour.value,
        size: size.value,
        quantity,
      },
      imageKind: imageKind.value,
      needsClarification,
      clarification: needsClarification ? clarification : null,
      language: parsed.language,
      reply,
      question: QUESTION_FOR[parsed.intent] || null,
    },
  };
}

/**
 * @param {object}   input
 * @param {string}   input.text      what they just said
 * @param {string}   input.facts     the only things the shop may state
 * @param {string}   input.phase     where the conversation is, in plain words
 * @param {object[]} input.categories [{key, label}]
 * @param {string[]} input.designs
 * @param {string[]} input.colours
 * @param {string[]} input.sizes
 * @param {string}   [input.chosen]   what this customer has already picked
 * @param {string[]} [input.shown]    designs last put on their screen
 * @param {string[]} [input.history]  recent turns, ALREADY REDACTED
 * @param {string}   [input.known]    details they have given, as flags
 * @param {string}   [input.language]
 * @param {string}   [input.phone]
 * @returns {Promise<object|null>} the validated decision, or null
 */
async function decide({
  text,
  facts,
  phase,
  categories = [],
  designs = [],
  colours = [],
  sizes = [],
  chosen = '',
  shown = [],
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
    purpose: 'brain',
    phone,
    system: SYSTEM,
    json: true,
    /**
     * Zero, because this is a decision and not a piece of writing.
     *
     * At 0.2 the same sentence produced different decisions on different
     * turns - a question about fabric read as browsing once and as a
     * question the next time, which moved a customer out of the size step
     * they were on. A shop that behaves differently each time you say the
     * same thing is worse than one that is rigid.
     */
    temperature: 0,
    maxTokens: 260,
    user: [
      'FACTS (only these may be stated):',
      facts,
      `ONLY these names: designs ${designs.join(', ') || 'none'}` +
        (colours.length ? ` | colours ${colours.join(', ')}` : '') +
        (sizes.length ? ` | sizes ${sizes.join(',')}` : '') +
        (categoryKeys.length ? ` | categories ${categoryKeys.join(',')}` : ''),
      `PHASE: ${phase}${language ? ` | already speaking ${language}` : ''}`,
      chosen ? `ALREADY CHOSEN: ${chosen}` : '',
      shown.length ? `LAST SHOWN TO THEM, in order: ${shown.join(', ')}` : '',
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

  logger.info('ai.brain', {
    phone,
    message: message.slice(0, 50),
    action: [
      accepted.intent,
      `-> ${accepted.decision}`,
      `conf=${accepted.confidence.toFixed(2)}`,
      accepted.selection.category && `cat=${accepted.selection.category}`,
      accepted.selection.product && `design=${accepted.selection.product}`,
      accepted.selection.colour && `colour=${accepted.selection.colour}`,
      accepted.selection.size && `size=${accepted.selection.size}`,
      accepted.imageKind && `img=${accepted.imageKind}`,
      accepted.needsClarification && 'ASKS',
    ]
      .filter(Boolean)
      .join(' '),
  });

  return accepted;
}

module.exports = { decide, validate, INTENTS, DECISIONS, IMAGE_KINDS, QUESTION_FOR, MAX_WORDS };
