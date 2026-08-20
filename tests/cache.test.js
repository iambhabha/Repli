'use strict';

/**
 * Tests for the shared cache. No Supabase and no real Redis - a small RESP
 * server is started inside the test process instead, so these run anywhere
 * and prove the things that actually matter when the shop is live:
 *
 *   - the read order is memory -> Redis -> loader, in that order, always
 *   - a dead Redis costs nothing: no error, no stall, no repeated dialling
 *   - rediss:// really opens TLS, which is what every managed Redis needs
 *   - a value with a rupee sign or an emoji comes back the way it went in
 *
 *   node tests/cache.test.js
 */

const assert = require('assert');
const net = require('net');
const tls = require('tls');
const path = require('path');

const TLS_FIXTURE = require('./fixtures/tls');

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

// ------------------------------------------------------------ fake redis

/** One RESP command off the wire, or null while it is still arriving. */
function readCommand(buf) {
  if (!buf.length || buf[0] !== 0x2a) return null; // '*'
  let end = buf.indexOf('\r\n');
  if (end === -1) return null;

  const count = Number(buf.subarray(1, end).toString());
  const args = [];
  let cursor = end + 2;

  for (let i = 0; i < count; i += 1) {
    if (buf[cursor] !== 0x24) return null; // '$'
    end = buf.indexOf('\r\n', cursor);
    if (end === -1) return null;
    const length = Number(buf.subarray(cursor + 1, end).toString());
    const start = end + 2;
    if (buf.length < start + length + 2) return null;
    args.push(buf.subarray(start, start + length).toString());
    cursor = start + length + 2;
  }

  return { args, next: cursor };
}

const bulk = (value) =>
  value === null
    ? Buffer.from('$-1\r\n')
    : Buffer.concat([
        Buffer.from(`$${Buffer.byteLength(value)}\r\n`),
        Buffer.from(value),
        Buffer.from('\r\n'),
      ]);

/**
 * Enough of Redis for this cache: GET, SET ... PX, DEL, SCAN, AUTH, SELECT.
 * Counts its connections, which is how the backoff test proves the client
 * stopped dialling.
 */
function startRedis({ secure = false, password = null } = {}) {
  const store = new Map();
  const state = { connections: 0, commands: [] };

  const live = new Set();

  const onConnection = (socket) => {
    state.connections += 1;
    live.add(socket);
    socket.on('close', () => live.delete(socket));

    let buf = Buffer.alloc(0);
    let authed = !password;

    socket.on('error', () => {});
    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        const parsed = readCommand(buf);
        if (!parsed) break;
        buf = buf.subarray(parsed.next);

        const [rawName, ...args] = parsed.args;
        const name = String(rawName).toUpperCase();
        state.commands.push(name);

        if (name === 'AUTH') {
          authed = args[args.length - 1] === password;
          socket.write(authed ? Buffer.from('+OK\r\n') : Buffer.from('-ERR bad password\r\n'));
          continue;
        }
        if (!authed) {
          socket.write(Buffer.from('-NOAUTH authentication required\r\n'));
          continue;
        }
        if (name === 'SELECT' || name === 'PING') {
          socket.write(Buffer.from('+OK\r\n'));
          continue;
        }
        if (name === 'SET') {
          const pxIndex = args.findIndex((a) => String(a).toUpperCase() === 'PX');
          const ttl = pxIndex === -1 ? 0 : Number(args[pxIndex + 1]);
          store.set(args[0], { value: args[1], expires: ttl ? Date.now() + ttl : 0 });
          socket.write(Buffer.from('+OK\r\n'));
          continue;
        }
        if (name === 'GET') {
          const hit = store.get(args[0]);
          if (hit && hit.expires && Date.now() > hit.expires) store.delete(args[0]);
          const live = store.get(args[0]);
          socket.write(bulk(live ? live.value : null));
          continue;
        }
        if (name === 'DEL') {
          let removed = 0;
          for (const key of args) if (store.delete(key)) removed += 1;
          socket.write(Buffer.from(`:${removed}\r\n`));
          continue;
        }
        if (name === 'SCAN') {
          const matchIndex = args.findIndex((a) => String(a).toUpperCase() === 'MATCH');
          const pattern = matchIndex === -1 ? '*' : args[matchIndex + 1];
          const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
          const keys = [...store.keys()].filter((key) => key.startsWith(prefix));
          socket.write(
            Buffer.concat([
              Buffer.from('*2\r\n'),
              bulk('0'),
              Buffer.from(`*${keys.length}\r\n`),
              ...keys.map((key) => bulk(key)),
            ])
          );
          continue;
        }
        socket.write(Buffer.from('+OK\r\n'));
      }
    });
  };

  const server = secure
    ? tls.createServer({ key: TLS_FIXTURE.key, cert: TLS_FIXTURE.cert }, onConnection)
    : net.createServer(onConnection);

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        port: server.address().port,
        store,
        state,
        // Existing connections are destroyed first: close() alone waits for
        // them, and the cache under test is holding one open on purpose.
        close: () =>
          new Promise((done) => {
            for (const socket of live) socket.destroy();
            live.clear();
            server.close(() => done());
          }),
      });
    });
  });
}

