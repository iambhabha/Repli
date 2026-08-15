'use client';

import { Boxes, Loader2, Minus, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { StockBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { api } from '@/lib/api/client';
import { stockLevel, type StockRow } from '@/types/product';

/**
 * §23-24. Stock is the number the bot trusts when it decides whether it can
 * sell something, so every change here goes straight to product_variants -
 * clamped at zero, never negative.
 */
export function StockTable({
  rows,
  threshold,
  query,
}: {
  rows: StockRow[];
  threshold: number;
  query: string;
}) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [editing, setEditing] = useState<StockRow | null>(null);
  const [editValue, setEditValue] = useState('0');

  // Server data wins whenever the page re-renders.
  useEffect(() => {
    setQuantities(Object.fromEntries(rows.map((row) => [row.id, row.stock_quantity])));
  }, [rows]);

  async function adjust(row: StockRow, delta: number) {
    const current = quantities[row.id] ?? row.stock_quantity;
    if (delta < 0 && current === 0) return;

    setPending(row.id);
    setQuantities((state) => ({ ...state, [row.id]: Math.max(0, current + delta) }));

    try {
      const result = await api.put<{ stock_quantity: number }>(`/api/stock/${row.id}`, { delta });
      setQuantities((state) => ({ ...state, [row.id]: result.stock_quantity }));
      router.refresh();
    } catch (error) {
      setQuantities((state) => ({ ...state, [row.id]: current }));
      toast(error instanceof Error ? error.message : 'Could not update stock.', 'error');
    } finally {
      setPending(null);
    }
  }

  async function saveExact() {
    if (!editing) return;
    const quantity = Math.max(0, Math.round(Number(editValue)));
    if (!Number.isFinite(quantity)) {
      toast('Enter a whole number.', 'error');
      return;
    }

    setPending(editing.id);
    try {
      const result = await api.put<{ stock_quantity: number }>(`/api/stock/${editing.id}`, {
        quantity,
      });
      setQuantities((state) => ({ ...state, [editing.id]: result.stock_quantity }));
      toast('Stock updated.');
      setEditing(null);
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not update stock.', 'error');
    } finally {
      setPending(null);
    }
  }

  if (!rows.length) {
    return (
      <EmptyState
        title={query ? 'No variants match that search.' : 'No low-stock products.'}
        hint={
          query
            ? 'Search by product, colour, size or SKU.'
            : 'Add a product variant to start tracking stock.'
        }
        icon={<Boxes className="h-6 w-6" />}
      />
    );
  }

  return (
    <>
      <div className="table-wrap hidden md:block">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="th">Product</th>
              <th className="th">Colour</th>
              <th className="th">Size</th>
              <th className="th">SKU</th>
              <th className="th text-right">Stock</th>
              <th className="th">Status</th>
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const quantity = quantities[row.id] ?? row.stock_quantity;
              return (
                <tr key={row.id} className="transition-colors hover:bg-muted/50">
                  <td className="td font-medium text-foreground">
                    <span aria-hidden>{row.productEmoji} </span>
                    {row.productName}
                  </td>
                  <td className="td">{row.color || '—'}</td>
                  <td className="td">{row.size || '—'}</td>
                  <td className="td font-mono text-xs">{row.sku || '—'}</td>
                  <td className="td text-right font-semibold tabular-nums">{quantity}</td>
                  <td className="td">
                    <StockBadge level={stockLevel(quantity, threshold)} />
                  </td>
                  <td className="td">
                    <StockControls
                      busy={pending === row.id}
                      quantity={quantity}
                      onAdjust={(delta) => adjust(row, delta)}
                      onEdit={() => {
                        setEditing(row);
                        setEditValue(String(quantity));
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-border md:hidden">
        {rows.map((row) => {
          const quantity = quantities[row.id] ?? row.stock_quantity;
          return (
            <li key={row.id} className="px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    <span aria-hidden>{row.productEmoji} </span>
                    {row.productName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[row.color, row.size].filter(Boolean).join(' / ') || 'Single variant'}
                    {row.sku ? ` · ${row.sku}` : ''}
                  </p>
                </div>
                <StockBadge level={stockLevel(quantity, threshold)} />
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-lg font-semibold text-foreground tabular-nums">{quantity}</span>
                <StockControls
                  busy={pending === row.id}
                  quantity={quantity}
                  onAdjust={(delta) => adjust(row, delta)}
                  onEdit={() => {
                    setEditing(row);
                    setEditValue(String(quantity));
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Set stock"
        description={
          editing
            ? `${editing.productName} ${[editing.color, editing.size].filter(Boolean).join(' / ')}`
            : ''
        }
        footer={
          <>
            <button type="button" onClick={() => setEditing(null)} className="btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              onClick={saveExact}
              disabled={pending !== null}
              className="btn-primary"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </button>
          </>
        }
      >
        <label className="block">
          <span className="label">Stock quantity</span>
          <input
            type="number"
            min={0}
            className="input"
            value={editValue}
            onChange={(event) => setEditValue(event.target.value)}
            autoFocus
          />
        </label>
        <p className="mt-2 text-xs text-muted-foreground">
          Stock can never go below zero. Confirmed orders reduce it automatically.
        </p>
      </Modal>
    </>
  );
}

function StockControls({
  busy,
  quantity,
  onAdjust,
  onEdit,
}: {
  busy: boolean;
  quantity: number;
  onAdjust: (delta: number) => void;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => onAdjust(-1)}
        disabled={busy || quantity === 0}
        className="btn-secondary px-2 py-1.5"
        aria-label="Reduce stock by one"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onAdjust(1)}
        disabled={busy}
        className="btn-secondary px-2 py-1.5"
        aria-label="Add one to stock"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={onEdit} disabled={busy} className="btn-ghost py-1.5 text-xs">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Edit'}
      </button>
    </div>
  );
}
