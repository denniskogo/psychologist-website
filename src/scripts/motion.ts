/**
 * Εμφάνιση στοιχείων στο scroll.
 * - `.reveal`: το στοιχείο «ανεβαίνει» όταν μπαίνει στην οθόνη.
 * - `[data-stagger]`: τα παιδιά του εμφανίζονται διαδοχικά.
 * - `.watch`: παίρνει την κλάση `.in` (π.χ. για να σχεδιαστεί μια γραμμή).
 * Το περιεχόμενο είναι πάντα ορατό. Με «μειωμένη κίνηση» δεν τρέχει τίποτα.
 */
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.querySelectorAll<HTMLElement>('[data-stagger]').forEach((parent) => {
  Array.from(parent.children).forEach((child, i) => {
    child.classList.add('reveal');
    (child as HTMLElement).style.setProperty('--i', String(i));
  });
});

if (!reduce && 'IntersectionObserver' in window) {
  const targets = Array.from(document.querySelectorAll<HTMLElement>('.reveal, .watch'));
  const vh = window.innerHeight;
  targets.forEach((el) => {
    if (el.getBoundingClientRect().top < vh * 0.92) el.classList.add('in');
  });
  document.documentElement.classList.add('motion');

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    }
  }, { rootMargin: '0px 0px -8% 0px' });

  targets.forEach((el) => { if (!el.classList.contains('in')) io.observe(el); });
}
