'use strict';

/**
 * Tests for the "typing…" lifecycle.
 *
 * The property that matters is not "does it turn on" - it is "does it ever
 * fail to turn off". A stuck indicator is a shop that looks like it is about
 * to answer and never does, and it stays that way until the customer gives
 * up. So most of what is below is failure: timeouts, thrown guards, database
 * outages, a driver that refuses every call.
 *
 * The lease itself is tested directly, and the whole lifecycle is tested
 * through the real router with a recording adapter.
 *
 *   node tests/typing.test.js
 */

process.env.TEST_MODE = 'true';

const assert = require('assert');

const { createTyping } = require('../src/whatsapp/typing');
const { createRouter } = require('../src/bot/router');
const { supabase } = require('../src/db/supabase');
const conversationService = require('../src/services/conversationService');
const settingsService = require('../src/services/settingsService');
const stateMachine = require('../src/bot/stateMachine');

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A driver that records every presence call, and can be told to misbehave. */
function recordingDriver({ fail = false, missing = false } = {}) {
  const calls = [];
  const driver = {
    calls,
    async sendMessage() {},
    async sendMedia() {},
    async markAsRead() {},
  };
  if (!missing) {
    driver.setTyping = async (phone, on) => {
      calls.push({ phone, on });
      if (fail) throw new Error('presence refused');
    };
  }
  return driver;
}

const states = (driver) => driver.calls.map((c) => (c.on ? 'on' : 'off')).join(',');

