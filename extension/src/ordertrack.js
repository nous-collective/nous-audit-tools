// Sipariş / nakliye takibi: sayfadan bilgi okuma, takip listesindeki araçla eşleştirme, yenileme.

import { extractOrderInfo } from './orderinfo.js';
import { listingKey } from './normalize.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Açık bir sekmeden etiket–değer çiftlerini okuyup sipariş bilgisini çıkarır.
export async function readOrderFromTab(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['src/scraper.js'] });
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: () => globalThis.__kktcScraper.pairs() });
  const r = res?.result || { pairs: [] };
  return { url: r.url, title: r.title, pairs: r.pairs, ...extractOrderInfo(r.pairs) };
}

// Sipariş sayfasını arka plan sekmesinde açıp yeniden okur (kullanıcının oturumuyla).
export async function refreshOrderUrl(url, { timeoutMs = 30000, settleMs = 3000 } = {}) {
  const tab = await chrome.tabs.create({ url, active: false });
  try {
    await new Promise((resolve) => {
      const timer = setTimeout(done, timeoutMs);
      function done() {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(on);
        resolve();
      }
      function on(id, info) {
        if (id === tab.id && info.status === 'complete') done();
      }
      chrome.tabs.onUpdated.addListener(on);
    });
    await sleep(settleMs);
    return await readOrderFromTab(tab.id);
  } finally {
    chrome.tabs.remove(tab.id).catch(() => {});
  }
}

const digits = (s) => String(s || '').replace(/[^\dA-Z]/gi, '').toUpperCase();

// Okunan bilginin takip listesindeki hangi araca ait olduğunu tahmin eder:
// şasi no / stok no eşleşmesi > ilanın adresindeki numara sayfada geçiyor > aynı site.
export function guessFavorite(favorites, info, pageUrl) {
  const favs = Object.values(favorites);
  const f = info.fields || {};
  const pageText = (info.pairs || []).map((p) => `${p.label} ${p.value}`).join(' ');
  const score = (fav) => {
    const l = fav.listing;
    let s = 0;
    if (f.chassis && fav.order?.fields?.chassis && digits(f.chassis) === digits(fav.order.fields.chassis)) s += 100;
    const nums = (l.url.match(/\d{5,}|[A-Z]{2}\d{4,}/gi) || []).filter((n) => n.length >= 5);
    if (nums.some((n) => pageText.includes(n) || (f.stockNo && digits(f.stockNo).includes(digits(n))))) s += 50;
    if (fav.order?.sourceUrl && listingKey(fav.order.sourceUrl) === listingKey(pageUrl)) s += 80;
    try {
      const a = new URL(l.url).hostname.replace(/^(www|sp|m)\./, '');
      const b = new URL(pageUrl).hostname.replace(/^(www|sp|m|mypage|my)\./, '');
      if (a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`)) s += 10;
    } catch {}
    return s;
  };
  const ranked = favs.map((fav) => [fav, score(fav)]).sort((a, b) => b[1] - a[1]);
  return ranked[0] && ranked[0][1] > 0 ? ranked[0][0].listing.id : null;
}

// Takip kaydına sipariş bilgisini yazar; önceki değerlerle birleştirir ve değişiklikleri döndürür.
export function applyOrder(fav, info, sourceUrl) {
  const prev = fav.order?.fields || {};
  const fields = { ...prev, ...info.fields };
  const changes = Object.keys(info.fields).filter((k) => prev[k] !== undefined && prev[k] !== info.fields[k]);
  fav.order = { fields, sourceUrl: sourceUrl || fav.order?.sourceUrl, updatedAt: new Date().toISOString(), history: [...(fav.order?.history || []), ...changes.map((k) => ({ field: k, from: prev[k], to: info.fields[k], at: new Date().toISOString() }))].slice(-30) };
  const ORDER = ['İnceleniyor', 'Teklif istendi', 'Pazarlıkta', 'Ödeme yapıldı', 'Yolda', 'Teslim alındı', 'Vazgeçildi'];
  if ((fields.vessel || fields.etd || fields.bl) && ORDER.indexOf(fav.status) < ORDER.indexOf('Yolda')) fav.status = 'Yolda';
  return changes;
}
