'use strict';

/**
 * "That key is stale" - the one message the panel needs to send the bot.
 *
 * The owner changes a price in the admin panel. The panel writes it to
 * Supabase and is done; the bot, on another machine, is still holding the
 * old number in its cache and will keep quoting it until the timer lapses.
 * This is the wire that closes that gap.
 *
 * Two transports, both optional, neither able to break anything:
 *
 *   Redis pub/sub   when REDIS_URL is set. Near-instant, on a connection of
 *                   its own because a subscribed socket cannot answer GET.
 *   cache_invalidations  a table the panel appends to, polled here on the
 *                   same rhythm as the outbox. Slower, works everywhere,
 *                   and covers a pub/sub message that was never delivered.
 *
 * Both run at once when both are available. Applying the same invalidation
 * twice is free - deleting a key that is already gone is a no-op - so there
 * is no need to decide which one "won".
 *
 * If Redis is down, or the table has not been migrated, or Supabase hiccups,
 * the bot keeps working exactly as it did before: every cached value still
 * expires on its own timer, which is what has been keeping it correct all
 * along.
 */

const { supabase } = require('./supabase');
const cache = require('./cache');
const logger = require('../logger');

/** The one channel. Must match admin-panel/lib/cache.ts. */
const CHANNEL = 'repli:invalidate';

const POLL_MS = 3000;
const CLEANUP_EVERY = 100; // ticks, i.e. every ~5 minutes
const KEEP_MS = 60 * 60 * 1000;

/**
 * On startup the bot replays the last minute of invalidations.
 *
 * Its own memory is empty after a restart, but Redis is not: a key the panel
 * dropped while this process was down could still be sitting there with an
 * old value if the DEL was the part that failed. A minute of replay is cheap
 * and closes that window.
 */
const REPLAY_MS = 60000;

/** Only keys the bot actually caches. Anything else is ignored, not guessed at. */
const KNOWN_PREFIX = 'repli:';

/**
 * Apply one invalidation.
 *
 * cache.del() and cache.delPrefix() clear the process-local memory copy
 * FIRST and synchronously, then Redis. Both halves matter: dropping the
 * Redis entry while this process keeps its own copy would leave the bot
 * quoting the old price for another five seconds, and clearing only memory
 * would leave every other process stale.
 */
async function apply(event) {
  if (!event || typeof event !== 'object') return false;

  const key = typeof event.key === 'string' ? event.key : null;
  const prefix = typeof event.prefix === 'string' ? event.prefix : null;
  const target = key || prefix;

  if (!target || !target.startsWith(KNOWN_PREFIX)) {
    logger.warn('invalidate.ignored', { action: String(target).slice(0, 60) });
    return false;
  }

  if (prefix) await cache.delPrefix(prefix);
  else await cache.del(key);

  logger.info('invalidate.applied', {
    action: prefix ? `${prefix}*` : key,
    message: event.source || '',
  });
  return true;
}

function parseEvent(payload) {
  try {
    const parsed = JSON.parse(payload);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (err) {
    logger.warn('invalidate.bad_payload', { error: String(payload).slice(0, 80) });
    return null;
  }
}

/**
 * The table poller.
 *
 * Reads forward by id, so a row is never processed twice by one process, and
 * a row processed twice across a restart is harmless anyway.
 */
function startPoller(intervalMs = POLL_MS) {
  let watermark = null;
  let ticks = 0;
  let failures = 0;
  let disabled = false;
  let running = false;

  async function startingPoint() {
    // Everything older than the replay window is assumed already reflected;
    // everything newer is applied once, in id order.
    const since = new Date(Date.now() - REPLAY_MS).toISOString();
    const { data, error } = await supabase
      .from('cache_invalidations')
      .select('id')
      .lt('created_at', since)
      .order('id', { ascending: false })
      .limit(1);

    if (error) throw new Error(error.message);
    return data && data.length ? Number(data[0].id) : 0;
  }

  async function tick() {
    if (disabled || running) return;
    running = true;

    try {
      if (watermark === null) watermark = await startingPoint();

      const { data, error } = await supabase
        .from('cache_invalidations')
        .select('id,cache_key,is_prefix,source')
        .gt('id', watermark)
        .order('id', { ascending: true })
        .limit(200);

      if (error) throw new Error(error.message);

      for (const row of data || []) {
        await apply(
          row.is_prefix
            ? { prefix: row.cache_key, source: row.source }
            : { key: row.cache_key, source: row.source }
        );
        watermark = Number(row.id);
      }

      failures = 0;
      ticks += 1;

      if (ticks % CLEANUP_EVERY === 0) {
        const cutoff = new Date(Date.now() - KEEP_MS).toISOString();
        await supabase.from('cache_invalidations').delete().lt('created_at', cutoff);
      }
    } catch (err) {
      failures += 1;
      /**
       * Three failures in a row means something structural - almost always
       * that migration 014 has not been run. Say so once and stop, rather
       * than a line every three seconds for the rest of the day. Redis
       * pub/sub, if configured, is unaffected; so is every TTL.
       */
      if (failures >= 3) {
        disabled = true;
        logger.warn('invalidate.poll_disabled', {
          error: String(err && err.message).slice(0, 160),
          action: 'run migration 014_cache_invalidations.sql, then restart',
        });
      }
    } finally {
      running = false;
    }
  }

  const timer = setInterval(() => {
    void tick();
  }, intervalMs);
  if (timer.unref) timer.unref();

  return {
    stop: () => clearInterval(timer),
    tick,
    status: () => ({ watermark, disabled, failures }),
  };
}

/**
 * Start listening. Call once, from src/index.js.
 *
 * @returns {{stop: () => void, status: () => object}}
 */
function startInvalidationListener({ intervalMs = POLL_MS } = {}) {
  const subscriber = cache.enabled()
    ? cache.subscribe(CHANNEL, (payload) => {
        const event = parseEvent(payload);
        if (event) void apply(event);
      })
    : null;

  const poller = startPoller(intervalMs);

  logger.info('invalidate.listening', {
    action: `${subscriber ? 'redis pub/sub + ' : ''}supabase poll ${intervalMs}ms`,
  });

  return {
    stop() {
      if (subscriber) subscriber.stop();
      poller.stop();
    },
    status: () => ({
      redis: subscriber ? subscriber.status() : { enabled: false, connected: false },
      poll: poller.status(),
    }),
    // Exposed for the tests, which drive one tick rather than waiting.
    poller,
  };
}

/**
 * Publish an invalidation from the bot side.
 *
 * Rarely needed: a single bot process invalidating its own cache is already
 * correct, because cache.del() clears memory and Redis together. This exists
 * for the day a second process is running.
 */
async function publish(event) {
  try {
    return await cache.publish(CHANNEL, JSON.stringify(event));
  } catch (err) {
    logger.warn('invalidate.publish_failed', { error: String(err && err.message) });
    return false;
  }
}

module.exports = { startInvalidationListener, apply, publish, CHANNEL };
