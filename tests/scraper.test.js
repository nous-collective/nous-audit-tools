// scraper.js'i gerçek Chromium'da örnek sayfalara karşı çalıştırır.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

import { startServer } from './fixtures.js';
import { toListings } from '../extension/src/normalize.js';

const SCRAPER = readFileSync(new URL('../extension/src/scraper.js', import.meta.url), 'utf8');
let browser, srv;

before(async () => {
  srv = await startServer();
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  srv?.server.close();
});

async function scrape(path, opts = { scroll: true }) {
  const page = await browser.newPage();
  try {
    await page.goto(srv.base + path);
    await page.addScriptTag({ content: SCRAPER });
    return await page.evaluate((o) => globalThis.__kktcScraper.run(o), opts);
  } finally {
    await page.close();
  }
}

test('Japon ihracatçı ızgarası: 20 ilan, FOB + toplam fiyat, lazy görsel', async () => {
  const raw = await scrape('/jp-grid');
  const items = toListings(raw.items, { id: 'jp', name: 'JP', country: 'JP' }, raw.url);
  assert.equal(items.length, 20);
  const first = items.find((x) => x.url.endsWith('/id/900000/'));
  assert.ok(first, 'detay bağlantısı seçilmeli (inquiry değil)');
  assert.equal(first.title, '2015 TOYOTA PRIUS S');
  assert.equal(first.price, 5000);
  assert.equal(first.currency, 'USD');
  assert.equal(first.priceTotal, 6500);
  assert.equal(first.year, 2015);
  assert.equal(first.month, 1);
  assert.equal(first.km, 40000);
  assert.equal(first.engineCc, 1800);
  assert.equal(first.transmission, 'automatic');
  assert.equal(first.fuel, 'hybrid');
  assert.equal(first.image, `${srv.base}/photos/0.jpg`, 'data-src tercih edilir');
  assert.ok(items.every((x) => !/inquiry|\/toyota$|\/about/.test(x.url)), 'menü/sorgu bağlantısı ilan sayılmaz');
});

test('İngiliz ilan kartları: taksit ve eski fiyat ayıklanır, mil km\'ye çevrilir', async () => {
  const raw = await scrape('/uk-cards');
  const items = toListings(raw.items, { id: 'uk', name: 'UK', country: 'UK' }, raw.url);
  const main = items.filter((x) => x.url.includes('/car-details/'));
  assert.equal(main.length, 12);
  const c0 = main.find((x) => x.url.endsWith('/car-details/202400000000'));
  assert.ok(c0, 'utm parametresi temizlenmeli');
  assert.equal(c0.price, 9000, 'was £14,995 ve £199 per month fiyat sayılmaz');
  assert.equal(c0.currency, 'GBP');
  assert.equal(c0.year, 2016);
  assert.equal(c0.km, 48280);
  assert.match(c0.image, /^https:\/\/cdn\.example\/0-w(480|960)\.jpg$/, 'srcset\'ten görsel');
  assert.match(c0.title, /^Toyota Prius 1\.8 VVT-h Business Edition 0$/);
  const c1 = main.find((x) => x.url.endsWith('/car-details/202400000001'));
  assert.equal(c1.price, 9500);
});

test('Tablo satırları ve yen fiyatı', async () => {
  const raw = await scrape('/yen-table');
  const items = toListings(raw.items, null, raw.url);
  assert.equal(items.length, 8);
  const r = items.find((x) => x.url.endsWith('/70000/'));
  assert.equal(r.price, 1170000);
  assert.equal(r.currency, 'JPY');
  assert.equal(r.year, 2018);
  assert.equal(r.km, 10000);
  assert.equal(r.siteId, 'host:127.0.0.1');
});

