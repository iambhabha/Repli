import { requireAdminApi } from '@/lib/auth/guard';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { toXlsx, type Cell } from '@/lib/xlsx';

export const dynamic = 'force-dynamic';

/**
 * Every customer, as an .xlsx the owner can open, sort and keep.
 *
 * Built from the database on each request rather than from a file that is
 * appended to over time: an export is only useful if it matches what the
 * panel shows, and a stale spreadsheet is worse than none.
 *
 * Deliberately not a CSV. A phone number in a CSV loses its leading digits
 * to Excel's autoformatting ("919799757664" becomes 9.19E+11), which is the
 * one column here that must survive intact.
 */
export async function GET() {
  await requireAdminApi();

  const db = supabaseAdmin();

  const { data: customers, error } = await db
    .from('customers')
    .select('phone,name,address,city,state,pin,created_at')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  // One query for the money columns, then joined in memory: a per-customer
  // query would be hundreds of round trips on a list this size.
  const { data: orders } = await db
    .from('orders')
    .select('phone,status,total,booking_amount,created_at');

  const byPhone = new Map<
    string,
    { orders: number; confirmed: number; booked: number; spent: number; last: string | null }
  >();

  for (const order of orders ?? []) {
    const row = byPhone.get(order.phone) ?? {
      orders: 0,
      confirmed: 0,
      booked: 0,
      spent: 0,
      last: null,
    };
    row.orders += 1;
    if (order.status === 'CONFIRMED') {
      row.confirmed += 1;
      row.spent += Number(order.total ?? 0);
      row.booked += Number(order.booking_amount ?? 0);
    }
    if (!row.last || order.created_at > row.last) row.last = order.created_at;
    byPhone.set(order.phone, row);
  }

  const headers = [
    'Phone',
    'Name',
    'Address',
    'City',
    'State',
    'PIN',
    'Orders',
    'Confirmed',
    'Booking paid',
    'Order value',
    'First seen',
    'Last order',
  ];

  const date = (value: string | null) =>
    value ? new Date(value).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '';

  const rows: Cell[][] = (customers ?? []).map((customer) => {
    const stats = byPhone.get(customer.phone);
    return [
      // Text, not a number: a phone number must keep every leading digit.
      customer.phone,
      customer.name ?? '',
      customer.address ?? '',
      customer.city ?? '',
      customer.state ?? '',
      customer.pin ?? '',
      stats?.orders ?? 0,
      stats?.confirmed ?? 0,
      stats?.booked ?? 0,
      stats?.spent ?? 0,
      date(customer.created_at),
      date(stats?.last ?? null),
    ];
  });

  const file = toXlsx(headers, rows, 'Customers');
  const today = new Date().toISOString().slice(0, 10);

  return new Response(new Uint8Array(file), {
    headers: {
      'content-type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="customers-${today}.xlsx"`,
      'cache-control': 'no-store',
    },
  });
}
