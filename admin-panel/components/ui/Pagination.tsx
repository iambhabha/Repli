import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { buildQuery } from '@/lib/utils/pagination';

/**
 * §36: pages, never "load everything". Rendered server-side as plain links so
 * paging works with JavaScript still loading.
 */
export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  pathname,
  searchParams,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  pathname: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const hasPrev = page > 1;
  const hasNext = page < pageCount;

  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{from}</span>–
        <span className="font-medium text-foreground">{to}</span> of{' '}
        <span className="font-medium text-foreground">{total}</span>
      </p>

      <div className="flex items-center gap-2">
        <PageLink
          href={`${pathname}${buildQuery(searchParams, { page: page - 1 })}`}
          disabled={!hasPrev}
          label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Previous</span>
        </PageLink>

        <span className="px-2 text-xs text-muted-foreground">
          Page {page} of {pageCount}
        </span>

        <PageLink
          href={`${pathname}${buildQuery(searchParams, { page: page + 1 })}`}
          disabled={!hasNext}
          label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span
        className="btn-secondary cursor-not-allowed opacity-50"
        aria-disabled="true"
        aria-label={label}
      >
        {children}
      </span>
    );
  }

  return (
    <Link href={href} scroll={false} className="btn-secondary" aria-label={label}>
      {children}
    </Link>
  );
}
