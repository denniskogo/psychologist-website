/**
 * Υπολογισμός ελεύθερων ωρών. Καθαρή συνάρτηση: δεν ξέρει τίποτα για Google.
 *
 *   ελεύθερες ώρες = (παράθυρα διαθεσιμότητας) − (πιασμένα διαστήματα ± κενό)
 *                    − (λιγότερο από X ώρες από τώρα) − (πέρα από Y μέρες)
 */
import { localParts } from './time';

export interface Interval {
  start: number;
  end: number;
}

export interface SlotRules {
  /** Διάρκεια συνεδρίας σε λεπτά */
  durationMin: number;
  /** Κενό πριν και μετά από κάθε άλλο ραντεβού, σε λεπτά */
  bufferMin: number;
  /** Κάθε πόσα λεπτά ξεκινά μια πιθανή ώρα μέσα σε ένα παράθυρο */
  stepMin: number;
  /** Ελάχιστος χρόνος από τώρα μέχρι το ραντεβού, σε λεπτά */
  minNoticeMin: number;
  /** Τελευταία στιγμή που επιτρέπεται να ξεκινά ραντεβού */
  horizonEnd: number;
  now: number;
  tz: string;
}

/** Ταξινομεί και ενώνει διαστήματα που επικαλύπτονται ή ακουμπούν. */
export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = list.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

/** Επιστρέφει { 'YYYY-MM-DD': ['HH:mm', ...] } σε ώρα Ελλάδας. */
export function computeSlots(windows: Interval[], busy: Interval[], r: SlotRules): Record<string, string[]> {
  const MIN = 60_000;
  const dur = r.durationMin * MIN;
  const buf = r.bufferMin * MIN;
  const step = r.stepMin * MIN;
  const earliest = r.now + r.minNoticeMin * MIN;
  const blocked = mergeIntervals(busy);
  const result: Record<string, string[]> = {};

  for (const w of mergeIntervals(windows)) {
    for (let t = w.start; t + dur <= w.end; t += step) {
      if (t < earliest || t > r.horizonEnd) continue;
      const clash = blocked.some((b) => t < b.end + buf && t + dur + buf > b.start);
      if (clash) continue;
      const p = localParts(t, r.tz);
      (result[p.date] ??= []).push(p.time);
    }
  }
  for (const k of Object.keys(result)) result[k] = [...new Set(result[k])].sort();
  return result;
}
