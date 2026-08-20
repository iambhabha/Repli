import { logAdminAction } from '@/lib/audit';
import type { AdminSession } from '@/lib/auth/guard';
import { invalidateCategories } from '@/lib/cache';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { BadRequest } from '@/lib/utils/http';

import { unwrap } from './shared';

/**
 * Product categories - the "what are you looking for?" menu.
 *
 * Rows, not constants: adding "Caps" here makes the bot offer caps and
 * understand the word, with no deploy. `keywords` is the list of spellings
 * customers actually use, which is what the bot matches on.
 */
export interface Category {
  key: string;
  label: string;
  emoji: string | null;
  keywords: string[];
  sortOrder: number;
  active: boolean;
  /** A storage reference or a local path. Never a URL - the bot refuses those. */
  imagePath: string | null;
}

interface CategoryRow {
  key: string;
  label: string;
  emoji: string | null;
  keywords: string[] | null;
  sort_order: number;
  active: boolean;
  image_path: string | null;
}

export async function listCategories(includeInactive = false): Promise<Category[]> {
  let query = supabaseAdmin()
    .from('product_categories')
    .select('key,label,emoji,keywords,sort_order,active,image_path')
    .order('sort_order', { ascending: true });

  if (!includeInactive) query = query.eq('active', true);

  const rows = unwrap(await query, 'categories.list') as CategoryRow[];

  return (rows ?? []).map((row) => ({
    key: row.key,
    label: row.label,
    emoji: row.emoji,
    keywords: row.keywords ?? [],
    sortOrder: row.sort_order,
    active: row.active,
    imagePath: row.image_path,
  }));
}

// --------------------------------------------------------------- writing

/**
 * Editing the menu.
 *
 * `key` is the primary key AND the value `products.category` points at, so it
 * is set once when the category is created and never changed afterwards -
 * renaming it would orphan every product in it. The label, emoji, keywords
 * and order are all free to change; the bot picks them up the moment the
 * invalidation lands.
 *
 * Deactivating rather than deleting is the house rule: `availableCategories()`
 * already hides a category with nothing to sell, and a hard delete would
 * strand products whose `category` column still names it.
 */

export interface CategoryInput {
  key?: string;
  label?: string;
  emoji?: string | null;
  keywords?: string[] | string;
  sortOrder?: number;
  active?: boolean;
}

/** Keywords arrive as a list or as one comma separated line from the form. */
function toKeywords(value: CategoryInput['keywords']): string[] {
  const list = Array.isArray(value) ? value : String(value ?? '').split(',');
  return [...new Set(list.map((word) => word.trim().toLowerCase()).filter(Boolean))];
}

const KEY_SHAPE = /^[a-z][a-z0-9_]{1,31}$/;

export async function createCategory(
  input: CategoryInput,
  admin: AdminSession
): Promise<Category> {
  const key = (input.key ?? '').trim().toLowerCase();
  const label = (input.label ?? '').trim();

  // The key ends up in URLs, cache keys and products.category. Keep it plain.
  if (!KEY_SHAPE.test(key)) {
    throw new BadRequest('The key must be lowercase letters, numbers or underscores (e.g. "caps").');
  }
  if (!label) throw new BadRequest('A category needs a label customers will read.');

  const { data, error } = await supabaseAdmin()
    .from('product_categories')
    .insert({
      key,
      label,
      emoji: input.emoji?.trim() || null,
      keywords: toKeywords(input.keywords),
      sort_order: Number(input.sortOrder ?? 0),
      active: input.active ?? true,
    })
    .select('key,label,emoji,keywords,sort_order,active,image_path')
    .single<CategoryRow>();

  if (error) {
    if (error.code === '23505') throw new BadRequest(`A category called "${key}" already exists.`);
    throw new Error(`categories.create: ${error.message}`);
  }

  await logAdminAction({
    actor: admin.email,
    action: 'CATEGORY_CREATED',
    entityType: 'category',
    entityId: key,
    details: { label },
  });

  await invalidateCategories();
  return toCategory(data);
}

export async function updateCategory(
  key: string,
  input: CategoryInput,
  admin: AdminSession
): Promise<Category> {
  const patch: Record<string, unknown> = {};

  if (input.label !== undefined) {
    const label = input.label.trim();
    if (!label) throw new BadRequest('The label cannot be empty.');
    patch.label = label;
  }
  if (input.emoji !== undefined) patch.emoji = input.emoji?.trim() || null;
  if (input.keywords !== undefined) patch.keywords = toKeywords(input.keywords);
  if (input.sortOrder !== undefined) patch.sort_order = Number(input.sortOrder);
  if (input.active !== undefined) patch.active = input.active;

  // Deliberately not editable: products.category points at it.
  if (input.key !== undefined && input.key !== key) {
    throw new BadRequest('A category key cannot be changed - products point at it.');
  }
  if (!Object.keys(patch).length) throw new BadRequest('Nothing to update.');

  const { data, error } = await supabaseAdmin()
    .from('product_categories')
    .update(patch)
    .eq('key', key)
    .select('key,label,emoji,keywords,sort_order,active,image_path')
    .single<CategoryRow>();

  if (error) throw new Error(`categories.update: ${error.message}`);

  await logAdminAction({
    actor: admin.email,
    action: input.active === false ? 'CATEGORY_DEACTIVATED' : 'CATEGORY_UPDATED',
    entityType: 'category',
    entityId: key,
    details: patch,
  });

  await invalidateCategories();
  return toCategory(data);
}

/** Hidden from customers, kept in the database. Products keep their key. */
export async function deactivateCategory(key: string, admin: AdminSession): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('product_categories')
    .update({ active: false })
    .eq('key', key);

  if (error) throw new Error(`categories.deactivate: ${error.message}`);

  await logAdminAction({
    actor: admin.email,
    action: 'CATEGORY_DEACTIVATED',
    entityType: 'category',
    entityId: key,
  });

  await invalidateCategories();
}

function toCategory(row: CategoryRow): Category {
  return {
    key: row.key,
    label: row.label,
    emoji: row.emoji,
    keywords: row.keywords ?? [],
    sortOrder: row.sort_order,
    active: row.active,
    imagePath: row.image_path,
  };
}
