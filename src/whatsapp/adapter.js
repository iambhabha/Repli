'use strict';

/**
 * WhatsApp adapter - the ONLY place that knows which WhatsApp library is used.
 *
 * Public interface used by the rest of Repli:
 *   onMessage(callback)
 *   sendMessage(phone, text)
 *   sendImage(phone, filePath, caption)      (sendMedia is an alias)
 *   markAsRead(messageId, phone)
 *   isConnected()
 *   notifyAdmins(text) / notifyAdminsImage(filePath, caption)
 *   simulateIncomingMessage(phone, text)     TEST_MODE helper
 *   start() / stop()
 *
 * Incoming messages are normalised to:
 *   { id, phone, text, isMedia, media:{buffer,mimetype},
 *     isGroup, isStatus, fromMe, type, timestamp }
 *
 * Swapping open-wa for another library means writing one new driver file -
 * no business logic changes.
 */

const path = require('path');
const config = require('../config');
const logger = require('../logger');
const messageService = require('../services/messageService');
const settingsService = require('../services/settingsService');
const conversationService = require('../services/conversationService');
const humanise = require('../ai/humanise');
const redact = require('../ai/redact');
const { createTyping } = require('./typing');

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
};

/**
 * Which language this customer is being answered in. The router already
 * decided it and stored it on the conversation; reading it back here keeps
 * the rewrite in the same language as the template it is rewriting.
 */
async function languageOf(phone) {
  try {
    const convo = await conversationService.get(phone);
    return (convo && convo.data && convo.data.lang) || 'hi';
  } catch (err) {
    return 'hi';
  }
}

/** Where the customer is, in words a model can use. */
const PHASES = {
  START: 'just said hello, nothing chosen yet',
  SELECT_CATEGORY: 'choosing between categories',
  SELECT_PRODUCT: 'choosing a design',
  SELECT_COLOR: 'choosing a colour',
  SELECT_SIZE: 'choosing a size',
  SELECT_QUANTITY: 'choosing how many',
  COLLECT_DETAILS: 'giving their delivery details',
  ORDER_SUMMARY: 'checking the order summary before confirming',
  WAITING_FOR_PAYMENT: 'has been asked to pay the booking amount',
  PAYMENT_VERIFYING: 'has sent the payment screenshot, a person is verifying it',
  CONFIRMED: 'order confirmed',
  HUMAN_HANDOFF: 'handed over to a person',
  CANCELLED: 'cancelled their order',
};

/**
 * Everything the rewriter needs to sound like it has been in the room.
 *
 * Without this it saw one isolated line and answered like a form letter -
 * repeating a question the customer had just answered, or greeting someone
 * mid-order. The conversation row is already cached, so this costs one extra
 * query for the transcript and nothing else.
 */
/** Where the customer is handing over, or has handed over, their details. */
const DETAIL_STATES = new Set(['COLLECT_DETAILS', 'ORDER_SUMMARY']);

async function replyContext(phone) {
  try {
    const convo = await conversationService.get(phone);
    const draft = (convo.data && convo.data.draft) || {};

    /**
     * Names, cities and PIN codes used to be listed here by value, and the
     * transcript was passed through untouched. Neither is needed to choose
     * words: "they have already given their city" stops the model asking
     * twice just as well as the city itself does, and does not put a
     * customer's address in front of a third party to do it.
     */
    return {
      phase: PHASES[convo.state] || 'in the middle of an order',
      known: redact.known(draft, {
        color: convo.data && convo.data.color,
        size: convo.data && convo.data.size,
      }),
      history: redact.history(await messageService.recentHistory(phone, 4).catch(() => []), {
        detailsPhase: DETAIL_STATES.has(convo.state),
      }),
    };
  } catch (err) {
    return {};
  }
}

