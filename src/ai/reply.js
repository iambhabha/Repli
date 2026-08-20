'use strict';

/**
 * Writes the reply when the script runs out.
 *
 * Everywhere else the AI only rewords a line the rule engine already chose.
 * This is the one place it composes - and it exists because of a real
 * transcript where it was badly needed:
 *
 *   customer: "Yeh kya h"        bot: "samajh nahi aaya, 1 ya 2 bhejo"
 *   customer: "Reffund"          bot: "samajh nahi aaya, 1 ya 2 bhejo"
 *   customer: "Kitna wait"       bot: "verify ho raha hai" (x4, identical)
 *   customer: "No" (x12)         bot: same address prompt (x12)
 *
 * Every one of those is a person asking something real and being handed a
 * menu. So when the flow has nothing better than "I did not understand",
 * the model is given the facts, the phase, and the last few turns, and asked
 * to answer like the shopkeeper would.
 *
 * What it is NOT allowed to do is decide anything. It gets no ability to
 * change state; the numbers it may use are handed to it and checked on the
 * way out. Anything that fails the check falls back to the template, which
 * is exactly what would have been sent anyway.
 */

const logger = require('../logger');
const client = require('./client');

const SYSTEM = [
  'You are the owner of an Indian clothing shop, replying on WhatsApp.',
  'A customer has said something the ordering script could not place. Write',
  'the single message you would send back.',
  '',
  'You will be given: the shop facts, what the conversation is waiting for,',
  'and the last few messages.',
  '',
  'Rules, all of them absolute:',
  '- Use ONLY the facts given. If the answer is not in them, say you will',
  '  check and that someone from the team will confirm - never guess.',
  '- Never state a price, size, stock level, date or amount that is not in',
  '  the facts. Never offer a discount, a refund, or free delivery.',
  '- One short message. Two or three lines. One question at most.',
  '- If the conversation is waiting for something (an address, a size), end',
  '  by asking for that one thing again, in different words than last time.',
  '- Match the customer\'s language: Hinglish in Latin script for Hinglish,',
  '  English for English.',
  '- No greeting unless they greeted. No sign-off. No emoji spam.',
  '',
  '- NEVER say something has already happened. You may ask and you may offer',
  '  ("Book kar du?", "Kaunsa size chahiye?"), but never "aapne chun liya",',
  '  "you have selected", "photo bhej raha hoon", "order confirm ho gaya".',
  '  You are not the part of the shop that does those things.',
  '',
  'Reply with the message text only.',
].join('\n');

/** Numbers the model is allowed to repeat, taken from the facts we gave it. */
function allowedNumbers(facts) {
  return new Set(String(facts).match(/\d+/g) || []);
}

/**
 * Things only the state machine may say, because only it can make them true.
 *
 * This was found in the first real customer conversation, and it is the worst
 * bug the shop has had. The customer typed "Red", then "Xxl", and got back:
 *
 *   "You've chosen the Spider-Man design! Confirm the size..."
 *   "You've selected XXL for Spider-Man. Proceed with booking?"
 *
 * The conversation state never moved - both turns logged
 * SELECT_PRODUCT → SELECT_PRODUCT. Nothing was chosen, no size was stored, no
 * order existed. The model was narrating an order that was not being placed,
 * and the customer was answering it. Then it said "photo bhej raha hoon" and
 * sent nothing.
 *
 * The existing guards could not catch any of it: there were no invented
 * numbers and no links, because the lie was not in the figures. It was in the
 * verbs.
 *
 * So a composed reply may ASK for anything and OFFER anything - "book kar
 * du?", "kaunsa size chahiye?" are exactly what it is for - but it may not
 * report that something has already happened. Those sentences belong to the
 * code that actually did it.
 */
