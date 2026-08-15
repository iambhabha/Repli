import { supabaseAdmin } from '@/lib/supabase/admin';
import { escapeLike, type PageParams, paginate, type Paginated } from '@/lib/utils/pagination';
import type { OrderStatus, PaymentRow, PaymentStatus } from '@/types/database';
import type { PaymentStatusFilter, PaymentWithOrder } from '@/types/payment';

const PAYMENT_SELECT =
  '*, orders!inner(order_id,status,phone,customer_name,customer_id,total)';

interface PaymentQueryRow extends PaymentRow {
  orders: {
    order_id: string;
    status: OrderStatus;
    phone: string;
    customer_name: string | null;
    customer_id: string | null;
    total: number;
  };
}

export interface PaymentFilters {
  search?: string;
  status?: PaymentStatusFilter;
}

export async function listPayments(
  filters: PaymentFilters,
  page: PageParams
): Promise<Paginated<PaymentWithOrder>> {
  let query = supabaseAdmin()
    .from('payments')
    .select(PAYMENT_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page.from, page.to);

  if (filters.status && filters.status !== 'ALL') {
    query = query.eq('status', filters.status);
  }

  const search = escapeLike(filters.search ?? '');
  if (search) {
    query = query.or(`order_id.ilike.%${search}%,phone.ilike.%${search}%`, {
      referencedTable: 'orders',
    });
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`payments.list: ${error.message}`);

  const rows = ((data ?? []) as unknown as PaymentQueryRow[]).map(toPaymentWithOrder);
  return paginate(rows, count ?? rows.length, page);
}

/** The default view of /admin/payments: proofs waiting on a human. */
export async function listPendingProofs(limit = 50): Promise<PaymentWithOrder[]> {
  const { data, error } = await supabaseAdmin()
    .from('payments')
    .select(PAYMENT_SELECT)
    .eq('status', 'PROOF_RECEIVED' satisfies PaymentStatus)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(`payments.pending: ${error.message}`);
  return ((data ?? []) as unknown as PaymentQueryRow[]).map(toPaymentWithOrder);
}

export async function getPayment(id: string): Promise<PaymentWithOrder | null> {
  const { data, error } = await supabaseAdmin()
    .from('payments')
    .select(PAYMENT_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`payments.get: ${error.message}`);
  if (!data) return null;
  return toPaymentWithOrder(data as unknown as PaymentQueryRow);
}

function toPaymentWithOrder(row: PaymentQueryRow): PaymentWithOrder {
  const { orders, ...payment } = row;
  return {
    ...payment,
    orderCode: orders?.order_id ?? '—',
    orderStatus: orders?.status ?? 'PENDING_PAYMENT',
    phone: orders?.phone ?? '',
    customerName: orders?.customer_name ?? null,
    customerId: orders?.customer_id ?? null,
    orderTotal: Number(orders?.total ?? 0),
  };
}
