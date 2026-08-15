import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The bot repo one level up has its own lockfile; pin the root so Turbopack
  // does not guess and start tracing the whole project.
  turbopack: { root: import.meta.dirname },
  // The Supabase secret key must never end up in a client bundle. Anything
  // that needs it lives in a Server Component or a Route Handler.
  serverExternalPackages: ['@supabase/supabase-js'],
  poweredByHeader: false,
};

export default nextConfig;
