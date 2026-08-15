import { CreditCard, Receipt } from 'lucide-react';
import Link from 'next/link';

import { PaymentActions } from '@/components/admin/PaymentActions';
import { PaymentStatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/States';
import { formatCurrency, formatDateTime, formatPhone } from '@/lib/utils/format';
import type { PaymentWithOrder } from '@/types/payment';

/**
 * §18. Cards rather than a table: each row is a decision ("did this money
 * arrive?"), and a decision needs the proof button next to the amount - on a
 * phone as much as on a laptop.
 */
export function PaymentTable({ payments, query }: { payments: PaymentWithOrder[]; query: string }) {
  if (!payments.length) {
    return (
      <EmptyState
        title={query ? 'No payments match that search.' : 'No pending payments.'}
        hint={
          query
            ? 'Search by order id or phone number.'
            : 'When a customer sends a payment screenshot it lands here for you to verify.'
        }
        icon={<CreditCard className="h-6 w-6" />}
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {payments.map((payment) => {
        const actionable = payment.status === 'PROOF_RECEIVED' || payment.status === 'PENDING';
        const orderOpen =
          payment.orderStatus !== 'CONFIRMED' && payment.orderStatus !== 'CANCELLED';

        return (
          <li key={payment.id} className="px-4 py-4">
            <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/orders/${payment.orderCode}`}
                    className="text-sm font-semibold text-primary hover:text-primary"
                  >
                    {payment.orderCode}
                  </Link>
                  <PaymentStatusBadge status={payment.status} />
                </div>

                <p className="mt-1 text-sm text-foreground">
                  {payment.customerName || 'Unnamed'}
                  <span className="text-muted-foreground"> · </span>
                  <span className="text-muted-foreground">{formatPhone(payment.phone)}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Received {formatDateTime(payment.created_at)}
                  {payment.verified_by ? ` · handled by ${payment.verified_by}` : ''}
                </p>
              </div>

              <div className="text-right">
                <p className="text-lg font-semibold text-foreground tabular-nums">
                  {formatCurrency(payment.amount || payment.orderTotal)}
                </p>
                {payment.proof_url ? (
                  <a
                    href={`/api/payments/${payment.id}/proof`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary mt-1 py-1 text-xs"
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    View proof
                  </a>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">No proof attached</p>
                )}
              </div>
            </div>

            {actionable && orderOpen ? (
              <div className="mt-3">
                <PaymentActions
                  orderCode={payment.orderCode}
                  canVerify
                  canReject={payment.status === 'PROOF_RECEIVED'}
                  canCancel={false}
                  compact
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
