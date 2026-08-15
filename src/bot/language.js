'use strict';

/**
 * Which language to answer a customer in.
 *
 * Rule based, like the rest of Repli - no AI, no API call.
 *
 * The important design choice is that the decision is **sticky**: it is taken
 * from the first message that actually carries a signal, stored on the
 * conversation, and then left alone. Half the words in this business are
 * identical in both languages ("ok", "yes", "M", "2", "black"), so a detector
 * that re-decides on every message would flip mid-chat and make the bot look
 * broken. A customer who opens in English gets English until they clearly
 * switch back.
 */

const HINDI_SCRIPT = /[ऀ-ॿ]/;

/**
 * Hinglish given away in Latin script. Deliberately words that an English
 * sentence would not contain - "hai", "chahiye", "bhai", "kitna".
 */
const HINGLISH_WORDS = [
  'hai', 'hain', 'haan', 'nahi', 'nhi', 'chahiye', 'chahie', 'chaiye',
  'bhai', 'bhaiya', 'yaar', 'kya', 'kitna', 'kitne', 'kitni', 'kaise',
  'kaisa', 'kaun', 'kaunsa', 'mujhe', 'mera', 'meri', 'aap', 'aapka',
  'karo', 'kar', 'karna', 'karunga', 'dedo', 'dena', 'bhejo', 'bhej',
  'lena', 'lunga', 'milega', 'milegi', 'batao', 'bata', 'accha', 'acha',
  'theek', 'thik', 'sahi', 'abhi', 'phir', 'thoda', 'zyada', 'paisa',
  'paise', 'rupay', 'rupaye', 'order', 'krna', 'kro', 'hoga', 'hogi',
  'ji', 'na', 'ye', 'yeh', 'wo', 'woh', 'iska', 'uska', 'kal', 'aaj',
];

/**
 * English function words. A real English sentence almost always has one.
 * Product nouns are excluded on purpose - "black bag" is not evidence,
 * a Hinglish speaker writes that too.
 */
const ENGLISH_WORDS = [
  'i', 'you', 'the', 'is', 'are', 'am', 'do', 'does', 'did', 'want',
  'need', 'please', 'can', 'could', 'would', 'will', 'have', 'has',
  'how', 'much', 'what', 'when', 'where', 'which', 'this', 'that',
  'there', 'my', 'your', 'me', 'send', 'give', 'tell', 'available',
  'price', 'cost', 'order', 'buy', 'delivery', 'thanks', 'thank',
  'hello', 'hey', 'yes', 'no', 'ok', 'okay', 'sure', 'and', 'for',
  'with', 'about', 'from', 'it', 'its', 'looking', 'interested',
];

const LANGUAGES = { HINGLISH: 'hi', ENGLISH: 'en' };
const DEFAULT_LANGUAGE = LANGUAGES.HINGLISH;

/** Words that are evidence on their own, not just noise. */
const STRONG_ENGLISH = new Set([
  'i', 'you', 'the', 'is', 'are', 'want', 'need', 'please', 'available',
  'how', 'much', 'what', 'delivery', 'interested', 'looking', 'thanks',
]);

function words(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-zऀ-ॿ\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Returns 'hi', 'en', or null when the message carries no signal either way
 * ("ok", "2", "M", "black"). null means: do not change anything.
 */
function detect(text) {
  const raw = String(text || '');
  if (HINDI_SCRIPT.test(raw)) return LANGUAGES.HINGLISH;

  const list = words(raw);
  if (!list.length) return null;

  const hinglish = list.filter((word) => HINGLISH_WORDS.includes(word)).length;
  const english = list.filter((word) => ENGLISH_WORDS.includes(word)).length;
  const strongEnglish = list.filter((word) => STRONG_ENGLISH.has(word)).length;

  // Any Hinglish marker wins: "black tshirt chahiye" is Hinglish even though
  // two of its three words are English.
  if (hinglish > 0) return LANGUAGES.HINGLISH;

  // English needs either a strong marker or a couple of weak ones, so a bare
  // "ok" or "yes" is not enough to switch the whole conversation.
  if (strongEnglish > 0 || english >= 2) return LANGUAGES.ENGLISH;

  return null;
}

/**
 * The sticky rule. `stored` is whatever the conversation already decided.
 * Once a language is set, only a clear signal in the other language changes
 * it - and short/ambiguous messages never do.
 */
function resolve(stored, text) {
  const detected = detect(text);
  if (!stored) return detected || DEFAULT_LANGUAGE;
  if (!detected) return stored;
  return detected;
}

module.exports = { detect, resolve, LANGUAGES, DEFAULT_LANGUAGE };
