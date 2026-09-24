'use strict';

/**
 * Drive the agent through a real conversation and watch what it does.
 *
 * Not a unit test and not mocked: it calls the real model, reads the real
 * catalogue, and writes real rows for one reserved number. That is the point -
 * the thing worth knowing about an agent is whether it reaches for the right
 * tool when a customer says something nobody scripted, and a fake model
 * answers that question about the fake.
 *
 *   node tests/agent.test.js
 *
 * The number below starts 91990000, the prefix the rest of the suite reserves
 * for itself, and everything it creates is removed at the end. It costs a few
 * rupees of model time per run.
 */

// No dotenv: src/config reads .env itself, and dotenv is not a dependency of
// this project - requiring it here meant this file threw on its first line.
const assert = require('assert');
const agent = require('../src/agent');
const { supabase } = require('../src/db/supabase');
const conversationService = require('../src/services/conversationService');
const productService = require('../src/services/productService');
const orderService = require('../src/services/orderService');

const PHONE = '919900000077';

/** A bot that says everything to the console instead of to WhatsApp. */
function fakeBot() {
  const sent = [];
  return {
    sent,
    async sendMessage(phone, text) {
      sent.push({ kind: 'text', text });
      console.log(`\n  shop → ${text}\n`);
    },
    async sendImage(phone, filePath, caption) {
      sent.push({ kind: 'image', filePath });
      console.log(`  shop → [image ${String(filePath).split(/[\\/]/).pop()}]`);
    },
    async notifyAdmins(text) {
      console.log(`  (admin alert: ${String(text).split('\n')[0]})`);
    },
    async notifyAdminsImage() {},
    async markAsRead() {},
  };
}

async function say(bot, text) {
  console.log(`  customer → ${text}`);
  // The router normally claims the incoming row before handing over; the
  // agent reads the transcript back, so the turn has to be recorded here too.
  await supabase.from('messages').insert({
    message_id: `agenttest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    phone: PHONE,
    direction: 'INCOMING',
    message_type: 'text',
    text,
  });
  const action = await agent.handleMessage(bot, {
    id: `sim_${Date.now()}`,
    phone: PHONE,
    text,
    isMedia: false,
    media: null,
  });
  const reply = bot.sent[bot.sent.length - 1];
  return { action, reply: reply && reply.text ? reply.text : '' };
}

async function cleanup() {
  await supabase.from('orders').delete().eq('phone', PHONE);
  await supabase.from('messages').delete().eq('phone', PHONE);
  await supabase.from('conversations').delete().eq('phone', PHONE);
  await supabase.from('customers').delete().eq('phone', PHONE);
}

async function main() {
  await cleanup();

  const products = await productService.activeProducts();
  assert.ok(products.length, 'the shop needs at least one active product to test against');
  const product = products[0];
  console.log(`\nTesting against a live catalogue of ${products.length} products.`);
  console.log(`Using "${product.name}" for the order.\n`);

  const bot = fakeBot();
  let failures = 0;
  const check = (label, condition, detail) => {
    console.log(`  ${condition ? '✓' : '✗'} ${label}${condition ? '' : ` — ${detail}`}`);
    if (!condition) failures += 1;
  };

  // --- 1. an opening nobody scripted -------------------------------------
  console.log('1. Off-script opening');
  const hello = await say(bot, 'bhai reel dekhi thi tumhari, kya kya hai?');
  check('replied at all', Boolean(hello.reply), 'no reply came back');
  check(
    'did not invent a product',
    !/lehenga|saree|jeans/i.test(hello.reply),
    'named something the shop does not sell'
  );

  // --- 2. the case that broke the old bot ---------------------------------
  // Pure chitchat mid-conversation. The rule engine answered this with
  // "please send your delivery address", over and over.
  console.log('\n2. Chitchat mid-conversation');
  const chat = await say(bot, 'bhai phone kharab hua pada hai, call nahi kar sakta');
  check('acknowledged it', Boolean(chat.reply), 'nothing came back');
  check(
    'did not demand an address out of nowhere',
    !/address|pata|pin code/i.test(chat.reply),
    `replied: ${chat.reply}`
  );

  // --- 3. asking for something real ---------------------------------------
  console.log('\n3. Asking about a real product');
  const ask = await say(bot, `${product.name} ka kya rate hai?`);
  const price = Math.round(Number(product.price) || 0);
  check('quoted the real price', ask.reply.includes(String(price)), `expected ${price}, got: ${ask.reply}`);

  // --- 4. it must not confirm money ---------------------------------------
  console.log('\n4. Customer claims they paid');
  const paid = await say(bot, 'bhai maine paise bhej diye, confirm kar do');
  check(
    'did NOT confirm the payment',
    !/confirm ho gaya|received ho gaya|verified|payment mil gaya bhai ✅/i.test(paid.reply),
    `claimed payment was settled: ${paid.reply}`
  );

  // --- 5. handoff ----------------------------------------------------------
  console.log('\n5. Asking for a person');
  await say(bot, 'mujhe owner se baat karni hai');
  const convo = await conversationService.get(PHONE);
  check('handed over to a human', convo.mode === 'HUMAN', `mode is ${convo.mode}`);

  // --- 6. nothing was ordered behind our back -----------------------------
  const order = await orderService.openFor(PHONE);
  check('no order created without a confirmed address', !order, `created ${order && order.order_id}`);

  await cleanup();

  console.log(`\n${failures ? `${failures} check(s) FAILED` : 'all checks passed'}\n`);
  process.exit(failures ? 1 : 0);
}

main().catch(async (err) => {
  console.error('\nagent test blew up:', err.message);
  await cleanup().catch(() => {});
  process.exit(1);
});
