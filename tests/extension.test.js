// Eklentiyi Chromium'a yükler; site şablonlarını yerel örnek sayfalara yönlendirip
// panelden uçtan uca arama yapar.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

import { startServer } from './fixtures.js';
import { SITES } from '../extension/src/sites.js';

let ctx, srv, extDir, extId, dashboard;
const errors = [];

before(async () => {
  srv = await startServer();
  // Test kopyası: yerel sunucuya erişim izni eklenir.
  extDir = mkdtempSync(join(tmpdir(), 'kktc-ext-'));
  cpSync(new URL('../extension', import.meta.url).pathname, extDir, { recursive: true });
  const manifest = JSON.parse(readFileSync(join(extDir, 'manifest.json'), 'utf8'));
  manifest.host_permissions.push('http://127.0.0.1/*');
  writeFileSync(join(extDir, 'manifest.json'), JSON.stringify(manifest));

  ctx = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    acceptDownloads: true,
    args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
  });
  let [sw] = ctx.serviceWorkers();
  sw ??= await ctx.waitForEvent('serviceworker');
  extId = new URL(sw.url()).host;

  // Ayarlar: yalnızca yerel örnek sayfalara giden siteler açık, kurlar elle.
  const setup = await ctx.newPage();
  await setup.goto(`chrome-extension://${extId}/popup.html`);
  const b = srv.base;
  const siteOverrides = Object.fromEntries(SITES.filter((s) => s.templates.length).map((s) => [s.id, { enabled: false }]));
  Object.assign(siteOverrides, {
    sbt: { enabled: true, templates: [`${b}/jp-grid?make={make|slug}&model={model|slug}`] },
    goonet: { enabled: true, templates: [`${b}/yen-table?make={make|upper}`] },
    autotrader: { enabled: true, templates: [`${b}/uk-cards?make={make|enc}[&price-to={priceMax}]`] },
    tcv: { enabled: true, templates: [`${b}/blocked?make={make}`] },
    cinch: { enabled: true, templates: [`${b}/empty?make={make}`] },
    carwow: { enabled: true, templates: [`${b}/uk-cards?needs={make}&{keyword}`] },
    cardealpage: { enabled: true, templates: [`${b}/dupes?m={make}`] },
    picknbuy24: { enabled: true, templates: [`${b}/late?m={make}`] },
    gumtree: { enabled: true, templates: [`${b}/paged/1?m={make}`] },
    realmotor: { enabled: true, templates: [`${b}/ssr-recommended?m={make}`] },
    // Eski sürümün tek şablon kaydı da çalışmalı.
    motors: { enabled: true, template: `${b}/try?m={make}` },
  });
  await setup.evaluate(
    (s) => chrome.storage.local.set({ settings: s }),
    {
      version: 2,
      displayCurrency: 'USD',
      rates: { rates: { USD: 1, TRY: 40, GBP: 0.8, EUR: 0.9, JPY: 150 }, updatedAt: new Date().toISOString(), source: 'manuel', manual: true },
      costs: { shippingJP: { amount: 1500, currency: 'USD' }, shippingUK: { amount: 800, currency: 'GBP' }, insurancePct: 1, taxPct: 50, fixedFees: { amount: '', currency: 'TRY' } },
      runner: { mode: 'auto', concurrency: 3, settleMs: 300, timeoutMs: 15000, maxPages: 2 },
      siteOverrides,
    },
  );
  await setup.close();

  dashboard = await ctx.newPage();
  dashboard.on('pageerror', (e) => errors.push(e.message));
  dashboard.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  await dashboard.goto(`chrome-extension://${extId}/dashboard.html`);
});

after(async () => {
  await ctx?.close();
  srv?.server.close();
  if (extDir) rmSync(extDir, { recursive: true, force: true });
});

const cards = () => dashboard.locator('#results .card').count();

