'use strict';

/**
 * Payment proof handling.
 *
 * A screenshot is NEVER trusted. It is stored privately on disk, recorded in
 * `payments.proof_url`, and the admin is notified. Only /paid confirms.
 */

const fs = require('fs');
const path = require('path');
const { supabase, unwrap } = require('../db/supabase');
const storage = require('../db/storage');
const config = require('../config');
const logger = require('../logger');
const orderService = require('./orderService');
const settingsService = require('./settingsService');

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

const extensionFor = (mimetype) => EXT_BY_MIME[String(mimetype || '').toLowerCase()] || 'bin';

/**
 * Screenshots stay on the bot's own disk: 0600, outside any web root, and
 * only the path is recorded. They are never uploaded anywhere public.
 */
function saveProofFile(orderId, buffer, mimetype) {
  fs.mkdirSync(config.PROOFS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeId = String(orderId).replace(/[^A-Za-z0-9_-]/g, '');
  const absolute = path.join(config.PROOFS_DIR, `${safeId}_${stamp}.${extensionFor(mimetype)}`);
  fs.writeFileSync(absolute, buffer, { mode: 0o600 });
  return path.relative(config.ROOT, absolute).split(path.sep).join('/');
}

/**
 * ...and a copy goes to the shop's private bucket, so the panel can show it.
 *
 * The bot is on a server and the panel is on Vercel: a path on one machine
 * means nothing on the other, which is why "View proof" has been showing
 * "open the panel on the computer running the bot" since the panel was
 * built. The bucket is private - reading it needs the service role or a
 * short-lived signed URL - so this is not the screenshot becoming public,
 * it is the shop's two halves finally sharing a filing cabinet.
 *
 * Disk stays the primary. If the upload fails the local file is still there
 * and the admin still gets the image on WhatsApp; only the panel's view of
 * it is lost, which is exactly how it behaved before.
 */
async function uploadProof(orderId, buffer, mimetype) {
  const safeId = String(orderId).replace(/[^A-Za-z0-9_-]/g, '');
  const stamp = Date.now();
  const key = `proofs/${safeId}-${stamp}.${extensionFor(mimetype)}`;
  return storage.upload(key, buffer, { contentType: String(mimetype || '') });
}

/**
 * Record the proof: payment PROOF_RECEIVED + order PAYMENT_VERIFYING.
 *
 * `proof_url` still means what it has always meant - a path on the bot's own
 * disk. The bucket reference goes in its own column beside it, so nothing
 * that already reads proof_url has to change and no proof recorded before
 * today stops working.
 */
async function attachProof(order, proofUrl, proofObject = null) {
  const payment = orderService.paymentOf(order);

  if (payment) {
    unwrap(
      await supabase
        .from('payments')
        .update({ status: 'PROOF_RECEIVED', proof_url: proofUrl, proof_object: proofObject })
        .eq('id', payment.id),
      'payments.attachProof'
    );
  } else {
    unwrap(
      await supabase.from('payments').insert({
        order_id: order.id,
        // The booking is what this payment is for; the rest is due later.
        amount: Number(order.booking_amount) > 0 ? Number(order.booking_amount) : order.total,
        status: 'PROOF_RECEIVED',
        proof_url: proofUrl,
        proof_object: proofObject,
      }),
      'payments.insertProof'
    );
  }

  await orderService.setStatus(order.id, orderService.STATUS.PAYMENT_VERIFYING);
  logger.info('payment.proof_attached', { phone: order.phone, orderId: order.order_id });
  return orderService.getByOrderId(order.order_id);
}

/**
 * Full "customer sent a screenshot" flow:
 * store the file -> mark PAYMENT_VERIFYING -> alert the admin with the image.
 */
/**
 * @param {object|null} [seen] what ai/proof.js read off the screenshot, when
 *        it could read anything. Passed to the admin and to nothing else -
 *        it never touches the order or the payment row.
 */
async function handlePaymentProof(bot, order, media, messages, seen = null) {
  let proofUrl = null;
  let proofObject = null;
  let localProof = null;

  if (media && media.buffer && media.buffer.length) {
    try {
      const relative = saveProofFile(order.order_id, media.buffer, media.mimetype);
      localProof = path.join(config.ROOT, relative);
      proofUrl = relative;
    } catch (err) {
      logger.error('payment.proof_save_failed', { orderId: order.order_id, error: err.message });
    }

    /**
     * The reference is what goes in the database when the upload works, so
     * the panel can show the proof from anywhere. The file on disk is kept
     * either way - it is what gets sent to the admin, and it is the copy
     * that survives the bucket being unreachable.
     */
    try {
      proofObject = await uploadProof(order.order_id, media.buffer, media.mimetype);
    } catch (err) {
      logger.warn('payment.proof_upload_failed', {
        orderId: order.order_id,
        error: err.message,
      });
    }
  }

  const updated = (await attachProof(order, proofUrl, proofObject)) || order;

  /**
   * What the screenshot appeared to say, appended for the admin only.
   *
   * The person about to approve this is the one who has to squint at the
   * image, and being told "the picture says 500, the order wants 500" before
   * they open it is most of the work. It is labelled as a reading rather
   * than a fact, because that is what it is, and it decides nothing: the
   * approval still happens by hand.
   *
   * A mismatch is called out rather than buried. Someone paying 50 against a
   * 500 booking is the case this exists to catch early.
   */
  let alert = messages.adminPaymentAlert(updated);
  if (seen) {
    const lines = ['', '— screenshot padha gaya (AI, verify nahi) —'];
    if (!seen.looksLikePayment) lines.push('⚠️ ye payment screenshot nahi lagti');
    lines.push(`amount : ${seen.amount === null ? 'padha nahi gaya' : `₹${seen.amount}`}`);
    if (seen.status) lines.push(`status : ${seen.status}`);
    if (seen.reference) lines.push(`ref    : ${seen.reference}`);
    if (seen.app) lines.push(`app    : ${seen.app}`);

    const expected = Number(updated.booking_amount);
    if (seen.amount !== null && Number.isFinite(expected) && expected > 0 && seen.amount !== expected) {
      lines.push(`⚠️ order ₹${expected} maangta hai, screenshot ₹${seen.amount} dikhati hai`);
    }
    alert += `\n${lines.join('\n')}`;
  }

  // The admin always gets the file itself, from disk when it is there and
  // from the bucket when it is not.
  const forAdmin = localProof || (await storage.localCopy(proofObject).catch(() => null));

  if (forAdmin) {
    await bot.notifyAdminsImage(forAdmin, alert, updated.order_id);
  } else {
    await bot.notifyAdmins(
      `${alert}\n\n(⚠️ screenshot save nahi ho payi - customer se dobara mangwao)`
    );
  }

  logger.info('payment.proof_received', { phone: updated.phone, orderId: updated.order_id });
  return updated;
}

const isPaymentLinkConfigured = () => Boolean(config.PAYMENT_LINK);

/**
 * The shop's UPI scanner, when the owner has uploaded one.
 *
 * The sales memory asks for the official QR rather than a UPI id typed out as
 * text, because a customer paying on a phone scans - they do not retype an id
 * from a chat bubble. The text stays either way: it is the fallback when no
 * QR has been set, and it is what somebody paying from a desktop uses.
 *
 * Deliberately NOT a URL setting. `app_settings.payment_qr` holds a storage
 * reference to the shop's own private bucket, which the bot validates and
 * downloads itself; a URL here would be a URL the bot could be pointed at
 * anything and told to send to a customer.
 *
 * @returns {Promise<string|null>} a local file path, or null
 */
async function paymentQrImage() {
  try {
    const reference = await settingsService.value('payment_qr', null);
    if (!storage.isReference(reference)) return null;
    return storage.localCopy(reference);
  } catch (err) {
    logger.warn('payment.qr_unavailable', { error: err.message });
    return null;
  }
}

module.exports = {
  saveProofFile,
  attachProof,
  handlePaymentProof,
  isPaymentLinkConfigured,
  paymentQrImage,
};
