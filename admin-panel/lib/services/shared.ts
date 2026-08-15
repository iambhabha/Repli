import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Every service call goes through here. A failed query becomes a thrown Error
 * with a tagged message for the server log; route handlers and error
 * boundaries turn it into the one generic sentence the owner sees.
 */
export function unwrap<T>(
  result: { data: T | null; error: PostgrestError | null },
  context: string
): T {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  if (result.data === null) {
    throw new Error(`${context}: no data returned`);
  }
  return result.data;
}

export function unwrapMaybe<T>(
  result: { data: T | null; error: PostgrestError | null },
  context: string
): T | null {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.data;
}

export function unwrapCount(
  result: { count: number | null; error: PostgrestError | null },
  context: string
): number {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.count ?? 0;
}

/** PostgREST `in.()` needs a non-empty list; callers use this to short-circuit. */
export function chunk<T>(items: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function groupBy<T, K extends string>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = map.get(k);
    if (bucket) bucket.push(item);
    else map.set(k, [item]);
  }
  return map;
}
