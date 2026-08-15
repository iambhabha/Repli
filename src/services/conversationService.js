'use strict';

/**
 * Conversation state + mode, one row per normalised phone number.
 * Two customers can never share or overwrite each other's state.
 */

const { supabase, unwrap } = require('../db/supabase');
const config = require('../config');
const logger = require('../logger');
const customerService = require('./customerService');

const MODE = { BOT: 'BOT', HUMAN: 'HUMAN' };

const STATES = {
  START: 'START',
  SELECT_PRODUCT: 'SELECT_PRODUCT',
  SELECT_COLOR: 'SELECT_COLOR',
  SELECT_SIZE: 'SELECT_SIZE',
  SELECT_QUANTITY: 'SELECT_QUANTITY',
  COLLECT_DETAILS: 'COLLECT_DETAILS',
  ORDER_SUMMARY: 'ORDER_SUMMARY',
  WAITING_FOR_PAYMENT: 'WAITING_FOR_PAYMENT',
  PAYMENT_VERIFYING: 'PAYMENT_VERIFYING',
  CONFIRMED: 'CONFIRMED',
  HUMAN_HANDOFF: 'HUMAN_HANDOFF',
  CANCELLED: 'CANCELLED',
};

const EMPTY = (phone) => ({
  phone,
  state: STATES.START,
  mode: MODE.BOT,
  selected_product_id: null,
  selected_variant_id: null,
  quantity: null,
  current_order_id: null,
  data: {},
});

/** Read the conversation, creating nothing. Returns a default row if absent. */
async function get(phone) {
  const key = config.normalisePhone(phone);
  const row = unwrap(
    await supabase.from('conversations').select('*').eq('phone', key).maybeSingle(),
    'conversations.get'
  );
  if (!row) return EMPTY(key);
  return { ...row, data: row.data || {} };
}

/**
 * Write the conversation. `patch` may contain any column plus `data`.
 * Creates the row (and the customer) on first write.
 */
async function save(phone, patch = {}) {
  const key = config.normalisePhone(phone);
  const customer = await customerService.ensure(key);

  const row = {
    phone: key,
    customer_id: customer.id,
    ...patch,
  };
  if (row.data !== undefined) row.data = row.data || {};

  return unwrap(
    await supabase.from('conversations').upsert(row, { onConflict: 'phone' }).select('*').single(),
    'conversations.save'
  );
}

async function setMode(phone, mode) {
  const key = config.normalisePhone(phone);
  await save(key, { mode });
  logger.info('conversation.mode', { phone: key, action: mode });
}

async function getMode(phone) {
  return (await get(phone)).mode;
}

/** Back to START with an empty cart. Saved address stays in `customers`. */
async function reset(phone) {
  const key = config.normalisePhone(phone);
  await save(key, {
    state: STATES.START,
    mode: MODE.BOT,
    selected_product_id: null,
    selected_variant_id: null,
    quantity: null,
    current_order_id: null,
    data: {},
  });
  logger.info('conversation.reset', { phone: key });
}

/** Clear the cart but keep the mode - used by "menu" / "cancel". */
function clearedCart(extra = {}) {
  return {
    selected_product_id: null,
    selected_variant_id: null,
    quantity: null,
    current_order_id: null,
    data: {},
    ...extra,
  };
}

module.exports = { MODE, STATES, get, save, setMode, getMode, reset, clearedCart };
