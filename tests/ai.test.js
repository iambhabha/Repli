'use strict';

/**
 * Tests for the AI guard rails. No network, no database - these are pure
 * functions on purpose, because they are the last thing standing between a
 * chatty model and a customer being told the wrong price.
 *
 *   node tests/ai.test.js
 */

const assert = require('assert');
const { verify } = require('../src/ai/humanise');
const cost = require('../src/ai/cost');
const proof = require('../src/ai/proof');
const parser = require('../src/bot/parser');

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  ❌ ${name}\n     ${err.message}`);
  }
}

console.log('\n— rewrites that must be allowed —\n');

check('same facts, warmer wording', () => {
  assert.strictEqual(
    verify('Total ₹4995 hai. Order REP-1039.', 'Bhai total ₹4995 hua. Order REP-1039 hai 😊'),
    true
  );
});

check('a number may be repeated', () => {
  assert.strictEqual(verify('2 piece bheju?', 'Bhai 2 piece? 2 hi na?'), true);
});

check('link kept byte for byte', () => {
  assert.strictEqual(
    verify('Pay here: https://pay.me/abc', 'Bhai yahan pay kar do: https://pay.me/abc'),
    true
  );
});

check('shorter is fine', () => {
  assert.strictEqual(verify('Aapka order REP-1001 confirm ho gaya hai.', 'REP-1001 confirm ✅'), true);
});

console.log('\n— rewrites that must be blocked —\n');

check('changed price', () => {
  assert.strictEqual(verify('Total ₹4995', 'Total ₹5995 bhai'), false);
});

check('invented discount', () => {
  assert.strictEqual(verify('Total ₹4995 hai', 'Total ₹4995, aur 10% off bhi hai'), false);
});

check('changed payment link', () => {
  assert.strictEqual(verify('Pay: https://pay.me/abc', 'Pay: https://pay.me/xyz'), false);
});

check('dropped the order id', () => {
  assert.strictEqual(verify('Order REP-1039 confirm', 'Bhai order confirm ho gaya'), false);
});

check('added a second link', () => {
  assert.strictEqual(
    verify('Pay: https://pay.me/abc', 'Pay: https://pay.me/abc ya https://other.com'),
    false
  );
});

check('grew into an essay', () => {
  const original = 'Size batao: S, M, L';
  assert.strictEqual(verify(original, `${original}. ${'bhai '.repeat(40)}`), false);
});

check('empty answer', () => {
  assert.strictEqual(verify('Total ₹4995', ''), false);
});

check('dropped the question', () => {
  // Seen in production: "Which size?\n\nS\nM\nL" came back as "S, M, L."
  assert.strictEqual(verify('Which size?\n\nS\nM\nL\nXL\nXXL', 'S, M, L, XL, XXL.'), false);
});

check('question kept, wording changed', () => {
  assert.strictEqual(verify('Which size?\n\nS\nM\nL\nXL\nXXL', 'Size batao bhai? S, M, L, XL, XXL'), true);
});

check('turned the address form into a sentence', () => {
  const form = 'Details bhej do:\n\nName:\nFull Address:\nCity:\nState:\nPIN Code:';
  assert.strictEqual(
    verify(form, 'Bhai, apna naam, poora address, city, state aur PIN code bhej do.'),
    false
  );
});

check('address form kept as a form', () => {
  const form = 'Details bhej do:\n\nName:\nFull Address:\nCity:\nState:\nPIN Code:';
  const rewritten = 'Bhai, ye bhar ke bhej do:\n\nName:\nFull Address:\nCity:\nState:\nPIN Code:';
  assert.strictEqual(verify(form, rewritten), true);
});

console.log('\n— cost table —\n');

check('mini model priced per token, not per call', () => {
  // 1M input + 1M output on gpt-4o-mini = $0.15 + $0.60
  const usd = cost.forUsage('gpt-4o-mini', 1e6, 1e6);
  assert.ok(Math.abs(usd - 0.75) < 1e-9, `expected 0.75, got ${usd}`);
});

check('dated model name still matches its family', () => {
  assert.deepStrictEqual(cost.priceFor('gpt-4o-mini-2024-07-18'), { input: 0.15, output: 0.6 });
});

check('unknown model bills at the expensive fallback', () => {
  const price = cost.priceFor('some-future-model');
  assert.ok(price.input >= 2, 'unknown models must not look cheap');
});

check('a realistic month stays inside the budget', () => {
  // 500 customers x 10 messages, ~1200 in / 150 out each.
  const usd = cost.forUsage('gpt-4o-mini', 5000 * 1200, 5000 * 150);
  const inr = cost.toInr(usd);
  assert.ok(inr < 1000, `expected under ₹1000, got ₹${inr.toFixed(2)}`);
  console.log(`     (5,000 messages ≈ ₹${inr.toFixed(2)})`);
});

console.log('\n- reading a payment screenshot, and not believing it -\n');

const readsAs = (raw) => proof.validate(JSON.stringify(raw));

check('a clean screenshot is read', () => {
  const out = readsAs({ amount: 500, status: 'success', reference: 'T2508191234', app: 'PhonePe', looksLikePayment: true });
  assert.ok(out.value, out.reason);
  assert.strictEqual(out.value.amount, 500);
  assert.strictEqual(out.value.status, 'success');
  assert.strictEqual(out.value.reference, 'T2508191234');
});

check('rupee symbols and commas are stripped, the number survives', () => {
  assert.strictEqual(readsAs({ amount: '1,499', looksLikePayment: true }).value.amount, 1499);
  assert.strictEqual(readsAs({ amount: ' 500 ', looksLikePayment: true }).value.amount, 500);
});

check('an unreadable amount is null, never a guess', () => {
  const out = readsAs({ amount: null, looksLikePayment: true });
  assert.ok(out.value, out.reason);
  assert.strictEqual(out.value.amount, null);
});

check('a hedged amount is refused outright', () => {
  for (const amount of ['around 500', '500-1000', 'approx 500', '5oo', 'five hundred', '-500', '0']) {
    assert.ok(readsAs({ amount, looksLikePayment: true }).reason, 'should refuse: ' + amount);
  }
});

check('a status the screen did not say is refused', () => {
  assert.ok(readsAs({ amount: 500, status: 'probably fine', looksLikePayment: true }).reason);
  assert.ok(readsAs({ amount: 500, status: 'success', looksLikePayment: true }).value);
});

check('looksLikePayment must be a real boolean', () => {
  assert.ok(readsAs({ amount: 500 }).reason, 'missing must be refused');
  assert.ok(readsAs({ amount: 500, looksLikePayment: 'yes' }).reason, 'a string is not a boolean');
  assert.strictEqual(readsAs({ amount: 500, looksLikePayment: false }).value.looksLikePayment, false);
});

check('a reference that is prose rather than an id is dropped', () => {
  assert.strictEqual(readsAs({ amount: 500, reference: 'not visible in image', looksLikePayment: true }).value.reference, null);
  assert.strictEqual(readsAs({ amount: 500, reference: 'T25-08_19/1234', looksLikePayment: true }).value.reference, 'T25-08_19/1234');
});

check('malformed answers are refused before anything else', () => {
  assert.ok(proof.validate('not json').reason);
  assert.ok(proof.validate('[]').reason);
  assert.ok(proof.validate('null').reason);
});

check('reading a screenshot can never write anything', () => {
  const source = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'src', 'ai', 'proof.js'),
    'utf8'
  );
  assert.ok(
    !/supabase|orderService|paymentService|setStatus/.test(source),
    'reading a screenshot must never touch an order or a payment'
  );
});

console.log('\n- "paisa kahan bhejun?" -\n');

check('asking where to pay is recognised', () => {
  for (const ask of ['payment kaha karu', 'paisa kidhar bhejun', 'qr bhejo', 'scanner dedo',
    'upi id kya hai', 'gpay number', 'payment details', 'where do i pay', 'payment kaise karu']) {
    assert.ok(parser.asksWhereToPay(ask), 'should ask for the QR: ' + ask);
  }
});

check('saying you have already paid is not asking where to pay', () => {
  for (const said of ['payment kar diya', 'paisa bhej diya', 'done', 'paid kar diya',
    'payment ho gaya', 'screenshot bhej diya']) {
    assert.ok(!parser.asksWhereToPay(said), 'should NOT resend the QR: ' + said);
  }
});


console.log('\n- settings reach the bot before the first customer does -\n');

check('the runtime sync runs once immediately, not only on the timer', () => {
  /**
   * .env carries a placeholder payment link on purpose - the real UPI id is
   * in app_settings so the panel can edit it. A sync that only fires on an
   * interval leaves that placeholder live for the first fifteen seconds
   * after every restart, and an order placed in that window tells the
   * customer to pay at a URL that does not exist.
   */
  const source = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'src', 'services', 'settingsService.js'),
    'utf8'
  );
  const start = source.slice(
    source.indexOf('function startSettingsSync('),
    source.indexOf('function startSettingsSync(') + 1400
  );
  assert.ok(/void sync\(\)|sync\(\);/.test(start), 'the first sync must not wait for the interval');
  assert.ok(/setInterval\(/.test(start), 'and it must still keep picking up later edits');
});


console.log('\n- changing your mind mid-conversation -\n');

check('a switch is offered, never taken silently', () => {
  /**
   * Acting on "venom" while somebody is choosing a size for the Spider-Man
   * throws away the colour and size they already picked - and they might
   * only have been asking a question about it.
   */
  const source = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'src', 'bot', 'stateMachine.js'),
    'utf8'
  );
  const fn = source.slice(
    source.indexOf('async function trySwitchItem('),
    source.indexOf('async function trySwitchItem(') + 2600
  );
  assert.ok(/confirmSwitch/.test(fn), 'a customer with a selection must be asked first');
  assert.ok(/pendingSwitch/.test(fn), 'the offer has to be remembered for their answer');
  assert.ok(
    fn.indexOf('confirmSwitch') < fn.indexOf('applySwitch'),
    'the question must come before the switch'
  );
});

check('the offer lasts exactly one turn', () => {
  const source = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'src', 'bot', 'stateMachine.js'),
    'utf8'
  );
  assert.ok(
    /const \{ pendingSwitch, \.\.\.rest \} = convo\.data/.test(source),
    'the offer must be dropped as soon as it is read, whatever the answer'
  );
});

check('switching clears the cart it is leaving behind', () => {
  const source = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'src', 'bot', 'stateMachine.js'),
    'utf8'
  );
  const fn = source.slice(
    source.indexOf('async function applySwitch('),
    source.indexOf('async function applySwitch(') + 1200
  );
  assert.ok(
    /clearedCart/.test(fn),
    'a size chosen for a T-shirt is not a size chosen for a bag'
  );
});


console.log('\n- a form field is not a place to hide a question -\n');

const nameValidator = (() => {
  const src = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'src', 'bot', 'stateMachine.js'),
    'utf8'
  );
  const slice = src.slice(src.indexOf('const NOT_IN_A_NAME'), src.indexOf('function cleanField'));
  /**
   * Built with new Function rather than eval: this file is strict, and a
   * strict eval keeps its declarations to itself, so looksLikeSentence would
   * not exist by the time the assertions run.
   */
  const build = new Function(
    'NAME_LIKE',
    `${slice}
