'use client';

import { Menu, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NotificationBell } from '@/components/admin/NotificationBell';
import { cn } from '@/lib/utils';

/** Breadcrumb labels, keyed by the first segment under /admin. */
const SECTION_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  messages: 'Messages',
  customers: 'Customers',
  orders: 'Orders',
  payments: 'Payments',
  products: 'Products',
  stock: 'Stock',
  bypass: 'Bypass numbers',
  settings: 'Settings',
};

export function Topbar({
  onOpenMenu,
  onToggleSidebar,
  onOpenSearch,
  collapsed,
  botEnabled,
  businessName,
  adminName,
}: {
  onOpenMenu: () => void;
  onToggleSidebar: () => void;
  onOpenSearch: () => void;
  collapsed: boolean;
  botEnabled: boolean;
  businessName: string;
  adminName: string | null;
}) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean); // ['admin', 'orders', 'REP-1011']
  const section = segments[1] ?? 'dashboard';
  const detail = segments[2];

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card px-4 sm:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-[18px]" strokeWidth={1.5} />
      </button>

      <button
        type="button"
        onClick={onToggleSidebar}
        className="hidden rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:block"
        aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
        title={collapsed ? 'Show sidebar' : 'Hide sidebar'}
      >
        {collapsed ? (
          <PanelLeftOpen className="size-[18px]" strokeWidth={1.5} />
        ) : (
          <PanelLeftClose className="size-[18px]" strokeWidth={1.5} />
        )}
      </button>

      {/* Mobile keeps the wordmark; desktop shows the breadcrumb instead. */}
      <Link href="/admin/dashboard" className="flex items-center gap-2 lg:hidden">
        <span className="font-bold tracking-widest text-brand-mark">REPLI</span>
      </Link>

      <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-2 text-sm lg:flex">
        <span className="truncate text-muted-foreground">{businessName}</span>
        <span className="text-muted-foreground">/</span>
        <Link
          href={`/admin/${section}`}
          className="truncate font-medium text-foreground hover:underline"
        >
          {SECTION_LABELS[section] ?? 'Dashboard'}
        </Link>
        {detail ? (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="truncate font-medium text-foreground">
              {decodeURIComponent(detail)}
            </span>
          </>
        ) : null}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenSearch}
          className="hidden h-8 items-center gap-2 rounded-md border border-border bg-muted/50 px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
          aria-label="Search"
        >
          <Search className="size-4" strokeWidth={1.5} />
          <span>Search…</span>
          <kbd className="ml-6 rounded-[4px] border border-border px-1 font-mono text-[10px]">
            ⌘K
          </kbd>
        </button>

        <button
          type="button"
          onClick={onOpenSearch}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:hidden"
          aria-label="Search"
        >
          <Search className="size-[18px]" strokeWidth={1.5} />
        </button>

        <Link
          href="/admin/settings"
          className={cn(
            'badge border transition-colors',
            botEnabled
              ? 'border-foreground bg-foreground text-background'
              : 'border-border bg-muted text-muted-foreground hover:bg-accent'
          )}
          title={botEnabled ? 'Repli is replying automatically' : 'Automatic replies are off'}
        >
          BOT {botEnabled ? 'ON' : 'OFF'}
        </Link>

        <NotificationBell />

        <span
          className="flex size-8 items-center justify-center rounded-full border border-border bg-muted text-[11px] font-semibold text-muted-foreground uppercase"
          title={adminName ?? 'Admin'}
        >
          {(adminName ?? 'Admin').slice(0, 2)}
        </span>
      </div>
    </header>
  );
}
