'use strict';

/**
 * AI spend: the meter and the fuse.
 *
 * The owner set a hard limit of ₹1,000 a month, so this file exists to make
 * that number real rather than aspirational. Two jobs:
 *
 *   record()       write every call to `ai_usage`
 *   withinBudget() answer "may we spend more?" before any call goes out
 *
 * withinBudget() is asked before every single request, so it must be cheap:
 * the month-to-date total is cached and the cache is nudged forward locally
 * after each call instead of re-querying. It is refreshed from the database
 * every minute, which also picks up spend from a second process.
 *
 * Failure policy: if the spend query itself fails we allow the call. A
 * database hiccup should not silently turn the shop robotic; a real overrun
 * is caught on the next successful refresh, one minute later at worst.
 */

const { supabase, unwrap } = require('../db/supabase');
const config = require('../config');
const logger = require('../logger');
const cost = require('../ai/cost');

const REFRESH_MS = 60000;

let spentUsd = 0;
let refreshedAt = 0;
let month = null;
let warned = false;

/** First instant of the current calendar month, UTC. */
function monthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

async function refresh(force = false) {
  const start = monthStart();

  // A new month resets both the cache and the "budget exhausted" warning.
  if (month !== start) {
    month = start;
    spentUsd = 0;
    refreshedAt = 0;
    warned = false;
  }

  if (!force && Date.now() - refreshedAt < REFRESH_MS) return spentUsd;

  try {
    const rows = unwrap(
      await supabase.from('ai_usage').select('cost_usd').gte('created_at', start),
      'ai_usage.month'
    );
    spentUsd = (rows || []).reduce((total, row) => total + Number(row.cost_usd || 0), 0);
    refreshedAt = Date.now();
  } catch (err) {
    logger.warn('ai_usage.refresh_failed', { error: err.message });
    refreshedAt = Date.now(); // do not hammer a failing database
  }

  return spentUsd;
}

/** Month-to-date spend, in both currencies, for the panel and for logs. */
async function summary() {
  await refresh();
  return {
    month,
    spentUsd,
    spentInr: cost.toInr(spentUsd),
    budgetInr: config.AI_MONTHLY_BUDGET_INR,
    remainingInr: Math.max(0, config.AI_MONTHLY_BUDGET_INR - cost.toInr(spentUsd)),
  };
}

/**
 * The fuse. A budget of 0 means "no limit" - set AI_ENABLED=false to turn the
 * AI off instead, so that "unlimited" is never chosen by accident.
 */
async function withinBudget() {
  if (!config.AI_MONTHLY_BUDGET_INR) return true;

  await refresh();
  const spentInr = cost.toInr(spentUsd);
  if (spentInr < config.AI_MONTHLY_BUDGET_INR) return true;

  // Log once per month, not once per message.
  if (!warned) {
    warned = true;
    logger.warn('ai.budget_exhausted', {
      action: `₹${spentInr.toFixed(2)} of ₹${config.AI_MONTHLY_BUDGET_INR}`,
    });
  }
  return false;
}

/**
 * Write one call to the ledger. Never throws: accounting must not be able to
 * break a reply that has already been generated.
 */
async function record({
  purpose,
  phone = null,
  inputTokens = 0,
  outputTokens = 0,
  costUsd = 0,
  ok = true,
  error = null,
  latencyMs = null,
  fallbackReason = null,
}) {
  spentUsd += Number(costUsd) || 0; // keep the fuse current between refreshes

  try {
    await supabase.from('ai_usage').insert({
      purpose,
      model: config.OPENAI_MODEL,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: Number(costUsd) || 0,
      phone: phone || null,
      ok,
      error: error ? String(error).slice(0, 300) : null,
      latency_ms: Number.isFinite(Number(latencyMs)) ? Math.round(Number(latencyMs)) : null,
      // Null means the answer was used. Anything else is money spent on an
      // answer the customer never saw.
      fallback_reason: fallbackReason ? String(fallbackReason).slice(0, 120) : null,
    });
  } catch (err) {
    logger.warn('ai_usage.record_failed', { error: err.message });
  }
}

module.exports = { record, withinBudget, summary, refresh };
