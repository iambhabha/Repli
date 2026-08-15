'use strict';

/**
 * Bypass numbers - personal / family / friend numbers of the owner.
 *
 * This is the most important check in Repli: for an active bypass number the
 * bot does nothing at all. No reply, no state, no order, no notification.
 *
 * Stored in Supabase (not .env) so numbers can be added from WhatsApp
 * without redeploying.
 */

const { supabase, unwrap } = require('../db/supabase');
const config = require('../config');
const logger = require('../logger');

const TTL_MS = 10000;

let cache = null;
let cacheAt = 0;

function invalidate() {
  cache = null;
  cacheAt = 0;
}

async function load() {
  if (cache && Date.now() - cacheAt < TTL_MS) return cache;
  const rows = unwrap(
    await supabase.from('bypass_numbers').select('*').eq('active', true),
    'bypass.load'
  );
  cache = rows || [];
  cacheAt = Date.now();
  return cache;
}

/** Fails closed: if the lookup errors we treat the number as bypassed. */
async function isBypassed(phone) {
  const key = config.normalisePhone(phone);
  if (!key) return false;
  try {
    return (await load()).some((row) => config.normalisePhone(row.phone) === key);
  } catch (err) {
    logger.error('bypass.check_failed', { phone: key, error: err.message });
    return true;
  }
}

async function list() {
  const rows = unwrap(
    await supabase.from('bypass_numbers').select('*').order('created_at', { ascending: true }),
    'bypass.list'
  );
  return rows || [];
}

async function add(phone, name) {
  const key = config.normalisePhone(phone);
  if (!key) return { ok: false, reason: 'INVALID' };

  const existing = unwrap(
    await supabase.from('bypass_numbers').select('*').eq('phone', key).maybeSingle(),
    'bypass.find'
  );

  if (existing && existing.active) return { ok: false, reason: 'EXISTS', phone: key };

  if (existing) {
    unwrap(
      await supabase
        .from('bypass_numbers')
        .update({ active: true, name: name || existing.name })
        .eq('id', existing.id),
      'bypass.reactivate'
    );
  } else {
    unwrap(
      await supabase.from('bypass_numbers').insert({ phone: key, name: name || null }),
      'bypass.add'
    );
  }

  invalidate();
  logger.info('bypass.added', { phone: key, action: name || '' });
  return { ok: true, phone: key, name: name || null };
}

/** Soft delete: keeps the history, stops the bypass. */
async function remove(phone) {
  const key = config.normalisePhone(phone);
  const existing = unwrap(
    await supabase.from('bypass_numbers').select('*').eq('phone', key).maybeSingle(),
    'bypass.find'
  );
  if (!existing || !existing.active) return { ok: false, reason: 'NOT_FOUND', phone: key };

  unwrap(
    await supabase.from('bypass_numbers').update({ active: false }).eq('id', existing.id),
    'bypass.remove'
  );
  invalidate();
  logger.info('bypass.removed', { phone: key });
  return { ok: true, phone: key };
}

module.exports = { isBypassed, list, add, remove, invalidate };
