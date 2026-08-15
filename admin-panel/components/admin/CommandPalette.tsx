'use client';

import {
  Command as CommandIcon,
  CornerDownLeft,
  Loader2,
  Search,
  ShoppingBag,
  User,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPhone } from '@/lib/utils/format';

interface Result {
  id: string;
  kind: 'page' | 'customer' | 'order';
  title: string;
  hint?: string;
  href: string;
}

const PAGES: Result[] = [
  { id: 'p-dashboard', kind: 'page', title: 'Dashboard', href: '/admin/dashboard' },
  { id: 'p-messages', kind: 'page', title: 'Messages', href: '/admin/messages' },
  { id: 'p-customers', kind: 'page', title: 'Customers', href: '/admin/customers' },
  { id: 'p-orders', kind: 'page', title: 'Orders', href: '/admin/orders' },
  { id: 'p-payments', kind: 'page', title: 'Payments — needs verification', href: '/admin/payments' },
  { id: 'p-products', kind: 'page', title: 'Products', href: '/admin/products' },
  { id: 'p-stock', kind: 'page', title: 'Stock', href: '/admin/stock' },
  { id: 'p-low', kind: 'page', title: 'Stock — low stock', href: '/admin/stock?level=LOW' },
  { id: 'p-bypass', kind: 'page', title: 'Bypass numbers', href: '/admin/bypass' },
  { id: 'p-settings', kind: 'page', title: 'Settings', href: '/admin/settings' },
];

interface CustomerHit {
  id: string;
  name: string | null;
  phone: string;
  city: string | null;
  ordersCount: number;
}

interface OrderHit {
  order_id: string;
  phone: string;
  customer_name: string | null;
  total: number;
  status: string;
}

/**
 * ⌘K. Searches the two things the owner looks up by name mid-conversation —
 * a customer and an order — plus every page, so navigation never needs the
 * mouse. The queries hit the same guarded API routes as the pages do.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<CustomerHit[]>([]);
  const [orders, setOrders] = useState<OrderHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fresh palette every time it opens.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCustomers([]);
    setOrders([]);
    setCursor(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (term.length < 2) {
      setCustomers([]);
      setOrders([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const [customerPage, orderPage] = await Promise.all([
          api.get<{ rows: CustomerHit[] }>(
            `/api/customers?q=${encodeURIComponent(term)}&per=5`
          ),
          api.get<{ rows: OrderHit[] }>(`/api/orders?q=${encodeURIComponent(term)}&per=5`),
        ]);
        if (cancelled) return;
        setCustomers(customerPage.rows ?? []);
        setOrders(orderPage.rows ?? []);
      } catch {
        if (!cancelled) {
          setCustomers([]);
          setOrders([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, open]);

  const results = useMemo<Result[]>(() => {
    const term = query.trim().toLowerCase();

    const pages = term
      ? PAGES.filter((page) => page.title.toLowerCase().includes(term))
      : PAGES.slice(0, 6);

    const customerResults: Result[] = customers.map((customer) => ({
      id: `c-${customer.id}`,
      kind: 'customer',
      title: customer.name || 'Unnamed customer',
      hint: `${formatPhone(customer.phone)}${customer.city ? ` · ${customer.city}` : ''}`,
      href: `/admin/customers/${customer.id}`,
    }));

    const orderResults: Result[] = orders.map((order) => ({
      id: `o-${order.order_id}`,
      kind: 'order',
      title: order.order_id,
      hint: `${order.customer_name || formatPhone(order.phone)} · ${formatCurrency(order.total)}`,
      href: `/admin/orders/${order.order_id}`,
    }));

    return [...pages, ...customerResults, ...orderResults];
  }, [query, customers, orders]);

  const go = useCallback(
    (result: Result) => {
      onClose();
      router.push(result.href);
    },
    [onClose, router]
  );

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setCursor((value) => (results.length ? (value + 1) % results.length : 0));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setCursor((value) => (results.length ? (value - 1 + results.length) % results.length : 0));
        return;
      }
      if (event.key === 'Enter') {
        const hit = results[cursor];
        if (hit) {
          event.preventDefault();
          go(hit);
        }
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, results, cursor, go, onClose]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  const grouped: Array<{ heading: string; items: Result[] }> = [
    { heading: 'Pages', items: results.filter((r) => r.kind === 'page') },
    { heading: 'Customers', items: results.filter((r) => r.kind === 'customer') },
    { heading: 'Orders', items: results.filter((r) => r.kind === 'order') },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="fixed inset-0 z-60 flex items-start justify-center bg-background/40 px-4 pt-[12vh] backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-xl animate-in overflow-hidden rounded-xl border border-border bg-card shadow-2xl duration-200 fade-in zoom-in-95">
        <div className="flex items-center border-b border-border px-4">
          <Search className="mr-3 size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.5} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="flex-1 bg-transparent py-4 text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="Search customers, orders or pages…"
            aria-label="Search"
          />
          {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
          <kbd
            onClick={onClose}
            className="ml-2 hidden h-5 cursor-pointer items-center justify-center rounded-[4px] border border-border px-1.5 font-mono text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
          >
            ESC
          </kbd>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close search"
          >
            <X className="size-[18px]" strokeWidth={1.5} />
          </button>
        </div>

        <div ref={listRef} className="scrollbar-thin max-h-[52vh] overflow-y-auto p-2">
          {grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-2 py-10 text-center">
              <CommandIcon className="mb-2 size-6 text-muted-foreground/50" strokeWidth={1.5} />
              <p className="text-[13px] font-medium text-muted-foreground">
                {query.trim().length < 2
                  ? 'Type a name, a phone number or an order id…'
                  : loading
                    ? 'Searching…'
                    : 'Nothing matches that.'}
              </p>
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.heading} className="mb-2 last:mb-0">
                <p className="px-2 py-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {group.heading}
                </p>
                {group.items.map((item) => {
                  const index = results.indexOf(item);
                  const active = index === cursor;
                  const Icon =
                    item.kind === 'customer' ? User : item.kind === 'order' ? ShoppingBag : Search;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-active={active}
                      onMouseEnter={() => setCursor(index)}
                      onClick={() => go(item)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors',
                        active ? 'bg-muted' : 'hover:bg-muted/60'
                      )}
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-foreground">
                          {item.title}
                        </span>
                        {item.hint ? (
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {item.hint}
                          </span>
                        ) : null}
                      </span>
                      {active ? (
                        <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
