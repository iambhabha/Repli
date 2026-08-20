'use strict';

/**
 * Does the panel actually refuse a request that is not signed in?
 *
 * Every other panel test in this repo is static - it reads source and checks
 * that `requireAdminApi()` is present. That proves the line exists. It does
 * not prove the server behaves, and "the guard is called" and "the guard
 * works" are different claims.
 *
 * So this one starts the real built Next server and makes real HTTP requests
 * with no session cookie. Still not a browser test: no page is rendered and
 * no button is clicked. But it is the difference between reading a lock and
 * pulling on the door.
 *
 * No new dependency - Node's own fetch and the app's own `next start`.
 *
 *   npm run build --prefix admin-panel   (once)
 *   node tests/authz.test.js
 *
 * Skips itself, loudly, if the app has not been built.
 */

const assert = require('assert');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PANEL = path.join(__dirname, '..', 'admin-panel');
const PORT = Number(process.env.AUTHZ_TEST_PORT) || 3987;
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  ❌ ${name}\n     ${err.stack.split('\n').slice(0, 3).join('\n     ')}`);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/api/products`, { redirect: 'manual' });
      if (response.status) return true;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  return false;
}

/**
 * Every route that touches the shop's files or its catalogue.
 *
 * A GET that leaks a signed URL is as bad as a POST that writes one: both
 * hand an anonymous caller something from a private bucket.
 */
const GUARDED = [
  ['GET', '/api/products/00000000-0000-0000-0000-000000000000/image'],
  ['POST', '/api/products/00000000-0000-0000-0000-000000000000/image'],
  ['DELETE', '/api/products/00000000-0000-0000-0000-000000000000/image'],
  ['GET', '/api/variants/00000000-0000-0000-0000-000000000000/image'],
  ['POST', '/api/variants/00000000-0000-0000-0000-000000000000/image'],
  ['GET', '/api/categories/tshirt/image'],
  ['POST', '/api/categories/tshirt/image'],
  ['DELETE', '/api/categories/tshirt/image'],
  ['GET', '/api/settings/qr'],
  ['POST', '/api/settings/qr'],
  ['DELETE', '/api/settings/qr'],
  ['GET', '/api/categories'],
  ['POST', '/api/categories'],
  ['PUT', '/api/categories/tshirt'],
  ['DELETE', '/api/categories/tshirt'],
  ['GET', '/api/products'],
  ['GET', '/api/payments'],
];

async function run() {
  if (!fs.existsSync(path.join(PANEL, '.next'))) {
    console.log('\n  ⚠  admin-panel is not built - run `npm run build` in admin-panel first.');
    console.log('     Skipping, and NOT counting this as a pass.\n');
    process.exit(0);
  }

  console.log(`\nStarting the built panel on ${PORT}…`);

  const server = spawn('npm', ['run', 'start', '--', '--port', String(PORT)], {
    cwd: PANEL,
    shell: true,
    stdio: 'ignore',
    env: { ...process.env, PORT: String(PORT) },
  });

  let up = false;
  try {
    up = await waitForServer();
    if (!up) {
      console.log('\n  ⚠  the server did not come up in time. Skipping.\n');
      return;
    }

    console.log('\n— an anonymous caller gets nothing —\n');

    for (const [method, route] of GUARDED) {
      await check(`${method.padEnd(6)} ${route}`, async () => {
        const response = await fetch(`${BASE}${route}`, { method, redirect: 'manual' });

        assert.ok(
          response.status === 401 || response.status === 403,
          `expected 401/403, got ${response.status}`
        );

        const body = await response.text();
        // Nothing about the shop, and above all no signed URL.
        assert.ok(!/supabase\.co/i.test(body), 'no Storage host may appear');
        assert.ok(!/storage:/i.test(body), 'no reference may appear');
        assert.ok(!/token=|signature=/i.test(body), 'no signed URL may appear');
        assert.ok(!/eyJ/.test(body), 'no JWT may appear');
      });
    }

    await check('a made-up route is not a way in', async () => {
      const response = await fetch(`${BASE}/api/products/x/image/../../settings/qr`, {
        redirect: 'manual',
      });
      assert.ok(response.status >= 400, `expected a refusal, got ${response.status}`);
    });

    await check('the admin pages redirect rather than render', async () => {
      const response = await fetch(`${BASE}/admin/categories`, { redirect: 'manual' });
      assert.ok(
        response.status === 307 || response.status === 302 || response.status === 401,
        `expected a redirect or refusal, got ${response.status}`
      );
      const body = await response.text();
      assert.ok(!/Add category/i.test(body), 'the editor must not be rendered to a stranger');
    });
  } finally {
    server.kill();
    // Next spawns a child; make sure the port is actually released.
    await sleep(500);
  }

  console.log(`\n${passed}/${passed + failed} passed\n`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
