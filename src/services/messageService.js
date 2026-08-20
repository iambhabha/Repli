'use strict';

/**
 * Message log + duplicate protection.
 *
 * The unique partial index on messages(message_id) WHERE direction='INCOMING'
 * does the real work: a repeat delivery of the same WhatsApp id hits a
 * constraint violation, which is exactly the signal we want.
 */

const { supabase } = require('../db/supabase');
const config = require('../config');
const logger = require('../logger');

const UNIQUE_VIOLATION = '23505';

/**
 * Records the incoming message. Returns true the first time this WhatsApp
 * message id is seen, false for every repeat.
 */
async function claimIncoming(message) {
  const phone = config.normalisePhone(message.phone);
  const messageId = message.id ? String(message.id) : null;

  const row = {
    message_id: messageId,
    phone,
    direction: 'INCOMING',
    message_type: message.isMedia ? 'media' : 'text',
    text: message.isMedia ? null : String(message.text || '').slice(0, 2000),
  };

  const { error } = await supabase.from('messages').insert(row);

  if (!error) return true;
  if (error.code === UNIQUE_VIOLATION) return false;

  // Never drop a real customer message because logging failed.
  logger.error('messages.claim_failed', { phone, error: error.message });
  return true;
}

async function recordOutgoing(phone, text, type = 'text', mediaUrl = null) {
  const { error } = await supabase.from('messages').insert({
    message_id: null,
    phone: config.normalisePhone(phone),
    direction: 'OUTGOING',
    message_type: type,
    text: String(text || '').slice(0, 2000),
    media_url: mediaUrl,
  });
  if (error) logger.error('messages.record_out_failed', { phone, error: error.message });
}

/**
 * The last few things WE said to this number.
 *
 * Used to spot a customer pasting our own message back. It happened on a
 * live order: the bot's address prompt was pasted in as the address, stored
 * on the order, and then offered back as "your saved address" forever.
 */
async function recentOutgoing(phone, limit = 6) {
  const key = config.normalisePhone(phone);
  if (!key) return [];
  const { data, error } = await supabase
    .from('messages')
    .select('text')
    .eq('phone', key)
    .eq('direction', 'OUTGOING')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.warn('messages.recent_out_failed', { phone: key, error: error.message });
    return [];
  }
  return (data || []).map((row) => String(row.text || ''));
}

/** The last few turns, oldest first, as "customer:" / "shop:" lines. */
async function recentHistory(phone, limit = 6) {
  const key = config.normalisePhone(phone);
  if (!key) return [];
  const { data, error } = await supabase
    .from('messages')
    .select('direction,text')
    .eq('phone', key)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data || [])
    .reverse()
    .map((row) => `${row.direction === 'INCOMING' ? 'customer' : 'shop'}: ${String(row.text || '').replace(/\s+/g, ' ').slice(0, 200)}`);
}

module.exports = { claimIncoming, recordOutgoing, recentOutgoing, recentHistory };
