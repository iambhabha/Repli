import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { requireSupabaseConfig, supabaseSecretKey } from '@/lib/env';

/**
 * Service-role client. Bypasses RLS, so it is the ONLY way the panel can read
 * Repli's data - and it must never touch the browser.
 *
 * Guarded three ways:
 *   1. SUPABASE_SECRET_KEY has no NEXT_PUBLIC_ prefix, so Next.js cannot inline it.
 *   2. The runtime check below throws if this module is ever evaluated in a browser.
 *   3. Callers live in Server Components / Route Handlers behind requireAdmin().
 */
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('supabaseAdmin() was called in the browser. This is a server-only module.');
  }
  if (!cached) {
    cached = createClient(requireSupabaseConfig().url, supabaseSecretKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'x-repli-client': 'admin-panel' } },
    });
  }
  return cached;
}

/**
 * Realtime needs its own connection, and unlike the query client it must not
 * be shared across requests. Callers are responsible for removing channels.
 */
export function supabaseRealtime(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('supabaseRealtime() was called in the browser. This is a server-only module.');
  }
  return createClient(requireSupabaseConfig().url, supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 5 } },
  });
}