const CLAIMS_AN_ACTION = [
  // "you have chosen / selected / picked"
  /\byou(?:'ve| have)\s+(?:chosen|selected|picked|added|booked|ordered|confirmed)\b/i,
  /\bhas been (?:selected|chosen|booked|confirmed|placed|added|reserved)\b/i,
  /\baap ?ne\s+\w*\s*(?:chun|select|book|order)/i,
  /\b(?:chun|select|book|order|reserve)\w*\s+(?:liya|kiya|kar liya|ho gaya|ho gayi)\b/i,

  // "I am sending / I'll send / sent" - the composer never sends anything
  /\b(?:sending|i(?:'ll| will) send|i(?:'ve| have) sent|sent you)\b/i,
  /\bbhej\s*(?:raha|rahi|diya|di|dunga|dungi|deta|deti)\b/i,
  /\bshare\s*(?:kar\s*)?(?:raha|rahi|diya|di|dunga)\b/i,
  /\battach\s*(?:kar\s*)?(?:diya|di|raha)\b/i,

  // order / payment state, which only the database decides
  /\border\s*(?:place|placed|ban gaya|ho gaya|confirm)/i,
  /\bbooking\s*(?:confirm|ho gayi|ho gaya|done)\b/i,
  /\bpayment\s*(?:mil gaya|receive|received|ho gaya|confirm)/i,
  /\bpaisa\s*(?:mil gaya|aa gaya)\b/i,
  /\b(?:add|added)\s+to\s+(?:your\s+)?(?:cart|order)\b/i,
];

/** True when the reply reports something the model cannot have done. */
function claimsAnAction(text) {
  return CLAIMS_AN_ACTION.some((pattern) => pattern.test(text));
}

/**
 * The gate, in the same spirit as humanise.verify(): a composed reply may
 * only contain numbers it was given, may never contain a link, and may never
 * claim that something has already been done.
 */
function safe(text, facts) {
  const body = String(text || '').trim();
  if (!body || body.length < 2 || body.length > 700) return false;
  if (/https?:\/\//i.test(body)) return false;

  // The verbs, not just the figures.
  if (claimsAnAction(body)) return false;

  const allowed = allowedNumbers(facts);
  for (const number of body.match(/\d+/g) || []) {
    if (!allowed.has(number)) return false;
  }
  return true;
}

/**
 * @param {object}   input
 * @param {string}   input.text      what the customer just said
 * @param {string}   input.phase     plain-language description of where they are
 * @param {string}   [input.needed]  the one thing we are waiting for
 * @param {string}   input.facts     everything the shop may state, from the database
 * @param {string[]} [input.history] last few lines, oldest first
 * @param {string}   [input.phone]
 * @returns {Promise<string|null>} the message, or null to use the template
 */
async function compose({ text, phase, needed = '', facts, history = [], phone = null }) {
  if (!client.isConfigured()) return null;
  const message = String(text || '').trim();
  if (!message) return null;

  // Same guard, moved inside the call so a rejection is recorded with its
  // reason rather than only logged.
  let cleaned = null;

  const written = await client.complete({
    purpose: 'reply',
    verify: (raw) => {
      cleaned = raw.replace(/^["'`]+|["'`]+$/g, '').trim();
      return safe(cleaned, facts) ? null : 'unsafe_reply';
    },
    phone,
    system: SYSTEM,
    temperature: 0.5,
    maxTokens: 220,
    user: [
      'SHOP FACTS (the only things you may state):',
      facts,
      '',
      `CONVERSATION PHASE: ${phase}`,
      needed ? `WAITING FOR: ${needed}` : 'WAITING FOR: nothing in particular',
      '',
      history.length ? `RECENT MESSAGES:\n${history.join('\n')}` : '',
      '',
      `CUSTOMER JUST SAID: ${JSON.stringify(message)}`,
    ]
      .filter(Boolean)
      .join('\n'),
  });

  if (!written || !cleaned) {
    if (cleaned) logger.warn('ai.reply_rejected', { message: cleaned.slice(0, 120) });
    return null;
  }

  logger.info('ai.reply', { action: phase, message: cleaned.slice(0, 60) });
  return cleaned;
}

module.exports = { compose, safe, claimsAnAction };
