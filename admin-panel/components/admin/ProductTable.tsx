'use client';

import { ChevronDown, ChevronRight, Loader2, Package, Pencil, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge, StockBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format';
import { stockLevel, type ProductWithVariants } from '@/types/product';

interface ProductDraft {
  id?: string;
  code: string;
  name: string;
  description: string;
  emoji: string;
  price: string;
  active: boolean;
}

interface VariantDraft {
  id?: string;
  productId: string;
  color: string;
  size: string;
  sku: string;
  stockQuantity: string;
  active: boolean;
}

const EMPTY_PRODUCT: ProductDraft = {
  code: '',
  name: '',
  description: '',
  emoji: '',
  price: '',
  active: true,
};

/**
 * §20-22. Products and their variants in one place, because in practice the
 * owner adds "T-Shirt" and its eight colour/size rows in the same sitting.
 */
export function ProductTable({
  products,
  threshold,
}: {
  products: ProductWithVariants[];
  threshold: number;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(products[0]?.id ?? null);
  const [productDraft, setProductDraft] = useState<ProductDraft | null>(null);
  const [variantDraft, setVariantDraft] = useState<VariantDraft | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveProduct() {
    if (!productDraft) return;
    setBusy(true);
    try {
      const payload = {
        code: productDraft.code,
        name: productDraft.name,
        description: productDraft.description,
        emoji: productDraft.emoji,
        price: Number(productDraft.price || 0),
        active: productDraft.active,
      };

      if (productDraft.id) await api.put(`/api/products/${productDraft.id}`, payload);
      else await api.post('/api/products', payload);

      toast(productDraft.id ? 'Product updated.' : 'Product added.');
      setProductDraft(null);
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not save the product.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function saveVariant() {
    if (!variantDraft) return;
    setBusy(true);
    try {
      const payload = {
        color: variantDraft.color,
        size: variantDraft.size,
        sku: variantDraft.sku,
        stockQuantity: Number(variantDraft.stockQuantity || 0),
        active: variantDraft.active,
      };

      if (variantDraft.id) await api.put(`/api/variants/${variantDraft.id}`, payload);
      else await api.post(`/api/products/${variantDraft.productId}/variants`, payload);

      toast(variantDraft.id ? 'Variant updated.' : 'Variant added.');
      setVariantDraft(null);
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not save the variant.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(product: ProductWithVariants) {
    setBusy(true);
    try {
      await api.put(`/api/products/${product.id}`, { active: !product.active });
      toast(product.active ? 'Product deactivated.' : 'Product activated.');
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not update the product.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={() => setProductDraft({ ...EMPTY_PRODUCT })} className="btn-primary">
          <Plus className="h-4 w-4" />
          Add Product
        </button>
      </div>

      {products.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No products yet."
            hint="Add a product and its colour/size variants — the bot offers exactly what is active here."
            icon={<Package className="h-6 w-6" />}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product) => {
            const open = expanded === product.id;
            const totalStock = product.variants.reduce(
              (sum, variant) => sum + variant.stock_quantity,
              0
            );

            return (
              <section key={product.id} className="card overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : product.id)}
                    className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-muted-foreground"
                    aria-label={open ? 'Collapse variants' : 'Expand variants'}
                    aria-expanded={open}
                  >
                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <span aria-hidden>{product.emoji}</span>
                      {product.name}
                      <span className="text-xs font-normal text-muted-foreground">{product.code}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {product.variants.length} variants · {totalStock} in stock
                      {product.description ? ` · ${product.description}` : ''}
                    </p>
                  </div>

                  <p className="text-sm font-semibold text-foreground tabular-nums">
                    {formatCurrency(product.price)}
                  </p>

                  <Badge tone={product.active ? 'success' : 'neutral'}>
                    {product.active ? 'ACTIVE' : 'INACTIVE'}
                  </Badge>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setProductDraft({
                          id: product.id,
                          code: product.code,
                          name: product.name,
                          description: product.description ?? '',
                          emoji: product.emoji ?? '',
                          price: String(product.price),
                          active: product.active,
                        })
                      }
                      className="btn-secondary py-1.5 text-xs"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(product)}
                      disabled={busy}
                      className="btn-secondary py-1.5 text-xs"
                    >
                      {product.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>

                {open ? (
                  <div className="border-t border-border bg-muted/40/60">
                    <div className="table-wrap">
                      <table className="w-full">
                        <thead>
                          <tr>
                            <th className="th">Colour</th>
                            <th className="th">Size</th>
                            <th className="th">SKU</th>
                            <th className="th text-right">Stock</th>
                            <th className="th">Status</th>
                            <th className="th" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {product.variants.length === 0 ? (
                            <tr>
                              <td className="td text-muted-foreground" colSpan={6}>
                                No variants yet. Add a colour/size so the bot can sell this product.
                              </td>
                            </tr>
                          ) : (
                            product.variants.map((variant) => (
                              <tr key={variant.id} className="bg-white">
                                <td className="td">{variant.color || '—'}</td>
                                <td className="td">{variant.size || '—'}</td>
                                <td className="td font-mono text-xs">{variant.sku || '—'}</td>
                                <td className="td text-right tabular-nums">{variant.stock_quantity}</td>
                                <td className="td">
                                  <div className="flex items-center gap-2">
                                    <StockBadge level={stockLevel(variant.stock_quantity, threshold)} />
                                    {!variant.active ? <Badge>HIDDEN</Badge> : null}
                                  </div>
                                </td>
                                <td className="td text-right">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setVariantDraft({
                                        id: variant.id,
                                        productId: product.id,
                                        color: variant.color ?? '',
                                        size: variant.size ?? '',
                                        sku: variant.sku ?? '',
                                        stockQuantity: String(variant.stock_quantity),
                                        active: variant.active,
                                      })
                                    }
                                    className="btn-ghost py-1 text-xs"
                                  >
                                    Edit
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          setVariantDraft({
                            productId: product.id,
                            color: '',
                            size: '',
                            sku: '',
                            stockQuantity: '0',
                            active: true,
                          })
                        }
                        className="btn-secondary py-1.5 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add variant
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------ product form */}
      <Modal
        open={productDraft !== null}
        onClose={() => (busy ? undefined : setProductDraft(null))}
        title={productDraft?.id ? 'Edit product' : 'Add product'}
        description="Changes take effect on the bot's next message."
        footer={
          <>
            <button type="button" onClick={() => setProductDraft(null)} className="btn-secondary">
              Cancel
            </button>
            <button type="button" onClick={saveProduct} disabled={busy} className="btn-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </button>
          </>
        }
      >
        {productDraft ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Product code">
                <input
                  className="input"
                  value={productDraft.code}
                  onChange={(event) =>
                    setProductDraft({ ...productDraft, code: event.target.value.toUpperCase() })
                  }
                  placeholder="TS002"
                />
              </Field>
              <Field label="Emoji">
                <input
                  className="input"
                  value={productDraft.emoji}
                  onChange={(event) => setProductDraft({ ...productDraft, emoji: event.target.value })}
                  placeholder="👕"
                />
              </Field>
            </div>

            <Field label="Product name">
              <input
                className="input"
                value={productDraft.name}
                onChange={(event) => setProductDraft({ ...productDraft, name: event.target.value })}
                placeholder="T-Shirt"
              />
            </Field>

            <Field label="Description">
              <input
                className="input"
                value={productDraft.description}
                onChange={(event) =>
                  setProductDraft({ ...productDraft, description: event.target.value })
                }
                placeholder="Cotton round-neck t-shirt"
              />
            </Field>

            <Field label="Price (₹)">
              <input
                className="input"
                type="number"
                min={0}
                value={productDraft.price}
                onChange={(event) => setProductDraft({ ...productDraft, price: event.target.value })}
                placeholder="699"
              />
            </Field>

            <Toggle
              label="Active"
              hint="Inactive products disappear from the bot's menu."
              checked={productDraft.active}
              onChange={(active) => setProductDraft({ ...productDraft, active })}
            />
          </div>
        ) : null}
      </Modal>

      {/* ------------------------------------------------------ variant form */}
      <Modal
        open={variantDraft !== null}
        onClose={() => (busy ? undefined : setVariantDraft(null))}
        title={variantDraft?.id ? 'Edit variant' : 'Add variant'}
        description="Leave size empty for products without sizes, like a bag."
        footer={
          <>
            <button type="button" onClick={() => setVariantDraft(null)} className="btn-secondary">
              Cancel
            </button>
            <button type="button" onClick={saveVariant} disabled={busy} className="btn-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </button>
          </>
        }
      >
        {variantDraft ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Colour">
                <input
                  className="input"
                  value={variantDraft.color}
                  onChange={(event) => setVariantDraft({ ...variantDraft, color: event.target.value })}
                  placeholder="Black"
                />
              </Field>
              <Field label="Size">
                <input
                  className="input"
                  value={variantDraft.size}
                  onChange={(event) => setVariantDraft({ ...variantDraft, size: event.target.value })}
                  placeholder="L"
                />
              </Field>
            </div>

            <Field label="SKU">
              <input
                className="input font-mono"
                value={variantDraft.sku}
                onChange={(event) => setVariantDraft({ ...variantDraft, sku: event.target.value })}
                placeholder="TS-BLK-L"
              />
            </Field>

            <Field label="Stock quantity">
              <input
                className="input"
                type="number"
                min={0}
                value={variantDraft.stockQuantity}
                onChange={(event) =>
                  setVariantDraft({ ...variantDraft, stockQuantity: event.target.value })
                }
              />
            </Field>

            <Toggle
              label="Active"
              hint="Inactive variants are never offered, even with stock left."
              checked={variantDraft.active}
              onChange={(active) => setVariantDraft({ ...variantDraft, active })}
            />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'mt-0.5 h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors',
          checked ? 'bg-primary' : 'bg-muted-foreground/35'
        )}
      >
        <span
          className={cn(
            'block h-5 w-5 rounded-full bg-white transition-transform',
            checked && 'translate-x-5'
          )}
        />
      </button>
      <span>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}
