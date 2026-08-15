import { logAdminAction } from '@/lib/audit';
import type { AdminSession } from '@/lib/auth/guard';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { BadRequest } from '@/lib/utils/http';
import { escapeLike } from '@/lib/utils/pagination';
import type { ProductRow, ProductVariantRow } from '@/types/database';
import type { ProductWithVariants } from '@/types/product';

const PRODUCT_SELECT = '*, product_variants(*)';

type ProductQueryRow = ProductRow & { product_variants: ProductVariantRow[] | null };

export interface ProductFilters {
  search?: string;
  status?: 'ALL' | 'ACTIVE' | 'INACTIVE';
}

export async function listProducts(filters: ProductFilters = {}): Promise<ProductWithVariants[]> {
  let query = supabaseAdmin()
    .from('products')
    .select(PRODUCT_SELECT)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  const search = escapeLike(filters.search ?? '');
  if (search) query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
  if (filters.status === 'ACTIVE') query = query.eq('active', true);
  if (filters.status === 'INACTIVE') query = query.eq('active', false);

  const { data, error } = await query;
  if (error) throw new Error(`products.list: ${error.message}`);

  return ((data ?? []) as unknown as ProductQueryRow[]).map(toProductWithVariants);
}

export async function getProduct(id: string): Promise<ProductWithVariants | null> {
  const { data, error } = await supabaseAdmin()
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`products.get: ${error.message}`);
  if (!data) return null;
  return toProductWithVariants(data as unknown as ProductQueryRow);
}

export interface ProductInput {
  code?: string;
  name?: string;
  description?: string | null;
  emoji?: string | null;
  price?: number;
  active?: boolean;
  sortOrder?: number;
}

export async function createProduct(
  input: ProductInput,
  admin: AdminSession
): Promise<ProductRow> {
  const code = (input.code ?? '').trim().toUpperCase();
  const name = (input.name ?? '').trim();
  const price = Number(input.price ?? 0);

  if (!code) throw new BadRequest('Product code is required (for example TS002).');
  if (!name) throw new BadRequest('Product name is required.');
  if (!Number.isFinite(price) || price < 0) throw new BadRequest('Price must be zero or more.');

  const { data, error } = await supabaseAdmin()
    .from('products')
    .insert({
      code,
      name,
      description: input.description?.trim() || null,
      emoji: input.emoji?.trim() || null,
      price,
      active: input.active ?? true,
      sort_order: input.sortOrder ?? 0,
    })
    .select('*')
    .single<ProductRow>();

  if (error) {
    if (error.code === '23505') throw new BadRequest(`Product code ${code} already exists.`);
    throw new Error(`products.create: ${error.message}`);
  }

  await logAdminAction({
    actor: admin.email,
    action: 'PRODUCT_CREATED',
    entityType: 'product',
    entityId: data.id,
    details: { code, name, price },
  });

  return data;
}

export async function updateProduct(
  id: string,
  input: ProductInput,
  admin: AdminSession
): Promise<ProductRow> {
  const patch: Record<string, unknown> = {};

  if (input.code !== undefined) {
    const code = input.code.trim().toUpperCase();
    if (!code) throw new BadRequest('Product code cannot be empty.');
    patch.code = code;
  }
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new BadRequest('Product name cannot be empty.');
    patch.name = name;
  }
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.emoji !== undefined) patch.emoji = input.emoji?.trim() || null;
  if (input.price !== undefined) {
    const price = Number(input.price);
    if (!Number.isFinite(price) || price < 0) throw new BadRequest('Price must be zero or more.');
    patch.price = price;
  }
  if (input.active !== undefined) patch.active = input.active;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;

  if (!Object.keys(patch).length) throw new BadRequest('Nothing to update.');

  const { data, error } = await supabaseAdmin()
    .from('products')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single<ProductRow>();

  if (error) {
    if (error.code === '23505') throw new BadRequest('That product code is already taken.');
    throw new Error(`products.update: ${error.message}`);
  }

  await logAdminAction({
    actor: admin.email,
    action: input.active === false ? 'PRODUCT_DEACTIVATED' : 'PRODUCT_UPDATED',
    entityType: 'product',
    entityId: id,
    details: patch,
  });

  return data;
}

