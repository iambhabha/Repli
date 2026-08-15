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

  const adapter = {
    driver: driver.name,

    onMessage(fn) {
      handler = fn;
      driver.onMessage(fn);
    },

    async start() {
      await driver.start();
    },

    async stop() {
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

    async sendMessage(phone, text) {
      const to = config.normalisePhone(phone);
      if (!to || !text) return;
      try {
        await driver.sendMessage(to, text);
        logger.info('reply.sent', { phone: to, reply: text });
        await messageService.recordOutgoing(to, text, 'text');
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
        await adapter.sendMessage(adminPhone, text);
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
