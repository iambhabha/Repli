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
  'ask_material', 'ask_location', 'ask_brands', 'ask_booking',
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
  'edit_details',      // the address on the summary is wrong; take it again
  'confirm_order',     // they agreed to the summary. REQUEST only - the
                       // backend still checks the state and the draft
  'decline_order',     // they do not want it as it stands
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
  ask_booking: 'booking',
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
  'MATCH THE DESIGN LIST FIRST. If what they typed names one of the designs',
  'above, it is select_product - even when that name contains a department',
  'word. "bape single hood" IS a design; "hood" inside it does not make it a',
  'request to browse hoodies. Check the design names before you decide it is',
  'a department.',
  '',
  'A DESIGN IS A CHOICE. A DEPARTMENT IS A LIST.',
  'If they named a design - "venom", "spiderman", "bape single hood" - that',
  'is select_product, never show_products.',
  'If they named only a department - "tshirt", "I need a t-shirt", "hoodie',
  'dikhao", "bags", "kya kya hai" - that is show_products, and product MUST',
  'be null. A department word is not a design, even when designs are already',
  'on their screen. Do not pick one for them; showing the list IS the answer.',
  '',
  'A FOLLOW-ON CARRIES THE PREVIOUS REQUEST. "bhi", "aur", "uska bhi",',
  '"ye wala bhi" continue what was just asked, they do not start something',
  'new. After "iski photo bhejo", "black wali bhi dena" means the black',
  "one's PHOTO - decision show_image, product Venom - not a decision to buy",
  'the Venom. Look at the previous turn before deciding.',
  '',
  'RESOLVE REFERENCES. "iska", "ye wala", "wo", "pehla wala", "jo dikhaya',
  'tha" refer to something already in the conversation - the selected design,',
  'or one of the products last shown. Work out which and name it.',
  '',
  'NEVER INFER A DEPARTMENT FROM A COLOUR. A colour tells you nothing about',
  'whether something is a shirt, a hoodie or a bag. If they said only a',
  'colour:',
  '  - a design is already chosen -> select_colour on that design',
  '  - nothing chosen, but a list is on their screen -> the one from THAT',
  '    list. LAST SHOWN TO THEM below is what they are looking at, and a',
  '    person says "red wala chahiye" about what is in front of them, not',
  '    about something in another department. A customer browsing the bags',
  '    said exactly that and was handed a Spider-Man T-shirt, because it',
  '    also comes in red. The bag was the only thing on their screen.',
  '  - nothing chosen, no list shown, one design has it -> select_product',
  '  - nothing chosen, no list shown, several have it -> needsClarification,',
  '    and ask which design they mean. Do NOT set category.',
  'Answering a bare "Red" with a department menu is the worst thing you can',
  'do here - it has happened, and it sent a customer to the hoodies.',
  '',
  'EVIDENCE, NOT INVENTION. Name a product, category, colour or size only',
  'when the conversation or the lists in front of you actually identify it.',
  'Several plausible -> clarify. None identifiable -> clarify. Never',
  'manufacture certainty, and never fill a field to look complete.',
  '',
  'This matters most for the shortest messages - "red", "black", "haan",',
  '"this one", "iska", "same", "ok". None of them mean anything on their',
  'own. Read them from what came before, or ask.',
  '',
  'But do NOT ask when you already know. If the shop just asked which colour',
  'and they said "Red", that is the answer - act on it. Clarify for real',
  'ambiguity, not for every short message.',
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
  /**
   * One field per line, and every one of them named.
   *
   * These were written as ` confidence 0-1 | language hi|en` - two keys on
   * one line separated by a pipe - and the model read it as prose rather
   * than as two required fields. It returned confidence and omitted
   * language, the whole decision was thrown away as `missing_language`, and
   * the shop fell back to its keyword lists on nearly every turn. The brain
   * was running perhaps one turn in five, which is the entire explanation
   * for a regression suite that failed a different set of tests each run.
   *
   * The identical mistake had already been made once in converse.js, where
   * four fields shared a line and the model answered "size" for category.
   */
  ' confidence: 0 to 1, how sure you are.',
  ' language: "hi" if they wrote Hinglish, "en" if English. Always required.',
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
  'YOU DECIDE, THE SHOP EXECUTES. Nothing else reads the message. If they',
  'named a size, a colour, a quantity or a design, the decision is the',
  'matching select_* - the flow will not pick it up for you.',
  '  "L" while choosing a size        -> select_size',
  '  "red" for a design already held  -> select_colour',
  '  "2" pieces                       -> select_quantity',
  'confirm_order EXISTS ONLY ON THE SUMMARY. Nowhere else in the',
  'conversation can anything be confirmed, because nothing has been drawn up',
  'yet. If the shop is asking for a size and the customer types "L", that is',
  'the size - pick_size, select_size. It is not agreement, it is the answer',
  'to the question just asked. A single letter, a number, a word off the',
  'list: whatever step the shop is on, a bare token is that step being',
  'answered. This cost a real customer their place: "L" was read as a yes,',
  'there was no order to say yes to, and the shop asked them which design',
  'they wanted - two steps backwards from where they already were.',
  '',
  'ASKING HOW TO BOOK IS NOT BOOKING. "book karni hai to kya karna hoga",',
  '"kaise book karu", "aage ka process kya hai", "advance kitna hai" -> intent',
  'ask_booking. They are asking what happens next, not agreeing to anything.',
  'A real customer typed "thik hai mujhe red wali book karni hai toh kya"',
  'and it was read as a yes. There was no order to say yes to, and the',
  'question they actually asked went unanswered. "thik hai" opened the',
  'sentence, but the sentence was a question. Read all of it.',
  '',
  'CONFIRMING AN ORDER. On the order summary, decide what they actually did:',
  '  agreed as it stands            -> confirm_order',
  '  refused, or wants it changed   -> decline_order',
  '  anything you are unsure about  -> needsClarification',
  'Read the whole message, not one word. "haan but size change karna hai" is',
  'NOT a confirmation - they want a change. "theek hai", "kar do", "ok bhej',
  'do" are. "ruk jao" is not. A wrong yes spends their money on an order',
  'they never agreed to, so when in doubt, ask.',
  '',
  'A GREETING IS THE ONE THING YOU DO NOT ANSWER. "hi", "hello", "namaste",',
  '"hy" -> decision "continue" with reply "". The shop opens with its own',
  'welcome and its own department menu, which name the brands and list what',
  'is in stock; a friendly sentence from you replaces both and the customer',
  'never sees the menu.',
  '',
  '"continue" is otherwise only for a message you have nothing to do about.',
  'Copy intent/decision exactly. Null beats a guess.',
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

  for (const field of ['intent', 'decision', 'confidence']) {
    if (parsed[field] === undefined) return { reason: `missing_${field}` };
  }

  if (!INTENTS.includes(parsed.intent)) return { reason: 'bad_intent' };
  if (!DECISIONS.includes(parsed.decision)) return { reason: 'bad_decision' };

  /**
   * Language decides nothing, so it cannot sink the decision.
   *
   * It was in the required list, and a missing one threw away an otherwise
   * valid reading of the customer's message - the design they named, the
   * photo they asked for, all of it - over which language to reply in. The
   * fields that ARE load-bearing stay fail-closed above and below: a product,
   * colour or size the shop does not have still rejects the lot, because
   * acting on one of those is acting on something untrue.
   */
  const language = parsed.language === 'hi' || parsed.language === 'en' ? parsed.language : null;

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

  /**
   * Words and decisions are gated separately.
   *
   * They used to share a fate: if the prose failed the safety check the
   * whole object was thrown away. That sounds strict and was in fact a way
   * to lose correct decisions, because the check rejects any number not in
   * FACTS - and FACTS is scoped, so a size turn does not carry the price.
   *
   * The result, seen in a live trace: "size L" was read perfectly as
   * select_size, the model added a friendly line mentioning Rs2499, the
   * price was not in that turn's facts, and the entire decision died. The
   * size never applied. The address block after it died the same way on the
   * customer's own PIN code. By the time "yes" arrived there was no summary
   * to confirm, and the shop asked for a size the customer had given twice.
   *
   * So an unsafe REPLY is dropped and the decision survives - the shop has
   * its own words for every step and will use them. An unsafe CLARIFICATION
   * is different: the question IS the action there, and asking nothing while
   * claiming to ask would leave the customer with silence, so that still
   * sinks the object.
   */
  let words = reply;
  if (words) {
    const tooLong = words.split(/\s+/).length > MAX_WORDS;
    if (tooLong || !safe(words, facts)) words = '';
  }

  if (needsClarification) {
    if (clarification.split(/\s+/).length > MAX_WORDS) return { reason: 'clarify_too_long' };
    if (!safe(clarification, facts)) return { reason: 'unsafe_clarification' };
  }

  /**
   * A decision to speak that has nothing left to say is not executable -
   * the flow must fall back rather than send an empty message.
   */
  if (!words && !needsClarification && parsed.decision === 'reply') {
    return { reason: 'empty_reply' };
  }

  /**
   * A decision has to be internally consistent before anyone acts on it.
   *
   * "venom" came back as show_products with product "Venom" - browse the
   * department, and by the way here is the exact design they named. Acted
   * on, that put the customer in front of the list they had just chosen
   * from, so the size step never arrived and both size tests failed.
   *
   * This does not re-read the message; it never sees the message. It says
   * that a decision which identified a design IS a selection of that design,
   * which is a rule about the contract, not an interpretation of language.
   */
  let decision = needsClarification ? 'clarify' : parsed.decision;
  if (decision === 'show_products' && product.value) decision = 'select_product';

  /**
   * An intent and a decision that disagree are one decision, badly written.
   *
   * A bare "L" came back as intent pick_size with decision "continue" - read
   * correctly, then handed to a flow that no longer picks sizes up, so the
   * customer was asked which size after saying it. Once it came back as
   * confirm_order for the same message, which would have been worse.
   *
   * This reads no message. It says that having identified a size while
   * meaning to pick one IS the decision to select it.
   */
  const IMPLIED = {
    pick_size: ['size', 'select_size'],
    pick_colour: ['colour', 'select_colour'],
    pick_quantity: ['quantity', 'select_quantity'],
    pick_product: ['product', 'select_product'],
  };
  const implied = IMPLIED[parsed.intent];
  if (implied && !needsClarification) {
    const [field, wanted] = implied;
    const named = { size: size.value, colour: colour.value, quantity, product: product.value }[field];
    if (named !== null && named !== undefined && decision !== wanted) decision = wanted;
  }

  /**
   * The same disagreement, on the other side of the conversation.
   *
   * A question the shop has a stored answer for kept coming back as intent
   * ask_cod with decision "reply" - the question read perfectly, then
   * answered in the model's own prose instead of from the database. The
   * customer was told about cash on delivery without the figure, because
   * only answer_question goes and fetches it.
   *
   * "continue" is included for the same reason. It means "the flow already
   * handles this" - but the flow has no answer for what the booking process
   * is, so the question died there too. A live customer asked what to do
   * next and was told to verify their delivery details.
   *
   * Naming the topic IS choosing to answer it. Nothing is re-read here, and
   * the swap can only make the reply more truthful: answer_question serves
   * stored text, and when there is none stored it declines and the turn
   * carries on exactly as it would have.
   */
  const ANSWERABLE = decision === 'reply' || decision === 'continue';
  if (ANSWERABLE && QUESTION_FOR[parsed.intent] && !needsClarification) {
    decision = 'answer_question';
  }

  return {
    value: {
      intent: parsed.intent,
      decision,
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
      language,
      reply: words,
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
  pairs = [],
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
      /**
       * Which colour belongs to which design.
       *
       * The lists used to go out flat - every design on one line, every
       * colour in the shop on another - and nothing said they were related.
       * Asked about "Red" the brain answered design Venom, which is the
       * black shirt; Red is the Spider-Man. It was not guessing carelessly,
       * it had been handed two lists and no way to pair them.
       */
      pairs.length ? 'WHAT EACH DESIGN COMES IN:\n' + pairs.join('\n') : '',
      `ONLY these names: designs ${designs.join(', ') || 'none'}` +
        (colours.length ? ` | colours ${colours.join(', ')}` : '') +
        (sizes.length ? ` | sizes ${sizes.join(',')}` : '') +
        (categoryKeys.length ? ` | categories ${categoryKeys.join(',')}` : ''),
      `PHASE: ${phase}${language ? ` | already speaking ${language}` : ''}`,
      chosen ? `ALREADY CHOSEN: ${chosen}` : '',
      /**
       * The list on their screen, and what it means, in the same breath.
       *
       * The rule for this lived far up in the standing instructions and lost
       * every time: a customer looking at the bag list said "red wala
       * chahiye" and was handed a Spider-Man T-shirt, because that shirt is
       * the red one in the catalogue. The context was correct - the bag was
       * the only thing shown - so the fix is not more context but the rule
       * standing next to it, where it cannot be outweighed by a paragraph
       * about something else.
       */
      shown.length
        ? `LAST SHOWN TO THEM, in order: ${shown.join(', ')}
` +
          'These are on their screen right now, so they are choosing FROM' +
          ' this list, not asking to see it again. A bare colour, a bare' +
          ' number, or "red wala" -> select_product on the item from THIS' +
          ' list, with that colour in selection.colour - even when a design' +
          ' in another department shares the colour. Never show_products in' +
          ' answer to a colour: they are already looking at the list, and' +
          ' sending it a second time answers nothing.'
        : '',
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
