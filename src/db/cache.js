'use strict';

/**
 * One cache, two backings.
 *
 * Without REDIS_URL it is a plain in-process Map. That is not a lesser
 * option - for a single bot process it is the fastest thing available, since
 * a memory read is free and every Redis read is still a network hop.
 *
 * Redis earns its place when there is more than one reader: the bot on the
 * server and the admin panel on Vercel, or two bot processes. Then a price
 * changed in the panel can be pushed out immediately instead of every
 * process waiting out its own timer, and a restart starts warm.
 *
 * Written on `net`/`tls` directly rather than a client library: what we need
 * is GET, SET, DEL and SCAN, and the RESP protocol for those is a page of
 * code. One fewer dependency in a bot that has to keep running on a small
 * server.
 *
 * Read order is always the same, and every step is allowed to fail:
 *
 *   L1 memory (<= 5s)  ->  Redis  ->  Supabase
 *
 * Redis being unreachable is not an error condition for the shop. It is a
 * slower cache, nothing more: the loader runs and the customer never sees a
 * difference.
 */

const net = require('net');
const tls = require('tls');
const logger = require('../logger');

const URL_STRING = String(process.env.REDIS_URL || '').trim();

/**
 * How long a Redis failure is believed.
 *
 * Without this every single message re-dialled a dead Redis and paid the
 * full connect timeout before falling through to Supabase - which turned an
 * outage of a cache into three seconds on every reply. After a failure Redis
 * is simply skipped until the backoff expires; the next call after that may
 * reconnect.
 */
const BACKOFF_MS = Math.max(1000, Number(process.env.REDIS_BACKOFF_MS) || 30000);
const CONNECT_TIMEOUT_MS = Math.max(250, Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 3000);

/**
 * Managed Redis usually presents a certificate from a public CA, so the
 * default is to verify it. The knob exists for a private CA or a self-signed
 * endpoint - and for this repo's own TLS test.
 */
const REJECT_UNAUTHORIZED = String(process.env.REDIS_TLS_REJECT_UNAUTHORIZED || 'true') !== 'false';

/**
 * The in-process copy is deliberately short-lived even when the shared TTL is
 * long. Redis can be told a key is gone; a Map in another process cannot, so
 * five seconds is the worst case for an invalidation this process missed.
 */
const LOCAL_MAX_TTL_MS = 5000;
const MEMORY_MAX = 1000;

/**
 * Every key the shop caches, in one place.
 *
 * Named here rather than spelled out at each call site so that the admin
 * panel can later delete exactly these keys, and so `grep repli:` finds the
 * whole surface.
 */
const KEYS = {
  catalogue: 'repli:catalogue',
  stock: (productId) => `repli:stock:${productId}`,
  stockPrefix: 'repli:stock:',
  categories: 'repli:categories',
  settings: (key) => `repli:settings:${key}`,
  settingsPrefix: 'repli:settings:',
  templates: (lang) => `repli:templates:${lang}`,
  templatesPrefix: 'repli:templates:',
  bypass: 'repli:bypass',
  faq: 'repli:faq',
  admins: 'repli:admins',
  allowed: 'repli:allowed',
};

// ------------------------------------------------------------------ memory

const memory = new Map();

function memoryGet(key) {
  const hit = memory.get(key);
  if (!hit) return undefined;
  if (hit.expires && Date.now() > hit.expires) {
    memory.delete(key);
    return undefined;
  }
  return hit.value;
}

function memorySet(key, value, ttlMs) {
  memory.set(key, { value, expires: ttlMs ? Date.now() + ttlMs : 0 });
  if (memory.size > MEMORY_MAX) memory.delete(memory.keys().next().value);
}

function memoryDeletePrefix(prefix) {
  for (const key of [...memory.keys()]) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
}

// ------------------------------------------------------------------- redis

let wire = null; // the socket, from the moment it connects
let ready = false; // ... and once AUTH/SELECT have been answered
let connecting = null;
let queue = [];
let buffer = Buffer.alloc(0);
let unavailableUntil = 0;
let warnedAt = 0;

