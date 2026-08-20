'use strict';

/** Customers. Phone is always normalised, so one human = one row. */

const { supabase, unwrap } = require('../db/supabase');
const config = require('../config');

const DETAIL_FIELDS = ['name', 'address', 'city', 'state', 'pin'];

/**
 * The customer row, cached briefly.
 *
 * Fetched two to four times per message - once to ensure the row exists,
 * again to offer a saved address, again when an order is built. At ~90ms a
 * round trip that was real time a customer spent watching "typing...".
 * Writes go through saveDetails(), which refreshes the entry.
 */
const CACHE_MS = 2000;
const cache = new Map();

function remember(key, row) {
  cache.set(key, { row, at: Date.now() });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return row;
}

async function getByPhone(phone) {
  const key = config.normalisePhone(phone);
  if (!key) return null;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.row;

  const row = unwrap(
    await supabase.from('customers').select('*').eq('phone', key).maybeSingle(),
    'customers.getByPhone'
  );
  return remember(key, row || null);
}

async function ensure(phone) {
  const key = config.normalisePhone(phone);
  const existing = await getByPhone(key);
  if (existing) return existing;

  return remember(
    key,
    unwrap(
      await supabase.from('customers').insert({ phone: key }).select('*').single(),
      'customers.ensure'
    )
  );
}

/**
 * Save delivery details. Only non-empty values overwrite what we already
 * know, so a partial update never wipes a saved address.
 */
async function saveDetails(phone, details = {}) {
  const key = config.normalisePhone(phone);
  const existing = await ensure(key);

  const patch = {};
  for (const field of DETAIL_FIELDS) {
    const value = details[field];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      patch[field] = String(value).trim();
    }
  }
  if (!Object.keys(patch).length) return existing;

  return remember(
    key,
    unwrap(
      await supabase.from('customers').update(patch).eq('phone', key).select('*').single(),
      'customers.saveDetails'
    )
  );
}

/** True when we know everything needed to ship an order. */
function hasFullAddress(customer) {
  return Boolean(customer && DETAIL_FIELDS.every((field) => customer[field]));
}

function addressOf(customer) {
  if (!customer) return null;
  const out = {};
  for (const field of DETAIL_FIELDS) out[field] = customer[field] || '';
  return out;
}

module.exports = {
  DETAIL_FIELDS,
  getByPhone,
  ensure,
  saveDetails,
  hasFullAddress,
  addressOf,
};
