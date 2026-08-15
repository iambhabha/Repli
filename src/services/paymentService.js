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
const config = require('../config');
const logger = require('../logger');
const orderService = require('./orderService');

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
 * Screenshots stay on the bot's own disk (0600, outside any web root) and
 * only the path is stored. They are never uploaded anywhere public.
 */
function saveProofFile(orderId, buffer, mimetype) {
  fs.mkdirSync(config.PROOFS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeId = String(orderId).replace(/[^A-Za-z0-9_-]/g, '');
  const absolute = path.join(config.PROOFS_DIR, `${safeId}_${stamp}.${extensionFor(mimetype)}`);
  fs.writeFileSync(absolute, buffer, { mode: 0o600 });
  return path.relative(config.ROOT, absolute).split(path.sep).join('/');
}

/** Record the proof: payment PROOF_RECEIVED + order PAYMENT_VERIFYING. */
async function attachProof(order, proofUrl) {
  const payment = orderService.paymentOf(order);

  if (payment) {
    unwrap(
      await supabase
        .from('payments')
        .update({ status: 'PROOF_RECEIVED', proof_url: proofUrl })
        .eq('id', payment.id),
      'payments.attachProof'
    );
  } else {
    unwrap(
      await supabase.from('payments').insert({
        order_id: order.id,
        amount: order.total,
        status: 'PROOF_RECEIVED',
        proof_url: proofUrl,
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
async function handlePaymentProof(bot, order, media, messages) {
  let proofUrl = null;

  if (media && media.buffer && media.buffer.length) {
    try {
      proofUrl = saveProofFile(order.order_id, media.buffer, media.mimetype);
    } catch (err) {
      logger.error('payment.proof_save_failed', { orderId: order.order_id, error: err.message });
    }
  }

  const updated = (await attachProof(order, proofUrl)) || order;
  const alert = messages.adminPaymentAlert(updated);

  if (proofUrl) {
    await bot.notifyAdminsImage(path.join(config.ROOT, proofUrl), alert, updated.order_id);
  } else {
    await bot.notifyAdmins(
      `${alert}\n\n(⚠️ screenshot save nahi ho payi - customer se dobara mangwao)`
    );
  }

  logger.info('payment.proof_received', { phone: updated.phone, orderId: updated.order_id });
  return updated;
}

const isPaymentLinkConfigured = () => Boolean(config.PAYMENT_LINK);

module.exports = { saveProofFile, attachProof, handlePaymentProof, isPaymentLinkConfigured };