export interface VariantInput {
  productId?: string;
  color?: string | null;
  size?: string | null;
  sku?: string | null;
  stockQuantity?: number;
  active?: boolean;
}

export async function createVariant(
  input: VariantInput,
  admin: AdminSession
): Promise<ProductVariantRow> {
  if (!input.productId) throw new BadRequest('A variant must belong to a product.');
  const stock = Math.max(0, Math.round(Number(input.stockQuantity ?? 0)));

  const { data, error } = await supabaseAdmin()
    .from('product_variants')
    .insert({
      product_id: input.productId,
      color: input.color?.trim() || null,
      size: input.size?.trim() || null,
      sku: input.sku?.trim() || null,
      stock_quantity: stock,
      active: input.active ?? true,
    })
    .select('*')
    .single<ProductVariantRow>();

  if (error) {
    if (error.code === '23505') {
      throw new BadRequest('That colour/size combination (or SKU) already exists.');
    }
    throw new Error(`products.createVariant: ${error.message}`);
  }

  await logAdminAction({
    actor: admin.email,
    action: 'VARIANT_CREATED',
    entityType: 'variant',
    entityId: data.id,
    details: { productId: input.productId, color: data.color, size: data.size, stock },
  });

  return data;
}

export async function updateVariant(
  id: string,
  input: VariantInput,
  admin: AdminSession
): Promise<ProductVariantRow> {
  const patch: Record<string, unknown> = {};
  if (input.color !== undefined) patch.color = input.color?.trim() || null;
  if (input.size !== undefined) patch.size = input.size?.trim() || null;
  if (input.sku !== undefined) patch.sku = input.sku?.trim() || null;
  if (input.active !== undefined) patch.active = input.active;
  if (input.stockQuantity !== undefined) {
    patch.stock_quantity = Math.max(0, Math.round(Number(input.stockQuantity)));
  }

  if (!Object.keys(patch).length) throw new BadRequest('Nothing to update.');

  const { data, error } = await supabaseAdmin()
    .from('product_variants')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single<ProductVariantRow>();

  if (error) {
    if (error.code === '23505') throw new BadRequest('That colour/size combination already exists.');
    throw new Error(`products.updateVariant: ${error.message}`);
  }

  await logAdminAction({
    actor: admin.email,
    action: 'VARIANT_UPDATED',
    entityType: 'variant',
    entityId: id,
    details: patch,
  });

  return data;
}

/**
 * Variants are deactivated, not deleted: order_items reference them, and an
 * old order must keep pointing at the thing that was actually sold.
 */
export async function deactivateVariant(id: string, admin: AdminSession): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('product_variants')
    .update({ active: false })
    .eq('id', id);

  if (error) throw new Error(`products.deactivateVariant: ${error.message}`);

  await logAdminAction({
    actor: admin.email,
    action: 'VARIANT_DELETED',
    entityType: 'variant',
    entityId: id,
    details: { softDelete: true },
  });
}

function toProductWithVariants(row: ProductQueryRow): ProductWithVariants {
  const { product_variants: variants, ...product } = row;
  return {
    ...product,
    price: Number(product.price ?? 0),
    variants: (variants ?? []).sort(
      (a, b) =>
        (a.color ?? '').localeCompare(b.color ?? '') || sizeRank(a.size) - sizeRank(b.size)
    ),
  };
}

const SIZE_ORDER = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

function sizeRank(size: string | null): number {
  if (!size) return -1;
  const index = SIZE_ORDER.indexOf(size.toUpperCase());
  return index === -1 ? 99 : index;
}
