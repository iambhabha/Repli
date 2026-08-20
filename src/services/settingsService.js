'use strict';

/**
 * Admin numbers and the global bot switch.
 *
 * Admin numbers: seeded from .env ADMIN_NUMBERS on startup, then read from
 * the admin_numbers table (so they can be managed in Supabase).
 * Bot switch: app_settings.bot_enabled, so /bot off survives a restart.
 */

const { supabase, unwrap } = require('../db/supabase');
const cache = require('../db/cache');
const config = require('../config');
const logger = require('../logger');

/**
 * Everything here goes through the shared cache, so a second process - and,
 * from Phase 2, the admin panel - can drop the same key rather than each
 * copy waiting out its own timer. The timers themselves are unchanged.
 */
const BOT_ENABLED_KEY = 'bot_enabled';

/** Memory is cleared synchronously inside cache.del(), before any await. */
async function invalidate() {
  await Promise.all([
    cache.del(cache.KEYS.admins),
    cache.del(cache.KEYS.allowed),
    cache.del(cache.KEYS.settings(BOT_ENABLED_KEY)),
  ]);
}

async function adminNumbers() {
  return cache.remember(cache.KEYS.admins, config.ADMIN_TTL_MS, async () => {
    const rows = unwrap(
      await supabase.from('admin_numbers').select('phone').eq('active', true),
      'admins.load'
    );
    return (rows || []).map((r) => config.normalisePhone(r.phone)).filter(Boolean);
  });
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

/**
 * One setting, by key. For the strings the bot quotes to customers - the
 * greeting's brand names, the pickup city - which the owner edits in the
 * panel and which have no business being constants in code.
 */
/**
 * The stored string for a settings key, or null. Cached under
 * `repli:settings:{key}` so every reader of that key shares one entry.
 */
async function rawSetting(key, ttlMs = config.SETTINGS_TTL_MS) {
  return cache.remember(cache.KEYS.settings(key), ttlMs, async () => {
    const rows = unwrap(
      await supabase.from('app_settings').select('value').eq('key', key).limit(1),
      'settings.value'
    );
    return rows && rows[0] ? rows[0].value : null;
  });
}

async function value(key, fallback = null) {
  /**
   * Cached, because these are read constantly and change rarely.
   *
   * The greeting alone pulled app_settings four separate times - the brand
   * name, the bot switch, the AI instructions, the shop name - each a round
   * trip. Thirty seconds of staleness on a setting the owner edits by hand
   * is invisible; four extra round trips per message is not.
   */
  const found = await rawSetting(key);
  return found === null || found === '' ? fallback : found;
}

/**
 * Test mode: reply to these numbers and nobody else.
 *
 * `app_settings.allowed_numbers`, comma separated. Empty means the shop is
 * open to everyone, which is the normal state. While a new flow is being
 * tried on a live number this is the difference between testing and
 * experimenting on real customers.
 *
 * Cached like the admin list - it is checked on every single message.
 */
async function allowedNumbers() {
  return cache.remember(cache.KEYS.allowed, config.ADMIN_TTL_MS, async () => {
    const raw = await value('allowed_numbers', '').catch(() => '');
    return String(raw || '')
      .split(/[,\s]+/)
      .map((entry) => config.normalisePhone(entry))
      .filter(Boolean);
  });
}

/** True when this number may be answered. Everyone passes if the list is empty. */
async function isAllowed(phone) {
  // The test harness drives dozens of made-up numbers through the real
  // router; an allowlist meant for a live number must not silence those.
  if (config.TEST_MODE) return true;

  const key = config.normalisePhone(phone);
  if (!key) return false;
  try {
    const list = await allowedNumbers();
    return list.length === 0 || list.includes(key);
  } catch (err) {
    logger.error('allowlist.check_failed', { phone: key, error: err.message });
    // Fail open: a database hiccup must not silence the shop.
    return true;
  }
}

/**
 * Kept on its own ten-second timer rather than the settings default: this is
 * the switch that stops the shop replying, and it is the one setting where
 * waiting out thirty seconds is felt.
 */
async function isBotEnabled() {
  const raw = await rawSetting(BOT_ENABLED_KEY, config.ADMIN_TTL_MS);
  return raw === null ? config.BOT_ENABLED_DEFAULT : raw === 'true';
}

async function setBotEnabled(enabled) {
  const stored = enabled ? 'true' : 'false';
  unwrap(
    await supabase
      .from('app_settings')
      .upsert({ key: BOT_ENABLED_KEY, value: stored }, { onConflict: 'key' }),
    'settings.setBotEnabled'
  );
  // Write through rather than invalidate: /bot off must take effect on the
  // very next message, not after a reload.
  await cache.set(cache.KEYS.settings(BOT_ENABLED_KEY), stored, config.ADMIN_TTL_MS);
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
  await invalidate();
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
  /**
   * Once immediately, then on the timer.
   *
   * setInterval alone leaves a fifteen-second window after every restart in
   * which config still holds whatever .env said - and .env says
   * `https://your-payment-link-here`, because the real UPI id lives in
   * app_settings where the panel can edit it. An order placed inside that
   * window told the customer to pay at a placeholder URL.
   *
   * Rare, and entirely silent when it happened: the wrong link is a
   * perfectly well-formed message, and the only sign would have been a
   * customer asking where to pay.
   */
  const sync = () =>
    syncRuntimeConfig().catch((err) =>
      logger.error('settings.sync_failed', { error: err.message })
    );

  void sync();

  const timer = setInterval(sync, intervalMs);
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
  value,
  allowedNumbers,
  isAllowed,
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
