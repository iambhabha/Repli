import { REPLI_API_KEY, REPLI_API_URL } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { normalisePhone } from '@/lib/utils/format';
import type { OutboundMessageRow } from '@/types/database';
import { renderTemplate } from './templates';

export interface SendResult {
  /** true = the bot confirmed delivery, false = queued for the bot to pick up. */
  delivered: boolean;
  id: string | null;
}

export const MAX_MESSAGE_LENGTH = 2000;

/**
 * The panel never speaks the WhatsApp protocol - that stays in the bot, which
 * owns the open-wa session.
 *
 * Two delivery paths:
 *   1. REPLI_API_URL set  -> POST straight to the running bot (same machine /
 *      LAN / tunnel). Instant, and the response tells us it really went out.
 *   2. otherwise          -> insert a row in `outbound_messages`; the bot's
 *      outbox worker drains it and records the message.
 *
 * Path 2 is the default because it is the only one that works when the panel
 * is on Vercel and WhatsApp is on the owner's laptop. If path 1 fails for any
 * reason we fall back to path 2 rather than losing the reply.
 */
export async function sendWhatsAppMessage(input: {
  phone: string;
  text: string;
  actor: string;
}): Promise<SendResult> {
  const phone = normalisePhone(input.phone);
  const text = input.text.trim().slice(0, MAX_MESSAGE_LENGTH);

  if (!phone) throw new Error('outbox.send: missing phone');
  if (!text) throw new Error('outbox.send: empty message');

  if (REPLI_API_URL) {
    try {
      const response = await fetch(`${REPLI_API_URL}/api/messages/send`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(REPLI_API_KEY ? { 'x-repli-key': REPLI_API_KEY } : {}),
        },
        body: JSON.stringify({ phone, text }),
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok) return { delivered: true, id: null };
      console.warn('[outbox] bot API refused the message, falling back to the queue');
    } catch (error) {
      console.warn('[outbox] bot API unreachable, falling back to the queue', error);
    }
  }

  return queue({ phone, text, actor: input.actor });
}

async function queue(input: {
  phone: string;
  text: string;
  actor: string;
}): Promise<SendResult> {
  const { data, error } = await supabaseAdmin()
    .from('outbound_messages')
    .insert({ phone: input.phone, text: input.text, requested_by: input.actor })
    .select('id')
    .single<{ id: string }>();

  if (error) throw new Error(`outbox.queue: ${error.message}`);
  return { delivered: false, id: data.id };
}

/** Matches `conversations.data.lang`, written by the bot's language detector. */
export type CustomerLanguage = 'hi' | 'en';

interface ConfirmedOrder {
  order_id: string;
  total: number;
  items: Array<{
    product_name_snapshot: string;
    color_snapshot: string | null;
    size_snapshot: string | null;
    quantity: number;
  }>;
}

/**
 * Whatever language the customer has been speaking to the bot in.
 *
 * The bot decides this on the first message and stores it on the
 * conversation; the panel only reads it. A customer who has been answered in
 * English all the way through must not get a sudden Hinglish confirmation
 * just because the owner clicked Verify in a dashboard.
 */
export async function customerLanguage(phone: string): Promise<CustomerLanguage> {
  const { data } = await supabaseAdmin()
    .from('conversations')
    .select('data')
    .eq('phone', normalisePhone(phone))
    .maybeSingle<{ data: { lang?: string } | null }>();

  return data?.data?.lang === 'en' ? 'en' : 'hi';
}

/**
 * Customer-facing texts, kept word for word in step with src/bot/messages.js
 * and src/bot/messages.en.js, so a payment confirmed from the panel reads
 * exactly like one confirmed with /paid on WhatsApp.
 */
