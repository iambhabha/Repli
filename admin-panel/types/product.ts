import type { ProductRow, ProductVariantRow } from './database';

export type Product = ProductRow;
export type ProductVariant = ProductVariantRow;

export interface ProductWithVariants extends ProductRow {
  variants: ProductVariantRow[];
}

export type StockLevel = 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK';

/** One row on /admin/stock: a variant flattened with its product. */
export interface StockRow extends ProductVariantRow {
  productName: string;
  productCode: string;
  productEmoji: string | null;
  level: StockLevel;
}

export function stockLevel(quantity: number, threshold: number): StockLevel {
  if (quantity <= 0) return 'OUT_OF_STOCK';
  if (quantity <= threshold) return 'LOW_STOCK';
  return 'IN_STOCK';
}
