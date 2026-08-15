'use strict';

/**
 * Admin commands. Only numbers in admin_numbers reach this file - the router
 * checks that first.
 */

const path = require('path');
const config = require('../config');
const logger = require('../logger');
const messages = require('../bot/messages');
const settingsService = require('./settingsService');
const bypassService = require('./bypassService');
const conversationService = require('./conversationService');
const orderService = require('./orderService');
const productService = require('./productService');

const isCommand = (text) => /^\s*\//.test(String(text || ''));

function parse(text) {
  const parts = String(text || '').trim().split(/\s+/);
  return { command: parts[0].toLowerCase(), args: parts.slice(1) };
}

function normaliseOrderId(raw) {
  const value = String(raw || '').trim().toUpperCase().replace(/^#/, '');
  if (!value) return '';
  if (value.includes('-')) return value;
  if (/^\d+$/.test(value)) return `${config.ORDER_PREFIX}-${value}`;
  return value;
}

// -------------------------------------------------------------- bot switch

async function cmdBot(bot, adminPhone, args) {
  const arg = String(args[0] || '').toLowerCase();
  if (arg === 'on' || arg === 'off') {
    await settingsService.setBotEnabled(arg === 'on');
    return bot.sendMessage(
      adminPhone,
      arg === 'on'
        ? '✅ Repli ON. Ab customers ko automatic reply jayenge.'
        : '⛔ Repli OFF. Ab koi automatic reply nahi jayega (admin commands chalte rahenge).'
    );
  }
  const enabled = await settingsService.isBotEnabled();
  return bot.sendMessage(
    adminPhone,
    `Repli abhi ${enabled ? 'ON ✅' : 'OFF ⛔'} hai.\n\nUsage: /bot on | /bot off`
  );
}

// ------------------------------------------------------------ human handoff

async function cmdHuman(bot, adminPhone, args) {
  const phone = config.normalisePhone(args[0]);
  if (!phone) return bot.sendMessage(adminPhone, 'Usage: /human 919876543210');

  await conversationService.setMode(phone, conversationService.MODE.HUMAN);
  await bot.sendMessage(
    adminPhone,
    `🙋 ${phone} ab HUMAN mode me hai.\nRepli in ko reply nahi karega.\n\nWapas bot par dene ke liye: /resume ${phone}`
  );
  logger.info('admin.human', { phone: config.normalisePhone(adminPhone), action: phone });
}

async function cmdResume(bot, adminPhone, args) {
  const phone = config.normalisePhone(args[0]);
  if (!phone) return bot.sendMessage(adminPhone, 'Usage: /resume 919876543210');

  await conversationService.setMode(phone, conversationService.MODE.BOT);
  await bot.sendMessage(
    adminPhone,
    `🤖 ${phone} wapas BOT mode me hai.\nAgle message par Repli reply karega.`
  );
  logger.info('admin.resume', { phone: config.normalisePhone(adminPhone), action: phone });
}

// ------------------------------------------------------------------ bypass

async function cmdBypass(bot, adminPhone, args) {
  const action = String(args[0] || '').toLowerCase();
  const target = args[1];
  const name = args.slice(2).join(' ') || null;

  if (action === 'add') {
    const result = await bypassService.add(target, name);
    if (!result.ok) {
      return bot.sendMessage(
        adminPhone,
        result.reason === 'EXISTS'
          ? `${result.phone} pehle se bypass list me hai.`
          : 'Usage: /bypass add 919876543210 Brother'
      );
    }
    return bot.sendMessage(
      adminPhone,
      `🚫 ${result.phone}${result.name ? ` (${result.name})` : ''} bypass list me add ho gaya.\n` +
        'Repli ab in ko kabhi reply nahi karega.'
    );
  }

  if (action === 'remove' || action === 'rm' || action === 'delete') {
    const result = await bypassService.remove(target);
    if (!result.ok) {
      return bot.sendMessage(adminPhone, `${result.phone || target} bypass list me nahi hai.`);
    }
    return bot.sendMessage(
      adminPhone,
      `✅ ${result.phone} bypass list se hat gaya.\nAb Repli in ko normal customer maanega.`
    );
  }

  if (action === 'list' || !action) {
    return bot.sendMessage(adminPhone, messages.adminBypassList(await bypassService.list()));
  }

  return bot.sendMessage(
    adminPhone,
    'Usage:\n/bypass add NUMBER NAME\n/bypass remove NUMBER\n/bypass list'
  );
}

// ------------------------------------------------------------------ orders

/** The only path that confirms an order and reduces stock. */
async function cmdPaid(bot, adminPhone, args) {
  const orderId = normaliseOrderId(args[0]);
  if (!orderId) return bot.sendMessage(adminPhone, 'Usage: /paid REP-1001');

  const result = await orderService.confirmPayment(orderId, adminPhone);

  if (!result || !result.ok) {
    const reasons = {
      NOT_FOUND: `Order #${orderId} nahi mila.`,
      ALREADY_CONFIRMED: `Order #${orderId} pehle se CONFIRMED hai.`,
      CANCELLED: `Order #${orderId} cancelled hai, confirm nahi kar sakte.`,
    };
    return bot.sendMessage(
      adminPhone,
      `⚠️ ${(result && reasons[result.reason]) || 'Order confirm nahi ho paya.'}`
    );
  }

  const order = await orderService.getByOrderId(result.order_id);
  // The confirmation goes to the customer, so it follows their language,
  // not the admin's.
  const confirmPack = messages.for((await conversationService.get(order.phone)).data?.lang);
  await bot.sendMessage(order.phone, confirmPack.orderConfirmed(order));

  const moves = (result.stock || [])
    .map((m) => `${m.product} ${m.color || ''} ${m.size || ''}: ${m.before} → ${m.after}`.replace(/\s+/g, ' '))
    .join('\n');

  let reply =
    `✅ Order #${order.order_id} CONFIRMED.\n` +
    'Customer ko confirmation bhej diya.\n' +
    'Customer ab HUMAN mode me hai.\n' +
    (moves ? `\nStock:\n${moves}` : '');
  if (result.short) {
    reply += '\n\n⚠️ Stock order se kam tha. Stock 0 kar diya - Supabase me check karo.';
  }

  await bot.sendMessage(adminPhone, reply);
  logger.info('admin.paid', { phone: config.normalisePhone(adminPhone), orderId: order.order_id });
}

/** Payment rejected. Stock untouched, customer handed to a human. */
async function cmdReject(bot, adminPhone, args) {
  const orderId = normaliseOrderId(args[0]);
  if (!orderId) return bot.sendMessage(adminPhone, 'Usage: /reject REP-1001');

  const result = await orderService.rejectPayment(orderId, adminPhone);

  if (!result || !result.ok) {
    const reasons = {
      NOT_FOUND: `Order #${orderId} nahi mila.`,
      ALREADY_CONFIRMED: `Order #${orderId} already CONFIRMED hai - reject nahi kar sakte.`,
    };
    return bot.sendMessage(
      adminPhone,
      `⚠️ ${(result && reasons[result.reason]) || 'Reject nahi ho paya.'}`
    );
  }

  const rejectPack = messages.for((await conversationService.get(result.phone)).data?.lang);
  await bot.sendMessage(result.phone, rejectPack.paymentRejected());
  await bot.sendMessage(
    adminPhone,
    `❌ Order #${result.order_id} PAYMENT_FAILED.\nStock touch nahi hua.\nCustomer HUMAN mode me hai.`
  );
  logger.info('admin.reject', {
    phone: config.normalisePhone(adminPhone),
    orderId: result.order_id,
  });
}

async function cmdOrder(bot, adminPhone, args) {
  const orderId = normaliseOrderId(args[0]);
  if (!orderId) return bot.sendMessage(adminPhone, 'Usage: /order REP-1001');

  const order = await orderService.getByOrderId(orderId);
  if (!order) return bot.sendMessage(adminPhone, `⚠️ Order #${orderId} nahi mila.`);

  await bot.sendMessage(adminPhone, messages.adminOrderView(order));

  const payment = orderService.paymentOf(order);
  if (payment && payment.proof_url) {
    await bot
      .sendImage(adminPhone, path.join(config.ROOT, payment.proof_url), `Proof: #${order.order_id}`)
      .catch(() => {});
  }
}

const cmdOrders = async (bot, adminPhone) =>
  bot.sendMessage(adminPhone, messages.adminOrderList(await orderService.recent(10)));

const cmdStock = async (bot, adminPhone) =>
  bot.sendMessage(adminPhone, messages.adminStock(await productService.stockReport()));

const cmdProduct = async (bot, adminPhone) =>
  bot.sendMessage(adminPhone, messages.adminProducts(await productService.productReport()));

const HANDLERS = {
  '/bot': cmdBot,
  '/repli': cmdBot,
  '/human': cmdHuman,
  '/resume': cmdResume,
  '/bypass': cmdBypass,
  '/paid': cmdPaid,
  '/reject': cmdReject,
  '/order': cmdOrder,
  '/orders': cmdOrders,
  '/stock': cmdStock,
  '/product': cmdProduct,
  '/products': cmdProduct,
};

/**
 * Handle an admin message. Non-command messages are ignored on purpose, so
 * the owner's ordinary chatter never starts a sales flow.
 */
async function handleAdminMessage(bot, msg) {
  const phone = config.normalisePhone(msg.phone);
  const text = String(msg.text || '');

  if (!isCommand(text)) {
    logger.info('admin.ignored_non_command', { phone });
    return true;
  }

  const { command, args } = parse(text);
  const handler = HANDLERS[command];
  logger.info('admin.command', { phone, action: command });

  if (!handler) {
    await bot.sendMessage(phone, messages.adminHelp());
    return true;
  }

  await handler(bot, phone, args);
  return true;
}

module.exports = { handleAdminMessage, isCommand };
