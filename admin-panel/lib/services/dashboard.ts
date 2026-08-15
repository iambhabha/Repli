import { supabaseAdmin } from '@/lib/supabase/admin';
import { startOfIstDayIso } from '@/lib/utils/time';
import type {
  CustomerRow,
  MessageRow,
  OrderRow,
  PaymentRow,
  ProductVariantRow,
} from '@/types/database';

import { countUnreadTotal } from './messages';
import { getLowStockThreshold } from './settings';
import { unwrapCount } from './shared';

export interface DashboardStats {
  totalCustomers: number;
  todaysNewCustomers: number;
  totalOrders: number;
  pendingOrders: number;
  confirmedOrders: number;
  pendingPayments: number;
  todaysRevenue: number;
  lowStockProducts: number;
  unreadMessages: number;
}

export interface RecentOrder {
  orderCode: string;
  customerName: string | null;
  phone: string;
  total: number;
  status: OrderRow['status'];
  createdAt: string;
  paymentStatus: PaymentRow['status'] | null;
}

export interface PendingPaymentSummary {
  paymentId: string;
  orderCode: string;
  customerName: string | null;
  phone: string;
  amount: number;
  hasProof: boolean;
  createdAt: string;
}

export interface DashboardData {
  stats: DashboardStats;
  recentOrders: RecentOrder[];
  recentCustomers: CustomerRow[];
  recentMessages: MessageRow[];
  pendingPayments: PendingPaymentSummary[];
}

/**
 * One round of parallel count queries instead of pulling rows and counting in
 * JS: `head: true` sends no body at all, so the dashboard stays cheap as the
 * shop grows.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const db = supabaseAdmin();
  const dayStart = startOfIstDayIso();
  const threshold = await getLowStockThreshold();

  const [
    totalCustomers,
    todaysNewCustomers,
    totalOrders,
    pendingOrders,
    confirmedOrders,
    pendingPayments,
    lowStock,
    todaysPayments,
    recentOrdersRes,
    recentCustomersRes,
    recentMessagesRes,
    pendingPaymentRows,
    unreadMessages,
  ] = await Promise.all([
    db.from('customers').select('id', { count: 'exact', head: true }),
    db.from('customers').select('id', { count: 'exact', head: true }).gte('created_at', dayStart),
    db.from('orders').select('id', { count: 'exact', head: true }),
    db
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['PENDING_PAYMENT', 'PAYMENT_VERIFYING']),
    db.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'CONFIRMED'),
    db.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'PROOF_RECEIVED'),
    db
      .from('product_variants')
      .select('id', { count: 'exact', head: true })
      .eq('active', true)
      .lte('stock_quantity', threshold),
    db
      .from('payments')
      .select('amount')
      .eq('status', 'VERIFIED')
      .gte('verified_at', dayStart),
    db
      .from('orders')
      .select('order_id,customer_name,phone,total,status,created_at,payments(status)')
      .order('created_at', { ascending: false })
      .limit(6),
    db.from('customers').select('*').order('created_at', { ascending: false }).limit(5),
    db.from('messages').select('*').order('created_at', { ascending: false }).limit(6),
    db
      .from('payments')
      .select('id,amount,proof_url,created_at,orders(order_id,phone,customer_name)')
      .eq('status', 'PROOF_RECEIVED')
      .order('created_at', { ascending: false })
      .limit(5),
    countUnreadTotal(),
  ]);

  const revenueRows = (todaysPayments.data ?? []) as Pick<PaymentRow, 'amount'>[];
  const todaysRevenue = revenueRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

  const recentOrders = ((recentOrdersRes.data ?? []) as RecentOrderQuery[]).map((row) => ({
    orderCode: row.order_id,
    customerName: row.customer_name,
    phone: row.phone,
    total: Number(row.total ?? 0),
    status: row.status,
    createdAt: row.created_at,
    paymentStatus: row.payments?.[0]?.status ?? null,
  }));

  const pendingPaymentSummaries = (
    (pendingPaymentRows.data ?? []) as unknown as PendingPaymentQuery[]
  ).map(
    (row) => ({
      paymentId: row.id,
      orderCode: row.orders?.order_id ?? '—',
      customerName: row.orders?.customer_name ?? null,
      phone: row.orders?.phone ?? '',
      amount: Number(row.amount ?? 0),
      hasProof: Boolean(row.proof_url),
      createdAt: row.created_at,
    })
  );

  return {
    stats: {
      totalCustomers: unwrapCount(totalCustomers, 'dashboard.customers'),
      todaysNewCustomers: unwrapCount(todaysNewCustomers, 'dashboard.newCustomers'),
      totalOrders: unwrapCount(totalOrders, 'dashboard.orders'),
      pendingOrders: unwrapCount(pendingOrders, 'dashboard.pendingOrders'),
      confirmedOrders: unwrapCount(confirmedOrders, 'dashboard.confirmedOrders'),
      pendingPayments: unwrapCount(pendingPayments, 'dashboard.pendingPayments'),
      todaysRevenue,
      lowStockProducts: unwrapCount(lowStock, 'dashboard.lowStock'),
      unreadMessages,
    },
    recentOrders,
    recentCustomers: (recentCustomersRes.data ?? []) as CustomerRow[],
    recentMessages: (recentMessagesRes.data ?? []) as MessageRow[],
    pendingPayments: pendingPaymentSummaries,
  };
}

/** Low-stock variants for the dashboard drill-down and the notification bell. */
export async function getLowStockVariants(limit = 10): Promise<
  Array<ProductVariantRow & { productName: string }>
> {
  const threshold = await getLowStockThreshold();
  const { data } = await supabaseAdmin()
    .from('product_variants')
    .select('*, products(name)')
    .eq('active', true)
    .lte('stock_quantity', threshold)
    .order('stock_quantity', { ascending: true })
    .limit(limit);

  return ((data ?? []) as Array<ProductVariantRow & { products: { name: string } | null }>).map(
    (row) => ({ ...row, productName: row.products?.name ?? 'Product' })
  );
}

interface RecentOrderQuery {
  order_id: string;
  customer_name: string | null;
  phone: string;
  total: number;
  status: OrderRow['status'];
  created_at: string;
  payments: { status: PaymentRow['status'] }[] | null;
}

interface PendingPaymentQuery {
  id: string;
  amount: number;
  proof_url: string | null;
  created_at: string;
  orders: { order_id: string; phone: string; customer_name: string | null } | null;
}
