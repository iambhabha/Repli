import { supabaseAdmin } from '@/lib/supabase/admin';
import type { AdminActionRow, Json } from '@/types/database';

/** Every action the panel logs. Keep the vocabulary stable - it is read by humans. */
export type AuditAction =
  | 'PAYMENT_VERIFIED'
  | 'PAYMENT_REJECTED'
  | 'ORDER_CANCELLED'
  | 'STOCK_CHANGED'
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DEACTIVATED'
  | 'VARIANT_CREATED'
  | 'VARIANT_UPDATED'
  | 'VARIANT_DELETED'
  | 'BYPASS_ADDED'
  | 'BYPASS_UPDATED'
  | 'BYPASS_REMOVED'
  | 'BOT_ENABLED'
  | 'BOT_DISABLED'
  | 'HUMAN_TAKEOVER'
  | 'BOT_RESUMED'
  | 'MESSAGE_SENT'
  | 'SETTINGS_UPDATED'
  | 'TEMPLATE_UPDATED'
  | 'TEMPLATE_RESET';

interface AuditInput {
  actor: string;
  action: AuditAction;
  entityType?: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
}

/**
 * Append-only audit trail. Deliberately never throws: an action that already
 * succeeded must not be reported as failed because logging hiccuped. Failures
 * are surfaced on the server console instead.
 */
export async function logAdminAction(input: AuditInput): Promise<void> {
  const { error } = await supabaseAdmin().from('admin_actions').insert({
    actor: input.actor,
    actor_type: 'PANEL',
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    details: (input.details ?? {}) as Json,
  });

  if (error) {
    console.error('[audit] failed to record action', input.action, error.message);
  }
}

export async function recentAdminActions(limit = 20): Promise<AdminActionRow[]> {
  const { data, error } = await supabaseAdmin()
    .from('admin_actions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []) as AdminActionRow[];
}
