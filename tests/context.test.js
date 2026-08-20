'use strict';

/**
 * Tests for the scoped AI context and for the owner's instructions cache.
 *
 * Two things are being proved here, and both are about money as much as
 * correctness:
 *
 *   1. The model is shown only what the current turn needs. Not a smaller
 *      version of everything - genuinely only the product in play, the one
 *      stored fact that answers the question asked, and nothing else.
 *   2. An instruction typed in the admin panel reaches the model on the next
 *      message rather than whenever a private timer happens to lapse.
 *
 *   node tests/context.test.js
 */

process.env.TEST_MODE = 'true';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const context = require('../src/bot/context');
const productService = require('../src/services/productService');
const settingsService = require('../src/services/settingsService');
const humanise = require('../src/ai/humanise');
const cache = require('../src/db/cache');
const invalidate = require('../src/db/invalidate');
const { supabase } = require('../src/db/supabase');

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

/**
 * Characters, and the token estimate the rest of this file reasons about.
 *
 * Calibrated against a real call: a 1107-character system prompt plus a
 * 672-character user prompt was counted by OpenAI as 500 tokens, i.e. about
 * 3.6 characters per token for this mixture of English, Hinglish and rupee
 * signs. Exact figures come from `ai_usage.input_tokens`; this is for
 * asserting a bound.
 */
const CHARS_PER_TOKEN = 3.6;
const tok = (text) => Math.round(String(text).length / CHARS_PER_TOKEN);

