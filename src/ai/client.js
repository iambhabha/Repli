'use strict';

/**
 * The only file that talks to OpenAI.
 *
 * Deliberately built on global fetch (Node >= 18) instead of the `openai`
 * package: one less dependency to install on the server, and the whole
 * surface we need is a single POST.
 *
 * Every call here is best-effort. It returns null instead of throwing, because
 * every caller has a hand-written fallback and a customer waiting on WhatsApp
 * must never see a stack trace or a delay caused by a retry storm.
 */

const config = require('../config');
const logger = require('../logger');
const cost = require('./cost');
const aiUsageService = require('../services/aiUsageService');

/** Prices change; the table lives in cost.js. */
function isConfigured() {
  return Boolean(config.AI_ENABLED && config.OPENAI_API_KEY);
}

/**
 * One chat completion.
 *
 * @param {object}  options
 * @param {string}  options.system     system prompt
 * @param {string}  options.user       user prompt
 * @param {string}  options.purpose    'language' | 'intent' | 'understand' |
 *                                     'reply' | 'converse' | 'humanise'
 * @param {string}  [options.phone]    customer this call belongs to
 * @param {number}  [options.maxTokens]
 * @param {number}  [options.temperature]
 * @param {boolean} [options.json]     force a JSON object response
 * @param {(text: string) => (string|null)} [options.verify]
 *        The caller's own guard. Return null to accept the answer, or a short
 *        reason to reject it. A rejected answer is returned as null - exactly
 *        as if the model had failed - but it is recorded with that reason, so
 *        "the guards are rejecting a third of the rewrites" is a thing the
 *        ledger can say rather than something nobody notices.
 * @returns {Promise<string|null>} the model's text, or null on any failure
 */
/**
 * A picture the model is allowed to look at.
 *
 * Only ever a buffer the bot already holds - a payment screenshot the
 * customer sent, downloaded through the driver and written to the shop's own
 * disk. Never a URL: handing a model a link would make "read this image" mean
 * "fetch whatever is at this address", and the address would come from a
 * message. Base64 of bytes we already have cannot be pointed anywhere.
 *
 * @param {{buffer: Buffer, mimetype: string}|null} image
 * @returns {object|string} the user content, in whichever shape the API needs
 */
function userContent(user, image) {
  if (!image || !Buffer.isBuffer(image.buffer) || !image.buffer.length) return user;

  const type = String(image.mimetype || 'image/jpeg').toLowerCase();
  return [
    { type: 'text', text: user },
    {
      type: 'image_url',
      image_url: {
        url: `data:${type};base64,${image.buffer.toString('base64')}`,
        // Enough to read an amount off a payment screenshot, and a fraction
        // of the tokens of a full-resolution read.
        detail: 'low',
      },
    },
  ];
}

async function complete({
  system,
  user,
  purpose,
  phone = null,
  maxTokens = 300,
  temperature = 0.7,
  json = false,
  verify = null,
  image = null,
}) {
  if (!isConfigured()) return null;

  // Budget gate first: an exhausted budget must not cost a network round trip.
  if (!(await aiUsageService.withinBudget())) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.AI_TIMEOUT_MS);
  const started = Date.now();

  try {
    const response = await fetch(`${config.OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: config.OPENAI_MODEL,
        temperature,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent(user, image) },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      logger.warn('ai.http_error', {
        action: String(response.status),
        error: body.slice(0, 200),
      });
      void aiUsageService.record({
        purpose,
        phone,
        ok: false,
        error: `http_${response.status}`,
        latencyMs: Date.now() - started,
        fallbackReason: `http_${response.status}`,
      });
      return null;
    }

    const payload = await response.json();
    const raw = payload.choices && payload.choices[0] && payload.choices[0].message.content;
    const usage = payload.usage || {};
    const latencyMs = Date.now() - started;
    const text = typeof raw === 'string' ? raw.trim() : null;

    /**
     * The guard runs before the ledger, so the row records what actually
     * happened to the answer rather than only that it arrived.
     *
     * `ok` still means "the API call succeeded" - unchanged - because the
     * shop was billed for a rejected answer exactly as for a good one, and
     * the budget fuse must keep counting it.
     */
    let fallbackReason = null;
    if (!text) fallbackReason = 'empty';
    else if (verify) {
      try {
        fallbackReason = verify(text) || null;
      } catch (err) {
        fallbackReason = 'verify_threw';
      }
    }

    /**
     * Not awaited: the customer is waiting on this reply, and the ledger
     * write is another ~90ms round trip they should not pay for. The
     * in-memory spend counter is updated synchronously inside record(), so
     * the budget fuse stays accurate even if the insert lands late.
     */
    void aiUsageService.record({
      purpose,
      phone,
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      costUsd: cost.forUsage(config.OPENAI_MODEL, usage.prompt_tokens, usage.completion_tokens),
      ok: true,
      latencyMs,
      fallbackReason,
    });

    logger.info('ai.call', {
      action: purpose,
      ms: latencyMs,
      tokens: `${usage.prompt_tokens || 0}/${usage.completion_tokens || 0}`,
      error: fallbackReason || undefined,
    });

    return fallbackReason ? null : text;
  } catch (err) {
    // AbortError on timeout is the common case and is not worth an error log:
    // the caller is about to send the template version anyway.
    const aborted = err && err.name === 'AbortError';
    logger[aborted ? 'warn' : 'error']('ai.call_failed', {
      action: purpose,
      ms: Date.now() - started,
      error: aborted ? `timeout_${config.AI_TIMEOUT_MS}ms` : String(err && err.message),
    });
    void aiUsageService.record({
      purpose,
      phone,
      ok: false,
      error: aborted ? 'timeout' : String(err && err.message).slice(0, 120),
      latencyMs: Date.now() - started,
      fallbackReason: aborted ? 'timeout' : 'request_failed',
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { complete, isConfigured };
