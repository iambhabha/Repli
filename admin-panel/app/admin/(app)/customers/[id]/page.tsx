import type { Metadata } from 'next';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ModeBadge, OrderStatusBadge, PaymentStatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/States';
import { getCustomerDetail } from '@/lib/services/customers';
import { cn } from '@/lib/utils/cn';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPhone,
  formatTime,
} from '@/lib/utils/format';
import { first } from '@/lib/utils/pagination';

export const metadata: Metadata = { title: 'Customer' };
export const dynamic = 'force-dynamic';

const TABS = ['overview', 'messages', 'orders', 'payments'] as const;
type Tab = (typeof TABS)[number];

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const requested = (first(query.tab) ?? 'overview') as Tab;
  const tab: Tab = TABS.includes(requested) ? requested : 'overview';

  const detail = await getCustomerDetail(id);
  if (!detail) notFound();

  const { customer, conversation, stats, orders, payments, messages } = detail;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/customers"
          className="rounded-lg p-2 text-muted-foreground hover:bg-accent"
          aria-label="Back to customers"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">
            {customer.name || 'Unnamed customer'}
          </h1>
          <p className="text-sm text-muted-foreground">{formatPhone(customer.phone)}</p>
        </div>
        <ModeBadge mode={conversation?.mode ?? 'BOT'} />
        <Link href={`/admin/messages?phone=${customer.phone}`} className="btn-primary">
          <MessageCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Open chat</span>
        </Link>
      </div>

      {/* ------------------------------------------------------------ stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total Orders" value={String(stats.ordersCount)} />
        <Stat label="Confirmed Orders" value={String(stats.confirmedCount)} />
        <Stat label="Total Spent" value={formatCurrency(stats.totalSpent)} />
        <Stat label="Customer Since" value={formatDate(stats.customerSince)} />
      </div>

      {/* ------------------------------------------------------------- tabs */}
      <nav className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((item) => (
          <Link
            key={item}
            href={`/admin/customers/${customer.id}?tab=${item}`}
            scroll={false}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition-colors',
              tab === item
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {item}
          </Link>
        ))}
      </nav>

      {tab === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Profile</h2>
            <dl className="space-y-3 text-sm">
              <Row label="Name" value={customer.name} />
              <Row label="Phone" value={formatPhone(customer.phone)} />
              <Row label="Address" value={customer.address} />
              <Row label="City" value={customer.city} />
              <Row label="State" value={customer.state} />
              <Row label="PIN" value={customer.pin} />
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Conversation</h2>
            <dl className="space-y-3 text-sm">
              <Row label="Mode" value={conversation?.mode ?? 'BOT'} />
              <Row label="Flow state" value={conversation?.state ?? '—'} />
              <Row
                label="Last activity"
                value={conversation ? formatDateTime(conversation.updated_at) : '—'}
              />
              <Row label="Messages" value={String(messages.length)} />
            </dl>
          </section>
        </div>
      ) : null}

      {/* --------------------------------------------------------- messages */}
      {tab === 'messages' ? (
        <section className="card overflow-hidden">
          {messages.length === 0 ? (
            <EmptyState title="No messages yet." icon={<MessageCircle className="h-6 w-6" />} />
          ) : (
            <div className="scrollbar-thin max-h-[32rem] space-y-2 overflow-y-auto bg-chat-bg p-4">
              {messages.map((message) => {
                const outgoing = message.direction === 'OUTGOING';
                return (
                  <div key={message.id} className={cn('flex', outgoing ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-3 py-2 shadow-sm',
                        outgoing
                          ? 'rounded-br-sm bg-chat-out text-chat-out-foreground'
                          : 'rounded-bl-sm bg-chat-in text-foreground ring-1 ring-border'
                      )}
                    >
                      <p className="mb-0.5 text-[11px] font-medium opacity-70">
                        {outgoing ? 'Repli' : customer.name || 'Customer'}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">
                        {message.text || (message.message_type === 'media' ? '📎 Image' : '')}
                      </p>
                      <p className="mt-1 text-[10px] opacity-60">
                        {formatDate(message.created_at)} · {formatTime(message.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {/* ----------------------------------------------------------- orders */}
      {tab === 'orders' ? (
        <section className="card overflow-hidden">
          {orders.length === 0 ? (
            <EmptyState title="No orders found." hint="This customer has not confirmed an order yet." />
          ) : (
            <ul className="divide-y divide-border">
              {orders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/admin/orders/${order.order_id}`}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{order.order_id}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {order.items
                          .map((item) =>
                            [item.product_name_snapshot, item.color_snapshot, item.size_snapshot]
                              .filter(Boolean)
                              .join(' · ')
                          )
                          .join(', ') || '—'}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCurrency(order.total)}
                    </span>
                    <OrderStatusBadge status={order.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* --------------------------------------------------------- payments */}
      {tab === 'payments' ? (
        <section className="card overflow-hidden">
          {payments.length === 0 ? (
            <EmptyState title="No payments yet." />
          ) : (
            <ul className="divide-y divide-border">
              {payments.map((payment) => (
                <li key={payment.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{payment.orderCode}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDateTime(payment.created_at)}
                      {payment.verified_by ? ` · verified by ${payment.verified_by}` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCurrency(payment.amount)}
                  </span>
                  <PaymentStatusBadge status={payment.status} />
                  {payment.proof_url ? (
                    <a
                      href={`/api/payments/${payment.id}/proof`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary py-1 text-xs"
                    >
                      View
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 text-lg font-semibold text-foreground tabular-nums">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-4">
      <dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 text-foreground">{value || '—'}</dd>
    </div>
  );
}
