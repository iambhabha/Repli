'use strict';

/**
 * Tests for the combined AI call, the redaction that guards what it is shown,
 * and the ledger that measures what it cost.
 *
 * No network and no database: the model is stubbed, so what is being checked
 * is the part that has to be right every single time - what we send it, and
 * what we refuse to accept back.
 *
 *   node tests/converse.test.js
 */

process.env.TEST_MODE = 'true';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const converse = require('../src/ai/converse');
const redact = require('../src/ai/redact');

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  ❌ ${name}\n     ${err.stack.split('\n').slice(0, 3).join('\n     ')}`);
  }
}

// The shop, as the model would be shown it.
const FACTS = [
  'Shop: 3POINTER.CLUB',
  'PRODUCTS (only these exist):',
  '- Spider-Man | price ₹2499 | booking ₹500 now, ₹1999 when ready | sizes available: M, L, XL',
  '- Venom | price ₹2499 | booking ₹500 now, ₹1999 when ready | sizes available: S, M',
].join('\n');

// validate() takes the category KEYS; read() is the one that takes rows and
// narrows them itself.
const LISTS = {
  categories: ['tshirt', 'hoodie'],
  designs: ['Spider-Man', 'Venom'],
  colours: ['Red', 'Black'],
  sizes: ['S', 'M', 'L', 'XL', 'XXL'],
  facts: FACTS,
};

const VALID = {
  intent: 'ask_stock',
  confidence: 0.9,
  category: 'tshirt',
  product: 'Spider-Man',
  colour: 'Red',
  size: 'XL',
  language: 'hi',
  action: 'reply',
  reply: 'Haan bhai, red Spider-Man XL available hai. Book kar du?',
};

const withField = (patch) => JSON.stringify({ ...VALID, ...patch });

function accepted(raw) {
  const result = converse.validate(raw, LISTS);
  assert.ok(!result.reason, `expected accepted, got rejection "${result.reason}"`);
  return result.value;
}

function rejected(raw, reason) {
  const result = converse.validate(raw, LISTS);
  assert.ok(result.reason, 'expected a rejection, but the object was accepted');
  if (reason) assert.strictEqual(result.reason, reason);
  return result.reason;
}

async function run() {
  console.log('\n— converse: answers that must be accepted —\n');

  await check('a well formed answer passes, with its fields as given', async () => {
    const value = accepted(JSON.stringify(VALID));
    assert.strictEqual(value.intent, 'ask_stock');
    assert.strictEqual(value.product, 'Spider-Man');
    assert.strictEqual(value.size, 'XL');
    assert.strictEqual(value.confidence, 0.9);
    // Derived, so the state machine's existing FAQ branch keeps working.
    assert.strictEqual(value.question, 'stock');
  });

  await check('null product, colour and size are a valid "I could not tell"', async () => {
    const value = accepted(withField({ product: null, colour: null, size: null, category: null }));
    assert.strictEqual(value.product, null);
    assert.strictEqual(value.colour, null);
    assert.strictEqual(value.size, null);
  });

  await check('continue_flow may carry no reply at all', async () => {
    const value = accepted(withField({ action: 'continue_flow', reply: '' }));
    assert.strictEqual(value.reply, '');
    assert.strictEqual(value.action, 'continue_flow');
  });

  await check('a price already in the shop facts may be repeated', async () => {
    const value = accepted(
      withField({ reply: 'Spider-Man XL hai bhai. ₹2499 hai, ₹500 booking, baaki ₹1999.' })
    );
    assert.ok(value.reply.includes('2499'));
  });

  await check('case and whitespace are matched, not silently invented', async () => {
    const value = accepted(withField({ product: '  spider-man ', size: 'xl' }));
    // Snapped to OUR spelling, because it matched one of our strings.
    assert.strictEqual(value.product, 'Spider-Man');
    assert.strictEqual(value.size, 'XL');
  });

  console.log('\n— converse: answers that must be rejected whole —\n');

  await check('not JSON at all', async () => rejected('Haan bhai available hai', 'unparsable'));
  await check('a JSON array, not an object', async () => rejected('[1,2,3]', 'not_an_object'));
  await check('a missing field', async () => {
    const { intent, ...rest } = VALID;
    rejected(JSON.stringify(rest), 'missing_intent');
  });
  await check('an intent nobody defined', async () =>
    rejected(withField({ intent: 'ask_discount_code' }), 'bad_intent'));
  await check('an action nobody defined', async () =>
    rejected(withField({ action: 'create_order' }), 'bad_action'));
  await check('a language outside hi/en', async () =>
    rejected(withField({ language: 'ta' }), 'bad_language'));
  await check('confidence above 1', async () =>
    rejected(withField({ confidence: 4 }), 'bad_confidence'));
  await check('confidence that is not a number', async () =>
    rejected(withField({ confidence: 'very' }), 'bad_confidence'));

  await check('a product the shop does not sell', async () =>
    rejected(withField({ product: 'Superman' }), 'bad_product'));
  await check('a colour the shop does not stock', async () =>
    rejected(withField({ colour: 'Blue' }), 'bad_colour'));
  await check('a size that is not on the list', async () =>
    rejected(withField({ size: 'XXXL' }), 'bad_size'));
  await check('a category that does not exist', async () =>
    rejected(withField({ category: 'shoes' }), 'bad_category'));

  await check('a near miss is rejected, never repaired into something real', async () => {
    rejected(withField({ product: 'Spiderman Red Tshirt' }), 'bad_product');
    // And nothing about the rejection leaks a corrected value.
    const result = converse.validate(withField({ product: 'Spidey' }), LISTS);
    assert.strictEqual(result.value, undefined);
  });

  await check('an invented price', async () =>
    rejected(withField({ reply: 'Bhai aapke liye ₹1799 me de dunga.' }), 'unsafe_reply'));

  await check('an invented UPI id or phone number', async () =>
    rejected(withField({ reply: 'Pay to 9799757664@ybl bhai' }), 'unsafe_reply'));

  await check('a link', async () =>
    rejected(withField({ reply: 'Dekho https://shop.example.com/spiderman' }), 'unsafe_reply'));

  await check('an essay instead of a WhatsApp message', async () => {
    const essay = Array.from({ length: 45 }, (_, i) => `word${i}`).join(' ');
    rejected(withField({ reply: essay }), 'reply_too_long');
  });

  await check('an action that promised words and delivered none', async () =>
    rejected(withField({ action: 'reply', reply: '' }), 'empty_reply'));

  console.log('\n— the model may ask and offer, never report —\n');

  /**
   * From the shop's first real customer conversation. "Red" and "Xxl" both
   * produced a confident narration of an order that was never placed - the
   * state logged SELECT_PRODUCT -> SELECT_PRODUCT both times. No number was
   * invented and no link appeared, so every guard that existed let it through.
   */
  await check('the exact sentences that lost the first real sale are refused', async () => {
    for (const lie of [
      "You've chosen the Spider-Man design! Confirm the size?",
      'Great choice! You have selected XXL for the Spider-Man design.',
      'Haan bhai, photo bhej raha hoon.',
      'Aapne Spider-Man chun liya hai.',
    ]) {
      rejected(withField({ reply: lie }), 'unsafe_reply');
    }
  });

  await check('order and payment state belong to the database, not the model', async () => {
    for (const lie of [
      'Order place ho gaya bhai.',
      'Booking confirm ho gayi hai.',
      'Payment mil gaya bhai, dhanyavaad.',
      'Added to your cart.',
      'Your order has been placed.',
    ]) {
      rejected(withField({ reply: lie }), 'unsafe_reply');
    }
  });

  await check('asking and offering are still exactly what it is for', async () => {
    for (const fine of [
      'Kaunsa size chahiye bhai?',
      'Book kar du?',
      'Haan bhai, Spider-Man available hai. Kaunsa size?',
      'Red aur black dono hai. Kaunsa dekhna hai?',
      'Spider-Man ki photo abhi mere paas nahi hai bhai',
    ]) {
      const value = accepted(withField({ reply: fine }));
      assert.strictEqual(value.reply, fine);
    }
  });

  await check('the rule is in the prompt as well as in the gate', async () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'ai', 'reply.js'), 'utf8');
    assert.ok(/NEVER say something has already happened/.test(source));
    assert.ok(source.includes('claimsAnAction'), 'and it is enforced, not only asked for');
  });

  await check('"category" is described so it cannot be read as a kind of thing', async () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'ai', 'converse.js'), 'utf8');
    // A live call answered "category": "size" when the four fields were
    // described together on one line.
    assert.ok(source.includes('which department'), 'the field says what it means');
    assert.ok(/never a word/.test(source), 'and what it must not be');
    // The prompt LINE, not the comment that explains why it went.
    assert.ok(
      !source.includes("' category product colour size"),
      'the ambiguous prompt line is gone'
    );
  });

  console.log('\n— privacy: what the model is never shown —\n');

  await check('an address in the transcript becomes a signal, not the address', async () => {
    const lines = [
      'shop: Address bhej do bhai',
      'customer: Rahul Kankariya, 12 MG Road, Andheri West, Mumbai 400058',
      'shop: Naam bhi bhej do',
    ];
    const out = redact.history(lines);
    assert.strictEqual(out[1], 'customer: (shared their delivery details)');
    const joined = out.join('\n');
    assert.ok(!joined.includes('MG Road'), 'street must not survive');
    assert.ok(!joined.includes('400058'), 'PIN must not survive');
    assert.ok(!joined.includes('Andheri'), 'locality must not survive');
    // The shop's own words are untouched.
    assert.strictEqual(out[0], 'shop: Address bhej do bhai');
  });

  await check('a phone number is redacted wherever it appears', async () => {
    assert.ok(!redact.text('mera number 9829374438 hai').includes('9829374438'));
    assert.ok(redact.text('mera number 9829374438 hai').includes('(number)'));

    // In a transcript that same line trips the address heuristic first, which
    // is stricter still - the whole turn is held back rather than redacted.
    const out = redact.history(['customer: mera number 9829374438 hai, call kar lena']);
    assert.ok(!out[0].includes('9829374438'));
  });

  await check('a UPI id and an email are redacted', async () => {
    assert.ok(!redact.text('bhej do 9799757664@ybl par').includes('9799757664@ybl'));
    assert.ok(!redact.text('mail: rahul@example.com').includes('rahul@example.com'));
  });

  await check('during the details step every customer line is held back', async () => {
    const out = redact.history(['customer: Mumbai'], { detailsPhase: true });
    assert.strictEqual(out[0], 'customer: (shared their delivery details)');
  });

  await check('an ordinary question is passed through intact', async () => {
    const out = redact.history(['customer: bhai red spider man XL hai kya?']);
    assert.strictEqual(out[0], 'customer: bhai red spider man XL hai kya?');
  });

  await check('known() carries flags, never the values themselves', async () => {
    const known = redact.known(
      {
        name: 'Rahul Kankariya',
        address: '12 MG Road, Andheri West',
        city: 'Mumbai',
        pin: '400058',
      },
      { color: 'Red', size: 'XL' }
    );

    for (const secret of ['Rahul', 'Kankariya', 'MG Road', 'Mumbai', '400058', 'Andheri']) {
      assert.ok(!known.includes(secret), `${secret} must not reach the model`);
    }
    // But the model still knows not to ask again, and knows the shop's facts.
    assert.ok(known.includes('their address'));
    assert.ok(known.includes('their city'));
    assert.ok(known.includes('colour Red'));
    assert.ok(known.includes('size XL'));
  });

  await check('nothing order- or payment-sensitive is in the context helpers', async () => {
    const known = redact.known({ name: 'A', address: 'B', city: 'C', pin: '400058' }, {});
    assert.ok(!/REP-\d+/.test(known), 'no order id');
    assert.ok(!/\d{4,}/.test(known), 'no long numbers at all');
  });

  console.log('\n— the ledger records what actually happened —\n');

  /** Load client.js with the model and the ledger both stubbed. */
  function loadClient() {
    const usagePath = require.resolve('../src/services/aiUsageService');
    const clientPath = require.resolve('../src/ai/client');
    delete require.cache[usagePath];
    delete require.cache[clientPath];

    const usage = require(usagePath);
    const rows = [];
    usage.record = async (row) => {
      rows.push(row);
    };
    usage.withinBudget = async () => true;

    const config = require('../src/config');
    config.AI_ENABLED = true;
    config.OPENAI_API_KEY = config.OPENAI_API_KEY || 'test-key';

    return { client: require(clientPath), rows };
  }

  function stubFetch(content, { delayMs = 0 } = {}) {
    global.fetch = async () => {
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content } }],
          usage: { prompt_tokens: 120, completion_tokens: 20 },
        }),
      };
    };
  }

  const realFetch = global.fetch;

  await check('a call is recorded under its own purpose, with a latency', async () => {
    const { client, rows } = loadClient();
    stubFetch('anything', { delayMs: 30 });

    const out = await client.complete({ purpose: 'converse', system: 's', user: 'u' });
    assert.strictEqual(out, 'anything');
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].purpose, 'converse');
    assert.strictEqual(rows[0].fallbackReason, null, 'a used answer has no fallback reason');
    assert.ok(rows[0].latencyMs >= 25, `latency should be recorded, got ${rows[0].latencyMs}`);
    assert.strictEqual(rows[0].ok, true);
  });

  await check('a rejected answer is still paid for, and says why it was dropped', async () => {
    const { client, rows } = loadClient();
    stubFetch('nonsense');

    const out = await client.complete({
      purpose: 'humanise',
      system: 's',
      user: 'u',
      verify: () => 'guard_failed',
    });

    assert.strictEqual(out, null, 'a rejected answer must not reach the caller');
    assert.strictEqual(rows[0].purpose, 'humanise');
    assert.strictEqual(rows[0].fallbackReason, 'guard_failed');
    assert.strictEqual(rows[0].ok, true, 'ok still means the API call worked - it was billed');
    assert.ok(rows[0].costUsd > 0, 'a rejected answer still costs money and must be counted');
  });

  await check('a guard that throws is caught and recorded, not propagated', async () => {
    const { client, rows } = loadClient();
    stubFetch('whatever');
    const out = await client.complete({
      purpose: 'reply',
      system: 's',
      user: 'u',
      verify: () => {
        throw new Error('boom');
      },
    });
    assert.strictEqual(out, null);
    assert.strictEqual(rows[0].fallbackReason, 'verify_threw');
  });

  await check('the budget gate still refuses before spending anything', async () => {
    const usagePath = require.resolve('../src/services/aiUsageService');
    const clientPath = require.resolve('../src/ai/client');
    delete require.cache[usagePath];
    delete require.cache[clientPath];

    const usage = require(usagePath);
    const rows = [];
    usage.record = async (row) => rows.push(row);
    usage.withinBudget = async () => false;

    let called = false;
    global.fetch = async () => {
      called = true;
      throw new Error('the network should never have been touched');
    };

    const client = require(clientPath);
    const out = await client.complete({ purpose: 'converse', system: 's', user: 'u' });

    assert.strictEqual(out, null);
    assert.strictEqual(called, false, 'an exhausted budget must not cost a round trip');
    assert.strictEqual(rows.length, 0, 'and must not write a ledger row');
  });

  global.fetch = realFetch;

  console.log('\n— every AI call site declares a real purpose —\n');

  await check('no call site still logs itself as the old catch-all', async () => {
    const fs = require('fs');
    const dir = path.join(__dirname, '..', 'src', 'ai');
    const found = new Map();

    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
      const source = fs.readFileSync(path.join(dir, file), 'utf8');
      const match = source.match(/purpose:\s*'([a-z_]+)'/);
      if (match) found.set(file, match[1]);
    }

    assert.strictEqual(found.get('humanise.js'), 'humanise');
    assert.strictEqual(found.get('intent.js'), 'intent');
    assert.strictEqual(found.get('language.js'), 'language');
    assert.strictEqual(found.get('reply.js'), 'reply');
    assert.strictEqual(found.get('understand.js'), 'understand');
    assert.strictEqual(found.get('converse.js'), 'converse');

    // Which is the point: they are all different.
    assert.strictEqual(new Set(found.values()).size, found.size, 'purposes must be distinguishable');
  });

  console.log(`\n${passed}/${passed + failed} passed\n`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
