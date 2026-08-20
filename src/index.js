'use strict';

/**
 * Repli v1 - WhatsApp sales & order automation bot.
 * Rule based, Supabase PostgreSQL, no AI, no n8n.
 *
 *   npm start        real WhatsApp (open-wa)
 *   npm run mock     terminal simulator
 */

const fs = require('fs');
const config = require('./config');
const logger = require('./logger');
const { ping } = require('./db/supabase');
const settingsService = require('./services/settingsService');
const bypassService = require('./services/bypassService');
const productService = require('./services/productService');
const { createAdapter } = require('./whatsapp/adapter');
const { createRouter } = require('./bot/router');
const templates = require('./bot/templates');
const { startOutboxWorker } = require('./outbox/worker');
const { startInvalidationListener } = require('./db/invalidate');
const storage = require('./db/storage');

async function preflight() {
  for (const dir of [config.DATA_DIR, config.LOGS_DIR, config.PROOFS_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await ping();
  await settingsService.ensureDefaults();
  await templates.ensureTemplates();
  const admins = await settingsService.syncAdminsFromEnv();

  const products = await productService.activeProducts();
  const bypass = await bypassService.list();
  const botOn = await settingsService.isBotEnabled();

  const warnings = [];
  if (!admins.length) {
    warnings.push(
      'Koi admin number nahi hai - ADMIN_NUMBERS .env me daalo ya admin_numbers table me add karo.'
    );
  }
  if (!config.PAYMENT_LINK) {
    warnings.push('PAYMENT_LINK .env me set nahi hai - customers ko payment link nahi jayega.');
  }
  if (!products.length) {
    warnings.push('Koi active product nahi hai - migration 005_seed_data.sql chalao.');
  }
  if (!botOn) {
    warnings.push('Bot abhi OFF hai. Chalu karne ke liye admin se: /bot on');
  }

  /**
   * Is the file bucket still configured the way the code needs?
   *
   * Configuration lives in a dashboard, outside review, and the last time
   * nobody read it back an ordinary JPEG payment proof was being silently
   * refused for three phases. Warn only: a Storage problem must never stop
   * the shop selling, and every one of these degrades gracefully.
   */
  warnings.push(...(await storage.checkBucket().catch(() => [])));

  for (const warning of warnings) {
    logger.warn('preflight', { message: warning });
    console.warn(`⚠️  ${warning}`);
  }

  console.log(
    [
      '',
      `${config.BUSINESS_NAME} | Repli v1 (Supabase)`,
      `driver:   ${config.DRIVER}${config.TEST_MODE ? ' (TEST_MODE)' : ''}`,
      `database: ${config.SUPABASE_URL}`,
      `bot:      ${botOn ? 'ON' : 'OFF'}`,
      `admins:   ${admins.join(', ') || '(none)'}`,
      `bypass:   ${bypass.filter((b) => b.active).length} number(s)`,
      `products: ${products.map((p) => p.name).join(', ') || '(none)'}`,
      '',
    ].join('\n')
  );
}

async function main() {
  await preflight();

  const bot = createAdapter();
  bot.onMessage(createRouter(bot));

  process.on('unhandledRejection', (err) => {
    logger.error('process.unhandled_rejection', { error: err && (err.stack || err.message || err) });
  });
  process.on('uncaughtException', (err) => {
    logger.error('process.uncaught_exception', { error: err && (err.stack || err.message) });
  });

  // Replies typed in the admin panel land in `outbound_messages`; this drains
  // that queue through the same WhatsApp session the bot already owns.
  const stopOutbox = startOutboxWorker(bot);

  // Payment link, shipping and business name are edited in the panel, not in
  // .env - pick those edits up without a restart.
  const stopSettingsSync = settingsService.startSettingsSync();

  // Message wording is edited in the panel; pick those edits up live.
  const stopTemplateSync = templates.startTemplateSync();

  /**
   * Prices, stock and settings are edited in the panel too - but those are
   * cached, and a timer is a poor way to learn that a price changed. This
   * listens for "that key is stale" from the panel instead. One long-lived
   * listener per process, never one per message.
   */
  const invalidation = startInvalidationListener();

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('process.shutdown', { action: signal });
    stopOutbox();
    stopSettingsSync();
    stopTemplateSync();
    invalidation.stop();
    await bot.stop().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  await bot.start();
  logger.info('repli.started', { action: config.DRIVER });
  return bot;
}

if (require.main === module) {
  main().catch((err) => {
    logger.error('repli.start_failed', { error: err && (err.stack || err.message) });
    console.error('\n❌ Repli failed to start:', err && err.message);
    if (String(err && err.message).includes('Supabase')) {
      console.error(
        '   → Check SUPABASE_URL / SUPABASE_SECRET_KEY in .env, then run `npm run migrate`.\n'
      );
    }
    process.exit(1);
  });
}

module.exports = { main, preflight };
