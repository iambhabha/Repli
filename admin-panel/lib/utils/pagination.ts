export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export interface PageParams {
  page: number;
  pageSize: number;
  from: number;
  to: number;
}

/** Never trust the querystring: clamp everything before it reaches the database. */
export function parsePageParams(
  searchParams: Record<string, string | string[] | undefined>,
  defaultSize = DEFAULT_PAGE_SIZE
): PageParams {
  const page = Math.max(1, toInt(first(searchParams.page), 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(5, toInt(first(searchParams.per), defaultSize)));
  const from = (page - 1) * pageSize;
  return { page, pageSize, from, to: from + pageSize - 1 };
}

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export function paginate<T>(rows: T[], total: number, params: PageParams): Paginated<T> {
  return {
    rows,
    total,
    page: params.page,
    pageSize: params.pageSize,
    pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

export function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function toInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Builds a querystring that keeps the current filters and changes one key. */
export function buildQuery(
  current: Record<string, string | string[] | undefined>,
  changes: Record<string, string | number | undefined | null>
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    const single = first(value);
    if (single) params.set(key, single);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined || value === null || value === '') params.delete(key);
    else params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

/**
 * PostgREST treats , . : ( ) as operator syntax inside or()/ilike() filters,
 * so user input has to be neutralised before it goes near a query string.
 */
export function escapeLike(term: string): string {
  return term.replace(/[,.()%\\]/g, ' ').trim();
}
