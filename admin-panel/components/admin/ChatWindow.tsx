'use client';

import {
  ArrowLeft,
  Bot,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Receipt,
  Send,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { toast } from '@/components/ui/Toast';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import { formatDate, formatPhone, formatTime, initials } from '@/lib/utils/format';
import type { ConversationMode, MessageRow, OutboundMessageRow } from '@/types/database';
import type { ChatThread } from '@/types/message';

export interface ProofRef {
  paymentId: string;
  orderCode: string;
  createdAt: string;
}

/** A screenshot and the message that carried it arrive within seconds of each other. */
const PROOF_MATCH_WINDOW_MS = 3 * 60 * 1000;

export function ChatWindow({
  thread,
  queued,
  proofs,
}: {
  thread: ChatThread;
  queued: OutboundMessageRow[];
  proofs: ProofRef[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<ConversationMode>(thread.mode);
  const [switchingMode, setSwitchingMode] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  /**
   * Locally echoed replies. They disappear as soon as the same text comes back
   * from the server - either as a queued row or as a real OUTGOING message -
   * so nothing is ever shown twice.
   */
  const [pending, setPending] = useState<{ id: number; text: string }[]>([]);

  useEffect(() => {
    setMode(thread.mode);
  }, [thread.mode, thread.phone]);

  useEffect(() => {
    setPending((current) =>
      current.filter(
        (item) =>
          !queued.some((row) => row.text === item.text) &&
          !thread.messages.some(
            (message) => message.direction === 'OUTGOING' && message.text === item.text
          )
      )
    );
  }, [queued, thread.messages]);

  // Opening a chat is what marks it read - the badge must not clear on hover.
  useEffect(() => {
    api.post('/api/messages/read', { phone: thread.phone }).catch(() => {
      /* a stale badge is not worth an error toast */
    });
  }, [thread.phone]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [thread.messages.length, thread.phone, pending.length]);

  const send = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const text = draft.trim();
      if (!text || sending) return;

      setSending(true);
      setDraft('');
      setPending((current) => [...current, { id: Date.now(), text }]);

      try {
        const result = await api.post<{ delivered: boolean }>('/api/messages/send', {
          phone: thread.phone,
          text,
        });
        toast(
          result.delivered
            ? 'Message sent on WhatsApp.'
            : 'Message queued — the bot will send it as soon as it is online.',
          result.delivered ? 'success' : 'info'
        );
        router.refresh();
      } catch (error) {
        setDraft(text);
        setPending((current) => current.filter((item) => item.text !== text));
        toast(error instanceof Error ? error.message : 'Could not send the message.', 'error');
      } finally {
        setSending(false);
      }
    },
    [draft, sending, thread.phone, router]
  );

  async function toggleMode() {
    const next: ConversationMode = mode === 'BOT' ? 'HUMAN' : 'BOT';
    if (!thread.conversationId) {
      toast('This conversation has not started yet.', 'error');
      return;
    }

    setSwitchingMode(true);
    try {
      await api.post(
        `/api/conversations/${thread.conversationId}/${next === 'HUMAN' ? 'takeover' : 'resume'}`
      );
      setMode(next);
      toast(
        next === 'HUMAN'
          ? 'You have taken over. Repli will stay silent for this number.'
          : 'Repli is answering this customer again.'
      );
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not change the mode.', 'error');
    } finally {
      setSwitchingMode(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ------------------------------------------------------------ header */}
      <header className="flex items-center gap-3 border-b border-border bg-card px-3 py-3 sm:px-4">
        <Link
          href="/admin/messages"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent lg:hidden"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
          {initials(thread.name, thread.phone)}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {thread.name || formatPhone(thread.phone)}
          </p>
          <p className="truncate text-xs text-muted-foreground">{formatPhone(thread.phone)}</p>
        </div>

        <span
          className={cn(
            'badge hidden sm:inline-flex',
            mode === 'HUMAN'
              ? 'bg-foreground text-background'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {mode === 'HUMAN' ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
          {mode} MODE
        </span>

        <button
          type="button"
          onClick={toggleMode}
          disabled={switchingMode}
          className={mode === 'BOT' ? 'btn-primary' : 'btn-secondary'}
        >
          {switchingMode ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === 'BOT' ? 'Take over' : 'Return to bot'}
        </button>

        {thread.customerId ? (
          <Link
            href={`/admin/customers/${thread.customerId}`}
            className="hidden rounded-lg p-2 text-muted-foreground hover:bg-accent sm:block"
            aria-label="Open customer profile"
            title="Open customer profile"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        ) : null}
      </header>

      {mode === 'HUMAN' ? (
        <p className="border-b border-border bg-muted px-4 py-2 text-xs font-medium text-foreground">
          Human mode — Repli is not replying to this customer. Your messages go out as you.
        </p>
      ) : null}

      {/* ---------------------------------------------------------- messages */}
      <div className="scrollbar-thin min-h-0 flex-1 space-y-1 overflow-y-auto bg-chat-bg px-3 py-4 sm:px-6">
        {thread.messages.length === 0 && !queued.length ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No messages in this conversation yet.
          </p>
        ) : null}

        {thread.messages.map((message, index) => (
          <Bubble
            key={message.id}
            message={message}
            previous={thread.messages[index - 1] ?? null}
            proof={findProof(message, proofs)}
          />
        ))}

        {queued.map((item) => (
          <PendingBubble key={item.id} text={item.text} failed={item.status === 'FAILED'} />
        ))}

        {pending.map((item) => (
          <PendingBubble key={item.id} text={item.text} failed={false} />
        ))}

        <div ref={bottomRef} />
      </div>

      {/* --------------------------------------------------------- composer */}
      <form onSubmit={send} className="flex items-end gap-2 border-t border-border bg-card p-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send(event);
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Type message…"
          aria-label="Message"
          className="input max-h-32 min-h-10 flex-1 resize-y"
        />
        <button type="submit" disabled={!draft.trim() || sending} className="btn-primary h-10">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  );
}

function Bubble({
  message,
  previous,
  proof,
}: {
  message: MessageRow;
  previous: MessageRow | null;
  proof: ProofRef | null;
}) {
  const outgoing = message.direction === 'OUTGOING';
  const showDay =
    !previous || formatDate(previous.created_at) !== formatDate(message.created_at);

  return (
    <>
      {showDay ? (
        <div className="flex justify-center py-2">
          <span className="rounded-full bg-card px-3 py-1 ring-1 ring-border text-[11px] font-medium text-muted-foreground shadow-sm">
            {formatDate(message.created_at)}
          </span>
        </div>
      ) : null}

      <div className={cn('flex', outgoing ? 'justify-end' : 'justify-start')}>
        <div
          className={cn(
            'max-w-[85%] rounded-2xl px-3 py-2 shadow-sm sm:max-w-[70%]',
            outgoing
              ? 'rounded-br-sm bg-chat-out text-chat-out-foreground'
              : 'rounded-bl-sm bg-chat-in text-foreground ring-1 ring-border'
          )}
        >
          {proof ? (
            <div className="mb-2 rounded-lg border border-border bg-muted p-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Receipt className="h-3.5 w-3.5" />
                PAYMENT PROOF
              </p>
              <p className="mt-0.5 text-[11px] text-foreground">{proof.orderCode}</p>
              <a
                href={`/api/payments/${proof.paymentId}/proof`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary mt-2 w-full py-1 text-xs"
              >
                View
              </a>
            </div>
          ) : message.message_type === 'media' && !proof ? (
            <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ImageIcon className="h-3.5 w-3.5" />
              {message.media_url ? 'Image' : 'Image received on WhatsApp'}
            </p>
          ) : null}

          {message.text ? (
            // No text colour here on purpose: the bubble decides it, and an
            // outgoing bubble is black.
            <p className="text-sm whitespace-pre-wrap">{message.text}</p>
          ) : null}

          <p
            className={cn(
              'mt-1 text-[10px]',
              outgoing ? 'text-right text-chat-out-foreground/60' : 'text-muted-foreground'
            )}
          >
            {formatTime(message.created_at)}
          </p>
        </div>
      </div>
    </>
  );
}

function PendingBubble({ text, failed }: { text: string; failed: boolean }) {
  return (
    <div className="flex justify-end">
      <div
        className={cn(
          'max-w-[85%] rounded-2xl rounded-br-sm px-3 py-2 shadow-sm sm:max-w-[70%]',
          failed ? 'bg-muted ring-1 ring-foreground' : 'bg-chat-out/75 text-chat-out-foreground'
        )}
      >
        <p className="text-sm whitespace-pre-wrap">{text}</p>
        <p
          className={cn(
            'mt-1 flex items-center justify-end gap-1 text-[10px]',
            failed ? 'text-muted-foreground' : 'text-chat-out-foreground/60'
          )}
        >
          <Clock className="h-3 w-3" />
          {failed ? 'Could not send — the bot will retry' : 'Waiting for the bot to send'}
        </p>
      </div>
    </div>
  );
}

/**
 * The bot stores the screenshot against the payment, not the message, so the
 * two are matched on time. A few minutes is generous and unambiguous: a
 * customer sends one proof per order.
 */
function findProof(message: MessageRow, proofs: ProofRef[]): ProofRef | null {
  if (message.direction !== 'INCOMING' || message.message_type !== 'media') return null;
  const at = new Date(message.created_at).getTime();

  return (
    proofs.find(
      (proof) => Math.abs(new Date(proof.createdAt).getTime() - at) <= PROOF_MATCH_WINDOW_MS
    ) ?? null
  );
}
