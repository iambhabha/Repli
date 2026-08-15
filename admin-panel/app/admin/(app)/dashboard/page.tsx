import type { Metadata } from 'next';
import { ArrowRight, MessageCircle } from 'lucide-react';
import Link from 'next/link';

import { DashboardCards } from '@/components/admin/DashboardCards';
import { OrderStatusBadge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/States';
import { getDashboardData } from '@/lib/services/dashboard';
import { formatCurrency, formatDate, formatInboxTime, formatPhone, truncate } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { stats, recentOrders, recentCustomers, recentMessages, pendingPayments } =
    await getDashboardData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Everything Repli has done, and everything waiting for you."
      />

      <DashboardCards stats={stats} />

      <div className="grid gap-4 xl:grid-cols-2">
        {/* ------------------------------------------------ recent orders */}
        <Panel title="Recent Orders" href="/admin/orders">
          {recentOrders.length === 0 ? (
            <EmptyState title="No orders yet." hint="Orders appear here the moment a customer confirms one on WhatsApp." />
          ) : (
            <ul className="divide-y divide-border">
              {recentOrders.map((order) => (
                <li key={order.orderCode}>
                  <Link
                    href={`/admin/orders/${order.orderCode}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {order.orderCode}
                        <span className="ml-2 font-normal text-muted-foreground">
                          {order.customerName || formatPhone(order.phone)}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                    </div>
                    <span className="text-sm font-semibold text-foreground tabular-nums">
                      {formatCurrency(order.total)}
                    </span>
                    <OrderStatusBadge status={order.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* --------------------------------------------- pending payments */}
        <Panel title="Pending Payments" href="/admin/payments">
          {pendingPayments.length === 0 ? (
            <EmptyState title="No pending payments." hint="Screenshots waiting for verification show up here." />
          ) : (
            <ul className="divide-y divide-border">
              {pendingPayments.map((payment) => (
                <li key={payment.paymentId}>
                  <Link
                    href={`/admin/orders/${payment.orderCode}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{payment.orderCode}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {payment.customerName || formatPhone(payment.phone)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-foreground tabular-nums">
                      {formatCurrency(payment.amount)}
                    </span>
                    <span className="badge bg-muted text-foreground">
                      {payment.hasProof ? 'PROOF' : 'NO PROOF'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* --------------------------------------------- recent customers */}
        <Panel title="Recent Customers" href="/admin/customers">
          {recentCustomers.length === 0 ? (
            <EmptyState title="No customers yet." hint="Anyone who messages your WhatsApp becomes a customer here." />
          ) : (
            <ul className="divide-y divide-border">
              {recentCustomers.map((customer) => (
                <li key={customer.id}>
                  <Link
                    href={`/admin/customers/${customer.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {customer.name || 'Unnamed'}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatPhone(customer.phone)}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(customer.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* ---------------------------------------------- recent messages */}
        <Panel title="Recent Messages" href="/admin/messages">
          {recentMessages.length === 0 ? (
            <EmptyState
              title="No messages yet."
              hint="Start the bot and send yourself a WhatsApp message to see it here."
              icon={<MessageCircle className="h-6 w-6" />}
            />
          ) : (
            <ul className="divide-y divide-border">
              {recentMessages.map((message) => (
                <li key={message.id}>
                  <Link
                    href={`/admin/messages?phone=${message.phone}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <span
                      className={`badge shrink-0 ${
                        message.direction === 'INCOMING'
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-primary/10 text-primary'
                      }`}
                    >
                      {message.direction === 'INCOMING' ? 'IN' : 'OUT'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">
                        {message.message_type === 'media' && !message.text
                          ? '📎 Media'
                          : truncate(message.text, 70)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatPhone(message.phone)}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatInboxTime(message.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Panel({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary"
        >
          View all
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {children}
    </section>
  );
}