async function run() {
  const products = await productService.activeProducts();
  const spider =
    products.find((p) => (p.design || p.name).toLowerCase().includes('spider')) || products[0];
  assert.ok(spider, 'the test database needs at least one active product');

  console.log('\n— the whole shop, which is what we are moving away from —\n');

  const full = await context.shopFacts();

  await check('shopFacts still works and is still the big one', async () => {
    assert.ok(full.length > 1000, `expected the full dump, got ${full.length} chars`);
    console.log(`     (shopFacts: ${full.length} chars ≈ ${tok(full)} tokens)`);
  });

  console.log('\n— scoped: one product in play —\n');

  await check('a size question carries the product and nothing about the others', async () => {
    const scoped = await context.forTurn({ product: spider });

    assert.ok(scoped.facts.includes(spider.design || spider.name), 'the product must be there');
    for (const other of products) {
      const name = other.design || other.name;
      if (name === (spider.design || spider.name)) continue;
      assert.ok(!scoped.facts.includes(name), `${name} has nothing to do with this turn`);
    }
    assert.ok(scoped.facts.length < full.length / 3, 'this should be a fraction of the full dump');
    console.log(`     (${scoped.facts.length} chars ≈ ${tok(scoped.facts)} tokens)`);
  });

  await check('the allow-lists shrink with the facts', async () => {
    const scoped = await context.forTurn({ product: spider });
    assert.deepStrictEqual(scoped.designs, [spider.design || spider.name]);
    const ownColours = (await productService.colorsOf(spider)).filter((c) => c !== 'Default');
    assert.deepStrictEqual(scoped.colours.sort(), ownColours.sort());
  });

  await check('only the stored fact that answers THIS question is included', async () => {
    const waiting = await context.forTurn({ product: spider, topic: 'waiting' });
    const material = await context.forTurn({ product: spider, topic: 'material' });
    const none = await context.forTurn({ product: spider });

    assert.ok(waiting.facts.includes('Wait:'), 'a delivery question needs the lead time');
    assert.ok(!waiting.facts.includes('Material:'), 'and not the fabric');

    assert.ok(material.facts.includes('Material:'), 'a fabric question needs the fabric');
    assert.ok(!material.facts.includes('Wait:'), 'and not the lead time');

    assert.ok(!none.facts.includes('Wait:') && !none.facts.includes('Material:'),
      'a turn that asked neither gets neither');
  });

  await check('no full dump leaks through: brands, pickup city and shipping stay out', async () => {
    const scoped = await context.forTurn({ product: spider, topic: 'waiting' });
    for (const leak of ['Hoodie brands:', 'Shipping:', 'Based in:']) {
      assert.ok(!scoped.facts.includes(leak), `${leak} was not asked about`);
    }
  });

  console.log('\n— scoped: nothing chosen yet —\n');

  await check('the catalogue turn lists the designs but not every colour', async () => {
    const scoped = await context.forTurn({ catalogue: true });

    assert.strictEqual(scoped.designs.length, products.length, 'they still need the menu');
    // The backpack alone has two dozen colours and is sold out. A design with
    // one colour is not a question, so its colour is not a word to spend.
    assert.ok(scoped.colours.length <= 8,
      `expected a handful of colours, got ${scoped.colours.length}: ${scoped.colours.join(',')}`);
    assert.ok(scoped.facts.length < full.length,
      `${scoped.facts.length} should be smaller than the full ${full.length}`);
    console.log(`     (${scoped.facts.length} chars ≈ ${tok(scoped.facts)} tokens, ` +
      `${scoped.colours.length} colours vs ${(await (async () => {
        const all = new Set();
        for (const p of products) for (const c of await productService.colorsOf(p)) all.add(c);
        return all.size;
      })())} in the shop)`);
  });

  await check('money is withheld unless the turn is about money', async () => {
    const browsing = await context.forTurn({ catalogue: true, prices: false });
    const asking = await context.forTurn({ catalogue: true, prices: true });

    assert.ok(!/\d{3,}/.test(browsing.facts),
      'a browsing turn must not carry prices - the shop never leads with price');
    assert.ok(/\d{3,}/.test(asking.facts), 'a price question must carry the price');
    assert.ok(browsing.facts.length < asking.facts.length);
  });

  await check('an open order is one compact line, with the human-only rule attached', async () => {
    const scoped = await context.forTurn({
      product: spider,
      order: {
        order_id: 'REP-1039', status: 'PENDING_PAYMENT',
        total: 2499, booking_amount: 500, remaining_amount: 1999,
      },
    });
    assert.ok(scoped.facts.includes('REP-1039'));
    assert.ok(/person's decision/.test(scoped.facts), 'refunds must stay a human decision');
    assert.ok(scoped.facts.split('\n').filter((l) => l.includes('REP-1039')).length === 1,
      'one line, not a block');
  });

  console.log('\n— privacy is unchanged by the scoping —\n');

  await check('no customer detail can enter the facts block', async () => {
    const scoped = await context.forTurn({
      product: spider,
      order: {
        order_id: 'REP-1040', status: 'CONFIRMED',
        total: 2499, booking_amount: 500, remaining_amount: 1999,
        // These exist on a real order row and must never be read from it.
        customer_name: 'Rahul Kankariya', address: '12 MG Road', city: 'Mumbai',
        pin: '400058', phone: '919829374438',
      },
    });
    for (const secret of ['Rahul', 'MG Road', 'Mumbai', '400058', '919829374438']) {
      assert.ok(!scoped.facts.includes(secret), `${secret} must never reach the model`);
    }
  });

  await check('the state machine still redacts the transcript it passes along', async () => {
    const source = fs.readFileSync(path.join(ROOT, 'src', 'bot', 'stateMachine.js'), 'utf8');
    assert.ok(source.includes('redact.history('), 'the transcript is redacted before it is sent');

    /**
     * Counted against the reads rather than pinned to a number.
     *
     * This asserted "exactly two" and broke the day a third place started
     * passing history - which is precisely the change that most needs the
     * check, and the test would have failed the same way whether the new
     * call redacted or not. What actually matters is that no transcript
     * reaches a model unredacted, so every recentHistory() must have a
     * redact.history() to go with it.
     */
    const reads = (source.match(/messageService\.recentHistory\(/g) || []).length;
    const redactions = (source.match(/redact\.history\(/g) || []).length;
    assert.ok(reads > 0, 'the state machine must be reading some history to redact');
    assert.strictEqual(
      redactions,
      reads,
      `every transcript read must be redacted: ${reads} reads, ${redactions} redactions`
    );
  });

  console.log('\n— the owner\'s instructions, on the shared cache —\n');

  const KEY = cache.KEYS.settings('ai_instructions');

  async function writeInstruction(value) {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'ai_instructions', value }, { onConflict: 'key' });
    if (error) throw new Error(error.message);
  }

  const originalInstruction = await settingsService.value('ai_instructions', '');

  await check('humanise no longer keeps its own private copy', async () => {
    const source = fs.readFileSync(path.join(ROOT, 'src', 'ai', 'humanise.js'), 'utf8');
    assert.ok(source.includes("settingsService.value('ai_instructions'"),
      'it must read through the shared cache');
    assert.ok(!/instructionsAt|shopNameAt/.test(source),
      'the private thirty-second Maps should be gone');
  });

  await check('it reads the stored instruction, and the second read is cached', async () => {
    await cache.del(KEY);
    await writeInstruction('keep it very short');

    assert.strictEqual(await humanise.ownerInstructions(), 'keep it very short');

    // Change the row behind its back: a cached read must not see it yet.
    await writeInstruction('call everyone sir');
    assert.strictEqual(await humanise.ownerInstructions(), 'keep it very short',
      'this is the staleness the invalidation exists to fix');
  });

  await check('a panel edit invalidates it, and the next read is fresh', async () => {
    // Exactly what the panel publishes, applied by the bot's own listener.
    await invalidate.apply({ key: KEY, source: 'panel:settings' });

    assert.strictEqual(await humanise.ownerInstructions(), 'call everyone sir',
      'no waiting out a timer');
  });

  await check('the same invalidation twice is harmless', async () => {
    for (let i = 0; i < 3; i += 1) await invalidate.apply({ key: KEY, source: 'panel:settings' });
    assert.strictEqual(await humanise.ownerInstructions(), 'call everyone sir');
  });

  await check('a malformed invalidation is ignored and changes nothing', async () => {
    assert.strictEqual(await invalidate.apply({ key: 'not-ours:ai_instructions' }), false);
    assert.strictEqual(await invalidate.apply(null), false);
    assert.strictEqual(await invalidate.apply({}), false);
    assert.strictEqual(await humanise.ownerInstructions(), 'call everyone sir');
  });

  await check('it survives the settings lookup failing outright', async () => {
    const real = settingsService.value;
    settingsService.value = async () => {
      throw new Error('supabase is down');
    };
    try {
      // No throw, and an empty instruction rather than a crash: the bot keeps
      // talking, just without the owner's extra wording.
      assert.strictEqual(await humanise.ownerInstructions(), '');
      const name = await humanise.shopName();
      assert.ok(name && typeof name === 'string', 'the shop still has a name to use');
    } finally {
      settingsService.value = real;
    }
  });

  await check('the panel publishes exactly the key humanise reads', async () => {
    const panel = fs.readFileSync(path.join(ROOT, 'admin-panel', 'lib', 'services', 'settings.ts'), 'utf8');
    assert.ok(panel.includes('invalidateSettings(rows.map((row) => row.key))'),
      'every changed settings key is published');
    const keys = fs.readFileSync(path.join(ROOT, 'admin-panel', 'lib', 'services', 'settings.ts'), 'utf8');
    assert.ok(keys.includes("aiInstructions: 'ai_instructions'"),
      'and ai_instructions is one of the keys it writes');
    assert.strictEqual(KEY, 'repli:settings:ai_instructions');
  });

  // Put the shop back the way it was.
  await writeInstruction(originalInstruction || '');
  await cache.del(KEY);

  console.log(`\n${passed}/${passed + failed} passed\n`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
