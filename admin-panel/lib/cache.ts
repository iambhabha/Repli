import net from 'node:net';
import tls from 'node:tls';

import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Telling the bot that something it cached has changed.
 *
 * The panel and the bot are different processes on different machines. When
 * the owner edits a price here, Supabase has the new number instantly and the
 * bot does not: it is holding a cached copy and will keep quoting the old one
 * until its timer lapses. This module is the one line that closes that gap.
 *
 * It is deliberately thin, and deliberately unable to break anything:
 *
 *   - it is only ever called AFTER the database write has succeeded;
 *   - it never throws, so a Redis outage cannot turn a saved price into an
 *     error message on the owner's screen;
 *   - if Redis is missing or refuses the connection, the invalidation is
 *     appended to `cache_invalidations` instead, which the bot polls.
 *
 * No cached data travels over this wire - only the NAME of the stale key.
 *
 * Server only. REDIS_URL has no NEXT_PUBLIC_ prefix, so Next.js cannot inline
 * it into a client bundle, and `net`/`tls` would not resolve in a browser
 * even if it tried.
 */

/** Must match CHANNEL in src/db/invalidate.js. */
const CHANNEL = 'repli:invalidate';

/** Must match KEYS in src/db/cache.js. tests/invalidate.test.js checks they agree. */
export const CACHE_KEYS = {
  catalogue: 'repli:catalogue',
  stock: (productId: string) => `repli:stock:${productId}`,
  categories: 'repli:categories',
  settings: (key: string) => `repli:settings:${key}`,
  templates: (language: string) => `repli:templates:${language}`,
  bypass: 'repli:bypass',
  faq: 'repli:faq',
  admins: 'repli:admins',
  allowed: 'repli:allowed',
} as const;

export interface InvalidationEvent {
  /** Exactly one key. */
  key?: string;
  /** Or a family of them: 'repli:stock:' means every product's stock. */
  prefix?: string;
  /** Free text for the log: 'panel:product'. */
  source?: string;
}

const CONNECT_TIMEOUT_MS = 2000;

function redisUrl(): string {
  return (process.env.REDIS_URL ?? '').trim();
}

/** RESP array: *N\r\n$len\r\narg\r\n... */
function encode(args: string[]): Buffer {
  return Buffer.concat([
    Buffer.from(`*${args.length}\r\n`),
    ...args.map((arg) =>
      Buffer.concat([
        Buffer.from(`$${Buffer.byteLength(arg)}\r\n`),
        Buffer.from(arg),
        Buffer.from('\r\n'),
      ])
    ),
  ]);
}

/**
 * One short-lived connection, one batch of commands, then close.
 *
 * A pooled connection would be wrong here: this runs in a serverless
 * function that may be frozen between requests, and the whole exchange is a
 * handful of bytes.
 *
 * Replies are not parsed. Nothing here has an answer worth reading, and a
 * publish that Redis rejected is covered by the same fallback as a publish
 * that never connected.
 */
function sendToRedis(commands: string[][]): Promise<boolean> {
  const url = redisUrl();
  if (!url) return Promise.resolve(false);

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return Promise.resolve(false);
  }

  const host = parsed.hostname;
  const port = Number(parsed.port) || 6379;
  const secure = parsed.protocol === 'rediss:';
  const password = parsed.password ? decodeURIComponent(parsed.password) : '';
  const username = parsed.username ? decodeURIComponent(parsed.username) : '';
  const db = parsed.pathname.length > 1 ? parsed.pathname.slice(1) : '';

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };

    const socket = secure
      ? tls.connect({
          host,
          port,
          servername: host,
          rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
        })
      : net.createConnection({ host, port });

    socket.setNoDelay(true);
    socket.once('error', () => finish(false));
    socket.setTimeout(CONNECT_TIMEOUT_MS, () => finish(false));

    socket.once(secure ? 'secureConnect' : 'connect', () => {
      const batch: string[][] = [];
      if (password) batch.push(username ? ['AUTH', username, password] : ['AUTH', password]);
      if (db && /^\d+$/.test(db)) batch.push(['SELECT', db]);
      batch.push(...commands);

      socket.write(Buffer.concat(batch.map(encode)));

      /**
       * Redis processes commands in order, so once the last reply byte has
       * come back everything before it has been applied. Waiting for any
       * data at all is enough, and a short grace period covers the rest.
       */
      socket.once('data', () => setTimeout(() => finish(true), 25));
    });
  });
}

/** The rows the bot's poller reads when Redis is not in the picture. */
async function appendToTable(events: InvalidationEvent[]): Promise<void> {
  const rows = events
    .map((event) => ({
      cache_key: event.key ?? event.prefix ?? '',
      is_prefix: Boolean(event.prefix),
      source: event.source ?? null,
    }))
    .filter((row) => row.cache_key);

  if (!rows.length) return;
  await supabaseAdmin().from('cache_invalidations').insert(rows);
}

/**
 * Tell the bot these keys are stale. Call AFTER the database write succeeded.
 *
 * Never throws and never rejects: the write is already done, and cache
 * invalidation must never be the reason a valid admin update reports failure.
 */
export async function invalidate(...events: InvalidationEvent[]): Promise<void> {
  const wanted = events.filter((event) => event && (event.key || event.prefix));
  if (!wanted.length) return;

  try {
    const commands: string[][] = [];

    for (const event of wanted) {
      // DEL as well as PUBLISH, and both matter. PUBLISH drops the bot's own
      // in-process copy at once; DEL means a bot that was restarting and
      // missed the message still reads a fresh value rather than the stale
      // one sitting in Redis.
      if (event.key) commands.push(['DEL', event.key]);
      commands.push(['PUBLISH', CHANNEL, JSON.stringify(event)]);
    }

    // A prefix cannot be DELeted directly; the bot expands it on receipt.
    const published = await sendToRedis(commands);
    if (published) return;

    await appendToTable(wanted);
  } catch (error) {
    // Last resort. The keys still expire on their own timers, so the worst
    // case is the staleness the shop lived with before any of this existed.
    console.error('[cache] invalidation failed', error);
  }
}

// ---------------------------------------------------------------- mapping
/**
 * What each kind of edit makes stale.
 *
 * Verified against the bot rather than guessed: `repli:catalogue` holds the
 * `products` rows only and `repli:stock:{id}` holds that product's variants,
 * so a stock change touches one key and a price change touches the other.
 * Categories are stored as their own rows and their "is anything in stock"
 * question is computed at read time, so a stock change does not stale them.
 */
export const invalidateProduct = (source = 'panel:product') =>
  invalidate({ key: CACHE_KEYS.catalogue, source });

export const invalidateStock = (productId: string, source = 'panel:stock') =>
  invalidate({ key: CACHE_KEYS.stock(productId), source });

export const invalidateSettings = (keys: string[], source = 'panel:settings') =>
  invalidate(...keys.map((key) => ({ key: CACHE_KEYS.settings(key), source })));

export const invalidateTemplates = (language: string, source = 'panel:template') =>
  invalidate({ key: CACHE_KEYS.templates(language), source });

export const invalidateBypass = (source = 'panel:bypass') =>
  invalidate({ key: CACHE_KEYS.bypass, source });

export const invalidateCategories = (source = 'panel:category') =>
  invalidate({ key: CACHE_KEYS.categories, source });
