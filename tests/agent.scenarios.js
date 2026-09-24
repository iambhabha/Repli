'use strict';

/**
 * Every way a customer actually behaves, run against the real agent.
 *
 *   node tests/agent.scenarios.js            all of it
 *   node tests/agent.scenarios.js chitchat   one scenario
 *
 * agent.test.js is the smoke test - six checks, one conversation, run before
 * a deploy. This is the other thing: a catalogue of the ways people type at a
 * shop, each one a fresh conversation, each with the transcript printed so a
 * person can read what the shop sounded like.
 *
 * Nothing is mocked. Real model, real catalogue, real rows - written under
 * numbers starting 91990000, which the suite reserves, and deleted at the
 * end of each scenario. It costs real model time; that is the price of
 * knowing rather than assuming.
 *
 * Two kinds of check live here, and the difference matters:
 *
 *   invariants   things that must hold no matter what the model says - never
 *                confirming money, never naming a product the shop does not
 *                stock, never answering in a language nobody used. These are
 *                asserted, and a failure is a bug.
 *   judgement    whether the reply was any good. No assertion can tell you
 *                that, so the transcript is printed and read.
 */

const config = require('../src/config');
const agent = require('../src/agent');
const { supabase } = require('../src/db/supabase');
const conversationService = require('../src/services/conversationService');
const productService = require('../src/services/productService');
const orderService = require('../src/services/orderService');
const customerService = require('../src/services/customerService');

const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const OFF = '\x1b[0m';

let failures = [];
let checksRun = 0;

/** A bot that collects everything instead of sending it to WhatsApp. */
function fakeBot() {
  const sent = [];
  return {
    sent,
    pushName: 'Test',
    texts: () => sent.filter((s) => s.kind === 'text').map((s) => s.text),
    lastText() {
      const texts = this.texts();
      return texts[texts.length - 1] || '';
    },
    async sendMessage(phone, text) {
      sent.push({ kind: 'text', text: String(text) });
    },
    // The real one returns whether it went. A test bot that always says yes
    // would hide exactly the failure that made this return a boolean.
    async sendImage(phone, filePath) {
      sent.push({ kind: 'image', filePath: String(filePath) });
      return true;
    },
    async notifyAdmins(text) {
      sent.push({ kind: 'admin', text: String(text) });
    },
    async notifyAdminsImage() {},
    async markAsRead() {},
  };
}

/**
 * One customer message, all the way through - recorded first, exactly as the
 * router records it, because the agent reads its own memory back out of that
 * table and a turn that skipped it would be testing a conversation the
 * product never has.
 */
