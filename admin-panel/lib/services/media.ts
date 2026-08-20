import { logAdminAction } from '@/lib/audit';
import type { AdminSession } from '@/lib/auth/guard';
import { invalidateCategories, invalidateProduct, invalidateStock } from '@/lib/cache';
import { removeMedia, uploadMedia } from '@/lib/storage';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { BadRequest } from '@/lib/utils/http';

/**
 * Attaching a picture to a product, a variant or a category.
 *
 * The order of operations is the whole point of this file. A half-finished
 * upload must never leave a row pointing at a file that is not there, so:
 *
 *   1. validate, then upload the NEW file under a new key
 *   2. write the reference to the row
 *   3. only once that succeeded, delete the OLD file
 *
 * If step 2 fails, the new object is removed again and the row is untouched -
 * the shop is exactly where it started. If step 3 fails, an orphaned file is
 * left in the bucket, which costs a few kilobytes and breaks nothing.
 *
 * The reverse (delete first, upload second) would have a window in which the
 * product has a reference to a file that no longer exists, and the bot would
 * tell a customer it has no photo of something it does.
 */

type Target = 'product' | 'variant' | 'category';

const TABLE: Record<Target, string> = {
  product: 'products',
  variant: 'product_variants',
  category: 'product_categories',
};

/**
 * Which column identifies a row. Categories are keyed by `key` because that
 * is what every product's `category` column points at - there is no id to
 * use, and inventing one would break that link.
 */
const ID_COLUMN: Record<Target, string> = {
  product: 'id',
  variant: 'id',
  category: 'key',
};

/** A fixed, code-chosen prefix per kind - never anything from the request. */
const FOLDER: Record<Target, string> = {
  product: 'products',
  variant: 'variants',
  category: 'categories',
};

const AUDIT = {
  product: 'PRODUCT_UPDATED',
  variant: 'VARIANT_UPDATED',
  category: 'CATEGORY_UPDATED',
} as const;

async function currentImage(target: Target, id: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from(TABLE[target])
    .select('image_path')
    .eq(ID_COLUMN[target], id)
    .maybeSingle<{ image_path: string | null }>();

  if (error) throw new Error(`media.read: ${error.message}`);
  if (!data) throw new BadRequest('That item no longer exists.');
  return data.image_path;
}

/** After a product image changes the catalogue is stale; a variant is stock. */
async function invalidateFor(target: Target, id: string): Promise<void> {
  if (target === 'product') return invalidateProduct('panel:product-image');
  if (target === 'category') return invalidateCategories('panel:category-image');

  const { data } = await supabaseAdmin()
    .from('product_variants')
    .select('product_id')
    .eq('id', id)
    .maybeSingle<{ product_id: string }>();

  if (data?.product_id) await invalidateStock(data.product_id, 'panel:variant-image');
}

export async function setImage(
  target: Target,
  id: string,
  file: { type: string; size: number; arrayBuffer(): Promise<ArrayBuffer> },
  admin: AdminSession
): Promise<{ imagePath: string }> {
  const previous = await currentImage(target, id);

  const upload = await uploadMedia(FOLDER[target], id, file);
  if (!upload.ok || !upload.reference) throw new BadRequest(upload.reason ?? 'Upload failed.');

  const { error } = await supabaseAdmin()
    .from(TABLE[target])
    .update({ image_path: upload.reference })
    .eq(ID_COLUMN[target], id);

  if (error) {
    // The row never learned about this file, so nothing may be left behind.
    await removeMedia(upload.reference);
    throw new Error(`media.attach: ${error.message}`);
  }

  // Only now is the old one safe to drop.
  if (previous && previous !== upload.reference) await removeMedia(previous);

  await logAdminAction({
    actor: admin.email,
    action: AUDIT[target],
    entityType: target,
    entityId: id,
    details: { image: 'uploaded' },
  });

  await invalidateFor(target, id);
  return { imagePath: upload.reference };
}

/** Take the picture away. The row is cleared first, for the same reason. */
export async function clearImage(
  target: Target,
  id: string,
  admin: AdminSession
): Promise<void> {
  const previous = await currentImage(target, id);

  const { error } = await supabaseAdmin()
    .from(TABLE[target])
    .update({ image_path: null })
    .eq(ID_COLUMN[target], id);

  if (error) throw new Error(`media.clear: ${error.message}`);

  await removeMedia(previous);

  await logAdminAction({
    actor: admin.email,
    action: AUDIT[target],
    entityType: target,
    entityId: id,
    details: { image: 'removed' },
  });

  await invalidateFor(target, id);
}
