import type { Metadata } from 'next';
import { MessageCircle } from 'lucide-react';

import { ChatWindow, type ProofRef } from '@/components/admin/ChatWindow';
import { MessageList } from '@/components/admin/MessageList';
import { RealtimeRefresh } from '@/components/admin/RealtimeRefresh';
import { FilterTabs, SearchInput } from '@/components/ui/Filters';
import { EmptyState } from '@/components/ui/States';
import { getThread, listInbox, pendingOutbound } from '@/lib/services/messages';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { normalisePhone } from '@/lib/utils/format';
import { first, parsePageParams } from '@/lib/utils/pagination';
import type { ConversationMode } from '@/types/database';

export const metadata: Metadata = { title: 'Messages' };
export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const search = first(params.q) ?? '';
  const mode = (first(params.mode) as ConversationMode | 'ALL' | undefined) ?? 'ALL';
  const selectedPhone = normalisePhone(first(params.phone) ?? '') || null;

  // The inbox is a scrolling list, not a paged table - one generous page.
  const page = parsePageParams({ ...params, per: '60' }, 60);
  const inbox = await listInbox({ search, mode }, page);

  const thread = selectedPhone ? await getThread(selectedPhone) : null;
  const [queued, proofs] = thread
    ? await Promise.all([pendingOutbound(thread.phone), listProofs(thread.phone)])
    : [[], []];

  return (
    <div className="space-y-4">
      <RealtimeRefresh tables={['messages', 'conversations']} throttleMs={800} pollMs={15000} />

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Messages</h1>
        <span className="text-sm text-muted-foreground">{inbox.total} conversations</span>
      </div>

      <div className="card flex h-[calc(100vh-11rem)] min-h-[30rem] overflow-hidden">
        {/* ------------------------------------------------- conversations */}
        <section
          className={`flex w-full min-w-0 flex-col border-r border-border lg:w-80 lg:shrink-0 ${
            thread ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="space-y-2 border-b border-border p-3">
            <SearchInput placeholder="Search name or phone…" />
            <FilterTabs
              paramName="mode"
              current={mode}
              pathname="/admin/messages"
              searchParams={params}
              options={[
                { label: 'All', value: 'ALL' },
                { label: 'Bot', value: 'BOT' },
                { label: 'Human', value: 'HUMAN' },
              ]}
            />
          </div>

          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
            <MessageList threads={inbox.rows} selectedPhone={selectedPhone} query={search} />
          </div>
        </section>

        {/* ---------------------------------------------------------- chat */}
        <section className={`min-w-0 flex-1 ${thread ? 'flex' : 'hidden lg:flex'} flex-col`}>
          {thread ? (
            <ChatWindow thread={thread} queued={queued} proofs={proofs} />
          ) : (
            <EmptyState
              className="m-auto"
              title="Pick a conversation"
              hint="Choose someone on the left to read the whole chat and reply from here."
              icon={<MessageCircle className="h-6 w-6" />}
            />
          )}
        </section>
      </div>
    </div>
  );
}

/** Payment proofs for this customer, so the chat can label the screenshot. */
async function listProofs(phone: string): Promise<ProofRef[]> {
  const { data } = await supabaseAdmin()
    .from('payments')
    .select('id,created_at,proof_url,orders!inner(order_id,phone)')
    .eq('orders.phone', phone)
    .not('proof_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    (data ?? []) as unknown as Array<{
      id: string;
      created_at: string;
      orders: { order_id: string } | null;
    }>
  ).map((row) => ({
    paymentId: row.id,
    orderCode: row.orders?.order_id ?? '',
    createdAt: row.created_at,
  }));
}