function wrap(driver) {
  let handler = async () => {};
  let simulatedCounter = 0;

  /**
   * Who owns "typing…".
   *
   * Here rather than in the state machine on purpose: the flow decides what
   * to say, this layer decides how the shop appears while deciding it. The
   * router takes a lease for the whole turn; nothing deeper can switch it
   * off, because nothing deeper knows it exists.
   */
  const typing = createTyping(driver);

  const adapter = {
    driver: driver.name,
    typing,

    onMessage(fn) {
      handler = fn;
      driver.onMessage(fn);
    },

    async start() {
      await driver.start();
    },

    async stop() {
      // A shutdown must not leave anyone watching "typing…" for ever.
      await typing.clearAll().catch(() => {});
      if (driver.stop) await driver.stop();
    },

    isConnected() {
      return driver.isConnected ? Boolean(driver.isConnected()) : false;
    },

    async markAsRead(messageId, phone) {
      if (!driver.markAsRead) return;
      try {
        await driver.markAsRead(messageId, config.normalisePhone(phone));
      } catch (err) {
        logger.warn('adapter.mark_read_failed', { error: err.message });
      }
    },

    /**
     * @param {string} phone
     * @param {string} text     what the rule engine decided to say
     * @param {object} [options]
     * @param {boolean} [options.raw]  skip the AI rewrite (admin messages)
     * @param {string}  [options.lang] 'hi' | 'en'; defaults to the customer's
     */
    async sendMessage(phone, text, options = {}) {
      const to = config.normalisePhone(phone);
      if (!to || !text) return;

      // The AI only ever rephrases what is already decided, and only for
      // customers: an admin reading "/paid REP-1039 done" wants the exact
      // words, not a friendlier version of them.
      /**
       * `this.lang` is set by the router for the turn it is handling.
       *
       * Without it the rewrite reads the language off the conversation row -
       * which is only written after the turn ends, so the very first reply to
       * an English customer came back in Hinglish. The router already knows
       * the answer; it just has to say so.
       */
      const language = options.lang || this.lang || (await languageOf(to));

      let body = String(text);
      // An admin gets the exact words. They read these as instrument readings
      // ("stock 3 left", "REP-1039 confirmed"), not as conversation, and
      // adminService sends to admins from a dozen places - checking the
      // recipient once here is safer than tagging every one of those calls.
      const toAdmin = await settingsService.isAdmin(to).catch(() => false);
      if (!options.raw && !toAdmin) {
        const ctx = await replyContext(to);
        body = await humanise.humanise(body, language, to, ctx).catch(() => body);
      }

      try {
        await driver.sendMessage(to, body);
        logger.info('reply.sent', { phone: to, reply: body });

        /**
         * A delivered message clears the indicator on the customer's phone.
         * If the turn is still working - a second message, a photo, another
         * lookup - say it again, so the gap between two replies looks the
         * same as the gap before the first. Does nothing when no lease is
         * held, which is every admin message and every finished turn.
         */
        void typing.refresh(to);
        // Not awaited: the message is already delivered, and the customer
        // should not wait on our own bookkeeping.
        void messageService.recordOutgoing(to, body, 'text');
      } catch (err) {
        logger.error('reply.failed', { phone: to, error: err.message });
      }
    },

    async sendImage(phone, filePath, caption) {
      const to = config.normalisePhone(phone);
      if (!to) return;
      try {
        await driver.sendMedia(to, filePath, caption || '');
        logger.info('reply.media_sent', { phone: to, action: path.basename(filePath) });
        await messageService.recordOutgoing(to, caption || '', 'media', filePath);
      } catch (err) {
        logger.error('reply.media_failed', { phone: to, error: err.message });
      }
    },

    /** Every active admin number gets the message. */
    async notifyAdmins(text) {
      const admins = await settingsService.adminNumbers().catch(() => config.ADMIN_NUMBERS);
      if (!admins.length) {
        logger.warn('admin.not_configured', { message: text });
        return;
      }
      for (const adminPhone of admins) {
        await adapter.sendMessage(adminPhone, text, { raw: true });
      }
    },

    /** Payment proof goes to admins only - never to another customer. */
    async notifyAdminsImage(filePath, caption, tag) {
      const admins = await settingsService.adminNumbers().catch(() => config.ADMIN_NUMBERS);
      if (!admins.length) {
        logger.warn('admin.not_configured', { message: caption });
        return;
      }
      for (const adminPhone of admins) {
        try {
          await driver.sendMedia(adminPhone, filePath, caption);
          logger.info('admin.proof_sent', { phone: adminPhone, orderId: tag });
          await messageService.recordOutgoing(adminPhone, caption, 'media', filePath);
        } catch (err) {
          logger.error('admin.proof_failed', { phone: adminPhone, error: err.message });
          await adapter.sendMessage(
            adminPhone,
            `${caption}\n\n(screenshot bhejne me dikkat: ${filePath})`
          );
        }
      }
    },

    /**
     * TEST_MODE helper: push a message through the whole pipeline without a
     * real WhatsApp connection.
     *
     *   await bot.simulateIncomingMessage('919999999999', 'black tshirt chahiye')
     *   await bot.simulateIncomingMessage('919999999999', null, { media: {...} })
     */
    async simulateIncomingMessage(phone, text, options = {}) {
      const message = {
        id: options.id || `sim_${Date.now().toString(36)}_${++simulatedCounter}`,
        phone: config.normalisePhone(phone),
        text: text || '',
        isMedia: Boolean(options.media),
        media: options.media || null,
        isGroup: false,
        isStatus: false,
        fromMe: false,
        type: options.media ? 'image' : 'chat',
        timestamp: Date.now(),
        ...options.overrides,
      };
      await handler(message);
      return message;
    },
  };

  adapter.sendMedia = adapter.sendImage;
  return adapter;
}

/**
 * WA_DRIVER picks the driver:
 *   wwebjs (default) real WhatsApp via whatsapp-web.js
 *   mock             terminal simulator, no WhatsApp at all
 *   openwa           the old @open-wa/wa-automate driver, kept for reference.
 *                    It no longer connects: it waits for window.Debug.VERSION,
 *                    which current WhatsApp Web does not expose.
 */
const DRIVERS = {
  mock: () => require('./mock')(),
  wwebjs: () => require('./wwebjs')(),
  openwa: () => require('./openwa')(),
};

function createAdapter(driverName = config.DRIVER) {
  const factory = DRIVERS[driverName] || DRIVERS.wwebjs;
  const driver = factory();
  return wrap(driver);
}

module.exports = { createAdapter, MIME_BY_EXT };
