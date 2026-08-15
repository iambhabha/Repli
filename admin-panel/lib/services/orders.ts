import { logAdminAction } from '@/lib/audit';
import type { AdminSession } from '@/lib/auth/guard';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { escapeLike, type PageParams, paginate, type Paginated } from '@/lib/utils/pagination';
import { BadRequest } from '@/lib/utils/http';
import type {
  OrderItemRow,
  OrderRow,
  OrderStatus,
  PaymentRow,
  PaymentRpcResult,
} from '@/types/database';
import type { OrderStatusFilter, OrderWithDetails } from '@/types/order';

import { customerLanguage, customerMessages, sendWhatsAppMessage } from './outbox';

export const ORDER_SELECT = '*, order_items(*), payments(*)';

export type OrderQueryRow = OrderRow & {
  order_items: OrderItemRow[] | null;
  payments: PaymentRow[] | null;
};

export function toOrderWithDetails(row: OrderQueryRow): OrderWithDetails {
  const { order_items: items, payments, ...order } = row;
  return { ...order, items: items ?? [], payment: payments?.[0] ?? null };
}

export interface OrderFilters {
  search?: string;
  status?: OrderStatusFilter;
  sort?: 'recent' | 'oldest' | 'amount';
}

export async function listOrders(
  filters: OrderFilters,
  page: PageParams
): Promise<Paginated<OrderWithDetails>> {
  const sort = filters.sort ?? 'recent';

  let query = supabaseAdmin()
    .from('orders')
    .select(ORDER_SELECT, { count: 'exact' })
    .range(page.from, page.to);

  query =
    sort === 'amount'
      ? query.order('total', { ascending: false })
      : query.order('created_at', { ascending: sort === 'oldest' });

  const search = escapeLike(filters.search ?? '');
  if (search) {
    query = query.or(
      `order_id.ilike.%${search}%,phone.ilike.%${search}%,customer_name.ilike.%${search}%`
    );
  }
  if (filters.status && filters.status !== 'ALL') {
    query = query.eq('status', filters.status);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`orders.list: ${error.message}`);

  const rows = ((data ?? []) as unknown as OrderQueryRow[]).map(toOrderWithDetails);
  return paginate(rows, count ?? rows.length, page);
}

/** Accepts the business code (REP-1024). That is what every link uses. */
export async function getOrder(orderCode: string): Promise<OrderWithDetails | null> {
  const { data, error } = await supabaseAdmin()
    .from('orders')
    .select(ORDER_SELECT)
    .eq('order_id', orderCode.toUpperCase())
    .maybeSingle();

  if (error) throw new Error(`orders.get: ${error.message}`);
  if (!data) return null;
  return toOrderWithDetails(data as unknown as OrderQueryRow);
}

export interface ActionOutcome {
  ok: boolean;
  message: string;
  queued?: boolean;
}

/**
 * §19 of the spec, and the single most important write in the panel.
 *
 * The atomic part - payment VERIFIED, order CONFIRMED, stock decreased,
 * conversation switched to HUMAN - is `confirm_order_payment()`, the same
 * database function the WhatsApp `/paid` command calls. One transaction, so
 * two admins tapping VERIFY at once cannot double-decrement stock.
 *
 * Only after the transaction succeeds do we log the action and send the
 * customer their confirmation.
 */
