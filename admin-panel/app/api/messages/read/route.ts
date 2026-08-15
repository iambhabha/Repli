import { requireAdminApi } from '@/lib/auth/guard';
import { markThreadRead } from '@/lib/services/messages';
import { normalisePhone } from '@/lib/utils/format';
import { assert, handle, ok, readJson } from '@/lib/utils/http';

export const dynamic = 'force-dynamic';

/** Clears the unread badge for one conversation. */
export async function POST(request: Request) {
  return handle('messages.read', async () => {
    await requireAdminApi();
    const body = await readJson<{ phone?: string }>(request);

    const phone = normalisePhone(body.phone ?? '');
    assert(phone.length >= 10, 'A valid phone number is required.');

    await markThreadRead(phone);
    return ok({ phone });
  });
}
