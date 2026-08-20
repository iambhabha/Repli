'use strict';

/**
 * open-wa driver (@open-wa/wa-automate).
 * Contains no business logic - only connection + message normalisation.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../logger');
const { MIME_BY_EXT } = require('./adapter');
const { resolveChromePath } = require('./browser');

const chatIdFor = (phone) => `${config.normalisePhone(phone)}@c.us`;

function mimeFor(filePath) {
  return MIME_BY_EXT[path.extname(filePath).toLowerCase()] || 'image/jpeg';
}

function toDataUrl(filePath) {
  return `data:${mimeFor(filePath)};base64,${fs.readFileSync(filePath).toString('base64')}`;
}

module.exports = function openwaDriver() {
  let client = null;
  let connected = false;
  let handler = () => {};

  function normalise(message, decryptMedia) {
    const from = String(message.from || '');
    const isGroup = Boolean(message.isGroupMsg) || from.endsWith('@g.us');
    const isStatus = from === 'status@broadcast';

    // payment proofs arrive as images, sometimes as PDF bank receipts
    const hasMedia = Boolean(message.isMedia || message.isMMS);
    const mimetype = String(message.mimetype || '').toLowerCase();
    const isMedia = hasMedia && (mimetype.startsWith('image') || mimetype === 'application/pdf');

    return {
      id: message.id,
      phone: config.normalisePhone(from.split('@')[0]),
      // for media, `body` holds the base64 payload - only the caption is text
      text: hasMedia ? message.caption || '' : message.body || message.text || '',
      isMedia,
      isGroup,
      isStatus,
      fromMe: Boolean(message.fromMe),
      type: message.type || (hasMedia ? 'media' : 'chat'),
      mimetype: message.mimetype,
      timestamp: message.timestamp || message.t || null,
      async loadMedia() {
        if (!isMedia) return null;
        return { buffer: await decryptMedia(message), mimetype: message.mimetype };
      },
    };
  }

  return {
    name: 'openwa',

    onMessage(fn) {
      handler = fn;
    },

    isConnected() {
      return connected;
    },

    async start() {
      const { create, decryptMedia } = require('@open-wa/wa-automate');

      logger.info('whatsapp.starting', { action: 'openwa' });
      console.log(
        config.WA_HEADLESS
          ? '\nQR code neeche aayega - WhatsApp > Linked Devices se scan karo.' +
              '\n(QR na aaye toh .env me WA_HEADLESS=false karke dobara chalao.)\n'
          : '\nChrome ki window khulegi - usme QR aayega.' +
              '\nWhatsApp > Linked Devices > Link a device se scan karo.\n'
      );

      /**
       * Bind listeners to a client. open-wa calls this again with a fresh
       * client after a crash (restartOnCrash), so reconnects keep working.
       */
      async function attach(newClient) {
        if (!newClient) {
          connected = false;
          logger.error('whatsapp.restart_failed', { error: 'no client after restart' });
          return;
        }
        client = newClient;
        connected = true;

        await client.onStateChanged((state) => {
          logger.info('whatsapp.state', { action: state });
          connected = state === 'CONNECTED';
          if (state === 'CONFLICT' || state === 'UNLAUNCHED') {
            client.forceRefocus().catch(() => {});
          }
        });

        await client.onMessage(async (message) => {
          try {
            const normalised = normalise(message, decryptMedia);
            if (normalised.isMedia) {
              normalised.media = await normalised.loadMedia().catch((err) => {
                logger.error('whatsapp.media_failed', { error: err.message });
                return null;
              });
            }
            await handler(normalised);
          } catch (err) {
            logger.error('whatsapp.on_message_failed', { error: err.message });
          }
        });

        const host = await client.getHostNumber().catch(() => 'unknown');
        logger.info('whatsapp.ready', { phone: host });
        console.log(`\n✅ Repli connected as ${host}\n`);
      }

      const chromePath = resolveChromePath();
      if (chromePath) {
        logger.info('whatsapp.browser', { action: chromePath });
        console.log(`🌐 Browser: ${chromePath}\n`);
      } else {
        console.warn(
          [
            '⚠️  System me Chrome/Chromium nahi mila - puppeteer apna browser use karega.',
            '   Agar "Browser was not found" error aaye toh in me se ek karo:',
            '     Windows/Mac : Chrome install karo, ya .env me CHROME_PATH=<chrome ka path>',
            '     Linux/VPS   : sudo apt install -y chromium-browser',
            '                   phir .env me CHROME_PATH=/usr/bin/chromium-browser',
            '     Ya phir     : npx puppeteer browsers install chrome',
            '',
          ].join('\n')
        );
      }

      await attach(
        await create({
          sessionId: config.SESSION_ID,
          sessionDataPath: config.SESSION_DIR,
          multiDevice: true,
          // Only set when we actually found one; otherwise open-wa keeps its
          // own default and nothing changes.
          ...(chromePath ? { useChrome: true, executablePath: chromePath } : {}),
          headless: config.WA_HEADLESS,
          qrTimeout: 0,
          authTimeout: 0,
          autoRefresh: true,
          cachedPatch: true,
          disableSpins: true,
          blockCrashLogs: true,
          logConsole: false,
          popup: false,
          throwErrorOnTosBlock: false,
          killProcessOnBrowserClose: true,
          restartOnCrash: attach,
        })
      );
    },

    async stop() {
      connected = false;
      if (client) await client.kill().catch(() => {});
    },

    sendMessage(phone, text) {
      return client.sendText(chatIdFor(phone), text);
    },

    sendMedia(phone, filePath, caption) {
      const chatId = chatIdFor(phone);
      const name = path.basename(filePath);
      const dataUrl = toDataUrl(filePath);
      return mimeFor(filePath).startsWith('image')
        ? client.sendImage(chatId, dataUrl, name, caption || '')
        : client.sendFile(chatId, dataUrl, name, caption || '');
    },

    /**
     * @open-wa exposes simulateTyping(chatId, boolean). Feature-detected
     * rather than assumed: this driver is kept for reference and no longer
     * connects, so nothing here may depend on an API being present.
     */
    setTyping(phone, on) {
      if (!client || typeof client.simulateTyping !== 'function') return Promise.resolve();
      return Promise.resolve(client.simulateTyping(chatIdFor(phone), Boolean(on))).catch(() => {});
    },

    markAsRead(messageId, phone) {
      if (!client || !client.sendSeen) return Promise.resolve();
      return client.sendSeen(chatIdFor(phone));
    },
  };
};
