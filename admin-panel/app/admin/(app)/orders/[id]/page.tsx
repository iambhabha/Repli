import type { Metadata } from 'next';
import { ArrowLeft, ExternalLink, MessageCircle, Receipt } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PaymentActions } from '@/components/admin/PaymentActions';
import { RealtimeRefresh } from '@/components/admin/RealtimeRefresh';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/ui/Badge';
import { getCustomerByPhone } from '@/lib/services/customers';
import { getOrder } from '@/lib/services/orders';
import { formatCurrency, formatDateTime, formatPhone } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Order' };
export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrder(decodeURIComponent(id));
  if (!order) notFound();

  const customer = await getCustomerByPhone(order.phone);
  const payment = order.payment;

  const isOpen = order.status !== 'CONFIRMED' && order.status !== 'CANCELLED';
  const canVerify = isOpen;
  const canReject = isOpen && order.status !== 'PENDING_PAYMENT';
  const canCancel = isOpen;

  return (
    <div className="space-y-5">
      <RealtimeRefresh tables={['orders', 'payments']} pollMs={30000} />

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/orders"
          className="rounded-lg p-2 text-muted-foreground hover:bg-accent"
          aria-label="Back to orders"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{order.order_id}</h1>
          <p className="text-sm text-muted-foreground">Placed {formatDateTime(order.created_at)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ---------------------------------------------------- products */}
        <section className="card overflow-hidden lg:col-span-2">
          <h2 className="border-b border-border px-5 py-3 text-sm font-semibold text-foreground">
            Products
          </h2>

          {order.items.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">This order has no line items.</p>
          ) : (
            <div className="table-wrap">
              <table className="w-full">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="th">Product</th>
                    <th className="th">Colour</th>
                    <th className="th">Size</th>
                    <th className="th text-right">Qty</th>
                    <th className="th text-right">Price</th>
                    <th className="th text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="td font-medium text-foreground">{item.product_name_snapshot}</td>
                      <td className="td">{item.color_snapshot || '—'}</td>
                      <td className="td">{item.size_snapshot || '—'}</td>
                      <td className="td text-right tabular-nums">{item.quantity}</td>
                      <td className="td text-right tabular-nums">{formatCurrency(item.unit_price)}</td>
                      <td className="td text-right font-medium tabular-nums">
                        {formatCurrency(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <dl className="space-y-2 border-t border-border px-5 py-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums">{formatCurrency(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd className="tabular-nums">{formatCurrency(order.shipping)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatCurrency(order.total)}</dd>
            </div>
          </dl>
        </section>

        {/* ---------------------------------------------------- customer */}
        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Customer</h2>
          <p className="text-sm font-medium text-foreground">{order.customer_name || 'Unnamed'}</p>
          <p className="text-sm text-muted-foreground">{formatPhone(order.phone)}</p>

          <address className="mt-4 space-y-0.5 text-sm text-muted-foreground not-italic">
            {order.address ? <p>{order.address}</p> : null}
            <p>{[order.city, order.state].filter(Boolean).join(', ') || '—'}</p>
            {order.pin ? <p>PIN {order.pin}</p> : null}
          </address>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/admin/messages?phone=${order.phone}`} className="btn-secondary">
              <MessageCircle className="h-4 w-4" />
              Chat
            </Link>
            {customer ? (
              <Link href={`/admin/customers/${customer.id}`} className="btn-secondary">
                <ExternalLink className="h-4 w-4" />
                Profile
              </Link>
            ) : null}
          </div>
        </section>
      </div>

      {/* ------------------------------------------------------- payment */}
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Payment</h2>
          <PaymentStatusBadge status={payment?.status ?? null} />
        </div>

        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Amount" value={formatCurrency(payment?.amount ?? order.total)} />
          <Field
            label="Proof"
            value={payment?.proof_url ? 'Screenshot received' : 'No proof received'}
          />
          <Field label="Verified by" value={payment?.verified_by || '—'} />
          <Field
            label="Verified at"
            value={payment?.verified_at ? formatDateTime(payment.verified_at) : '—'}
          />
        </dl>

        {payment?.proof_url ? (
          <a
            href={`/api/payments/${payment.id}/proof`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary mt-4"
          >
            <Receipt className="h-4 w-4" />
            View proof
          </a>
        ) : null}

        <div className="mt-5 border-t border-border pt-4">
          {canVerify || canReject || canCancel ? (
            <PaymentActions
              orderCode={order.order_id}
              canVerify={canVerify}
              canReject={canReject}
              canCancel={canCancel}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {order.status === 'CONFIRMED'
                ? 'This order is confirmed. Stock has already been reduced.'
                : 'This order is closed.'}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 text-foreground">{value}</dd>
    </div>
  );
}
