import type { OrderStatus, PaymentRow, PaymentStatus } from './database';

export type Payment = PaymentRow;

/** A payment joined with the order and customer it belongs to. */
export interface PaymentWithOrder extends PaymentRow {
  orderCode: string;
  orderStatus: OrderStatus;
  phone: string;
  customerName: string | null;
  customerId: string | null;
  orderTotal: number;
}

export type PaymentStatusFilter = 'ALL' | PaymentStatus;

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Pending',
  PROOF_RECEIVED: 'Proof Received',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
};
