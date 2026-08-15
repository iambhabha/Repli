'use client';

import { MessageCircle } from 'lucide-react';
import Link from 'next/link';

import { EmptyState } from '@/components/ui/States';
import { cn } from '@/lib/utils/cn';
import { formatInboxTime, formatPhone, initials, truncate } from '@/lib/utils/format';
import type { InboxItem } from '@/types/message';

/**
 * The left-hand conversation list. A Client Component only so the selected
 * row can highlight instantly - the data itself is fetched on the server.
 */
export function MessageList({
  threads,
  selectedPhone,
  query,
}: {
  threads: InboxItem[];
  selectedPhone: string | null;
  query: string;
}) {
  if (!threads.length) {
    return (
      <EmptyState
        title={query ? 'No conversations match that search.' : 'No messages yet.'}
        hint={
          query
            ? 'Try a name or a phone number.'
            : 'As soon as somebody messages your WhatsApp, the chat appears here.'
        }
        icon={<MessageCircle className="h-6 w-6" />}
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {threads.map((thread) => {
        const active = thread.phone === selectedPhone;
        return (
          <li key={thread.phone}>
            <Link
              href={`/admin/messages?phone=${thread.phone}`}
              scroll={false}
              className={cn(
                'flex gap-3 px-3 py-3 transition-colors',
                active ? 'bg-muted' : 'hover:bg-muted/50'
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                {initials(thread.name, thread.phone)}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {thread.name || formatPhone(thread.phone)}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {thread.lastMessageAt ? formatInboxTime(thread.lastMessageAt) : ''}
                  </span>
                </span>

                <span className="mt-0.5 flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {thread.lastMessageDirection === 'OUTGOING' ? (
                      <span className="text-muted-foreground">Repli: </span>
                    ) : null}
                    {truncate(thread.lastMessageText, 46) || '📎 Media'}
                  </span>
                  {thread.unreadCount > 0 ? (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                      {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
                    </span>
                  ) : null}
                </span>

                <span className="mt-1.5 flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{formatPhone(thread.phone)}</span>
                  <span
                    className={cn(
                      'badge px-1.5 py-0 text-[10px]',
                      thread.mode === 'HUMAN'
                        ? 'bg-foreground text-background'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {thread.mode}
                  </span>
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
