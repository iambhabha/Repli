'use strict';

/**
 * Makes a reply sound like the shop owner instead of a form letter.
 *
 * The rule engine decides WHAT to say - which product, which price, which
 * order number, which next step. This file only decides HOW it sounds. That
 * split is the whole safety story: a model that cannot choose facts cannot
 * invent them.
 *
 * Even so, the rewrite is verified before it is allowed out (see verify()).
 * Anything suspicious and the original template is sent instead. The customer
 * gets a slightly stiffer sentence; they never get a wrong price.
 */

const crypto = require('crypto');
const config = require('../config');
const logger = require('../logger');
const client = require('./client');
const settingsService = require('../services/settingsService');

/**
 * The owner's own instructions, typed in the admin panel.
 *
 * They are appended to the system prompt, so the shop can adjust its own
 * voice - "keep it shorter", "call people bhai", "no emojis" - without a
 * deploy. They cannot loosen the safety rules: the numbers-and-links check
 * runs on the result either way, so no instruction can talk the model into
 * changing a price.
 */
/**
 * Read through the shared cache rather than a private thirty-second Map.
 *
 * The Map worked, but it was invisible to everything else: the panel would
 * publish "repli:settings:ai_instructions is stale", every other cache in the
 * shop would drop it, and this one would carry on using the old voice until
 * its own timer happened to lapse. Going through settingsService puts it on
 * the same key the panel already invalidates, so an instruction typed in the
 * panel takes effect on the next message instead of up to thirty seconds
 * later. The TTL behind it is the same thirty seconds, so nothing is lost if
 * the invalidation never arrives.
 */
async function ownerInstructions() {
  try {
    return String((await settingsService.value('ai_instructions', '')) || '').trim();
  } catch (err) {
    logger.warn('ai.instructions_failed', { error: err.message });
    return '';
  }
}

/**
 * The shop's own name, for the voice the model writes in.
 *
 * Hardcoding "AESTHURA" here was wrong twice over: it is a fact, and facts
 * belong in settings where the owner can change them.
 */
async function shopName() {
  try {
    const name =
      (await settingsService.value('greeting_brands', null)) ||
      (await settingsService.value('business_name', null));
    const trimmed = String(name || '').trim();
    if (trimmed) return trimmed;
  } catch (err) {
    logger.warn('ai.shop_name_failed', { error: err.message });
  }
  return config.BUSINESS_NAME || 'the shop';
}

/**
 * Identical text is rewritten once and reused.
 *
 * The welcome message goes to every new customer; without this, 500 customers
 * would mean 500 paid calls for the same sentence. With it, one. Personalised
 * lines (a name, an order id) differ in the text itself, so they get their own
 * entries and stay personal.
 */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map();

// The owner's instructions are part of the key: edit them in the panel and
// the cached rewrites stop matching, so the new voice takes effect at once
// instead of six hours later.
const keyFor = (text, lang, extra) =>
  crypto.createHash('sha1').update(`${lang}|${extra}|${text}`).digest('hex');

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  // Refresh insertion order so hot entries survive eviction.
  cache.delete(key);
  cache.set(key, hit);
  return hit.text;
}

