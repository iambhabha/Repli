'use strict';

/**
 * whatsapp-web.js driver.
 *
 * Replaces the open-wa driver, which stopped working: it waits for
 * `window.Debug.VERSION` inside WhatsApp Web, and current WhatsApp Web no
 * longer exposes it. @open-wa/wa-automate has had no release since, so no
 * setting could fix it - the library had to change, not the config.
 *
 * Same contract as every other driver here: connection + message
 * normalisation, no business logic. See src/whatsapp/adapter.js.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../logger');
const { puppeteerOptions } = require('./browser');
const { MIME_BY_EXT } = require('./adapter');

function mimeFor(filePath) {
  return MIME_BY_EXT[path.extname(filePath).toLowerCase()] || 'image/jpeg';
}

module.exports = function wwebjsDriver() {
  const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
  const qrcode = require('qrcode-terminal');

  let client = null;
  let connected = false;
  let handler = () => {};

  /**
   * phone -> the exact chat address to reply to.
   *
   * WhatsApp increasingly delivers messages from a "LID" (`1234567890123@lid`)
   * instead of a phone number, for privacy. That id is NOT a phone number:
   * replying to `<lid>@c.us` fails with "No LID for user". So we keep the
   * address we actually heard from, and reply to that.
   */
  const chatIds = new Map();

  /**
   * The real phone number behind a message, whatever address it arrived on.
   * Repli keys everything - customers, orders, conversations - on the phone
   * number, so this has to be right before anything is written.
   */
  async function resolvePhone(message, from) {
    if (from.endsWith('@c.us')) {
      return config.normalisePhone(from.split('@')[0]);
    }

    // WhatsApp's own LID -> phone number lookup. This is the only reliable
    // source: a LID carries no phone number inside it.
    try {
      const [mapping] = await client.getContactLidAndPhone([from]);
      const phone = config.normalisePhone(String(mapping?.pn || '').split('@')[0]);
      if (phone) return phone;
    } catch (err) {
      logger.warn('whatsapp.lid_lookup_failed', { action: from, error: err.message });
    }

    // Older/edge cases: the contact record sometimes carries the number.
    try {
      const contact = await message.getContact();
      const candidate = contact?.number || contact?.id?.user || '';
      const phone = config.normalisePhone(candidate);
      if (phone && !candidate.includes('@lid')) return phone;
    } catch (err) {
      logger.warn('whatsapp.contact_lookup_failed', { error: err.message });
    }

    /**
     * Deliberately give up rather than guess.
     *
     * Using the LID digits as a phone number is what broke the bypass list:
     * the list holds real numbers, so a LID never matches it and Repli happily
     * sales-pitched a number that was supposed to be silent. Everything here
     * fails closed - an unidentifiable sender gets no reply, no customer row,
     * nothing. Missing one sale beats messaging family.
     */
    logger.error('whatsapp.phone_unresolved', { action: from });
    return '';
  }

  /** The address to send to: the one we heard from, else ask WhatsApp. */
  async function resolveChatId(phone) {
    const key = config.normalisePhone(phone);
    const known = chatIds.get(key);
    if (known) return known;

    try {
      const id = await client.getNumberId(key);
      if (id?._serialized) {
        chatIds.set(key, id._serialized);
        return id._serialized;
      }
    } catch (err) {
      logger.warn('whatsapp.number_lookup_failed', { phone: key, error: err.message });
    }

    return `${key}@c.us`;
  }

  /**
   * whatsapp-web.js message -> the shape the router expects.
   * Media is downloaded here so callers never deal with the library.
   */
  async function normalise(message) {
    const from = String(message.from || '');
    const isGroup = from.endsWith('@g.us');
    const isStatus = from === 'status@broadcast';

    // Payment proofs arrive as images, sometimes as PDF bank receipts.
    const mimetype = String(message._data?.mimetype || '').toLowerCase();
    const isMedia =
      Boolean(message.hasMedia) &&
      (mimetype.startsWith('image') ||
        mimetype === 'application/pdf' ||
        ['image', 'document'].includes(message.type));

    const phone = isGroup || isStatus ? '' : await resolvePhone(message, from);
    if (phone) chatIds.set(phone, from);

    const normalised = {
      id: message.id?._serialized || message.id?.id || null,
      phone,
      // For media the caption is the only text; body holds the caption too.
      text: message.body || '',
      isMedia,
      media: null,
      isGroup,
      isStatus,
      fromMe: Boolean(message.fromMe),
      type: message.type || (isMedia ? 'media' : 'chat'),
      mimetype: mimetype || null,
      timestamp: message.timestamp || null,
    };

    // Status updates and group media are thrown away by the router anyway -
    // downloading them first only wasted bandwidth and logged noisy errors.
    if (isMedia && !isGroup && !isStatus) {
      try {
        const downloaded = await message.downloadMedia();
        if (downloaded?.data) {
          normalised.media = {
            buffer: Buffer.from(downloaded.data, 'base64'),
            mimetype: downloaded.mimetype || mimetype || 'image/jpeg',
          };
        }
      } catch (err) {
        logger.error('whatsapp.media_failed', { error: err.message });
      }
    }

    return normalised;
  }

  return {
    name: 'wwebjs',

    onMessage(fn) {
      handler = fn;
    },

    isConnected() {
      return connected;
    },

    async start() {
      logger.info('whatsapp.starting', { action: 'wwebjs' });

      client = new Client({
        // Session survives restarts, in the same folder the old driver used.
        authStrategy: new LocalAuth({
          clientId: config.SESSION_ID,
          dataPath: config.SESSION_DIR,
        }),
        puppeteer: puppeteerOptions(),
        takeoverOnConflict: true,
        qrMaxRetries: 0,
      });

      client.on('qr', (qr) => {
        console.log('\n📱 QR code - WhatsApp > Linked devices > Link a device se scan karo:\n');
        qrcode.generate(qr, { small: true });
        console.log('\n(QR har 20 second me refresh hota hai - naya wala scan karna.)\n');
      });

      client.on('authenticated', () => {
        logger.info('whatsapp.authenticated', {});
        console.log('🔐 Scan ho gaya, session ban raha hai…');
      });

      client.on('auth_failure', (message) => {
        connected = false;
        logger.error('whatsapp.auth_failed', { error: String(message) });
        console.error(`\n❌ Login fail: ${message}\n   .wa-session/ delete karke dobara try karo.\n`);
      });

      client.on('ready', () => {
        connected = true;
        const host = client.info?.wid?.user || 'unknown';
        logger.info('whatsapp.ready', { phone: host });
        console.log(`\n✅ Repli connected as ${host}\n`);
      });

      client.on('disconnected', (reason) => {
        connected = false;
        logger.warn('whatsapp.disconnected', { action: String(reason) });
        console.warn(`\n⚠️  WhatsApp disconnected: ${reason}\n`);
      });

      // 'message' skips our own outgoing messages, which is what we want:
      // the bot must never answer itself.
      client.on('message', async (message) => {
        try {
          await handler(await normalise(message));
        } catch (err) {
          logger.error('whatsapp.on_message_failed', { error: err.message });
        }
      });

      await client.initialize();
    },

    async stop() {
      connected = false;
      if (client) await client.destroy().catch(() => {});
    },

    async sendMessage(phone, text) {
      return client.sendMessage(await resolveChatId(phone), text);
    },

    async sendMedia(phone, filePath, caption) {
      const media = new MessageMedia(
        mimeFor(filePath),
        fs.readFileSync(filePath).toString('base64'),
        path.basename(filePath)
      );
      return client.sendMessage(await resolveChatId(phone), media, { caption: caption || '' });
    },

    async markAsRead(messageId, phone) {
      if (!client) return;
      const chat = await client.getChatById(await resolveChatId(phone)).catch(() => null);
      if (chat) await chat.sendSeen().catch(() => {});
    },
  };
};