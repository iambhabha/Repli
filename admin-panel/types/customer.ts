import type { ConversationMode, ConversationState, CustomerRow } from './database';

export type Customer = CustomerRow;

/**
 * A customer plus the derived numbers the CRM table shows.
 * `state` on CustomerRow is the postal state, so the chat state gets its own
 * name here - two different things must never share a field.
 */
export interface CustomerListItem extends CustomerRow {
  mode: ConversationMode;
  conversationState: ConversationState | null;
  ordersCount: number;
  totalSpent: number;
  lastMessageAt: string | null;
  lastMessageText: string | null;
  unreadCount: number;
}

export interface CustomerStats {
  ordersCount: number;
  confirmedCount: number;
  totalSpent: number;
  customerSince: string;
}

export type CustomerModeFilter = 'ALL' | ConversationMode;
