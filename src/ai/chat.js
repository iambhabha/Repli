'use strict';

/**
 * One turn of a tool-calling conversation.
 *
 * ai/client.js sends a system prompt and a user prompt and gets a string back.
 * That shape cannot carry an agent: an agent needs the whole running
 * transcript, the tool results it has already collected, and a reply that may
 * be "call this function" instead of text. So this is a second entry point to
 * the same API rather than a rewrite of the first.
 *
 * What it shares with client.js, deliberately:
 *   - the budget fuse, checked before the request, not after
 *   - the ai_usage ledger, so agent calls and any other call are counted in
 *     the same month-to-date figure
 *   - returning null rather than throwing
 *
 * What it does differently:
 *   - `messages` is passed through whole; this file never builds a prompt
 *   - `tools` and the resulting `tool_calls` are first-class
 *   - its own timeout, because one turn here is several hundred milliseconds
 *     of model plus however long the tools take, and the 6s that suits a
 *     single rewrite would abort a healthy agent mid-thought
 */

const config = require('../config');
const logger = require('../logger');
const cost = require('./cost');
const aiUsageService = require('../services/aiUsageService');

function isConfigured() {
  return Boolean(config.AI_ENABLED && config.OPENAI_API_KEY);
}

/**
 * @param {object}   options
 * @param {Array}    options.messages    full OpenAI messages array, sent as-is
 * @param {Array}    [options.tools]     tool schemas in OpenAI function format
 * @param {string}   [options.toolChoice]'auto' (default) | 'none' | 'required'
 * @param {string}   options.purpose     ledger label, e.g. 'agent'
 * @param {string}   [options.phone]     customer this call belongs to
 * @param {number}   [options.maxTokens]
 * @param {number}   [options.temperature]
 * @param {number}   [options.timeoutMs]
 * @returns {Promise<{message: object, finishReason: string}|null>}
 *          the assistant message - which may hold `content`, `tool_calls`, or
 *          both - or null if the call could not be made or did not come back.
 */
async function chat({
  messages,
  tools = null,
  toolChoice = 'auto',
  purpose = 'agent',
  phone = null,
  maxTokens = 700,
  temperature = 0.4,
  timeoutMs = config.AI_TIMEOUT_MS,
}) {
  if (!isConfigured()) return null;
  if (!Array.isArray(messages) || messages.length === 0) return null;

  // Budget gate first: an exhausted budget must not cost a network round trip.
  if (!(await aiUsageService.withinBudget())) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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
        messages,
        ...(tools && tools.length ? { tools, tool_choice: toolChoice } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      logger.warn('ai.http_error', {
        action: `${purpose} ${response.status}`,
        error: body.slice(0, 300),
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
    const choice = payload.choices && payload.choices[0];
    const usage = payload.usage || {};
    const latencyMs = Date.now() - started;

    /**
     * Not awaited - the customer is waiting on this reply and the insert is
     * another round trip. record() updates the in-memory spend counter
     * synchronously, so the fuse stays accurate even if the write lands late.
     */
    void aiUsageService.record({
      purpose,
      phone,
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      costUsd: cost.forUsage(config.OPENAI_MODEL, usage.prompt_tokens, usage.completion_tokens),
      ok: true,
      latencyMs,
    });

    logger.info('ai.call', {
      action: purpose,
      ms: latencyMs,
      tokens: `${usage.prompt_tokens || 0}/${usage.completion_tokens || 0}`,
    });

    if (!choice || !choice.message) return null;
    return { message: choice.message, finishReason: choice.finish_reason || 'stop' };
  } catch (err) {
    const aborted = err && err.name === 'AbortError';
    logger[aborted ? 'warn' : 'error']('ai.call_failed', {
      action: purpose,
      ms: Date.now() - started,
      error: aborted ? `timeout_${timeoutMs}ms` : String(err && err.message),
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

module.exports = { chat, isConfigured };
