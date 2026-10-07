/**
 * Ώρες σε ζώνη ώρας Ελλάδας, ανεξάρτητα από τη ζώνη του server (που συνήθως είναι UTC).
 * Χωρίς εξωτερικές βιβλιοθήκες: μόνο Intl. Δουλεύει σε Node, browser και serverless.
 */

const pad = (n: number) => String(n).padStart(2, '0');

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface LocalParts {
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm */
  time: string;
  /** 0 = Κυριακή … 6 = Σάββατο */
  weekday: number;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Τα «τοπικά» στοιχεία μιας χρονικής στιγμής στη ζώνη `tz`. */
export function localParts(ms: number, tz: string): LocalParts {
  const parts = Object.fromEntries(formatter(tz).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  const second = Number(parts.second);
  return {
    date: `${year}-${pad(month)}-${pad(day)}`,
    time: `${pad(hour)}:${pad(minute)}`,
    weekday: WEEKDAYS[parts.weekday] ?? 0,
    year, month, day, hour, minute, second,
  };
}

/** Διαφορά της ζώνης `tz` από UTC τη στιγμή `ms`, σε ms (π.χ. +3 ώρες το καλοκαίρι στην Ελλάδα). */
export function tzOffset(ms: number, tz: string): number {
  const p = localParts(ms, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Μετατρέπει «ημερομηνία + ώρα στην Ελλάδα» σε χρονική στιγμή (ms από epoch). */
export function zonedToUtc(date: string, time: string, tz: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = tzOffset(guess, tz);
  let result = guess - off1;
  const off2 = tzOffset(result, tz);
  if (off2 !== off1) result = guess - off2;
  return result;
}

/** RFC 3339 με τη σωστή μετατόπιση της ζώνης, π.χ. 2026-10-09T10:00:00+03:00 */
export function toRfc3339(ms: number, tz: string): string {
  const p = localParts(ms, tz);
  const off = Math.round(tzOffset(ms, tz) / 60000);
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  return `${p.date}T${p.time}:${pad(p.second)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export function addDaysToDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
