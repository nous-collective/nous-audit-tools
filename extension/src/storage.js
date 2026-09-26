// chrome.storage.local sarmalayıcıları.

import { dedupeListings, listingKey } from './normalize.js';

export const SETTINGS_VERSION = 3;

export const DEFAULT_SETTINGS = {
  displayCurrency: 'TRY',
  rates: null, // { rates: {USD:1, TRY:.., ...}, updatedAt, source, manual }
  kktc: { maxAgeYears: 5, shippingMonths: 2 },
  costs: {
    shippingJP: { amount: '', currency: 'USD' },
    shippingUK: { amount: '', currency: 'GBP' },
    insurancePct: '',
    taxPct: '',
    fixedFees: { amount: '', currency: 'TRY' },
  },
  postcode: '',
  contact: { name: '', email: '', phone: '' },
  runner: { mode: 'auto', concurrency: 3, settleMs: 2500, timeoutMs: 45000, perSite: 50, maxPages: 5, pageSize: 50 },
  onlyMatching: true,
  siteOverrides: {},
};

function merge(base, over) {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return over ?? base;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = base && typeof base[k] === 'object' && base[k] !== null && !Array.isArray(base[k]) ? merge(base[k], v) : v;
  }
  return out;
}

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  const s = merge(DEFAULT_SETTINGS, settings || {});
  if ((s.version || 1) < 2) {
    // 1. sürümde varsayılan "arka plan sekmesi" idi; yeni varsayılan önce hızlı indirme.
    if (s.runner.mode === 'background') s.runner.mode = 'auto';
    s.runner.maxPages ??= 2;
  }
  if ((s.version || 1) < 3) {
    // 3. sürüm: siteden istenen sayıda ilan (varsayılan 50) toplanana kadar sayfalar gezilir.
    s.runner.perSite ??= 50;
    s.runner.pageSize ??= 50;
    if (!s.runner.maxPages || s.runner.maxPages < 5) s.runner.maxPages = 5;
  }
  s.version = SETTINGS_VERSION;
  return s;
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ settings });
}

export async function getResults() {
  const { results } = await chrome.storage.local.get('results');
  // Eski sürümde kaydedilmiş sonuçlar ham URL ile anahtarlanmıştı.
  return dedupeListings((results || []).map((r) => ({ ...r, id: listingKey(r.url) })));
}

export async function saveResults(results) {
  await chrome.storage.local.set({ results });
}

// Yeni ilanları mevcut sonuçlara ekler; aynı ilanın kopyaları birleştirilir. Eklenen yeni ilan sayısını döndürür.
export async function addResults(items) {
  const results = await getResults();
  const merged = dedupeListings([...results, ...items]);
  await saveResults(merged);
  return merged.length - results.length;
}

export async function getFavorites() {
  const { favorites } = await chrome.storage.local.get('favorites');
  // Eski sürümün ham URL anahtarlarını ilan kimliğine taşı.
  const out = {};
  for (const fav of Object.values(favorites || {})) {
    const id = listingKey(fav.listing.url);
    out[id] = { ...fav, listing: { ...fav.listing, id } };
  }
  return out;
}

export async function saveFavorites(favorites) {
  await chrome.storage.local.set({ favorites });
}