export const customerMessages = {
  orderConfirmed(order: ConfirmedOrder, language: CustomerLanguage = 'hi'): string {
    const item = order.items[0];
    const total = `₹${Math.round(Number(order.total ?? 0))}`;

    if (language === 'en') {
      const lines = [
        'Payment received successfully ❤️✅',
        '',
        `Your order #${order.order_id} is confirmed! 🎉`,
        '',
        `Product: ${item?.product_name_snapshot || '-'}`,
        `Colour: ${item?.color_snapshot || '-'}`,
      ];
      if (item?.size_snapshot) lines.push(`Size: ${item.size_snapshot}`);
      lines.push(
        `Quantity: ${item?.quantity ?? 1}`,
        '',
        `Total Paid: ${total}`,
        '',
        'Our agent will assist you personally from here.',
        'Please hold on ❤️'
      );
      return lines.join('\n');
    }

    const lines = [
      'Payment received successfully bhai ❤️✅',
      '',
      `Aapka order #${order.order_id} confirm ho gaya! 🎉`,
      '',
      `Product: ${item?.product_name_snapshot || '-'}`,
      `Color: ${item?.color_snapshot || '-'}`,
    ];
    if (item?.size_snapshot) lines.push(`Size: ${item.size_snapshot}`);
    lines.push(
      `Quantity: ${item?.quantity ?? 1}`,
      '',
      `Total Paid: ${total}`,
      '',
      'Abhi aapko hamara agent personally assist karega.',
      'Thoda sa wait karo bhai ❤️'
    );
    return lines.join('\n');
  },

  paymentRejected(language: CustomerLanguage = 'hi'): string {
    return language === 'en'
      ? [
          'We could not verify your payment 😕',
          'Our team will get in touch with you personally.',
          '',
          'Please hold on ❤️',
        ].join('\n')
      : [
          'Bhai payment verify nahi ho paayi 😕',
          'Hamari team abhi aapse personally baat karegi.',
          '',
          'Thoda sa wait karo ❤️',
        ].join('\n');
  },

  orderCancelled(orderCode: string, language: CustomerLanguage = 'hi'): string {
    return language === 'en'
      ? [
          `Your order #${orderCode} has been cancelled.`,
          '',
          'If something is wrong, just message us here and our team will help ❤️',
        ].join('\n')
      : [
          `Bhai aapka order #${orderCode} cancel kar diya gaya hai.`,
          '',
          'Koi dikkat ho toh yahin message karo, hamari team help karegi ❤️',
        ].join('\n');
  },
};

/**
 * The wording the owner edited, falling back to the built-in text.
 *
 * The bot seeds `message_templates` on startup; until it has run once the
 * table is empty, and the panel must still be able to send a confirmation.
 * So the fallback is not dead code - it is the first-run path.
 */
async function fromTemplate(
  key: string,
  language: CustomerLanguage,
  vars: Record<string, string | number>,
  fallback: string
): Promise<string> {
  try {
    const rendered = await renderTemplate(key, language, vars);
    return rendered || fallback;
  } catch (error) {
    console.error('[outbox] template lookup failed, using the built-in text', error);
    return fallback;
  }
}

/** Optional "Size: M" line - empty for products without sizes. */
function sizeLine(size: string | null | undefined): string {
  return size ? `Size: ${size}` : '';
}

export const customerText = {
  async orderConfirmed(order: ConfirmedOrder, language: CustomerLanguage): Promise<string> {
    const item = order.items[0];
    return fromTemplate(
      'orderConfirmed',
      language,
      {
        orderId: order.order_id,
        product: item?.product_name_snapshot || '-',
        color: item?.color_snapshot || '-',
        sizeLine: sizeLine(item?.size_snapshot),
        quantity: item?.quantity ?? 1,
        total: `₹${Math.round(Number(order.total ?? 0))}`,
      },
      customerMessages.orderConfirmed(order, language)
    );
  },

  async paymentRejected(language: CustomerLanguage): Promise<string> {
    return fromTemplate('paymentRejected', language, {}, customerMessages.paymentRejected(language));
  },

  async orderCancelled(orderCode: string, language: CustomerLanguage): Promise<string> {
    return fromTemplate(
      'orderCancelledByAdmin',
      language,
      { orderId: orderCode },
      customerMessages.orderCancelled(orderCode, language)
    );
  },
};

export async function outboxHealth(): Promise<{
  pending: number;
  failed: number;
  oldestPendingAt: string | null;
}> {
  const db = supabaseAdmin();
  const [pendingRes, failedRes, oldestRes] = await Promise.all([
    db.from('outbound_messages').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
    db.from('outbound_messages').select('id', { count: 'exact', head: true }).eq('status', 'FAILED'),
    db
      .from('outbound_messages')
      .select('created_at')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle<Pick<OutboundMessageRow, 'created_at'>>(),
  ]);

  return {
    pending: pendingRes.count ?? 0,
    failed: failedRes.count ?? 0,
    oldestPendingAt: oldestRes.data?.created_at ?? null,
  };
}
