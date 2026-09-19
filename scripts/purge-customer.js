'use strict';

/**
 * Erase one number from the shop — everything that number produced, nothing else.
 *
 *   node scripts/purge-customer.js 919321684451           # dry run, prints only
 *   node scripts/purge-customer.js 919321684451 --yes     # actually deletes
 *
 * reset-conversations.js already clears chat state, but its --orders flag is
 * shop-wide: it matches every row in orders, not the number you named. That is
 * right for "this shop has only ever been tested", wrong for "forget this one
 * tester". This script is the per-number version.
 *
 * Deleted, all filtered on phone:
 *
 *   messages · conversations · orders (order_items and payments follow by
 *   their on-delete-cascade) · outbound_messages · customers
 *
 * Never touched — these are the shop, not the customer:
 *
 *   products · product_variants · product_images · product_gallery ·
 *   message_templates · app_settings · admin_numbers · bypass_numbers
 *
 * Also left alone, deliberately, and reported instead:
 *
 *   ai_usage      the month-to-date spend fuse reads this table. Deleting rows
 *                 does not refund the money, it just makes the budget check
 *                 believe less was spent than really was.
 *   admin_actions an audit log. A log you can erase from is not an audit log.
 *
 * A CONFIRMED order is a warning, not a row. confirm_order_payment() already
 * took that stock out of product_variants, and deleting the order does not put
 * it back — the count would stay low with nothing left to explain why. The
 * script stops if it finds one unless you add --force.
 */

const { supabase, unwrap } = require('../src/db/supabase');

/** Same normalisation the bot uses, so "+91 93216 84451" finds its rows. */
const normalise = (input) => String(input).replace(/\D/g, '');

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes('--yes');
  const force = args.includes('--force');
  const phones = args.filter((a) => !a.startsWith('--')).map(normalise).filter(Boolean);

  if (phones.length === 0) {
    console.log('Usage: node scripts/purge-customer.js <number...> [--yes] [--force]');
    process.exit(1);
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('order_id,phone,status,total')
    .in('phone', phones)
    .order('created_at');

  const { data: convos } = await supabase
    .from('conversations')
    .select('phone,state,mode,updated_at')
    .in('phone', phones);

  const countIn = async (table) => {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .in('phone', phones);
    return count || 0;
  };

  console.log(`\nnumbers: ${phones.join(', ')}\n`);
  for (const c of convos || []) {
    console.log(`  conversation  ${c.phone}  ${c.state} / ${c.mode}  ${(c.updated_at || '').slice(0, 19)}`);
  }
  for (const o of orders || []) {
    console.log(`  order         ${String(o.order_id).padEnd(12)} ${String(o.status).padEnd(18)} ${o.total}`);
  }
  console.log(`  messages           ${await countIn('messages')}`);
  console.log(`  outbound_messages  ${await countIn('outbound_messages')}`);
  console.log(`  customers          ${await countIn('customers')}`);
  console.log(`  ai_usage           ${await countIn('ai_usage')}  (kept — spend ledger)`);

  const confirmed = (orders || []).filter((o) => o.status === 'CONFIRMED');
  if (confirmed.length && !force) {
    console.log('');
    for (const o of confirmed) {
      console.log(`  ⚠  ${o.order_id} is CONFIRMED — its stock was already deducted and`);
      console.log('     deleting the order will not give it back.');
    }
    console.log('\n  Add --force if you want to lose it anyway.\n');
    process.exit(1);
  }

  if (!commit) {
    console.log('\nDry run. Nothing deleted. Add --yes to go ahead.\n');
    return;
  }

  const del = async (table, label) => {
    const rows = unwrap(
      await supabase.from(table).delete().in('phone', phones).select('id'),
      `purge.${table}`
    );
    console.log(`  deleted ${String(rows.length).padStart(4)}  ${label}`);
  };

  console.log('');
  await del('messages', 'messages');
  await del('outbound_messages', 'outbound_messages');
  await del('conversations', 'conversations');
  await del('orders', 'orders (order_items + payments cascade)');
  await del('customers', 'customers');
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
