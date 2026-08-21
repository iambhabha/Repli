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
      /**
       * The name the sender set on their own WhatsApp profile.
       *
       * Worth having because the bot can then confirm a name instead of
       * asking for one - it is the difference between "Aapka naam?" and
       * "Rahul hi likh du na?". `notifyName` rides along with the message,
       * so this costs nothing; the Contact lookup is only a fallback.
       */
      pushName: String(message._data?.notifyName || '').trim(),
    };

    /**
     * Status updates and group media are thrown away by the router anyway -
     * downloading them first only wasted bandwidth and logged noisy errors.
     *
     * One attempt, and one quick retry.
     *
     * It was three, spread over more than two seconds, on the theory that
     * WhatsApp needed a moment to have the picture ready. The theory was
     * wrong: across dozens of images not one second or third attempt ever
     * succeeded, so the waiting bought nothing - and when forty-six photos
     * arrived at once it turned into two minutes of the shop doing nothing
     * but waiting to fail.
     *
     * The quick retry stays because it is nearly free. The failure itself is
     * still unexplained ("r", from minified code inside the library) and is
     * worth chasing separately; the caller is written to cope with no
     * picture, so the shop answers either way.
     */
    if (isMedia && !isGroup && !isStatus) {
      const waits = [0, 300];
      for (let attempt = 0; attempt < waits.length; attempt += 1) {
        if (waits[attempt]) await new Promise((done) => setTimeout(done, waits[attempt]));
        try {
          const downloaded = await message.downloadMedia();
          if (downloaded?.data) {
            normalised.media = {
              buffer: Buffer.from(downloaded.data, 'base64'),
              mimetype: downloaded.mimetype || mimetype || 'image/jpeg',
            };
            if (attempt > 0) logger.info('whatsapp.media_retried', { action: `attempt ${attempt + 1}` });
            break;
          }
        } catch (err) {
          if (attempt === waits.length - 1) {
            logger.error('whatsapp.media_failed', { error: err.message, action: `${waits.length} attempts` });
          }
        }
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

      // WhatsApp only accepts a pairing-code request once the login screen is
      // up, and 'qr' is the event that tells us it is. Ask once: asking again
      // on every refresh would invalidate the code the owner is still typing.
      let pairingAsked = false;

      client.on('qr', async (qr) => {
        if (config.WA_PAIRING_NUMBER && !pairingAsked) {
          pairingAsked = true;
          try {
            const code = await client.requestPairingCode(config.WA_PAIRING_NUMBER);
            const pretty = String(code).replace(/(.{4})(?=.)/g, '$1-');
            console.log(
              `\n🔑 Pairing code: ${pretty}\n` +
                `   On WhatsApp (+${config.WA_PAIRING_NUMBER}): Linked devices >\n` +
                '   Link a device > "Link with phone number instead" > enter this code.\n' +
                '   (Valid for about 3 minutes. Restart the bot for a new one.)\n'
            );
            logger.info('whatsapp.pairing_code', { phone: config.WA_PAIRING_NUMBER });
            // Fall through: the QR is printed too, so whoever is watching can
            // use whichever is easier. Both link the same account.
          } catch (err) {
            pairingAsked = false;
            logger.warn('whatsapp.pairing_failed', { error: String(err && err.message) });
            console.warn(
              `\n⚠️  Could not get a pairing code (${err && err.message}) - use the QR below.\n`
            );
          }
        }

        console.log('\n📱 QR code - WhatsApp > Linked devices > Link a device:\n');
        qrcode.generate(qr, { small: true });
        console.log('\n(Refreshes every ~20 seconds - always scan the newest one.)\n');
      });

      client.on('authenticated', () => {
        logger.info('whatsapp.authenticated', {});
        console.log('🔐 Scanned. Saving the session…');
      });

      client.on('auth_failure', (message) => {
        connected = false;
        logger.error('whatsapp.auth_failed', { error: String(message) });
        console.error(`\n❌ Login failed: ${message}\n   Delete .wa-session/ and try again.\n`);
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

    /**
     * Blue ticks.
     *
     * Chat.sendSeen() is `client.sendSeen(this.id)` with a chat lookup in
     * front of it, and that lookup is the part that fails on a @lid chat.
     * Calling the client method directly removes one way to fail.
     *
     * The remaining one cannot be removed here: the injected sendSeen does
     * its own getChat and answers false when it finds nothing. That used to
     * be swallowed, which is how read receipts could be broken for weeks
     * without anybody knowing. It is logged now.
     */
    async markAsRead(messageId, phone) {
      if (!client) return;
      const chatId = await resolveChatId(phone);
      const seen = await client.sendSeen(chatId).catch((err) => {
        logger.warn('read.failed', { phone, action: chatId, error: err.message });
        return false;
      });
      if (!seen) logger.warn('read.no_chat', { phone, action: chatId });
    },

    /**
     * Show or clear "typing…".
     *
     * Chat.sendStateTyping() and Chat.clearState() are both in
     * whatsapp-web.js 1.34.7 - checked, not assumed. Same shape as
     * markAsRead above: resolve the chat, call the method, swallow anything
     * that goes wrong. A presence update is a courtesy and must never be the
     * reason a reply does not go out.
     */
    async setTyping(phone, on) {
      if (!client || !client.pupPage) return;

      const chatId = await resolveChatId(phone);

      /**
       * Sent straight through the injected bridge, with no chat lookup.
       *
       * This used to go through Chat.sendStateTyping(), which meant fetching
       * a Chat first - and on a real phone that step is exactly what broke.
       * WhatsApp addresses this shop's customers by LID now, and every
       * single turn logged:
       *
       *   typing.no_chat  66451885056088@lid  error="r"
       *
       * getChatById() cannot resolve a @lid chat in whatsapp-web.js 1.34.7,
       * so the code returned before it ever asked for a presence. Typing
       * never appeared on anybody's phone, and the diagnostics added earlier
       * are the only reason that was findable at all.
       *
       * The Chat object was never needed. Chat.sendStateTyping() is one line
       * - `WWebJS.sendChatstate('typing', this.id)` - and clearState() the
       * same with 'stop'. sendChatstate builds a WID and calls the chat
       * state bridge; it reads no collection and needs no chat to exist,
       * which is why it works for @lid and @c.us alike. So the lookup that
       * added nothing but a way to fail is gone.
       *
       * Failures are still logged and never thrown: a presence update is a
       * courtesy, and a reply must go out either way.
       */
      try {
        await client.pupPage.evaluate(
          (id, composing) => window.WWebJS.sendChatstate(composing ? 'typing' : 'stop', id),
          chatId,
          Boolean(on)
        );
      } catch (err) {
        logger.warn('typing.presence_failed', {
          phone,
          action: `${on ? 'on' : 'off'} ${chatId}`,
          error: err.message,
        });
      }
    },
  };
};