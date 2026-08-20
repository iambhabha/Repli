'use strict';

/**
 * Reads a payment screenshot, and does not believe it.
 *
 * A customer sends the PhonePe screen, waits, and hears nothing until an
 * admin has looked. In the meantime the shop appears to have ignored them,
 * which is the moment people start sending "bhai?" every two minutes. What
 * they want is to know it arrived and that somebody is checking.
 *
 * So this reads the amount off the picture and the shop repeats it back:
 * "₹500 dikha hai, confirm karke batata hoon". That is a receipt for the
 * MESSAGE, never for the money.
 *
 * The distinction is the whole point of this file:
 *
 *   - Nothing here changes an order, a payment row, or a status. Not one
 *     write. Confirming a payment stays where it has always been - an admin
 *     saying so, through confirm_order_payment.
 *   - What comes back is described to the customer as what the picture
 *     SHOWS, never as what the shop has received. A screenshot is a picture
 *     of a claim; it can be edited, it can be of somebody else's transfer,
 *     and it can be last week's.
 *   - Anything the model returns that is not a plain number is thrown away.
 *     A misread amount repeated back with confidence is worse than saying
 *     nothing, so an unreadable screenshot simply produces no number and the
 *     customer gets the old acknowledgement.
 *
 * The reading is passed to the admin too, because the admin is the one who
 * has to check it, and "the picture says 500" is a useful thing to be told
 * before opening it.
 */

const logger = require('../logger');
const client = require('./client');

/** Screenshots are phone-sized. Anything larger is not one. */
const MAX_BYTES = 5 * 1024 * 1024;

const SYSTEM = [
  'You read Indian payment screenshots - PhonePe, Google Pay, Paytm, BHIM,',
  'bank apps - and report only what is printed on them.',
  '',
  'Return JSON:',
  ' amount    the rupee figure PAID, digits only, no symbol or commas.',
  '           null if you cannot read one with certainty.',
  ' status    "success" | "pending" | "failed" | null - only if the screen',
  '           says so in words.',
  ' reference the UPI transaction / UTR id, exactly as printed. null if absent.',
  ' app       which app it is from, if the screen names it. null otherwise.',
  ' looksLikePayment  true only if this really is a payment confirmation',
  '                   screen. false for anything else - a product photo, a',
  '                   chat screenshot, a selfie, a blank image.',
  '',
  'Read, do not infer. If a field is not legible, it is null. Never guess an',
  'amount from context, and never round one. Reply with the JSON only.',
].join('\n');

/**
 * Whole-object validation, in the same spirit as ai/converse.js: a model that
 * invented one field has demonstrated it was guessing, and the rest is not
 * more trustworthy for being well formed.
 *
 * @returns {{value: object}|{reason: string}}
 */
function validate(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { reason: 'unparsable' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { reason: 'not_an_object' };
  }

  if (parsed.looksLikePayment !== true && parsed.looksLikePayment !== false) {
    return { reason: 'bad_looks_like_payment' };
  }

  let amount = null;
  if (parsed.amount !== null && parsed.amount !== undefined && parsed.amount !== '') {
    const digits = String(parsed.amount).replace(/[,\s₹]/g, '');
    /**
     * Digits and at most two decimals. A model that answered "around 500" or
     * "500-1000" has not read anything, and repeating either to a customer
     * would be worse than staying quiet.
     */
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(digits)) return { reason: 'bad_amount' };
    amount = Number(digits);
    if (!Number.isFinite(amount) || amount <= 0) return { reason: 'bad_amount' };
  }

  const status = parsed.status === undefined ? null : parsed.status;
  if (status !== null && !['success', 'pending', 'failed'].includes(status)) {
    return { reason: 'bad_status' };
  }

  /** A reference is copied off the screen, so it is short and boring. */
  let reference = null;
  if (parsed.reference) {
    const text = String(parsed.reference).trim();
    if (text && text.length <= 40 && /^[A-Za-z0-9\-_/]+$/.test(text)) reference = text;
  }

  let app = null;
  if (parsed.app) {
    const text = String(parsed.app).trim();
    if (text && text.length <= 20) app = text;
  }

  return {
    value: {
      amount,
      status,
      reference,
      app,
      looksLikePayment: parsed.looksLikePayment,
    },
  };
}

/**
 * @param {object} input
 * @param {Buffer} input.buffer    the screenshot, already downloaded
 * @param {string} input.mimetype
 * @param {string} [input.phone]   for the usage ledger only
 * @returns {Promise<object|null>} what the picture shows, or null
 */
async function read({ buffer, mimetype, phone = null }) {
  if (!client.isConfigured()) return null;
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_BYTES) return null;

  // A PDF bank receipt is a valid proof and is not something to send to a
  // vision model; it goes down the unchanged path.
  if (!String(mimetype || '').toLowerCase().startsWith('image/')) return null;

  let accepted = null;

  const answer = await client.complete({
    purpose: 'proof',
    phone,
    system: SYSTEM,
    json: true,
    // Reading, not writing. There is nothing here to be creative about.
    temperature: 0,
    maxTokens: 150,
    image: { buffer, mimetype },
    user: 'What does this screenshot show?',
    verify: (raw) => {
      const result = validate(raw);
      if (result.reason) return result.reason;
      accepted = result.value;
      return null;
    },
  });

  if (!answer || !accepted) return null;

  logger.info('ai.proof', {
    phone,
    action: [
      accepted.looksLikePayment ? 'payment' : 'not-a-payment',
      accepted.amount === null ? 'amount=?' : `amount=${accepted.amount}`,
      accepted.status && `status=${accepted.status}`,
      accepted.reference ? 'ref=yes' : 'ref=no',
    ]
      .filter(Boolean)
      .join(' '),
  });

  return accepted;
}

module.exports = { read, validate, MAX_BYTES };
