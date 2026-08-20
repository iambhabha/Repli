/**
 * Environment access.
 *
 * NEXT_PUBLIC_* values are inlined at build time and are safe in the browser.
 * Everything else is read on the server only - Next.js will not bundle it.
 *
 * Nothing throws at import time. That is deliberate: these constants are
 * evaluated while Next collects page data during `next build`, so throwing
 * here turned "you forgot an environment variable" into "the build failed to
 * collect configuration for /api/bypass/[id]" - an error that says nothing
 * about the actual cause. Now the build always succeeds and a missing value
 * is reported where it can be understood: on the screen, at request time.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const REPLI_API_URL = process.env.REPLI_API_URL?.replace(/\/+$/, '') || '';
export const REPLI_API_KEY = process.env.REPLI_API_KEY || '';
export const REPLI_ROOT = process.env.REPLI_ROOT || '';
export const REPLI_PROOFS_BUCKET = process.env.REPLI_PROOFS_BUCKET || '';

/** Which required variables are missing, in the order you would set them. */
export function missingEnvVars(): string[] {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!SUPABASE_ANON_KEY) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  // Read directly: the secret must never become a module-level constant that
  // could be imported from a Client Component by mistake.
  if (!process.env.SUPABASE_SECRET_KEY) missing.push('SUPABASE_SECRET_KEY');
  return missing;
}

export const isConfigured = (): boolean => missingEnvVars().length === 0;

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. On Vercel: Settings → Environment Variables. Locally: copy .env.example to .env.local.`
    );
  }
  return value;
}

/** Call before building a Supabase client, so the failure names the variable. */
export function requireSupabaseConfig(): { url: string; anonKey: string } {
  return {
    url: required('NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL),
    anonKey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY', SUPABASE_ANON_KEY),
  };
}

/** Server only. Never import this from a Client Component. */
export function supabaseSecretKey(): string {
  return required('SUPABASE_SECRET_KEY', process.env.SUPABASE_SECRET_KEY);
}
