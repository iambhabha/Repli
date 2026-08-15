/**
 * Formatting helpers.
 *
 * Every formatter pins locale AND timezone. Server and browser then produce
 * byte-identical output, so React never reports a hydration mismatch and the
 * owner always sees IST - the timezone the shop actually runs in.
 */

const TIME_ZONE = 'Asia/Kolkata';
const LOCALE = 'en-IN';

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

const dayMonthFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: 'short',
});

export function formatCurrency(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return currencyFormatter.format(0);
  return currencyFormatter.format(amount);
}

export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : '—';
}

export function formatDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? dateTimeFormatter.format(date) : '—';
}

export function formatTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? timeFormatter.format(date) : '';
}

/**
 * Inbox-style stamp: time for today, "12 Aug" for anything older.
 * `now` is passed in so the caller decides the reference point (and so the
 * server can render a stable value).
 */
export function formatInboxTime(value: string | Date | null | undefined, now = new Date()): string {
  const date = toDate(value);
  if (!date) return '';
  const sameDay = dateFormatter.format(date) === dateFormatter.format(now);
  return sameDay ? timeFormatter.format(date) : dayMonthFormatter.format(date);
}

/** "+91 98765 43210" from "919876543210". */
export function formatPhone(phone: string | null | undefined): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (!digits) return '—';
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  return `+${digits}`;
}

/** Mirrors config.normalisePhone() in the bot: one human = one key. */
export function normalisePhone(value: string | null | undefined, countryCode = '91'): string {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  digits = digits.replace(/^0+/, '');
  if (digits.length === 10) digits = `${countryCode}${digits}`;
  return digits;
}

export function initials(name: string | null | undefined, phone?: string | null): string {
  const source = (name ?? '').trim();
  if (source) {
    const parts = source.split(/\s+/).slice(0, 2);
    return parts
      .map((p) => p[0] ?? '')
      .join('')
      .toUpperCase();
  }
  const digits = String(phone ?? '').replace(/\D/g, '');
  return digits.slice(-2) || '?';
}

export function truncate(text: string | null | undefined, max = 60): string {
  const value = String(text ?? '');
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export { toDate };
