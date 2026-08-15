'use strict';

/**
 * Orders and their lifecycle.
 *
 * Stock is NEVER touched here except through confirm_order_payment(), the
 * Postgres function that verifies payment, confirms the order, decreases
 * stock and flips the conversation to HUMAN - all in one transaction.
 */

const { supabase, unwrap } = require('../db/supabase');
const config = require('../config');
const logger = require('../logger');
const customerService = require('./customerService');
const productService = require('./productService');

const STATUS = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PAYMENT_VERIFYING: 'PAYMENT_VERIFYING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
};

const OPEN_STATUSES = [STATUS.PENDING_PAYMENT, STATUS.PAYMENT_VERIFYING];

const ORDER_SELECT = '*, order_items(*), payments(*)';

/** Order ids come from a Postgres sequence, so they can never collide. */
async function nextOrderId() {
  const data = unwrap(
    await supabase.rpc('next_order_id', { p_prefix: config.ORDER_PREFIX }),
    'orders.nextOrderId'
  );
  return data;
}

/**
 * Create a PENDING_PAYMENT order from the conversation draft.
 * Item rows snapshot name/colour/size/price so later price edits never
 * rewrite history.
 */
async function create(phone, draft) {
  const key = config.normalisePhone(phone);
  const product = await productService.getById(draft.productId);
  if (!product) throw new Error(`Unknown product ${draft.productId}`);

  const variant = await productService.getVariantById(draft.variantId);
  const quantity = Math.max(1, Math.floor(Number(draft.quantity) || 1));
  const unitPrice = productService.priceOf(product);
  const subtotal = unitPrice * quantity;
  const shipping = Math.max(0, Math.floor(config.SHIPPING_CHARGE));
  const total = subtotal + shipping;

  const customer = await customerService.saveDetails(key, draft);
  const orderId = await nextOrderId();

  const order = unwrap(
    await supabase
      .from('orders')
      .insert({
        order_id: orderId,
        customer_id: customer.id,
        phone: key,
        status: STATUS.PENDING_PAYMENT,
        customer_name: draft.name || null,
        address: draft.address || null,
        city: draft.city || null,
        state: draft.state || null,
        pin: draft.pin || null,
        subtotal,
        shipping,
        total,
      })
      .select('*')
      .single(),
    'orders.create'
  );

  unwrap(
    await supabase.from('order_items').insert({
      order_id: order.id,
      product_id: product.id,
      variant_id: variant ? variant.id : null,
      product_name_snapshot: product.name,
      color_snapshot: variant ? variant.color : draft.color || null,
      size_snapshot: variant ? variant.size : draft.size || null,
      unit_price: unitPrice,
      quantity,
      subtotal,
    }),
    'order_items.create'
  );

  unwrap(
    await supabase.from('payments').insert({
      order_id: order.id,
      amount: total,
      status: 'PENDING',
    }),
    'payments.create'
  );

  logger.info('order.created', { phone: key, orderId: order.order_id });
  return getByOrderId(order.order_id);
}

async function getByOrderId(orderId) {
  const key = String(orderId || '').trim().toUpperCase();
  if (!key) return null;
  const data = unwrap(
    await supabase.from('orders').select(ORDER_SELECT).eq('order_id', key).maybeSingle(),
    'orders.getByOrderId'
  );
  return data || null;
}

async function getById(id) {
  if (!id) return null;
  const data = unwrap(
    await supabase.from('orders').select(ORDER_SELECT).eq('id', id).maybeSingle(),
    'orders.getById'
  );
  return data || null;
}

/** Latest order of this customer still waiting for money or verification. */
async function openFor(phone) {
  const key = config.normalisePhone(phone);
  const rows = unwrap(
    await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .eq('phone', key)
      .in('status', OPEN_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1),
    'orders.openFor'
  );
  return rows && rows.length ? rows[0] : null;
}

async function recent(limit = 10) {
  return (
    unwrap(
      await supabase
        .from('orders')
        .select(ORDER_SELECT)
        .order('created_at', { ascending: false })
        .limit(limit),
      'orders.recent'
    ) || []
  );
}

async function setStatus(orderUuid, status) {
  return unwrap(
    await supabase.from('orders').update({ status }).eq('id', orderUuid).select('*').single(),
    'orders.setStatus'
  );
}

/** Customer typed "cancel" - close whatever order is still open. */
async function cancelOpen(phone) {
  const order = await openFor(phone);
  if (!order) return null;
  await setStatus(order.id, STATUS.CANCELLED);
  logger.info('order.cancelled', {
    phone: config.normalisePhone(phone),
    orderId: order.order_id,
  });
  return getByOrderId(order.order_id);
}

/**
 * /paid - the ONLY path that confirms an order and decreases stock.
 * All four steps happen inside one Postgres transaction.
 */
async function confirmPayment(orderId, adminPhone) {
  const result = unwrap(
    await supabase.rpc('confirm_order_payment', {
      p_order_id: String(orderId || '').toUpperCase(),
      p_admin_phone: config.normalisePhone(adminPhone),
    }),
    'orders.confirmPayment'
  );

  if (result && result.ok) {
    productService.invalidate(); // stock moved
    logger.info('order.confirmed', {
      orderId: result.order_id,
      phone: result.phone,
      action: `verified_by=${config.normalisePhone(adminPhone)}`,
    });
  }
  return result;
}

/** /reject - payment failed. Stock is deliberately untouched. */
async function rejectPayment(orderId, adminPhone) {
  const result = unwrap(
    await supabase.rpc('reject_order_payment', {
      p_order_id: String(orderId || '').toUpperCase(),
      p_admin_phone: config.normalisePhone(adminPhone),
    }),
    'orders.rejectPayment'
  );
  if (result && result.ok) {
    logger.info('order.rejected', { orderId: result.order_id, phone: result.phone });
  }
  return result;
}

/** The single line item of a v1 order (one product per order). */
function itemOf(order) {
  return order && order.order_items && order.order_items.length ? order.order_items[0] : null;
}

function paymentOf(order) {
  if (!order || !order.payments || !order.payments.length) return null;
  return order.payments
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
}

module.exports = {
  STATUS,
  OPEN_STATUSES,
  nextOrderId,
  create,
  getByOrderId,
  getById,
  openFor,
  recent,
  setStatus,
  cancelOpen,
  confirmPayment,
  rejectPayment,
  itemOf,
  paymentOf,
};
