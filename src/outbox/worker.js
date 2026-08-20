'use strict';

/**
 * Outbox worker - the bridge between the admin panel and WhatsApp.
 *
 * The Next.js panel can run anywhere (Vercel, a laptop, a phone browser) and
 * has no WhatsApp session; this process does. So the panel writes a row to
 * `outbound_messages` and this worker sends it, exactly like any other reply:
 * through the same adapter, recorded in `messages` the same way.
 *
 * Design notes:
 *   - nothing is sent while the WhatsApp session is disconnected; rows just
 *     wait, so a message is never silently lost;
 *   - each row is claimed with a conditional update, so two bot processes
 *     cannot send the same message twice;
 *   - a row that keeps failing is parked as FAILED after MAX_ATTEMPTS instead
 *     of retrying for ever.
 */

const { supabase } = require('../db/supabase');
const logger = require('../logger');

const POLL_MS = 3000;
const BATCH = 5;
const MAX_ATTEMPTS = 5;

async function claimNext() {
  const { data, error } = await supabase
    .from('outbound_messages')
    .select('*')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: true })
    .limit(BATCH);

  if (error) {
    logger.error('outbox.fetch_failed', { error: error.message });
    return [];
  }
  return data || [];
}

async function markSent(row) {
  await supabase
    .from('outbound_messages')
    .update({ status: 'SENT', sent_at: new Date().toISOString(), attempts: row.attempts + 1 })
    .eq('id', row.id);
}

async function markFailure(row, message) {
  const attempts = row.attempts + 1;
  await supabase
    .from('outbound_messages')
    .update({
      status: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
      attempts,
      error: String(message).slice(0, 500),
    })
    .eq('id', row.id);
}

/**
 * Claim a row by flipping PENDING -> SENT before sending. `.eq('status',
 * 'PENDING')` makes the update the lock: whoever's UPDATE returns a row owns
 * the message. On a send failure it is put back.
 */
async function claim(row) {
  const { data, error } = await supabase
    .from('outbound_messages')
    .update({ status: 'SENT', sent_at: new Date().toISOString(), attempts: row.attempts + 1 })
    .eq('id', row.id)
    .eq('status', 'PENDING')
    .select('id');

  if (error) {
    logger.error('outbox.claim_failed', { error: error.message });
    return false;
  }
  return Array.isArray(data) && data.length === 1;
}

async function drain(bot) {
  if (!bot.isConnected()) return 0;

  const rows = await claimNext();
  let sent = 0;

  for (const row of rows) {
    if (!(await claim(row))) continue;

    try {
      // raw: a person typed this in the panel. Rewriting someone's own words
      // on their behalf is not help, it is putting words in their mouth.
      await bot.sendMessage(row.phone, row.text, { raw: true });
      sent += 1;
      logger.info('outbox.sent', {
        phone: row.phone,
        action: row.requested_by || 'panel',
        reply: row.text,
      });
    } catch (err) {
      await markFailure({ ...row, attempts: row.attempts }, err.message || 'send failed');
      logger.error('outbox.send_failed', { phone: row.phone, error: err.message });
    }
  }

  return sent;
}

/**
 * Starts polling. Returns a stop function.
 * Polling (not Realtime) on purpose: the bot already reconnects to WhatsApp on
 * its own schedule, and a three second poll on a tiny indexed table is cheaper
 * to reason about than another websocket that can silently die.
 */
function startOutboxWorker(bot, { intervalMs = POLL_MS } = {}) {
  let stopped = false;
  let running = false;

  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try {
      await drain(bot);
    } catch (err) {
      logger.error('outbox.tick_failed', { error: err.message });
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, intervalMs);
  if (timer.unref) timer.unref();

  logger.info('outbox.started', { action: `${intervalMs}ms` });

  return function stopOutboxWorker() {
    stopped = true;
    clearInterval(timer);
  };
}

module.exports = { startOutboxWorker, drain };
