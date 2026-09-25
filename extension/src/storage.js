// chrome.storage.local sarmalayıcıları.

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
  runner: { mode: 'background', concurrency: 3, settleMs: 2500, timeoutMs: 45000 },
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
  return merge(DEFAULT_SETTINGS, settings || {});
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ settings });
}

export async function getResults() {
  const { results } = await chrome.storage.local.get('results');
  return results || [];
}

export async function saveResults(results) {
  await chrome.storage.local.set({ results });
}

// Yeni ilanları mevcut sonuçlara ekler (aynı URL güncellenir).
export async function addResults(items) {
  const results = await getResults();
  const byId = new Map(results.map((r) => [r.id, r]));
  let added = 0;
  for (const it of items) {
    if (!byId.has(it.id)) added++;
    byId.set(it.id, { ...byId.get(it.id), ...it });
  }
  await saveResults([...byId.values()]);
  return added;
}

export async function getFavorites() {
  const { favorites } = await chrome.storage.local.get('favorites');
  return favorites || {};
}

export async function saveFavorites(favorites) {
  await chrome.storage.local.set({ favorites });
}
