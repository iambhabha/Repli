import { logAdminAction } from '@/lib/audit';
import { requireAdminApi } from '@/lib/auth/guard';
import { MAX_MESSAGE_LENGTH, sendWhatsAppMessage } from '@/lib/services/outbox';
import { normalisePhone } from '@/lib/utils/format';
import { assert, handle, ok, readJson } from '@/lib/utils/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * §11. The panel does not speak WhatsApp - it asks the bot to. Either straight
 * over HTTP (REPLI_API_URL) or, by default, through the outbound_messages
 * queue the bot drains. The message is recorded in `messages` by the bot when
 * it actually goes out, so the chat log never claims something was sent that
 * was not.
 */
export async function POST(request: Request) {
  return handle('messages.send', async () => {
    const admin = await requireAdminApi();
    const body = await readJson<{ phone?: string; text?: string }>(request);

    const phone = normalisePhone(body.phone ?? '');
    const text = (body.text ?? '').trim();

    assert(phone.length >= 10, 'A valid phone number is required.');
    assert(text.length > 0, 'Type a message first.');
    assert(text.length <= MAX_MESSAGE_LENGTH, 'That message is too long.');

    const result = await sendWhatsAppMessage({ phone, text, actor: admin.email });

    await logAdminAction({
      actor: admin.email,
      action: 'MESSAGE_SENT',
      entityType: 'conversation',
      entityId: phone,
      details: { delivered: result.delivered, length: text.length },
    });

    return ok(result);
  });
}
