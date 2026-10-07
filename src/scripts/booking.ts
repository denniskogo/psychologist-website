/**
 * Κράτηση ραντεβού (client-side).
 *
 * Δύο λειτουργίες, ορίζονται με τη μεταβλητή PUBLIC_BOOKING_MODE:
 * - demo: οι ώρες παράγονται τοπικά, τίποτα δεν αποστέλλεται.
 * - live: οι ώρες έρχονται από /api/availability (Google Calendar) και η κράτηση γίνεται με POST /api/book.
 */
import { PUBLIC_BOOKING_MODE } from 'astro:env/client';
import { bookingRules, practice, services, type Service, type ServiceId } from '../data/site';
import { addDaysToDate, localParts } from '../lib/time';

type Avail = Record<ServiceId, Record<string, string[]>>;

const LIVE = PUBLIC_BOOKING_MODE === 'live';
const TZ = practice.timezone;

const WD_SHORT = ['ΚΥΡ', 'ΔΕΥ', 'ΤΡΙ', 'ΤΕΤ', 'ΠΕΜ', 'ΠΑΡ', 'ΣΑΒ'];
const WD_LONG = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];
const MON_GEN = ['Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου', 'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου'];
const MON_NOM = ['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'];
const MON_SHORT = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];

const pad = (n: number) => String(n).padStart(2, '0');
const parseKey = (k: string) => { const [y, m, d] = k.split('-').map(Number); return { y, m, d, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay() }; };
const fmtDate = (k: string) => { const p = parseKey(k); return `${WD_LONG[p.wd]} ${p.d} ${MON_GEN[p.m - 1]}`; };
const addMin = (t: string, min: number) => {
  const [h, m] = t.split(':').map(Number);
  const tot = h * 60 + m + min;
  return `${pad(Math.floor(tot / 60))}:${pad(tot % 60)}`;
};
const hash = (s: string) => {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
  return x >>> 0;
};

/** Ψεύτικη αλλά σταθερή διαθεσιμότητα για τη λειτουργία επίδειξης. */
function demoAvailability(today: string): Avail {
  const out = {} as Avail;
  for (const s of services) {
    out[s.id] = {};
    for (let i = 1; i <= bookingRules.maxDaysAhead; i++) {
      const k = addDaysToDate(today, i);
      const wd = parseKey(k).wd;
      if (wd === 0 || wd === 6 || hash(k) % 7 === 3) continue;
      const free = s.slots.filter((t) => hash(`${k}|${t}`) % 100 >= 38);
      if (free.length) out[s.id][k] = free;
    }
  }
  return out;
}

