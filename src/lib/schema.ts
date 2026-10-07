/**
 * Δομημένα δεδομένα (schema.org, JSON-LD) για τη Google.
 * Βοηθούν τη Google να καταλάβει ποια είναι, τι κάνει και πού βρίσκεται.
 */
import { credentials, faq as homeFaq, practice, services } from '../data/site';

type Json = Record<string, unknown>;

export function personSchema(site: URL): Json {
  return {
    '@type': 'Person',
    '@id': new URL('/#person', site).href,
    name: practice.name,
    jobTitle: 'Ψυχολόγος',
    image: new URL('/og.jpg', site).href,
    alumniOf: { '@type': 'CollegeOrUniversity', name: 'Αριστοτέλειο Πανεπιστήμιο Θεσσαλονίκης' },
    hasCredential: credentials.map((c) => ({
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: 'degree',
      name: c.text,
    })),
  };
}

export function businessSchema(site: URL): Json {
  const prices = services.map((s) => parseInt(s.priceLabel, 10)).filter((n) => !Number.isNaN(n));
  return {
    '@type': 'MedicalBusiness',
    '@id': new URL('/#practice', site).href,
    name: `${practice.name}, Ψυχολόγος`,
    description: `Ψυχολόγος ${practice.cityIn}${practice.offersOnline ? ' και online' : ''}.`,
    url: new URL('/', site).href,
    image: new URL('/og.jpg', site).href,
    telephone: practice.phone,
    email: practice.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: practice.address,
      addressLocality: practice.city,
      addressCountry: 'GR',
    },
    areaServed: practice.offersOnline ? ['GR', practice.city] : practice.city,
    priceRange: prices.length ? `${Math.min(...prices)}–${Math.max(...prices)} €` : undefined,
    founder: { '@id': new URL('/#person', site).href },
    knowsLanguage: 'el',
  };
}

export function faqSchema(items: { q: string; a: string }[]): Json {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function breadcrumbSchema(site: URL, items: { name: string; path: string }[]): Json {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: new URL(it.path, site).href,
    })),
  };
}

export function homeSchema(site: URL): Json[] {
  return [businessSchema(site), personSchema(site), faqSchema(homeFaq)];
}
