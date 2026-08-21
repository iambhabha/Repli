'use strict';

/**
 * Put every chat back to the beginning.
 *
 *   node scripts/reset-conversations.js
 *
 * This is a testing tool. It clears the bot's memory of where each chat had
 * got to - the conversation rows and the transcript - so the next message
 * from any number starts a fresh conversation.
 *
 * It deliberately does NOT touch orders, order_items, payments or customers.
 * Those are the shop's records: an order somebody placed and paid for is not
 * a piece of chat state, and losing one to a test reset would be losing a
 * real sale. Only the two tables the state machine writes to are emptied.
 */

const { supabase, unwrap } = require('../src/db/supabase');

async function countOf(table) {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
  return count || 0;
}

async function main() {
  const before = {
    conversations: await countOf('conversations'),
    messages: await countOf('messages'),
    orders: await countOf('orders'),
  };

  unwrap(await supabase.from('messages').delete().neq('phone', '').select('id'), 'reset.messages');
  unwrap(await supabase.from('conversations').delete().neq('phone', '').select('phone'), 'reset.conversations');

  const after = {
    conversations: await countOf('conversations'),
    messages: await countOf('messages'),
    orders: await countOf('orders'),
  };

  console.log(`conversations  ${before.conversations} -> ${after.conversations}`);
  console.log(`messages       ${before.messages} -> ${after.messages}`);
  console.log(`orders         ${before.orders} -> ${after.orders}  (untouched)`);

  if (after.orders !== before.orders) {
    throw new Error('orders changed - this script must never do that');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
