import type { NextRequest } from 'next/server';

import { requireAdminApi } from '@/lib/auth/guard';
import { getThread, listInbox } from '@/lib/services/messages';
import { handle, ok } from '@/lib/utils/http';
import { normalisePhone } from '@/lib/utils/format';
import { parsePageParams } from '@/lib/utils/pagination';
import type { ConversationMode } from '@/types/database';

export const dynamic = 'force-dynamic';

/** With `?phone=` returns one thread, otherwise the inbox. */
export async function GET(request: NextRequest) {
  return handle('messages.list', async () => {
    await requireAdminApi();

    const query = Object.fromEntries(request.nextUrl.searchParams.entries());
    const phone = normalisePhone(query.phone ?? '');

    if (phone) {
      const thread = await getThread(phone);
      return ok({ thread });
    }

    const inbox = await listInbox(
      { search: query.q, mode: (query.mode as ConversationMode | 'ALL' | undefined) ?? 'ALL' },
      parsePageParams(query, 50)
    );

    return ok(inbox);
  });
}
