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
const brain = require('../src/ai/brain');
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


console.log('\n- the brain cannot act on what it did not earn -\n');

const LISTS = {
  categories: ['tshirt', 'hoodie'],
  designs: ['Spider-Man', 'Venom'],
  colours: ['Red', 'Black'],
  sizes: ['S', 'M', 'L', 'XL', 'XXL'],
  facts: 'Spider-Man 2499. Venom 2499. Booking 500.',
};
const decides = (raw) =>
  brain.validate(typeof raw === 'string' ? raw : JSON.stringify(raw), LISTS);

const GOOD = {
  intent: 'pick_size',
  decision: 'select_size',
  confidence: 1,
  language: 'hi',
  product: 'Spider-Man',
  size: 'L',
};

check('a decision naming only real things is accepted', () => {
  const out = decides(GOOD);
  assert.ok(out.value, out.reason);
  assert.strictEqual(out.value.selection.product, 'Spider-Man');
  assert.strictEqual(out.value.selection.size, 'L');
});

check('malformed output decides nothing', () => {
  /**
   * Every one of these is a turn where the shop must fall back rather than
   * act. None of them may produce a decision object.
   */
  for (const raw of ['not json', '[]', 'null', '{"decision":', '']) {
    assert.ok(decides(raw).reason, `should be refused: ${JSON.stringify(raw)}`);
  }
});

check('a decision the backend cannot execute is refused', () => {
  assert.ok(decides({ ...GOOD, decision: 'refund_everything' }).reason);
  assert.ok(decides({ ...GOOD, intent: 'do_a_backflip' }).reason);
  assert.ok(decides({ ...GOOD, confidence: 7 }).reason);
});

check('a product, colour or size the shop does not have sinks the whole decision', () => {
  /**
   * Not repaired, not partially kept. A model that named a size the shop
   * does not stock was guessing, and the rest of what it said is not more
   * trustworthy for being well formed.
   */
  assert.ok(decides({ ...GOOD, product: 'Batman' }).reason, 'unknown design');
  assert.ok(decides({ ...GOOD, colour: 'Turquoise' }).reason, 'unknown colour');
  assert.ok(decides({ ...GOOD, size: 'XXXL' }).reason, 'unknown size');
  assert.ok(decides({ ...GOOD, category: 'furniture' }).reason, 'unknown department');
});

check('saying it needs to ask, without asking, is refused', () => {
  assert.ok(decides({ ...GOOD, needsClarification: true, clarification: '' }).reason);
  const asked = decides({ ...GOOD, needsClarification: true, clarification: 'Kaunsa design?' });
  assert.ok(asked.value, asked.reason);
  assert.strictEqual(asked.value.decision, 'clarify', 'an unsure decision becomes a question');
});

check('a quantity outside what the lot allows is refused', () => {
  assert.ok(decides({ ...GOOD, quantity: 0 }).reason);
  assert.ok(decides({ ...GOOD, quantity: 500 }).reason);
  assert.ok(decides({ ...GOOD, quantity: 1.5 }).reason);
  assert.strictEqual(decides({ ...GOOD, quantity: 2 }).value.selection.quantity, 2);
});

check('naming a design turns a browse into a selection', () => {
  /**
   * "venom" came back as show_products WITH the design named - browse the
   * department, and here is the exact thing they asked for. Acted on, it
   * put the customer back at the list they had just chosen from.
   */
  /**
   * Written with a browsing intent, because that is the case: somebody
   * asking to see a department who names a design in the same breath. The
   * fixture used to carry intent pick_size and a size, which a later rule
   * correctly reads as a size selection - a collision between two fixtures,
   * not between two rules.
   */
  const out = decides({
    intent: 'browse',
    decision: 'show_products',
    confidence: 1,
    language: 'hi',
    category: 'tshirt',
    product: 'Venom',
  });
  assert.strictEqual(out.value.decision, 'select_product');
});

check('words the shop cannot back up never reach a customer', () => {
  const invented = decides({ ...GOOD, decision: 'reply', reply: 'Haan bhai, 899 me de dunga.' });
  assert.ok(invented.reason, 'a price not in the facts must sink the decision');
  const linked = decides({ ...GOOD, decision: 'reply', reply: 'Pay at https://example.com' });
  assert.ok(linked.reason, 'a link must sink the decision');
});


console.log('\n- consent is read, not matched -\n');

const onSummary = (raw) =>
  brain.validate(JSON.stringify({ confidence: 1, language: 'hi', ...raw }), LISTS);

check('a decision to confirm survives validation', () => {
  const out = onSummary({ intent: 'confirm', decision: 'confirm_order' });
  assert.ok(out.value, out.reason);
  assert.strictEqual(out.value.decision, 'confirm_order');
});

check('declining is a decision of its own, not a failed yes', () => {
  const out = onSummary({ intent: 'cancel', decision: 'decline_order' });
  assert.ok(out.value, out.reason);
  assert.strictEqual(out.value.decision, 'decline_order');
});

check('an unsure confirmation becomes a question', () => {
  /**
   * The one that a word list cannot get right: "haan but size change karna
   * hai" contains a yes and is not one. Whatever the brain makes of it, an
   * unsure reading must never arrive as confirm_order.
   */
  const out = onSummary({
    intent: 'confirm',
    decision: 'confirm_order',
    needsClarification: true,
    clarification: 'Size badalna hai ya yahi confirm kar du?',
  });
  assert.strictEqual(out.value.decision, 'clarify');
});

check('the executor, not the brain, owns the order', () => {
  /**
   * The brain may ask for a confirmation. Whether that becomes an order is
   * decided by code that checks the state, the draft and live stock - and
   * none of it is reachable from the decision itself.
   */
  const fs = require('fs');
  const path = require('path');
  const executor = fs.readFileSync(path.join(__dirname, '..', 'src', 'bot', 'execute.js'), 'utf8');

  const gate = executor.slice(
    executor.indexOf("case 'confirm_order'"),
    executor.indexOf("case 'decline_order'")
  );
  assert.ok(/STATES\.ORDER_SUMMARY/.test(gate), 'the summary must be on screen');
  assert.ok(/buildDraft/.test(gate), 'the draft must be complete');
  assert.ok(/return null/.test(gate), 'a failed gate must mean no order');

  assert.ok(
    !/orderService|supabase|confirm_order_payment/.test(executor),
    'the executor must not reach the order or payment tables itself'
  );
});

check('the purchase path no longer reads a word list', () => {
  const fs = require('fs');
  const path = require('path');
  const flow = fs.readFileSync(path.join(__dirname, '..', 'src', 'bot', 'stateMachine.js'), 'utf8');
  const summary = flow.slice(
    flow.lastIndexOf('case STATES.ORDER_SUMMARY: {'),
    flow.lastIndexOf('case STATES.WAITING_FOR_PAYMENT')
  );
  const code = summary.replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.ok(!/parser\.isYes/.test(code), 'consent must not come from YES_WORDS');
  assert.ok(
    !/createOrderAndAskPayment/.test(code),
    'the order must be created behind the executor gates, not here'
  );
});


console.log(`\n${passed}/${passed + failed} passed\n`);
process.exit(failed ? 1 : 0);
