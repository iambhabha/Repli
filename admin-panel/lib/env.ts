/**
 * Environment access with loud, early failures.
 *
 * NEXT_PUBLIC_* values are inlined at build time and are safe in the browser.
 * Everything else is read on the server only - Next.js will not bundle it.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`
    );
  }
  return value;
}

export const SUPABASE_URL = required(
  'NEXT_PUBLIC_SUPABASE_URL',
  process.env.NEXT_PUBLIC_SUPABASE_URL
);

export const SUPABASE_ANON_KEY = required(
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/** Server only. Never import this from a Client Component. */
export function supabaseSecretKey(): string {
  return required('SUPABASE_SECRET_KEY', process.env.SUPABASE_SECRET_KEY);
}

export const REPLI_API_URL = process.env.REPLI_API_URL?.replace(/\/+$/, '') || '';
export const REPLI_API_KEY = process.env.REPLI_API_KEY || '';
export const REPLI_ROOT = process.env.REPLI_ROOT || '';
export const REPLI_PROOFS_BUCKET = process.env.REPLI_PROOFS_BUCKET || '';
