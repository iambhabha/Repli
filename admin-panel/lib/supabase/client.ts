'use client';

import { createBrowserClient } from '@supabase/ssr';

import { requireSupabaseConfig } from '@/lib/env';

/** One year, matching Supabase's own long-lived refresh token window. */
const REMEMBER_ME_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Browser client. It exists for exactly one job: Supabase Auth (login, logout,
 * session refresh). It cannot read business data - RLS denies the anon and
 * authenticated roles on every table (see 004_rls.sql), which is deliberate.
 *
 * `rememberMe: false` writes a session cookie instead of a persistent one, so
 * closing the browser really does sign the owner out - the checkbox on the
 * login screen means something.
 */
export function createClient(options: { rememberMe?: boolean } = {}) {
  const { rememberMe } = options;

  const { url, anonKey } = requireSupabaseConfig();

  return createBrowserClient(url, anonKey, {
    cookieOptions:
      rememberMe === undefined
        ? undefined
        : { maxAge: rememberMe ? REMEMBER_ME_MAX_AGE : undefined },
  });
}
