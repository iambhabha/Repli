'use strict';

/**
 * Repli end-to-end tests.
 *
 * These run the REAL router, state machine and Supabase database with a fake
 * WhatsApp adapter, so they prove the production data path actually works.
 *
 *   npm test
 *
 * Safety:
 *  - every test phone number starts with the TEST_PREFIX below;
 *  - all rows created by the suite are deleted afterwards;
 *  - stock changed by /paid is restored afterwards;
 *  - nothing else in the database is touched.
 */

const assert = require('assert');
const path = require('path');

process.env.TEST_MODE = 'true';
process.env.PAYMENT_LINK = process.env.PAYMENT_LINK || 'https://pay.example.com/repli';

const realLog = console.log;
console.log = () => {}; // quieten the bot during the run

const config = require('../src/config');
const { supabase } = require('../src/db/supabase');
const { createRouter } = require('../src/bot/router');
const storage = require('../src/db/storage');
const conversationService = require('../src/services/conversationService');
const settingsService = require('../src/services/settingsService');
const bypassService = require('../src/services/bypassService');
const categoryService = require('../src/services/categoryService');
const productService = require('../src/services/productService');
const orderService = require('../src/services/orderService');

// Dedicated test numbers: 9199 + 8 digits, never a real customer.
const TEST_PREFIX = '91990000';
const phone = (n) => `${TEST_PREFIX}${String(n).padStart(4, '0')}`;

const ADMIN = phone(1);
const CUSTOMER = phone(2);
const FRIEND = phone(3);

// --- fake WhatsApp adapter --------------------------------------------------
const sent = [];

const bot = {
  async sendMessage(to, text) {
    sent.push({ phone: String(to), text, type: 'text' });
  },
  async sendImage(to, file, caption) {
    sent.push({ phone: String(to), text: caption || '', file, type: 'media' });
  },
  async sendMedia(to, file, caption) {
    return bot.sendImage(to, file, caption);
  },
  async notifyAdmins(text) {
    sent.push({ phone: ADMIN, text, type: 'text' });
  },
  async notifyAdminsImage(file, caption) {
    sent.push({ phone: ADMIN, text: caption, file, type: 'media' });
  },
  async markAsRead() {},
  isConnected: () => true,
};

const route = createRouter(bot);

let counter = 0;

async function say(to, text, options = {}) {
  sent.length = 0;
  await route({
    id: options.id || `test_${Date.now().toString(36)}_${++counter}`,
    phone: to,
    text,
    isMedia: false,
    ...options,
  });
  return sent.map((m) => m.text).join('\n---\n');
}

async function sendProof(to, options = {}) {
  sent.length = 0;
  await route({
    id: options.id || `test_${Date.now().toString(36)}_${++counter}`,
    phone: to,
    text: '',
    isMedia: true,
    media: { buffer: Buffer.from('fake-payment-screenshot'), mimetype: 'image/jpeg' },
    ...options,
  });
  return sent.map((m) => m.text).join('\n---\n');
}

const stateOf = async (p) => (await conversationService.get(p)).state;
const modeOf = async (p) => (await conversationService.get(p)).mode;

// --- runner -----------------------------------------------------------------
const results = [];
let failures = 0;
const createdOrderIds = [];

async function test(name, fn) {
  try {
    await fn();
    results.push(`  ✅ ${name}`);
  } catch (err) {
    failures++;
    results.push(`  ❌ ${name}\n       ${err.message.replace(/\n/g, '\n       ')}`);
  }
}

function contains(haystack, needle, label) {
  assert.ok(
    String(haystack).toLowerCase().includes(String(needle).toLowerCase()),
    `${label || 'reply'} should contain "${needle}" but was:\n${haystack}`
  );
}

const group = (title) => results.push(`\n  ${title}`);

// --- setup / teardown -------------------------------------------------------

