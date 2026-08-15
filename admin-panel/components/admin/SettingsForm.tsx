'use client';

import { Loader2, Power } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { toast } from '@/components/ui/Toast';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import type { RepliSettings } from '@/lib/services/settings';

/**
 * §26-27. These values live in `app_settings`, the same table the bot reads,
 * so saving here changes what the next customer is told.
 */
export function SettingsForm({ settings }: { settings: RepliSettings }) {
  const router = useRouter();
  const [form, setForm] = useState({
    businessName: settings.businessName,
    paymentLink: settings.paymentLink,
    shippingCharge: String(settings.shippingCharge),
    lowStockThreshold: String(settings.lowStockThreshold),
  });
  const [saving, setSaving] = useState(false);
  const [botEnabled, setBotEnabled] = useState(settings.botEnabled);
  const [switching, setSwitching] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.put('/api/settings', {
        businessName: form.businessName,
        paymentLink: form.paymentLink,
        shippingCharge: Number(form.shippingCharge || 0),
        lowStockThreshold: Number(form.lowStockThreshold || 0),
      });
      toast('Settings saved.');
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not save the settings.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleBot() {
    const next = !botEnabled;
    setSwitching(true);
    try {
      await api.put('/api/settings', { botEnabled: next });
      setBotEnabled(next);
      toast(
        next
          ? 'Repli is answering customers again.'
          : 'Automatic replies are off. Customers get nothing until you turn it back on.',
        next ? 'success' : 'info'
      );
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not change the bot status.', 'error');
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ---------------------------------------------------- bot control */}
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Bot status</h2>
            <p className="mt-1 flex items-center gap-2 text-sm">
              <span
                className={cn(
                  'h-2.5 w-2.5 rounded-full',
                  botEnabled ? 'bg-primary' : 'bg-muted-foreground/35'
                )}
                aria-hidden
              />
              <span className={botEnabled ? 'font-medium text-primary' : 'text-muted-foreground'}>
                {botEnabled ? 'ON — Repli replies automatically' : 'OFF — Repli stays silent'}
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={toggleBot}
            disabled={switching}
            className={botEnabled ? 'btn-danger' : 'btn-primary'}
          >
            {switching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
            {botEnabled ? 'Turn OFF' : 'Turn ON'}
          </button>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Turning the bot off does not stop the panel: you can still read messages and reply by hand.
          Human-mode conversations are unaffected either way.
        </p>
      </section>

      {/* -------------------------------------------------------- settings */}
      <form onSubmit={save} className="card space-y-5 p-5">
        <h2 className="text-sm font-semibold text-foreground">Business</h2>

        <label className="block">
          <span className="label">Business name</span>
          <input
            className="input"
            value={form.businessName}
            onChange={(event) => setForm({ ...form, businessName: event.target.value })}
            placeholder="Repli"
          />
        </label>

        <label className="block">
          <span className="label">Payment link</span>
          <input
            className="input"
            value={form.paymentLink}
            onChange={(event) => setForm({ ...form, paymentLink: event.target.value })}
            placeholder="https://your-upi-or-payment-link"
            inputMode="url"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            Sent to the customer when an order is placed. An empty link means no order can be paid.
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Shipping charge (₹)</span>
            <input
              className="input"
              type="number"
              min={0}
              value={form.shippingCharge}
              onChange={(event) => setForm({ ...form, shippingCharge: event.target.value })}
            />
          </label>

          <label className="block">
            <span className="label">Low stock threshold</span>
            <input
              className="input"
              type="number"
              min={0}
              value={form.lowStockThreshold}
              onChange={(event) => setForm({ ...form, lowStockThreshold: event.target.value })}
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              Variants at or below this count show as LOW STOCK.
            </span>
          </label>
        </div>

        <div className="flex justify-end border-t border-border pt-4">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
