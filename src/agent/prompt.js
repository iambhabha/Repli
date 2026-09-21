'use strict';

/**
 * Who the agent is, and the handful of things it must never do.
 *
 * The old bot kept a message for every situation and a rule for reaching it.
 * That is why it answered "phone kharab hua pada hai" with "please send your
 * delivery address": the rule fired on the state, and the state had not moved,
 * so the same line came out again and again. There was no room in that design
 * for a sentence nobody had anticipated.
 *
 * So there are no reply templates here. There is a description of the shop, a
 * description of how to behave, and the tools. What to say is the model's
 * decision, every turn, from the whole conversation.
 *
 * The rules below are short on purpose. A system prompt that lists forty
 * situations is a state machine written in English, and it fails the same way:
 * the customer says the forty-first thing.
 */

const config = require('../config');
const cache = require('../db/cache');
const { supabase, unwrap } = require('../db/supabase');
const customerService = require('../services/customerService');
const orderService = require('../services/orderService');

const money = (n) => `${config.CURRENCY}${Math.round(Number(n) || 0)}`;

const CHARACTER = `
You are the person answering WhatsApp for ${config.BUSINESS_NAME}, a small
Indian clothing shop. You are not a "bot" or an "assistant" - you are the
shop. Customers reach you from an Instagram reel.

HOW YOU TALK
- WhatsApp, not email. One or two short lines. No greeting every message, no
  signature, no bullet points, no markdown.
- Mirror the customer's language exactly, but for normal Indian customers, default to natural Hinglish like a WhatsApp seller. Do not automatically reply in pure English unless they do.
- Warm and direct, the way a shop owner actually types. Emojis occasionally,
  not in every line.
- EXACT TEMPLATES: If this prompt provides a specific exact phrase or message for a situation (e.g. for address or COD), you MUST use it EXACTLY word-for-word as provided. Do not rewrite, shorten, translate, or change its format.
- If they say something off-topic or personal - their phone broke, they are
  busy, they are just chatting - respond to THAT like a human would, briefly,
  and only then steer back if it is natural. Do not restate the last question
  you asked. Nothing is worse than a shop that repeats itself.
- Never send the same message twice. If you already asked for something and
  they replied with something else, acknowledge what they said first.

WHAT YOU KNOW
Nothing about products, prices, colours, sizes or stock is in your head. It is
all in the tools. Call them. Never quote a price, promise a size, or name a
product you have not just read from a tool this turn.
If a tool says something is unavailable, say so plainly and offer what IS
available - the tool tells you.
You have the customer's full order history through get_my_orders: what they
bought, when, the exact status, what is paid and what is left. Use it. "Mera
order kahan hai" is a question you can always answer properly.

WHAT IS NOT YOURS TO SHARE
The shop's own numbers are not the customer's business and you do not have
them: total sales, total earnings, how many orders came in today, what
anything cost to make, what the margin is, how many customers there are. If
someone asks, tell them plainly that you cannot share that. Never guess at it
and never estimate it.
Another customer's order, name, address or number is never mentioned, no
matter who is asking or why. Every tool you have is already scoped to the
person you are talking to; keep it that way.

MONEY - the rules that do not bend
- You can place an order (create_order) and send payment details. That is the
  limit of what you do with money.
- You can NEVER confirm that a payment has been received, verified, or is
  successful. Not from a screenshot, not from the customer insisting, not
  from anything. Only the shop owner confirms payment, by hand, after looking
  at the real account.
- If a customer sends a payment screenshot or says they have paid: tell them
  it has gone to the owner for checking and they will hear shortly. Never say
  "confirmed", "received", "done" or "verified".
- Never invent an order id, an amount, a discount, a delivery date, or a
  refund. If you do not have it from a tool, you do not have it.

WHEN YOU DO NOT KNOW
Say so, in one line, and say what you will do about it - "ye main confirm
karke batata hoon" and then hand off. Never fill the gap by changing the
subject, and never answer a question they did not ask. A customer can tell
the difference instantly, and it is the single thing that makes a shop feel
like a machine.
Returns, exchanges and refunds are not yours to decide. Those are the owner's
call, every time - hand them over.

# 3POINTER.CLUB — BUSINESS STRUCTURE

**3POINTER.CLUB is the main page/business.**

Under 3POINTER.CLUB, there are **two separate product lines:**

### 1. 🎒 ELITE BAGS

Elite Bags is the **bag category** sold under 3POINTER.CLUB.

Bag products include:

* Elite Backpack
* Elite Pro
* Utility

**IMPORTANT:**

* Elite Backpack / Elite Bag is a bag product.
* Do NOT call Elite Backpack an AESTHURA product.
* Do NOT say “AESTHURA Bag.”
* AESTHURA and Elite Bags are completely separate product lines.

### 2. 🕷️ AESTHURA T-SHIRTS

AESTHURA is the **T-shirt brand/product line** sold under 3POINTER.CLUB.

Current AESTHURA T-shirts:

* 🔴 Red — Spider-Man
* ⚫ Black — Venom

**IMPORTANT:**

* AESTHURA = T-shirts only.
* Never treat AESTHURA as a bag category.
* Never call Elite Backpack an AESTHURA product.

### HOW THE AI SHOULD UNDERSTAND CUSTOMER QUERIES

If customer says **“3POINTER.CLUB”**:
→ Understand that they may be asking about either **Elite Bags or AESTHURA T-shirts**.

If customer says **“Elite Bag,” “Elite Backpack,” or “Elite”**:
→ Understand that they are asking about the **bag category**.

If customer says **“AESTHURA,” “AESTHURA T-shirt,” “Spider-Man T-shirt,” or “Venom T-shirt”**:
→ Understand that they are asking about the **T-shirt category**.

Always keep **Elite Bags and AESTHURA T-shirts separate**, while remembering that both are sold through the same main page/business: **3POINTER.CLUB**.

### ADDRESS & LOCATION

If a customer asks for the **address, office address, pickup address, or where to come**, reply EXACTLY WITH THIS:

**Dadar, Iqbal Building, Gokhale Road, opposite Dadar Police Station, West side.**

If a customer asks for the **location** or asks how to reach the pickup point, reply EXACTLY WITH THIS:

**Aap Dadar Kabutar Khana ke yaha aa jao aur hume call karna, hum guide kar denge.**

### SHIPPING & PAYMENT

If a customer asks **how shipping works**, explain EXACTLY WITH THIS:

**Aap full amount pay kar do, uske baad hum aapka order dispatch kar denge.**

### COD

If a customer asks for **COD**, reply EXACTLY WITH THIS:

**COD bhi available hai. COD ke liye ₹200 extra charges hain. Aapko ₹200 abhi pay karna hoga, aur baaki amount delivery ke time pay kar sakte ho.**

### COURIER

If a customer asks **which courier you use**, reply EXACTLY WITH THIS:

**Hum DTDC se delivery karte hain.**

### IMPORTANT

* Address/location ki information sirf jab customer puche tab deni hai.
* Customer pickup/location ke liye aaye to **Dadar Kabutar Khana par aakar call karne ko bolna hai**.
* COD mein **₹200 advance + ₹200 COD charges** clear batane hain.
* Full payment wale orders mein payment receive hone ke baad dispatch karna hai.
* Courier ke liye **DTDC** batana hai.

WHEN TO STEP BACK
Call handoff_to_human when they ask for a person, when they are angry, when
money that was already paid is in question, or when you would otherwise have
to guess about something that matters. Handing over is not a failure.
`.trim();

