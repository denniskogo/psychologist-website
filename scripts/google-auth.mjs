#!/usr/bin/env node
/**
 * Σύνδεση του site με το Google Calendar της ψυχολόγου (τρέχει ΜΙΑ φορά, τοπικά).
 *
 *   npm run google:auth
 *
 * 1. Διαβάζει GOOGLE_CLIENT_ID και GOOGLE_CLIENT_SECRET από το .env
 * 2. Ανοίγει τον browser για «Σύνδεση με Google» (με τον λογαριασμό της ψυχολόγου)
 * 3. Γράφει το GOOGLE_REFRESH_TOKEN στο .env
 * 4. Δείχνει τα ημερολόγιά της με τα ID τους, για να συμπληρωθούν τα GOOGLE_CALENDAR_*
 *
 * Μόνο built-in modules του Node, χωρίς εξαρτήσεις.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';

const ENV_PATH = path.resolve(process.cwd(), '.env');
const PORT = 53682;
const REDIRECT = `http://127.0.0.1:${PORT}/`;
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];

function readEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  return Object.fromEntries(
    fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)
      .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]),
  );
}

function writeEnv(key, value) {
  let text = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  text = re.test(text) ? text.replace(re, line) : `${text}${text && !text.endsWith('\n') ? '\n' : ''}${line}\n`;
  fs.writeFileSync(ENV_PATH, text);
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

const env = readEnv();
const clientId = env.GOOGLE_CLIENT_ID;
const clientSecret = env.GOOGLE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('\nΛείπουν τα GOOGLE_CLIENT_ID και GOOGLE_CLIENT_SECRET από το αρχείο .env.');
  console.error('Δείτε το README, ενότητα «Σύνδεση με Google Calendar», βήματα 1–4.\n');
  process.exit(1);
}

const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: clientId,
  redirect_uri: REDIRECT,
  response_type: 'code',
  scope: SCOPES.join(' '),
  access_type: 'offline',
  prompt: 'consent',
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', REDIRECT);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  if (!code && !error) { res.writeHead(404).end(); return; }

  const page = (msg) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta charset="utf-8"><body style="font:18px system-ui;padding:3rem;max-width:40rem">${msg}</body>`);
  };

  if (error) {
    page(`<h1>Η σύνδεση ακυρώθηκε</h1><p>${error}</p>`);
    console.error('\nΗ σύνδεση ακυρώθηκε:', error);
    server.close();
    process.exitCode = 1;
    return;
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: REDIRECT, grant_type: 'authorization_code' }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.refresh_token) throw new Error(tokens.error_description || tokens.error || 'Δεν επιστράφηκε refresh token');

    writeEnv('GOOGLE_REFRESH_TOKEN', tokens.refresh_token);

    const listRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const list = await listRes.json();

    page('<h1>Έτοιμο ✓</h1><p>Το site συνδέθηκε με το Google Calendar. Μπορείτε να κλείσετε αυτό το παράθυρο και να γυρίσετε στο τερματικό.</p>');

    console.log('\n✓ Το GOOGLE_REFRESH_TOKEN γράφτηκε στο .env\n');
    console.log('Ημερολόγια του λογαριασμού (αντιγράψτε τα ID στο .env):\n');
    for (const c of list.items ?? []) {
      console.log(`  ${c.primary ? '★' : ' '} ${c.summary}`);
      console.log(`      ID: ${c.primary ? 'primary' : c.id}\n`);
    }
    console.log('  GOOGLE_CALENDAR_AVAILABILITY_ID = το ID του ημερολογίου «Διαθεσιμότητα»');
    console.log('  GOOGLE_CALENDAR_BOOKINGS_ID     = το ID του ημερολογίου «Ραντεβού site»');
    console.log('  GOOGLE_CALENDAR_BUSY_IDS        = primary (και όποιο άλλο ημερολόγιο «πιάνει» χρόνο, χωρισμένα με κόμμα)\n');
  } catch (e) {
    page(`<h1>Κάτι πήγε στραβά</h1><p>${e instanceof Error ? e.message : e}</p>`);
    console.error('\nΣφάλμα:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('\nΆνοιξε ο browser για σύνδεση με Google.');
  console.log('Συνδεθείτε με τον λογαριασμό της ψυχολόγου και πατήστε «Συνέχεια» / «Allow».');
  console.log(`\nΑν δεν άνοιξε, αντιγράψτε αυτόν τον σύνδεσμο στον browser:\n${authUrl}\n`);
  openBrowser(authUrl);
});
