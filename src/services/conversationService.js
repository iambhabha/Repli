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
  // "What are you looking for?" - asked before any design is shown, so the
  // customer picks the aisle before the shelf.
  SELECT_CATEGORY: 'SELECT_CATEGORY',
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
/**
 * The conversation row, cached for the length of one turn.
 *
 * Measured on a live turn: this row was fetched four to six times per
 * message - by the router, the state machine, the FAQ, the reply composer
 * and the adapter - each one a separate round trip to Supabase at roughly
 * 90ms. That was about a third of the time a customer spent waiting.
 *
 * The window is deliberately tiny. Every write updates the cache, so within
 * a turn it is exact; across turns it is at most two seconds stale, which
 * matters only if the panel takes a conversation over at that exact moment -
 * and then the customer receives one more bot message before it goes quiet.
 */
const CACHE_MS = 2000;
const cache = new Map();

function remember(key, row) {
  cache.set(key, { row, at: Date.now() });
  // The map is per-process and conversations are short; a cap keeps a busy
  // day from holding every customer of the week in memory.
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return row;
}

function forget(phone) {
  cache.delete(config.normalisePhone(phone));
}

async function get(phone) {
  const key = config.normalisePhone(phone);

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.row;

  const row = unwrap(
    await supabase.from('conversations').select('*').eq('phone', key).maybeSingle(),
    'conversations.get'
  );

  return remember(key, row ? { ...row, data: row.data || {} } : EMPTY(key));
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

  const saved = unwrap(
    await supabase.from('conversations').upsert(row, { onConflict: 'phone' }).select('*').single(),
    'conversations.save'
  );

  // The cache is written through, so a read straight after a save sees the
  // save - which is what the state machine does constantly.
  return remember(key, { ...saved, data: saved.data || {} });
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

/**
 * Has this number ever talked to us?
 *
 * Deliberately does not create the row the way get() does - the router asks
 * this before deciding whether a first message is worth answering at all,
 * and creating a conversation for an advert is exactly what it is avoiding.
 */
async function exists(phone) {
  const key = config.normalisePhone(phone);
  if (!key) return false;
  const row = unwrap(
    await supabase.from('conversations').select('id').eq('phone', key).maybeSingle(),
    'conversations.exists'
  );
  return Boolean(row);
}

module.exports = {
  MODE,
  STATES,
  get,
  save,
  setMode,
  getMode,
  reset,
  clearedCart,
  exists,
  forget,
};
