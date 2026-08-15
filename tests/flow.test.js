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
const conversationService = require('../src/services/conversationService');
const settingsService = require('../src/services/settingsService');
const bypassService = require('../src/services/bypassService');
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

  const originalStock = {
    'TS-BLK-L': await stockBySku('TS-BLK-L'),
    'TS-BLK-XXL': await stockBySku('TS-BLK-XXL'),
    'TS-WHT-L': await stockBySku('TS-WHT-L'),
    'BAG-BLK': await stockBySku('BAG-BLK'),
  };
  await setStock('TS-BLK-L', 3);
  await setStock('TS-BLK-XXL', 2);
  await setStock('TS-WHT-L', 0);
  await setStock('BAG-BLK', 15);
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
      assert.ok(products.length >= 2, 'expected T-Shirt and Bag');
      assert.strictEqual(await productService.stockOf(
        (await productService.getByCode('TS001')).id, 'Black', 'L'), 3);
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
      contains(await say(FRIEND, 'hi'), 'Welcome');
    });

    group('— bot switch & admin auth —');

    await test('7. /bot off silences the bot, /bot on restores it', async () => {
      const c = phone(10);
      contains(await say(ADMIN, '/bot off'), 'OFF');
      assert.strictEqual(await say(c, 'hi'), '', 'bot must be silent when off');
      contains(await say(ADMIN, '/stock'), 'STOCK'); // admin still works
      contains(await say(ADMIN, '/bot on'), 'ON');
      contains(await say(c, 'hi'), 'Welcome');
    });

    await test('8. admin command from a non-admin does nothing', async () => {
      const c = phone(11);
      await say(c, 'hi');
      const reply = await say(c, '/paid REP-9999');
      assert.ok(!reply.includes('CONFIRMED'), 'non-admin must not confirm anything');
    });

    group('— sales flow —');

    await test('9. new customer gets the welcome menu', async () => {
      const reply = await say(CUSTOMER, 'Hi');
      contains(reply, 'Welcome');
      contains(reply, 'T-Shirt');
      contains(reply, 'Bag');
      assert.strictEqual(await stateOf(CUSTOMER), 'SELECT_PRODUCT');
    });

    await test('10. T-Shirt -> colour -> size -> quantity', async () => {
      contains(await say(CUSTOMER, 'tshirt'), 'color');
      assert.strictEqual(await stateOf(CUSTOMER), 'SELECT_COLOR');
      contains(await say(CUSTOMER, 'black'), 'Size');
      assert.strictEqual(await stateOf(CUSTOMER), 'SELECT_SIZE');
      const reply = await say(CUSTOMER, 'size L');
      contains(reply, 'available hai');
      contains(reply, '₹699');
      assert.strictEqual(await stateOf(CUSTOMER), 'SELECT_QUANTITY');
    });

    await test('11. "black tshirt chahiye" fills product + colour in one message', async () => {
      const c = phone(12);
      const reply = await say(c, 'bhai reel wali black tshirt chahiye');
      contains(reply, 'Black T-Shirt available hai');
      contains(reply, 'Size bata do');
      assert.strictEqual(await stateOf(c), 'SELECT_SIZE');
    });

    await test('12. Bag skips colour and size', async () => {
      const c = phone(13);
      await say(c, 'hi');
      const reply = await say(c, 'bag chahiye');
      contains(reply, 'available hai');
      contains(reply, '₹999');
      assert.strictEqual(await stateOf(c), 'SELECT_QUANTITY');
    });

    await test('13. invalid colour is rejected', async () => {
      const c = phone(14);
      await say(c, 'hi');
      await say(c, 'tshirt');
      const reply = await say(c, 'purple');
      contains(reply, 'color samajh nahi aaya');
      assert.strictEqual(await stateOf(c), 'SELECT_COLOR');
    });

    await test('14. invalid size is rejected', async () => {
      const c = phone(15);
      await say(c, 'hi');
      await say(c, 'tshirt');
      await say(c, 'black');
      const reply = await say(c, 'XXXL');
      contains(reply, 'size samajh nahi aaya');
      assert.strictEqual(await stateOf(c), 'SELECT_SIZE');
    });

    await test('15. out-of-stock size is refused with alternatives', async () => {
      const c = phone(16);
      await say(c, 'hi');
      await say(c, 'tshirt');
      await say(c, 'white');
      const reply = await say(c, 'L');
      contains(reply, 'out of stock');
      contains(reply, 'Dusra size try kar sakte ho');
      assert.strictEqual(await stateOf(c), 'SELECT_SIZE');
    });

    await test('16. quantity above stock offers the available count', async () => {
      const c = phone(17);
      await say(c, 'hi');
      await say(c, 'tshirt');
      await say(c, 'black');
      await say(c, 'xxl');
      contains(await say(c, '7'), 'sirf 2 pieces available');
      assert.strictEqual(await stateOf(c), 'SELECT_QUANTITY');
      contains(await say(c, 'haan'), 'details');
      assert.strictEqual((await conversationService.get(c)).quantity, 2);
    });

    group('— details & order —');

    await test('17. details collected, then the order summary', async () => {
      contains(await say(CUSTOMER, '2'), 'details');
      assert.strictEqual(await stateOf(CUSTOMER), 'COLLECT_DETAILS');
      const reply = await say(
        CUSTOMER,
        'Name: Rahul Sharma\nAddress: 12 MG Road\nCity: Jaipur\nState: Rajasthan\nPIN: 302001'
      );
      contains(reply, 'ORDER SUMMARY');
      contains(reply, 'Rahul Sharma');
      contains(reply, '₹699 × 2');
      contains(reply, '1398');
      contains(reply, 'YES / NO');
      assert.strictEqual(await stateOf(CUSTOMER), 'ORDER_SUMMARY');
    });

    await test('18. stock is NOT reduced before payment confirmation', async () => {
      assert.strictEqual(await stockBySku('TS-BLK-L'), 3);
    });

    await test('19. YES creates a PENDING_PAYMENT order with the payment link', async () => {
      const reply = await say(CUSTOMER, 'yes');
      contains(reply, 'Total Amount');
      contains(reply, 'pay.example.com');
      contains(reply, 'screenshot');

      const order = await orderService.openFor(CUSTOMER);
      createdOrderIds.push(order.order_id);
      assert.strictEqual(order.status, 'PENDING_PAYMENT');
      assert.strictEqual(Number(order.total), 1398);
      assert.strictEqual(orderService.paymentOf(order).status, 'PENDING');
      assert.strictEqual(orderService.itemOf(order).quantity, 2);
      assert.strictEqual(await stateOf(CUSTOMER), 'WAITING_FOR_PAYMENT');
    });

    await test('20. order_items snapshot name, colour, size and price', async () => {
      const order = await orderService.openFor(CUSTOMER);
      const item = orderService.itemOf(order);
      assert.strictEqual(item.product_name_snapshot, 'T-Shirt');
      assert.strictEqual(item.color_snapshot, 'Black');
      assert.strictEqual(item.size_snapshot, 'L');
      assert.strictEqual(Number(item.unit_price), 699);
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
      contains(reply, 'Payment proof mil gaya');

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
      assert.strictEqual(await stockBySku('TS-BLK-L'), 3, 'proof must not move stock');
    });

    await test('23. /paid confirms atomically: PAID + CONFIRMED + stock 3→1 + HUMAN', async () => {
      const order = await orderService.openFor(CUSTOMER);
      const reply = await say(ADMIN, `/paid ${order.order_id}`);
      contains(reply, 'CONFIRMED');

      const after = await orderService.getByOrderId(order.order_id);
      assert.strictEqual(after.status, 'CONFIRMED');
      assert.strictEqual(orderService.paymentOf(after).status, 'VERIFIED');
      assert.strictEqual(orderService.paymentOf(after).verified_by, ADMIN);
      assert.strictEqual(await stockBySku('TS-BLK-L'), 1, 'stock must drop by 2');

      const toCustomer = sent.find((m) => m.phone === CUSTOMER);
      contains(toCustomer.text, 'confirm ho gaya');
      contains(toCustomer.text, 'agent personally assist');
      assert.strictEqual(await modeOf(CUSTOMER), 'HUMAN');
    });

    await test('24. HUMAN mode: bot stays completely silent', async () => {
      assert.strictEqual(await say(CUSTOMER, 'bhai?'), '');
      assert.strictEqual(await say(CUSTOMER, 'tshirt chahiye'), '');
      assert.strictEqual(await say(CUSTOMER, 'start'), '');
    });

    await test('25. /paid twice does not double-deduct stock', async () => {
      const orderId = createdOrderIds[0];
      const reply = await say(ADMIN, `/paid ${orderId}`);
      contains(reply, 'pehle se CONFIRMED');
      assert.strictEqual(await stockBySku('TS-BLK-L'), 1, 'stock must not move again');
    });

    await test('26. /resume puts the customer back on the bot', async () => {
      contains(await say(ADMIN, `/resume ${CUSTOMER}`), 'BOT mode');
      assert.strictEqual(await modeOf(CUSTOMER), 'BOT');
      contains(await say(CUSTOMER, 'menu'), 'Welcome');
    });

    await test('27. /human takes a customer off the bot', async () => {
      const c = phone(18);
      await say(c, 'hi');
      contains(await say(ADMIN, `/human ${c}`), 'HUMAN mode');
      assert.strictEqual(await say(c, 'tshirt'), '');
      assert.strictEqual(await modeOf(c), 'HUMAN');
    });

    await test('28. /reject fails payment, keeps stock, switches to HUMAN', async () => {
      const c = phone(19);
      await say(c, 'hi');
      await say(c, 'bag');
      await say(c, '1');
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
      await say(CUSTOMER, 'bag');
      const asked = await say(CUSTOMER, '1');
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
      contains(await say(c, 'hello', { id }), 'Welcome');
      assert.strictEqual(await say(c, 'hello', { id }), '', 'duplicate must not reply twice');
    });

    await test('31. customer asking for a human stops the sales flow', async () => {
      const c = phone(21);
      await say(c, 'hi');
      contains(await say(c, 'bhai mujhe owner se baat karni hai'), 'agent personally assist');
      assert.strictEqual(await modeOf(c), 'HUMAN');
      assert.strictEqual(await say(c, 'tshirt chahiye'), '');
    });

    await test('32. cancel closes the pending order', async () => {
      const c = phone(22);
      await say(c, 'hi');
      await say(c, 'bag');
      await say(c, '1');
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
      await say(a, 'tshirt');
      await say(b, 'bag');
      await say(a, 'black');
      assert.strictEqual(await stateOf(a), 'SELECT_SIZE');
      assert.strictEqual(await stateOf(b), 'SELECT_QUANTITY');
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
        await say(c, 'tshirt');
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
      contains(outgoing[0].text, 'Welcome', 'stored outgoing text');
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
      contains(outbox.map((m) => m.text).join('\n'), 'Welcome');
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
