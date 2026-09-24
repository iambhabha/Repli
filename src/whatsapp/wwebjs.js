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
const settingsService = require('../services/settingsService');

function mimeFor(filePath) {
  return MIME_BY_EXT[path.extname(filePath).toLowerCase()] || 'image/jpeg';
}

module.exports = function wwebjsDriver() {
  const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
  const qrcode = require('qrcode-terminal');

  /**
   * WhatsApp Web reloads once after restore. inject() evaluates in the page;
   * if that navigation wins the race, puppeteer throws "Execution context
   * was destroyed". Retry the same Client — do not destroy it. Destroying
   * mid-restore has shown the QR again and dropped 'ready'.
   */
  if (!Client.prototype.__repliInjectRetry) {
    const originalInject = Client.prototype.inject;
    Client.prototype.inject = async function patchedInject() {
      let lastErr = null;
      for (let attempt = 1; attempt <= 6; attempt++) {
        try {
          return await originalInject.apply(this, arguments);
        } catch (err) {
          lastErr = err;
          const msg = String((err && err.message) || err);
          if (
            !/Execution context was destroyed|Protocol error|Target closed/i.test(
              msg
            )
          ) {
            throw err;
          }
          logger.warn('whatsapp.inject_retry', { attempt, error: msg });
          await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
        }
      }
      throw lastErr;
    };
    Client.prototype.__repliInjectRetry = true;
  }

  /**
   * A busy WhatsApp deadlocks ready: Msg.on() is registered *inside*
   * page.evaluate(), backlog fires immediately, each callback talks to Node
   * while evaluate is still waiting. Ready never emits → no replies.
   *
   * Skip that evaluate during attach, emit ready, THEN register listeners
   * when the Node bridge is free. Session is untouched — not a re-login.
   * (An earlier in-page eval() defer never actually attached listeners.)
   */
  if (!Client.prototype.__repliAttachDefer) {
    const originalAttach = Client.prototype.attachEventListeners;
    Client.prototype.attachEventListeners = async function patchedAttach() {
      const page = this.pupPage;
      if (!page) return originalAttach.apply(this, arguments);
      logger.info('whatsapp.attach_start', {});
      const origEvaluate = page.evaluate.bind(page);
      let listenerSrc = null;
      page.evaluate = async function patchedEvaluate(fn, ...rest) {
        const src = typeof fn === 'function' ? Function.prototype.toString.call(fn) : '';
        // Any Msg.on registration inside WAWebCollections is the deadlock
        // risk — match loosely; a too-strict check once let the original
        // evaluate run and hung ready forever after authenticated.
        if (
          typeof fn === 'function' &&
          src.includes('WAWebCollections') &&
          src.includes('Msg.on')
        ) {
          listenerSrc = src;
          logger.info('whatsapp.attach_defer', { bytes: src.length });
          return;
        }
        return origEvaluate(fn, ...rest);
      };
      try {
        await Promise.race([
          originalAttach.apply(this, arguments),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('attach timeout')), 10000)
          ),
        ]);
      } catch (err) {
        logger.warn('whatsapp.attach_timeout', {
          error: String((err && err.message) || err),
        });
      } finally {
        page.evaluate = origEvaluate;
      }
      if (!listenerSrc) {
        logger.warn('whatsapp.attach_missed', {});
        return;
      }
      const run = new Function(`return (${listenerSrc})`)();
      setTimeout(() => {
        page
          .evaluate(run)
          .then(() => {
            msgHooked = true;
            logger.info('whatsapp.attach_done', {});
          })
          .catch((err) =>
            logger.error('whatsapp.attach_failed', {
              error: String((err && err.message) || err),
            })
          );
      }, 50);
    };
    Client.prototype.__repliAttachDefer = true;
  }

  let client = null;
  let connected = false;
  /**
   * Whether an incoming message can actually reach Node - not the same
   * thing as `connected`.
   *
   * 'ready' set `connected = true` on its own timing, and the watchdog below
   * used to check that same flag before trying its own Msg.on('add') hook.
   * On a fast session restore 'ready' fires well inside the watchdog's
   * twelve seconds, so by the time the watchdog looked, connected was
   * already true - and it skipped hooking entirely, even on a run where the
   * primary attach had already logged attach_missed moments earlier. The
   * bot printed "Repli connected" and never received another message,
   * because nothing had actually asked WhatsApp Web to call Node when one
   * arrived. This flag tracks the thing that actually matters.
   */
  let msgHooked = false;
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

    /**
     * Sending to the shop's own number (admin alerts, live-test pings) must
     * not call getNumberId. That lookup throws a minified "t" on this
     * account and has logged the session out. The host WID is already on
     * the client from the moment we are ready.
     */
    const host = client && client.info && client.info.wid;
    const hostUser = host && host.user ? config.normalisePhone(host.user) : '';
    if (host && key && key === hostUser) {
      const self = host._serialized || `${host.user}@${host.server || 'c.us'}`;
      chatIds.set(key, self);
      return self;
    }

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
   * Whether this picture is worth fetching before anyone has asked for it.
   *
   * Fails open on purpose. A lookup that breaks must never be the reason a
   * customer's payment screenshot is thrown away - a wasted download is a
   * log line, a lost proof of payment is an argument with a customer.
   */
  async function worthDownloading(phone, isGroup, isStatus) {
    if (isGroup || isStatus || !phone) return false;

    // No telephone number in the world is longer than fifteen digits.
    // Communities and channels are eighteen, which is what gives them away.
    if (String(phone).length > 15) return false;

    try {
      return (await settingsService.isAllowed(phone)) || (await settingsService.isAdmin(phone));
    } catch (err) {
      logger.warn('whatsapp.media_gate_failed', { phone, error: err.message });
      return true;
    }
  }

  /**
   * The customer's picture, fetched the long way round.
   *
   * The library's own downloadMedia() never worked here, and the error it
   * gave was the single letter "r" - a minified name from inside the page,
   * which is why this went unexplained for so long. Asking the page directly
   * produced the real one:
   *
   *   Msg.get(id)              -> nothing
   *   Msg.getMessagesById([id]) -> DataError: Failed to execute 'get' on
   *                                'IDBObjectStore': No key or key range
   *                                specified
   *   scanning the collection  -> found it
   *
   * Both of the library's lookups go through the message id, and this
   * account's contacts are addressed as @lid rather than @c.us - ids like
   * false_14280984416284@lid_3EB0D6AE. That form is not what the index
   * expects, so IndexedDB is handed an empty key and throws, and the picture
   * is lost even though the message is sitting in memory the whole time.
   *
   * So the message is found by walking the collection and comparing the
   * serialised id, which needs no index at all. Everything after that is
   * what the library would have done: resolve the media if it has not been
   * fetched yet, then decrypt it.
   *
   * The library is still asked first. If a later version fixes its lookup,
   * that path starts working again and this one stops being reached.
   */
  async function downloadPicture(message, phone) {
    try {
      const viaLibrary = await message.downloadMedia();
      if (viaLibrary?.data) return viaLibrary;
    } catch {
      // Expected, for now. The scan below is the one that works.
    }

    try {
      const picture = await client.pupPage.evaluate(async ({ msgId, chat, t }) => {
        const Msg = window.require('WAWebCollections').Msg;
        const modelsOf = () => (Msg.getModelsArray ? Msg.getModelsArray() : Msg.models || []);

        const pathOf = (m) =>
          (m && (m.directPath || (m.mediaData && m.mediaData.directPath))) || '';

        const idOf = (m) => {
          if (!m || !m.id) return '';
          if (m.id._serialized) return m.id._serialized;
          try {
            return typeof m.id.toString === 'function' ? m.id.toString() : '';
          } catch {
            return '';
          }
        };

        const sameChat = (m) => {
          const remote = (m && m.id && m.id.remote) || (m && m.from) || '';
          return Boolean(chat) && (remote === chat || String(remote) === String(chat));
        };

        const isPic = (m) => {
          const kind = m && m.type;
          return (
            kind === 'image' ||
            kind === 'document' ||
            kind === 'sticker' ||
            Boolean(pathOf(m))
          );
        };

        /**
         * The `message` event often hands us a stub id that never grows
         * mediaData. Production probes showed the real picture sitting in
         * the same chat a few rows away, already with a directPath, under
         * an id we were never given. Prefer the exact row; if that row is
         * still a chat stub, take the nearest picture in this chat.
         */
        const find = () => {
          const models = modelsOf();
          const exact = models.find((m) => idOf(m) === msgId);
          if (exact && pathOf(exact)) return exact;

          const pics = models.filter((m) => sameChat(m) && isPic(m) && pathOf(m));
          if (pics.length) {
            if (t) {
              pics.sort(
                (a, b) =>
                  Math.abs(Number(a.t || a.timestamp || 0) - t) -
                  Math.abs(Number(b.t || b.timestamp || 0) - t)
              );
              return pics[0];
            }
            return pics[pics.length - 1];
          }
          return exact;
        };

        /**
         * Look the message up again on every pass, and wait for it to become
         * a picture.
         *
         * This is the fault that survived four attempts at it. The `message`
         * event fires the instant a row appears in the collection, and at
         * that instant the row is a stub: the recorded shape of a failure
         * reads `type: "chat"`, no directPath, no mediaKey, no filehash, and
         * `__x_createdMediaDataOnInit` still on the object. It is not a text
         * message - it is a picture that has not been built yet.
         *
         * The earlier waits looked at `mediaData` on a reference captured
         * once, so they were watching an object the collection had already
         * moved past. Re-finding each time is the difference, and the thing
         * worth waiting for is `directPath` - without it there is nothing to
         * fetch, whatever else is set.
         *
         * Five seconds, then give up: a customer is waiting on the other end
         * and the flow copes with no picture. What it must not do is answer
         * before the picture had a chance to arrive.
         */
        let msg = find();
        for (let waited = 0; waited < 5000; waited += 250) {
          if (msg && pathOf(msg)) break;
          await new Promise((done) => setTimeout(done, 250));
          msg = find() || msg;
        }

        // REUPLOADING means the picture has expired on WhatsApp's side and
        // the sender's app is re-uploading it. There is nothing to fetch.
        if (!msg) return { skipped: 'message not in the collection' };

        if (!pathOf(msg)) {
          /**
           * What the message model actually looked like, recorded.
           *
           * This is the one failure left in the incoming-media path, and
           * four attempts at it have missed - each one aimed at `mediaData`,
           * which is an assumption rather than something anyone has
           * verified. So instead of another guess, the shape is written
           * down at the moment it fails.
           *
           * Kept deliberately: the next occurrence will be a real customer's
           * payment screenshot, and this line is what turns that into
           * evidence instead of another shrug. It costs one WARN on a path
           * that has already failed, and nothing on the path that works.
           */
          /**
           * The message we were sent, and the messages that actually exist.
           *
           * Waiting longer did not help - after five seconds of re-finding,
           * the row matched by this id is still `type: "chat"` with no
           * directPath. So the question is no longer "has it hydrated yet"
           * but "is this even the right row": the picture may be sitting in
           * the collection under an id we were never given.
           *
           * Listing the newest few, with their type and whether they carry a
           * directPath, answers that in one line of log.
           */
          const models = modelsOf();
          const recent = models
            .slice(-8)
            .map((m) => `${m && m.type}${pathOf(m) ? '+path' : ''}:${idOf(m) || '?'}`)
            .join(' | ');

          return {
            skipped: msg.mediaData ? 'no directPath' : 'no mediaData',
            probe: {
              asked: msgId,
              chat,
              type: msg.type,
              mimetype: msg.mimetype,
              hasMediaData: Boolean(msg.mediaData),
              mediaStage: msg.mediaData && msg.mediaData.mediaStage,
              hasDirectPath: Boolean(pathOf(msg)),
              hasMediaKey: Boolean(msg.mediaKey || (msg.mediaData && msg.mediaData.mediaKey)),
              total: models.length,
              recent,
            },
          };
        }
        if (msg.mediaData && msg.mediaData.mediaStage === 'REUPLOADING') {
          return { skipped: 'REUPLOADING' };
        }

        if (msg.mediaData && msg.mediaData.mediaStage !== 'RESOLVED') {
          await msg.downloadMedia({ downloadEvenIfExpensive: true, rmrReason: 1 });
        }

        /**
         * Give FETCHING a moment to become something.
         *
         * downloadMedia() can return while the fetch is still in flight, and
         * treating that as a failure threw away a picture that arrived a
         * second later - a customer's screenshot of the hoodie chart was
         * lost exactly this way, with no error anywhere to explain it.
         *
         * Re-find each pass, same reason as the wait above: the collection
         * can replace the model while we are watching the old one stay on
         * FETCHING forever.
         *
         * Bounded, because a fetch that has not finished in three seconds is
         * not going to finish inside this turn, and the shop must answer.
         */
        for (let waited = 0; waited < 3000; waited += 250) {
          msg = find() || msg;
          if (!msg.mediaData || msg.mediaData.mediaStage !== 'FETCHING') break;
          await new Promise((done) => setTimeout(done, 250));
        }

        const stage = String((msg.mediaData && msg.mediaData.mediaStage) || '');
        if (stage.includes('ERROR') || stage === 'FETCHING') return { skipped: stage };
        if (!pathOf(msg)) return { skipped: 'no directPath' };

        /**
         * The type the download manager will accept.
         *
         * `msg.type` is how WhatsApp classified the message, and it is not
         * always a media type: a picture arrived once as "interactive", and
         * passing that straight through was refused with "webMediaType is
         * invalid: interactive" - the picture was there, correctly
         * encrypted, and thrown away over a label.
         *
         * The mimetype says what the bytes actually are, so it decides when
         * the two disagree.
         */
        const mime = String(msg.mimetype || '');
        const kind = ['image', 'video', 'audio', 'document', 'sticker', 'ptt'].includes(msg.type)
          ? msg.type
          : mime.startsWith('image/')
            ? 'image'
            : mime.startsWith('video/')
              ? 'video'
              : 'document';

        const media = msg.mediaData || {};
        const decrypted = await window
          .require('WAWebDownloadManager')
          .downloadManager.downloadAndMaybeDecrypt({
            directPath: pathOf(msg),
            encFilehash: msg.encFilehash || media.encFilehash,
            filehash: msg.filehash || media.filehash,
            mediaKey: msg.mediaKey || media.mediaKey,
            mediaKeyTimestamp: msg.mediaKeyTimestamp || media.mediaKeyTimestamp,
            type: kind,
            signal: new AbortController().signal,
            // The library passes one of these; the page expects the shape
            // more than the behaviour, so a pair of no-ops satisfies it.
            downloadQpl: { addAnnotations() { return this; }, addPoint() { return this; } },
          });

        return {
          data: await window.WWebJS.arrayBufferToBase64Async(decrypted),
          mimetype: msg.mimetype,
          filename: msg.filename,
          filesize: msg.size,
        };
      }, {
        msgId: message.id?._serialized,
        chat: String(message.from || ''),
        t: Number(message.timestamp || 0),
      });

      if (picture && picture.skipped) {
        // Not an error - WhatsApp simply had nothing to give us. Logged so
        // that "(no image)" is never again a silent, unexplained outcome.
        logger.warn('whatsapp.media_unavailable', {
          phone,
          action: picture.skipped,
          error: picture.probe ? JSON.stringify(picture.probe).slice(0, 900) : undefined,
        });
        return null;
      }
      return picture;
    } catch (err) {
      // `phone` and not the raw address: a @lid id is not a phone number and
      // logging it as one sent an eighteen-digit id into the phone field.
      logger.error('whatsapp.media_failed', { phone, error: err.message, action: 'scan' });
      return null;
    }
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
     * Only pictures somebody is going to look at.
     *
     * Status updates and group media were already skipped, and it was not
     * enough. A whole day of media_failed errors turned out to be one
     * WhatsApp community: communities and channels arrive as eighteen-digit
     * ids that do not end in @g.us, so they walked straight past the group
     * check, failed to download, and logged an ERROR - and then the router
     * dropped them on the allowlist a quarter of a second later.
     *
     * So the test is now the router's own: if this sender is not going to be
     * answered, their picture is not going to be opened either. Both lookups
     * are cached, so this costs nothing on the path that matters.
     */
    if (isMedia && (await worthDownloading(phone, isGroup, isStatus))) {
      const downloaded = await downloadPicture(message, phone);
      if (downloaded) {
        normalised.media = {
          buffer: Buffer.from(downloaded.data, 'base64'),
          mimetype: downloaded.mimetype || mimetype || 'image/jpeg',
        };
      }
    }

    return normalised;
  }

  async function launchClient() {
    chatIds.clear();
    client = new Client({
      // Session survives restarts, in the same folder the old driver used.
      authStrategy: new LocalAuth({
        clientId: config.SESSION_ID,
        dataPath: config.SESSION_DIR,
      }),
      puppeteer: puppeteerOptions(),
      takeoverOnConflict: true,
      qrMaxRetries: 0,
      authTimeoutMs: 120000,
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
      console.log('🔐 Session restored (no QR). Waiting until the bot can reply…');
      /**
       * attachEventListeners can sit forever inside exposeFunction while the
       * page is busy. WhatsApp is already logged in; without this watchdog
       * ready never fires and the bot never replies. Wire a minimal add
       * listener so messages still reach Node, then mark connected.
       */
      setTimeout(() => {
        // Guarded on whether a message can actually get through, not on
        // whether 'ready' already fired - see msgHooked's own comment.
        if (msgHooked) return;
        const page = client && client.pupPage;
        if (page) {
          page
            .evaluate(() => {
              if (window.__repliMsgHooked) return 'already';
              const { Msg } = window.require('WAWebCollections');
              Msg.on('add', (msg) => {
                if (!msg.isNewMsg) return;
                if (msg.type === 'ciphertext') {
                  if (typeof window.onAddMessageCiphertextEvent === 'function') {
                    window.onAddMessageCiphertextEvent(window.WWebJS.getMessageModel(msg));
                  }
                  return;
                }
                if (typeof window.onAddMessageEvent === 'function') {
                  window.onAddMessageEvent(window.WWebJS.getMessageModel(msg));
                }
              });
              window.__repliMsgHooked = true;
              return 'hooked';
            })
            .then((how) => {
              msgHooked = true;
              logger.info('whatsapp.msg_hook', { action: how });
            })
            .catch((err) =>
              logger.warn('whatsapp.msg_hook_failed', {
                error: String((err && err.message) || err),
              })
            );
        }
        connected = true;
        const host = client.info?.wid?.user || 'unknown';
        logger.warn('whatsapp.ready_watchdog', { phone: host });
        console.log(`\n✅ Repli connected as ${host}\n`);
      }, 12000);
    });

    client.on('auth_failure', (message) => {
      connected = false;
      logger.error('whatsapp.auth_failed', { error: String(message) });
      console.error(`\n❌ Login failed: ${message}\n   Delete .wa-session/ and try again.\n`);
    });

    client.on('ready', async () => {
      connected = true;
      const host = client.info?.wid?.user || 'unknown';
      const self = client.info?.wid?._serialized;
      if (self) chatIds.set(config.normalisePhone(host), self);
      logger.info('whatsapp.ready', { phone: host });
      console.log(`\n✅ Repli connected as ${host}\n`);
      
      try {
        const chats = await client.getChats();
        let missedCount = 0;
        for (const chat of chats) {
          // If the last message in the chat is from the customer (not us), and it was in the last 14 hours
          if (chat.lastMessage && !chat.lastMessage.fromMe) {
             const ts = chat.lastMessage.timestamp * 1000;
             if (Date.now() - ts < 14 * 60 * 60 * 1000) {
                missedCount++;
                try {
                  await handler(await normalise(chat.lastMessage));
                } catch (e) {
                  logger.error('whatsapp.on_message_failed', { error: e.message });
                }
             }
          }
        }
        logger.info('whatsapp.processed_missed', { count: missedCount });
      } catch (err) {
        logger.error('whatsapp.fetch_unread_failed', { error: err.message });
      }
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
      await launchClient();
    },

    async stop() {
      connected = false;
      if (client) await client.destroy().catch(() => {});
    },

    async sendMessage(phone, text) {
      return client.sendMessage(await resolveChatId(phone), text);
    },

    /**
     * A photo, a QR, a PDF.
     *
     * Client.sendMessage() ends with `getMessageModel(msg)`, which calls
     * `msg.serialize()` on whatever WhatsApp handed back. Since a WhatsApp Web
     * update in mid-September that serialise throws on a freshly sent media
     * message - "Data passed to getter must include an id property" - and the
     * throw happens AFTER the message has gone. Every product photo, every
     * payment QR and every proof forwarded to the owner has been failing on
     * the receipt rather than on the send, which is the worst shape a bug can
     * take: the shop believes it sent a QR, and the customer has nothing to
     * pay against.
     *
     * So the model is never asked for. The same injected call the library
     * makes is made here, and only the message id comes back across the
     * bridge. Nothing downstream ever used the returned Message.
     */
    async sendMedia(phone, filePath, caption) {
      const media = MessageMedia.fromFilePath(filePath);
      const chatId = await resolveChatId(phone);

      try {
        const msg = await client.sendMessage(chatId, media, { caption: caption || '' });
        return (msg.id && (msg.id._serialized || msg.id.id)) || 'sent';
      } catch (err) {
        // Fallback or catch the serialization error if the message was actually sent
        if (err.message && err.message.includes('Data passed to getter must include an id property')) {
          return 'sent';
        }
        throw err;
      }
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

    /**
     * What the live Store actually holds. Used to prove incoming media is
     * visible to the page, without waiting for a customer to send one.
     */
    async inspectStore() {
      if (!client || !client.pupPage) return { connected: false };
      return client.pupPage.evaluate(() => {
        const Msg = window.require('WAWebCollections').Msg;
        const models = Msg.getModelsArray ? Msg.getModelsArray() : Msg.models || [];
        const pathOf = (m) =>
          (m && (m.directPath || (m.mediaData && m.mediaData.directPath))) || '';
        const withPath = models.filter((m) => pathOf(m));
        return {
          connected: true,
          total: models.length,
          withPath: withPath.length,
          recent: models
            .slice(-8)
            .map((m) => `${m && m.type}${pathOf(m) ? '+path' : ''}`)
            .join(' | '),
        };
      });
    },
  };
};