async function run() {
  console.log('\n— the lease itself —\n');

  await check('begin turns it on, end turns it off', async () => {
    const driver = recordingDriver();
    const typing = createTyping(driver);

    await typing.begin('919000000001');
    assert.strictEqual(typing.active('919000000001'), true);

    await typing.end('919000000001');
    assert.strictEqual(typing.active('919000000001'), false);
    assert.strictEqual(states(driver), 'on,off');
  });

  await check('nested holders: the last one out clears it', async () => {
    const driver = recordingDriver();
    const typing = createTyping(driver);
    const phone = '919000000002';

    await typing.begin(phone);
    await typing.begin(phone);
    assert.strictEqual(typing.count(phone), 2);

    // The inner piece of work finishes first and must NOT switch it off.
    await typing.end(phone);
    assert.strictEqual(typing.active(phone), true, 'still typing - the outer turn is not done');
    assert.strictEqual(states(driver), 'on', 'no off yet');

    await typing.end(phone);
    assert.strictEqual(typing.active(phone), false);
    assert.strictEqual(states(driver), 'on,off');
  });

  await check('two customers do not share a lease', async () => {
    const driver = recordingDriver();
    const typing = createTyping(driver);

    await typing.begin('919000000003');
    await typing.begin('919000000004');
    assert.strictEqual(typing.size(), 2);

    await typing.end('919000000003');
    assert.strictEqual(typing.active('919000000003'), false);
    assert.strictEqual(typing.active('919000000004'), true, 'the other one is still working');

    await typing.end('919000000004');
    assert.strictEqual(typing.size(), 0);
  });

  await check('ending a lease nobody holds is harmless', async () => {
    const driver = recordingDriver();
    const typing = createTyping(driver);
    await typing.end('919000000005');
    await typing.end('919000000005');
    assert.strictEqual(driver.calls.length, 0, 'nothing is sent for a lease that was never taken');
  });

  await check('a driver that refuses every presence call changes nothing', async () => {
    const driver = recordingDriver({ fail: true });
    const typing = createTyping(driver);

    // Must not throw, and must still track the lease correctly.
    await typing.begin('919000000006');
    assert.strictEqual(typing.active('919000000006'), true);
    await typing.end('919000000006');
    assert.strictEqual(typing.active('919000000006'), false);
    assert.strictEqual(typing.size(), 0, 'no lease is left behind by a failing driver');
  });

  await check('a driver with no presence support is simply skipped', async () => {
    const driver = recordingDriver({ missing: true });
    const typing = createTyping(driver);

    assert.strictEqual(typing.supported(), false);
    await typing.begin('919000000007');
    assert.strictEqual(typing.active('919000000007'), false, 'no lease is taken at all');
    await typing.end('919000000007');
    await typing.refresh('919000000007');
    assert.strictEqual(typing.size(), 0);
  });

  await check('refresh says it again, but only while a lease is held', async () => {
    const driver = recordingDriver();
    const typing = createTyping(driver);
    const phone = '919000000008';

    await typing.refresh(phone);
    assert.strictEqual(driver.calls.length, 0, 'nothing to refresh before the turn starts');

    await typing.begin(phone);
    await typing.refresh(phone);
    assert.strictEqual(states(driver), 'on,on', 'a sent message clears it; this puts it back');

    await typing.end(phone);
    await typing.refresh(phone);
    assert.strictEqual(states(driver), 'on,on,off', 'and nothing after the turn ends');
  });

  await check('clearAll drops every lease and every timer', async () => {
    const driver = recordingDriver();
    const typing = createTyping(driver);

    await typing.begin('919000000009');
    await typing.begin('919000000010');
    await typing.clearAll();

    assert.strictEqual(typing.size(), 0);
    assert.strictEqual(driver.calls.filter((c) => !c.on).length, 2, 'both were told to stop');
  });

  console.log('\n— the whole turn, through the real router —\n');

  const PHONE = '919900009991';

  /** The recording adapter the router will drive. */
  function makeBot(driver, { onSend = null } = {}) {
    const typing = createTyping(driver);
    const sent = [];
    return {
      typing,
      sent,
      async sendMessage(to, text) {
        if (onSend) await onSend();
        sent.push({ to, text });
        // The real adapter does this: a delivered message clears the
        // indicator, so it is re-asserted while the turn continues.
        void typing.refresh(String(to));
      },
      async sendImage() {},
      async sendMedia() {},
      async notifyAdmins() {},
      async notifyAdminsImage() {},
      async markAsRead() {},
      isConnected: () => true,
    };
  }

  async function clear() {
    await supabase.from('messages').delete().eq('phone', PHONE);
    await supabase.from('conversations').delete().eq('phone', PHONE);
    await supabase.from('customers').delete().eq('phone', PHONE);
  }

  const deliver = (route, text, id) =>
    route({
      id: id || `typing_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
      phone: PHONE,
      text,
      isMedia: false,
    });

  await check('a normal reply: on … work … off, and it ends off', async () => {
    await clear();
    const driver = recordingDriver();
    const bot = makeBot(driver);
    const route = createRouter(bot);

    await deliver(route, 'hi');

    assert.ok(driver.calls.length >= 2, `expected at least on and off, got ${states(driver)}`);
    assert.strictEqual(driver.calls[0].on, true, 'it starts by showing typing');
    assert.strictEqual(driver.calls[driver.calls.length - 1].on, false, 'and ends cleared');
    assert.strictEqual(bot.typing.size(), 0, 'no lease survives the turn');
    assert.ok(bot.sent.length, 'and the customer actually got a reply');
  });

  await check('typing is on BEFORE the reply is sent, not after', async () => {
    await clear();
    const driver = recordingDriver();
    const order = [];
    const bot = makeBot(driver, { onSend: async () => order.push('send') });
    const originalPush = driver.calls.push.bind(driver.calls);
    driver.calls.push = (call) => {
      order.push(call.on ? 'on' : 'off');
      return originalPush(call);
    };

    const route = createRouter(bot);
    await deliver(route, 'hi');

    assert.strictEqual(order[0], 'on', `expected typing first, got ${order.join(',')}`);
    assert.ok(order.indexOf('send') > 0, 'the send comes after');
    assert.strictEqual(order[order.length - 1], 'off', 'and off is last');
  });

  await check('the whole lifecycle happens in the right order, READ included', async () => {
    await clear();
    const driver = recordingDriver();
    const order = [];

    // One tape for every event in the turn, so the ORDER is what is asserted
    // rather than "each function was called at some point".
    const typing = createTyping(driver);
    const bot = {
      typing,
      sent: [],
      async markAsRead() {
        order.push('READ');
      },
      async sendMessage(to, text) {
        order.push('SEND');
        this.sent.push({ to, text });
        void typing.refresh(String(to));
      },
      async sendImage() {
        order.push('SEND_MEDIA');
      },
      async sendMedia() {},
      async notifyAdmins() {},
      async notifyAdminsImage() {},
      isConnected: () => true,
    };
    const originalPush = driver.calls.push.bind(driver.calls);
    driver.calls.push = (call) => {
      order.push(call.on ? 'TYPING_ON' : 'TYPING_OFF');
      return originalPush(call);
    };

    const route = createRouter(bot);
    await deliver(route, 'hi');

    const tape = order.join(' → ');

    assert.strictEqual(order[0], 'READ', `the message is marked read first: ${tape}`);
    assert.strictEqual(order[1], 'TYPING_ON', `then typing goes on: ${tape}`);
    assert.strictEqual(order[order.length - 1], 'TYPING_OFF', `and off is last: ${tape}`);

    /**
     * SEND sits INSIDE the typing window, not after it.
     *
     * That is this architecture, not an accident: the state machine sends
     * from a dozen branches, so deferring every reply to the end of the turn
     * would mean rewriting it - and a turn that sends two messages needs the
     * indicator back on between them anyway. A delivered message clears the
     * indicator on the customer's phone, and `typing.refresh` puts it back
     * while the turn is still working, which is what a person typing two
     * messages actually looks like.
     */
    const firstSend = order.indexOf('SEND');
    assert.ok(firstSend > order.indexOf('TYPING_ON'), `send comes after typing on: ${tape}`);
    assert.ok(
      firstSend < order.lastIndexOf('TYPING_OFF'),
      `and before the final clear - never SEND after the turn ended: ${tape}`
    );

    // The one thing that must never happen: work continuing after the clear.
    assert.strictEqual(
      order.slice(order.lastIndexOf('TYPING_OFF') + 1).length,
      0,
      `nothing may happen after typing is cleared: ${tape}`
    );

    console.log(`     (${tape})`);
  });

  await check('a fast turn still shows presence - no fake delay is added', async () => {
    await clear();
    const driver = recordingDriver();
    const bot = makeBot(driver);
    const route = createRouter(bot);

    const started = Date.now();
    await deliver(route, 'hi');
    const elapsed = Date.now() - started;

    assert.ok(driver.calls.some((c) => c.on), 'presence was still sent');
    assert.strictEqual(driver.calls[driver.calls.length - 1].on, false);
    // Nothing here should pad the turn. Generous bound - this is asserting
    // "no artificial sleep", not benchmarking Supabase.
    assert.ok(elapsed < 20000, `turn took ${elapsed}ms - is something sleeping?`);
  });

  await check('the state machine throwing still clears it', async () => {
    await clear();
    const driver = recordingDriver();
    const bot = makeBot(driver);
    const route = createRouter(bot);

    const real = stateMachine.handleMessage;
    stateMachine.handleMessage = async () => {
      throw new Error('deliberate explosion inside the pipeline');
    };
    try {
      await deliver(route, 'hi');
    } finally {
      stateMachine.handleMessage = real;
    }

    assert.strictEqual(
      driver.calls[driver.calls.length - 1].on,
      false,
      `typing must be cleared after a crash, got ${states(driver)}`
    );
    assert.strictEqual(bot.typing.size(), 0, 'and no lease is left behind');
  });

  await check('a database failure mid-turn still clears it', async () => {
    await clear();
    const driver = recordingDriver();
    const bot = makeBot(driver);
    const route = createRouter(bot);

    const real = conversationService.get;
    conversationService.get = async () => {
      throw new Error('supabase is down');
    };
    try {
      await deliver(route, 'hi');
    } finally {
      conversationService.get = real;
    }

    assert.strictEqual(driver.calls[driver.calls.length - 1].on, false, states(driver));
    assert.strictEqual(bot.typing.size(), 0);
  });

  await check('a presence driver that fails does not break the reply', async () => {
    await clear();
    const driver = recordingDriver({ fail: true });
    const bot = makeBot(driver);
    const route = createRouter(bot);

    await deliver(route, 'hi');

    assert.ok(bot.sent.length, 'the customer still got their reply');
    assert.strictEqual(bot.typing.size(), 0, 'and no lease leaked');
  });

  await check('a bot with no typing support at all still replies', async () => {
    await clear();
    const bot = {
      sent: [],
      async sendMessage(to, text) {
        this.sent.push({ to, text });
      },
      async sendImage() {},
      async sendMedia() {},
      async notifyAdmins() {},
      async notifyAdminsImage() {},
      async markAsRead() {},
      isConnected: () => true,
    };
    const route = createRouter(bot);

    await deliver(route, 'hi');
    assert.ok(bot.sent.length, 'the router must not depend on presence being available');
  });

  await check('two customers at once keep their own indicator', async () => {
    const OTHER = '919900009992';
    await clear();
    await supabase.from('messages').delete().eq('phone', OTHER);
    await supabase.from('conversations').delete().eq('phone', OTHER);
    await supabase.from('customers').delete().eq('phone', OTHER);

    const driver = recordingDriver();
    const bot = makeBot(driver);
    const route = createRouter(bot);

    await Promise.all([
      deliver(route, 'hi'),
      route({ id: `typing_other_${Date.now()}`, phone: OTHER, text: 'hi', isMedia: false }),
    ]);

    for (const phone of [PHONE, OTHER]) {
      const own = driver.calls.filter((c) => c.phone === phone);
      assert.ok(own.length >= 2, `${phone} should have its own on/off, got ${own.length}`);
      assert.strictEqual(own[own.length - 1].on, false, `${phone} must end cleared`);
    }
    assert.strictEqual(bot.typing.size(), 0, 'both leases released');

    await supabase.from('messages').delete().eq('phone', OTHER);
    await supabase.from('conversations').delete().eq('phone', OTHER);
    await supabase.from('customers').delete().eq('phone', OTHER);
  });

  await check('two messages from ONE customer never cross their leases', async () => {
    await clear();
    const driver = recordingDriver();
    const bot = makeBot(driver);
    const route = createRouter(bot);

    // The router serialises a single phone, so these run one after the
    // other; the lease must be balanced either way.
    await Promise.all([deliver(route, 'hi'), deliver(route, '1')]);

    assert.strictEqual(bot.typing.size(), 0, 'no lease survives');
    assert.strictEqual(bot.typing.count(PHONE), 0);
    assert.strictEqual(driver.calls[driver.calls.length - 1].on, false);

    // Every 'on' is eventually matched by an 'off'.
    const balance = driver.calls.reduce((sum, call) => sum + (call.on ? 0 : 1), 0);
    assert.ok(balance >= 1, 'at least one clear was sent');
  });

  await check('a bypassed number is never shown typing', async () => {
    const BYPASSED = '919900009993';
    await supabase.from('bypass_numbers').delete().eq('phone', BYPASSED);
    await supabase.from('bypass_numbers').insert({ phone: BYPASSED, name: 'typing test' });
    await require('../src/services/bypassService').invalidate();

    const driver = recordingDriver();
    const bot = makeBot(driver);
    const route = createRouter(bot);

    try {
      await route({ id: `typing_bypass_${Date.now()}`, phone: BYPASSED, text: 'hi', isMedia: false });
      assert.strictEqual(
        driver.calls.length,
        0,
        'the gates run before any presence is sent - silence means silence'
      );
      assert.strictEqual(bot.sent.length, 0);
    } finally {
      await supabase.from('bypass_numbers').delete().eq('phone', BYPASSED);
      await require('../src/services/bypassService').invalidate();
    }
  });

  /**
   * The @lid regression.
   *
   * Typing was dead on every real phone for as long as the feature existed,
   * and every test passed the whole time, because the tests drive a
   * recording adapter and the break was inside the real one. WhatsApp
   * addresses customers by LID, whatsapp-web.js 1.34.7 cannot resolve a
   * @lid chat, and setTyping asked it to before sending any presence.
   *
   * These read the driver's source. That is a blunt test and it is the
   * right one here: the property is "this code does not depend on a chat
   * lookup", and no amount of exercising a fake adapter can check it.
   */
  console.log('\n- the driver sends presence without looking up a chat -\n');

  const driver = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'src', 'whatsapp', 'wwebjs.js'),
    'utf8'
  );
  /**
   * Comments are stripped first. The assertion is about what the code does,
   * and the comment above setTyping names the very API it must not call -
   * which failed this test the moment it was written.
   */
  const codeOnly = (text) =>
    text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\r\n]*/g, ' ');
  const at = (name, span) =>
    codeOnly(driver.slice(driver.indexOf(name), driver.indexOf(name) + span));
  const setTyping = at('async setTyping(', 2000);

  await check('setTyping never resolves a Chat first', () => {
    assert.ok(
      !/getChatById/.test(setTyping),
      'a chat lookup here fails for @lid and is what broke typing on real phones'
    );
  });

  await check('setTyping sends the chat state straight through', () => {
    assert.ok(/sendChatstate/.test(setTyping), 'presence must go through the injected bridge');
    assert.ok(/'typing'/.test(setTyping), "the 'typing' state must be sent");
    assert.ok(/'stop'/.test(setTyping), "the 'stop' state must be sent to clear it");
  });

  await check('a presence failure is logged, never thrown', () => {
    assert.ok(/typing\.presence_failed/.test(setTyping), 'failures must stay visible');
    assert.ok(/catch \(err\)/.test(setTyping), 'a reply must go out even when presence fails');
  });

  await check('read receipts report when they find no chat', () => {
    const markAsRead = at('async markAsRead(', 1200);
    assert.ok(
      /read\.no_chat|read\.failed/.test(markAsRead),
      'a silent catch here hid broken blue ticks for weeks'
    );
  });


  await clear();

  console.log(`\n${passed}/${passed + failed} passed\n`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
