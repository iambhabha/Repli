import { defineConfig } from '@playwright/test';

/**
 * The last verification level.
 *
 * Everything else in this repo checks the panel from the outside: static
 * contracts, `tsc`, `next build`, and real HTTP calls against the built
 * server. All of that proves the pipeline beneath a click. None of it proves
 * the click - that the file input is wired to the endpoint, that the preview
 * appears, that "Remove" actually removes.
 *
 * Deliberately small. Four upload flows and nothing else: this is here to
 * close a specific gap, not to become a second test suite that has to be
 * maintained alongside the nine that already exist.
 *
 * Uses the Chrome already on the machine (`channel: 'chrome'`) rather than
 * downloading Playwright's own build - one fewer 150 MB artefact, and it is
 * the browser the owner actually uses.
 *
 *   npm run test:e2e
 *
 * Needs E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD. The spec skips loudly
 * without them rather than pretending to pass.
 */

const PORT = Number(process.env.E2E_PORT) || 3988;

export default defineConfig({
  testDir: './e2e',
  // Uploads talk to Supabase Storage; a slow round trip is not a failure.
  timeout: 90_000,
  expect: { timeout: 15_000 },

  // One worker on purpose: these share one admin session and edit real rows.
  workers: 1,
  fullyParallel: false,
  retries: 0,

  reporter: [['list']],

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: 'chrome',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },

  /**
   * The production build, not `next dev` - the same artefact that gets
   * deployed, so a failure here is a failure a customer could have hit.
   */
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/admin/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
