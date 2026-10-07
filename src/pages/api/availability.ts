/**
 * GET /api/availability
 * Επιστρέφει τις ελεύθερες ώρες για κάθε είδος συνεδρίας, για τις επόμενες εβδομάδες.
 * Πηγή: Google Calendar (blocks «Διαθεσιμότητα» μείον τα πιασμένα διαστήματα).
 */
import type { APIRoute } from 'astro';
import { PUBLIC_BOOKING_MODE } from 'astro:env/client';
import { isConfigured } from '../../lib/google';
import { liveAvailability } from '../../lib/availability';
import { bookingRules, practice } from '../../data/site';
import { json } from '../../lib/http';

export const prerender = false;

export const GET: APIRoute = async () => {
  if (PUBLIC_BOOKING_MODE !== 'live' || !isConfigured()) return json({ error: 'not_configured' }, 503);
  try {
    const services = await liveAvailability();
    return json({ timezone: practice.timezone, maxDaysAhead: bookingRules.maxDaysAhead, services });
  } catch (e) {
    console.error('[availability]', e instanceof Error ? e.message : 'unknown error');
    return json({ error: 'upstream' }, 502);
  }
};
