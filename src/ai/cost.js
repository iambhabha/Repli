'use strict';

/**
 * What a call costs.
 *
 * Prices are per 1,000,000 tokens in USD, copied from OpenAI's pricing page.
 * They move over time, so they live in one small table with an env override
 * rather than being sprinkled through the code. If a model is unknown we bill
 * it at the most expensive rate we know: a wrong guess should make the budget
 * cap fire early, never late.
 */

const config = require('../config');

const PRICES = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4.1-nano': { input: 0.1, output: 0.4 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4.1': { input: 2, output: 8 },
};

const FALLBACK = { input: 5, output: 20 };

/** Longest matching prefix wins, so "gpt-4o-mini-2024-07-18" resolves. */
function priceFor(model) {
  const name = String(model || '');
  const override = String(process.env.OPENAI_PRICE_PER_MTOK || '').trim();
  if (override) {
    const [input, output] = override.split('/').map(Number);
    if (Number.isFinite(input) && Number.isFinite(output)) return { input, output };
  }

  let best = null;
  for (const [key, price] of Object.entries(PRICES)) {
    if (name.startsWith(key) && (!best || key.length > best.key.length)) best = { key, price };
  }
  return best ? best.price : FALLBACK;
}

function forUsage(model, inputTokens, outputTokens) {
  const price = priceFor(model);
  const input = (Number(inputTokens) || 0) / 1e6;
  const output = (Number(outputTokens) || 0) / 1e6;
  return input * price.input + output * price.output;
}

const toInr = (usd) => (Number(usd) || 0) * config.AI_USD_TO_INR;

module.exports = { priceFor, forUsage, toInr, PRICES };
