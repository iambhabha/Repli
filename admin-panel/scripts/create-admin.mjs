#!/usr/bin/env node
/**
 * Creates (or repairs) an admin account for the panel.
 *
 *   npm run create-admin -- --email owner@example.com --password "strong-password"
 *   npm run create-admin -- --email owner@example.com --password "…" --name "Owner" --phone 919999999999
 *
 * Two things have to line up before anyone can sign in:
 *   1. a Supabase Auth user  (the password)
 *   2. an active row in `admin_users` (the allowlist the server checks)
 *
 * This script does both and is safe to re-run: an existing auth user has its
 * password reset, an existing allowlist row is reactivated.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';

const ROOT = path.resolve(import.meta.dirname, '..');

loadEnvFile(path.join(ROOT, '.env.local'));
loadEnvFile(path.join(ROOT, '.env'));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SECRET_KEY) {
  fail(
    'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set.\n' +
      'Copy .env.example to .env.local and fill them in first.'
  );
}

const args = parseArgs(process.argv.slice(2));

const email = String(args.email || '').trim().toLowerCase();
if (!email || !email.includes('@')) fail('Pass an email: --email owner@example.com');

const password = args.password ? String(args.password) : await promptPassword();
if (password.length < 8) fail('Use a password of at least 8 characters.');

const name = args.name ? String(args.name) : null;
const phone = args.phone ? String(args.phone).replace(/\D/g, '') : null;

const headers = {
  apikey: SECRET_KEY,
  authorization: `Bearer ${SECRET_KEY}`,
  'content-type': 'application/json',
};

// ---------------------------------------------------------------- auth user
const existing = await findAuthUser(email);

if (existing) {
  await request(`/auth/v1/admin/users/${existing.id}`, {
    method: 'PUT',
    body: JSON.stringify({ password, email_confirm: true }),
  });
  console.log(`✓ Supabase Auth user already existed — password reset (${email})`);
} else {
  await request('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  console.log(`✓ Supabase Auth user created (${email})`);
}

// -------------------------------------------------------------- admin_users
const rows = await request(
  `/rest/v1/admin_users?select=id&email=ilike.${encodeURIComponent(email)}`
);

if (Array.isArray(rows) && rows.length) {
  await request(`/rest/v1/admin_users?id=eq.${rows[0].id}`, {
    method: 'PATCH',
    headers: { ...headers, prefer: 'return=minimal' },
    body: JSON.stringify({ active: true, name, phone }),
  });
  console.log('✓ admin_users row reactivated');
} else {
  await request('/rest/v1/admin_users', {
    method: 'POST',
    headers: { ...headers, prefer: 'return=minimal' },
    body: JSON.stringify({ email, name, phone, active: true }),
  });
  console.log('✓ admin_users row created');
}

console.log(`\nDone. Sign in at /admin/login as ${email}\n`);

// ------------------------------------------------------------------ helpers

async function findAuthUser(target) {
  // The admin list endpoint pages; the panel never has many admins.
  for (let page = 1; page <= 10; page += 1) {
    const result = await request(`/auth/v1/admin/users?page=${page}&per_page=200`);
    const users = result?.users ?? [];
    const hit = users.find((user) => String(user.email || '').toLowerCase() === target);
    if (hit) return hit;
    if (users.length < 200) return null;
  }
  return null;
}

async function request(pathname, init = {}) {
  const response = await fetch(`${SUPABASE_URL}${pathname}`, {
    ...init,
    headers: init.headers ?? headers,
  });

  const text = await response.text();
  if (!response.ok) {
    fail(`Supabase said ${response.status} for ${pathname}\n${text}`);
  }

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function promptPassword() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const value = await rl.question('Password for the new admin: ');
  rl.close();
  return value.trim();
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const [flag, inline] = token.slice(2).split('=');
    if (inline !== undefined) out[flag] = inline;
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[flag] = argv[(i += 1)];
    else out[flag] = true;
  }
  return out;
}

function loadEnvFile(file) {
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}
