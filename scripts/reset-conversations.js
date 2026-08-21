'use strict';

/**
 * Put a chat back to the beginning.
 *
 *   node scripts/reset-conversations.js 919829374438 919321684451
 *   node scripts/reset-conversations.js --all
 *
 * This is a testing tool. It clears the bot's memory of where a chat had got
 * to - the conversation row and that number's transcript - so the next
 * message from it starts a fresh conversation.
 *
 * Numbers are required, or --all. Clearing everything used to be the only
 * behaviour and it is the wrong default: a real customer sitting in
 * HUMAN_HANDOFF is being handled by a person, and wiping their row drops
 * them back onto the bot in the middle of that conversation, with the bot
 * greeting them as though they had just arrived.
 *
 * By default it does NOT touch orders, order_items, payments or customers.
 * Those are the shop's records: an order somebody placed and paid for is not
 * a piece of chat state, and losing one to a test reset would be losing a
 * real sale. The count is checked before and after, and the script fails if
 * it moved.
 *
 *   node scripts/reset-conversations.js --all --orders
 *
 * --orders removes that protection and takes the orders with them, along
 * with the payments and line items that hang off them. It exists because a
 * shop that has only ever been tested on wants a clean start, and doing it
 * by hand in the SQL console is more dangerous than doing it here, where the
 * rows are printed before they go. Customers are never touched either way -
 * a phone number and a name are not test data.
 */

const { supabase, unwrap } = require('../src/db/supabase');

async function countOf(table) {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
  return count || 0;
}

/** Same normalisation the bot uses, so "+91 98293 74438" finds its row. */
const normalise = (input) => String(input).replace(/\D/g, '');

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const phones = args.filter((a) => !a.startsWith('--')).map(normalise).filter(Boolean);

  if (!all && phones.length === 0) {
    const { data } = await supabase
      .from('conversations')
      .select('phone,state,updated_at')
      .order('updated_at', { ascending: false });

    console.log('Give the numbers to reset, or --all.\n');
    console.log('Open conversations:');
    for (const row of data || []) {
      console.log(`  ${String(row.phone).padEnd(16)} ${String(row.state).padEnd(20)} ${(row.updated_at || '').slice(0, 19)}`);
    }
    process.exit(1);
  }

  const orders = await countOf('orders');
  const alsoOrders = args.includes('--orders');

  /**
   * Printed before they go, never after.
   *
   * These are the only rows in the database that represent money. Whoever
   * runs this should see what they are about to lose while they can still
   * press ctrl-C.
   */
  if (alsoOrders) {
    const { data: doomed } = await supabase
      .from('orders')
      .select('order_id,phone,status,total')
      .order('created_at');
    console.log('DELETING these orders:');
    for (const o of doomed || []) {
      console.log(`  ${String(o.order_id).padEnd(12)} ${String(o.phone).padEnd(16)} ${String(o.status).padEnd(18)} ${o.total}`);
    }
    console.log('');
  }

  let messages;
  let conversations;
  if (all) {
    messages = unwrap(await supabase.from('messages').delete().neq('phone', '').select('id'), 'reset.messages');
    conversations = unwrap(
      await supabase.from('conversations').delete().neq('phone', '').select('phone'),
      'reset.conversations'
    );
  } else {
    messages = unwrap(await supabase.from('messages').delete().in('phone', phones).select('id'), 'reset.messages');
    conversations = unwrap(
      await supabase.from('conversations').delete().in('phone', phones).select('phone'),
      'reset.conversations'
    );
  }

  console.log(`conversations cleared: ${conversations.length}${conversations.length ? ' — ' + conversations.map((c) => c.phone).join(', ') : ''}`);
  console.log(`messages cleared:      ${messages.length}`);

  if (alsoOrders) {
    /**
     * Payments and line items point at orders, so they go first.
     *
     * Matched on "id is not null" rather than on order_id. PostgREST needs a
     * filter to delete at all, and comparing order_id to 0 failed outright -
     * it is a uuid, and "0" is not one. Every row has an id; nothing else
     * about these tables has to be known.
     */
    const payments = unwrap(await supabase.from('payments').delete().not('id', 'is', null).select('id'), 'reset.payments');
    const items = unwrap(await supabase.from('order_items').delete().not('id', 'is', null).select('id'), 'reset.items');
    const gone = unwrap(await supabase.from('orders').delete().not('id', 'is', null).select('order_id'), 'reset.orders');
    console.log(`payments cleared:      ${payments.length}`);
    console.log(`order items cleared:   ${items.length}`);
    console.log(`orders cleared:        ${gone.length}`);
    console.log(`customers:             ${await countOf('customers')} (untouched)`);
    return;
  }

  const after = await countOf('orders');
  console.log(`orders:                ${after} (untouched)`);
  if (after !== orders) throw new Error('orders changed - this script must never do that');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
