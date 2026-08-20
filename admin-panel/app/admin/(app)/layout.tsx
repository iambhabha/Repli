import { AdminShell } from '@/components/admin/AdminShell';
import { NotConfigured } from '@/components/admin/NotConfigured';
import { requireAdmin } from '@/lib/auth/guard';
import { missingEnvVars } from '@/lib/env';
import { countUnreadTotal } from '@/lib/services/messages';
import { getSettings } from '@/lib/services/settings';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Every protected page renders inside this layout, and this layout starts with
 * requireAdmin(). A page can therefore never leak data by forgetting a check -
 * the layout runs first, on the server, on every request.
 *
 * `(app)` is a route group: it shapes the layout tree without appearing in the
 * URL, so these pages are still /admin/dashboard, /admin/orders and so on,
 * while /admin/login sits outside the shell.
 */
export const dynamic = 'force-dynamic';

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const missing = missingEnvVars();
  if (missing.length) return <NotConfigured missing={missing} />;

  const session = await requireAdmin();
  const db = supabaseAdmin();

  const settings = await getSettings();

  const [unreadMessages, pendingPayments, lowStockCount, pendingOrders] = await Promise.all([
    countUnreadTotal().catch(() => 0),
    db
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'PROOF_RECEIVED')
      .then((result) => result.count ?? 0),
    db
      .from('product_variants')
      .select('id', { count: 'exact', head: true })
      .eq('active', true)
      .lte('stock_quantity', settings.lowStockThreshold)
      .then((result) => result.count ?? 0),
    db
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['PENDING_PAYMENT', 'PAYMENT_VERIFYING'])
      .then((result) => result.count ?? 0),
  ]);

  return (
    <AdminShell
      email={session.email}
      name={session.name}
      botEnabled={settings.botEnabled}
      businessName={settings.businessName}
      counts={{ unreadMessages, pendingPayments, lowStock: lowStockCount, pendingOrders }}
    >
      {children}
    </AdminShell>
  );
}