test('JSON-LD verisi', async () => {
  const raw = await scrape('/json-ld');
  const items = toListings(raw.items, null, raw.url);
  assert.equal(items.length, 4);
  const l = items.find((x) => x.url === 'https://example.test/leaf/1');
  assert.equal(l.price, 12000);
  assert.equal(l.currency, 'GBP');
  assert.equal(l.year, 2021);
  assert.equal(l.month, 4);
  assert.equal(l.km, 32187);
  assert.equal(l.fuel, 'electric');
  assert.equal(l.make, 'Nissan');
});

test('Sonradan çizilen sayfa (SPA)', async () => {
  const page = await browser.newPage();
  await page.goto(srv.base + '/late');
  await page.addScriptTag({ content: SCRAPER });
  const early = await page.evaluate(() => globalThis.__kktcScraper.run({}));
  assert.equal(early.items.length, 0);
  await page.waitForTimeout(1800);
  const late = await page.evaluate(() => globalThis.__kktcScraper.run({}));
  assert.equal(toListings(late.items, null, late.url).length, 6);
  await page.close();
});

test('Robot doğrulaması ve boş sayfa', async () => {
  const b = await scrape('/blocked');
  assert.equal(b.blocked, true);
  assert.equal(b.items.length, 0);
  const e = await scrape('/empty');
  assert.equal(e.blocked, false);
  assert.equal(e.items.length, 0, 'menü/footer listeleri ilan sayılmaz');
});

test('Aynı ilanın kopyaları tek ilan: refkey, gizli mobil kopya, JSON-LD', async () => {
  const raw = await scrape('/dupes');
  const items = toListings(raw.items, { id: 'd', name: 'D', country: 'JP' }, raw.url);
  assert.equal(items.length, 6, items.map((x) => x.url).join('\n'));
  assert.ok(items.every((x) => !x.url.includes('refkey') && !x.url.includes('/m/')));
  const a = items.find((x) => x.url.endsWith('/toyota/prius/3000/') || x.url.endsWith('/toyota/prius/3000'));
  assert.equal(a.price, 8000);
  assert.equal(a.km, 50000, 'JSON-LD ile DOM birleşir: km DOM\'dan gelir');
  assert.ok(raw.diag.hiddenSkipped >= 6, 'gizli mobil kartlar sayılmaz');
});

test('İndirilmiş HTML (DOMParser) ile okuma: gizli kopyalar yine tek ilan', async () => {
  const page = await browser.newPage();
  await page.goto(srv.base + '/empty');
  await page.addScriptTag({ content: SCRAPER });
  const res = await page.evaluate(async (base) => {
    const out = {};
    for (const path of ['/jp-grid', '/dupes', '/uk-cards']) {
      const html = await (await fetch(base + path)).text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const r = await globalThis.__kktcScraper.run({ doc, baseUrl: base + path });
      out[path] = r.items;
    }
    return out;
  }, srv.base);
  await page.close();
  assert.equal(toListings(res['/jp-grid'], null, srv.base + '/jp-grid').length, 20);
  assert.equal(toListings(res['/uk-cards'], null, srv.base + '/uk-cards').length, 12);
  // Düzen bilgisi yokken gizli mobil kopya DOM'da kalır ama içerik parmak izi aynı olduğu için birleşir.
  const d = toListings(res['/dupes'], { id: 'd', name: 'D', country: 'JP' }, srv.base + '/dupes');
  assert.equal(d.length, 6, d.map((x) => x.url).join('\n'));
  assert.ok(res['/jp-grid'].every((x) => x.url.startsWith(srv.base)), 'göreli bağlantılar sayfa adresine göre çözülür');
});

test('Fiyatı ASK olan kartlar alınır, fiyat filtresi bağlantıları alınmaz', async () => {
  const raw = await scrape('/ask-price');
  const items = toListings(raw.items, null, raw.url);
  assert.equal(items.length, 5, items.map((x) => x.url).join('\n'));
  assert.ok(items.every((x) => /\/stock\/77\d\d$/.test(x.url)));
  assert.equal(items[0].price, null);
  assert.equal(items.find((x) => x.url.endsWith('/7700')).year, 2020);
});