function parseUrl() {
  try {
    const url = new URL(URL_STRING);
    const db = url.pathname && url.pathname.length > 1 ? url.pathname.slice(1) : null;
    return {
      host: url.hostname,
      port: Number(url.port) || 6379,
      password: url.password ? decodeURIComponent(url.password) : null,
      username: url.username ? decodeURIComponent(url.username) : null,
      db: db && /^\d+$/.test(db) ? db : null,
      tls: url.protocol === 'rediss:',
    };
  } catch (err) {
    logger.warn('cache.bad_redis_url', { error: err.message });
    return null;
  }
}

/** RESP array: *N\r\n$len\r\narg\r\n... */
function encode(args) {
  return Buffer.concat([
    Buffer.from(`*${args.length}\r\n`),
    ...args.map((arg) => {
      const body = Buffer.from(String(arg));
      return Buffer.concat([Buffer.from(`$${body.length}\r\n`), body, Buffer.from('\r\n')]);
    }),
  ]);
}

/**
 * One RESP value out of a Buffer.
 *
 * Buffer rather than string on purpose: a bulk string's length is a count of
 * BYTES, and the shop's own text is full of things that are not one byte -
 * the rupee sign in every price line, the emoji in every template. Parsing
 * this as a JS string silently truncated any cached value containing one.
 *
 * @returns {{value: any, next: number}|null} null when more data is needed
 */
function parse(buf, offset) {
  const end = buf.indexOf('\r\n', offset);
  if (end === -1) return null;

  const head = String.fromCharCode(buf[offset]);
  const line = buf.subarray(offset + 1, end).toString();

  if (head === '+' || head === ':') return { value: line, next: end + 2 };
  if (head === '-') return { value: new Error(line), next: end + 2 };

  if (head === '$') {
    const length = Number(line);
    if (length === -1) return { value: null, next: end + 2 };
    const start = end + 2;
    if (buf.length < start + length + 2) return null; // wait for the rest
    return { value: buf.subarray(start, start + length).toString(), next: start + length + 2 };
  }

  if (head === '*') {
    const count = Number(line);
    if (count === -1) return { value: null, next: end + 2 };
    const items = [];
    let cursor = end + 2;
    for (let i = 0; i < count; i += 1) {
      const item = parse(buf, cursor);
      if (!item) return null;
      items.push(item.value);
      cursor = item.next;
    }
    return { value: items, next: cursor };
  }

  return { value: new Error(`unexpected RESP byte ${head}`), next: end + 2 };
}

/** Everything in flight gets a null answer; nobody is left waiting. */
function drain() {
  const waiting = queue;
  queue = [];
  buffer = Buffer.alloc(0);
  waiting.forEach((entry) => entry.resolve(null));
}

function goDown(reason) {
  unavailableUntil = Date.now() + BACKOFF_MS;
  ready = false;
  if (wire) {
    wire.removeAllListeners();
    wire.destroy();
  }
  wire = null;

  // One line per backoff window, not one per message.
  if (Date.now() - warnedAt > BACKOFF_MS) {
    warnedAt = Date.now();
    logger.warn('cache.redis_unavailable', {
      error: reason,
      action: `skipping redis for ${Math.round(BACKOFF_MS / 1000)}s`,
    });
  }
  drain();
}

function write(args) {
  return new Promise((resolve) => {
    if (!wire) return resolve(null);
    queue.push({ resolve });
    wire.write(encode(args), (err) => {
      if (err) resolve(null);
    });
  });
}

/** A command for callers: only ever sent on a connection that is up. */
function command(args) {
  if (!wire || !ready) return Promise.resolve(null);
  return write(args);
}

/**
 * A connected, authenticated Redis socket - and nothing else.
 *
 * Two things need one: the command connection below, and the invalidation
 * subscriber. A connection in SUBSCRIBE mode cannot answer GET, so they must
 * be separate sockets - but the awkward parts, TLS and the AUTH/SELECT
 * handshake, are identical and live here rather than in two places.
 *
 * The caller attaches its own 'data' handler afterwards; this function
 * removes its own before handing the socket over.
 *
 * @returns {Promise<{socket?: object, leftover?: Buffer, error?: string}>}
 */
