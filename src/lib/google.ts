/**
 * Ελάχιστος client για Google Calendar API (μόνο fetch, χωρίς βαριές βιβλιοθήκες).
 * Τρέχει μόνο στον server (serverless function). Τα κλειδιά έρχονται από μεταβλητές περιβάλλοντος.
 */
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN,
  GOOGLE_CALENDAR_AVAILABILITY_ID,
  GOOGLE_CALENDAR_BOOKINGS_ID,
  GOOGLE_CALENDAR_BUSY_IDS,
} from 'astro:env/server';
import type { Interval } from './slots';

const API = 'https://www.googleapis.com/calendar/v3';

export class GoogleError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function isConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REFRESH_TOKEN && GOOGLE_CALENDAR_AVAILABILITY_ID);
}

export const calendars = {
  get availability() {
    return GOOGLE_CALENDAR_AVAILABILITY_ID ?? '';
  },
  get bookings() {
    return GOOGLE_CALENDAR_BOOKINGS_ID || 'primary';
  },
  /** Ημερολόγια που «πιάνουν» χρόνο: τα δικά της + το ημερολόγιο των κρατήσεων. */
  get busy() {
    const ids = (GOOGLE_CALENDAR_BUSY_IDS || 'primary').split(',').map((s) => s.trim()).filter(Boolean);
    return [...new Set([...ids, this.bookings])];
  },
};

let cached: { token: string; expires: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID ?? '',
      client_secret: GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: GOOGLE_REFRESH_TOKEN ?? '',
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new GoogleError(res.status, `token refresh failed (${res.status})`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

async function gfetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const res = await fetch(API + path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    // Δεν γράφουμε στα logs το σώμα της απάντησης: μπορεί να περιέχει προσωπικά δεδομένα.
    throw new GoogleError(res.status, `Google Calendar ${init.method ?? 'GET'} ${path.split('?')[0]} -> ${res.status}`);
  }
  return (await res.json()) as T;
}

interface GEvent {
  status?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

/** Τα blocks διαθεσιμότητας (events στο ημερολόγιο «Διαθεσιμότητα»). Ολοήμερα events αγνοούνται. */
export async function availabilityWindows(from: number, to: number): Promise<Interval[]> {
  const out: Interval[] = [];
  let pageToken: string | undefined;
  do {
    const q = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      timeMin: new Date(from).toISOString(),
      timeMax: new Date(to).toISOString(),
      maxResults: '2500',
    });
    if (pageToken) q.set('pageToken', pageToken);
    const data = await gfetch<{ items?: GEvent[]; nextPageToken?: string }>(
      `/calendars/${encodeURIComponent(calendars.availability)}/events?${q}`,
    );
    for (const e of data.items ?? []) {
      if (e.status === 'cancelled' || !e.start?.dateTime || !e.end?.dateTime) continue;
      out.push({ start: Date.parse(e.start.dateTime), end: Date.parse(e.end.dateTime) });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

/** Πιασμένα διαστήματα από όλα τα «busy» ημερολόγια. */
export async function busyIntervals(from: number, to: number): Promise<Interval[]> {
  const data = await gfetch<{ calendars: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }> }>(
    '/freeBusy',
    {
      method: 'POST',
      body: JSON.stringify({
        timeMin: new Date(from).toISOString(),
        timeMax: new Date(to).toISOString(),
        items: calendars.busy.map((id) => ({ id })),
      }),
    },
  );
  const out: Interval[] = [];
  for (const [id, cal] of Object.entries(data.calendars ?? {})) {
    if (cal.errors?.length) throw new GoogleError(502, `freeBusy error for calendar ${id === 'primary' ? 'primary' : '(configured)'}`);
    for (const b of cal.busy ?? []) out.push({ start: Date.parse(b.start), end: Date.parse(b.end) });
  }
  return out;
}

export interface NewEvent {
  summary: string;
  description: string;
  location?: string;
  start: string;
  end: string;
  timeZone: string;
  attendee: { email: string; name: string };
  meet?: boolean;
  privateProps?: Record<string, string>;
}

/** Γράφει το ραντεβού στο ημερολόγιο και στέλνει πρόσκληση στον πελάτη (sendUpdates=all). */
export async function createEvent(e: NewEvent): Promise<{ id: string; htmlLink?: string; hangoutLink?: string }> {
  const q = new URLSearchParams({ sendUpdates: 'all' });
  if (e.meet) q.set('conferenceDataVersion', '1');
  return gfetch(`/calendars/${encodeURIComponent(calendars.bookings)}/events?${q}`, {
    method: 'POST',
    body: JSON.stringify({
      summary: e.summary,
      description: e.description,
      location: e.location,
      start: { dateTime: e.start, timeZone: e.timeZone },
      end: { dateTime: e.end, timeZone: e.timeZone },
      attendees: [{ email: e.attendee.email, displayName: e.attendee.name }],
      reminders: { useDefault: true },
      guestsCanModify: false,
      guestsCanInviteOthers: false,
      guestsCanSeeOtherGuests: false,
      extendedProperties: e.privateProps ? { private: e.privateProps } : undefined,
      conferenceData: e.meet
        ? { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } }
        : undefined,
    }),
  });
}
