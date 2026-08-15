'use client';

import { useRouter } from 'next/navigation';
import { useRef } from 'react';

import { useRealtime, type RealtimeTable } from '@/lib/realtime/useRealtime';

/**
 * Drop this into any Server Component page to make it live: when the server
 * relays a change on one of `tables`, the page re-renders with fresh data.
 *
 * Refreshes are throttled so a burst of inserts (a customer typing three
 * messages) costs one render, not three.
 */
export function RealtimeRefresh({
  tables,
  throttleMs = 1200,
  pollMs = 20000,
}: {
  tables: RealtimeTable[];
  throttleMs?: number;
  pollMs?: number;
}) {
  const router = useRouter();
  const lastRefresh = useRef(0);
  const timer = useRef<number | null>(null);

  useRealtime(
    tables,
    () => {
      const now = Date.now();
      const elapsed = now - lastRefresh.current;

      if (elapsed >= throttleMs) {
        lastRefresh.current = now;
        router.refresh();
        return;
      }

      if (timer.current !== null) return;
      timer.current = window.setTimeout(() => {
        timer.current = null;
        lastRefresh.current = Date.now();
        router.refresh();
      }, throttleMs - elapsed);
    },
    { pollMs }
  );

  return null;
}