function openSocket(options) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    /**
     * rediss:// is a TLS socket, not a plain one. Parsing the scheme and then
     * opening a plain connection anyway meant every managed Redis endpoint -
     * which is where this feature is actually needed - failed at the
     * handshake.
     */
    const client = options.tls
      ? tls.connect({
          host: options.host,
          port: options.port,
          servername: options.host,
          rejectUnauthorized: REJECT_UNAUTHORIZED,
        })
      : net.createConnection({ host: options.host, port: options.port });

    const fail = (err) => {
      client.removeAllListeners();
      client.destroy();
      done({ error: String((err && err.message) || err || 'connect failed') });
    };

    client.setNoDelay(true);
    client.once('error', fail);
    client.setTimeout(CONNECT_TIMEOUT_MS, () => fail(new Error('connect timeout')));

    client.once(options.tls ? 'secureConnect' : 'connect', () => {
      client.setTimeout(0);

      const handshake = [];
      if (options.password) {
        handshake.push(
          options.username
            ? ['AUTH', options.username, options.password]
            : ['AUTH', options.password]
        );
      }
      if (options.db) handshake.push(['SELECT', options.db]);

      if (!handshake.length) {
        client.removeListener('error', fail);
        return done({ socket: client });
      }

      /**
       * The handshake is read here, before the caller sees the socket, so a
       * command can never overtake AUTH and be answered with NOAUTH.
       */
      let pending = handshake.length;
      let hs = Buffer.alloc(0);

      const onData = (chunk) => {
        hs = hs.length ? Buffer.concat([hs, chunk]) : chunk;
        for (;;) {
          const parsed = parse(hs, 0);
          if (!parsed) break;
          hs = hs.subarray(parsed.next);
          if (parsed.value instanceof Error) {
            client.removeListener('data', onData);
            return fail(new Error(parsed.value.message));
          }
          pending -= 1;
          if (pending === 0) {
            client.removeListener('data', onData);
            client.removeListener('error', fail);
            return done({ socket: client, leftover: hs });
          }
        }
      };

      client.on('data', onData);
      for (const args of handshake) client.write(encode(args));
    });
  });
}

function connect() {
  if (ready && wire) return Promise.resolve(wire);
  if (connecting) return connecting;
  if (!URL_STRING) return Promise.resolve(null);
  if (Date.now() < unavailableUntil) return Promise.resolve(null);

  const options = parseUrl();
  if (!options) {
    unavailableUntil = Date.now() + BACKOFF_MS;
    return Promise.resolve(null);
  }

  connecting = (async () => {
    const result = await openSocket(options);

    if (!result.socket) {
      connecting = null;
      goDown(result.error);
      return null;
    }

    const client = result.socket;
    wire = client;
    buffer = result.leftover && result.leftover.length ? result.leftover : Buffer.alloc(0);

    client.on('data', (chunk) => {
      buffer = buffer.length ? Buffer.concat([buffer, chunk]) : chunk;
      for (;;) {
        const parsed = parse(buffer, 0);
        if (!parsed) break;
        buffer = buffer.subarray(parsed.next);
        const waiting = queue.shift();
        if (waiting) waiting.resolve(parsed.value instanceof Error ? null : parsed.value);
      }
    });

    // A live socket needs an error handler of its own, or an ECONNRESET from
    // Redis would take the bot down with it.
    client.on('error', (err) => goDown(String(err && err.message)));
    client.on('close', () => {
      if (wire === client) goDown('connection closed');
    });

    ready = true;
    unavailableUntil = 0;
    warnedAt = 0;
    connecting = null;

    logger.info('cache.redis_connected', {
      action: `${options.tls ? 'rediss' : 'redis'}://${options.host}:${options.port}`,
    });
    return client;
  })();

  return connecting;
}

// -------------------------------------------------------------------- api

