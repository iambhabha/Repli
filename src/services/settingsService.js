'use strict';

/**
 * Admin numbers and the global bot switch.
 *
 * Admin numbers: seeded from .env ADMIN_NUMBERS on startup, then read from
 * the admin_numbers table (so they can be managed in Supabase).
 * Bot switch: app_settings.bot_enabled, so /bot off survives a restart.
 */

const { supabase, unwrap } = require('../db/supabase');
const config = require('../config');
const logger = require('../logger');

const TTL_MS = 10000;

let adminCache = null;
let adminCacheAt = 0;
let botEnabledCache = null;
let botCacheAt = 0;

function invalidate() {
  adminCache = null;
  adminCacheAt = 0;
  botEnabledCache = null;
  botCacheAt = 0;
}

async function adminNumbers() {
  if (adminCache && Date.now() - adminCacheAt < TTL_MS) return adminCache;
  const rows = unwrap(
    await supabase.from('admin_numbers').select('phone').eq('active', true),
    'admins.load'
  );
  adminCache = (rows || []).map((r) => config.normalisePhone(r.phone)).filter(Boolean);
  adminCacheAt = Date.now();
  return adminCache;
}

/** Fails closed: on any error nobody is treated as an admin. */
async function isAdmin(phone) {
  const key = config.normalisePhone(phone);
  if (!key) return false;
  try {
    return (await adminNumbers()).includes(key);
  } catch (err) {
    logger.error('admin.check_failed', { phone: key, error: err.message });
    return false;
  }
}

async function isBotEnabled() {
  if (botEnabledCache !== null && Date.now() - botCacheAt < TTL_MS) return botEnabledCache;
  const row = unwrap(
    await supabase.from('app_settings').select('value').eq('key', 'bot_enabled').maybeSingle(),
    'settings.botEnabled'
  );
  botEnabledCache = row ? row.value === 'true' : config.BOT_ENABLED_DEFAULT;
  botCacheAt = Date.now();
  return botEnabledCache;
}

async function setBotEnabled(enabled) {
  unwrap(
    await supabase
      .from('app_settings')
      .upsert({ key: 'bot_enabled', value: enabled ? 'true' : 'false' }, { onConflict: 'key' }),
    'settings.setBotEnabled'
  );
  botEnabledCache = enabled;
  botCacheAt = Date.now();
  logger.info('bot.switch', { action: enabled ? 'ON' : 'OFF' });
  return enabled;
}

/** Startup: make sure every number in .env exists as an active admin row. */
async function syncAdminsFromEnv() {
  if (!config.ADMIN_NUMBERS.length) return [];
  for (const phone of config.ADMIN_NUMBERS) {
    const existing = unwrap(
      await supabase.from('admin_numbers').select('*').eq('phone', phone).maybeSingle(),
      'admins.find'
    );
    if (!existing) {
      unwrap(
        await supabase.from('admin_numbers').insert({ phone, name: 'from .env' }),
        'admins.insert'
      );
    } else if (!existing.active) {
      unwrap(
        await supabase.from('admin_numbers').update({ active: true }).eq('id', existing.id),
        'admins.reactivate'
      );
    }
  }
  invalidate();
  return adminNumbers();
}

// ------------------------------------------------- settings owned by the UI
/**
 * Values the shop owner changes from the admin panel, not from a text editor.
 *
 * `.env` is only the seed: on first start each value is copied into
 * `app_settings` if it is not there yet, and from then on the table wins.
 * That is what makes the panel's Settings page real - the owner has a UI, not
 * a terminal.
 */
const RUNTIME_KEYS = {
  payment_link: 'PAYMENT_LINK',
  shipping_charge: 'SHIPPING_CHARGE',
  business_name: 'BUSINESS_NAME',
};

/**
 * Copy `app_settings` over the in-memory config, so every existing call site
 * (`config.PAYMENT_LINK`, `config.SHIPPING_CHARGE`, …) keeps working unchanged
 * and simply sees the current value.
 */
async function syncRuntimeConfig() {
  const rows = unwrap(
    await supabase.from('app_settings').select('key,value').in('key', Object.keys(RUNTIME_KEYS)),
    'settings.runtime'
  );

  for (const row of rows || []) {
    const target = RUNTIME_KEYS[row.key];
    // An empty value in the table means "not configured" - keep whatever
    // .env had rather than blanking a working payment link.
    if (!target || row.value === null || row.value === '') continue;

    if (target === 'SHIPPING_CHARGE') {
      const amount = Number(row.value);
      if (Number.isFinite(amount) && amount >= 0) config.SHIPPING_CHARGE = amount;
    } else {
      config[target] = row.value;
    }
  }

  return {
    PAYMENT_LINK: config.PAYMENT_LINK,
    SHIPPING_CHARGE: config.SHIPPING_CHARGE,
    BUSINESS_NAME: config.BUSINESS_NAME,
  };
}

/** Picks up panel edits without a restart. */
function startSettingsSync(intervalMs = 15000) {
  const timer = setInterval(() => {
    syncRuntimeConfig().catch((err) =>
      logger.error('settings.sync_failed', { error: err.message })
    );
  }, intervalMs);
  if (timer.unref) timer.unref();

  return function stopSettingsSync() {
    clearInterval(timer);
  };
}

/** Startup: make sure the bot switch and the UI-owned settings rows exist. */
async function ensureDefaults() {
  const rows = unwrap(
    await supabase
      .from('app_settings')
      .select('key,value')
      .in('key', ['bot_enabled', ...Object.keys(RUNTIME_KEYS)]),
    'settings.ensure'
  );

  const existing = new Map((rows || []).map((row) => [row.key, row.value]));

  if (!existing.has('bot_enabled')) await setBotEnabled(config.BOT_ENABLED_DEFAULT);

  // Seed from .env only where the panel has nothing yet.
  const seed = [];
  for (const [key, target] of Object.entries(RUNTIME_KEYS)) {
    const current = existing.get(key);
    if (current !== undefined && current !== null && current !== '') continue;
    const value = String(config[target] ?? '');
    if (!value) continue;
    seed.push({ key, value });
  }

  if (seed.length) {
    unwrap(
      await supabase.from('app_settings').upsert(seed, { onConflict: 'key' }),
      'settings.seed'
    );
    logger.info('settings.seeded', { action: seed.map((row) => row.key).join(', ') });
  }

  await syncRuntimeConfig();
}

module.exports = {
  adminNumbers,
  isAdmin,
  isBotEnabled,
  setBotEnabled,
  syncAdminsFromEnv,
  syncRuntimeConfig,
  startSettingsSync,
  ensureDefaults,
  invalidate,
};
