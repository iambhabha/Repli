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

module.exports = { claimIncoming, recordOutgoing };
