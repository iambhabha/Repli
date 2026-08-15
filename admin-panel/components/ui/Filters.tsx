'use client';

import { Search, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * Search box that writes to the querystring. Filters live in the URL so the
 * page stays a Server Component, links are shareable, and back/forward work.
 */
export function SearchInput({
  placeholder = 'Search…',
  paramName = 'q',
  className,
}: {
  placeholder?: string;
  paramName?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get(paramName) ?? '');
  const [isPending, startTransition] = useTransition();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) params.set(paramName, value.trim());
      else params.delete(paramName);
      params.delete('page');

      startTransition(() => {
        router.replace(`${pathname}${params.toString() ? `?${params}` : ''}`, { scroll: false });
      });
    }, 350);

    return () => window.clearTimeout(timer);
    // searchParams intentionally omitted: reacting to it would fight the user's typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, pathname, paramName, router]);

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn('input pl-9', isPending && 'opacity-70')}
      />
      {value ? (
        <button
          type="button"
          onClick={() => setValue('')}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-muted-foreground"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

export interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

/** Filter chips as real links - no JS needed to change a filter. */
export function FilterTabs({
  options,
  paramName,
  current,
  searchParams,
  pathname,
}: {
  options: FilterOption[];
  paramName: string;
  current: string;
  searchParams: Record<string, string | string[] | undefined>;
  pathname: string;
}) {
  return (
    <div className="scrollbar-thin flex gap-1.5 overflow-x-auto pb-1">
      {options.map((option) => {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(searchParams)) {
          const single = Array.isArray(value) ? value[0] : value;
          if (single && key !== paramName && key !== 'page') params.set(key, single);
        }
        if (option.value !== 'ALL') params.set(paramName, option.value);
        const href = `${pathname}${params.toString() ? `?${params}` : ''}`;
        const active = current === option.value;

        return (
          <Link
            key={option.value}
            href={href}
            scroll={false}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
              active
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'border border-border bg-white text-muted-foreground hover:bg-muted/50'
            )}
          >
            {option.label}
            {option.count !== undefined ? (
              <span className={cn('ml-1.5 text-xs', active ? 'text-muted-foreground' : 'text-muted-foreground')}>
                {option.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