const enabled = () => Boolean(URL_STRING);

/**
 * Two callers, one query.
 *
 * A burst of messages used to mean a burst of identical Supabase reads,
 * because every one of them missed the cache before the first had finished
 * filling it. The in-flight promise is shared instead.
 */
const inFlight = new Map();

/**
 * @param {string} key
 * @param {number} ttlMs
 * @param {() => Promise<any>} load  called on a miss
 */
async function remember(key, ttlMs, load) {
  const local = memoryGet(key);
  if (local !== undefined) return local;

  const shared = inFlight.get(key);
  if (shared) return shared;

  const work = (async () => {
    const client = await connect(); // null: disabled, backing off, or down
    if (client) {
      const raw = await command(['GET', key]);
      if (typeof raw === 'string') {
        try {
          const value = JSON.parse(raw);
          memorySet(key, value, Math.min(ttlMs, LOCAL_MAX_TTL_MS));
          return value;
        } catch (err) {
          /* corrupt entry - fall through and reload */
        }
      }
    }

    // undefined is the miss sentinel in the Map, so a loader that returns
    // nothing must not be stored as nothing.
    const loaded = await load();
    const value = loaded === undefined ? null : loaded;
    memorySet(key, value, Math.min(ttlMs, LOCAL_MAX_TTL_MS));

    if (ready) {
      void command([
        'SET',
        key,
        JSON.stringify(value),
        'PX',
        String(Math.max(1, Math.round(ttlMs))),
      ]);
    }
    return value;
  })().finally(() => inFlight.delete(key));

  inFlight.set(key, work);
  return work;
}

/** Whatever is cached for this key, or undefined. Does not load. */
async function get(key) {
  const local = memoryGet(key);
  if (local !== undefined) return local;

  const client = await connect();
  if (!client) return undefined;

  const raw = await command(['GET', key]);
  if (typeof raw !== 'string') return undefined;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return undefined;
  }
}

/** Write through, for a value the caller already knows is current. */
async function set(key, value, ttlMs) {
  const stored = value === undefined ? null : value;
  memorySet(key, stored, Math.min(ttlMs, LOCAL_MAX_TTL_MS));
  inFlight.delete(key);

  const client = await connect();
  if (client) {
    await command([
      'SET',
      key,
      JSON.stringify(stored),
      'PX',
      String(Math.max(1, Math.round(ttlMs))),
    ]);
  }
  return stored;
}

/**
 * Drop a key everywhere.
 *
 * The memory copy goes first and synchronously, before any await: callers
 * that cannot wait for the round trip (a stock change on the reply path)
 * still see their own process corrected immediately.
 */
async function del(key) {
  memory.delete(key);
  inFlight.delete(key);
  const client = await connect();
  if (client) await command(['DEL', key]);
}

/** Same, for a family of keys - every product's stock, every language's templates. */
async function delPrefix(prefix) {
  memoryDeletePrefix(prefix);
  for (const key of [...inFlight.keys()]) {
    if (key.startsWith(prefix)) inFlight.delete(key);
  }

  const client = await connect();
  if (!client) return;

  // SCAN rather than KEYS: KEYS blocks the server, and this runs on a shared
  // managed instance.
  let cursor = '0';
  do {
    const reply = await command(['SCAN', cursor, 'MATCH', `${prefix}*`, 'COUNT', '200']);
    if (!Array.isArray(reply) || reply.length < 2) break;
    cursor = String(reply[0]);
    const found = Array.isArray(reply[1]) ? reply[1] : [];
    if (found.length) await command(['DEL', ...found]);
  } while (cursor !== '0');
}

/** Local only. Deliberately never FLUSHDB: the shop does not own the server. */
function forgetAll() {
  memory.clear();
  inFlight.clear();
}

/** For diagnostics and tests - never for business decisions. */
function status() {
  return {
    enabled: enabled(),
    connected: Boolean(ready && wire),
    backingOff: Date.now() < unavailableUntil,
    backoffMsLeft: Math.max(0, unavailableUntil - Date.now()),
    memoryKeys: memory.size,
  };
}

