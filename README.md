# Site ψυχολόγου: Γεωργία Κογκολίδου

Ιστοσελίδα ψυχολόγου με κράτηση ραντεβού συνδεδεμένη με το Google Calendar.

- **Frontend:** [Astro 6](https://astro.build) (TypeScript). Οι σελίδες βγαίνουν στατικές, γρήγορες και φιλικές για SEO.
- **Backend:** serverless functions στο ίδιο project (`src/pages/api/`). Δεν χρειάζεται server ούτε βάση δεδομένων, γιατί τα ραντεβού ζουν στο Google Calendar.
- **Hosting:** Netlify (το δωρεάν πλάνο επιτρέπει εμπορική χρήση).

> **Κατάσταση:** πρόχειρη έκδοση (`draft: true` στο `src/data/site.ts`).
> Επιβεβαιωμένα: όνομα, MSc Κλινική Ψυχική Υγεία (ΑΠΘ), φωτογραφία. Τα υπόλοιπα είναι ενδεικτικά.
> Όσο το `draft` είναι `true`, η Google δεν καταχωρίζει το site.

---

## 1. Εκκίνηση στον υπολογιστή σας (Windows)

**Έλεγχος Node.js:** ανοίξτε PowerShell και γράψτε:

```powershell
node -v   # χρειάζεται v22.12.0 ή νεότερο
```

Αν βγει «not recognized» ή μικρότερη έκδοση, εγκαταστήστε το [Node.js LTS](https://nodejs.org) (Windows Installer) και ανοίξτε νέο τερματικό.

**Κάθε φορά:**

```powershell
cd $HOME\Desktop\psychologos-site
npm install        # μόνο την πρώτη φορά, ή όταν αλλάξει το package.json
npm run dev        # ανοίξτε http://localhost:4321
```

Σταματάτε με `Ctrl + C`. Οι αλλαγές στα αρχεία φαίνονται αμέσως στον browser.

> Αν το PowerShell βγάλει «running scripts is disabled», τρέξτε μία φορά:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, ή χρησιμοποιήστε τη Γραμμή εντολών (cmd).

Άλλες εντολές:

| Εντολή | Τι κάνει |
|---|---|
| `npm run build` | Φτιάχνει την τελική έκδοση στον φάκελο `dist/` |
| `npm run google:auth` | Συνδέει το site με το Google Calendar (μία φορά, δείτε §4) |

Χωρίς ρυθμίσεις, η κράτηση τρέχει σε **λειτουργία επίδειξης**: δείχνει ψεύτικες ώρες και δεν στέλνει τίποτα.

### Αν βγει «An Application Control policy has blocked this file»

Είναι το **Smart App Control** των Windows. Μπλοκάρει αρχεία `.node` που κυκλοφορούν πρόσφατα και δεν έχουν ακόμα «φήμη». Γι' αυτό:
- Το project χρησιμοποιεί Astro 6, που δεν έχει τέτοιο αρχείο στον compiler.
- Το `rollup` είναι κλειδωμένο σε παλαιότερη έκδοση (`overrides` στο `package.json`).

Αν παρ' όλα αυτά μπλοκαριστεί κάποιο αρχείο:
1. Σβήστε τον φάκελο `node_modules` και ξανατρέξτε `npm install`.
2. Αν συνεχίζει, δείτε ποιο αρχείο αναφέρει το μήνυμα και κλειδώστε παλαιότερη έκδοση του αντίστοιχου πακέτου στα `overrides`.
3. Τελευταία λύση: Ασφάλεια των Windows → Έλεγχος εφαρμογών και προγράμματος περιήγησης → Smart App Control → Απενεργοποίηση. Προσοχή: σε πολλές εκδόσεις των Windows δεν ενεργοποιείται ξανά χωρίς επαναφορά του συστήματος.

---

## 2. Δομή

```
src/
  data/
    site.ts             ← στοιχεία, υπηρεσίες, τιμές, κανόνες κράτησης, FAQ, κείμενα αρχικής
    topics.ts           ← τα 6 θέματα (κάρτες αρχικής + μία σελίδα ανά θέμα)
  pages/
    index.astro         ← αρχική
    [slug].astro        ← σελίδες θεμάτων (/agxos-krises-panikou/ κ.λπ.)
    politiki-aporritou.astro, oroi-synedrion.astro, 404.astro, robots.txt.ts
    api/
      availability.ts   ← GET: ελεύθερες ώρες από το Google Calendar
      book.ts           ← POST: γράφει το ραντεβού και στέλνει πρόσκληση στον πελάτη
  components/           ← μία ενότητα = ένα αρχείο (Hero, PainPoints, Booking, …)
  layouts/BaseLayout.astro  ← <head>: SEO, Open Graph, schema.org, analytics
  lib/
    google.ts           ← client για Google Calendar API (μόνο fetch)
    slots.ts            ← υπολογισμός ελεύθερων ωρών
    time.ts             ← ώρα Ελλάδας ανεξάρτητα από τον server
    schema.ts           ← δομημένα δεδομένα για τη Google
  scripts/              ← JavaScript του browser (κράτηση, animations)
  styles/               ← χρώματα (tokens.css), βάση, κράτηση
  assets/portrait.jpg   ← φωτογραφία hero (το Astro τη βγάζει σε WebP)
public/                 ← favicon, og.jpg (εικόνα για κοινοποίηση 1200×630)
scripts/google-auth.mjs ← σύνδεση με Google (τρέχει τοπικά)
docs/odigos-imerologio.md ← οδηγός για την ψυχολόγο: πώς διαχειρίζεται τα ραντεβού
```

### Συνηθισμένες αλλαγές

| Θέλω να αλλάξω… | Πού |
|---|---|
| Όνομα, τηλέφωνο, email, διεύθυνση, πόλη, ώρες | `site.ts` → `practice` |
| Online συνεδρίες ναι/όχι | `site.ts` → `practice.offersOnline` |
| Τιμές, είδη συνεδριών | `site.ts` → `services`, `plans` |
| 24ωρη προειδοποίηση, εβδομάδες μπροστά, κενό μεταξύ ραντεβού | `site.ts` → `bookingRules` |
| Κείμενα θεμάτων | `topics.ts` |
| Χρώματα | `styles/tokens.css` |
| Φωτογραφία | αντικαταστήστε το `src/assets/portrait.jpg` (κάθετη, περίπου 4:5) και το `public/og.jpg` |

---

## 3. Πώς δουλεύει η κράτηση

```
Επισκέπτης ─► /api/availability ─► Google Calendar
                                   • blocks στο ημερολόγιο «Διαθεσιμότητα»
                                   • μείον ό,τι είναι πιασμένο (freeBusy)
                                   • μείον κανόνες (24 ώρες, 4 εβδομάδες, κενό 10′)
Επισκέπτης ─► /api/book ─► ξαναελέγχει ότι η ώρα είναι ελεύθερη
                        ─► γράφει event στο ημερολόγιο «Ραντεβού site»
                        ─► η Google στέλνει πρόσκληση στο email του πελάτη
                           (για online: με σύνδεσμο Google Meet)
```

- Αν η ψυχολόγος σβήσει ή μετακινήσει το event, η Google ενημερώνει αυτόματα τον πελάτη.
- Δεν αποθηκεύεται τίποτα αλλού. Δεν υπάρχει βάση δεδομένων.
- Προστασία από spam: κρυφό πεδίο-παγίδα για bots και έλεγχος όλων των πεδίων στον server.
- Γνωστό όριο: αν δύο άνθρωποι πατήσουν την ίδια ώρα στο ίδιο δευτερόλεπτο, μπορεί να γραφτούν και οι δύο. Με λίγες κρατήσεις την ημέρα είναι πρακτικά απίθανο, και φαίνεται αμέσως στο ημερολόγιο.

---

## 4. Σύνδεση με Google Calendar

**Προτείνεται Google Workspace** (περίπου 7 €/μήνα): έχει σύμβαση επεξεργασίας δεδομένων για τον GDPR, δίνει email στο domain της, και επιτρέπει «Internal» σύνδεση χωρίς έλεγχο από τη Google.

1. **Ημερολόγια:** στο Google Calendar της ψυχολόγου φτιάξτε δύο νέα ημερολόγια: **Διαθεσιμότητα** και **Ραντεβού site**. Στο «Διαθεσιμότητα» βάλτε επαναλαμβανόμενα events με τις ώρες που δέχεται, π.χ. «Τρίτη 17:00–21:00, κάθε εβδομάδα».
2. **Google Cloud:** στο [console.cloud.google.com](https://console.cloud.google.com) φτιάξτε project και ενεργοποιήστε το **Google Calendar API** (APIs & Services → Library).
3. **Οθόνη συναίνεσης (Google Auth Platform):**
   - Με Workspace: User type **Internal**.
   - Με απλό Gmail: **External** και μετά **Publish app** (σε κατάσταση «Testing» η σύνδεση λήγει κάθε 7 μέρες). Η Google θα δείξει μία φορά προειδοποίηση «unverified app». Πατήστε Advanced → Continue.
4. **Κλειδιά:** Credentials → Create credentials → OAuth client ID → τύπος **Desktop app**. Αντιγράψτε το `.env.example` σε `.env` και βάλτε `GOOGLE_CLIENT_ID` και `GOOGLE_CLIENT_SECRET`.
5. **Σύνδεση:** τρέξτε `npm run google:auth`. Ανοίγει ο browser: συνδεθείτε με τον λογαριασμό της ψυχολόγου. Το script γράφει το `GOOGLE_REFRESH_TOKEN` στο `.env` και δείχνει τα ID των ημερολογίων.
6. Συμπληρώστε `GOOGLE_CALENDAR_AVAILABILITY_ID` και `GOOGLE_CALENDAR_BOOKINGS_ID`, και βάλτε `PUBLIC_BOOKING_MODE=live`.
7. `npm run dev` και κάντε μια δοκιμαστική κράτηση με δικό σας email. Ελέγξτε ότι εμφανίστηκε στο ημερολόγιο και ότι ήρθε η πρόσκληση.

---

## 5. Ανέβασμα στο internet (Netlify)

1. **GitHub:** φτιάξτε **ιδιωτικό** repository και ανεβάστε τον φάκελο. Το `.env` δεν ανεβαίνει, είναι στο `.gitignore`.
   ```powershell
   git init
   git add .
   git commit -m "Πρώτη έκδοση"
   git branch -M main
   git remote add origin https://github.com/ΟΝΟΜΑ/psychologos-site.git
   git push -u origin main
   ```
2. **Netlify:** [app.netlify.com](https://app.netlify.com) → Add new site → Import from Git → διαλέξτε το repo. Οι ρυθμίσεις build διαβάζονται από το `netlify.toml`.
3. **Μεταβλητές:** Site configuration → Environment variables. Βάλτε ό,τι έχει το `.env` σας (`SITE_URL`, `PUBLIC_BOOKING_MODE`, όλα τα `GOOGLE_*`). Μετά Deploys → Trigger deploy.
4. **Domain:** αγοράστε domain (π.χ. `kogkolidou.gr`) από Έλληνα registrar. Στο Netlify: Domain management → Add domain, και ακολουθήστε τις οδηγίες για DNS. Το HTTPS ενεργοποιείται αυτόματα.
5. **Google Search Console:** προσθέστε το domain, επαληθεύστε (DNS ή `PUBLIC_GOOGLE_SITE_VERIFICATION`) και υποβάλετε το `https://ΤΟ-DOMAIN/sitemap-index.xml`.
6. **Google Business Profile:** καταχώριση του γραφείου με πραγματική διεύθυνση. Είναι καταχώριση, όχι διαφήμιση.
7. **Στατιστικά (προαιρετικά):** [Plausible](https://plausible.io), χωρίς cookies, άρα χωρίς banner. Ορίστε `PUBLIC_PLAUSIBLE_DOMAIN`.

Κάθε `git push` στο `main` ανεβάζει αυτόματα νέα έκδοση.

---

## 6. Λίστα ελέγχου πριν το launch

- [ ] Πραγματικά στοιχεία στο `site.ts`: πόλη, διεύθυνση, τηλέφωνο, email, ώρες, τιμές, υπηρεσίες
- [ ] Πτυχίο και άδεια άσκησης επαγγέλματος επιβεβαιωμένα (ο τίτλος «Ψυχολόγος» προστατεύεται από τον ν. 991/1979)
- [ ] Απόφαση για online συνεδρίες (`offersOnline`): άρθρο 11 του Κώδικα Δεοντολογίας, επιβεβαίωση με ΣΕΨ ή δικηγόρο
- [ ] Απόφαση για συνεδρίες ζεύγους (μόνο με σχετική εκπαίδευση)
- [ ] Κείμενο «Ποια είμαι» από την ίδια
- [ ] Κείμενα θεμάτων (`topics.ts`) εγκεκριμένα από την ίδια
- [ ] Πολιτική απορρήτου και όροι ελεγμένοι από νομικό
- [ ] Επαγγελματική φωτογραφία (`portrait.jpg`, `og.jpg`)
- [ ] Google Workspace με επαλήθευση δύο βημάτων
- [ ] `PUBLIC_BOOKING_MODE=live` και δοκιμαστική κράτηση από άκρη σε άκρη
- [ ] `SITE_URL` = το πραγματικό domain
- [ ] `draft: false` στο `site.ts`
- [ ] Search Console με sitemap
- [ ] **Όχι Google Ads ή πληρωμένα social:** απαγορεύονται από το άρθρο 10 του Κώδικα Δεοντολογίας (ΦΕΚ Β' 2344/2019)