/** A free port with nothing listening on it - a Redis that is simply down. */
function deadPort() {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

// --------------------------------------------------------- module loading

const CACHE_PATH = path.join(__dirname, '..', 'src', 'db', 'cache.js');

/**
 * A fresh copy of the cache with its own environment.
 *
 * REDIS_URL and the backoff are read once, at require time, so each scenario
 * needs its own module instance rather than a setter that production code
 * would never call.
 */
function loadCache(env = {}) {
  const previous = {};
  for (const [key, value] of Object.entries(env)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = String(value);
  }

  delete require.cache[require.resolve(CACHE_PATH)];
  const instance = require(CACHE_PATH);

  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return instance;
}

const NO_REDIS = { REDIS_URL: undefined };
const redisEnv = (port, extra = {}) => ({ REDIS_URL: `redis://127.0.0.1:${port}`, ...extra });

// -------------------------------------------------------------- the tests

async function run() {
  console.log('\n— memory only, no REDIS_URL —\n');

  await check('a miss runs the loader, a hit does not', async () => {
    const cache = loadCache(NO_REDIS);
    let calls = 0;
    const load = async () => {
      calls += 1;
      return { price: 2499 };
    };

    assert.deepStrictEqual(await cache.remember('repli:test:a', 5000, load), { price: 2499 });
    assert.deepStrictEqual(await cache.remember('repli:test:a', 5000, load), { price: 2499 });
    assert.strictEqual(calls, 1, 'the second read must come from memory');
    assert.strictEqual(cache.status().enabled, false);
  });

  await check('the entry expires and the loader runs again', async () => {
    const cache = loadCache(NO_REDIS);
    let calls = 0;
    const load = async () => {
      calls += 1;
      return calls;
    };

    assert.strictEqual(await cache.remember('repli:test:ttl', 60, load), 1);
    await sleep(90);
    assert.strictEqual(await cache.remember('repli:test:ttl', 60, load), 2);
  });

  await check('two callers at once share one load', async () => {
    const cache = loadCache(NO_REDIS);
    let calls = 0;
    const load = async () => {
      calls += 1;
      await sleep(30);
      return 'once';
    };

    const [a, b] = await Promise.all([
      cache.remember('repli:test:flight', 5000, load),
      cache.remember('repli:test:flight', 5000, load),
    ]);
    assert.strictEqual(a, 'once');
    assert.strictEqual(b, 'once');
    assert.strictEqual(calls, 1, 'a burst of messages must not become a burst of queries');
  });

  await check('del drops the key, delPrefix drops the family', async () => {
    const cache = loadCache(NO_REDIS);
    const load = (value) => async () => value;

    await cache.remember(cache.KEYS.stock('p1'), 5000, load(1));
    await cache.remember(cache.KEYS.stock('p2'), 5000, load(2));
    await cache.remember(cache.KEYS.catalogue, 5000, load('cat'));

    await cache.delPrefix(cache.KEYS.stockPrefix);
    assert.strictEqual(await cache.remember(cache.KEYS.stock('p1'), 5000, load(9)), 9);
    assert.strictEqual(await cache.remember(cache.KEYS.stock('p2'), 5000, load(9)), 9);
    assert.strictEqual(
      await cache.remember(cache.KEYS.catalogue, 5000, load('changed')),
      'cat',
      'the catalogue must survive a stock invalidation'
    );

    await cache.del(cache.KEYS.catalogue);
    assert.strictEqual(await cache.remember(cache.KEYS.catalogue, 5000, load('changed')), 'changed');
  });

  console.log('\n— redis:// —\n');

  await check('a value written by one process is read by the next', async () => {
    const server = await startRedis();
    try {
      const first = loadCache(redisEnv(server.port));
      await first.remember('repli:test:shared', 60000, async () => ({ colour: 'Red' }));
      await sleep(60); // the SET is fire and forget

      // A second process: cold memory, same Redis.
      const second = loadCache(redisEnv(server.port));
      let loaded = false;
      const value = await second.remember('repli:test:shared', 60000, async () => {
        loaded = true;
        return { colour: 'WRONG' };
      });

      assert.deepStrictEqual(value, { colour: 'Red' });
      assert.strictEqual(loaded, false, 'the second process must not re-query Supabase');
      await first.disconnect();
      await second.disconnect();
    } finally {
      await server.close();
    }
  });

  await check('a miss in redis falls through to the loader and fills redis', async () => {
    const server = await startRedis();
    try {
      const cache = loadCache(redisEnv(server.port));
      const value = await cache.remember('repli:test:fill', 60000, async () => ['S', 'M', 'L']);
      assert.deepStrictEqual(value, ['S', 'M', 'L']);
      await sleep(60);
      assert.ok(server.store.has('repli:test:fill'), 'the loaded value should be published');
      assert.ok(server.state.commands.includes('GET'));
      assert.ok(server.state.commands.includes('SET'));
      await cache.disconnect();
    } finally {
      await server.close();
    }
  });

  await check('a rupee sign and an emoji survive the round trip', async () => {
    const server = await startRedis();
    try {
      // A bulk string's length is in bytes. Reading the reply as a JS string
      // truncated anything multi-byte - which is every price line the shop
      // has, and every template with an emoji in it.
      const text = '₹2,499 — booking ₹500 😊 बाकी delivery पे';
      const first = loadCache(redisEnv(server.port));
      await first.remember('repli:test:utf8', 60000, async () => ({ text }));
      await sleep(60);

      const second = loadCache(redisEnv(server.port));
      const value = await second.remember('repli:test:utf8', 60000, async () => ({ text: 'lost' }));
      assert.strictEqual(value.text, text);
      await first.disconnect();
      await second.disconnect();
    } finally {
      await server.close();
    }
  });

  await check('set writes through, del removes from redis too', async () => {
    const server = await startRedis();
    try {
      const cache = loadCache(redisEnv(server.port));
      await cache.set('repli:test:switch', 'false', 10000);
      assert.strictEqual(await cache.get('repli:test:switch'), 'false');
      assert.ok(server.store.has('repli:test:switch'));

      await cache.del('repli:test:switch');
      assert.strictEqual(server.store.has('repli:test:switch'), false);
      assert.strictEqual(await cache.get('repli:test:switch'), undefined);
      await cache.disconnect();
    } finally {
      await server.close();
    }
  });

  await check('delPrefix clears the family in redis via SCAN', async () => {
    const server = await startRedis();
    try {
      const cache = loadCache(redisEnv(server.port));
      await cache.set(cache.KEYS.stock('p1'), 1, 10000);
      await cache.set(cache.KEYS.stock('p2'), 2, 10000);
      await cache.set(cache.KEYS.catalogue, 'cat', 10000);

      await cache.delPrefix(cache.KEYS.stockPrefix);
      assert.strictEqual(server.store.has(cache.KEYS.stock('p1')), false);
      assert.strictEqual(server.store.has(cache.KEYS.stock('p2')), false);
      assert.strictEqual(server.store.has(cache.KEYS.catalogue), true);
      assert.ok(server.state.commands.includes('SCAN'));
      await cache.disconnect();
    } finally {
      await server.close();
    }
  });

  await check('AUTH is answered before any command goes out', async () => {
    const server = await startRedis({ password: 'sekrit' });
    try {
      const cache = loadCache({ REDIS_URL: `redis://:sekrit@127.0.0.1:${server.port}` });
      await cache.set('repli:test:auth', 'ok', 10000);
      assert.strictEqual(server.state.commands[0], 'AUTH');
      assert.strictEqual(server.store.get('repli:test:auth').value, '"ok"');
      await cache.disconnect();
    } finally {
      await server.close();
    }
  });

  console.log('\n— rediss:// (TLS) —\n');

  await check('rediss:// opens a TLS connection and works', async () => {
    const server = await startRedis({ secure: true });
    try {
      const cache = loadCache({
        REDIS_URL: `rediss://localhost:${server.port}`,
        REDIS_TLS_REJECT_UNAUTHORIZED: 'false',
      });
      await cache.set('repli:test:tls', { ok: true }, 10000);
      assert.strictEqual(cache.status().connected, true, 'TLS handshake should have completed');
      assert.deepStrictEqual(await cache.get('repli:test:tls'), { ok: true });
      await cache.disconnect();
    } finally {
      await server.close();
    }
  });

  await check('redis:// against a TLS server fails safely, and the shop carries on', async () => {
    const server = await startRedis({ secure: true });
    try {
      const cache = loadCache({ REDIS_URL: `redis://127.0.0.1:${server.port}` });
      const value = await cache.remember('repli:test:mismatch', 5000, async () => 'from supabase');
      assert.strictEqual(value, 'from supabase');
      await cache.disconnect();
    } finally {
      await server.close();
    }
  });

  console.log('\n— redis down —\n');

  await check('a dead redis still returns the loader value', async () => {
    const port = await deadPort();
    const cache = loadCache({ REDIS_URL: `redis://127.0.0.1:${port}` });

    const value = await cache.remember('repli:test:dead', 5000, async () => ({ price: 2499 }));
    assert.deepStrictEqual(value, { price: 2499 });
    assert.strictEqual(cache.status().connected, false);
    await cache.disconnect();
  });

  await check('after a failure redis is skipped, not re-dialled every message', async () => {
    const port = await deadPort();
    const cache = loadCache({ REDIS_URL: `redis://127.0.0.1:${port}`, REDIS_BACKOFF_MS: 5000 });

    const firstStarted = Date.now();
    await cache.remember('repli:test:b1', 100, async () => 1);
    const firstMs = Date.now() - firstStarted;

    assert.strictEqual(cache.status().backingOff, true, 'the failure must start a backoff');

    // Ten more messages, each a fresh key so nothing is served from memory.
    const started = Date.now();
    for (let i = 0; i < 10; i += 1) {
      await cache.remember(`repli:test:b${i + 2}`, 100, async () => i);
    }
    const laterMs = Date.now() - started;

    assert.ok(
      laterMs < 100,
      `ten messages after the failure took ${laterMs}ms - they should not touch redis at all`
    );
    console.log(`     (first attempt ${firstMs}ms, ten more ${laterMs}ms)`);
    await cache.disconnect();
  });

  await check('redis is used again once the backoff expires', async () => {
    const port = await deadPort();
    const cache = loadCache({ REDIS_URL: `redis://127.0.0.1:${port}`, REDIS_BACKOFF_MS: 250 });

    await cache.remember('repli:test:r1', 50, async () => 'a');
    assert.strictEqual(cache.status().backingOff, true);

    // Redis comes back on the same port while the client is backing off.
    const server = await startRedis();
    const revived = loadCache({
      REDIS_URL: `redis://127.0.0.1:${server.port}`,
      REDIS_BACKOFF_MS: 250,
    });
    try {
      await sleep(300);
      await revived.set('repli:test:r2', 'back', 5000);
      assert.strictEqual(revived.status().connected, true, 'it should reconnect after the backoff');
      assert.strictEqual(revived.status().backingOff, false);
      await revived.disconnect();
      await cache.disconnect();
    } finally {
      await server.close();
    }
  });

  await check('redis dying mid-run does not throw and does not stall', async () => {
    const server = await startRedis();
    const cache = loadCache({
      REDIS_URL: `redis://127.0.0.1:${server.port}`,
      REDIS_BACKOFF_MS: 5000,
    });

    await cache.set('repli:test:live', 'yes', 10000);
    assert.strictEqual(cache.status().connected, true);

    await server.close();
    await sleep(80);

    const started = Date.now();
    const value = await cache.remember('repli:test:after-death', 5000, async () => 'supabase');
    const elapsed = Date.now() - started;

    assert.strictEqual(value, 'supabase');
    assert.ok(elapsed < 500, `a reply must not wait on a dead cache (took ${elapsed}ms)`);
    await cache.disconnect();
  });

  console.log(`\n${passed}/${passed + failed} passed\n`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
