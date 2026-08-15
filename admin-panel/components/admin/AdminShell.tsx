'use client';

import { X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { CommandPalette } from '@/components/admin/CommandPalette';
import { Sidebar, type SidebarCounts } from '@/components/admin/Sidebar';
import { Topbar } from '@/components/admin/Topbar';
import { toast, Toaster } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const COLLAPSE_KEY = 'repli.sidebar.collapsed';

/**
 * The frame: a collapsible sidebar on desktop, a slide-over drawer on mobile,
 * and the ⌘K palette on top of both.
 *
 * Only the shell is a Client Component — every page inside it stays a Server
 * Component and fetches its own data.
 */
export function AdminShell({
  children,
  counts,
  email,
  name,
  botEnabled,
  businessName,
}: {
  children: React.ReactNode;
  counts: SidebarCounts;
  email: string;
  name: string | null;
  botEnabled: boolean;
  businessName: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Remember the collapsed state, but read it after mount so the server HTML
  // and the first client render agree.
  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  // Navigating on a phone should close the drawer behind you.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // ⌘K / Ctrl+K anywhere in the panel.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const onAction = useCallback(
    async (action: string) => {
      if (action === 'search') {
        setPaletteOpen(true);
        return;
      }
      if (action === 'logout') {
        try {
          await createClient().auth.signOut();
          router.replace('/admin/login');
          router.refresh();
        } catch {
          toast('Could not sign out. Please try again.', 'error');
        }
      }
    },
    [router]
  );

  const sidebar = (
    <Sidebar
      counts={counts}
      brand={{ businessName, botEnabled, email }}
      onNavigate={() => setDrawerOpen(false)}
      onAction={onAction}
    />
  );

  return (
    <div className="min-h-screen bg-background">
      {/* ------------------------------------------------- desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden overflow-hidden border-r border-sidebar-border',
          'transition-[width] duration-300 ease-in-out lg:block',
          collapsed ? 'w-0 border-none' : 'w-[260px]'
        )}
        aria-hidden={collapsed}
      >
        {sidebar}
      </aside>

      {/* -------------------------------------------------- mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 h-full w-full bg-foreground/40"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
          />
          <div className="relative h-full w-[260px] max-w-[85vw] shadow-xl">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute top-4 right-3 z-10 rounded-md p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              aria-label="Close menu"
            >
              <X className="size-4" />
            </button>
            {sidebar}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          'transition-[padding] duration-300 ease-in-out',
          !collapsed && 'lg:pl-[260px]'
        )}
      >
        <Topbar
          onOpenMenu={() => setDrawerOpen(true)}
          onToggleSidebar={toggleCollapsed}
          onOpenSearch={() => setPaletteOpen(true)}
          collapsed={collapsed}
          botEnabled={botEnabled}
          businessName={businessName}
          adminName={name}
        />
        <main className="px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Toaster />
    </div>
  );
}
