'use strict';

/**
 * Reads a message the rule parser could not.
 *
 * The parser knows "kala", "black", "blk". It does not know "wo raat wala
 * rang", "jo photo me tha", "bhaiya andhera wala". That is the gap this fills.
 *
 * Crucially it does not answer the customer and it does not decide anything.
 * It picks one item out of a list the caller already had - a colour the shop
 * actually stocks, a size the product actually has - and hands that back so
 * the existing state machine can carry on exactly as if the customer had
 * typed it plainly. Anything not on the list is thrown away.
 */

const logger = require('../logger');
const client = require('./client');

const SYSTEM = [
  'You map a WhatsApp shopping message to one option from a fixed list.',
  'The customer writes Hinglish, Hindi or English, often casually or with typos.',
  '',
  'Rules:',
  '- Choose only from the given options, copied exactly as written.',
  '- If the message does not clearly point at exactly one option, choose null.',
  '- Never guess to be helpful. A wrong guess costs the shop an order; null is safe.',
  '',
  'Answer as JSON: {"choice": "<option>"} or {"choice": null}',
].join('\n');

/**
 * @param {object}   input
 * @param {string}   input.text      what the customer wrote
 * @param {string}   input.question  what we asked them, in plain words
 * @param {string[]} input.options   the only acceptable answers
 * @param {string}   [input.phone]
 * @returns {Promise<string|null>} one of `options`, or null
 */
async function pick({ text, question, options, phone = null }) {
  const list = (options || []).map(String).filter(Boolean);
  const message = String(text || '').trim();
  if (!message || list.length === 0 || !client.isConfigured()) return null;

  // Very long messages are almost never a one-word answer, and they cost more.
  if (message.length > 400) return null;

  /**
   * The list check runs inside the call so an off-list answer is recorded
   * with its reason. "choice": null is NOT a rejection - it is the model
   * correctly declining to guess, which is the behaviour we want.
   */
  let choice = null;

  const answer = await client.complete({
    purpose: 'understand',
    phone,
    verify: (raw) => {
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        return 'unparsable';
      }
      if (parsed.choice === null || parsed.choice === undefined) return null;

      const wanted = String(parsed.choice).trim().toLowerCase();
      const match = list.find((option) => option.toLowerCase() === wanted);
      if (!match) return 'off_list';
      choice = match;
      return null;
    },
    system: SYSTEM,
    json: true,
    temperature: 0,
    maxTokens: 40,
    user: [
      `Shop asked: ${question}`,
      `Options: ${JSON.stringify(list)}`,
      `Customer wrote: ${JSON.stringify(message)}`,
    ].join('\n'),
  });

  // The model may echo a different case or add whitespace; anything that is
  // not one of our own strings was already discarded rather than corrected.
  if (!answer || !choice) return null;

  logger.info('ai.understood', { message: `${message.slice(0, 40)} -> ${choice}` });
  return choice;
}

module.exports = { pick };
