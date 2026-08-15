'use client';

import { Ban, Check, Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { api } from '@/lib/api/client';

type Action = 'verify' | 'reject' | 'cancel';

const COPY: Record<Action, { title: string; body: string; confirm: string }> = {
  verify: {
    title: 'Verify this payment?',
    body:
      'Confirm only after you have seen the money in your account. This confirms the order, ' +
      'reduces stock, moves the chat to human mode and sends the customer a confirmation on WhatsApp. ' +
      'It cannot be undone from the panel.',
    confirm: 'Verify payment',
  },
  reject: {
    title: 'Reject this payment?',
    body:
      'The order is marked as failed and the customer is told the payment could not be verified. ' +
      'Stock is not touched.',
    confirm: 'Reject payment',
  },
  cancel: {
    title: 'Cancel this order?',
    body: 'The order is cancelled and the customer is told. Stock is not touched.',
    confirm: 'Cancel order',
  },
};

/**
 * §17-19. Every one of these is a real, irreversible business action, so each
 * asks first and every one of them is written to the audit log server-side.
 */
export function PaymentActions({
  orderCode,
  canVerify,
  canReject,
  canCancel,
  compact = false,
}: {
  orderCode: string;
  canVerify: boolean;
  canReject: boolean;
  canCancel: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: Action) {
    setBusy(true);
    try {
      const path =
        action === 'verify'
          ? `/api/orders/${orderCode}/verify-payment`
          : action === 'reject'
            ? `/api/orders/${orderCode}/reject-payment`
            : `/api/orders/${orderCode}/cancel`;

      const result = await api.post<{ message: string; queued?: boolean }>(path);

      toast(result.message, 'success');
      if (result.queued) {
        toast('The WhatsApp message is queued — it goes out when the bot is online.', 'info');
      }
      setPending(null);
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Something went wrong. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  }

  const size = compact ? 'py-1.5 text-xs' : '';

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {canVerify ? (
          <button type="button" onClick={() => setPending('verify')} className={`btn-primary ${size}`}>
            <Check className="h-4 w-4" />
            Verify payment
          </button>
        ) : null}

        {canReject ? (
          <button type="button" onClick={() => setPending('reject')} className={`btn-danger ${size}`}>
            <X className="h-4 w-4" />
            Reject payment
          </button>
        ) : null}

        {canCancel ? (
          <button type="button" onClick={() => setPending('cancel')} className={`btn-secondary ${size}`}>
            <Ban className="h-4 w-4" />
            Cancel order
          </button>
        ) : null}
      </div>

      <Modal
        open={pending !== null}
        onClose={() => (busy ? undefined : setPending(null))}
        title={pending ? COPY[pending].title : ''}
        description={orderCode}
      >
        <p className="text-sm text-muted-foreground">{pending ? COPY[pending].body : ''}</p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setPending(null)}
            disabled={busy}
            className="btn-secondary"
          >
            Go back
          </button>
          <button
            type="button"
            onClick={() => pending && run(pending)}
            disabled={busy}
            className={pending === 'verify' ? 'btn-primary' : 'btn-danger'}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {pending ? COPY[pending].confirm : ''}
          </button>
        </div>
      </Modal>
    </>
  );
}