export async function verifyPayment(
  orderCode: string,
  admin: AdminSession
): Promise<ActionOutcome> {
  const actor = admin.phone || admin.email;

  const { data, error } = await supabaseAdmin().rpc('confirm_order_payment', {
    p_order_id: orderCode.toUpperCase(),
    p_admin_phone: actor,
  });

  if (error) throw new Error(`orders.verifyPayment: ${error.message}`);

  const result = data as PaymentRpcResult;
  if (!result?.ok) {
    throw new BadRequest(rpcReason(result?.reason));
  }

  await logAdminAction({
    actor: admin.email,
    action: 'PAYMENT_VERIFIED',
    entityType: 'order',
    entityId: result.order_id ?? orderCode,
    details: { phone: result.phone, stock: result.stock ?? [], short: result.short ?? false },
  });

  const order = await getOrder(orderCode);
  let queued = false;

  if (order) {
    const send = await sendWhatsAppMessage({
      phone: order.phone,
      text: customerMessages.orderConfirmed(
        {
          order_id: order.order_id,
          total: Number(order.total),
          items: order.items,
        },
        await customerLanguage(order.phone)
      ),
      actor: admin.email,
    }).catch((sendError) => {
      console.error('[orders.verifyPayment] confirmation message failed', sendError);
      return null;
    });
    queued = send ? !send.delivered : false;
  }

  const shortWarning = result.short
    ? ' Stock was lower than the ordered quantity - please check /admin/stock.'
    : '';

  return {
    ok: true,
    message: `Payment verified successfully.${shortWarning}`,
    queued,
  };
}

/** Stock is deliberately untouched here - the same rule as the bot's RPC. */
export async function rejectPayment(
  orderCode: string,
  admin: AdminSession
): Promise<ActionOutcome> {
  const actor = admin.phone || admin.email;

  const { data, error } = await supabaseAdmin().rpc('reject_order_payment', {
    p_order_id: orderCode.toUpperCase(),
    p_admin_phone: actor,
  });

  if (error) throw new Error(`orders.rejectPayment: ${error.message}`);

  const result = data as PaymentRpcResult;
  if (!result?.ok) throw new BadRequest(rpcReason(result?.reason));

  await logAdminAction({
    actor: admin.email,
    action: 'PAYMENT_REJECTED',
    entityType: 'order',
    entityId: result.order_id ?? orderCode,
    details: { phone: result.phone },
  });

  let queued = false;
  if (result.phone) {
    const send = await sendWhatsAppMessage({
      phone: result.phone,
      text: customerMessages.paymentRejected(await customerLanguage(result.phone)),
      actor: admin.email,
    }).catch(() => null);
    queued = send ? !send.delivered : false;
  }

  return { ok: true, message: 'Payment rejected. The customer has been told.', queued };
}

export async function cancelOrder(
  orderCode: string,
  admin: AdminSession,
  notifyCustomer = true
): Promise<ActionOutcome> {
  const order = await getOrder(orderCode);
  if (!order) throw new BadRequest('Order not found.');
  if (order.status === 'CONFIRMED') {
    throw new BadRequest('A confirmed order cannot be cancelled from the panel.');
  }
  if (order.status === 'CANCELLED') {
    throw new BadRequest('This order is already cancelled.');
  }

  const { error } = await supabaseAdmin()
    .from('orders')
    .update({ status: 'CANCELLED' satisfies OrderStatus })
    .eq('id', order.id);

  if (error) throw new Error(`orders.cancel: ${error.message}`);

  await logAdminAction({
    actor: admin.email,
    action: 'ORDER_CANCELLED',
    entityType: 'order',
    entityId: order.order_id,
    details: { phone: order.phone, previousStatus: order.status },
  });

  let queued = false;
  if (notifyCustomer) {
    const send = await sendWhatsAppMessage({
      phone: order.phone,
      text: customerMessages.orderCancelled(order.order_id, await customerLanguage(order.phone)),
      actor: admin.email,
    }).catch(() => null);
    queued = send ? !send.delivered : false;
  }

  return { ok: true, message: 'Order cancelled.', queued };
}

function rpcReason(reason: PaymentRpcResult['reason']): string {
  switch (reason) {
    case 'NOT_FOUND':
      return 'That order no longer exists.';
    case 'ALREADY_CONFIRMED':
      return 'This order was already confirmed.';
    case 'CANCELLED':
      return 'This order was cancelled and cannot be confirmed.';
    default:
      return 'The order could not be updated.';
  }
}
