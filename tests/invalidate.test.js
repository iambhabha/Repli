'use strict';

/**
 * Tests for admin -> bot cache invalidation.
 *
 * The question this file answers is the only one that matters for Phase 2:
 * the owner changes a price in the panel - does the next thing the bot says
 * use the new number, or the old one?
 *
 * Both transports are exercised for real. Redis pub/sub runs against a small
 * RESP server started inside this process; the fallback runs against the real
 * `cache_invalidations` table in Supabase, so it needs the same .env the rest
 * of the suite needs and migration 014 applied.
 *
 *   node tests/invalidate.test.js
 */

process.env.TEST_MODE = 'true';

const assert = require('assert');
const fs = require('fs');
const net = require('net');
const path = require('path');

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

// ------------------------------------------- a redis that speaks pub/sub

function readCommand(buf) {
  if (!buf.length || buf[0] !== 0x2a) return null;
  let end = buf.indexOf('\r\n');
  if (end === -1) return null;
  const count = Number(buf.subarray(1, end).toString());
  const args = [];
  let cursor = end + 2;
  for (let i = 0; i < count; i += 1) {
    if (buf[cursor] !== 0x24) return null;
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

const array = (items) =>
  Buffer.concat([Buffer.from(`*${items.length}\r\n`), ...items.map((item) => bulk(item))]);

/** GET/SET/DEL/SCAN plus SUBSCRIBE/PUBLISH - enough for the invalidation wire. */
function startRedis({ port = 0 } = {}) {
  const store = new Map();
  const subscribers = new Map(); // socket -> Set(channel)
  const live = new Set();
  const state = { connections: 0, published: 0 };

  const server = net.createServer((socket) => {
    state.connections += 1;
    live.add(socket);
    socket.on('close', () => {
      live.delete(socket);
      subscribers.delete(socket);
    });
    socket.on('error', () => {});

    let buf = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        const parsed = readCommand(buf);
        if (!parsed) break;
        buf = buf.subarray(parsed.next);

        const [raw, ...args] = parsed.args;
        const name = String(raw).toUpperCase();

        if (name === 'SUBSCRIBE') {
          const channels = subscribers.get(socket) || new Set();
          for (const channel of args) {
            channels.add(channel);
            socket.write(array(['subscribe', channel, String(channels.size)]));
          }
          subscribers.set(socket, channels);
        } else if (name === 'PUBLISH') {
          state.published += 1;
          let delivered = 0;
          for (const [target, channels] of subscribers) {
            if (!channels.has(args[0])) continue;
            target.write(array(['message', args[0], args[1]]));
            delivered += 1;
          }
          socket.write(Buffer.from(`:${delivered}\r\n`));
        } else if (name === 'SET') {
          const px = args.findIndex((a) => String(a).toUpperCase() === 'PX');
          const ttl = px === -1 ? 0 : Number(args[px + 1]);
          store.set(args[0], { value: args[1], expires: ttl ? Date.now() + ttl : 0 });
          socket.write(Buffer.from('+OK\r\n'));
        } else if (name === 'GET') {
          const hit = store.get(args[0]);
          if (hit && hit.expires && Date.now() > hit.expires) store.delete(args[0]);
          const held = store.get(args[0]);
          socket.write(bulk(held ? held.value : null));
        } else if (name === 'DEL') {
          let removed = 0;
          for (const key of args) if (store.delete(key)) removed += 1;
          socket.write(Buffer.from(`:${removed}\r\n`));
        } else if (name === 'SCAN') {
          const mi = args.findIndex((a) => String(a).toUpperCase() === 'MATCH');
          const pattern = mi === -1 ? '*' : args[mi + 1];
          const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
          const keys = [...store.keys()].filter((key) => key.startsWith(prefix));
          socket.write(Buffer.concat([Buffer.from('*2\r\n'), bulk('0'), array(keys)]));
        } else {
          socket.write(Buffer.from('+OK\r\n'));
        }
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve({
        port: server.address().port,
        store,
        state,
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

/** A publisher that does what admin-panel/lib/cache.ts does over the wire. */
function panelPublish(port, events) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' }, () => {
      const commands = [];
      for (const event of events) {
        if (event.key) commands.push(['DEL', event.key]);
        commands.push(['PUBLISH', 'repli:invalidate', JSON.stringify(event)]);
      }
      const encode = (args) =>
        Buffer.concat([
          Buffer.from(`*${args.length}\r\n`),
          ...args.map((arg) =>
            Buffer.concat([
              Buffer.from(`$${Buffer.byteLength(String(arg))}\r\n`),
              Buffer.from(String(arg)),
              Buffer.from('\r\n'),
            ])
          ),
        ]);
      socket.write(Buffer.concat(commands.map(encode)));
      socket.once('data', () => setTimeout(() => {
        socket.destroy();
        resolve(true);
      }, 25));
    });
    socket.on('error', () => resolve(false));
  });
}

// --------------------------------------------------------- module loading

const ROOT = path.join(__dirname, '..');
const CACHE_PATH = path.join(ROOT, 'src', 'db', 'cache.js');
const INVALIDATE_PATH = path.join(ROOT, 'src', 'db', 'invalidate.js');

/** A fresh bot-side pair with its own REDIS_URL, the way a restart would be. */
function loadBot(env = {}) {
  const previous = {};
  for (const [key, value] of Object.entries(env)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = String(value);
  }

  delete require.cache[require.resolve(CACHE_PATH)];
  delete require.cache[require.resolve(INVALIDATE_PATH)];
  const cache = require(CACHE_PATH);
  const invalidate = require(INVALIDATE_PATH);

  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return { cache, invalidate };
}

/** Wait for a condition instead of guessing at a sleep length. */
async function until(predicate, { timeoutMs = 3000, everyMs = 25 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await predicate()) return true;
    if (Date.now() > deadline) return false;
    await sleep(everyMs);
  }
}

// -------------------------------------------------------------- the tests

async function run() {
  console.log('\n— redis pub/sub —\n');

  await check('a published invalidation clears the bot L1 copy', async () => {
    const server = await startRedis();
    try {
      const { cache, invalidate } = loadBot({ REDIS_URL: `redis://127.0.0.1:${server.port}` });
      const listener = invalidate.startInvalidationListener({ intervalMs: 100000 });

      await cache.remember(cache.KEYS.catalogue, 600000, async () => ({ price: 2499 }));
      assert.deepStrictEqual(await cache.get(cache.KEYS.catalogue), { price: 2499 });

      assert.ok(await until(() => listener.status().redis.connected), 'subscriber never connected');
      await panelPublish(server.port, [{ key: cache.KEYS.catalogue, source: 'panel:product' }]);

      const gone = await until(async () => (await cache.get(cache.KEYS.catalogue)) === undefined);
      assert.ok(gone, 'the cached copy should have been dropped');

      // Next read must reach the loader again, i.e. Supabase.
      let reloaded = false;
      const value = await cache.remember(cache.KEYS.catalogue, 600000, async () => {
        reloaded = true;
        return { price: 3999 };
      });
      assert.strictEqual(reloaded, true);
      assert.deepStrictEqual(value, { price: 3999 });

      listener.stop();
      await cache.disconnect();
    } finally {
      await server.close();
    }
  });

  await check('only the named key goes; its neighbours stay', async () => {
    const server = await startRedis();
    try {
      const { cache, invalidate } = loadBot({ REDIS_URL: `redis://127.0.0.1:${server.port}` });
      const listener = invalidate.startInvalidationListener({ intervalMs: 100000 });

      await cache.set(cache.KEYS.stock('p1'), 3, 600000);
      await cache.set(cache.KEYS.stock('p2'), 7, 600000);
      await cache.set(cache.KEYS.catalogue, 'products', 600000);
      assert.ok(await until(() => listener.status().redis.connected));

      await panelPublish(server.port, [{ key: cache.KEYS.stock('p1'), source: 'panel:stock' }]);
      assert.ok(await until(async () => (await cache.get(cache.KEYS.stock('p1'))) === undefined));

      assert.strictEqual(await cache.get(cache.KEYS.stock('p2')), 7, 'other product untouched');
      assert.strictEqual(await cache.get(cache.KEYS.catalogue), 'products', 'catalogue untouched');
      assert.strictEqual(server.store.has(cache.KEYS.stock('p1')), false, 'gone from redis too');

      listener.stop();
      await cache.disconnect();
    } finally {
      await server.close();
    }
  });

  await check('a prefix invalidation clears the whole family', async () => {
    const server = await startRedis();
    try {
      const { cache, invalidate } = loadBot({ REDIS_URL: `redis://127.0.0.1:${server.port}` });
      const listener = invalidate.startInvalidationListener({ intervalMs: 100000 });

      await cache.set(cache.KEYS.stock('p1'), 1, 600000);
      await cache.set(cache.KEYS.stock('p2'), 2, 600000);
      await cache.set(cache.KEYS.catalogue, 'products', 600000);
      assert.ok(await until(() => listener.status().redis.connected));

      await panelPublish(server.port, [{ prefix: cache.KEYS.stockPrefix, source: 'test' }]);
      assert.ok(await until(async () => (await cache.get(cache.KEYS.stock('p2'))) === undefined));

      assert.strictEqual(await cache.get(cache.KEYS.stock('p1')), undefined);
      assert.strictEqual(await cache.get(cache.KEYS.catalogue), 'products');

      listener.stop();
      await cache.disconnect();
    } finally {
      await server.close();
    }
  });

  await check('the same invalidation twice is harmless', async () => {
    const server = await startRedis();
    try {
      const { cache, invalidate } = loadBot({ REDIS_URL: `redis://127.0.0.1:${server.port}` });
      const listener = invalidate.startInvalidationListener({ intervalMs: 100000 });
      assert.ok(await until(() => listener.status().redis.connected));

      await cache.set(cache.KEYS.bypass, ['919999999999'], 600000);
      for (let i = 0; i < 5; i += 1) {
        await panelPublish(server.port, [{ key: cache.KEYS.bypass, source: 'panel:bypass' }]);
      }
      await until(() => listener.status().redis.messages >= 5);

      assert.strictEqual(await cache.get(cache.KEYS.bypass), undefined);

      // Cleared five times over, and the cache still works afterwards.
      const reloaded = await cache.remember(cache.KEYS.bypass, 600000, async () => ['918888888888']);
      assert.deepStrictEqual(reloaded, ['918888888888']);

      listener.stop();
      await cache.disconnect();
    } finally {
      await server.close();
    }
  });

  await check('a key outside repli: is ignored, and a bad payload does not kill it', async () => {
    const server = await startRedis();
    try {
      const { cache, invalidate } = loadBot({ REDIS_URL: `redis://127.0.0.1:${server.port}` });
      const listener = invalidate.startInvalidationListener({ intervalMs: 100000 });
      assert.ok(await until(() => listener.status().redis.connected));

      await cache.set(cache.KEYS.catalogue, 'products', 600000);

      await panelPublish(server.port, [{ key: 'something:else' }]);
      await panelPublish(server.port, [{ nonsense: true }]);
      await until(() => listener.status().redis.messages >= 2);

      assert.strictEqual(await cache.get(cache.KEYS.catalogue), 'products', 'nothing should have been dropped');

      // Still alive, still listening.
      await panelPublish(server.port, [{ key: cache.KEYS.catalogue }]);
      assert.ok(await until(async () => (await cache.get(cache.KEYS.catalogue)) === undefined));

      listener.stop();
      await cache.disconnect();
    } finally {
      await server.close();
    }
  });

  await check('the subscriber survives redis dying and reconnects when it returns', async () => {
    const first = await startRedis();
    const port = first.port;
    const { cache, invalidate } = loadBot({ REDIS_URL: `redis://127.0.0.1:${port}` });
    const listener = invalidate.startInvalidationListener({ intervalMs: 100000 });

    try {
      assert.ok(await until(() => listener.status().redis.connected), 'never connected');

      await first.close();
      assert.ok(
        await until(() => listener.status().redis.connected === false),
        'should have noticed the disconnect'
      );

      // The bot is still perfectly usable with no Redis at all.
      const value = await cache.remember('repli:test:alive', 5000, async () => 'from supabase');
      assert.strictEqual(value, 'from supabase');

      const second = await startRedis({ port });
      try {
        assert.ok(
          await until(() => listener.status().redis.connected, { timeoutMs: 8000 }),
          'should have reconnected'
        );

        await cache.set(cache.KEYS.faq, { city: 'Mumbai' }, 600000);
        await panelPublish(port, [{ key: cache.KEYS.faq, source: 'panel:settings' }]);
        assert.ok(
          await until(async () => (await cache.get(cache.KEYS.faq)) === undefined),
          'invalidation should work again after the reconnect'
        );
      } finally {
        await second.close();
      }
    } finally {
      listener.stop();
      await cache.disconnect();
    }
  });

  await check('no redis at all: the listener starts, reports it, and nothing breaks', async () => {
    const { cache, invalidate } = loadBot({ REDIS_URL: undefined });
    const listener = invalidate.startInvalidationListener({ intervalMs: 100000 });
    try {
      assert.strictEqual(listener.status().redis.enabled, false);
      assert.strictEqual(listener.status().redis.connected, false);
      const value = await cache.remember('repli:test:noredis', 5000, async () => 'ok');
      assert.strictEqual(value, 'ok');
    } finally {
      listener.stop();
    }
  });

  console.log('\n— supabase fallback (no redis) —\n');

  const { supabase } = require('../src/db/supabase');

  /** Rows this file wrote, cleaned up at the end. */
  const written = [];
  async function panelRow(event) {
    const { data, error } = await supabase
      .from('cache_invalidations')
      .insert({
        cache_key: event.key || event.prefix,
        is_prefix: Boolean(event.prefix),
        source: event.source || 'test',
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    written.push(data.id);
    return data.id;
  }

  await check('a row written by the panel clears the bot cache on the next poll', async () => {
    const { cache, invalidate } = loadBot({ REDIS_URL: undefined });
    const listener = invalidate.startInvalidationListener({ intervalMs: 100000 });
    try {
      await cache.remember(cache.KEYS.catalogue, 600000, async () => ({ price: 2499 }));
      await panelRow({ key: cache.KEYS.catalogue, source: 'panel:product' });

      await listener.poller.tick();
      assert.strictEqual(await cache.get(cache.KEYS.catalogue), undefined);
      assert.strictEqual(listener.poller.status().disabled, false, 'the poller must be healthy');
    } finally {
      listener.stop();
    }
  });

  await check('a prefix row clears the family, and only it', async () => {
    const { cache, invalidate } = loadBot({ REDIS_URL: undefined });
    const listener = invalidate.startInvalidationListener({ intervalMs: 100000 });
    try {
      await cache.set(cache.KEYS.stock('a'), 1, 600000);
      await cache.set(cache.KEYS.stock('b'), 2, 600000);
      await cache.set(cache.KEYS.categories, ['tshirt'], 600000);

      await panelRow({ prefix: cache.KEYS.stockPrefix });
      await listener.poller.tick();

      assert.strictEqual(await cache.get(cache.KEYS.stock('a')), undefined);
      assert.strictEqual(await cache.get(cache.KEYS.stock('b')), undefined);
      assert.deepStrictEqual(await cache.get(cache.KEYS.categories), ['tshirt']);
    } finally {
      listener.stop();
    }
  });

  await check('rows are read forward: a second poll does not replay them', async () => {
    const { cache, invalidate } = loadBot({ REDIS_URL: undefined });
    const listener = invalidate.startInvalidationListener({ intervalMs: 100000 });
    try {
      await panelRow({ key: cache.KEYS.admins });
      await listener.poller.tick();
      const seen = listener.poller.status().watermark;

      await cache.set(cache.KEYS.admins, ['919999999999'], 600000);
      await listener.poller.tick();

      assert.strictEqual(listener.poller.status().watermark, seen, 'watermark must not move');
      assert.deepStrictEqual(
        await cache.get(cache.KEYS.admins),
        ['919999999999'],
        'an already-processed row must not fire again'
      );
    } finally {
      listener.stop();
    }
  });

  await check('a bot starting up replays the last minute of invalidations', async () => {
    // The panel drops a key while the bot is down...
    const cold = loadBot({ REDIS_URL: undefined });
    await panelRow({ key: cold.cache.KEYS.allowed, source: 'panel:settings' });

    // ...then the bot starts, with the key somehow already warm.
    const { cache, invalidate } = loadBot({ REDIS_URL: undefined });
    await cache.set(cache.KEYS.allowed, ['919829374438'], 600000);

    const listener = invalidate.startInvalidationListener({ intervalMs: 100000 });
    try {
      await listener.poller.tick();
      assert.strictEqual(
        await cache.get(cache.KEYS.allowed),
        undefined,
        'a fresh process should still catch a recent invalidation'
      );
    } finally {
      listener.stop();
    }
  });

  console.log('\n— the whole path: panel edit -> bot says the new number —\n');

  await check('a price changed "in the panel" reaches the bot on the next message', async () => {
    const { cache, invalidate } = loadBot({ REDIS_URL: undefined });
    delete require.cache[require.resolve('../src/services/productService')];
    const productService = require('../src/services/productService');
    const listener = invalidate.startInvalidationListener({ intervalMs: 100000 });

    const products = await productService.activeProducts();
    const product = products[0];
    assert.ok(product, 'the test database needs at least one active product');
    const originalPrice = Number(product.price);

    try {
      // The bot has quoted the old price and cached it.
      const before = productService.priceOf(await productService.getById(product.id));
      assert.strictEqual(before, Math.round(originalPrice));

      // The owner edits the price in the panel: Supabase write, then invalidate.
      const newPrice = originalPrice + 111;
      const { error } = await supabase
        .from('products')
        .update({ price: newPrice })
        .eq('id', product.id);
      if (error) throw new Error(error.message);

      // Without the invalidation the bot would still be on the old number.
      const stale = productService.priceOf(await productService.getById(product.id));
      assert.strictEqual(stale, Math.round(originalPrice), 'cache should still be holding the old price');

      await panelRow({ key: cache.KEYS.catalogue, source: 'panel:product' });
      await listener.poller.tick();

      const after = productService.priceOf(await productService.getById(product.id));
      assert.strictEqual(after, Math.round(newPrice), 'the bot must now quote the new price');
    } finally {
      await supabase.from('products').update({ price: originalPrice }).eq('id', product.id);
      listener.stop();
      await productService.invalidate();
    }
  });

  await check('a stock change "in the panel" reaches the bot on the next message', async () => {
    const { cache, invalidate } = loadBot({ REDIS_URL: undefined });
    delete require.cache[require.resolve('../src/services/productService')];
    const productService = require('../src/services/productService');
    const listener = invalidate.startInvalidationListener({ intervalMs: 100000 });

    const products = await productService.activeProducts();
    let target = null;
    for (const product of products) {
      const variants = await productService.variantsOf(product.id);
      if (variants.length) {
        target = { product, variant: variants[0] };
        break;
      }
    }
    assert.ok(target, 'the test database needs at least one variant');
    const originalStock = Number(target.variant.stock_quantity);

    try {
      const before = await productService.stockOf(
        target.product.id,
        target.variant.color,
        target.variant.size
      );
      assert.strictEqual(before, Math.max(0, originalStock));

      const newStock = originalStock + 5;
      const { error } = await supabase
        .from('product_variants')
        .update({ stock_quantity: newStock })
        .eq('id', target.variant.id);
      if (error) throw new Error(error.message);

      await panelRow({ key: cache.KEYS.stock(target.product.id), source: 'panel:stock' });
      await listener.poller.tick();

      const after = await productService.stockOf(
        target.product.id,
        target.variant.color,
        target.variant.size
      );
      assert.strictEqual(after, newStock, 'the bot must now see the new stock');
    } finally {
      await supabase
        .from('product_variants')
        .update({ stock_quantity: originalStock })
        .eq('id', target.variant.id);
      listener.stop();
      await productService.invalidate();
    }
  });

  console.log('\n— the panel and the bot agree on the keys —\n');

  await check('every key the panel writes is a key the bot reads', async () => {
    const { cache } = loadBot({ REDIS_URL: undefined });
    const source = fs.readFileSync(path.join(ROOT, 'admin-panel', 'lib', 'cache.ts'), 'utf8');

    const expected = {
      catalogue: cache.KEYS.catalogue,
      stock: cache.KEYS.stock('ID'),
      categories: cache.KEYS.categories,
      settings: cache.KEYS.settings('KEY'),
      templates: cache.KEYS.templates('LANG'),
      bypass: cache.KEYS.bypass,
      faq: cache.KEYS.faq,
      admins: cache.KEYS.admins,
      allowed: cache.KEYS.allowed,
    };

    for (const [name, key] of Object.entries(expected)) {
      // The panel writes them as literals or template strings; compare the
      // shape with the placeholders put back.
      const asTemplate = key
        .replace('ID', '${productId}')
        .replace('KEY', '${key}')
        .replace('LANG', '${language}');
      assert.ok(
        source.includes(`'${key}'`) || source.includes(`\`${asTemplate}\``),
        `admin-panel/lib/cache.ts is missing the ${name} key (${key})`
      );
    }

    assert.ok(
      source.includes("'repli:invalidate'"),
      'the panel must publish on the channel the bot subscribes to'
    );
  });

  await check('every panel write actually calls an invalidation', async () => {
    const wiring = {
      'products.ts': ['invalidateProduct(', 'invalidateStock('],
      'stock.ts': ['invalidateStock('],
      'settings.ts': ['invalidateSettings('],
      'templates.ts': ['invalidateTemplates('],
      'bypass.ts': ['invalidateBypass('],
    };

    for (const [file, calls] of Object.entries(wiring)) {
      const source = fs.readFileSync(
        path.join(ROOT, 'admin-panel', 'lib', 'services', file),
        'utf8'
      );
      for (const call of calls) {
        assert.ok(source.includes(call), `${file} never calls ${call})`);
      }
      assert.ok(
        source.includes("from '@/lib/cache'"),
        `${file} does not import the invalidation helper`
      );
    }

    // Counted rather than merely present: every write path, not just one.
    const products = fs.readFileSync(
      path.join(ROOT, 'admin-panel', 'lib', 'services', 'products.ts'),
      'utf8'
    );
    const calls = (products.match(/await invalidate(Product|Stock)\(/g) || []).length;
    assert.ok(calls >= 5, `products.ts has ${calls} invalidation calls, expected one per write`);
  });

  // ------------------------------------------------------------- cleanup
  if (written.length) {
    await supabase.from('cache_invalidations').delete().in('id', written);
  }

  console.log(`\n${passed}/${passed + failed} passed\n`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
