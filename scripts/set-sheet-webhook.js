'use strict';

/**
 * Point the bot at the spreadsheet's webhook.
 *
 *   node scripts/set-sheet-webhook.js <exec-url> <secret>
 *   node scripts/set-sheet-webhook.js --show
 *   node scripts/set-sheet-webhook.js --test
 *   node scripts/set-sheet-webhook.js --backfill
 *
 * The URL comes from deploying scripts/sheet-webhook.gs inside the sheet
 * (Deploy → New deployment → Web app). The secret is whatever SECRET was set
 * to in that script - the two have to match or every write is refused, which
 * is the point of having one.
 *
 * Both are stored in app_settings, so they can be changed later from the
 * panel without touching the bot.
 */

const { supabase, unwrap } = require('../src/db/supabase');
const settingsService = require('../src/services/settingsService');

const URL_KEY = 'sheet_webhook_url';
const SECRET_KEY = 'sheet_webhook_secret';

async function put(key, value) {
  const { data: found } = await supabase.from('app_settings').select('key').eq('key', key);
  if (found && found.length) {
    unwrap(await supabase.from('app_settings').update({ value }).eq('key', key).select('key'), 'set.update');
  } else {
    unwrap(await supabase.from('app_settings').insert({ key, value }).select('key'), 'set.insert');
  }
}

/** Never printed in full - it is the only thing protecting the sheet. */
const masked = (secret) =>
  !secret ? '(not set)' : `${String(secret).slice(0, 3)}…${String(secret).slice(-2)}`;

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--show')) {
    console.log(`url:    ${(await settingsService.value(URL_KEY, null)) || '(not set)'}`);
    console.log(`secret: ${masked(await settingsService.value(SECRET_KEY, null))}`);
    return;
  }

  if (args.includes('--test')) {
    const sheetService = require('../src/services/sheetService');
    if (!(await sheetService.isConfigured())) throw new Error('no webhook configured yet');

    /**
     * A real write, with a number nobody will mistake for a customer.
     *
     * A test that does not actually append a row proves only that the URL
     * resolves - and the failure this is looking for is the one where the
     * URL resolves and the secret is wrong.
     */
    sheetService.customer({
      phone: '0000000000',
      name: 'Repli test row',
      address: 'delete this row',
      city: '-',
      state: '-',
      pincode: '-',
    });
    await new Promise((done) => setTimeout(done, 4000));
    console.log('sent - check the Customers tab for a row with phone 0000000000');
    return;
  }

  if (args.includes('--backfill')) {
    /**
     * Everyone the shop already knows, pushed once.
     *
     * The webhook only fires on what happens next, so without this the sheet
     * starts empty and stays that way for every customer who has already
     * ordered and is not about to order again - which is most of them. Run
     * once, after wiring it up.
     *
     * Safe to run twice: the script at the other end matches on the phone
     * number and updates the row it finds. Orders are the exception - they
     * are appended, so a second run would list them twice, and this stops
     * before it can do that.
     */
    const sheetService = require('../src/services/sheetService');
    if (!(await sheetService.isConfigured())) throw new Error('no webhook configured yet');

    const { supabase, unwrap } = require('../src/db/supabase');
    const customers = unwrap(
      await supabase.from('customers').select('*').order('created_at'),
      'backfill.customers'
    );
    const orders = unwrap(
      await supabase.from('orders').select('*').order('created_at'),
      'backfill.orders'
    );
    const items = unwrap(await supabase.from('order_items').select('*'), 'backfill.items');

    const byOrder = new Map();
    for (const item of items) {
      if (!byOrder.has(item.order_id)) byOrder.set(item.order_id, []);
      byOrder.get(item.order_id).push(item);
    }
    const nameFor = new Map(customers.map((c) => [String(c.phone), c.name]));

    /**
     * When each of them actually last wrote in.
     *
     * Without this the whole column reads as the moment the backfill ran,
     * which is worse than leaving it empty - it looks like every old
     * customer is active today.
     */
    const spoke = new Map();
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const page = unwrap(
        await supabase
          .from('messages')
          .select('phone, created_at')
          .eq('direction', 'INCOMING')
          .order('created_at')
          .range(from, from + PAGE - 1),
        'backfill.messages'
      );
      for (const row of page) spoke.set(String(row.phone), row.created_at);
      if (page.length < PAGE) break;
    }

    // Spaced out on purpose. Apps Script serialises requests to one
    // deployment, and a hundred at once is how a webhook starts timing out.
    for (const customer of customers) {
      sheetService.customer(customer, spoke.get(String(customer.phone)) || customer.created_at);
      await new Promise((done) => setTimeout(done, 1200));
    }
    for (const order of orders) {
      sheetService.order(
        { ...order, customer_name: order.customer_name || nameFor.get(String(order.phone)) || '' },
        byOrder.get(order.id) || []
      );
      await new Promise((done) => setTimeout(done, 1200));
    }
    await new Promise((done) => setTimeout(done, 3000));

    console.log(`${customers.length} customers and ${orders.length} orders sent`);
    console.log('Orders are appended - do not run --backfill twice.');
    return;
  }

  const [url, secret] = args;
  if (!url || !secret) {
    console.log('Usage: node scripts/set-sheet-webhook.js <exec-url> <secret>');
    process.exit(1);
  }
  if (!/^https:\/\/script\.google\.com\/.*\/exec$/.test(url)) {
    throw new Error('that does not look like a deployed Apps Script /exec URL');
  }

  await put(URL_KEY, url);
  await put(SECRET_KEY, secret);
  await settingsService.invalidate?.();

  console.log(`url:    ${url}`);
  console.log(`secret: ${masked(secret)}`);
  console.log('\nSaved. Try: node scripts/set-sheet-webhook.js --test');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`\n${err.message}\n`);
    process.exit(1);
  });
