import type { OrderItemRow, OrderRow, OrderStatus, PaymentRow } from './database';

export type Order = OrderRow;
export type OrderItem = OrderItemRow;

/** Order joined with its items and payment - what the tables and detail page use. */
export interface OrderWithDetails extends OrderRow {
  items: OrderItemRow[];
  payment: PaymentRow | null;
}

export type OrderStatusFilter = 'ALL' | OrderStatus;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Pending Payment',
  PAYMENT_VERIFYING: 'Payment Verifying',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
  PAYMENT_FAILED: 'Rejected',
};
