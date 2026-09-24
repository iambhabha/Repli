'use strict';

/**
 * Empty the shop of people, and leave the shop.
 *
 *   node scripts/reset-data.js
 *
 * Everything that exists because a customer talked to the bot goes:
 * conversations, the transcript, the customers themselves with their names
 * and addresses, their orders, the line items and payments hanging off
 * those, the outbound queue, the admin's actions on them, and the payment
 * screenshots sitting on disk.
 *
 * Everything that describes the shop stays: products, variants, product
 * photographs, categories, settings, message wording, admin numbers, bypass
 * numbers. After this the bot behaves exactly as it did - it simply has
 * never met anyone.
 *
 * This is for testing. It is not a privacy tool and not a backup: there is
 * no undo, and the counts printed at the end are the only record that the
 * rows were ever there.
 *
 * Order matters. A row that points at another has to go first or the
 * database refuses, which is why this is a list rather than a loop over
 * table names.
 */

const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { supabase } = require('../src/db/supabase');

/**
 * Deleted oldest-dependency-last: payments and items point at orders, orders
 * and conversations point at customers, so customers go at the end.
 */
const PEOPLE = [
  'payments',
  'order_items',
  'admin_actions',
  'orders',
  'messages',
  'outbound_messages',
  'conversations',
  'customers',
];

/** What the shop is, as opposed to who has been in it. */
const SHOP = [
  'products',
  'product_variants',
  'product_images',
  'product_categories',
  'app_settings',
  'message_templates',
  'admin_numbers',
  'bypass_numbers',
];

async function countOf(table) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  return error ? null : count || 0;
}

/**
 * PostgREST refuses an unfiltered delete, so every row is matched on having
 * an id at all. Tables keyed on something else are handled by falling back
 * to their own key.
 */
async function emptyTable(table) {
  for (const column of ['id', 'order_id', 'phone', 'key']) {
    const { error } = await supabase.from(table).delete().not(column, 'is', null);
    if (!error) return true;
    if (!/column .* does not exist/i.test(error.message)) throw new Error(`${table}: ${error.message}`);
  }
  throw new Error(`${table}: no column to match on`);
}

/** The screenshots are files, not rows, and they are just as personal. */
function emptyProofs() {
  const dir = config.PROOFS_DIR;
  if (!dir || !fs.existsSync(dir)) return 0;
  let removed = 0;
  for (const name of fs.readdirSync(dir)) {
    const target = path.join(dir, name);
    if (fs.statSync(target).isFile()) {
      fs.unlinkSync(target);
      removed += 1;
    }
  }
  return removed;
}

async function main() {
  console.log('Clearing everything to do with customers.\n');

  const before = {};
  for (const table of PEOPLE) before[table] = await countOf(table);

  for (const table of PEOPLE) {
    if (before[table] === null) {
      console.log(`  ${table.padEnd(20)} (no such table, skipped)`);
      continue;
    }
    await emptyTable(table);
    const after = await countOf(table);
    console.log(`  ${table.padEnd(20)} ${String(before[table]).padStart(5)} → ${after}`);
  }

  console.log(`  ${'payment screenshots'.padEnd(20)} ${String(emptyProofs()).padStart(5)} files removed`);

  console.log('\nLeft alone:');
  for (const table of SHOP) {
    const count = await countOf(table);
    if (count !== null) console.log(`  ${table.padEnd(20)} ${count}`);
  }

  /** If any of these came back non-zero, the delete silently did nothing. */
  const leftovers = [];
  for (const table of PEOPLE) {
    if (before[table] === null) continue;
    if ((await countOf(table)) > 0) leftovers.push(table);
  }
  if (leftovers.length) throw new Error(`still has rows: ${leftovers.join(', ')}`);
}

main()
  .then(() => {
    console.log('\nClean. The bot has never met anyone.');
    process.exit(0);
  })
  .catch((err) => {
    console.error(`\n${err.message}\n`);
    process.exit(1);
  });
