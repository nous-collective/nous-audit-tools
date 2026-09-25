// Döviz kurları ve para birimi dönüşümü. Kurlar "1 USD = x birim" biçiminde tutulur.

export const CURRENCIES = ['TRY', 'GBP', 'EUR', 'USD', 'JPY'];

const SOURCES = [
  {
    url: 'https://open.er-api.com/v6/latest/USD',
    parse: (j) => (j.result === 'success' ? j.rates : null),
  },
  {
    url: 'https://api.frankfurter.dev/v1/latest?base=USD',
    parse: (j) => (j.rates ? { ...j.rates, USD: 1 } : null),
  },
];

export async function fetchRates() {
  let lastError;
  for (const src of SOURCES) {
    try {
      const res = await fetch(src.url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const all = src.parse(await res.json());
      if (!all) throw new Error('Beklenmeyen yanıt');
      const rates = {};
      for (const c of CURRENCIES) {
        if (typeof all[c] !== 'number') throw new Error(`${c} kuru yok`);
        rates[c] = all[c];
      }
      return { rates, updatedAt: new Date().toISOString(), source: new URL(src.url).hostname };
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(`Kurlar alınamadı: ${lastError?.message || 'bilinmeyen hata'}`);
}

export function makeConverter(rates) {
  return (amount, from, to) => {
    if (amount === null || amount === undefined || Number.isNaN(amount)) return null;
    if (from === to) return amount;
    const rf = rates?.[from];
    const rt = rates?.[to];
    if (!rf || !rt) return null;
    return (amount / rf) * rt;
  };
}

export function formatMoney(amount, currency) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  const digits = currency === 'JPY' || Math.abs(amount) >= 1000 ? 0 : 2;
  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency,
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${Math.round(amount).toLocaleString('tr-TR')} ${currency}`;
  }
}