return (value) => NAME_LIKE.test(value) && !looksLikeSentence(value);`
  );
  return build(/^[\p{L}\p{M}][\p{L}\p{M}.'\-\s]{1,59}$/u);
})();

check('real names are still accepted', () => {
  for (const name of ['Rahul Sharma', 'Priya', 'Mohammed Arif', "D'Souza", 'Anne-Marie',
    'Kartik Nair', 'Hari Om', 'Shyam Sundar', 'Karan Johar', 'Meera']) {
    assert.ok(nameValidator(name), `should be a valid name: ${name}`);
  }
});

check('the three that really were stored as names are refused', () => {
  /**
   * All three happened in one afternoon on a live phone. Each was a customer
   * asking something, each passed "is this letters and spaces?", and each was
   * saved as their name without a word back.
   */
  for (const junk of ['Red photos', 'Black ka', 'Inphoto batana mujhe']) {
    assert.ok(!nameValidator(junk), `must not be stored as a name: ${junk}`);
  }
});

check('a question at the name step falls through to be answered', () => {
  for (const asked of ['photo bhejo', 'mujhe bag chahiye', 'kitne ka hai', 'size M',
    'payment kaha karu', 'venom dikhao', 'kya price hai']) {
    assert.ok(!nameValidator(asked), `must reach the model, not the form: ${asked}`);
  }
});


console.log(`\n${passed}/${passed + failed} passed\n`);
process.exit(failed ? 1 : 0);
