'use strict';

/**
 * Message router - the gatekeeper.
 *
 * Priority:  ADMIN  ->  BYPASS  ->  HUMAN MODE  ->  BOT
 *
 * Also does duplicate protection, per-customer serialisation and error
 * containment, so a crash never leaks a stack trace to a customer.
 */

const config = require('../config');
const logger = require('../logger');
const messages = require('./messages');
const language = require('./language');
const stateMachine = require('./stateMachine');
const settingsService = require('../services/settingsService');
const bypassService = require('../services/bypassService');
const conversationService = require('../services/conversationService');
const messageService = require('../services/messageService');
const adminService = require('../services/adminService');

/**
 * One promise chain per phone number: two messages from the same customer
 * can never interleave and corrupt their state. Different customers still
 * run concurrently, so the WhatsApp listener is never blocked.
 */
const queues = new Map();

function enqueue(phone, task) {
  const previous = queues.get(phone) || Promise.resolve();
  const next = previous.then(task, task);
  queues.set(
    phone,
    next.catch(() => {}).then(() => {
      if (queues.get(phone) === next) queues.delete(phone);
    })
  );
  return next;
}

function shouldIgnore(msg) {
  if (!msg) return 'empty';
  if (msg.fromMe) return 'own_message';
  if (msg.isGroup) return 'group_chat';
  if (msg.isStatus) return 'status_broadcast';
  if (!config.normalisePhone(msg.phone)) return 'no_phone';
  if (!msg.isMedia && !String(msg.text || '').trim()) return 'empty_body';
  return null;
}

function createRouter(bot) {
  return async function route(msg) {
    const skip = shouldIgnore(msg);
    if (skip) {
      logger.info('message.ignored', { phone: msg && msg.phone, action: skip });
      return;
    }

    const phone = config.normalisePhone(msg.phone);

    let isAdmin = false;
    try {
      isAdmin = await settingsService.isAdmin(phone);
    } catch (err) {
      logger.error('router.admin_check_failed', { phone, error: err.message });
    }

    // ---- BYPASS: personal / family / friends -----------------------------
    // Checked before ANY database write: no reply, no state, no order, no
    // notification, not even a message row. Admins are exempt so the owner's
    // own number can be on the list and still run commands.
    if (!isAdmin) {
      let bypassed = false;
      try {
        bypassed = await bypassService.isBypassed(phone);
      } catch (err) {
        logger.error('router.bypass_check_failed', { phone, error: err.message });
        bypassed = true; // fail closed: silence is always the safe outcome
      }
      if (bypassed) {
        logger.info('message.bypassed', { phone, action: 'personal_number' });
        return;
      }
    }

    // ---- duplicate protection -------------------------------------------
    if (!(await messageService.claimIncoming({ ...msg, phone }))) {
      logger.info('message.duplicate', { phone, action: String(msg.id) });
      return;
    }

    await bot.markAsRead(msg.id, phone);

    return enqueue(phone, async () => {
      const started = Date.now();
      let before = { state: 'START', mode: 'BOT' };

      try {
        before = await conversationService.get(phone);
        let action;

        /**
         * Answer in the language the customer wrote in.
         *
         * Sticky: decided from the first message that carries a signal and
         * kept afterwards, because "ok" / "yes" / "M" look identical in both
         * languages and a per-message detector would flip mid-chat.
         */
        const lang = language.resolve(before.data && before.data.lang, msg.isMedia ? '' : msg.text);
        const localBot = Object.create(bot);
        localBot.t = messages.for(lang);

        if (isAdmin) {
          await adminService.handleAdminMessage(bot, msg);
          action = 'admin';
        } else if (!(await settingsService.isBotEnabled())) {
          action = 'bot_disabled'; // global switch off: stay quiet
        } else if (before.mode === conversationService.MODE.HUMAN) {
          action = 'human_mode'; // a person owns this conversation
        } else {
          action = await stateMachine.handleMessage(localBot, msg);
        }

        const after = await conversationService.get(phone);

        // Written after the turn on purpose: "menu" and "cancel" reset the
        // conversation's scratch pad, and the language must survive that.
        if (!isAdmin && after.data && after.data.lang !== lang) {
          await conversationService.save(phone, { data: { ...after.data, lang } });
        }
        logger.turn({
          phone,
          messageId: msg.id,
          message: msg.isMedia ? `[${msg.media && msg.media.mimetype}]` : msg.text,
          state: `${before.state}→${after.state}`,
          mode: after.mode,
          action,
          orderId: after.current_order_id || undefined,
          ms: Date.now() - started,
        });
      } catch (err) {
        await onError(bot, phone, msg, before, err);
      }
    });
  };
}

/** Customers get a friendly message and a human; admins get the real error. */
async function onError(bot, phone, msg, before, err) {
  logger.error('handler.failed', {
    phone,
    state: before && before.state,
    message: msg.text,
    error: err && err.stack ? err.stack.split('\n').slice(0, 4).join(' | ') : String(err),
  });

  try {
    if (!(await settingsService.isAdmin(phone))) {
      // Even the apology goes out in the customer's own language.
      const convo = await conversationService.get(phone).catch(() => null);
      const pack = messages.for(convo && convo.data && convo.data.lang);
      await bot.sendMessage(phone, pack.technicalError());
      await conversationService.setMode(phone, conversationService.MODE.HUMAN);
    }
  } catch (sendErr) {
    logger.error('handler.reply_failed', { phone, error: sendErr.message });
  }

  try {
    await bot.notifyAdmins(
      messages.adminError(
        `customer ${phone} (state ${before && before.state})`,
        `${err && err.message}\n\n${(err && err.stack ? err.stack : '')
          .split('\n')
          .slice(0, 5)
          .join('\n')}`
      )
    );
  } catch (notifyErr) {
    logger.error('handler.notify_failed', { phone, error: notifyErr.message });
  }
}

module.exports = { createRouter, shouldIgnore };
