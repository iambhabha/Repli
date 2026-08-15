import { redirect } from 'next/navigation';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { AdminUserRow } from '@/types/database';

export interface AdminSession {
  userId: string;
  email: string;
  name: string | null;
  /** WhatsApp number recorded for this admin, used as the audit actor for RPCs. */
  phone: string | null;
}

/**
 * The single source of truth for "is this request allowed to see Repli data".
 *
 * Two independent conditions, both server-side:
 *   1. a valid Supabase Auth session (verified against Supabase, not a cookie), and
 *   2. an active row in `admin_users` for that email.
 *
 * Logging in is therefore not enough - somebody who signs up on their own gets
 * nothing. Returns null instead of throwing so callers choose redirect vs 401.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) return null;

  const email = user.email.toLowerCase();
  const { data, error: lookupError } = await supabaseAdmin()
    .from('admin_users')
    .select('*')
    .ilike('email', email)
    .eq('active', true)
    .maybeSingle<AdminUserRow>();

  if (lookupError || !data) return null;

  return {
    userId: user.id,
    email: data.email,
    name: data.name,
    phone: data.phone,
  };
}

/** For pages: bounce anonymous visitors to the login screen. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');
  return session;
}

/** For route handlers: no redirects, just a 401. */
export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

export async function requireAdminApi(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new UnauthorizedError();
  return session;
}