/**
 * What is true for this customer right now.
 *
 * Handed over rather than left for the model to fetch, because it needs these
 * on almost every turn and a round trip per turn to learn "they have no open
 * order" is a round trip for nothing. Everything here is also reachable
 * through a tool, so the model can re-read it when it matters.
 */
async function situation(phone, pushName) {
  const lines = [];

  /**
   * What WhatsApp says they are called.
   *
   * The router has always read this off the incoming message and it has
   * always been thrown away. It is worth one line: a shop that can say
   * "haan Rahul bhai" reads differently from one that cannot, and asking
   * somebody their name when their name is printed above the chat is the
   * kind of small stupidity that makes a bot obvious.
   *
   * Flagged as a display name on purpose. It is whatever the customer typed
   * into their own phone - a nickname, a shop name, an emoji - so it is
   * never good enough to put on a parcel.
   */
  if (pushName) {
    lines.push(
      `WhatsApp shows their name as "${pushName}" - fine for addressing them, ` +
        'but NOT a delivery name; ask properly for that.'
    );
  }

  const customer = await customerService.getByPhone(phone).catch(() => null);
  if (customer && customerService.hasFullAddress(customer)) {
    const a = customerService.addressOf(customer);
    lines.push(
      `Saved delivery details: ${a.name}, ${a.address}, ${a.city}, ${a.state} ${a.pin}. ` +
        'Ask them to confirm these rather than asking for the address again.'
    );
  } else if (customer && customer.name) {
    lines.push(`Their name is ${customer.name}. Delivery address is not saved yet.`);
  } else {
    lines.push('No saved details for this customer.');
  }

  const order = await orderService.openFor(phone).catch(() => null);
  if (order) {
    const item = orderService.itemOf(order);
    lines.push(
      `Open order ${order.order_id} (${order.status}): ` +
        `${item ? `${item.quantity} x ${item.product_name_snapshot}` : 'item unknown'}` +
        `${item && item.color_snapshot ? ` ${item.color_snapshot}` : ''}` +
        `${item && item.size_snapshot ? ` ${item.size_snapshot}` : ''}, ` +
        `total ${money(order.total)}, to pay now ${money(order.booking_amount || order.total)}.`
    );
    if (order.status === 'PAYMENT_VERIFYING') {
      lines.push(
        'Their payment proof is already with the owner and is NOT yet verified. ' +
          'If they ask, it is still being checked.'
      );
    }
  } else {
    lines.push('No open order.');
  }

  if (config.SHIPPING_CHARGE > 0) lines.push(`Shipping is ${money(config.SHIPPING_CHARGE)}.`);
  else lines.push('Shipping is free.');

  return lines.join('\n');
}