/**
 * Listen on a Redis channel, on a connection of its own.
 *
 * A socket in SUBSCRIBE mode may not answer GET, so this deliberately does
 * not share the command connection above. It is also deliberately optional:
 * without REDIS_URL, or with Redis down, it simply reports "not connected"
 * and everything else carries on. A subscriber that could stop the shop
 * would be worse than no subscriber at all.
 *
 * @param {string} channel
 * @param {(payload: string) => void} onMessage
 * @returns {{stop: () => void, status: () => object}}
 */
function subscribe(channel, onMessage) {
  const state = { connected: false, messages: 0, attempts: 0, lastError: null };
  let socket = null;
  let timer = null;
  let stopped = false;

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  function retry(reason) {
    state.connected = false;
    state.lastError = reason || null;
    if (socket) {
      socket.removeAllListeners();
      socket.destroy();
      socket = null;
    }
    if (stopped) return;

    // Back off gently, then steadily: a Redis that is restarting should be
    // found again quickly, one that is gone for the afternoon should not be
    // dialled every second.
    state.attempts += 1;
    const delay = Math.min(BACKOFF_MS, 1000 * 2 ** Math.min(5, state.attempts - 1));
    clearTimer();
    timer = setTimeout(dial, delay);
    if (timer.unref) timer.unref();
  }

  async function dial() {
    if (stopped || !URL_STRING) return;

    const options = parseUrl();
    if (!options) return retry('bad redis url');

    const result = await openSocket(options);
    if (stopped) {
      if (result.socket) result.socket.destroy();
      return;
    }
    if (!result.socket) return retry(result.error);

    const client = result.socket;
    socket = client;
    let buf = result.leftover && result.leftover.length ? result.leftover : Buffer.alloc(0);

    client.on('data', (chunk) => {
      buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
      for (;;) {
        const parsed = parse(buf, 0);
        if (!parsed) break;
        buf = buf.subarray(parsed.next);

        const value = parsed.value;
        if (!Array.isArray(value)) continue; // +OK and friends

        const kind = String(value[0] || '').toLowerCase();
        if (kind === 'subscribe') {
          state.connected = true;
          state.attempts = 0;
          state.lastError = null;
          logger.info('cache.subscribed', { action: channel });
          continue;
        }
        if (kind === 'message' && value.length >= 3) {
          state.messages += 1;
          // A handler that throws must not take the socket - or the bot - with it.
          try {
            onMessage(String(value[2]));
          } catch (err) {
            logger.warn('cache.subscriber_handler_failed', { error: String(err && err.message) });
          }
        }
      }
    });

    client.on('error', (err) => retry(String(err && err.message)));
    client.on('close', () => retry('connection closed'));

    client.write(encode(['SUBSCRIBE', channel]));
  }

  void dial();

  return {
    stop() {
      stopped = true;
      clearTimer();
      if (socket) {
        socket.removeAllListeners();
        socket.destroy();
        socket = null;
      }
      state.connected = false;
    },
    status: () => ({ ...state, enabled: enabled() }),
  };
}

/**
 * Tell every other process that a key is stale.
 *
 * Fire and forget by design: this is a hint, not a transaction. Whoever
 * misses it still sees the truth when the TTL lapses.
 */
async function publish(channel, payload) {
  const client = await connect();
  if (!client) return false;
  const reply = await command(['PUBLISH', channel, payload]);
  return reply !== null;
}

/** Close the socket. Used by tests and by a clean shutdown. */
async function disconnect() {
  ready = false;
  if (wire) {
    wire.removeAllListeners();
    wire.destroy();
  }
  wire = null;
  connecting = null;
  unavailableUntil = 0;
  drain();
}

module.exports = {
  KEYS,
  remember,
  get,
  set,
  del,
  delPrefix,
  // Kept under their original names so existing call sites need no edit.
  forget: del,
  forgetPrefix: delPrefix,
  forgetAll,
  subscribe,
  publish,
  enabled,
  status,
  disconnect,
};
