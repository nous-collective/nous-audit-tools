// "Siteleri test et": her sitede bilinen bir aramayı çalıştırıp toplanan ilanların
// kalitesini ölçer (ilan geliyor mu, fiyat/yıl/km okunuyor mu, kopya var mı).

import { matchesQuery, squash } from './query.js';

export const TEST_QUERY = { make: 'Toyota', model: 'Prius' };

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

// Aynı sitede başlığı ve fiyatı aynı olan ilan grupları: kopya şüphesi.
export function suspectedDuplicates(items) {
  const groups = new Map();
  for (const l of items) {
    if (l.price == null) continue;
    const k = `${squash(l.title)}|${l.price}|${l.km ?? ''}`;
    groups.set(k, (groups.get(k) || 0) + 1);
  }
  return [...groups.values()].filter((n) => n > 1).reduce((a, n) => a + n - 1, 0);
}

export function evaluateSite(items, status, query = TEST_QUERY) {
  const n = items.length;
  const matching = items.filter((l) => matchesQuery(l, query));
  const m = {
    state: status?.state || 'unknown',
    count: n,
    matching: matching.length,
    pricePct: pct(items.filter((l) => l.price != null).length, n),
    yearPct: pct(items.filter((l) => l.year).length, n),
    kmPct: pct(items.filter((l) => l.km != null).length, n),
    imagePct: pct(items.filter((l) => l.image).length, n),
    duplicates: suspectedDuplicates(items),
    sample: matching[0] || items[0] || null,
  };
  const problems = [];
  if (!n) problems.push(status?.message || 'İlan gelmedi');
  else {
    if (m.matching < Math.min(3, n)) problems.push('Aranan araçla eşleşen ilan az');
    if (m.pricePct < 50) problems.push('Fiyatların çoğu okunamadı');
    if (m.yearPct < 50) problems.push('Yılların çoğu okunamadı');
    if (m.duplicates) problems.push(`${m.duplicates} kopya şüphesi`);
  }
  m.problems = problems;
  m.verdict = !n ? 'fail' : problems.length ? 'warn' : 'ok';
  return m;
}
