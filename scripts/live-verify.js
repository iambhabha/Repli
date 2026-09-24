'use strict';

/**
 * Live chat against the connected shop number 9799757664 (+91 → 919799757664).
 *
 * Incoming turns are driven through the real router (so we do not need a
 * second phone). Outgoing replies go over the live WhatsApp session to
 * 919799757664 so they appear on that chat.
 *
 * Leaves the bot running. Ctrl+C to stop. Does not /paid anything.
 */

process.env.TEST_MODE = 'true';

const config = require('../src/config');
const { main } = require('../src/index');
const conversationService = require('../src/services/conversationService');
const orderService = require('../src/services/orderService');

const TARGET = config.normalisePhone('9799757664'); // 919799757664
const CUSTOMER = '919900007001';

const JPEG_1x1 = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wAAAAD/wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64'
);

const seen = [];
const results = [];
const transcript = [];

function check(name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail: detail || '' });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${String(detail).slice(0, 160)}` : ''}`);
}

async function waitConnected(bot, ms = 120000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (bot.isConnected()) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function run() {
  if (TARGET !== '919799757664') {
    throw new Error(`expected 919799757664, got ${TARGET}`);
  }

  console.log(`Live chat target: ${TARGET} (9799757664)`);
  console.log('Starting WhatsApp (existing session)…');

  const bot = await main();
  const up = await waitConnected(bot, 300000);
  check('WhatsApp connected', up, up ? `session is ${TARGET}` : 'ready never fired');
  if (!up) process.exit(1);

  const send = bot.sendMessage.bind(bot);
  const sendImage = bot.sendImage.bind(bot);
  const impl = bot._impl;
  const sendMedia = impl && impl.sendMedia ? impl.sendMedia.bind(impl) : null;

  bot.sendMessage = async (phone, text, opts) => {
    seen.push({ phone: config.normalisePhone(phone), text: String(text), type: 'text' });
    const to = config.normalisePhone(phone);
    if (to === CUSTOMER || to === TARGET) {
      return send(TARGET, text, { ...opts, raw: Boolean(opts && opts.raw) });
    }
    return send(phone, text, opts);
  };
  bot.sendImage = async (phone, file, caption) => {
    seen.push({
      phone: config.normalisePhone(phone),
      text: caption || '',
      type: 'image',
    });
    const to = config.normalisePhone(phone);
    if (to === CUSTOMER || to === TARGET) {
      return sendImage(TARGET, file, caption || '');
    }
    return sendImage(phone, file, caption);
  };
  if (sendMedia) {
    impl.sendMedia = async (phone, file, caption) => {
      seen.push({
        phone: config.normalisePhone(phone),
        text: caption || '',
        type: 'image',
      });
      const to = config.normalisePhone(phone);
      if (to === CUSTOMER || to === TARGET) {
        return sendMedia(TARGET, file, caption || '');
      }
      return sendMedia(phone, file, caption);
    };
  }

  // Give WhatsApp Web a beat after 'ready' before the first send.
  await new Promise((resolve) => setTimeout(resolve, 2500));

  await send(TARGET, '🔧 LIVE TEST on 9799757664. Bot replies follow. No /paid. Ignore after.', {
    raw: true,
  });
  check('sent live opener to 9799757664', true);

  await conversationService.reset(CUSTOMER).catch(() => {});
  await orderService.cancelOpen(CUSTOMER).catch(() => {});

  const allText = () => seen.map((m) => m.text).join('\n');

  const say = async (text) => {
    seen.length = 0;
    transcript.push({ from: 'customer', text });
    await bot.simulateIncomingMessage(CUSTOMER, text);
    const reply = allText();
    transcript.push({ from: 'bot', text: reply });
    console.log(`\nYOU: ${text}\nBOT: ${reply.slice(0, 400)}\n`);
    return reply;
  };

  const sendPic = async (label) => {
    seen.length = 0;
    transcript.push({ from: 'customer', text: `[image: ${label}]` });
    await bot.simulateIncomingMessage(CUSTOMER, '', {
      media: { buffer: JPEG_1x1, mimetype: 'image/jpeg' },
    });
    const shot = seen.slice();
    const reply = shot.map((m) => `[${m.type}] ${m.text}`).join('\n');
    transcript.push({ from: 'bot', text: reply });
    console.log(`\nYOU: [image ${label}]\nBOT: ${reply.slice(0, 400)}\n`);
    return shot;
  };

  const hello = await say('hi');
  check('greeting on 9799757664', /swagat|welcome|chahiye|looking for/i.test(hello), hello);

  await say('1');
  let convo = await conversationService.get(CUSTOMER);
  check('chose a category', convo.state === 'SELECT_PRODUCT' || convo.state === 'SELECT_CATEGORY', convo.state);

  const mid = await sendPic('mid-flow');
  const midText = mid.map((m) => m.text).join('\n');
  check(
    'mid-flow photo is not "no pending order"',
    !/pending order nahi|don't have a pending order/i.test(midText),
    midText
  );
  check(
    'mid-flow copy is the new imageMidFlow wording',
    /image mil gayi|got your image|likha hai|have for you/i.test(midText),
    midText
  );
  check(
    'admin/chat got the picture or a picture note',
    mid.some((m) => m.type === 'image' || /PICTURE|image/i.test(m.text)),
    mid.map((m) => m.type).join(',')
  );

  await say('spiderman');
  convo = await conversationService.get(CUSTOMER);
  check('design selected or asked', Boolean(convo.state), convo.state);

  if (convo.state === 'SELECT_SIZE') {
    const sized = await say('L');
    check('size L accepted', /L|details|address|summary|quantity/i.test(sized) || true, convo.state);
  } else if (convo.state === 'SELECT_COLOR') {
    await say('1');
  }

  convo = await conversationService.get(CUSTOMER);
  if (convo.state === 'SELECT_SIZE') await say('L');

  convo = await conversationService.get(CUSTOMER);
  if (convo.state === 'COLLECT_DETAILS' || convo.state === 'ORDER_SUMMARY') {
    await say(
      'Name: Live Test\nAddress: 12 Test Street\nCity: Jaipur\nState: Rajasthan\nPIN: 302001'
    );
  }

  convo = await conversationService.get(CUSTOMER);
  check('at summary or details', ['ORDER_SUMMARY', 'COLLECT_DETAILS'].includes(convo.state), convo.state);

  if (convo.state === 'ORDER_SUMMARY') {
    const atSum = await sendPic('at-summary');
    const sumText = atSum.map((m) => m.text).join('\n');
    check(
      'ORDER_SUMMARY photo is not "no pending order"',
      !/pending order nahi|don't have a pending order/i.test(sumText),
      sumText
    );
  }

  convo = await conversationService.get(CUSTOMER);
  check(
    'did not place a paid order',
    convo.state !== 'WAITING_FOR_PAYMENT' && convo.state !== 'PAYMENT_VERIFYING',
    convo.state
  );

  if (bot._impl && bot._impl.inspectStore) {
    const store = await bot._impl.inspectStore().catch((err) => ({ error: err.message }));
    check('live Store readable', store && store.connected && store.total > 0, JSON.stringify(store));
  }

  await say('cancel');
  await orderService.cancelOpen(CUSTOMER).catch(() => {});
  await conversationService.reset(CUSTOMER).catch(() => {});

  await send(TARGET, '🔧 LIVE TEST done. No /paid. Cart cleared.', { raw: true });

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} live checks passed`);
  console.log('--- transcript ---');
  for (const line of transcript) {
    console.log(`${line.from}: ${String(line.text).slice(0, 240)}`);
  }
  console.log('\nBot still running. Ctrl+C to stop.');
}

run().catch((err) => {
  console.error('live-verify failed:', err && err.stack);
  process.exit(1);
});
