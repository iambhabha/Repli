'use client';

import {
  Boxes,
  CreditCard,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MessageCircle,
  Package,
  PhoneOff,
  Search,
  Settings,
  ShoppingBag,
  Users,
} from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import {
  SidebarNav,
  type BrandData,
  type NavGroupData,
  type NavItemData,
} from '@/components/ui/dashboard-sidebar';

export interface SidebarCounts {
  unreadMessages: number;
  pendingPayments: number;
  lowStock: number;
  pendingOrders: number;
}

/**
 * Repli's navigation, in the shape the sidebar component expects.
 *
 * The nested children are the filters the owner actually reaches for — "which
 * orders are waiting on me", "who is in human mode", "what is nearly out of
 * stock". They are plain links carrying a querystring, so the pages stay
 * Server Components and every one of them is shareable.
 */
export function Sidebar({
  counts,
  brand,
  onNavigate,
  onAction,
}: {
  counts: SidebarCounts;
  brand: { businessName: string; botEnabled: boolean; email: string };
  onNavigate?: () => void;
  onAction?: (action: string) => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeHref = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const groups: NavGroupData[] = [
    {
      items: [
        { id: 'search', title: 'Search', icon: Search, shortcut: '⌘K', action: 'search' },
        { id: 'dashboard', title: 'Dashboard', icon: LayoutDashboard, href: '/admin/dashboard' },
        {
          id: 'messages',
          title: 'Messages',
          icon: MessageCircle,
          href: '/admin/messages',
          badge: counts.unreadMessages || undefined,
        },
        {
          id: 'payments',
          title: 'Payments',
          icon: CreditCard,
          href: '/admin/payments',
          badge: counts.pendingPayments || undefined,
        },
      ],
    },
    {
      heading: 'Shop',
      items: [
        {
          id: 'orders',
          title: 'Orders',
          icon: ShoppingBag,
          badge: counts.pendingOrders || undefined,
          children: [
            { id: 'o-all', title: 'All orders', icon: ListChecks, href: '/admin/orders' },
            {
              id: 'o-pending',
              title: 'Pending payment',
              icon: ListChecks,
              href: '/admin/orders?status=PENDING_PAYMENT',
            },
            {
              id: 'o-verifying',
              title: 'Payment verifying',
              icon: ListChecks,
              href: '/admin/orders?status=PAYMENT_VERIFYING',
            },
            {
              id: 'o-confirmed',
              title: 'Confirmed',
              icon: ListChecks,
              href: '/admin/orders?status=CONFIRMED',
            },
          ],
        },
        {
          id: 'customers',
          title: 'Customers',
          icon: Users,
          children: [
            { id: 'c-all', title: 'All customers', icon: ListChecks, href: '/admin/customers' },
            { id: 'c-bot', title: 'Bot mode', icon: ListChecks, href: '/admin/customers?mode=BOT' },
            {
              id: 'c-human',
              title: 'Human mode',
              icon: ListChecks,
              href: '/admin/customers?mode=HUMAN',
            },
          ],
        },
        { id: 'products', title: 'Products', icon: Package, href: '/admin/products' },
        {
          id: 'stock',
          title: 'Stock',
          icon: Boxes,
          badge: counts.lowStock || undefined,
          children: [
            { id: 's-all', title: 'All variants', icon: ListChecks, href: '/admin/stock' },
            { id: 's-low', title: 'Low stock', icon: ListChecks, href: '/admin/stock?level=LOW' },
            {
              id: 's-out',
              title: 'Out of stock',
              icon: ListChecks,
              href: '/admin/stock?level=OUT',
            },
          ],
        },
      ],
    },
    {
      heading: 'Bot',
      items: [{ id: 'bypass', title: 'Bypass numbers', icon: PhoneOff, href: '/admin/bypass' }],
    },
  ];

  const bottomItems: NavItemData[] = [
    { id: 'settings', title: 'Settings', icon: Settings, href: '/admin/settings' },
    { id: 'logout', title: 'Log out', icon: LogOut, action: 'logout' },
  ];

  const brandData: BrandData = {
    name: brand.businessName,
    subtitle: brand.botEnabled ? 'Bot ON' : 'Bot OFF',
    initial: brand.businessName.charAt(0).toUpperCase() || 'R',
    menu: [
      { id: 'who', label: brand.email, hint: 'signed in' },
      { id: 'settings', label: 'Settings', href: '/admin/settings' },
      {
        id: 'bot',
        label: brand.botEnabled ? 'Turn the bot off' : 'Turn the bot on',
        href: '/admin/settings',
        hint: brand.botEnabled ? 'ON' : 'OFF',
      },
      { id: 'logout', label: 'Log out', action: 'logout' },
    ],
  };

  return (
    <SidebarNav
      brand={brandData}
      groups={groups}
      bottomItems={bottomItems}
      activeHref={activeHref}
      onNavigate={onNavigate}
      onAction={onAction}
    />
  );
}
