'use client';

import { Loader2, PhoneOff, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { api } from '@/lib/api/client';
import { formatDate, formatPhone } from '@/lib/utils/format';
import type { BypassNumberRow } from '@/types/database';

/**
 * §25. Family, friends, your other phone. Repli checks this list before it
 * checks anything else, so an active row here means total silence.
 */
export function BypassTable({ numbers }: { numbers: BypassNumberRow[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<BypassNumberRow | null>(null);
  const [form, setForm] = useState({ phone: '', name: '', active: true });

  async function add() {
    setBusy(true);
    try {
      await api.post('/api/bypass', form);
      toast('Number added. Repli will ignore it from the next message.');
      setForm({ phone: '', name: '', active: true });
      setAdding(false);
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not add the number.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(row: BypassNumberRow) {
    setBusy(true);
    try {
      await api.put(`/api/bypass/${row.id}`, { active: !row.active });
      toast(row.active ? 'Number paused — Repli will reply again.' : 'Number is active again.');
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not update the number.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      await api.delete(`/api/bypass/${removing.id}`);
      toast('Number removed.');
      setRemoving(null);
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not remove the number.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={() => setAdding(true)} className="btn-primary">
          <Plus className="h-4 w-4" />
          Add Number
        </button>
      </div>

      <div className="card overflow-hidden">
        {numbers.length === 0 ? (
          <EmptyState
            title="No bypass numbers yet."
            hint="Add your family and friends so Repli never sends them a sales menu."
            icon={<PhoneOff className="h-6 w-6" />}
          />
        ) : (
          <div className="table-wrap">
            <table className="w-full">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="th">Name</th>
                  <th className="th">Phone</th>
                  <th className="th">Status</th>
                  <th className="th">Created</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {numbers.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-muted/50">
                    <td className="td font-medium text-foreground">{row.name || '—'}</td>
                    <td className="td">{formatPhone(row.phone)}</td>
                    <td className="td">
                      <Badge tone={row.active ? 'success' : 'neutral'}>
                        {row.active ? 'ACTIVE' : 'PAUSED'}
                      </Badge>
                    </td>
                    <td className="td whitespace-nowrap text-muted-foreground">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="td">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => toggle(row)}
                          disabled={busy}
                          className="btn-secondary py-1.5 text-xs"
                        >
                          {row.active ? 'Pause' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoving(row)}
                          disabled={busy}
                          className="btn-danger py-1.5 text-xs"
                          aria-label={`Remove ${row.phone}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={adding}
        onClose={() => (busy ? undefined : setAdding(false))}
        title="Add bypass number"
        description="Repli never replies to an active number on this list."
        footer={
          <>
            <button type="button" onClick={() => setAdding(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="button" onClick={add} disabled={busy || !form.phone} className="btn-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Add number
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="label">Name</span>
            <input
              className="input"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Brother"
            />
          </label>

          <label className="block">
            <span className="label">Phone</span>
            <input
              className="input"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              placeholder="+91 99999 99999"
              inputMode="tel"
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              Any format works — it is normalised the same way the bot does it.
            </span>
          </label>
        </div>
      </Modal>

      <Modal
        open={removing !== null}
        onClose={() => (busy ? undefined : setRemoving(null))}
        title="Remove this number?"
        description={removing ? formatPhone(removing.phone) : ''}
        footer={
          <>
            <button type="button" onClick={() => setRemoving(null)} className="btn-secondary">
              Cancel
            </button>
            <button type="button" onClick={remove} disabled={busy} className="btn-danger">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Remove
            </button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Repli will start replying to this number again with the normal sales flow.
        </p>
      </Modal>
    </div>
  );
}
