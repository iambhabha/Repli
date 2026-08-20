'use strict';

/**
 * What the model is not allowed to see.
 *
 * The shop's own facts - prices, sizes, stock - are exactly what a model
 * needs and are safe to send. A customer's postal address is neither. It is
 * useless for choosing words, it is the single most sensitive thing the shop
 * holds, and it is also text the customer typed, which makes it the obvious
 * way to try to talk the model into something.
 *
 * The order summary and the saved-address message already never reach the
 * API: they are sent with `raw: true`. This file closes the other door - the
 * transcript. A customer who types their address and then asks a question
 * would otherwise have that address travel to OpenAI inside "recent
 * messages", for a cosmetic rewrite.
 *
 * The rule here is deliberately blunt: when in doubt, replace it with a
 * signal. "The customer has given their address" is everything the model
 * needs to know; the address itself is not its business.
 */

/**
 * Applied to anything quoted back from a customer.
 *
 * Order matters: an email/UPI id is matched before the digits inside it can
 * be mistaken for a phone number.
 */
const PATTERNS = [
  // rahul@okhdfc, someone@example.com - UPI ids and email addresses alike
  [/[\w.+-]+@[\w.-]+\.?[\w-]*/g, '(id)'],
  // +91 98765 43210, 09876543210, 9876-543-210
  [/\+?\d[\d\s-]{8,}\d/g, '(number)'],
  // A standalone six digit block is an Indian PIN code far more often than
  // it is anything else a customer types.
  [/\b\d{6}\b/g, '(pin)'],
];

/** Strip the obviously personal out of one piece of customer text. */
function text(value) {
  let out = String(value == null ? '' : value);
  for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement);
  return out;
}

/**
 * Does this look like somebody's address?
 *
 * Several digits plus either a comma or a long line: "12 xyz road, Andheri
 * West, Mumbai 400058". Deliberately generous - a false positive costs the
 * model one line of context, a false negative sends a real address to a
 * third party.
 */
function looksLikeAddress(value) {
  const body = String(value || '');
  const digits = (body.match(/\d/g) || []).length;
  if (digits < 4) return false;
  return body.includes(',') || body.includes('\n') || body.split(/\s+/).length >= 8;
}

const CUSTOMER_LINE = /^customer:\s*/i;

/**
 * Clean up a transcript before it is handed to a model.
 *
 * @param {string[]} lines        "customer: …" / "shop: …", oldest first
 * @param {object}   [options]
 * @param {boolean}  [options.detailsPhase]  the conversation is at or past
 *        the point where the customer is handing over delivery details, so
 *        their recent lines are address material by definition
 * @returns {string[]}
 */
function history(lines, { detailsPhase = false } = {}) {
  return (lines || []).map((raw) => {
    const line = String(raw || '');
    const fromCustomer = CUSTOMER_LINE.test(line);
    if (!fromCustomer) return text(line);

    const body = line.replace(CUSTOMER_LINE, '');
    if (detailsPhase || looksLikeAddress(body)) {
      // The signal, not the data.
      return 'customer: (shared their delivery details)';
    }
    return `customer: ${text(body)}`;
  });
}

/**
 * What the customer has already told us, as facts a model may repeat and
 * flags for the ones it may not.
 *
 * Colour and size are the shop's own vocabulary and are safe to state back.
 * A name, a city and a PIN are the customer's, and the only thing the model
 * needs to know about them is that it must not ask again.
 *
 * @param {object} draft  the order draft off the conversation row
 * @param {object} [extra] colour/size already chosen
 * @returns {string} a short phrase, or ''
 */
function known(draft = {}, extra = {}) {
  const parts = [
    extra.color && `colour ${extra.color}`,
    extra.size && `size ${extra.size}`,
    draft.name && 'their name (already given - do not ask again)',
    draft.address && 'their address (already given - do not ask again)',
    draft.city && 'their city (already given - do not ask again)',
    draft.pin && 'their PIN code (already given - do not ask again)',
  ].filter(Boolean);

  return parts.join(', ');
}

module.exports = { text, history, known, looksLikeAddress };
