'use client';

import { useEffect, useRef } from 'react';

export type RealtimeTable =
  | 'messages'
  | 'orders'
  | 'payments'
  | 'product_variants'
  | 'conversations'
  | 'customers'
  | 'app_settings';

export interface RealtimeEvent {
  table: RealtimeTable;
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  phone?: string | null;
  orderId?: string | null;
  at: string;
}

/**
 * Live updates without putting a database key in the browser.
 *
 * RLS denies anon and authenticated everything (004_rls.sql), so a browser
 * Supabase subscription would receive nothing. Instead the server subscribes
 * with the secret key and relays a thin event over SSE - the payload carries
 * no customer data, just "something changed in <table>", and the page decides
 * what to refetch.
 *
 * If the stream drops (sleeping phone, serverless timeout) EventSource
 * reconnects on its own; `pollMs` is the belt-and-braces fallback.
 */
export function useRealtime(
  tables: RealtimeTable[],
  onEvent: (event: RealtimeEvent) => void,
  options: { pollMs?: number; enabled?: boolean } = {}
) {
  const { pollMs = 20000, enabled = true } = options;
  const handler = useRef(onEvent);
  handler.current = onEvent;

  const key = tables.join(',');

  useEffect(() => {
    if (!enabled) return;

    let source: EventSource | null = null;
    let closed = false;

    try {
      source = new EventSource(`/api/realtime/stream?tables=${encodeURIComponent(key)}`);
      source.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as RealtimeEvent;
          if (parsed?.table) handler.current(parsed);
        } catch {
          // Heartbeats and comments are not JSON - ignore them.
        }
      };
      source.onerror = () => {
        // EventSource retries automatically; the poll below covers the gap.
      };
    } catch {
      source = null;
    }

    const timer = window.setInterval(() => {
      if (closed) return;
      handler.current({ table: tables[0] ?? 'messages', type: 'UPDATE', at: new Date().toISOString() });
    }, pollMs);

    return () => {
      closed = true;
      window.clearInterval(timer);
      source?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, pollMs]);
}
