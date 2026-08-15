'use strict';

/**
 * Central configuration: .env (no dotenv dependency), paths and CLI flags.
 * Secrets live only in .env, which is git-ignored.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(ROOT, '.env'));

const argv = process.argv.slice(2);
function flag(name) {
  const prefix = `--${name}=`;
  const hit = argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
}

const DEFAULT_COUNTRY_CODE = String(process.env.COUNTRY_CODE || '91').replace(/\D/g, '') || '91';

/**
 * Normalise any phone format to one comparable key, so a customer is never
 * duplicated and a bypass number is never missed:
 *   "+91 98765 43210" / "09876543210" / "9876543210" / "919876543210@c.us"
 *   -> "919876543210"
 */
function normalisePhone(value) {
  let digits = String(value == null ? '' : value).replace(/\D/g, '');
  if (!digits) return '';
  digits = digits.replace(/^0+/, '');
  if (digits.length === 10) digits = `${DEFAULT_COUNTRY_CODE}${digits}`;
  return digits;
}

const ADMIN_NUMBERS = String(process.env.ADMIN_NUMBERS || process.env.ADMIN_PHONE || '')
  .split(',')
  .map(normalisePhone)
  .filter(Boolean);

module.exports = {
  ROOT,
  DATA_DIR: path.join(ROOT, 'data'),
  LOGS_DIR: process.env.REPLI_LOGS_DIR || path.join(ROOT, 'logs'),
  PROOFS_DIR: process.env.REPLI_PROOFS_DIR || path.join(ROOT, 'data', 'proofs'),
  SESSION_DIR: path.join(ROOT, '.wa-session'),

  // ---- Supabase ----
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  // "secret" is the new name for the service-role key; both are accepted
  SUPABASE_SECRET_KEY:
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY || '',
  SUPABASE_DB_URL: process.env.SUPABASE_DB_URL || '',

  // ---- business ----
  BUSINESS_NAME: process.env.BUSINESS_NAME || 'Repli',
  PAYMENT_LINK: process.env.PAYMENT_LINK || '',
  SHIPPING_CHARGE: Math.max(0, num(process.env.SHIPPING_CHARGE, 0)),
  CURRENCY: process.env.CURRENCY || '₹',
  BOT_ENABLED_DEFAULT: bool(process.env.BOT_ENABLED, true),

  ADMIN_NUMBERS,
  DEFAULT_COUNTRY_CODE,

  // ---- runtime ----
  DRIVER: flag('driver') || process.env.WA_DRIVER || 'openwa',
  TEST_MODE: bool(flag('test-mode') || process.env.TEST_MODE, false),
  SESSION_ID: process.env.SESSION_ID || 'repli',

  // Which Chromium open-wa should drive. Empty = detect the system browser,
  // and fall back to puppeteer's bundled one. On a server, set it explicitly.
  CHROME_PATH: process.env.CHROME_PATH || '',

  /**
   * Headless hides the browser window. Right on a server, wrong for the first
   * scan: WhatsApp Web frequently refuses to draw the QR code in a headless
   * browser, and open-wa just times out waiting for it. Set WA_HEADLESS=false
   * on a desktop, link the phone, then switch it back if you want.
   */
  WA_HEADLESS: bool(process.env.WA_HEADLESS, true),

  ORDER_PREFIX: process.env.ORDER_PREFIX || 'REP',
  MAX_QTY: Math.max(1, num(process.env.MAX_QTY, 10)),
  CATALOGUE_TTL_MS: Math.max(0, num(process.env.CATALOGUE_TTL_MS, 15000)),

  normalisePhone,
};