export function initBooking() {
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const form = $<HTMLFormElement>('booking');
  const daysEl = $('days');
  const daysHead = $('days-head');
  const dayStep = $('day-step');
  const slotsEl = $('slots');
  const confirmEl = $('confirm');
  const submitBtn = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!form || !daysEl || !daysHead || !dayStep || !slotsEl || !confirmEl || !submitBtn) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const byId = Object.fromEntries(services.map((s) => [s.id, s])) as Record<ServiceId, Service>;
  const today = localParts(Date.now(), TZ).date;

  let avail: Avail | null = null;
  let loadError = false;
  const state: { service: ServiceId; date: string | null; time: string | null } = { service: 'intro', date: null, time: null };

  const slotsFor = (svc: ServiceId, date: string) => avail?.[svc]?.[date] ?? [];

  // Ημέρες ημερολογίου: από τη Δευτέρα της εβδομάδας του «αύριο», μέχρι το όριο κράτησης.
  function calendarDays(): string[] {
    const first = addDaysToDate(today, 1);
    const wd = parseKey(first).wd;
    const start = addDaysToDate(first, -((wd + 6) % 7));
    const end = addDaysToDate(today, bookingRules.maxDaysAhead);
    const days: string[] = [];
    for (let k = start; k <= end; k = addDaysToDate(k, 1)) days.push(k);
    // Συμπληρώνουμε μέχρι το τέλος της εβδομάδας για ίσιο πλέγμα.
    while (parseKey(days[days.length - 1]).wd !== 0) days.push(addDaysToDate(days[days.length - 1], 1));
    return days;
  }
  const allDays = calendarDays();

  // Δευτέρα–Παρασκευή πάντα. Σάββατο/Κυριακή μόνο αν υπάρχουν ελεύθερες ώρες εκείνες τις μέρες.
  function shownWeekdays(): number[] {
    const set = new Set([1, 2, 3, 4, 5]);
    if (avail) for (const s of services) for (const k of Object.keys(avail[s.id] ?? {})) set.add(parseKey(k).wd);
    return [1, 2, 3, 4, 5, 6, 0].filter((d) => set.has(d));
  }

  const firstAvailable = (svc: ServiceId) => allDays.find((k) => k > today && slotsFor(svc, k).length > 0) ?? null;

  function renderHead(cols: number[]) {
    dayStep!.style.setProperty('--cols', String(cols.length));
    daysHead!.innerHTML = cols.map((d) => `<span>${WD_SHORT[d]}</span>`).join('');
    const vis = allDays.filter((k) => cols.includes(parseKey(k).wd));
    const a = parseKey(vis[0]);
    const b = parseKey(vis[vis.length - 1]);
    const range = $('cal-range');
    if (range) range.textContent = a.m === b.m ? `${MON_NOM[a.m - 1]} ${a.y}` : `${MON_NOM[a.m - 1]} – ${MON_NOM[b.m - 1]} ${b.y}`;
    const legend = $('cal-legend');
    if (legend) legend.textContent = cols.length > 5 ? 'Επιλέξτε ημέρα' : 'Δευτέρα έως Παρασκευή';
  }

  function renderDays() {
    if (!avail) {
      daysEl!.innerHTML = loadError
        ? `<p class="bk-slots-empty bk-wide">Δεν φορτώθηκαν οι ελεύθερες ώρες. Δοκιμάστε ξανά σε λίγο ή καλέστε στο <strong>${practice.phone}</strong>.</p>`
        : '<p class="bk-slots-empty bk-wide bk-loading">Φόρτωση ελεύθερων ωρών…</p>';
      return;
    }
    const cols = shownWeekdays();
    renderHead(cols);
    daysEl!.innerHTML = '';
    let prevMonth = -1;
    const lastDay = addDaysToDate(today, bookingRules.maxDaysAhead);
    for (const k of allDays) {
      const p = parseKey(k);
      if (!cols.includes(p.wd)) continue;
      const past = k <= today || k > lastDay;
      const n = past ? 0 : slotsFor(state.service, k).length;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bk-day' + (past ? ' past' : '');
      b.dataset.date = k;
      const showMonth = p.m !== prevMonth;
      prevMonth = p.m;
      const hint = past ? '' : n === 0 ? 'πλήρες' : n === 1 ? '1 ώρα' : `${n} ώρες`;
      b.innerHTML =
        `<span class="bk-day-m">${showMonth ? MON_SHORT[p.m - 1] : '&nbsp;'}</span>` +
        `<span class="bk-day-n">${p.d}</span>` +
        `<span class="bk-day-h">${hint || '&nbsp;'}</span>`;
      b.disabled = past || n === 0;
      b.setAttribute('aria-pressed', String(state.date === k));
      b.setAttribute('aria-label', fmtDate(k) + (past ? ', μη διαθέσιμη' : n === 0 ? ', πλήρης' : `, ${n} ${n === 1 ? 'ελεύθερη ώρα' : 'ελεύθερες ώρες'}`));
      daysEl!.appendChild(b);
    }
  }

  function renderSlots() {
    slotsEl!.innerHTML = '';
    if (!state.date) {
      const msg = avail && !firstAvailable(state.service)
        ? `Δεν υπάρχουν ελεύθερες ώρες τις επόμενες εβδομάδες. Καλέστε στο <strong>${practice.phone}</strong>.`
        : 'Διαλέξτε πρώτα ημέρα για να δείτε τις ελεύθερες ώρες.';
      slotsEl!.innerHTML = `<p class="bk-slots-empty">${msg}</p>`;
      return;
    }
    const list = slotsFor(state.service, state.date);
    const groups: [string, (t: string) => boolean][] = [
      ['ΠΡΩΙ', (t) => parseInt(t, 10) < 14],
      ['ΑΠΟΓΕΥΜΑ', (t) => parseInt(t, 10) >= 14],
    ];
    let idx = 0;
    for (const [label, test] of groups) {
      const part = list.filter(test);
      if (!part.length) continue;
      const g = document.createElement('div');
      g.className = 'bk-slot-group';
      const l = document.createElement('p');
      l.className = 'bk-slot-label';
      l.textContent = label;
      const row = document.createElement('div');
      row.className = 'bk-slot-row';
      for (const t of part) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bk-slot';
        b.dataset.time = t;
        b.textContent = t;
        b.style.setProperty('--i', String(idx++));
        b.setAttribute('aria-pressed', String(state.time === t));
        row.appendChild(b);
      }
      g.append(l, row);
      slotsEl!.appendChild(g);
    }
  }

  function setSum(id: string, val: string | null) {
    const el = $(id);
    if (!el) return;
    const next = val ?? '—';
    if (el.textContent !== next && el.textContent !== '') {
      el.classList.remove('flash');
      void el.offsetWidth;
      el.classList.add('flash');
    }
    el.textContent = next;
    el.classList.toggle('empty', val == null);
  }

  function renderSummary() {
    const svc = byId[state.service];
    setSum('sum-svc', svc.long);
    setSum('sum-date', state.date ? fmtDate(state.date) : null);
    setSum('sum-time', state.time ? `${state.time}–${addMin(state.time, svc.duration)}` : null);
    setSum('sum-mode', svc.mode);
    setSum('sum-price', svc.priceLabel);
  }

  const renderAll = () => { renderDays(); renderSlots(); renderSummary(); };

  function hideErr(key: string) {
    const p = $('err-' + key);
    if (p) p.hidden = true;
    p?.closest('.bk-field')?.classList.remove('invalid');
  }

  function showErrors(errs: [string, string][]) {
    for (const [k, msg] of errs) {
      const p = $('err-' + k);
      if (!p) continue;
      p.textContent = msg;
      p.hidden = false;
      p.closest('.bk-field')?.classList.add('invalid');
    }
    const fe = $('form-error')!;
    fe.textContent = errs.length === 1 ? 'Λείπει ένα στοιχείο. Δείτε το σημειωμένο πεδίο.' : `Λείπουν ${errs.length} στοιχεία. Δείτε τα σημειωμένα πεδία.`;
    fe.hidden = false;
    const k = errs[0]?.[0];
    const target = k === 'days'
      ? daysEl!.querySelector<HTMLElement>('.bk-day:not(:disabled)')
      : k === 'slots'
        ? (slotsEl!.querySelector<HTMLElement>('.bk-slot') ?? daysEl!.querySelector<HTMLElement>('[aria-pressed="true"]'))
        : k ? $(k) : null;
    target?.focus();
  }

  function selectService(id: ServiceId) {
    state.service = id;
    const radio = form!.querySelector<HTMLInputElement>(`input[name="service"][value="${id}"]`);
    if (radio) radio.checked = true;
    if (state.date && slotsFor(id, state.date).length === 0) state.date = null;
    if (!state.date) state.date = firstAvailable(id);
    if (state.time && (!state.date || !slotsFor(id, state.date).includes(state.time))) state.time = null;
    renderAll();
  }

  async function loadAvailability() {
    if (!LIVE) {
      avail = demoAvailability(today);
      return;
    }
    try {
      const res = await fetch('/api/availability', { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      avail = data.services as Avail;
      loadError = false;
    } catch {
      avail = null;
      loadError = true;
    }
  }

  form.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'service') selectService(t.value as ServiceId);
    if (t.id === 'f-consent') hideErr('f-consent');
  });

  // Κουμπιά αλλού στη σελίδα (hero, τιμές, μπάρα κινητού) που προεπιλέγουν συνεδρία.
  document.querySelectorAll<HTMLElement>('[data-pick]').forEach((a) => {
    a.addEventListener('click', () => {
      const id = a.dataset.pick as ServiceId;
      if (byId[id] && avail) selectService(id);
      else if (byId[id]) state.service = id;
    });
  });

  daysEl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.bk-day');
    if (!b || b.disabled) return;
    state.date = b.dataset.date ?? null;
    state.time = null;
    hideErr('days');
    renderAll();
    daysEl.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
  });

  slotsEl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.bk-slot');
    if (!b) return;
    state.time = b.dataset.time ?? null;
    hideErr('slots');
    slotsEl.querySelectorAll<HTMLButtonElement>('.bk-slot').forEach((s) => s.setAttribute('aria-pressed', String(s.dataset.time === state.time)));
    renderSummary();
  });

  form.addEventListener('input', (e) => {
    const id = (e.target as HTMLElement).id;
    if (id) hideErr(id);
  });

  function gcalUrl() {
    const svc = byId[state.service];
    const d = state.date!.replace(/-/g, '');
    const s = `${d}T${state.time!.replace(':', '')}00`;
    const en = `${d}T${addMin(state.time!, svc.duration).replace(':', '')}00`;
    const loc = state.service === 'online' ? 'Online' : state.service === 'intro' ? 'Τηλεφωνικά' : practice.address;
    const p = new URLSearchParams({
      action: 'TEMPLATE',
      text: `${svc.long} · ${practice.name}`,
      dates: `${s}/${en}`,
      ctz: TZ,
      details: 'Ακύρωση ή αλλαγή έως 24 ώρες πριν, χωρίς χρέωση.',
      location: loc,
    });
    return `https://calendar.google.com/calendar/render?${p.toString()}`;
  }

  function showConfirmation(phone: string, email: string) {
    const svc = byId[state.service];
    const when = `${fmtDate(state.date!)}, στις ${state.time}`;
    let title: string;
    let text: string;
    if (state.service === 'intro') {
      title = `Θα σας τηλεφωνήσω την ${when}.`;
      text = `Η κλήση κρατά περίπου 15 λεπτά. Θα καλέσω στο ${phone}.`;
    } else if (state.service === 'online') {
      title = `Τα λέμε online την ${when}.`;
      text = LIVE
        ? `Ο σύνδεσμος Google Meet είναι μέσα στην πρόσκληση που στάλθηκε στο ${email}. Διάρκεια ${svc.duration} λεπτά.`
        : `Ο σύνδεσμος της βιντεοκλήσης στέλνεται στο ${email}. Διάρκεια ${svc.duration} λεπτά.`;
    } else {
      title = `Σας περιμένω την ${when}.`;
      text = `Διεύθυνση: ${practice.address}. Διάρκεια ${svc.duration} λεπτά.`;
    }
    if (LIVE) text += ` Σας έστειλα πρόσκληση στο ${email}. Αν δεν τη βλέπετε, κοιτάξτε και στα ανεπιθύμητα.`;
    $('confirm-title')!.textContent = title;
    $('confirm-text')!.textContent = text;
    const gcal = $<HTMLAnchorElement>('gcal');
    if (gcal) {
      gcal.hidden = LIVE;
      gcal.href = gcalUrl();
    }
    form!.hidden = true;
    confirmEl!.hidden = false;
    confirmEl!.focus();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    form.querySelectorAll<HTMLElement>('.bk-err').forEach((p) => { p.hidden = true; });
    form.querySelectorAll('.bk-field.invalid').forEach((f) => f.classList.remove('invalid'));
    const formError = $('form-error')!;
    formError.hidden = true;

    const val = (id: string) => ($<HTMLInputElement>(id)?.value ?? '').trim();
    const name = val('f-name');
    const phone = val('f-phone');
    const email = val('f-email');
    const note = val('f-note');
    const website = val('f-website');
    const consent = $<HTMLInputElement>('f-consent')?.checked ?? false;

    const errs: [string, string][] = [];
    if (!state.date) errs.push(['days', 'Διαλέξτε ημέρα.']);
    if (!state.time) errs.push(['slots', 'Διαλέξτε ώρα.']);
    if (name.length < 3) errs.push(['f-name', 'Γράψτε το ονοματεπώνυμό σας.']);
    if (phone.replace(/\D/g, '').length < 10) errs.push(['f-phone', 'Το κινητό χρειάζεται 10 ψηφία.']);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.push(['f-email', 'Ελέγξτε τη διεύθυνση email.']);
    if (!consent) errs.push(['f-consent', 'Χρειάζεται η συγκατάθεσή σας για να κλείσει το ραντεβού.']);
    if (errs.length) { showErrors(errs); return; }

    if (!LIVE) { showConfirmation(phone, email); return; }

    const label = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Αποστολή…';
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ service: state.service, date: state.date, time: state.time, name, phone, email, note, consent, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        (window as unknown as { plausible?: (e: string, o?: object) => void }).plausible?.('Booking', { props: { service: state.service } });
        showConfirmation(phone, email);
      } else if (res.status === 409) {
        formError.textContent = 'Αυτή η ώρα μόλις κλείστηκε. Διαλέξτε μια άλλη.';
        formError.hidden = false;
        state.time = null;
        await loadAvailability();
        selectService(state.service);
      } else if (res.status === 400 && data.fields) {
        showErrors(Object.entries(data.fields) as [string, string][]);
      } else {
        formError.textContent = `Η κράτηση δεν ολοκληρώθηκε. Δοκιμάστε ξανά ή καλέστε στο ${practice.phone}.`;
        formError.hidden = false;
      }
    } catch {
      formError.textContent = `Δεν υπάρχει σύνδεση. Δοκιμάστε ξανά ή καλέστε στο ${practice.phone}.`;
      formError.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = label;
    }
  });

  $('again')?.addEventListener('click', async () => {
    const prev = state.service;
    form.reset();
    state.date = null;
    state.time = null;
    if (LIVE) await loadAvailability();
    selectService(prev);
    confirmEl.hidden = true;
    form.hidden = false;
    $('rantevou')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  });

  renderAll();
  loadAvailability().then(() => selectService(state.service));
}