async function cleanup() {
  const like = `${TEST_PREFIX}%`;

  const { data: orders } = await supabase.from('orders').select('id').like('phone', like);
  const orderIds = (orders || []).map((o) => o.id);
  if (orderIds.length) {
    /**
     * The screenshots these orders produced go to the shop's bucket as well
     * as to disk, and deleting the payment row does not delete the object.
     * Left alone, every run of this suite added a few more files nobody
     * pointed at - `npm run audit:storage` found thirty-six of them.
     *
     * Only objects belonging to THIS suite's own orders, resolved from the
     * rows about to be deleted. Nothing here guesses at a key.
     */
    const { data: payments } = await supabase
      .from('payments')
      .select('proof_object')
      .in('order_id', orderIds)
      .not('proof_object', 'is', null);

    for (const payment of payments || []) {
      await storage.remove(payment.proof_object).catch(() => {});
    }

    await supabase.from('payments').delete().in('order_id', orderIds);
    await supabase.from('order_items').delete().in('order_id', orderIds);
    await supabase.from('orders').delete().in('id', orderIds);
  }

  await supabase.from('messages').delete().like('phone', like);
  await supabase.from('conversations').delete().like('phone', like);
  await supabase.from('customers').delete().like('phone', like);
  await supabase.from('bypass_numbers').delete().like('phone', like);
  await supabase.from('admin_numbers').delete().like('phone', like);
}

async function setStock(sku, quantity) {
  await supabase.from('product_variants').update({ stock_quantity: quantity }).eq('sku', sku);
  productService.invalidate();
}

async function stockBySku(sku) {
  const { data } = await supabase
    .from('product_variants')
    .select('stock_quantity')
    .eq('sku', sku)
    .single();
  return data.stock_quantity;
}

// ---------------------------------------------------------------------------

