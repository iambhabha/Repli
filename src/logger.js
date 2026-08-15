'use strict';

/**
 * Tiny JSON-lines logger: logs/repli-YYYY-MM-DD.log + readable console output.
 * Payment/card-like digit sequences are redacted before anything is written.
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

const CARD_LIKE = /\b(?:\d[ -]?){13,19}\b/g;
const CVV_LIKE = /\b(cvv|cvc|pin\s*code\s*of\s*card)\s*[:=]?\s*\d{3,4}\b/gi;

/** Never let card numbers / CVVs reach the log files. */
function redact(text) {
  if (typeof text !== 'string') return text;
  let out = text.replace(CVV_LIKE, '$1: [REDACTED]').replace(CARD_LIKE, '[REDACTED]');
  if (out.length > 400) out = out.slice(0, 400) + '…';
  return out;
}

function logFile() {
  const day = new Date().toISOString().slice(0, 10);
  return path.join(config.LOGS_DIR, `repli-${day}.log`);
}

function write(level, event, fields) {
  const record = { time: new Date().toISOString(), level, event, ...fields };
  if (typeof record.message === 'string') record.message = redact(record.message);
  if (typeof record.reply === 'string') record.reply = redact(record.reply);

  try {
    fs.mkdirSync(config.LOGS_DIR, { recursive: true });
    fs.appendFileSync(logFile(), JSON.stringify(record) + '\n');
  } catch (err) {
    console.error('[logger] could not write log file:', err.message);
  }

  const parts = [`[${record.time.slice(11, 19)}]`, level.toUpperCase(), event];
  for (const key of ['phone', 'state', 'action', 'orderId']) {
    if (record[key]) parts.push(`${key}=${record[key]}`);
  }
  if (record.message) parts.push(`msg="${String(record.message).replace(/\n/g, ' ⏎ ')}"`);
  if (record.error) parts.push(`error="${record.error}"`);
  console.log(parts.join(' '));
}

module.exports = {
  redact,
  info: (event, fields = {}) => write('info', event, fields),
  warn: (event, fields = {}) => write('warn', event, fields),
  error: (event, fields = {}) => write('error', event, fields),
  /** One line per handled customer message - the audit trail required by the spec. */
  turn: (fields) => write('info', 'turn', fields),
};