function cacheSet(key, text) {
  cache.set(key, { text, at: Date.now() });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

/**
 * The voice, taken from the shop's own sales memory: short, natural,
 * friendly, professional, one question at a time, and never pushy. The rules
 * about what may not change are what keep this a rewrite rather than a
 * second opinion.
 */
const SYSTEM = {
  hi: (shop) => [
    `Tum ${shop} ke maalik ho aur WhatsApp par khud customers se baat karte ho.`,
    'Tumhe ek taiyaar reply milega. Usko waise likho jaise ek asli dukaandaar bolta hai:',
    'chhote vaakya, garmjoshi, Hinglish (Roman script) me. Professional raho, over-friendly nahi.',
    '',
    'Kabhi mat karo:',
    '- koi bhi number, price, booking amount, size, order id, link ya address badalna ya jodna',
    '- koi nayi jaankari, offer, discount, delivery date ya vaada add karna',
    '- ek se zyada sawal poochna, ya koi aisa sawal jo diye gaye text me nahi tha',
    '- "jaldi karo", "jaldi bhejo", "sirf 2 bache hain" jaisa dabaav banana',
    '- koi bhi nayi line jodna jo diye gaye text me nahi thi - na nudge, na sign-off',
    '- wo cheez dobara poochna jo customer pehle hi bata chuka hai',
    '- koi extra baat, tareef, ya faltu jaankari jodna',
    '- reply ko lamba karna; utna hi rakho ya thoda chhota',
    '',
    'Designs ki list hai to wo list waise hi rehni chahiye - wahi naam, wahi rang.',
    'Sirf naya text likho, koi explanation nahi.',
  ].join('\n'),

  en: (shop) => [
    `You are the owner of ${shop}, replying to customers on WhatsApp yourself.`,
    'You will be given a prepared reply. Rewrite it the way a real shopkeeper says it:',
    'short sentences, warm, simple English. Professional, not over-familiar.',
    '',
    'Never:',
    '- change, drop or add any number, price, booking amount, size, order id, link or address',
    '- add new information, offers, discounts, delivery dates or promises',
    '- ask more than one question, or any question that was not in the given text',
    '- create urgency ("hurry", "send it quickly", "only 2 left") - the shop does not do that',
    '- add any line that was not in the given text - no nudges, no sign-offs',
    '- ask again for something the customer has already told you',
    '- add small talk, praise, or any information they did not ask for',
    '- make the reply longer; keep it the same length or shorter',
    '',
    'If there is a list of designs, keep it as a list - same names, same colours.',
    'Reply with the rewritten text only, no explanation.',
  ].join('\n'),
};

const digits = (text) => new Set(String(text).match(/\d+/g) || []);
const urls = (text) => String(text).match(/https?:\/\/\S+/gi) || [];

/**
 * Lines that are a field label and nothing else: "Name:", "PIN Code:".
 *
 * These are a form, not prose. The customer fills them in and the parser
 * reads the answer back off the labels, so a rewrite that turns them into a
 * sentence ("send me your name, address and city") costs a real order.
 */
const labelLines = (text) =>
  String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    // At most two words, so "Full Address:" counts but an ordinary sentence
    // that happens to end in a colon ("Details bhej do:") does not - that one
    // is prose and the model is free to reword it.
    .filter((line) => /^[\p{L}]+(?:[ \-/][\p{L}]+)?:$/u.test(line) && line.length <= 20);

/**
 * The gate. Returns true only if the rewrite says the same facts as the
 * original. Deliberately blunt: when in doubt, reject and send the template.
 */
function verify(original, rewritten) {
  if (!rewritten || rewritten.length < 2) return false;

  // Length: a rewrite that grew a lot has almost certainly added something.
  if (rewritten.length > original.length * 1.8 + 40) return false;

  /**
   * And one that collapsed has lost the message.
   *
   * "Bhai naam thoda sahi se likh do (sirf naam) 🙏" came back as "Aesthura".
   * Nothing else here catches that - no numbers, no links, no labels - but a
   * reply that is a third of its original length is not a rewording.
   */
  // A third of the length is the line: "REP-1001 confirm ✅" for a longer
  // sentence is a good tightening, "Aesthura" for a whole question is not.
  if (original.length > 25 && rewritten.length < original.length * 0.35) return false;

  // Numbers: every number in the original must survive, and no new number may
  // appear. This is what stops an invented price, quantity or order id.
  const before = digits(original);
  const after = digits(rewritten);
  for (const value of before) if (!after.has(value)) return false;
  for (const value of after) if (!before.has(value)) return false;

  // Links must be byte-identical - a payment link is not a place for creativity.
  const originalUrls = urls(original);
  for (const url of originalUrls) if (!rewritten.includes(url)) return false;
  if (urls(rewritten).length !== originalUrls.length) return false;

  /**
   * A question stays a question.
   *
   * "Which size?" came back as "S, M, L, XL, XXL." - the list survived, the
   * asking did not, and a customer who is told something rather than asked
   * something has no idea it is their turn.
   */
  if (original.includes('?') && !rewritten.includes('?')) return false;

  // A form stays a form. Every field label must survive as its own line.
  const labels = labelLines(original);
  if (labels.length) {
    const rewrittenLabels = labelLines(rewritten);
    for (const label of labels) if (!rewrittenLabels.includes(label)) return false;
  }

  return true;
}

/**
 * @param {string} text  the template's reply
 * @param {string} lang  'hi' (Hinglish) or 'en'
 * @param {string} phone for usage accounting only
 * @returns {Promise<string>} the rewrite, or the original text unchanged
 */
/**
 * @param {string} text     what the rule engine decided to say
 * @param {string} lang     'hi' | 'en'
 * @param {string} phone
 * @param {object} [ctx]
 * @param {string} [ctx.phase]   where the conversation is, in plain words
 * @param {string[]} [ctx.history] last few turns, oldest first
 * @param {string} [ctx.known]   what the customer has already told us
 */
async function humanise(text, lang = 'hi', phone = null, ctx = {}) {
  const original = String(text || '');
  if (!original.trim() || !client.isConfigured()) return original;

  const language = lang === 'en' ? 'en' : 'hi';
  const extra = await ownerInstructions();

  /**
   * The phase is part of the cache key, the transcript is not.
   *
   * The same sentence said at two different points in an order should not
   * read identically, so the phase changes the key. Including the whole
   * transcript would make every key unique and turn a cached rewrite into a
   * paid one on every single message.
   */
  /**
   * The phase and what the customer has already told us are part of the key;
   * the transcript deliberately is not.
   *
   * The same sentence said at two different points in an order should not
   * read identically, and "they have already given their city" changes what
   * the model may say. Both are stable for the length of a step, so the cache
   * still works. The transcript is different in every single message - folding
   * it in would make every key unique and turn a cached rewrite into a paid
   * one on every message, which is the opposite of the point.
   */
  const known = String(ctx.known || '');
  const key = keyFor(original, language, `${extra}|${await shopName()}|${ctx.phase || ''}|${known}`);

  const cached = cacheGet(key);
  if (cached) return cached;

  // The owner's words go last so they read as an addition to the house
  // rules, not a replacement for them - and the verify() gate applies either
  // way, so nothing typed in the panel can loosen the safety checks.
  // The shop's name comes from settings, like every other fact it states.
  const base = SYSTEM[language](await shopName());
  const system = extra ? `${base}\n\nShop owner's own instructions:\n${extra}` : base;

  /**
   * The text is fenced and labelled, not handed over bare.
   *
   * Bare, the model sometimes read the reply as a message addressed to it and
   * answered instead of rewriting: "Bhai naam thoda sahi se likh do" came
   * back as "Aesthura" - the shop's name, an answer to a question nobody
   * asked - and "Address bhej do" became "main address share nahi kar sakta",
   * which says the opposite of what the shop meant. Fencing removes the
   * ambiguity about whose words these are.
   */
  /**
   * The guard runs inside the call so the ledger records WHY a rewrite was
   * thrown away. The checks themselves are untouched - verify() is the same
   * function it has always been, called on the same cleaned text.
   */
  let cleaned = null;
  let rejected = false;

  const rewritten = await client.complete({
    purpose: 'humanise',
    phone,
    system,
    /**
     * The phase and the known facts were being assembled on every single
     * message and then never used - the model saw one isolated line and wrote
     * like a form letter because that is all it had. They are facts ABOUT the
     * conversation, so they sit outside the fence where they cannot be
     * mistaken for text to rewrite.
     *
     * No address, no city, no PIN, no phone number: `known` carries flags
     * rather than values, and the shop's own words are the only thing inside
     * the fence.
     */
    user: [
      ...(ctx.phase ? [`The customer is ${ctx.phase}.`] : []),
      ...(known ? [`They have already given: ${known}. Never ask for these again.`] : []),
      ...(ctx.phase || known ? [''] : []),
      'Rewrite the shop reply between the markers. It is the shop talking to a',
      'customer - never a question for you to answer. Output only the rewrite.',
      '',
      '<<<REPLY',
      original,
      'REPLY>>>',
    ].join('\n'),
    temperature: 0.8,
    // Enough for any of our replies, and a cap on what a runaway costs.
    maxTokens: Math.min(600, Math.ceil(original.length / 2) + 120),
    verify: (raw) => {
      // Models sometimes hand the fence back with the text inside it. Strip
      // it rather than reject: the rewrite itself is usually perfectly good.
      cleaned = raw
        .split(/\r?\n/)
        // Whole-line markers only: "<<<REPLY", "REPLY>>>", or a stray "REPLY"
        // the model left behind. One of those reached a customer at the end
        // of an order summary.
        .filter((line) => !/^\s*(<<<\s*)?REPLY(\s*>>>)?\s*$/i.test(line))
        .join('\n')
        .trim();

      if (verify(original, cleaned)) return null;
      rejected = true;
      return 'guard_failed';
    },
  });

  if (rejected) {
    logger.warn('ai.humanise_rejected', {
      action: `${original.length}->${(cleaned || '').length}`,
      message: (cleaned || '').slice(0, 120),
    });
    // Cache the original against this key: the same template just failed
    // verification, and paying to fail again on the next customer is waste.
    cacheSet(key, original);
    return original;
  }

  // Model unavailable, budget spent, or a timeout - nothing to cache.
  if (!rewritten || !cleaned) return original;

  cacheSet(key, cleaned);
  return cleaned;
}

// ownerInstructions is exported for the cache-invalidation test, which has to
// prove that a panel edit reaches the model without waiting out a timer.
module.exports = { humanise, verify, ownerInstructions, shopName };
