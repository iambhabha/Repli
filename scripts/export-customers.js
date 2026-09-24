'use strict';

/**
 * Everything the shop knows about its customers, as a spreadsheet.
 *
 *   node scripts/export-customers.js
 *   node scripts/export-customers.js --out C:\\somewhere\\customers.csv
 *
 * Two files come out, side by side:
 *
 *   customers.csv  one row per person, with their totals
 *   orders.csv     one row per order, with the customer beside it
 *
 * CSV rather than .xlsx on purpose. Excel opens it, Google Sheets imports it
 * without a plugin, and it needs nothing installed - a spreadsheet library
 * would be a dependency carried forever for a file that is read once a week.
 *
 * This reads. It writes nothing back to the database and creates no files
 * anywhere but the output directory, so it is safe to run at any time,
 * including while the bot is serving customers.
 */

const fs = require('fs');
const path = require('path');
const { supabase, unwrap } = require('../src/db/supabase');

/**
 * One field, quoted the way every spreadsheet expects.
 *
 * Addresses carry commas and line breaks, names carry apostrophes, and a
 * phone number with a leading zero is a number that Excel will happily eat.
 * Quoting everything and doubling the quotes inside is the rule that has no
 * exceptions.
 */
function field(value) {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

function toCsv(headers, rows) {
  const lines = [headers.map(field).join(',')];
  for (const row of rows) lines.push(row.map(field).join(','));
  // A BOM, so Excel opens it as UTF-8 and Hindi names are not mojibake.
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

const date = (value) => (value ? String(value).slice(0, 19).replace('T', ' ') : '');

async function main() {
  const outDir = (() => {
    const flag = process.argv.indexOf('--out');
    if (flag > -1 && process.argv[flag + 1]) return path.dirname(path.resolve(process.argv[flag + 1]));
    return path.join(__dirname, '..', 'data', 'exports');
  })();
  fs.mkdirSync(outDir, { recursive: true });

  const customers = unwrap(
    await supabase.from('customers').select('*').order('created_at'),
    'export.customers'
  );
  const orders = unwrap(
    await supabase.from('orders').select('*').order('created_at'),
    'export.orders'
  );
  const items = unwrap(await supabase.from('order_items').select('*'), 'export.items');

  /**
   * Where a payment actually stands, per order.
   *
   * An order row has no payment column - `payments` is a table of its own,
   * and asking the order for `payment_status` produced an empty column in
   * every export. The latest row for an order is the one that counts: a
   * rejected screenshot followed by a good one is paid, not rejected.
   */
  const paidState = new Map();
  for (const row of unwrap(
    await supabase.from('payments').select('order_id, status, created_at').order('created_at'),
    'export.payments'
  )) {
    paidState.set(row.order_id, row.status);
  }

  /**
   * When each person last wrote in.
   *
   * Their last ORDER answers "who buys"; this answers "who is still talking
   * to us", which is a different and often more useful question - somebody
   * who messaged yesterday and has not ordered is worth a follow-up, and
   * somebody whose last word was in March is not.
   *
   * Only incoming rows count. The bot's own replies are not the customer
   * being active, and counting them would make every number today's date.
   */
  const spoke = new Map();
  // Paged, because messages is the one table that grows without limit and
  // PostgREST caps a single select at a thousand rows - unpaged, every
  // customer past the first thousand messages would silently read as never
  // having written in.
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const page = unwrap(
      await supabase
        .from('messages')
        .select('phone, created_at')
        .eq('direction', 'INCOMING')
        .order('created_at')
        .range(from, from + PAGE - 1),
      'export.messages'
    );
    // Ascending, so the later row for a phone overwrites the earlier one and
    // what is left is the most recent.
    for (const row of page) spoke.set(String(row.phone), row.created_at);
    if (page.length < PAGE) break;
  }

  const itemsByOrder = new Map();
  for (const item of items) {
    if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
    itemsByOrder.get(item.order_id).push(item);
  }

  const byPhone = new Map();
  for (const customer of customers) byPhone.set(String(customer.phone), customer);

  /** What each person has spent, so the sheet answers "who buys" directly. */
  const totals = new Map();
  for (const order of orders) {
    const key = String(order.phone);
    const seen = totals.get(key) || { count: 0, value: 0, last: '' };
    seen.count += 1;
    seen.value += Number(order.total || 0);
    if (!seen.last || String(order.created_at) > seen.last) seen.last = String(order.created_at);
    totals.set(key, seen);
  }

  const customerRows = customers.map((c) => {
    const seen = totals.get(String(c.phone)) || { count: 0, value: 0, last: '' };
    return [
      c.phone,
      c.name,
      c.address,
      c.city,
      c.state,
      // `pin`, not `pincode` - the column has always been called pin, and
      // asking for the other name silently produced an empty column.
      c.pin,
      seen.count,
      seen.value,
      date(seen.last),
      date(c.created_at),
      date(spoke.get(String(c.phone))),
    ];
  });

  const orderRows = orders.map((o) => {
    const customer = byPhone.get(String(o.phone)) || {};
    const line = (itemsByOrder.get(o.id) || [])
      .map((i) => `${i.product_name_snapshot || ''} ${i.color_snapshot || ''} ${i.size_snapshot || ''} x${i.quantity || 1}`.trim())
      .join(' | ');
    return [
      o.order_id,
      date(o.created_at),
      o.phone,
      customer.name || '',
      line,
      // Counted from the items - the orders row does not carry a quantity.
      (itemsByOrder.get(o.id) || []).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0),
      o.total,
      o.booking_amount,
      o.remaining_amount,
      o.status,
      paidState.get(o.id) || 'none',
      o.payment_mode,
      customer.address || '',
      customer.city || '',
      customer.state || '',
      customer.pin || '',
    ];
  });

  const customersFile = path.join(outDir, 'customers.csv');
  const ordersFile = path.join(outDir, 'orders.csv');

  fs.writeFileSync(
    customersFile,
    toCsv(
      [
        'Phone', 'Name', 'Address', 'City', 'State', 'PIN', 'Orders',
        'Total spent', 'Last order', 'First seen', 'Last message',
      ],
      customerRows
    )
  );
  fs.writeFileSync(
    ordersFile,
    toCsv(
      [
        'Order', 'Date', 'Phone', 'Name', 'Items', 'Qty', 'Total', 'Advance',
        'Remaining', 'Status', 'Payment', 'Mode', 'Address', 'City', 'State', 'PIN',
      ],
      orderRows
    )
  );

  console.log(`${customerRows.length} customers  →  ${customersFile}`);
  console.log(`${orderRows.length} orders     →  ${ordersFile}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`\n${err.message}\n`);
    process.exit(1);
  });
