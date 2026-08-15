import { supabaseAdmin } from '@/lib/supabase/admin';
import { escapeLike, type PageParams, paginate, type Paginated } from '@/lib/utils/pagination';
import type {
  ConversationMode,
  ConversationRow,
  ConversationState,
  CustomerRow,
  MessageRow,
  OutboundMessageRow,
} from '@/types/database';
import type { ChatThread, InboxItem } from '@/types/message';

import { unwrapMaybe } from './shared';

/** How much history the chat pane loads. Older messages stay in the database. */
const THREAD_LIMIT = 200;

interface InboxViewRow {
  conversation_id: string;
  phone: string;
  mode: ConversationMode;
  state: ConversationState | null;
  last_read_at: string | null;
  customer_id: string | null;
  name: string | null;
  city: string | null;
  last_message_text: string | null;
  last_message_type: string | null;
  last_message_direction: 'INCOMING' | 'OUTGOING' | null;
  last_message_at: string | null;
  unread_count: number;
}

export interface InboxFilters {
  search?: string;
  mode?: 'ALL' | ConversationMode;
}

/** The conversation list on /admin/messages. One query, already sorted. */
export async function listInbox(
  filters: InboxFilters,
  page: PageParams
): Promise<Paginated<InboxItem>> {
  let query = supabaseAdmin()
    .from('admin_inbox')
    .select('*', { count: 'exact' })
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .range(page.from, page.to);

  const search = escapeLike(filters.search ?? '');
  if (search) {
    query = query.or(`phone.ilike.%${search}%,name.ilike.%${search}%`);
  }
  if (filters.mode && filters.mode !== 'ALL') {
    query = query.eq('mode', filters.mode);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`messages.listInbox: ${error.message}`);

  const rows = ((data ?? []) as InboxViewRow[]).map(
    (row): InboxItem => ({
      conversationId: row.conversation_id,
      phone: row.phone,
      name: row.name,
      mode: row.mode,
      state: row.state,
      lastMessageText: row.last_message_text,
      lastMessageAt: row.last_message_at,
      lastMessageDirection: row.last_message_direction,
      unreadCount: row.unread_count,
    })
  );

  return paginate(rows, count ?? rows.length, page);
}

/** Total unread across every thread - drives the sidebar badge and the bell. */
export async function countUnreadTotal(): Promise<number> {
  const { data, error } = await supabaseAdmin().from('admin_inbox').select('unread_count');
  if (error) throw new Error(`messages.countUnread: ${error.message}`);
  return ((data ?? []) as { unread_count: number }[]).reduce(
    (sum, row) => sum + (row.unread_count ?? 0),
    0
  );
}

/** Threads with something waiting, newest first - used by the notification bell. */
export async function unreadThreads(limit = 5): Promise<InboxItem[]> {
  const { data, error } = await supabaseAdmin()
    .from('admin_inbox')
    .select('*')
    .gt('unread_count', 0)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) throw new Error(`messages.unreadThreads: ${error.message}`);

  return ((data ?? []) as InboxViewRow[]).map((row) => ({
    conversationId: row.conversation_id,
    phone: row.phone,
    name: row.name,
    mode: row.mode,
    state: row.state,
    lastMessageText: row.last_message_text,
    lastMessageAt: row.last_message_at,
    lastMessageDirection: row.last_message_direction,
    unreadCount: row.unread_count,
  }));
}

/** Full conversation for one phone number, oldest first. */
export async function getThread(phone: string): Promise<ChatThread | null> {
  const db = supabaseAdmin();

  const [conversationRes, customerRes, messagesRes] = await Promise.all([
    db.from('conversations').select('*').eq('phone', phone).maybeSingle(),
    db.from('customers').select('*').eq('phone', phone).maybeSingle(),
    db
      .from('messages')
      .select('*')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(THREAD_LIMIT),
  ]);

  const conversation = unwrapMaybe(conversationRes, 'messages.thread.conversation') as
    | ConversationRow
    | null;
  const customer = unwrapMaybe(customerRes, 'messages.thread.customer') as CustomerRow | null;
  if (messagesRes.error) throw new Error(`messages.thread: ${messagesRes.error.message}`);

  const messages = ((messagesRes.data ?? []) as MessageRow[]).slice().reverse();
  if (!conversation && !customer && !messages.length) return null;

  return {
    phone,
    name: customer?.name ?? null,
    customerId: customer?.id ?? null,
    conversationId: conversation?.id ?? null,
    mode: conversation?.mode ?? 'BOT',
    state: conversation?.state ?? null,
    messages,
  };
}

/** Messages for the customer detail page (same data, no conversation wrapper). */
export async function getCustomerMessages(phone: string, limit = THREAD_LIMIT): Promise<MessageRow[]> {
  const { data, error } = await supabaseAdmin()
    .from('messages')
    .select('*')
    .eq('phone', phone)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`messages.forCustomer: ${error.message}`);
  return ((data ?? []) as MessageRow[]).slice().reverse();
}

/** Opening a chat clears its unread badge. */
export async function markThreadRead(phone: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('conversations')
    .update({ last_read_at: new Date().toISOString() })
    .eq('phone', phone);

  if (error) throw new Error(`messages.markRead: ${error.message}`);
}

/** Admin replies that have been queued but not yet sent by the bot. */
export async function pendingOutbound(phone: string): Promise<OutboundMessageRow[]> {
  const { data, error } = await supabaseAdmin()
    .from('outbound_messages')
    .select('*')
    .eq('phone', phone)
    .in('status', ['PENDING', 'FAILED'])
    .order('created_at', { ascending: true })
    .limit(20);

  if (error) throw new Error(`messages.pendingOutbound: ${error.message}`);
  return (data ?? []) as OutboundMessageRow[];
}
