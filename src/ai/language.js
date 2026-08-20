'use strict';

/**
 * Which language a message is in, when the word lists cannot tell.
 *
 * The rule detector in src/bot/language.js is fast and free and right most of
 * the time, but it can only recognise words someone thought to list. "Hi",
 * "yo", "bro u have hoodies" and "kuch dikhao" all fall through it - and
 * answering an English customer in Hinglish is exactly the thing that makes a
 * shop look automated.
 *
 * So: rules first, model only for what is left. In practice that is the first
 * message of a conversation and nothing else, because the answer is then
 * stored and the conversation stays in that language.
 *
 * Answers are cached by text, so the hundredth customer who opens with "Hi"
 * costs nothing.
 */

const logger = require('../logger');
const client = require('./client');

const CACHE_MAX = 300;
const cache = new Map();

const SYSTEM = [
  'You label the language of a WhatsApp message sent to an Indian online shop.',
  '',
  '"hi"  = Hindi or Hinglish - Hindi words written in Latin script counts',
  '        ("kya hai", "bhej do", "kitne ka hai"), as does Devanagari.',
  '"en"  = plain English, including short English greetings ("Hi", "Hello", "Hey").',
  'null  = impossible to tell: a number, one letter, an emoji, a size like "XL".',
  '',
  'Answer as JSON: {"lang": "hi"} or {"lang": "en"} or {"lang": null}',
].join('\n');

const keyOf = (text) => String(text).trim().toLowerCase().slice(0, 80);

/**
 * @returns {Promise<'hi'|'en'|null>} null when it cannot be told, which
 *          leaves the caller's own default in charge.
 */
async function classify(text) {
  const message = String(text || '').trim();
  if (!message || !client.isConfigured()) return null;

  // A long message will have been settled by the rules already; if it was
  // not, it is not worth paying to guess at.
  if (message.length > 300) return null;

  const key = keyOf(message);
  if (cache.has(key)) return cache.get(key);

  const answer = await client.complete({
    purpose: 'language',
    system: SYSTEM,
    user: message,
    json: true,
    temperature: 0,
    maxTokens: 16,
  });

  let lang = null;
  if (answer) {
    try {
      const parsed = JSON.parse(answer).lang;
      if (parsed === 'hi' || parsed === 'en') lang = parsed;
    } catch (err) {
      logger.warn('ai.language_unparsable', { message: answer.slice(0, 60) });
    }
  }

  cache.set(key, lang);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);

  if (lang) logger.info('ai.language', { action: lang, message: message.slice(0, 40) });
  return lang;
}

module.exports = { classify };
