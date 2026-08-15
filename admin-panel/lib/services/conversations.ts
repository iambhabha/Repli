import { logAdminAction } from '@/lib/audit';
import type { AdminSession } from '@/lib/auth/guard';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { BadRequest } from '@/lib/utils/http';
import { normalisePhone } from '@/lib/utils/format';
import type { ConversationMode, ConversationRow } from '@/types/database';

/**
 * Human takeover. `conversations.mode` is the exact switch the bot's router
 * checks before it replies (src/bot/router.js), so flipping it here really
 * does silence Repli for that number - no second copy of the truth.
 */
export async function setConversationMode(
  identifier: { conversationId?: string; phone?: string },
  mode: ConversationMode,
  admin: AdminSession
): Promise<ConversationRow> {
  const conversation = await findConversation(identifier);
  if (!conversation) throw new BadRequest('That conversation does not exist yet.');

  const { data, error } = await supabaseAdmin()
    .from('conversations')
    .update({ mode })
    .eq('id', conversation.id)
    .select('*')
    .single<ConversationRow>();

  if (error) throw new Error(`conversations.setMode: ${error.message}`);

  await logAdminAction({
    actor: admin.email,
    action: mode === 'HUMAN' ? 'HUMAN_TAKEOVER' : 'BOT_RESUMED',
    entityType: 'conversation',
    entityId: conversation.phone,
    details: { from: conversation.mode, to: mode },
  });

  return data;
}

export async function findConversation(identifier: {
  conversationId?: string;
  phone?: string;
}): Promise<ConversationRow | null> {
  const db = supabaseAdmin();

  if (identifier.conversationId) {
    const { data, error } = await db
      .from('conversations')
      .select('*')
      .eq('id', identifier.conversationId)
      .maybeSingle<ConversationRow>();
    if (error) throw new Error(`conversations.find: ${error.message}`);
    return data;
  }

  const phone = normalisePhone(identifier.phone);
  if (!phone) return null;

  const { data, error } = await db
    .from('conversations')
    .select('*')
    .eq('phone', phone)
    .maybeSingle<ConversationRow>();

  if (error) throw new Error(`conversations.find: ${error.message}`);
  return data;
}
