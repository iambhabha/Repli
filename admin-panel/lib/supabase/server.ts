import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';

/**
 * Auth-aware server client: reads the Supabase session from cookies so Server
 * Components and Route Handlers know who is logged in.
 *
 * Like the browser client it holds the anon key, so it is used for identity
 * only. Business data goes through the admin client (lib/supabase/admin.ts).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy/middleware refreshes the session instead.
        }
      },
    },
  });
}
