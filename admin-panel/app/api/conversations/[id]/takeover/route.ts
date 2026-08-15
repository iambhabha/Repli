import { requireAdminApi } from '@/lib/auth/guard';
import { setConversationMode } from '@/lib/services/conversations';
import { handle, ok } from '@/lib/utils/http';

export const dynamic = 'force-dynamic';

/** §12: a human takes over. The bot goes silent for this number immediately. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle('conversations.takeover', async () => {
    const admin = await requireAdminApi();
    const { id } = await params;

    const conversation = await setConversationMode({ conversationId: id }, 'HUMAN', admin);
    return ok({ mode: conversation.mode, phone: conversation.phone });
  });
}