async function main() {
  await cleanup();

  // register the test admin, and remember the real stock so we can restore it
  await supabase.from('admin_numbers').insert({ phone: ADMIN, name: 'test admin' });
  settingsService.invalidate();

  // AESTHURA catalogue. Real lot quantities are set by the owner in the
  // panel and start at 0, so the suite sets its own and puts them back.
  const originalStock = {
    'AES-TS-SPIDER-L': await stockBySku('AES-TS-SPIDER-L'),
    'AES-TS-SPIDER-XXL': await stockBySku('AES-TS-SPIDER-XXL'),
    'AES-TS-VENOM-L': await stockBySku('AES-TS-VENOM-L'),
    'AES-TS-VENOM-M': await stockBySku('AES-TS-VENOM-M'),
    'AES-HD-BAPE-S-L': await stockBySku('AES-HD-BAPE-S-L'),
  };
  await setStock('AES-TS-SPIDER-L', 3);
  await setStock('AES-TS-SPIDER-XXL', 2);
  await setStock('AES-TS-VENOM-L', 0); // sold out, for the alternatives test
  await setStock('AES-TS-VENOM-M', 4);
  await setStock('AES-HD-BAPE-S-L', 5);
  await settingsService.setBotEnabled(true);

  try {
    group('— connection & normalisation —');

    await test('1. Supabase connection works', async () => {
      const { error } = await supabase.from('products').select('id').limit(1);
      assert.ok(!error, `supabase error: ${error && error.message}`);
    });

    await test('2. phone formats normalise to one key', async () => {
      assert.strictEqual(config.normalisePhone('+91 98765 43210'), '919876543210');
      assert.strictEqual(config.normalisePhone('09876543210'), '919876543210');
      assert.strictEqual(config.normalisePhone('9876543210'), '919876543210');
      assert.strictEqual(config.normalisePhone('919876543210@c.us'), '919876543210');
    });

    await test('3. products and stock load from the database', async () => {
      const products = await productService.activeProducts();
      assert.ok(products.length >= 2, 'expected the AESTHURA designs');
      const spider = await productService.getByCode('AES-TS-SPIDER');
      assert.strictEqual(Number(spider.price), 2499);
      assert.strictEqual(Number(spider.booking_amount), 500);
      assert.strictEqual(await productService.stockOf(spider.id, 'Red', 'L'), 3);
    });

    group('— bypass (critical) —');

    await test('4. bypass number gets NO reply, NO state, NO rows', async () => {
      await say(ADMIN, `/bypass add ${FRIEND} Brother`);

      for (const text of ['hello', 'bhai kya kar raha hai?', 'ghar kab aa raha hai?']) {
        const reply = await say(FRIEND, text);
        assert.strictEqual(reply, '', `bypass number must get no reply, got:\n${reply}`);
      }

      assert.strictEqual(await stateOf(FRIEND), 'START', 'no conversation state');
      const { data: convo } = await supabase
        .from('conversations').select('id').eq('phone', FRIEND).maybeSingle();
      assert.strictEqual(convo, null, 'no conversation row may be created');
      const { data: msgs } = await supabase.from('messages').select('id').eq('phone', FRIEND);
      assert.strictEqual((msgs || []).length, 0, 'no message rows may be created');
      const { data: cust } = await supabase
        .from('customers').select('id').eq('phone', FRIEND).maybeSingle();
      assert.strictEqual(cust, null, 'no customer row may be created');
    });

    await test('5. bypass matches whatever format the number arrives in', async () => {
      assert.strictEqual(await say(`+${FRIEND}`, 'tshirt chahiye'), '');
      assert.strictEqual(await say(FRIEND.slice(2), 'bag'), '');
    });

    await test('6. /bypass list and /bypass remove work', async () => {
      contains(await say(ADMIN, '/bypass list'), FRIEND);
      contains(await say(ADMIN, `/bypass remove ${FRIEND}`), 'hat gaya');
      contains(await say(FRIEND, 'hi'), 'T-Shirts');
    });

    group('— bot switch & admin auth —');

    await test('7. /bot off silences the bot, /bot on restores it', async () => {
      const c = phone(10);
      contains(await say(ADMIN, '/bot off'), 'OFF');
      assert.strictEqual(await say(c, 'hi'), '', 'bot must be silent when off');
      contains(await say(ADMIN, '/stock'), 'STOCK'); // admin still works
      contains(await say(ADMIN, '/bot on'), 'ON');
      contains(await say(c, 'hi'), 'T-Shirts');
    });

    await test('8. admin command from a non-admin does nothing', async () => {
      const c = phone(11);
      await say(c, 'hi');
      const reply = await say(c, '/paid REP-9999');
      assert.ok(!reply.includes('CONFIRMED'), 'non-admin must not confirm anything');
    });

    group('— sales flow —');

    await test('9. new customer gets a greeting, then the categories', async () => {
      const reply = await say(CUSTOMER, 'Hi');
      // The greeting names the shop, and that name is a settings row - so
      // the test reads it from there rather than hardcoding today's brand.
      const { data: brand } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'greeting_brands')
        .maybeSingle();
      contains(reply, brand?.value ?? '3POINTER.CLUB');
      contains(reply, 'T-Shirts'); // categories, straight from the database
      contains(reply, 'Hoodies');
      assert.ok(!reply.includes('Spider-Man'), 'designs come after a category is chosen');
      assert.ok(!reply.includes('2499'), `price must not be led with:\n${reply}`);
      assert.strictEqual(await stateOf(CUSTOMER), 'SELECT_CATEGORY');
    });

    await test('9b. a category with nothing to sell is not offered', async () => {
      /**
       * Written against whichever category the shop CAN currently sell,
       * then emptied on purpose.
       *
       * This used to assert that "Bags" never appeared, because the Bags
       * row had no products the day it was written. The day the shop
       * stocked a bag the test failed - and it had found no bug, only its
       * own assumption about live data. What it is actually for is the
       * rule that a sold-out category stays hidden, so it now creates the
       * sold-out category itself and puts the stock back afterwards.
       */
      const categories = await categoryService.availableCategories();
      assert.ok(categories.length >= 2, 'this test needs two sellable categories');

      const victim = categories[categories.length - 1];
      const inCategory = (await productService.activeProducts()).filter(
        (item) => item.category === victim.key
      );
      // A made-to-order product is sellable with no stock at all, so it
      // could never be emptied this way.
      if (inCategory.some((item) => item.made_to_order)) return;

      const saved = [];
      for (const item of inCategory) {
        for (const variant of await productService.variantsOf(item.id)) {
          saved.push({ id: variant.id, qty: variant.stock_quantity });
        }
      }
      assert.ok(saved.length, 'the chosen category needs variants to empty');

      try {
        for (const row of saved) {
          await supabase.from('product_variants').update({ stock_quantity: 0 }).eq('id', row.id);
        }
        await productService.invalidate();

        const reply = await say(phone(31), 'hello');
        assert.ok(!reply.includes(victim.label), 'a sold-out category must stay hidden: ' + reply);
      } finally {
        for (const row of saved) {
          await supabase
            .from('product_variants')
            .update({ stock_quantity: row.qty })
            .eq('id', row.id);
        }
        await productService.invalidate();
      }
    });

    await test('9c. picking a category by number shows only its designs', async () => {
      const reply = await say(CUSTOMER, '1');
      contains(reply, 'Spider-Man');
      contains(reply, 'Venom');
      assert.ok(!reply.includes('BAPE'), 'hoodies belong to the other category');
      assert.strictEqual(await stateOf(CUSTOMER), 'SELECT_PRODUCT');
    });

    await test('10. "I need a T-shirt" shows both designs, picks neither', async () => {
      const reply = await say(CUSTOMER, 'I need a t-shirt');
      contains(reply, 'Spider-Man');
      contains(reply, 'Venom');
      assert.ok(!reply.includes('2499'), 'still no price at this stage');
      assert.strictEqual(await stateOf(CUSTOMER), 'SELECT_PRODUCT');
    });

    await test('11. design -> size (colour is implied, never asked)', async () => {
      const reply = await say(CUSTOMER, 'spiderman');
      contains(reply, 'size');
      assert.ok(!/colou?r\?/i.test(reply), `colour must not be asked:\n${reply}`);
      assert.strictEqual(await stateOf(CUSTOMER), 'SELECT_SIZE');
    });

    await test('12. size chosen -> price and the booking split appear', async () => {
      const reply = await say(CUSTOMER, 'size L');
      contains(reply, '2499');
      contains(reply, '500');
      contains(reply, '1999');
      assert.strictEqual(await stateOf(CUSTOMER), 'COLLECT_DETAILS');
    });

    await test('13. "venom chahiye" jumps straight to the size question', async () => {
      const c = phone(12);
      const reply = await say(c, 'bhai venom wali chahiye');
      contains(reply, 'size');
      assert.strictEqual(await stateOf(c), 'SELECT_SIZE');
    });

    await test('14. invalid size is rejected', async () => {
      const c = phone(15);
      await say(c, 'hi');
      await say(c, 'spiderman');
      /**
       * The state going IN, so nothing below can pass by accident.
       *
       * Checking only afterwards would be satisfied by a size stored on an
       * earlier turn - the test would prove nothing about how XXXL itself
       * was handled.
       */
      const before = await conversationService.get(c);
      assert.strictEqual(before.state, 'SELECT_SIZE', 'on the size step to begin with');
      assert.ok(!(before.data && before.data.size), 'and no size chosen yet');

      const reply = await say(c, 'XXXL');
      /**
       * Behaviour, not punctuation.
       *
       * This asserted the reply contained a question mark, as a proxy for
       * "asks again". The brain answered "XXXL available nahi hai. Aap S, M,
       * L, XL ya XXL mein se koi size choose kar sakte hain." - which names
       * the real sizes, invites a choice and leaves them on the step, and
       * fails only because it ends in a full stop.
       *
       * What actually matters is checked instead: the sizes the shop really
       * has are named, the size that does not exist is not confirmed, and
       * the customer has not been moved.
       */
      const after = await conversationService.get(c);

      /**
       * The business fact first, because that is what must never vary.
       *
       * Four runs of this exact turn produced four different sentences and
       * one identical decision: the size was refused and nothing was stored.
       * Asserting the sentence made a passing behaviour fail roughly one run
       * in five; asserting the decision does not, and it is the thing that
       * would actually hurt a customer if it changed.
       */
      assert.strictEqual(after.state, 'SELECT_SIZE', 'they stay on the size step');
      assert.ok(
        !(after.data && after.data.size),
        `a size the shop does not sell must never be stored: ${JSON.stringify(after.data)}`
      );

      /**
       * Presentation, checked against the sizes the shop really has.
       *
       * The first version built one regex per size out of a template
       * literal, and the escape it used was a backspace character rather
       * than a word boundary. It matched nothing, ever, and failed a reply
       * that had listed every size correctly. Tokenising and comparing
       * against the database needs no escaping and cannot rot that way.
       */
      const onScreen = await productService.getById(after.selected_product_id);
      const realSizes = await productService.sizesOf(onScreen);
      const words = new Set(reply.toUpperCase().split(/[^A-Za-z0-9]+/).filter(Boolean));
      const offered = realSizes.filter((size) => words.has(String(size).toUpperCase()));

      assert.ok(
        offered.length >= 2,
        `should offer sizes the shop actually has (${realSizes.join('/')}):
${reply}`
      );
    });

    await test('15. out-of-stock size is refused with alternatives', async () => {
      const c = phone(16);
      await say(c, 'hi');
      await say(c, 'venom');
      const reply = await say(c, 'L');
      contains(reply, 'out of stock');
      assert.strictEqual(await stateOf(c), 'SELECT_SIZE');
    });

    await test('16. hoodie: no colour question, sizes only', async () => {
      const c = phone(17);
      await say(c, 'hi');
      const reply = await say(c, 'bape single hood');
      contains(reply, 'size');
      assert.ok(!/colou?r\?/i.test(reply), 'hoodies have no colour to pick');
      assert.strictEqual(await stateOf(c), 'SELECT_SIZE');

      const priced = await say(c, 'L');
      contains(priced, '3999');
      contains(priced, '1500'); // BAPE booking
      contains(priced, '2499'); // remaining
    });

    group('— questions are answered where they are asked —');

    await test('16b. price asked mid-flow: answered, flow not lost', async () => {
      const c = phone(28);
      await say(c, 'hi');
      await say(c, 'spiderman');
      assert.strictEqual(await stateOf(c), 'SELECT_SIZE');

      const reply = await say(c, 'bhai kitne ka hai?');
      contains(reply, '2499');
      contains(reply, '500');
      assert.strictEqual(await stateOf(c), 'SELECT_SIZE', 'a question must not reset the flow');

      contains(await say(c, 'L'), '2499'); // and the flow carries on
    });

    await test('16c. material, waiting time, COD and pickup come from stored facts', async () => {
      const c = phone(29);
      await say(c, 'hi');
      await say(c, 'spiderman');

      contains(await say(c, 'material kya hai?'), 'cotton');
      contains(await say(c, 'kitne din lagenge?'), '15');
      contains(await say(c, 'cod hai kya?'), '2699'); // 2499 + 200
      contains(await say(c, 'pickup kahan se hai?'), 'Dadar');
      assert.strictEqual(await stateOf(c), 'SELECT_SIZE');
    });

    await test('16d. waiting time is never volunteered', async () => {
      const c = phone(30);
      const first = await say(c, 'hi');
      const second = await say(c, 'spiderman');
      for (const reply of [first, second]) {
        assert.ok(!/15.?20|20.?30/.test(reply), `wait time must only follow a question:\n${reply}`);
      }
    });

    group('— details & order —');

    await test('16e. the scanner goes out with the details prompt', async () => {
      /**
       * Where a customer is asked to pay is the one place the QR belongs:
       * beside "order complete karne ke liye details bhej do", so they can
       * scan while they type. It used to arrive only after the whole form
       * was filled in and the order created - by which point the impatient
       * half of customers had already asked where to send the money.
       *
       * Driven fresh rather than read off the shared customer, because
       * say() clears the recording on every call and the prompt in question
       * went out several turns ago.
       */
      const c = phone(41);
      await say(c, 'hi');
      await say(c, 'tshirt');
      await say(c, 'spiderman');
      await say(c, 'L');

      assert.strictEqual(await stateOf(c), 'COLLECT_DETAILS');
      assert.ok(
        sent.some((m) => m.phone === c && m.type === 'media'),
        'the details prompt must carry the scanner'
      );
      assert.ok(
        !sent.some((m) => m.type === 'text' && m.text.includes('pay.example.com')),
        'and never the typed link alongside it'
      );
    });

    await test('17. details collected, then the order summary', async () => {
      assert.strictEqual(await stateOf(CUSTOMER), 'COLLECT_DETAILS');
      const reply = await say(
        CUSTOMER,
        'Name: Rahul Sharma\nAddress: 12 MG Road\nCity: Jaipur\nState: Rajasthan\nPIN: 302001'
      );
      contains(reply, 'ORDER SUMMARY');
      contains(reply, 'Rahul Sharma');
      contains(reply, '2499');
      assert.strictEqual(await stateOf(CUSTOMER), 'ORDER_SUMMARY');
    });

    await test('18. stock is NOT reduced before payment confirmation', async () => {
      assert.strictEqual(await stockBySku('AES-TS-SPIDER-L'), 3);
    });

    await test('19. YES creates a booking, not a full-price order', async () => {
      const reply = await say(CUSTOMER, 'yes');
      contains(reply, '500'); // due now
      contains(reply, '1999'); // due when it is ready
      /**
       * Where to pay is the SCANNER now, not a line of text.
       *
       * This used to assert the typed UPI id appeared in the message. It
       * stopped being true the day the shop uploaded a QR, and that was
       * the point: the two disagreed with each other, so only one of them
       * is sent. The rule worth testing is that exactly one destination
       * goes out - which is checked here and, for the no-scanner case, in
       * the test below.
       */
      assert.ok(
        !reply.includes('pay.example.com'),
        `a typed link must not accompany the scanner:
${reply}`
      );
      /**
       * And the scanner comes with it.
       *
       * This assertion used to say the opposite - that the QR must NOT be
       * repeated, because the customer already had it from the details
       * prompt. Watching real conversations changed the shop's mind: by this
       * point the scanner is buried above a couple of product photos and a
       * typed-out address, and a booking number with nothing to pay into is
       * a dead end. The property being tested is unchanged - exactly one
       * payment destination, and it is the picture, never a typed line.
       */
      assert.ok(
        sent.some((m) => m.phone === CUSTOMER && m.type === 'media'),
        'the booking number must carry the scanner, so there is something to pay into'
      );
      contains(reply, 'screenshot');

      const order = await orderService.openFor(CUSTOMER);
      createdOrderIds.push(order.order_id);
      assert.strictEqual(order.status, 'PENDING_PAYMENT');
      assert.strictEqual(Number(order.total), 2499);
      assert.strictEqual(Number(order.booking_amount), 500, 'booking amount stored on the order');
      assert.strictEqual(Number(order.remaining_amount), 1999, 'remainder stored on the order');
      assert.strictEqual(order.payment_mode, 'BOOKING');
      assert.strictEqual(order.brand, 'AESTHURA');
      assert.strictEqual(orderService.paymentOf(order).status, 'PENDING');
      assert.strictEqual(orderService.itemOf(order).quantity, 1, 'a booking is one piece');
      assert.strictEqual(await stateOf(CUSTOMER), 'WAITING_FOR_PAYMENT');
    });

    await test('20. order_items snapshot name, colour, size and price', async () => {
      const order = await orderService.openFor(CUSTOMER);
      const item = orderService.itemOf(order);
      assert.strictEqual(item.product_name_snapshot, 'Spider-Man T-Shirt');
      assert.strictEqual(item.color_snapshot, 'Red');
      assert.strictEqual(item.size_snapshot, 'L');
      assert.strictEqual(Number(item.unit_price), 2499);
      assert.ok(item.variant_id, 'variant should be linked');
    });

    await test('21. customer row saved with normalised phone', async () => {
      const { data } = await supabase
        .from('customers').select('*').eq('phone', CUSTOMER).maybeSingle();
      assert.ok(data, 'customer row exists');
      assert.strictEqual(data.name, 'Rahul Sharma');
      assert.strictEqual(data.pin, '302001');
    });

    group('— payment verification —');

    await test('22. screenshot -> PAYMENT_VERIFYING + admin alert, NOT confirmed', async () => {
      const reply = await sendProof(CUSTOMER);
      contains(reply, 'proof', 'customer gets an acknowledgement');

      const adminMessages = sent.filter((m) => m.phone === ADMIN);
      assert.ok(adminMessages.length > 0, 'admin must be notified');
      contains(adminMessages[0].text, 'PAYMENT VERIFICATION');

      const order = await orderService.openFor(CUSTOMER);
      assert.strictEqual(order.status, 'PAYMENT_VERIFYING');
      assert.strictEqual(orderService.paymentOf(order).status, 'PROOF_RECEIVED');

      const proof = orderService.paymentOf(order).proof_url;
      assert.ok(proof, 'proof_url recorded');
      assert.ok(require('fs').existsSync(path.join(config.ROOT, proof)), 'proof file on disk');
      assert.strictEqual(await stateOf(CUSTOMER), 'PAYMENT_VERIFYING');
      assert.strictEqual(await stockBySku('AES-TS-SPIDER-L'), 3, 'proof must not move stock');
    });

    await test('23. /paid confirms atomically: PAID + CONFIRMED + stock 3→2 + HUMAN', async () => {
      const order = await orderService.openFor(CUSTOMER);
      const reply = await say(ADMIN, `/paid ${order.order_id}`);
      contains(reply, 'CONFIRMED');

      const after = await orderService.getByOrderId(order.order_id);
      assert.strictEqual(after.status, 'CONFIRMED');
      assert.strictEqual(orderService.paymentOf(after).status, 'VERIFIED');
      assert.strictEqual(orderService.paymentOf(after).verified_by, ADMIN);
      assert.strictEqual(await stockBySku('AES-TS-SPIDER-L'), 2, 'stock must drop by 1');

      const toCustomer = sent.find((m) => m.phone === CUSTOMER);
      contains(toCustomer.text, 'confirmed');
      contains(toCustomer.text, 'assist');
      assert.strictEqual(await modeOf(CUSTOMER), 'HUMAN');
    });

    await test('24. HUMAN mode: bot stays completely silent', async () => {
      assert.strictEqual(await say(CUSTOMER, 'bhai?'), '');
      assert.strictEqual(await say(CUSTOMER, 'spiderman chahiye'), '');
      assert.strictEqual(await say(CUSTOMER, 'start'), '');
    });

    await test('25. /paid twice does not double-deduct stock', async () => {
      const orderId = createdOrderIds[0];
      const reply = await say(ADMIN, `/paid ${orderId}`);
      contains(reply, 'pehle se CONFIRMED');
      assert.strictEqual(await stockBySku('AES-TS-SPIDER-L'), 2, 'stock must not move again');
    });

    await test('26. /resume puts the customer back on the bot', async () => {
      contains(await say(ADMIN, `/resume ${CUSTOMER}`), 'BOT mode');
      assert.strictEqual(await modeOf(CUSTOMER), 'BOT');
      contains(await say(CUSTOMER, 'menu'), 'T-Shirts');
    });

    await test('27. /human takes a customer off the bot', async () => {
      const c = phone(18);
      await say(c, 'hi');
      contains(await say(ADMIN, `/human ${c}`), 'HUMAN mode');
      assert.strictEqual(await say(c, 'spiderman'), '');
      assert.strictEqual(await modeOf(c), 'HUMAN');
    });

    await test('28. /reject fails payment, keeps stock, switches to HUMAN', async () => {
      const c = phone(19);
      await say(c, 'hi');
      await say(c, 'bape single hood');
      await say(c, 'L');
      await say(c, 'Name: Vikas\nAddress: 9 Lake Road\nCity: Pune\nState: Maharashtra\nPIN: 411001');
      await say(c, 'yes');
      const order = await orderService.openFor(c);
      createdOrderIds.push(order.order_id);
      await sendProof(c);

      const before = await stockBySku('BAG-BLK');
      contains(await say(ADMIN, `/reject ${order.order_id}`), 'PAYMENT_FAILED');

      const after = await orderService.getByOrderId(order.order_id);
      assert.strictEqual(after.status, 'PAYMENT_FAILED');
      assert.strictEqual(orderService.paymentOf(after).status, 'REJECTED');
      assert.strictEqual(await stockBySku('BAG-BLK'), before, 'reject must not touch stock');
      assert.strictEqual(await modeOf(c), 'HUMAN');
    });

    group('— returning customer & safety —');

    await test('29. existing customer is asked before the saved address is reused', async () => {
      await say(ADMIN, `/resume ${CUSTOMER}`);
      await say(CUSTOMER, 'menu');
      await say(CUSTOMER, 'bape single hood');
      const asked = await say(CUSTOMER, 'L');
      contains(asked, 'purani details');
      contains(asked, 'Rahul Sharma');
      contains(asked, 'YES - same address');

      const summary = await say(CUSTOMER, 'yes');
      contains(summary, 'ORDER SUMMARY');
      contains(summary, 'Rahul Sharma');
      assert.strictEqual(await stateOf(CUSTOMER), 'ORDER_SUMMARY');
    });

    await test('30. duplicate message id is ignored', async () => {
      const c = phone(20);
      const id = `dup_${Date.now().toString(36)}`;
      contains(await say(c, 'hello', { id }), 'T-Shirts');
      assert.strictEqual(await say(c, 'hello', { id }), '', 'duplicate must not reply twice');
    });

    await test('31. customer asking for a human stops the sales flow', async () => {
      const c = phone(21);
      await say(c, 'hi');
      contains(await say(c, 'bhai mujhe owner se baat karni hai'), 'agent personally assist');
      assert.strictEqual(await modeOf(c), 'HUMAN');
      assert.strictEqual(await say(c, 'spiderman chahiye'), '');
    });

    await test('32. cancel closes the pending order', async () => {
      const c = phone(22);
      await say(c, 'hi');
      await say(c, 'bape single hood');
      await say(c, 'L');
      await say(c, 'Name: Sunil\nAddress: 5 Park Street\nCity: Kolkata\nState: West Bengal\nPIN: 700016');
      await say(c, 'yes');
      const order = await orderService.openFor(c);
      createdOrderIds.push(order.order_id);

      contains(await say(c, 'cancel'), 'cancel kar diya');
      const after = await orderService.getByOrderId(order.order_id);
      assert.strictEqual(after.status, 'CANCELLED');
    });

    await test('33. two customers keep separate state', async () => {
      const a = phone(23);
      const b = phone(24);
      await say(a, 'hi');
      await say(b, 'hi');
      await say(a, 'spiderman');
      await say(b, 'bape single hood');
      assert.strictEqual(await stateOf(a), 'SELECT_SIZE', 'a is picking a size');
      assert.strictEqual(await stateOf(b), 'SELECT_SIZE', 'b is on its own hoodie');
      await say(a, 'L');
      assert.strictEqual(await stateOf(a), 'COLLECT_DETAILS');
      assert.strictEqual(await stateOf(b), 'SELECT_SIZE', 'b must not move when a does');
    });

    await test('34. order ids are unique and sequential', async () => {
      const a = await orderService.nextOrderId();
      const b = await orderService.nextOrderId();
      assert.notStrictEqual(a, b);
      assert.ok(/^REP-\d+$/.test(a), `unexpected order id ${a}`);
    });

    await test('35. errors hand over to a human without leaking details', async () => {
      const c = phone(25);
      await say(c, 'hi');
      const original = productService.activeProducts;
      productService.activeProducts = async () => {
        throw new Error('boom: secret internal detail');
      };
      try {
        await say(c, 'spiderman');
      } finally {
        productService.activeProducts = original;
      }
      const toCustomer = sent.filter((m) => m.phone === c).map((m) => m.text).join('\n');
      contains(toCustomer, 'technical issue');
      assert.ok(!toCustomer.includes('boom'), 'customer must not see the raw error');
      contains(sent.filter((m) => m.phone === ADMIN).map((m) => m.text).join('\n'), 'boom', 'admin alert');
      assert.strictEqual(await modeOf(c), 'HUMAN');
    });

    await test('36. messages table records both directions', async () => {
      // uses the REAL adapter (mock driver) so sendMessage's logging runs;
      // the fake `bot` above replaces sendMessage and would bypass it.
      const { createAdapter } = require('../src/whatsapp/adapter');
      const adapter = createAdapter('mock');
      adapter.onMessage(createRouter(adapter));

      const c = phone(27);
      await adapter.simulateIncomingMessage(c, 'hi');

      const { data: incoming } = await supabase
        .from('messages').select('id').eq('phone', c).eq('direction', 'INCOMING');
      const { data: outgoing } = await supabase
        .from('messages').select('id, text').eq('phone', c).eq('direction', 'OUTGOING');
      assert.ok(incoming.length > 0, 'incoming messages stored');
      assert.ok(outgoing.length > 0, 'outgoing messages stored');
      contains(outgoing.map((m) => m.text).join('\n'), 'T-Shirts', 'stored outgoing text');
    });

    await test('37. /orders, /order, /stock, /product, /help work', async () => {
      contains(await say(ADMIN, '/orders'), 'RECENT ORDERS');
      contains(await say(ADMIN, `/order ${createdOrderIds[0]}`), createdOrderIds[0]);
      contains(await say(ADMIN, '/stock'), 'STOCK');
      contains(await say(ADMIN, '/product'), 'PRODUCTS');
      contains(await say(ADMIN, '/help'), 'ADMIN COMMANDS');
    });

    await test('38. TEST_MODE simulateIncomingMessage drives the whole pipeline', async () => {
      const { createAdapter } = require('../src/whatsapp/adapter');
      const adapter = createAdapter('mock');
      const outbox = [];
      adapter.sendMessage = async (to, text) => outbox.push({ to, text });
      adapter.onMessage(createRouter(adapter));

      const c = phone(26);
      await adapter.simulateIncomingMessage(c, 'hi');
      assert.ok(outbox.length > 0, 'simulated message should produce a reply');
      contains(outbox.map((m) => m.text).join('\n'), 'T-Shirts');
    });
  } finally {
    // --- restore everything -------------------------------------------------
    for (const [sku, qty] of Object.entries(originalStock)) await setStock(sku, qty);
    await settingsService.setBotEnabled(true);
    await cleanup();
    productService.invalidate();
    settingsService.invalidate();
    bypassService.invalidate();
  }

  console.log = realLog;
  console.log('\nREPLI — Supabase end-to-end tests');
  console.log(results.join('\n'));
  const total = results.filter((r) => r.includes('✅') || r.includes('❌')).length;
  console.log(`\n${total - failures}/${total} passed${failures ? ` — ${failures} FAILED` : ''}\n`);
  process.exit(failures ? 1 : 0);
}

main().catch(async (err) => {
  console.log = realLog;
  console.error('\nTest harness crashed:\n', err);
  try {
    await cleanup();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
