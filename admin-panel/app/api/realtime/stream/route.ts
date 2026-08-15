import type { NextRequest } from 'next/server';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { requireAdminApi } from '@/lib/auth/guard';
import { supabaseRealtime } from '@/lib/supabase/admin';
import { toResponse } from '@/lib/utils/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_TABLES = [
  'messages',
  'orders',
  'payments',
  'product_variants',
  'conversations',
  'customers',
  'app_settings',
] as const;

type AllowedTable = (typeof ALLOWED_TABLES)[number];

/** Long enough to feel live, short enough to sit inside any serverless limit. */
const MAX_STREAM_MS = 4 * 60 * 1000;
const HEARTBEAT_MS = 25 * 1000;

/**
 * §28. Server-side Supabase Realtime, relayed to the browser over SSE.
 *
 * Why not subscribe from the browser? RLS denies anon and authenticated every
 * row (004_rls.sql), so a browser subscription would be silent - and the only
 * key that *would* work is the one that must never leave the server.
 *
 * What crosses the wire is deliberately thin: which table changed, and at most
 * a phone number or order id. No customer data, no message text.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminApi();

    const requested = (request.nextUrl.searchParams.get('tables') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter((value): value is AllowedTable =>
        (ALLOWED_TABLES as readonly string[]).includes(value)
      );

    const tables = requested.length ? requested : [...ALLOWED_TABLES];
    const client = supabaseRealtime();
    const encoder = new TextEncoder();

    let channel: RealtimeChannel | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let closeTimer: ReturnType<typeof setTimeout> | null = null;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;

        const send = (payload: string) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(payload));
          } catch {
            closed = true;
          }
        };

        const cleanup = () => {
          if (closed) return;
          closed = true;
          if (heartbeat) clearInterval(heartbeat);
          if (closeTimer) clearTimeout(closeTimer);
          if (channel) void client.removeChannel(channel);
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        };

        // Tell EventSource how long to wait before reconnecting.
        send('retry: 3000\n\n');
        send(': connected\n\n');

        channel = client.channel(`admin-panel-${Date.now()}`);

        for (const table of tables) {
          channel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table },
            (payload) => {
              const row = (payload.new ?? payload.old ?? {}) as Record<string, unknown>;
              send(
                `data: ${JSON.stringify({
                  table,
                  type: payload.eventType,
                  phone: typeof row.phone === 'string' ? row.phone : null,
                  orderId: typeof row.order_id === 'string' ? row.order_id : null,
                  at: new Date().toISOString(),
                })}\n\n`
              );
            }
          );
        }

        channel.subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            // The client reconnects and falls back to polling meanwhile.
            cleanup();
          }
        });

        heartbeat = setInterval(() => send(': ping\n\n'), HEARTBEAT_MS);
        closeTimer = setTimeout(cleanup, MAX_STREAM_MS);
        request.signal.addEventListener('abort', cleanup);
      },

      cancel() {
        if (heartbeat) clearInterval(heartbeat);
        if (closeTimer) clearTimeout(closeTimer);
        if (channel) void client.removeChannel(channel);
      },
    });

    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      },
    });
  } catch (error) {
    return toResponse(error, 'realtime.stream');
  }
}