test('panelden tüm sitelerde arama', async () => {
  const p = dashboard;
  // Yalnızca model yazılır; marka "Toyota" olarak bulunmalı.
  await p.fill('input[name=make]', '');
  await p.fill('input[name=model]', 'prius');
  await p.click('#search-btn');
  assert.equal(await p.inputValue('input[name=make]'), 'Toyota');
  assert.equal(await p.inputValue('input[name=model]'), 'Prius');
  await p.waitForFunction(() => document.querySelector('#search-btn').textContent === 'Tüm sitelerde ara' && !document.querySelector('#search-btn').disabled, null, { timeout: 90000 });

  const chips = await p.$$eval('#site-status .chip', (els) => els.map((e) => [e.className.replace('chip st-', ''), e.textContent]));
  const byState = Object.fromEntries(chips.map(([s, t]) => [t.split(':')[0].replace(/^\S+\s/, '').trim(), [s, t]]));
  const st = (name) => byState[name]?.[0];
  assert.equal(st('SBT Japan'), 'done');
  assert.equal(st('Goo-net Exchange'), 'done');
  assert.equal(st('AutoTrader UK'), 'done');
  assert.equal(st('TCV (tradecarview)'), 'blocked');
  assert.equal(st('cinch'), 'empty');
  assert.equal(st('Carwow'), 'skipped', 'zorunlu {keyword} boş olduğu için atlanır');
  assert.equal(st('CardealPage'), 'done');
  assert.equal(st('PicknBuy24'), 'done', 'JavaScript ile çizilen sayfa sekmede okunur');
  assert.equal(st('Gumtree'), 'done');
  assert.match(byState.Gumtree[1], /8 ilan · 2 sayfa/);
  assert.equal(st('Motors.co.uk (Cazoo)'), 'done');
  assert.equal(st('CarGurus UK'), 'manual', 'otomatik aranamayan siteler de listelenir');
  assert.equal(st('BCA (bayi mezatı)'), 'manual');

  // 20 (JP ızgara) + 8 (yen) + 12 (UK) + 6 (kopyalı sayfa) + 6 (SPA, Honda) + 8 (2 sayfa, Honda) + 3 (TL, Corolla)
  // + 13 (sekmede okunan sayfa: JS ile gelen 7 Prius + sunucunun gönderdiği 6 Mazda önerisi) = 76
  // "Sadece aranan marka/model": Honda, Corolla ve Mazda ilanları gizli → 53
  const count = await p.textContent('#result-count');
  assert.equal(count, '53 / 76 ilan · 23 tanesi aranan marka/modelle eşleşmediği için gizli');
  assert.equal(await cards(), 53);
  assert.equal(st('Real Motor Japan'), 'done');

  // Kopya yok: her ilan adresi bir kez.
  const hrefs = await p.$$eval('#results .card a.title', (els) => els.map((a) => a.href));
  assert.equal(new Set(hrefs).size, hrefs.length);
  assert.equal(hrefs.filter((h) => /\/toyota\/prius\/300\d/.test(h)).length, 6, 'kopyalı sayfadan 6 ilan');
  assert.ok(hrefs.every((h) => !h.includes('refkey') && !h.includes('/m/car')));

  // Varsayılan sıralama fiyat artan (USD): JP ızgara 5000 USD en ucuz.
  assert.match(await p.textContent('#results .card:first-child .price'), /5\.000/);
  // Tahmini maliyet: 5000 + 1500 + %1 sigorta (65) = 6565 CIF, %50 vergi → 9847,5
  assert.match(await p.textContent('#results .card:first-child .cost'), /9\.84[78]/);

  if (process.env.SCREENSHOT_DIR) {
    await p.setViewportSize({ width: 1400, height: 900 });
    await p.screenshot({ path: join(process.env.SCREENSHOT_DIR, 'panel.png') });
  }
});

test('marka/model filtresi kapatılınca tüm ilanlar görünür', async () => {
  const p = dashboard;
  await p.uncheck('[data-f=onlyMatching]');
  assert.equal(await cards(), 76);
  await p.check('[data-f=onlyMatching]');
  assert.equal(await cards(), 53);
});

test('filtreler', async () => {
  const p = dashboard;
  await p.selectOption('[data-f=country]', 'UK');
  assert.equal(await cards(), 12);
  await p.selectOption('[data-f=country]', 'JP');
  assert.equal(await cards(), 41);
  await p.fill('[data-f=yearMin]', '2020');
  // JP ızgara: 2015+(i%9) ≥ 2020 → 8 ilan; yen tablo 2018+(i%5) ≥ 2020 → 4 ilan; kopyalı sayfa 2019 → 0; JS sonuçları 2021 → 7
  assert.equal(await cards(), 19);
  await p.selectOption('[data-f=age]', 'ok');
  const ages = await p.$$eval('#results .card .badges .badge:last-child', (els) => els.map((e) => e.className));
  assert.ok(ages.every((c) => c.includes('ok')));
  await p.click('#reset-filters');
  assert.equal(await cards(), 53);
  await p.fill('[data-f=text]', 'business edition');
  assert.equal(await cards(), 12);
  await p.click('#reset-filters');
});

