import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';

import { OrderStatusBadge, PaymentStatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/States';
import { formatCurrency, formatDate, formatPhone } from '@/lib/utils/format';
import type { OrderWithDetails } from '@/types/order';

/** One line describing what was actually bought. */
function itemSummary(order: OrderWithDetails): string {
  if (!order.items.length) return '—';
  const first = order.items[0];
  if (!first) return '—';
  const parts = [first.product_name_snapshot, first.color_snapshot, first.size_snapshot].filter(
    Boolean
  );
  const extra = order.items.length > 1 ? ` +${order.items.length - 1} more` : '';
  return `${parts.join(' · ')}${extra}`;
}

function totalQuantity(order: OrderWithDetails): number {
  return order.items.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
}

export function OrderTable({ orders, query }: { orders: OrderWithDetails[]; query: string }) {
  if (!orders.length) {
    return (
      <EmptyState
        title={query ? 'No orders match that search.' : 'No orders found.'}
        hint={
          query
            ? 'Search by order id, phone number or customer name.'
            : 'Orders appear the moment a customer confirms one in the WhatsApp chat.'
        }
        icon={<ShoppingBag className="h-6 w-6" />}
      />
    );
  }

  return (
    <>
      <div className="table-wrap hidden md:block">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="th">Order</th>
              <th className="th">Customer</th>
              <th className="th">Product</th>
              <th className="th text-right">Qty</th>
              <th className="th text-right">Total</th>
              <th className="th">Payment</th>
              <th className="th">Status</th>
              <th className="th">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((order) => (
              <tr key={order.id} className="transition-colors hover:bg-muted/50">
                <td className="td">
                  <Link
                    href={`/admin/orders/${order.order_id}`}
                    className="font-medium text-primary hover:text-primary"
                  >
                    {order.order_id}
                  </Link>
                </td>
                <td className="td">
                  <span className="block text-foreground">{order.customer_name || 'Unnamed'}</span>
                  <span className="block text-xs text-muted-foreground">{formatPhone(order.phone)}</span>
                </td>
                <td className="td max-w-56">
                  <span className="block truncate">{itemSummary(order)}</span>
                </td>
                <td className="td text-right tabular-nums">{totalQuantity(order)}</td>
                <td className="td text-right font-medium tabular-nums">
                  {formatCurrency(order.total)}
                </td>
                <td className="td">
                  <PaymentStatusBadge status={order.payment?.status ?? null} />
                </td>
                <td className="td">
                  <OrderStatusBadge status={order.status} />
                </td>
                <td className="td whitespace-nowrap text-muted-foreground">
                  {formatDate(order.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-border md:hidden">
        {orders.map((order) => (
          <li key={order.id}>
            <Link href={`/admin/orders/${order.order_id}`} className="block px-4 py-3.5 active:bg-muted/60">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{order.order_id}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {order.customer_name || formatPhone(order.phone)}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {formatCurrency(order.total)}
                </span>
              </div>

              <p className="mt-1.5 truncate text-xs text-muted-foreground">{itemSummary(order)}</p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <OrderStatusBadge status={order.status} />
                <PaymentStatusBadge status={order.payment?.status ?? null} />
                <span className="ml-auto text-xs text-muted-foreground">{formatDate(order.created_at)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
