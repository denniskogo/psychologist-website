/** Συνδέει Google Calendar με τον υπολογισμό ωρών. Μόνο server. */
import { availabilityWindows, busyIntervals } from './google';
import { computeSlots } from './slots';
import { bookingRules, practice, services, type ServiceId } from '../data/site';

export async function liveAvailability(now = Date.now()) {
  const horizonEnd = now + bookingRules.maxDaysAhead * 86_400_000;
  const [windows, busy] = await Promise.all([
    availabilityWindows(now, horizonEnd + 86_400_000),
    busyIntervals(now, horizonEnd + 86_400_000),
  ]);
  const result = {} as Record<ServiceId, Record<string, string[]>>;
  for (const s of services) {
    result[s.id] = computeSlots(windows, busy, {
      durationMin: s.duration,
      bufferMin: bookingRules.bufferMinutes,
      stepMin: s.duration <= 20 ? 15 : bookingRules.slotStepMinutes,
      minNoticeMin: bookingRules.minNoticeHours * 60,
      horizonEnd,
      now,
      tz: practice.timezone,
    });
  }
  return result;
}