test('tanı raporu', async () => {
  const p = dashboard;
  const [download] = await Promise.all([p.waitForEvent('download'), p.click('#export-diag')]);
  const report = JSON.parse(readFileSync(await download.path(), 'utf8'));
  assert.deepEqual(report.query, { make: 'Toyota', model: 'Prius' });
  assert.equal(report.sites.sbt.pages[0].method, 'fetch', 'sunucuda çizilen sayfa indirilerek okunur');
  assert.equal(report.sites.picknbuy24.pages[0].method, 'tab', 'JavaScript sayfası sekmeye düşer');
  assert.equal(report.sites.realmotor.pages[0].method, 'tab', 'indirmede yalnızca alakasız öneriler varsa sekmeye geçilir');
  assert.equal(report.sites.realmotor.pages[0].fetch.matching, 0);
  assert.equal(report.sites.gumtree.pages.length, 2);
  assert.ok(report.sites.cinch.pages[0].fetch.diag.bodyTextSample.includes('No vehicles'));
  assert.equal(report.results.perSite.sbt, 20);
  assert.ok(!('contact' in report.runner) && !JSON.stringify(report).includes('"contact"'), 'kişisel bilgi içermez');
});

test('takip listesi ve teklif mesajı', async () => {
  const p = dashboard;
  await p.click('#results .card:first-child .actions button[title="Takip listesine ekle"]');
  await p.waitForFunction(() => document.querySelector('#fav-count').textContent === '1');
  await p.click('.tabs button[data-tab=favorites]');
  assert.equal(await p.locator('#favorites .fav').count(), 1);
  await p.selectOption('#favorites .fav select', 'Teklif istendi');
  await p.fill('#favorites .fav textarea', 'Satıcıya yazıldı');
  await p.waitForTimeout(700);
  const favs = await p.evaluate(() => chrome.storage.local.get('favorites'));
  const [fav] = Object.values(favs.favorites);
  assert.equal(fav.status, 'Teklif istendi');
  assert.equal(fav.note, 'Satıcıya yazıldı');
  await p.click('.tabs button[data-tab=results]');
});

test('yeniden açılınca sonuçlar kopyasız yüklenir', async () => {
  const p = dashboard;
  await p.reload();
  await p.waitForSelector('#results .card');
  assert.equal(await cards(), 53);
  const hrefs = await p.$$eval('#results .card a.title', (els) => els.map((a) => a.href));
  assert.equal(new Set(hrefs).size, hrefs.length);
  assert.equal(await p.textContent('#fav-count'), '1', 'takip listesi korunur');
});

test('eklenti simgesinden sayfa toplama kopya üretmez', async () => {
  const page = await ctx.newPage();
  await page.goto(`${srv.base}/dupes`);
  const tabId = await dashboard.evaluate(async (u) => (await chrome.tabs.query({ url: `${u}/dupes` }))[0].id, srv.base);
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html?tab=${tabId}`);
  await popup.click('#capture');
  await popup.waitForFunction(() => /ilan bulundu/.test(document.querySelector('#msg').textContent));
  assert.match(await popup.textContent('#msg'), /6 ilan bulundu; hepsi panelde zaten vardı/);

  // Yeni bir sayfa toplanınca eklenir ve panel güncellenir.
  await page.goto(`${srv.base}/paged/3`);
  await popup.click('#capture');
  await popup.waitForFunction(() => /yeni ilan/.test(document.querySelector('#msg').textContent));
  assert.match(await popup.textContent('#msg'), /4 ilan bulundu, 4 yeni ilan panele eklendi/);
  await dashboard.waitForFunction(() => / \/ 80 ilan/.test(document.querySelector('#result-count').textContent));
  await popup.close();
  await page.close();
});

test('siteler ve ayarlar sekmeleri', async () => {
  const p = dashboard;
  await p.click('.tabs button[data-tab=sites]');
  assert.equal(await p.locator('.site-row').count(), SITES.length);
  await p.click('.tabs button[data-tab=settings]');
  assert.equal(await p.inputValue('select[name=displayCurrency]'), 'USD');
  assert.equal(await p.inputValue('select[name="runner.mode"]'), 'auto');
  assert.equal(await p.inputValue('input[name="runner.maxPages"]'), '2');
  await p.fill('input[name="kktc.maxAgeYears"]', '7');
  await p.click('#settings-form button[type=submit]');
  await p.waitForTimeout(300);
  const { settings } = await p.evaluate(() => chrome.storage.local.get('settings'));
  assert.equal(settings.kktc.maxAgeYears, 7);
  assert.equal(settings.rates.rates.TRY, 40, 'değişmeyen kurlar korunur');
  await p.click('.tabs button[data-tab=results]');
});

test('konsolda hata yok', () => {
  assert.deepEqual(errors, []);
});
