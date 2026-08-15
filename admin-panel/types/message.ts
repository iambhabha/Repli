import type {
  ConversationMode,
  ConversationRow,
  ConversationState,
  MessageRow,
} from './database';

export type Message = MessageRow;
export type Conversation = ConversationRow;

/** One row in the inbox list on /admin/messages. */
export interface InboxItem {
  conversationId: string | null;
  phone: string;
  name: string | null;
  mode: ConversationMode;
  state: ConversationState | null;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  lastMessageDirection: 'INCOMING' | 'OUTGOING' | null;
  unreadCount: number;
}

/** Everything the chat pane needs for one phone number. */
export interface ChatThread {
  phone: string;
  name: string | null;
  customerId: string | null;
  conversationId: string | null;
  mode: ConversationMode;
  state: ConversationState | null;
  messages: MessageRow[];
}