test('Sonraki sayfa bağlantısı', async () => {
  const p1 = await scrape('/paged/1');
  assert.equal(p1.next, `${srv.base}/paged/2`);
  const p3 = await scrape('/paged/3');
  assert.equal(p3.next, null);
  assert.equal(toListings(p1.items, null, p1.url).length, 4);
});

test('Türk lirası fiyatlar', async () => {
  const raw = await scrape('/try');
  const items = toListings(raw.items, null, raw.url);
  assert.equal(items.length, 3);
  assert.equal(items.find((x) => x.url.endsWith('/ilan/900')).price, 1250000);
  assert.equal(items[0].currency, 'TRY');
  assert.equal(items.find((x) => x.url.endsWith('/ilan/900')).km, 30000);
});

test('Liste ile aynı adresteki ?id= detay bağlantıları alınır', async () => {
  const raw = await scrape('/same');
  const items = toListings(raw.items, null, raw.url);
  assert.equal(items.length, 4);
  assert.ok(items.every((x) => /\/same\?id=50\d/.test(x.url)), items.map((x) => x.url).join('\n'));
});

// ---- Canlı sitelerde görülen yapılar ----
const JP = { id: 'jp', name: 'JP', country: 'JP', currency: 'USD' };
const UK = { id: 'uk', name: 'UK', country: 'UK', currency: 'GBP' };

test('Canlı yapı: Goo-net sınıfsız <li> kartlar', async () => {
  const raw = await scrape('/live-goonet');
  const items = toListings(raw.items, JP, raw.url);
  assert.equal(items.length, 5);
  assert.equal(items[0].price, 4303900);
  assert.equal(items[0].currency, 'JPY');
  assert.deepEqual([items[0].year, items[0].month], [2023, 9]);
  assert.equal(items[0].km, 20460);
});

test('Canlı yapı: CardealPage ara sayfası ve 4 satırlı ilanlar', async () => {
  const gate = await scrape('/live-cardeal');
  assert.equal(gate.items.length, 0);
  assert.equal(gate.continueUrl, `${srv.base}/live-cardeal-list?token=1`);
  const raw = await scrape('/live-cardeal-list');
  const items = toListings(raw.items, JP, raw.url);
  assert.equal(items.length, 6);
  assert.equal(items[0].price, 11035);
  assert.deepEqual([items[0].year, items[0].month, items[0].km], [2020, 1, 80320]);
});

test('Canlı yapı: Car Junction bootstrap satırları, birimsiz km', async () => {
  const raw = await scrape('/live-carjunction');
  const items = toListings(raw.items, JP, raw.url);
  assert.equal(items.length, 4);
  assert.equal(items[0].year, 2022);
  assert.equal(items[0].km, 66600);
  assert.ok(items.every((x) => x.url.includes('/car-detail/')));
});

test('Canlı yapı: AutoTrader yıl/km gömülü veriden', async () => {
  const raw = await scrape('/live-autotrader');
  const items = toListings(raw.items, UK, raw.url);
  assert.equal(items.length, 3);
  const a = items.find((x) => x.url.endsWith('202609236317551'));
  assert.equal(a.price, 2999);
  assert.equal(a.year, 2009);
  assert.equal(a.km, 215390, '133.837 mil');
});

test('Canlı yapı: cinch tek ilan Next.js verisinden', async () => {
  const raw = await scrape('/live-cinch');
  const items = toListings(raw.items, UK, raw.url);
  assert.equal(items.length, 1);
  const c = items[0];
  assert.equal(c.url, `${srv.base}/used-cars/toyota/prius/details/1d2a07e7-3f87-4f2b-b049-37e36e89e520`);
  assert.deepEqual([c.price, c.currency, c.year, c.km, c.fuel], [12600, 'GBP', 2018, 113343, 'plug-in']);
});
