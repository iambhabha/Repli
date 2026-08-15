import { cn } from '@/lib/utils/cn';
import type { ConversationMode, OrderStatus, PaymentStatus } from '@/types/database';
import { ORDER_STATUS_LABELS } from '@/types/order';
import { PAYMENT_STATUS_LABELS } from '@/types/payment';
import type { StockLevel } from '@/types/product';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

/**
 * Monochrome status ladder.
 *
 * With no hue available, each state gets a different *weight*: settled things
 * are filled, things still in motion are outlined, closed things recede into
 * grey. The label is always spelled out next to it, so nothing here is the
 * only carrier of meaning — which is exactly what makes the palette safe.
 */
const TONES: Record<Tone, string> = {
  // closed / no longer needs you
  neutral: 'bg-muted text-muted-foreground',
  // done — filled, the heaviest thing on the row
  success: 'bg-foreground text-background',
  // waiting on someone — outlined
  warning: 'bg-background text-foreground ring-1 ring-inset ring-foreground/40',
  // failed — double-struck outline, unmistakable next to a filled one
  danger: 'bg-background text-foreground ring-2 ring-inset ring-foreground font-semibold',
  // in progress — faint outline
  info: 'bg-muted text-foreground ring-1 ring-inset ring-border',
  brand: 'bg-foreground/10 text-foreground ring-1 ring-inset ring-foreground/25',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return <span className={cn('badge', TONES[tone], className)}>{children}</span>;
}

const ORDER_TONES: Record<OrderStatus, Tone> = {
  PENDING_PAYMENT: 'warning',
  PAYMENT_VERIFYING: 'info',
  CONFIRMED: 'success',
  CANCELLED: 'neutral',
  PAYMENT_FAILED: 'danger',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={ORDER_TONES[status] ?? 'neutral'}>{ORDER_STATUS_LABELS[status] ?? status}</Badge>;
}

const PAYMENT_TONES: Record<PaymentStatus, Tone> = {
  PENDING: 'neutral',
  PROOF_RECEIVED: 'warning',
  VERIFIED: 'success',
  REJECTED: 'danger',
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus | null }) {
  if (!status) return <Badge tone="neutral">No payment</Badge>;
  return <Badge tone={PAYMENT_TONES[status] ?? 'neutral'}>{PAYMENT_STATUS_LABELS[status] ?? status}</Badge>;
}

export function ModeBadge({ mode }: { mode: ConversationMode }) {
  return (
    <Badge tone={mode === 'HUMAN' ? 'brand' : 'neutral'}>
      <span
        className={cn('h-1.5 w-1.5 rounded-full', mode === 'HUMAN' ? 'bg-primary' : 'bg-muted-foreground/50')}
        aria-hidden
      />
      {mode}
    </Badge>
  );
}

const STOCK_TONES: Record<StockLevel, Tone> = {
  OUT_OF_STOCK: 'danger',
  LOW_STOCK: 'warning',
  IN_STOCK: 'success',
};

const STOCK_LABELS: Record<StockLevel, string> = {
  OUT_OF_STOCK: 'OUT OF STOCK',
  LOW_STOCK: 'LOW STOCK',
  IN_STOCK: 'IN STOCK',
};

export function StockBadge({ level }: { level: StockLevel }) {
  return <Badge tone={STOCK_TONES[level]}>{STOCK_LABELS[level]}</Badge>;
}
