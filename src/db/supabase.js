'use strict';

/**
 * The one and only Supabase client.
 *
 * Uses the SECRET (service-role) key, so it bypasses RLS - that is why this
 * key must never reach a browser or a client bundle. Everything above this
 * file goes through src/services/*, never through raw queries.
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

if (!config.SUPABASE_URL || !config.SUPABASE_SECRET_KEY) {
  throw new Error(
    'SUPABASE_URL / SUPABASE_SECRET_KEY .env me set nahi hai. ' +
      '.env.example dekho aur Supabase → Project Settings → API se values lo.'
  );
}

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { 'x-application-name': 'repli-bot' } },
});

/** Unwrap a PostgREST result, turning an error into a real exception. */
function unwrap(result, context) {
  if (result.error) {
    const err = new Error(`${context}: ${result.error.message}`);
    err.code = result.error.code;
    err.details = result.error.details;
    throw err;
  }
  return result.data;
}

/** Quick health check used at startup so misconfiguration fails loudly. */
async function ping() {
  const { error } = await supabase.from('products').select('id').limit(1);
  if (error) throw new Error(`Supabase connection failed: ${error.message}`);
  return true;
}

module.exports = { supabase, unwrap, ping };
