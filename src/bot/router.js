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

/**
 * "typing…" for the length of the turn, and not one millisecond longer.
 *
 * Held here rather than anywhere deeper because this is the only place that
 * knows when a turn begins and ends. The state machine sends messages from a
 * dozen branches; if any of them owned the indicator, the first branch to
 * finish would switch it off while the rest was still working.
 *
 * Both helpers tolerate a bot that has no typing support at all - the test
 * suite drives a hand-written adapter, and a presence update must never be
 * something the shop depends on.
 */
const typingOn = async (bot, phone) => {
  try {
    if (bot && bot.typing) await bot.typing.begin(phone);
  } catch (err) {
    logger.warn('typing.begin_failed', { phone, error: err.message });
  }
};

const typingOff = async (bot, phone) => {
  try {
    if (bot && bot.typing) await bot.typing.end(phone);
  } catch (err) {
    // Swallowed on purpose: this runs in a finally, and it must never
    // replace the error already on its way up.
    logger.warn('typing.end_failed', { phone, error: err.message });
  }
};

function shouldIgnore(msg) {
  if (!msg) return 'empty';
  if (msg.fromMe) return 'own_message';
  if (msg.isGroup) return 'group_chat';
  if (msg.isStatus) return 'status_broadcast';
  if (!config.normalisePhone(msg.phone)) return 'no_phone';
  if (!msg.isMedia && !String(msg.text || '').trim()) return 'empty_body';
  return null;
}

/**
 * A first message that is really an advert, not a customer.
 *
 * The shop's number receives a steady trickle of broadcasts from other
 * businesses - AstroTalk app links, CRED support notices, "this number is no
 * longer active, use this link". The bot was greeting every one of them:
 * paying for two AI calls, creating a conversation row, and putting a
 * stranger's promo into the customer list.
 *
 * The tell is the opening line. Real customers open with a few words -
 * "hi", "tshirt chahiye", "spider man wali hai?" - not with a URL or a
 * paragraph. This only ever applies to the FIRST message of a conversation,
 * so a customer who later sends a link is unaffected.
 */
const LINK = /https?:\/\/|wa\.me\/|bit\.ly\//i;

function looksAutomated(text) {
  const body = String(text || '');
  if (LINK.test(body)) return 'promo_link';
  if (body.length > 400) return 'bulk_message';
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

    /**
     * The customer pasted our own message back.
     *
     * WhatsApp makes this easy to do by accident, and it caused a real mess:
     * the bot answered its own prompt, then stored it as a delivery address.
     * An echo is never an instruction, so it is dropped before anything else
     * looks at it.
     */
    if (!isAdmin && !msg.isMedia) {
      const body = String(msg.text || '').trim();
      if (body.length >= 25) {
        const ours = await messageService.recentOutgoing(phone).catch(() => []);
        const same = (a, b) =>
          a.replace(/\s+/g, ' ').trim().slice(0, 60).toLowerCase() ===
          b.replace(/\s+/g, ' ').trim().slice(0, 60).toLowerCase();
        if (ours.some((sent) => same(sent, body))) {
          logger.info('message.echo_ignored', { phone });
          return;
        }
      }
    }

    // ---- test mode: only these numbers -----------------------------------
    // Admins are exempt so the owner can always drive the bot themselves.
    if (!isAdmin && !(await settingsService.isAllowed(phone))) {
      logger.info('message.not_allowed', { phone, action: 'allowlist' });
      return;
    }

    // ---- adverts from other businesses ----------------------------------
    if (!isAdmin && !msg.isMedia) {
      const automated = looksAutomated(msg.text);
      if (automated) {
        const existing = await conversationService.exists(phone).catch(() => true);
        if (!existing) {
          logger.info('message.automated', { phone, action: automated });
          return;
        }
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

      /**
       * On before any work, off in the finally below.
       *
       * Everything between the two is what the customer is waiting through:
       * the conversation read, the language decision, the state machine, its
       * database calls, any model call, the guards, and the fallback when a
       * guard rejects. No artificial delay is added anywhere - the indicator
       * lasts exactly as long as the thinking does.
       */
      await typingOn(bot, phone);

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
        const lang = await language.resolveSmart(
          before.data && before.data.lang,
          msg.isMedia ? '' : msg.text
        );
        const localBot = Object.create(bot);
        localBot.t = messages.for(lang);
        // Read back by the adapter when it rewrites a reply, so the first
        // message of a conversation is rewritten in the language we just
        // decided rather than the one saved at the end of the turn.
        localBot.lang = lang;
        // The sender's WhatsApp profile name, for the steps that would
        // otherwise ask for something WhatsApp already told us.
        localBot.pushName = msg.pushName || '';

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
      } finally {
        // Guaranteed: a model timeout, a database outage, a thrown guard, a
        // handler that fell over completely - the customer never sits
        // watching a shop that is typing and never speaks.
        await typingOff(bot, phone);
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
