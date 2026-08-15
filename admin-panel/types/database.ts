/**
 * Shape of the Repli Supabase schema, hand-kept in sync with
 * `supabase/migrations/*.sql` in the bot repo.
 *
 * Only what the admin panel touches is typed here. If you change a migration,
 * change this file in the same commit.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

/** orders.status - matches the CHECK constraint in 001_initial_schema.sql */
export const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'PAYMENT_VERIFYING',
  'CONFIRMED',
  'CANCELLED',
  'PAYMENT_FAILED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** payments.status */
export const PAYMENT_STATUSES = ['PENDING', 'PROOF_RECEIVED', 'VERIFIED', 'REJECTED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** conversations.mode */
export const CONVERSATION_MODES = ['BOT', 'HUMAN'] as const;
export type ConversationMode = (typeof CONVERSATION_MODES)[number];

/** conversations.state */
export const CONVERSATION_STATES = [
  'START',
  'SELECT_PRODUCT',
  'SELECT_COLOR',
  'SELECT_SIZE',
  'SELECT_QUANTITY',
  'COLLECT_DETAILS',
  'ORDER_SUMMARY',
  'WAITING_FOR_PAYMENT',
  'PAYMENT_VERIFYING',
  'CONFIRMED',
  'HUMAN_HANDOFF',
  'CANCELLED',
] as const;
export type ConversationState = (typeof CONVERSATION_STATES)[number];

/** messages.direction */
export type MessageDirection = 'INCOMING' | 'OUTGOING';

export interface CustomerRow {
  id: string;
  phone: string;
  name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pin: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationRow {
  id: string;
  customer_id: string | null;
  phone: string;
  state: ConversationState;
  mode: ConversationMode;
  selected_product_id: string | null;
  selected_variant_id: string | null;
  quantity: number | null;
  current_order_id: string | null;
  data: Json;
  last_read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  message_id: string | null;
  phone: string;
  direction: MessageDirection;
  message_type: string;
  text: string | null;
  media_url: string | null;
  created_at: string;
}

export interface ProductRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  emoji: string | null;
  price: number;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProductVariantRow {
  id: string;
  product_id: string;
  color: string | null;
  size: string | null;
  sku: string | null;
  stock_quantity: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderRow {
  id: string;
  order_id: string;
  customer_id: string | null;
  phone: string;
  status: OrderStatus;
  customer_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pin: string | null;
  subtotal: number;
  shipping: number;
  total: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name_snapshot: string;
  color_snapshot: string | null;
  size_snapshot: string | null;
  unit_price: number;
  quantity: number;
  subtotal: number;
  created_at: string;
}

export interface PaymentRow {
  id: string;
  order_id: string;
  amount: number;
  status: PaymentStatus;
  proof_url: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BypassNumberRow {
  id: string;
  phone: string;
  name: string | null;
  active: boolean;
  created_at: string;
}

export interface AdminNumberRow {
  id: string;
  phone: string;
  name: string | null;
  active: boolean;
  created_at: string;
}

export interface AppSettingRow {
  key: string;
  value: string | null;
  updated_at: string;
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminActionRow {
  id: string;
  actor: string;
  actor_type: 'PANEL' | 'WHATSAPP' | 'SYSTEM';
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Json;
  created_at: string;
}

export interface OutboundMessageRow {
  id: string;
  phone: string;
  text: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  attempts: number;
  error: string | null;
  requested_by: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Result shape of the confirm_order_payment / reject_order_payment RPCs. */
export interface PaymentRpcResult {
  ok: boolean;
  reason?: 'NOT_FOUND' | 'ALREADY_CONFIRMED' | 'CANCELLED';
  order_id?: string;
  phone?: string;
  short?: boolean;
  stock?: Array<{
    variant_id: string;
    product: string;
    color: string | null;
    size: string | null;
    before: number;
    after: number;
  }>;
}
