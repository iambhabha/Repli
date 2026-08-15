import { Users } from 'lucide-react';
import Link from 'next/link';

import { ModeBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/States';
import { formatCurrency, formatDate, formatInboxTime, formatPhone, truncate } from '@/lib/utils/format';
import type { CustomerListItem } from '@/types/customer';

/**
 * §13. A real table on desktop, stacked cards on a phone - the owner does most
 * of this from their pocket, and a horizontally scrolling table is useless there.
 */
export function CustomerTable({ customers, query }: { customers: CustomerListItem[]; query: string }) {
  if (!customers.length) {
    return (
      <EmptyState
        title={query ? 'No customers match that search.' : 'No customers yet.'}
        hint={
          query
            ? 'Try part of a name, a phone number or a city.'
            : 'Every person who messages your WhatsApp is saved here automatically.'
        }
        icon={<Users className="h-6 w-6" />}
      />
    );
  }

  return (
    <>
      {/* ------------------------------------------------------- desktop */}
      <div className="table-wrap hidden md:block">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="th">Customer</th>
              <th className="th">City</th>
              <th className="th text-right">Orders</th>
              <th className="th text-right">Total Spent</th>
              <th className="th">Mode</th>
              <th className="th">Last Message</th>
              <th className="th">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {customers.map((customer) => (
              <tr key={customer.id} className="transition-colors hover:bg-muted/50">
                <td className="td">
                  <Link href={`/admin/customers/${customer.id}`} className="block">
                    <span className="block font-medium text-foreground">
                      {customer.name || 'Unnamed'}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatPhone(customer.phone)}
                    </span>
                  </Link>
                </td>
                <td className="td">{customer.city || '—'}</td>
                <td className="td text-right tabular-nums">{customer.ordersCount}</td>
                <td className="td text-right font-medium tabular-nums">
                  {formatCurrency(customer.totalSpent)}
                </td>
                <td className="td">
                  <ModeBadge mode={customer.mode} />
                </td>
                <td className="td max-w-56">
                  <span className="block truncate text-muted-foreground">
                    {truncate(customer.lastMessageText, 40) || '—'}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {customer.lastMessageAt ? formatInboxTime(customer.lastMessageAt) : ''}
                  </span>
                </td>
                <td className="td whitespace-nowrap text-muted-foreground">
                  {formatDate(customer.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* -------------------------------------------------------- mobile */}
      <ul className="divide-y divide-border md:hidden">
        {customers.map((customer) => (
          <li key={customer.id}>
            <Link href={`/admin/customers/${customer.id}`} className="block px-4 py-3.5 active:bg-muted/60">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {customer.name || 'Unnamed'}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatPhone(customer.phone)}</p>
                </div>
                <ModeBadge mode={customer.mode} />
              </div>

              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{customer.ordersCount} orders</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(customer.totalSpent)}
                </span>
                {customer.city ? <span>{customer.city}</span> : null}
                {customer.unreadCount > 0 ? (
                  <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    {customer.unreadCount} new
                  </span>
                ) : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
