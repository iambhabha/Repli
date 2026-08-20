'use client';

import { EyeOff, Loader2, Pencil, Plus, Shapes } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { api } from '@/lib/api/client';
import type { Category } from '@/lib/services/categories';

/**
 * The "what are you looking for?" menu.
 *
 * Rows, not code: adding "Caps" here makes the bot offer caps and understand
 * the word on its very next message. The keywords are the spellings customers
 * actually type, and they are what the bot matches on.
 *
 * Two things this deliberately cannot do, because the backend cannot either:
 * a key cannot be renamed, since every product's `category` points at it; and
 * a category is hidden rather than deleted, for the same reason. Offering
 * either would be offering something that would corrupt the catalogue.
 */

interface CategoryDraft {
  key: string;
  label: string;
  emoji: string;
  keywords: string;
  sortOrder: string;
  active: boolean;
  /** Absent when the row is new; the key is fixed once it exists. */
  existing: boolean;
  hasImage: boolean;
}

const EMPTY: CategoryDraft = {
  key: '',
  label: '',
  emoji: '',
  keywords: '',
  sortOrder: '0',
  active: true,
  existing: false,
  hasImage: false,
};

export function CategoryTable({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<CategoryDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [hiding, setHiding] = useState<Category | null>(null);

  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      const payload = {
        label: draft.label,
        emoji: draft.emoji,
        keywords: draft.keywords,
        sortOrder: Number(draft.sortOrder || 0),
        active: draft.active,
      };

      if (draft.existing) {
        await api.put(`/api/categories/${draft.key}`, payload);
      } else {
        await api.post('/api/categories', { ...payload, key: draft.key });
      }

      toast(draft.existing ? 'Category updated.' : 'Category added.');
      setDraft(null);
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not save the category.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function hide() {
    if (!hiding) return;
    setBusy(true);
    try {
      await api.delete(`/api/categories/${hiding.key}`);
      toast('Category hidden. Its products keep their category.');
      setHiding(null);
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not hide the category.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" className="btn-primary" onClick={() => setDraft({ ...EMPTY })}>
          <Plus className="h-4 w-4" aria-hidden />
          Add category
        </button>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon={<Shapes className="h-6 w-6" aria-hidden />}
          title="No categories yet"
          hint="Add one and the bot starts offering it — no deploy needed."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="th text-left">Category</th>
                <th className="th text-left">Key</th>
                <th className="th text-left">Words customers use</th>
                <th className="th text-right">Order</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.key}>
                  <td className="td">
                    <span className="flex items-center gap-2 font-medium">
                      {category.emoji ? <span aria-hidden>{category.emoji}</span> : null}
                      {category.label}
                      {!category.active ? <Badge>HIDDEN</Badge> : null}
                    </span>
                  </td>
                  <td className="td font-mono text-xs text-muted-foreground">{category.key}</td>
                  <td className="td text-xs text-muted-foreground">
                    {category.keywords.length ? category.keywords.join(', ') : '—'}
                  </td>
                  <td className="td text-right tabular-nums">{category.sortOrder}</td>
                  <td className="td">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          setDraft({
                            key: category.key,
                            label: category.label,
                            emoji: category.emoji ?? '',
                            keywords: category.keywords.join(', '),
                            sortOrder: String(category.sortOrder),
                            active: category.active,
                            existing: true,
                            hasImage: Boolean(category.imagePath),
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                        Edit
                      </button>
                      {category.active ? (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setHiding(category)}
                        >
                          <EyeOff className="h-4 w-4" aria-hidden />
                          Hide
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ----------------------------------------------------- category form */}
      <Modal
        open={draft !== null}
        onClose={() => (busy ? undefined : setDraft(null))}
        title={draft?.existing ? 'Edit category' : 'Add category'}
        description="The bot picks this up on its next message."
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={save} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Save
            </button>
          </>
        }
      >
        {draft ? (
          <div className="space-y-4">
            <label className="block">
              <span className="label">Key</span>
              <input
                className="input font-mono"
                value={draft.key}
                disabled={draft.existing}
                onChange={(event) =>
                  setDraft({ ...draft, key: event.target.value.toLowerCase().replace(/\s+/g, '') })
                }
                placeholder="caps"
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                {draft.existing
                  ? 'Fixed. Every product in this category points at it.'
                  : 'Lowercase letters, numbers or underscores. Cannot be changed later.'}
              </span>
            </label>

            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <label className="block">
                <span className="label">Label</span>
                <input
                  className="input"
                  value={draft.label}
                  onChange={(event) => setDraft({ ...draft, label: event.target.value })}
                  placeholder="Caps"
                />
              </label>
              <label className="block">
                <span className="label">Emoji</span>
                <input
                  className="input"
                  value={draft.emoji}
                  onChange={(event) => setDraft({ ...draft, emoji: event.target.value })}
                  placeholder="🧢"
                />
              </label>
            </div>

            <label className="block">
              <span className="label">Words customers use</span>
              <input
                className="input"
                value={draft.keywords}
                onChange={(event) => setDraft({ ...draft, keywords: event.target.value })}
                placeholder="cap, caps, topi, टोपी"
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                Comma separated. The bot understands every one of these the moment you save.
              </span>
            </label>

            {draft.existing ? (
              <ImageUpload
                endpoint={`/api/categories/${draft.key}/image`}
                hasImage={draft.hasImage}
                label="Catalogue card"
                hint="Sent before the list when a customer picks this category — useful when one photo says more than a list of names."
                onChange={(hasImage) => setDraft((current) => (current ? { ...current, hasImage } : current))}
              />
            ) : (
              <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                Save the category first, then reopen it to add a catalogue photo.
              </p>
            )}

            <label className="block">
              <span className="label">Menu order</span>
              <input
                className="input"
                type="number"
                value={draft.sortOrder}
                onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })}
              />
            </label>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={draft.active}
                onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
              />
              <span>
                <span className="block text-sm font-medium">Active</span>
                <span className="block text-xs text-muted-foreground">
                  A category is still only offered when something in it is in stock.
                </span>
              </span>
            </label>
          </div>
        ) : null}
      </Modal>

      {/* -------------------------------------------------------- hide */}
      <Modal
        open={hiding !== null}
        onClose={() => (busy ? undefined : setHiding(null))}
        title={`Hide ${hiding?.label ?? ''}?`}
        description="The bot stops offering it. Nothing is deleted, and its products keep their category — you can turn it back on any time."
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setHiding(null)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={hide} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Hide it
            </button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Products already in {hiding?.label ?? 'it'} keep their category and can still be sold
          directly by name.
        </p>
      </Modal>
    </div>
  );
}
