import { logAdminAction } from '@/lib/audit';
import { invalidateStock } from '@/lib/cache';
import type { AdminSession } from '@/lib/auth/guard';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { BadRequest } from '@/lib/utils/http';
import { escapeLike, type PageParams, paginate, type Paginated } from '@/lib/utils/pagination';
import type { ProductVariantRow } from '@/types/database';
import { stockLevel, type StockRow } from '@/types/product';

import { getLowStockThreshold } from './settings';

type VariantQueryRow = ProductVariantRow & {
  products: { name: string; code: string; emoji: string | null } | null;
};

export interface StockFilters {
  search?: string;
  level?: 'ALL' | 'LOW' | 'OUT' | 'IN';
  productId?: string;
}

export interface StockList extends Paginated<StockRow> {
  threshold: number;
}

export async function listStock(filters: StockFilters, page: PageParams): Promise<StockList> {
  const threshold = await getLowStockThreshold();

  /**
   * Ordered by product, then colour, then SKU - deliberately NOT by quantity.
   * The +/- buttons change the quantity, and a quantity sort would make rows
   * jump under the owner's finger between two taps.
   */
  let query = supabaseAdmin()
    .from('product_variants')
    .select('*, products!inner(name,code,emoji)', { count: 'exact' })
    .order('product_id', { ascending: true })
    .order('color', { ascending: true, nullsFirst: true })
    .order('sku', { ascending: true, nullsFirst: true })
    .range(page.from, page.to);

  if (filters.productId) query = query.eq('product_id', filters.productId);
  if (filters.level === 'OUT') query = query.eq('stock_quantity', 0);
  // "Low" means "needs restocking", which includes zero - so this count always
  // matches the Low Stock card on the dashboard and the sidebar badge.
  if (filters.level === 'LOW') query = query.lte('stock_quantity', threshold);
  if (filters.level === 'IN') query = query.gt('stock_quantity', threshold);

  const search = escapeLike(filters.search ?? '');
  if (search) {
    // PostgREST cannot OR across an embedded table, so the product name search
    // is resolved to ids first and folded into one or() on the variant.
    const { data: matches } = await supabaseAdmin()
      .from('products')
      .select('id')
      .or(`name.ilike.%${search}%,code.ilike.%${search}%`);

    const productIds = ((matches ?? []) as { id: string }[]).map((row) => row.id);
    const clauses = [
      `sku.ilike.%${search}%`,
      `color.ilike.%${search}%`,
      `size.ilike.%${search}%`,
      ...(productIds.length ? [`product_id.in.(${productIds.join(',')})`] : []),
    ];
    query = query.or(clauses.join(','));
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`stock.list: ${error.message}`);

  const rows = ((data ?? []) as unknown as VariantQueryRow[]).map(
    (row): StockRow => ({
      ...stripProduct(row),
      productName: row.products?.name ?? 'Product',
      productCode: row.products?.code ?? '',
      productEmoji: row.products?.emoji ?? null,
      level: stockLevel(row.stock_quantity, threshold),
    })
  );

  return { ...paginate(rows, count ?? rows.length, page), threshold };
}

export async function getVariant(id: string): Promise<ProductVariantRow | null> {
  const { data, error } = await supabaseAdmin()
    .from('product_variants')
    .select('*')
    .eq('id', id)
    .maybeSingle<ProductVariantRow>();

  if (error) throw new Error(`stock.getVariant: ${error.message}`);
  return data;
}

/**
 * Set or nudge a variant's stock.
 *
 * `delta` is resolved against the value we just read, and the result is
 * clamped at zero - the database CHECK (stock_quantity >= 0) would reject a
 * negative anyway, and a rejected write is a worse experience than a clamp.
 *
 * Note: the bot only ever *decreases* stock inside confirm_order_payment(),
 * so the two paths cannot fight over the same row for long.
 */
export async function changeStock(
  variantId: string,
  change: { quantity?: number; delta?: number },
  admin: AdminSession
): Promise<ProductVariantRow> {
  const current = await getVariant(variantId);
  if (!current) throw new BadRequest('That variant no longer exists.');

  let next: number;
  if (change.quantity !== undefined) {
    next = Math.round(Number(change.quantity));
    if (!Number.isFinite(next)) throw new BadRequest('Stock must be a number.');
  } else if (change.delta !== undefined) {
    const delta = Math.round(Number(change.delta));
    if (!Number.isFinite(delta)) throw new BadRequest('Stock change must be a number.');
    next = current.stock_quantity + delta;
  } else {
    throw new BadRequest('Nothing to change.');
  }

  next = Math.max(0, next);

  if (next === current.stock_quantity) {
    return current;
  }

  const { data, error } = await supabaseAdmin()
    .from('product_variants')
    .update({ stock_quantity: next })
    .eq('id', variantId)
    .select('*')
    .single<ProductVariantRow>();

  if (error) throw new Error(`stock.change: ${error.message}`);

  await logAdminAction({
    actor: admin.email,
    action: 'STOCK_CHANGED',
    entityType: 'variant',
    entityId: variantId,
    details: {
      sku: current.sku,
      color: current.color,
      size: current.size,
      before: current.stock_quantity,
      after: next,
    },
  });

  // Stock only - the catalogue cache holds the product row, not the count.
  await invalidateStock(current.product_id);

  return data;
}

function stripProduct(row: VariantQueryRow): ProductVariantRow {
  const { products: _products, ...variant } = row;
  return variant;
}
