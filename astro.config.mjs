// @ts-check
import { defineConfig, envField } from 'astro/config';
import { loadEnv } from 'vite';
import netlify from '@astrojs/netlify';
import sitemap from '@astrojs/sitemap';

// Διαβάζει και το .env (τοπικά). Στο Netlify οι μεταβλητές έρχονται από τις ρυθμίσεις του site.
const { SITE_URL } = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');

export default defineConfig({
  // Το πραγματικό domain. Χρησιμοποιείται για canonical, sitemap και Open Graph.
  // Αλλάζει με τη μεταβλητή SITE_URL ή εδώ.
  site: SITE_URL || 'https://www.example.gr',

  // Οι σελίδες βγαίνουν στατικές. Μόνο τα /api/* τρέχουν ως serverless functions στο Netlify.
  // imageCDN: false → οι εικόνες βελτιστοποιούνται στο build (δουλεύουν παντού, και τοπικά).
  adapter: netlify({ imageCDN: false }),
  integrations: [sitemap()],

  build: {
    inlineStylesheets: 'auto',
  },

  env: {
    schema: {
      // «demo»: η κράτηση δεν στέλνει τίποτα. «live»: συνδέεται με το Google Calendar.
      PUBLIC_BOOKING_MODE: envField.enum({ context: 'client', access: 'public', values: ['demo', 'live'], default: 'demo' }),
      // Προαιρετικά: στατιστικά χωρίς cookies (Plausible) και επαλήθευση Search Console.
      PUBLIC_PLAUSIBLE_DOMAIN: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_GOOGLE_SITE_VERIFICATION: envField.string({ context: 'client', access: 'public', optional: true }),

      // Μυστικά (μόνο στον server). Οδηγίες: README → «Σύνδεση με Google Calendar».
      GOOGLE_CLIENT_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
      GOOGLE_CLIENT_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      GOOGLE_REFRESH_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
      GOOGLE_CALENDAR_AVAILABILITY_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
      GOOGLE_CALENDAR_BOOKINGS_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
      GOOGLE_CALENDAR_BUSY_IDS: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
});
