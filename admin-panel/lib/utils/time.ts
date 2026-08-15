/** IST is +05:30 with no DST, so a fixed offset is exact, not an approximation. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Midnight IST for the day `now` falls in, as a UTC instant.
 * "Today's revenue" has to mean the shop's day, not the server's.
 */
export function startOfIstDay(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - IST_OFFSET_MS);
}

export function startOfIstDayIso(now: Date = new Date()): string {
  return startOfIstDay(now).toISOString();
}

export function daysAgoIso(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}
