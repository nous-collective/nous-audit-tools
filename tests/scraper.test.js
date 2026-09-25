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
