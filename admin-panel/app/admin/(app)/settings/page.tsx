import type { Metadata } from 'next';
import { ScrollText } from 'lucide-react';

import { SettingsForm } from '@/components/admin/SettingsForm';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/States';
import { recentAdminActions } from '@/lib/audit';
import { requireAdmin } from '@/lib/auth/guard';
import { outboxHealth } from '@/lib/services/outbox';
import { getSettings } from '@/lib/services/settings';
import { formatDateTime, formatPhone } from '@/lib/utils/format';
import type { AdminActionRow } from '@/types/database';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [session, settings, actions, outbox] = await Promise.all([
    requireAdmin(),
    getSettings(),
    recentAdminActions(15),
    outboxHealth().catch(() => ({ pending: 0, failed: 0, oldestPendingAt: null })),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="Repli's live configuration. Saved changes apply immediately." />

      <SettingsForm settings={settings} />

      {/* --------------------------------------------------------- profile */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold text-foreground">Signed in as</h2>
        <p className="mt-2 text-sm text-foreground">{session.email}</p>
        {session.phone ? (
          <p className="text-sm text-muted-foreground">WhatsApp admin number: {session.phone}</p>
        ) : null}
        <p className="mt-3 text-xs text-muted-foreground">
          Use the logout button at the bottom of the sidebar to sign out.
        </p>
      </section>

      {/* ---------------------------------------------------------- outbox */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold text-foreground">Outgoing message queue</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Replies you send from the panel are handed to the bot process, which owns the WhatsApp
          session.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">Waiting</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{outbox.pending}</dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">Failed</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{outbox.failed}</dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">Oldest waiting</dt>
            <dd className="mt-1 text-sm">
              {outbox.oldestPendingAt ? formatDateTime(outbox.oldestPendingAt) : '—'}
            </dd>
          </div>
        </dl>
        {outbox.pending > 0 ? (
          <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-foreground">
            Messages are waiting. Make sure the Repli bot is running and connected to WhatsApp.
          </p>
        ) : null}
      </section>

      {/* ------------------------------------------------------ audit trail */}
      <section className="card overflow-hidden">
        <h2 className="border-b border-border px-5 py-3 text-sm font-semibold text-foreground">
          Recent admin actions
        </h2>
        {actions.length === 0 ? (
          <EmptyState
            title="No admin actions yet."
            hint="Verifying a payment, changing stock or flipping the bot switch all appear here."
            icon={<ScrollText className="h-6 w-6" />}
          />
        ) : (
          <ul className="divide-y divide-border">
            {actions.map((action) => (
              <li key={action.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3">
                <span className="badge bg-muted text-foreground">
                  {action.action.replaceAll('_', ' ')}
                </span>
                <span className="text-sm text-muted-foreground">{describeEntity(action)}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {action.actor} · {formatDateTime(action.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * A raw uuid tells the owner nothing. Where the audit entry recorded something
 * human - a SKU, a colour/size, a stock move - show that instead.
 */
function describeEntity(action: AdminActionRow): string {
  const details = (action.details ?? {}) as Record<string, unknown>;
  const label = (key: string) => (typeof details[key] === 'string' ? (details[key] as string) : '');

  if (action.entity_type === 'variant') {
    const parts = [label('sku') || null, [label('color'), label('size')].filter(Boolean).join(' / ')]
      .filter(Boolean)
      .join(' · ');
    const move =
      typeof details.before === 'number' && typeof details.after === 'number'
        ? ` (${details.before} → ${details.after})`
        : '';
    return `${parts || 'variant'}${move}`;
  }

  if (action.entity_type === 'conversation' || action.entity_type === 'bypass') {
    return formatPhone(action.entity_id);
  }

  return [action.entity_type, action.entity_id].filter(Boolean).join(' ');
}
