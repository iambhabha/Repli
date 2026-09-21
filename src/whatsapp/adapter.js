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
const { createTyping } = require('./typing');

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
};

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
    _impl: driver,
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

      /**
       * The same sentence twice in a row, to the same person, is never right.
       *
       * A customer sent forty-six photographs in one go. The shop had no
       * open order, so each one was answered - and forty-six identical
       * "Bhai abhi koi pending order nahi hai" went out, one per image, in
       * under a minute. Nothing was broken: every reply was individually
       * correct, and the shop still looked like a machine having a fit.
       *
       * This is the last line before the wire, so it catches that whatever
       * upstream reason produced it - a burst of media, a customer tapping
       * send repeatedly, a retry loop nobody has found yet. The first reply
       * always goes; the repeats are dropped and counted.
       *
       * Only for an EXACTLY identical message. Anything the shop genuinely
       * needs to say twice - a size question after a detour, a summary shown
       * again - differs by at least a word, and once the window has passed
       * the same words are a reminder rather than a stutter.
       *
       * Raw messages are guarded too, on a much shorter fuse. This used to
       * sit inside `if (!options.raw)`, so every message that skipped the
       * rewriter skipped the guard as well - the details form, the summary,
       * the mid-order acknowledgements - which left the one fault it exists
       * to prevent reachable through the back door. They cannot share a
       * window, though: a raw message is often one the shop legitimately
       * repeats, and a minute of silence on the address form would leave the
       * customer staring at nothing.
       *
       * The slot is claimed BEFORE the rewrite and the send. Claiming it
       * afterwards reads correctly and loses every race - rewriting and
       * sending take a couple of seconds, so a burst all reach the check
       * while the map is still empty, all pass, and all go out. That is why
       * the forty-five got through: each turn overtook the one before it.
       */
      const window = options.raw ? RAW_REPEAT_WINDOW : REPEAT_WINDOW;
      const last = recentlySent.get(to);

      if (last && last.body === String(text) && Date.now() - last.at < window) {
        last.dropped += 1;
        logger.info('reply.repeat_suppressed', { phone: to, action: `${last.dropped} dropped` });
        return;
      }

      recentlySent.set(to, { body: String(text), at: Date.now(), dropped: 0 });

      /**
       * Sent exactly as written.
       *
       * This used to run every customer reply back through the model to be
       * reworded, because the words came from a template file and templates
       * read like templates. The agent writes its own sentence for the
       * customer in front of it, so a rewrite now has nothing to improve -
       * it would be a second model call per message, adding latency and cost
       * to paraphrase something already phrased for this conversation, with
       * a fresh chance to drift away from what the tools actually returned.
       *
       * Admin messages were never rewritten and still are not.
       */
      const body = String(text);

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

        /**
         * Awaited, which it was not before.
         *
         * The messages table IS the agent's memory - recentTurns() reads it
         * back as the transcript on the next turn. Letting the insert run
         * loose meant a customer typing twice quickly could get a reply built
         * from a transcript missing the reply before it, and a model that
         * cannot see what it just said says it again. One insert on a turn
         * that already spent seconds in the model is not the latency worth
         * saving.
         */
        await messageService.recordOutgoing(to, body, 'text');
      } catch (err) {
        /**
         * The slot was claimed before the send, so a failure has to give it
         * back. Otherwise a WhatsApp blip swallows the reply AND every retry
         * for the next minute, and the customer hears nothing.
         */
        const claimed = recentlySent.get(to);
        if (claimed && claimed.body === String(text) && claimed.dropped === 0) {
          recentlySent.delete(to);
        }
        logger.error('reply.failed', { phone: to, error: err.message });
      }
    },

    /**
     * @returns {Promise<boolean>} whether the picture actually left the building
     *
     * It used to return nothing and swallow the failure, which meant a caller
     * could only assume it had worked. The agent then told a customer "photos
     * bhej diye" over five consecutive send failures, and told another that a
     * payment QR was on its way when none was. A send that can fail has to say
     * so; deciding what to tell the customer is the caller's job, and it
     * cannot do that job without the answer.
     */
    async sendImage(phone, filePath, caption) {
      const to = config.normalisePhone(phone);
      if (!to) return false;
      try {
        await driver.sendMedia(to, filePath, caption || '');
        logger.info('reply.media_sent', { phone: to, action: path.basename(filePath) });
        await messageService.recordOutgoing(to, caption || '', 'media', filePath);
        return true;
      } catch (err) {
        logger.error('reply.media_failed', { phone: to, error: err.message });
        return false;
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

/**
 * The last thing said to each number, so it is not said again immediately.
 *
 * In memory on purpose: it is a stutter guard, not a record. A restart
 * losing it costs one duplicate message at worst, and the alternative - a
 * round trip to the database before every reply - would put a query in front
 * of every single thing the shop says.
 *
 * Trimmed when it grows, so a busy day cannot turn it into a leak.
 *
 * Eight seconds, down from sixty. Sixty was sized for the old bot, which
 * pulled its replies from a template file and so produced the same sentence
 * for whole minutes at a time. The agent writes a fresh sentence per turn, so
 * an identical one now almost always means a genuine burst - the same message
 * delivered twice, a customer double-tapping send - and a minute-long window
 * only bought the chance to swallow a real answer to a real question. The
 * customer has no way to tell a dropped reply from a shop ignoring them.
 */
const REPEAT_WINDOW = 8_000;

/**
 * The same window, for messages that bypass the rewriter.
 *
 * Short because these are the replies the shop repeats on purpose - the
 * address form, the summary - and a long window would swallow a re-ask the
 * customer is waiting on. Long enough that a burst of images arriving in the
 * same second still collapses to one reply.
 */
const RAW_REPEAT_WINDOW = 10_000;
const recentlySent = new Map();

setInterval(() => {
  const cutoff = Date.now() - REPEAT_WINDOW;
  for (const [phone, entry] of recentlySent) {
    if (entry.at < cutoff) recentlySent.delete(phone);
  }
}, REPEAT_WINDOW).unref();

function createAdapter(driverName = config.DRIVER) {
  const factory = DRIVERS[driverName] || DRIVERS.wwebjs;
  const driver = factory();
  return wrap(driver);
}

module.exports = { createAdapter, MIME_BY_EXT };
