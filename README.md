# Psychologist website with appointment booking connected to Google Calendar.

- **Frontend:** [Astro 6](https://astro.build) (TypeScript). Pages are generated statically, making them fast and SEO-friendly.
- **Backend:** serverless functions within the same project (`src/pages/api/`). No server or database is required because the appointments live in Google Calendar.
- **Hosting:** Netlify (the free tier allows commercial use).

> **Status:** draft version (`draft: true` in `src/data/site.ts`).
> Confirmed: name, MSc Clinical Mental Health (AUTH), photo. The rest are placeholders.
> As long as `draft` is `true`, Google will not index the site.

---

## 1. Starting on your computer (Windows)

**Node.js Check:** open PowerShell and type:

```powershell
node -v   # requires v22.12.0 or newer
```

If it says "not recognized" or shows an older version, install [Node.js LTS](https://nodejs.org) (Windows Installer) and open a new terminal.

**Every time:**

```powershell
cd $HOME\Desktop\psychologos-site
npm install        # only the first time, or when package.json changes
npm run dev        # open http://localhost:4321
```

You can stop it with `Ctrl + C`. Changes to files appear immediately in the browser.

> If PowerShell says "running scripts is disabled", run this once:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, or use the Command Prompt (cmd).

Other commands:

| Command | What it does |
|---|---|
| `npm run build` | Builds the final version in the `dist/` folder |
| `npm run google:auth` | Connects the site to Google Calendar (one time, see §4) |

Without configuration, the booking runs in **demo mode**: it shows fake time slots and does not send anything.

### If you get "An Application Control policy has blocked this file"

This is Windows **Smart App Control**. It blocks recently released `.node` files that don't yet have a "reputation". Because of this:
- The project uses Astro 6, which does not have such a file in its compiler.
- `rollup` is locked to an older version (`overrides` in `package.json`).

If a file is blocked despite this:
1. Delete the `node_modules` folder and run `npm install` again.
2. If it continues, check which file the message mentions and lock an older version of the corresponding package in the `overrides`.
3. Last resort: Windows Security → App & browser control → Smart App Control → Turn off. Caution: in many Windows versions, this cannot be turned back on without a system reset.

---

## 2. Structure

```text
src/
  data/
    site.ts             ← info, services, prices, booking rules, FAQ, homepage texts
    topics.ts           ← the 6 topics (homepage cards + one page per topic)
  pages/
    index.astro         ← homepage
    [slug].astro        ← topic pages (/anxiety-panic-attacks/ etc.)
    politiki-aporritou.astro, oroi-synedrion.astro, 404.astro, robots.txt.ts
    api/
      availability.ts   ← GET: free time slots from Google Calendar
      book.ts           ← POST: writes the appointment and sends an invite to the client
  components/           ← one section = one file (Hero, PainPoints, Booking, …)
  layouts/BaseLayout.astro  ← <head>: SEO, Open Graph, schema.org, analytics
  lib/
    google.ts           ← client for Google Calendar API (fetch only)
    slots.ts            ← calculation of free time slots
    time.ts             ← Greek time regardless of server time
    schema.ts           ← structured data for Google
  scripts/              ← browser JavaScript (booking, animations)
  styles/               ← colors (tokens.css), base, booking
  assets/portrait.jpg   ← hero photo (Astro outputs it in WebP)
public/                 ← favicon, og.jpg (image for sharing 1200×630)
scripts/google-auth.mjs ← connection with Google (runs locally)
docs/odigos-imerologio.md ← guide for the psychologist: how to manage appointments
```

### Common changes

| I want to change… | Where |
|---|---|
| Name, phone, email, address, city, hours | `site.ts` → `practice` |
| Online sessions yes/no | `site.ts` → `practice.offersOnline` |
| Prices, session types | `site.ts` → `services`, `plans` |
| 24-hour notice, weeks ahead, gap between appointments | `site.ts` → `bookingRules` |
| Topic texts | `topics.ts` |
| Colors | `styles/tokens.css` |
| Photo | replace `src/assets/portrait.jpg` (vertical, approx. 4:5) and `public/og.jpg` |

---

## 3. How booking works

```text
Visitor ─► /api/availability ─► Google Calendar
                                • blocks in the "Availability" calendar
                                • minus whatever is booked (freeBusy)
                                • minus rules (24 hours, 4 weeks, 10' gap)
Visitor ─► /api/book ─► re-checks that the slot is free
                     ─► writes event to the "Site Appointments" calendar
                     ─► Google sends an invitation to the client's email
                        (for online: with a Google Meet link)
```

- If the psychologist deletes or moves the event, Google automatically notifies the client.
- Nothing is stored anywhere else. There is no database.
- Spam protection: hidden honeypot field for bots and server-side validation of all fields.
- Known limitation: if two people click on the exact same time slot at the same second, both might be booked. With a low volume of daily bookings, this is practically impossible, and it will be immediately visible in the calendar.

---

## 4. Google Calendar Connection

**Google Workspace is recommended** (approx. €7/month): it includes a Data Processing Agreement for GDPR compliance, provides an email on her domain, and allows an "Internal" connection without Google's verification review.

1. **Calendars:** in the psychologist's Google Calendar, create two new calendars: **Availability** (Διαθεσιμότητα) and **Site Appointments** (Ραντεβού site). In "Availability", add recurring events with the hours she accepts appointments, e.g., "Tuesday 17:00–21:00, weekly".
2. **Google Cloud:** at [console.cloud.google.com](https://console.cloud.google.com), create a project and enable the **Google Calendar API** (APIs & Services → Library).
3. **Consent Screen (Google Auth Platform):**
    - With Workspace: User type **Internal**.
    - With a standard Gmail: **External** and then **Publish app** (in "Testing" state, the connection expires every 7 days). Google will show an "unverified app" warning once. Click Advanced → Continue.
4. **Keys:** Credentials → Create credentials → OAuth client ID → type **Desktop app**. Copy `.env.example` to `.env` and fill in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. **Connection:** run `npm run google:auth`. The browser will open: log in with the psychologist's account. The script writes the `GOOGLE_REFRESH_TOKEN` to `.env` and displays the calendar IDs.
6. Fill in `GOOGLE_CALENDAR_AVAILABILITY_ID` and `GOOGLE_CALENDAR_BOOKINGS_ID`, and set `PUBLIC_BOOKING_MODE=live`.
7. Run `npm run dev` and make a test booking using your own email. Check that it appeared in the calendar and that the invitation arrived.

---

## 5. Deployment to the internet (Netlify)

1. **GitHub:** create a **private** repository and upload the folder. The `.env` file does not get uploaded; it is in `.gitignore`.
   ```powershell
   git init
   git add .
   git commit -m "First commit"
   git branch -M main
   git remote add origin [https://github.com/NAME/psychologos-site.git](https://github.com/NAME/psychologos-site.git)
   git push -u origin main
   ```
2. **Netlify:** [app.netlify.com](https://app.netlify.com) → Add new site → Import from Git → select the repo. Build settings are read from `netlify.toml`.
3. **Variables:** Site configuration → Environment variables. Add everything from your `.env` (`SITE_URL`, `PUBLIC_BOOKING_MODE`, all `GOOGLE_*`). Then go to Deploys → Trigger deploy.
4. **Domain:** buy a domain (e.g., `kogkolidou.gr`) from a Greek registrar. In Netlify: Domain management → Add domain, and follow the instructions for DNS. HTTPS is enabled automatically.
5. **Google Search Console:** add the domain, verify it (via DNS or `PUBLIC_GOOGLE_SITE_VERIFICATION`), and submit `https://YOUR-DOMAIN/sitemap-index.xml`.
6. **Google Business Profile:** register the office with a real address. This is a local listing, not an advertisement.
7. **Analytics (optional):** [Plausible](https://plausible.io), which is cookie-less, therefore requiring no cookie banner. Set `PUBLIC_PLAUSIBLE_DOMAIN`.

Every `git push` to `main` automatically deploys a new version.

---

## 6. Pre-launch checklist

- [ ] Real details in `site.ts`: city, address, phone, email, hours, prices, services
- [ ] Degree and license to practice verified (the title "Psychologist" is protected by Greek law 991/1979)
- [ ] Decision regarding online sessions (`offersOnline`): Article 11 of the Code of Ethics, confirm with the Association of Greek Psychologists (SEPS) or a lawyer
- [ ] Decision regarding couples therapy (only with relevant training)
- [ ] "About me" / "Who am I" text written by her
- [ ] Topic texts (`topics.ts`) approved by her
- [ ] Privacy policy and terms reviewed by a legal professional
- [ ] Professional photo (`portrait.jpg`, `og.jpg`)
- [ ] Google Workspace with Two-Step Verification enabled
- [ ] `PUBLIC_BOOKING_MODE=live` and an end-to-end test booking completed
- [ ] `SITE_URL` = the real domain
- [ ] `draft: false` in `site.ts`
- [ ] Search Console set up with a sitemap
- [ ] **No Google Ads or paid social media:** prohibited by Article 10 of the Code of Ethics (Government Gazette B' 2344/2019)