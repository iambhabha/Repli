'use client';

import { AlertTriangle, Bell, CreditCard, MessageCircle, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api/client';
import { useRealtime } from '@/lib/realtime/useRealtime';
import { cn } from '@/lib/utils/cn';
import { formatInboxTime } from '@/lib/utils/format';

interface Notification {
  id: string;
  kind: 'MESSAGE' | 'PAYMENT_PROOF' | 'ORDER' | 'LOW_STOCK';
  title: string;
  detail: string;
  href: string;
  at: string | null;
}

const ICONS = {
  MESSAGE: MessageCircle,
  PAYMENT_PROOF: CreditCard,
  ORDER: ShoppingBag,
  LOW_STOCK: AlertTriangle,
} as const;

const TONES = {
  MESSAGE: 'bg-muted text-foreground',
  PAYMENT_PROOF: 'bg-muted text-foreground',
  ORDER: 'bg-primary/10 text-primary',
  LOW_STOCK: 'bg-muted text-foreground',
} as const;

/** §29: the bell. Refreshes itself when the server says something changed. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ notifications: Notification[] }>('/api/notifications');
      setItems(data.notifications);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime(['messages', 'orders', 'payments', 'product_variants'], () => {
    void load();
  });

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const count = items.length;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label={`Notifications${count ? `, ${count} waiting` : ''}`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {count > 0 ? (
          <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold text-background">
            {count > 9 ? '9+' : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-[21rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            {count > 0 ? <span className="text-xs text-muted-foreground">{count} waiting</span> : null}
          </div>

          <div className="scrollbar-thin max-h-96 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : failed ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Something went wrong. Please try again.
              </p>
            ) : count === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing needs you right now.</p>
            ) : (
              items.map((item) => {
                const Icon = ICONS[item.kind];
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex gap-3 border-b border-border px-4 py-3 transition-colors last:border-0 hover:bg-muted/50"
                  >
                    <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', TONES[item.kind])}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">{item.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {item.at ? formatInboxTime(item.at) : ''}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
