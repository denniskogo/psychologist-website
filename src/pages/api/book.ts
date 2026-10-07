/**
 * POST /api/book
 * Ελέγχει ξανά ότι η ώρα είναι ελεύθερη, γράφει το ραντεβού στο Google Calendar
 * και η Google στέλνει πρόσκληση στο email του πελάτη.
 * Αν η ψυχολόγος ακυρώσει ή μετακινήσει το event, η Google ενημερώνει αυτόματα τον πελάτη.
 */
import type { APIRoute } from 'astro';
import { PUBLIC_BOOKING_MODE } from 'astro:env/client';
import { createEvent, isConfigured } from '../../lib/google';
import { liveAvailability } from '../../lib/availability';
import { toRfc3339, zonedToUtc } from '../../lib/time';
import { practice, services } from '../../data/site';
import { json } from '../../lib/http';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request }) => {
  if (PUBLIC_BOOKING_MODE !== 'live' || !isConfigured()) return json({ error: 'not_configured' }, 503);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  // Παγίδα για bots: το πεδίο είναι κρυφό, ένας άνθρωπος δεν το συμπληρώνει.
  if (typeof body.website === 'string' && body.website.trim() !== '') return json({ ok: true });

  const str = (k: string, max: number) => (typeof body[k] === 'string' ? (body[k] as string).trim().slice(0, max) : '');
  const service = services.find((s) => s.id === body.service);
  const date = str('date', 10);
  const time = str('time', 5);
  const name = str('name', 100);
  const phone = str('phone', 30);
  const email = str('email', 254);
  const note = str('note', 1000);

  const errors: Record<string, string> = {};
  if (!service) errors.service = 'Διαλέξτε είδος συνεδρίας.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.days = 'Διαλέξτε ημέρα.';
  if (!/^\d{2}:\d{2}$/.test(time)) errors.slots = 'Διαλέξτε ώρα.';
  if (name.length < 3) errors['f-name'] = 'Γράψτε το ονοματεπώνυμό σας.';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) errors['f-phone'] = 'Το κινητό χρειάζεται 10 ψηφία.';
  if (!EMAIL_RE.test(email)) errors['f-email'] = 'Ελέγξτε τη διεύθυνση email.';
  if (body.consent !== true) errors['f-consent'] = 'Χρειάζεται η συγκατάθεσή σας για να κλείσει το ραντεβού.';
  if (Object.keys(errors).length || !service) return json({ error: 'validation', fields: errors }, 400);

  try {
    const avail = await liveAvailability();
    if (!avail[service.id]?.[date]?.includes(time)) return json({ error: 'slot_taken' }, 409);

    const tz = practice.timezone;
    const startMs = zonedToUtc(date, time, tz);
    const endMs = startMs + service.duration * 60_000;
    const isOnline = service.id === 'online';
    const location =
      service.id === 'intro' ? `Τηλεφωνικά: θα σας καλέσω στο ${phone}`
      : isOnline ? 'Google Meet (ο σύνδεσμος είναι στην πρόσκληση)'
      : practice.address;

    const description = [
      `Είδος: ${service.long} (${service.duration}′)`,
      `Τρόπος: ${service.mode}`,
      `Όνομα: ${name}`,
      `Κινητό: ${phone}`,
      `Email: ${email}`,
      note ? `Σημείωση: ${note}` : '',
      '',
      'Κράτηση από την ιστοσελίδα.',
      `Για ακύρωση ή αλλαγή, έως 24 ώρες πριν: ${practice.phone} ή απάντηση σε αυτό το email.`,
    ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');

    const created = await createEvent({
      summary: `${service.long} · ${name}`,
      description,
      location,
      start: toRfc3339(startMs, tz),
      end: toRfc3339(endMs, tz),
      timeZone: tz,
      attendee: { email, name },
      meet: isOnline,
      privateProps: { source: 'website', service: service.id },
    });

    return json({ ok: true, start: toRfc3339(startMs, tz), meet: Boolean(created.hangoutLink) });
  } catch (e) {
    console.error('[book]', e instanceof Error ? e.message : 'unknown error');
    return json({ error: 'upstream' }, 502);
  }
};