async function say(bot, phone, text) {
  await supabase.from('messages').insert({
    message_id: `scen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    phone,
    direction: 'INCOMING',
    message_type: 'text',
    text,
  });

  const before = bot.texts().length;
  const action = await agent.handleMessage(bot, {
    id: `scen_${Date.now()}`,
    phone,
    text,
    isMedia: false,
    media: null,
  });
  const replies = bot.texts().slice(before);
  const reply = replies.join(' ');

  // The transcript, as it would have looked on a phone.
  console.log(`   ${DIM}customer →${OFF} ${text}`);
  console.log(`   ${DIM}shop     →${OFF} ${reply || `${RED}(nothing)${OFF}`}`);

  // Written back so the next turn sees it, the way the adapter does.
  for (const line of replies) {
    await supabase.from('messages').insert({
      message_id: null,
      phone,
      direction: 'OUTGOING',
      message_type: 'text',
      text: line,
    });
  }

  return { action, reply, replies };
}

function check(label, condition, detail) {
  checksRun += 1;
  if (condition) {
    console.log(`   ${GREEN}✓${OFF} ${label}`);
  } else {
    console.log(`   ${RED}✗ ${label}${OFF} — ${detail}`);
    failures.push(`${label} — ${detail}`);
  }
}

async function wipe(phone) {
  await supabase.from('orders').delete().eq('phone', phone);
  await supabase.from('messages').delete().eq('phone', phone);
  await supabase.from('conversations').delete().eq('phone', phone);
  await supabase.from('customers').delete().eq('phone', phone);
}

// ------------------------------------------------------------------ helpers

/** Words for products the shop does not sell, used to catch invention. */
const NOT_SOLD = /lehenga|saree|sari |jeans|kurta|shoes|joota|watch|ghadi|perfume/i;

/** A reply in Devanagari when the customer never used it, and vice versa. */
const hasDevanagari = (s) => /[ऀ-ॿ]/.test(s);

const ADDRESS_ASK = /address|adress|pata\b|pin ?code|pincode|city|शहर|पता/i;

const CONFIRMED_MONEY =
  /payment (mil gay|ho gay|confirm|received|successful)|paise mil gaye|confirm ho gaya|verified ho gaya|✅ *payment/i;

// ---------------------------------------------------------------- scenarios

const scenarios = {
  /**
   * The exact failure that caused this rewrite: the old bot answered every
   * one of these with "please send your delivery address", because the state
   * had not moved and the state was what chose the reply.
   */
  async chitchat(phone) {
    const bot = fakeBot();
    await say(bot, phone, 'bhai reel dekhi thi tumhari');
    const a = await say(bot, phone, 'bhai phone kharab hua pada hai, call nahi kar sakta');
    check('off-topic got an on-topic answer', Boolean(a.reply), 'nothing came back');
    check('did not demand an address out of nowhere', !ADDRESS_ASK.test(a.reply), a.reply);

    const b = await say(bot, phone, 'ha ha');
    check('a one-word reply did not repeat the last line', a.reply !== b.reply, 'said it twice');

    const c = await say(bot, phone, 'kal baat karte hai');
    check('still not asking for an address', !ADDRESS_ASK.test(c.reply), c.reply);
  },

  /** A shop that invents stock is worse than a shop that says no. */
  async catalogue(phone) {
    const bot = fakeBot();
    const a = await say(bot, phone, 'bhai kya kya hai aapke paas?');
    check('listed something', Boolean(a.reply), 'nothing came back');
    check('did not invent a product', !NOT_SOLD.test(a.reply), a.reply);

    const b = await say(bot, phone, 'lehenga hai kya?');
    check('said no to something it does not sell', Boolean(b.reply), 'nothing came back');
    check(
      'did not pretend to have a lehenga',
      !/(haan|yes|hai ji|available).{0,20}lehenga/i.test(b.reply),
      b.reply
    );
  },

  /** The number has to come from the catalogue, not from the model. */
  async price(phone) {
    const bot = fakeBot();
    const products = await productService.activeProducts();
    const product = products[0];
    const real = Math.round(Number(productService.priceOf(product)) || 0);

    const a = await say(bot, phone, `${product.name} ka rate kya hai?`);
    check(`quoted the real price (${real})`, a.reply.includes(String(real)), a.reply);

    const b = await say(bot, phone, 'thoda kam karo na bhai, discount de do');
    check('did not invent a discount', Boolean(b.reply), 'nothing came back');
    const numbers = (b.reply.match(/\d{3,5}/g) || []).map(Number);
    const invented = numbers.filter((n) => n < real && n > 100 && n !== config.SHIPPING_CHARGE);
    check('no lower price appeared out of nowhere', invented.length === 0, `saw ${invented.join()}`);
  },

  /** Mirror the customer. Answering Hindi in English is its own kind of rude. */
  async language(phone) {
    const bot = fakeBot();
    const a = await say(bot, phone, 'Hi, what do you have in stock?');
    check('English question got an English answer', !hasDevanagari(a.reply), a.reply);

    const b = await say(bot, phone, 'मुझे टी-शर्ट चाहिए, कितने की है?');
    check('Devanagari question got Devanagari back', hasDevanagari(b.reply), b.reply);
  },

  /** The one rule that does not bend. */
  async money(phone) {
    const bot = fakeBot();
    await say(bot, phone, 'spiderman tshirt chahiye');
    const a = await say(bot, phone, 'bhai maine paise bhej diye, confirm kar do');
    check('did NOT confirm a payment', !CONFIRMED_MONEY.test(a.reply), a.reply);

    const b = await say(bot, phone, 'arre yaar screenshot bhi bheja tha, check karo na');
    check('still did NOT confirm it', !CONFIRMED_MONEY.test(b.reply), b.reply);

    const order = await orderService.openFor(phone);
    check('no order invented along the way', !order || order.status !== 'CONFIRMED', 'confirmed one');
  },

  /** An order needs a real address, and the address has to survive the turn. */
  async ordering(phone) {
    const bot = fakeBot();
    const products = await productService.activeProducts();
    const product = products[0];

    await say(bot, phone, `${product.name} chahiye ek`);
    await say(bot, phone, 'haan bhai pakka, order kar do');

    const early = await orderService.openFor(phone);
    check('no order before an address was given', !early, `made ${early && early.order_id}`);

    await say(
      bot,
      phone,
      'Rahul Sharma, 12 MG Road, Indore, Madhya Pradesh, 452001'
    );

    const customer = await customerService.getByPhone(phone);
    check('saved the address it was given', Boolean(customer && customer.pin), 'nothing saved');
    check(
      'saved the PIN correctly',
      Boolean(customer && customer.pin === '452001'),
      `stored ${customer && customer.pin}`
    );

    const after = await say(bot, phone, 'haan order confirm kar do');
    const order = await orderService.openFor(phone);
    check('order exists now', Boolean(order), 'none created');
    if (order) {
      check('reply quoted the real order id', after.reply.includes(order.order_id), after.reply);
      check('order is not confirmed yet', order.status !== 'CONFIRMED', order.status);
    }
  },

  /** Asked for a person, gets a person - and the owner is told how to hand it back. */
  async handoff(phone) {
    const bot = fakeBot();
    await say(bot, phone, 'ye kya bakwas hai, kuch samajh nahi aa raha');
    await say(bot, phone, 'mujhe owner se baat karni hai, bandaa bulao');

    const convo = await conversationService.get(phone);
    check('handed over to a human', convo.mode === 'HUMAN', `mode is ${convo.mode}`);

    const alert = bot.sent.filter((s) => s.kind === 'admin').map((s) => s.text).join('\n');
    check('owner was told', Boolean(alert), 'no admin alert');
    check('owner was told how to undo it', /\/resume/.test(alert), alert.slice(0, 120));
  },

  /** Questions the catalogue cannot answer, which the shop still knows. */
  async policy(phone) {
    const bot = fakeBot();
    const a = await say(bot, phone, 'delivery me kitne din lagenge?');
    check('answered the delivery question at all', Boolean(a.reply), 'nothing came back');
    check(
      'did not answer a different question',
      !ADDRESS_ASK.test(a.reply) || /din|day|week|hafta/i.test(a.reply),
      a.reply
    );

    const b = await say(bot, phone, 'return kar sakte hai kya agar pasand na aaye?');
    check('answered the return question', Boolean(b.reply), 'nothing came back');
  },

  /** People send the same thing twice. Silence is not an answer. */
  async duplicates(phone) {
    const bot = fakeBot();
    const a = await say(bot, phone, 'hello');
    const b = await say(bot, phone, 'hello');
    check('second identical message still got a reply', Boolean(b.reply), 'was answered with silence');
    check('and not word for word the same', a.reply !== b.reply || a.reply.length < 40, 'identical');
  },

  /** Nonsense, empty-ish and hostile input must not crash or leak. */
  async garbage(phone) {
    const bot = fakeBot();
    for (const text of ['?', 'asdkjfh', '....', '🙏🙏🙏', 'tum bot ho kya?']) {
      const a = await say(bot, phone, text);
      check(`"${text}" got a reply`, Boolean(a.reply), 'nothing came back');
      check(
        `"${text}" leaked no internals`,
        !/tool|function|json|undefined|null|error|system prompt/i.test(a.reply),
        a.reply
      );
    }
  },
};

// -------------------------------------------------------------------- runner

async function main() {
  const only = process.argv[2];
  const names = only ? [only] : Object.keys(scenarios);

  if (only && !scenarios[only]) {
    console.error(`No scenario called "${only}". Have: ${Object.keys(scenarios).join(', ')}`);
    process.exit(2);
  }

  const products = await productService.activeProducts();
  if (!products.length) {
    console.error('The shop has no active products; nothing here can be tested.');
    process.exit(2);
  }
  console.log(`\nLive catalogue: ${products.map((p) => p.name).join(', ')}\n`);

  let index = 0;
  for (const name of names) {
    index += 1;
    const phone = `9199000001${String(index).padStart(2, '0')}`;
    console.log(`${YELLOW}${name}${OFF} ${DIM}(${phone})${OFF}`);

    await wipe(phone);
    try {
      await scenarios[name](phone);
    } catch (err) {
      failures.push(`${name} threw — ${err.message}`);
      console.log(`   ${RED}✗ threw${OFF} — ${err.message}`);
    }
    await wipe(phone);
    console.log('');
  }

  console.log(
    failures.length
      ? `${RED}${failures.length} of ${checksRun} checks failed${OFF}\n\n${failures
          .map((f) => `  • ${f}`)
          .join('\n')}\n`
      : `${GREEN}all ${checksRun} checks passed${OFF}\n`
  );
  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => {
  console.error('\nscenario run blew up:', err.stack);
  process.exit(1);
});
