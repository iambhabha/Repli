import { AlertTriangle, CreditCard, IndianRupee, ShoppingBag, Users } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format';
import type { DashboardStats } from '@/lib/services/dashboard';

interface Card {
  label: string;
  value: string;
  hint: string;
  href: string;
  icon: typeof Users;
  tone: 'brand' | 'sky' | 'emerald' | 'amber' | 'red';
  alert?: boolean;
}

const TONES = {
  brand: 'bg-primary/10 text-primary',
  sky: 'bg-muted text-foreground',
  emerald: 'bg-muted text-foreground',
  amber: 'bg-muted text-foreground',
  red: 'bg-muted text-foreground',
} as const;

/** §7: the five numbers the owner opens the panel for. */
export function DashboardCards({ stats }: { stats: DashboardStats }) {
  const cards: Card[] = [
    {
      label: 'Customers',
      value: String(stats.totalCustomers),
      hint: `${stats.todaysNewCustomers} new today`,
      href: '/admin/customers',
      icon: Users,
      tone: 'sky',
    },
    {
      label: 'Orders',
      value: String(stats.totalOrders),
      hint: `${stats.pendingOrders} pending · ${stats.confirmedOrders} confirmed`,
      href: '/admin/orders',
      icon: ShoppingBag,
      tone: 'brand',
    },
    {
      label: "Today's Revenue",
      value: formatCurrency(stats.todaysRevenue),
      hint: 'Verified payments today',
      href: '/admin/payments?status=VERIFIED',
      icon: IndianRupee,
      tone: 'emerald',
    },
    {
      label: 'Pending Payments',
      value: String(stats.pendingPayments),
      hint: stats.pendingPayments ? 'Waiting for you to verify' : 'Nothing to verify',
      href: '/admin/payments',
      icon: CreditCard,
      tone: 'amber',
      alert: stats.pendingPayments > 0,
    },
    {
      label: 'Low Stock',
      value: String(stats.lowStockProducts),
      hint: stats.lowStockProducts ? 'Restock soon' : 'Stock looks healthy',
      href: '/admin/stock?level=LOW',
      icon: AlertTriangle,
      tone: 'red',
      alert: stats.lowStockProducts > 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
      {cards.map((card) => (
        <Link
          key={card.label}
          href={card.href}
          className={cn(
            'card group p-4 transition-shadow hover:shadow-md',
            card.alert && 'ring-1 ring-foreground/25'
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{card.label}</p>
            <span className={cn('rounded-lg p-1.5', TONES[card.tone])}>
              <card.icon className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-foreground tabular-nums">{card.value}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{card.hint}</p>
        </Link>
      ))}
    </div>
  );
}
