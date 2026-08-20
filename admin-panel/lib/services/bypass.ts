import { logAdminAction } from '@/lib/audit';
import { invalidateBypass } from '@/lib/cache';
import type { AdminSession } from '@/lib/auth/guard';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { normalisePhone } from '@/lib/utils/format';
import { BadRequest } from '@/lib/utils/http';
import { escapeLike, type PageParams, paginate, type Paginated } from '@/lib/utils/pagination';
import type { BypassNumberRow } from '@/types/database';

/**
 * Numbers Repli ignores completely - family, friends, the owner's other phone.
 * The bot checks this table before anything else (src/bot/router.js), so a row
 * added here takes effect on the customer's very next message.
 */
export async function listBypass(
  filters: { search?: string },
  page: PageParams
): Promise<Paginated<BypassNumberRow>> {
  let query = supabaseAdmin()
    .from('bypass_numbers')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page.from, page.to);

  const search = escapeLike(filters.search ?? '');
  if (search) query = query.or(`phone.ilike.%${search}%,name.ilike.%${search}%`);

  const { data, error, count } = await query;
  if (error) throw new Error(`bypass.list: ${error.message}`);

  return paginate((data ?? []) as BypassNumberRow[], count ?? 0, page);
}

export async function addBypass(
  input: { phone: string; name?: string; active?: boolean },
  admin: AdminSession
): Promise<BypassNumberRow> {
  const phone = normalisePhone(input.phone);
  if (!phone || phone.length < 10) throw new BadRequest('Enter a valid phone number.');

  const { data, error } = await supabaseAdmin()
    .from('bypass_numbers')
    .upsert(
      { phone, name: input.name?.trim() || null, active: input.active ?? true },
      { onConflict: 'phone' }
    )
    .select('*')
    .single<BypassNumberRow>();

  if (error) throw new Error(`bypass.add: ${error.message}`);

  await logAdminAction({
    actor: admin.email,
    action: 'BYPASS_ADDED',
    entityType: 'bypass',
    entityId: phone,
    details: { name: data.name, active: data.active },
  });

  // The most important cache in the shop: a bypassed number must go silent
  // now, not in ten seconds.
  await invalidateBypass();

  return data;
}

export async function updateBypass(
  id: string,
  input: { name?: string; active?: boolean },
  admin: AdminSession
): Promise<BypassNumberRow> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim() || null;
  if (input.active !== undefined) patch.active = input.active;
  if (!Object.keys(patch).length) throw new BadRequest('Nothing to update.');

  const { data, error } = await supabaseAdmin()
    .from('bypass_numbers')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single<BypassNumberRow>();

  if (error) throw new Error(`bypass.update: ${error.message}`);

  await logAdminAction({
    actor: admin.email,
    action: 'BYPASS_UPDATED',
    entityType: 'bypass',
    entityId: data.phone,
    details: patch,
  });

  await invalidateBypass();

  return data;
}

export async function removeBypass(id: string, admin: AdminSession): Promise<void> {
  const { data: existing } = await supabaseAdmin()
    .from('bypass_numbers')
    .select('phone')
    .eq('id', id)
    .maybeSingle<{ phone: string }>();

  const { error } = await supabaseAdmin().from('bypass_numbers').delete().eq('id', id);
  if (error) throw new Error(`bypass.remove: ${error.message}`);

  await logAdminAction({
    actor: admin.email,
    action: 'BYPASS_REMOVED',
    entityType: 'bypass',
    entityId: existing?.phone ?? id,
  });

  await invalidateBypass();
}
