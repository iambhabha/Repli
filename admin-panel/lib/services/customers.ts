import { supabaseAdmin } from '@/lib/supabase/admin';
import { escapeLike, type PageParams, paginate, type Paginated } from '@/lib/utils/pagination';
import type {
  ConversationMode,
  ConversationRow,
  ConversationState,
  CustomerRow,
  MessageRow,
} from '@/types/database';
import type { CustomerListItem, CustomerModeFilter, CustomerStats } from '@/types/customer';
import type { OrderWithDetails } from '@/types/order';
import type { PaymentWithOrder } from '@/types/payment';

import { getCustomerMessages } from './messages';
import { ORDER_SELECT, type OrderQueryRow, toOrderWithDetails } from './orders';
import { unwrapMaybe } from './shared';

interface CustomerViewRow extends CustomerRow {
  mode: ConversationMode;
  conversation_state: ConversationState | null;
  conversation_id: string | null;
  orders_count: number;
  total_spent: number;
  last_message_text: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export interface CustomerFilters {
  search?: string;
  mode?: CustomerModeFilter;
  sort?: 'recent' | 'name' | 'spent' | 'orders';
}

export async function listCustomers(
  filters: CustomerFilters,
  page: PageParams
): Promise<Paginated<CustomerListItem>> {
  const sort = filters.sort ?? 'recent';
  const orderColumn =
    sort === 'name'
      ? 'name'
      : sort === 'spent'
        ? 'total_spent'
        : sort === 'orders'
          ? 'orders_count'
          : 'created_at';

  let query = supabaseAdmin()
    .from('admin_customers')
    .select('*', { count: 'exact' })
    .order(orderColumn, { ascending: sort === 'name', nullsFirst: false })
    .range(page.from, page.to);

  const search = escapeLike(filters.search ?? '');
  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,city.ilike.%${search}%`);
  }
  if (filters.mode && filters.mode !== 'ALL') {
    query = query.eq('mode', filters.mode);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`customers.list: ${error.message}`);

  const rows = ((data ?? []) as CustomerViewRow[]).map(
    (row): CustomerListItem => ({
      id: row.id,
      phone: row.phone,
      name: row.name,
      address: row.address,
      city: row.city,
      state: row.state,
      pin: row.pin,
      created_at: row.created_at,
      updated_at: row.updated_at,
      mode: row.mode,
      ordersCount: row.orders_count,
      totalSpent: Number(row.total_spent ?? 0),
      lastMessageAt: row.last_message_at,
      lastMessageText: row.last_message_text,
      unreadCount: row.unread_count,
      conversationState: row.conversation_state,
    })
  );

  return paginate(rows, count ?? rows.length, page);
}

export interface CustomerDetail {
  customer: CustomerRow;
  conversation: ConversationRow | null;
  stats: CustomerStats;
  orders: OrderWithDetails[];
  payments: PaymentWithOrder[];
  messages: MessageRow[];
}

/** Everything the /admin/customers/[id] tabs need, fetched in parallel. */
export async function getCustomerDetail(id: string): Promise<CustomerDetail | null> {
  const db = supabaseAdmin();

  const customer = unwrapMaybe(
    await db.from('customers').select('*').eq('id', id).maybeSingle(),
    'customers.detail'
  ) as CustomerRow | null;

  if (!customer) return null;

  const [conversationRes, ordersRes, messages] = await Promise.all([
    db.from('conversations').select('*').eq('phone', customer.phone).maybeSingle(),
    db
      .from('orders')
      .select(ORDER_SELECT)
      .eq('phone', customer.phone)
      .order('created_at', { ascending: false }),
    getCustomerMessages(customer.phone),
  ]);

  const conversation = unwrapMaybe(conversationRes, 'customers.detail.conversation') as
    | ConversationRow
    | null;

  if (ordersRes.error) throw new Error(`customers.detail.orders: ${ordersRes.error.message}`);

  const orders = ((ordersRes.data ?? []) as unknown as OrderQueryRow[]).map(toOrderWithDetails);

  const payments: PaymentWithOrder[] = orders.flatMap((order) =>
    (order.payment ? [order.payment] : []).map((payment) => ({
      ...payment,
      orderCode: order.order_id,
      orderStatus: order.status,
      phone: order.phone,
      customerName: order.customer_name,
      customerId: customer.id,
      orderTotal: Number(order.total ?? 0),
    }))
  );

  const confirmed = orders.filter((order) => order.status === 'CONFIRMED');

  return {
    customer,
    conversation,
    stats: {
      ordersCount: orders.length,
      confirmedCount: confirmed.length,
      totalSpent: confirmed.reduce((sum, order) => sum + Number(order.total ?? 0), 0),
      customerSince: customer.created_at,
    },
    orders,
    payments,
    messages,
  };
}

export async function getCustomerByPhone(phone: string): Promise<CustomerRow | null> {
  return unwrapMaybe(
    await supabaseAdmin().from('customers').select('*').eq('phone', phone).maybeSingle(),
    'customers.byPhone'
  ) as CustomerRow | null;
}

