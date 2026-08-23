'use strict';

/**
 * A copy of every customer and every order, in the owner's spreadsheet.
 *
 * The shop's records live in Supabase and always will - this is not a second
 * database, it is the sheet the owner actually looks at. They asked for the
 * names and addresses to arrive there on their own rather than being
 * exported by hand every few days, and a row that appears the moment an
 * order is placed is worth more than a perfect export nobody runs.
 *
 * It posts to a Google Apps Script bound to that spreadsheet. The alternative
 * was a Google Cloud service account, which means a project, an API to
 * enable and a JSON key to keep secret; this needs none of that, because the
 * script runs as the sheet's own owner and the sheet is the only thing it
 * can touch.
 *
 * Nothing here is allowed to matter. Every call is fire-and-forget behind a
 * timeout, every failure is a log line, and no caller waits for it or checks
 * what it returned: a spreadsheet being slow must never be the reason a
 * customer's order is slow, or worse, lost.
 */

const config = require('../config');
const logger = require('../logger');
const settingsService = require('./settingsService');

/**
 * Six seconds was not enough.
 *
 * A deployed Apps Script that has not run for a while is cold, and the first
 * request after that pays for the whole project starting up - which took
 * longer than the timeout and aborted, losing the write. Everything here is
 * fire-and-forget on a background path, so a longer wait costs the customer
 * nothing.
 */
const TIMEOUT_MS = 20000;

/**
 * Where to post, and the word that proves it is us.
 *
 * A deployed Apps Script is reachable by anyone who has the URL, so the
 * secret is what stops a stranger writing rows into the shop's sheet. Both
 * live in app_settings, so the owner can rotate either from the panel
 * without a deploy.
 */
async function endpoint() {
  /**
   * The test suite drives whole conversations through the real pipeline, and
   * every one of those messages would otherwise reach the owner's live
   * spreadsheet. A test that writes into the shop's records is not a test.
   */
  if (config.TEST_MODE) return null;

  const url = await settingsService.value('sheet_webhook_url', null).catch(() => null);
  const secret = await settingsService.value('sheet_webhook_secret', null).catch(() => null);
  if (!url || !/^https:\/\/script\.google\.com\//.test(String(url))) return null;
  return { url: String(url), secret: String(secret || '') };
}

/** @returns {Promise<boolean>} whether the row actually landed. */
async function post(kind, row) {
  const target = await endpoint();
  if (!target) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(target.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: target.secret, kind, row }),
      signal: controller.signal,
    });
    if (!response.ok) {
      logger.warn('sheet.rejected', { action: kind, error: `HTTP ${response.status}` });
      return false;
    }
    logger.info('sheet.written', { action: kind });
    return true;
  } catch (err) {
    // Including the abort. A sheet that did not answer in time is a sheet
    // the shop carries on without.
    logger.warn('sheet.failed', { action: kind, error: err.message });
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One person, written once and then kept current.
 *
 * Matched on the phone number by the script at the other end, so a customer
 * who orders again updates their row instead of appearing twice with two
 * different addresses.
 */
function customer(record, lastMessageAt) {
  if (!record || !record.phone) return;
  post('customer', {
    phone: record.phone,
    name: record.name || '',
    address: record.address || '',
    city: record.city || '',
    state: record.state || '',
    /**
     * The column is `pin`, not `pincode`.
     *
     * This asked for `pincode` and got undefined every single time, so every
     * customer reached the sheet without a PIN - the one field a courier
     * cannot deliver without. Nothing errored, because a missing property is
     * just empty; it took reading a real row in the sheet to see it.
     *
     * Both names are accepted so the scripts that build their own row are
     * not broken by the correction.
     */
    pincode: record.pin || record.pincode || '',
    /**
     * Now, unless the caller knows better.
     *
     * On the live path this is only reached because the customer has just
     * given their details, so "now" is the truth. A backfill is the caller
     * that knows better: it is replaying people who last spoke weeks ago,
     * and stamping today's date on all of them would turn the column into a
     * record of when the script ran.
     */
    last_message_at: lastMessageAt || new Date().toISOString(),
  }).catch(() => {});
}

/**
 * When this person last said anything.
 *
 * Written on its own, because the useful question about a past customer is
 * usually "have they been back?" - and that answer changes on every message
 * they send, long after their details stopped changing.
 *
 * Only rows that already exist are touched, so somebody who says hello and
 * leaves does not become a row: a sheet full of people who never bought
 * anything is a sheet nobody opens.
 *
 * Throttled hard. A customer sends a dozen messages while choosing a size,
 * and twelve webhook calls to write twelve timestamps a few seconds apart is
 * noise the sheet does not need and quota the shop should not spend.
 */
const lastTouched = new Map();
const TOUCH_EVERY_MS = 10 * 60 * 1000;

function seen(phone) {
  const key = String(phone || '');
  if (!key) return;

  const now = Date.now();
  const previous = lastTouched.get(key) || 0;
  if (now - previous < TOUCH_EVERY_MS) return;

  /**
   * The window is claimed only once the write actually lands.
   *
   * Marking it before the call meant a write that timed out still burned the
   * next ten minutes: the customer kept talking, and the sheet kept showing
   * a stale time because every further attempt was throttled away.
   */
  post('seen', { phone: key, last_message_at: new Date(now).toISOString() })
    .then((written) => {
      if (written) lastTouched.set(key, now);
    })
    .catch(() => {});
}

/** One order, appended. Orders are events; they are never rewritten. */
function order(record, items = []) {
  if (!record || !record.order_id) return;
  post('order', {
    order_id: record.order_id,
    created_at: record.created_at || new Date().toISOString(),
    phone: record.phone,
    name: record.customer_name || '',
    items: items
      .map((i) =>
        `${i.product_name_snapshot || ''} ${i.color_snapshot || ''} ${i.size_snapshot || ''} x${i.quantity || 1}`
          .replace(/\s+/g, ' ')
          .trim()
      )
      .join(' | '),
    /**
     * Counted from the items, because the orders row does not carry it.
     *
     * `record.quantity` was undefined and the column arrived empty, which
     * made every order look like it had no pieces at all. The items are
     * where the count actually lives.
     */
    quantity:
      record.quantity ??
      items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    total: record.total,
    booking_amount: record.booking_amount,
    remaining_amount: record.remaining_amount,
    status: record.status,
    /**
     * What was true when the row was written.
     *
     * There is no payment_status column on an order - the payments table
     * holds that, and at the moment a booking is made there is no payment
     * row yet. So this says what is honest at creation and nothing more.
     * A payment verified later does NOT come back and change this line;
     * orders are appended and never rewritten.
     */
    payment_status: record.payment_status || 'unpaid',
    payment_mode: record.payment_mode,
    address: record.address || '',
    city: record.city || '',
    state: record.state || '',
    pincode: record.pin || record.pincode || '',
  }).catch(() => {});
}

/** True when the owner has set one up - used by the panel and by scripts. */
async function isConfigured() {
  return Boolean(await endpoint());
}

module.exports = { customer, order, seen, isConfigured };