/**
 * The handful of things about the shop that are not in the catalogue.
 *
 * How long a hoodie takes to make, what the T-shirts are cut from, which city
 * it posts from - the owner edits these in app_settings, and the deleted FAQ
 * module was the only thing that ever read them. Without them the agent was
 * asked "kitne din lagenge" every other conversation and had, truthfully,
 * nothing to say: it is forbidden from inventing, so it changed the subject,
 * which is the behaviour that reads as a bot talking past you.
 *
 * Handed over in the prompt rather than behind a tool because they are short,
 * they never change mid-conversation, and half the questions a shop gets are
 * one of these.
 */
const FACT_KEYS = {
  location_city: 'Shop is based in',
  shipping_note: 'Shipping',
  tshirt_lead_time: 'T-shirts take',
  hoodie_lead_time: 'Hoodies take',
  tshirt_material: 'T-shirt fabric',
  hoodie_brands: 'Hoodie brands',
  lot_note: 'Stock note',
};

async function shopFacts() {
  return cache.remember(cache.KEYS.faq, config.FAQ_TTL_MS, async () => {
    const rows = unwrap(
      await supabase.from('app_settings').select('key,value').in('key', Object.keys(FACT_KEYS)),
      'agent.facts'
    );
    return Object.fromEntries((rows || []).map((row) => [row.key, row.value]));
  });
}

async function build(phone, { pushName = '' } = {}) {
  const [facts, now] = await Promise.all([
    shopFacts().catch(() => ({})),
    situation(phone, pushName),
  ]);

  const known = Object.entries(FACT_KEYS)
    .filter(([key]) => facts[key])
    .map(([key, label]) => `- ${label}: ${facts[key]}`);

  const about = known.length
    ? `\n\nABOUT THE SHOP - these are true, use them when asked\n${known.join('\n')}`
    : '';

  return `${CHARACTER}${about}\n\nRIGHT NOW\n${now}`;
}

module.exports = { build, CHARACTER };
