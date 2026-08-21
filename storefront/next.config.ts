import type { NextConfig } from 'next';

/**
 * The shop front is static on purpose, for now.
 *
 * Every product, price and photograph on it is written down in
 * lib/catalogue.ts rather than read from the database. That is a deliberate
 * first step, not an oversight: the same catalogue the bot sells from lives
 * in Supabase, and the plan is to read it here too. Doing that on day one
 * would have meant no site to look at until the wiring worked.
 *
 * When it is time, `output: 'export'` comes out and the pages become server
 * components that read the same tables the bot reads. Nothing else about
 * the site needs to change - the components already take a Product, and
 * lib/catalogue.ts is the only file that knows where one comes from.
 */
const config: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
};

export default config;
