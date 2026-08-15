import { supabaseAdmin } from '@/lib/supabase/admin';
import { daysAgoIso } from '@/lib/utils/time';
import type { OrderRow } from '@/types/database';

import { getLowStockVariants } from './dashboard';
import { unreadThreads } from './messages';

export type NotificationKind = 'MESSAGE' | 'PAYMENT_PROOF' | 'ORDER' | 'LOW_STOCK';

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  href: string;
  at: string | null;
}

/**
 * The bell in the topbar. Four things the owner must not miss, newest first,
 * built from live tables - nothing is stored or marked "read" server-side
 * beyond the per-chat last_read_at the inbox already maintains.
 */
export async function getNotifications(limit = 12): Promise<Notification[]> {
  const db = supabaseAdmin();
  const since = daysAgoIso(2);

  const [threads, proofs, orders, lowStock] = await Promise.all([
    unreadThreads(5).catch(() => []),
    db
      .from('payments')
      .select('id,amount,created_at,orders(order_id,customer_name,phone)')
      .eq('status', 'PROOF_RECEIVED')
      .order('created_at', { ascending: false })
      .limit(5),
    db
      .from('orders')
      .select('order_id,customer_name,phone,total,created_at,status')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5),
    getLowStockVariants(5).catch(() => []),
  ]);

  const items: Notification[] = [];

  for (const thread of threads) {
    items.push({
      id: `msg-${thread.phone}`,
      kind: 'MESSAGE',
      title: thread.unreadCount > 1 ? `${thread.unreadCount} new messages` : 'New message',
      detail: `${thread.name || thread.phone}: ${(thread.lastMessageText ?? 'Media').slice(0, 60)}`,
      href: `/admin/messages?phone=${thread.phone}`,
      at: thread.lastMessageAt,
    });
  }

  for (const proof of (proofs.data ?? []) as unknown as ProofNotificationRow[]) {
    items.push({
      id: `proof-${proof.id}`,
      kind: 'PAYMENT_PROOF',
      title: 'Payment proof received',
      detail: `${proof.orders?.order_id ?? 'Order'} · ${proof.orders?.customer_name ?? proof.orders?.phone ?? ''}`,
      href: '/admin/payments',
      at: proof.created_at,
    });
  }

  for (const order of (orders.data ?? []) as Pick<
    OrderRow,
    'order_id' | 'customer_name' | 'phone' | 'total' | 'created_at' | 'status'
  >[]) {
    items.push({
      id: `order-${order.order_id}`,
      kind: 'ORDER',
      title: 'New order',
      detail: `${order.order_id} · ${order.customer_name || order.phone}`,
      href: `/admin/orders/${order.order_id}`,
      at: order.created_at,
    });
  }

  for (const variant of lowStock) {
    items.push({
      id: `stock-${variant.id}`,
      kind: 'LOW_STOCK',
      title: variant.stock_quantity === 0 ? 'Out of stock' : 'Low stock',
      detail: `${variant.productName} ${[variant.color, variant.size].filter(Boolean).join(' / ')} · ${variant.stock_quantity} left`,
      href: '/admin/stock?level=LOW',
      at: variant.updated_at,
    });
  }

  return items
    .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))
    .slice(0, limit);
}

interface ProofNotificationRow {
  id: string;
  amount: number;
  created_at: string;
  orders: { order_id: string; customer_name: string | null; phone: string } | null;
}
