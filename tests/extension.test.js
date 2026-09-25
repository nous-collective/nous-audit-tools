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
    args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
  });
  let [sw] = ctx.serviceWorkers();
  sw ??= await ctx.waitForEvent('serviceworker');
  extId = new URL(sw.url()).host;

  // Ayarlar: yalnızca yerel örnek sayfalara giden 5 site açık, kurlar elle.
  const setup = await ctx.newPage();
  await setup.goto(`chrome-extension://${extId}/popup.html`);
  const b = srv.base;
  const siteOverrides = Object.fromEntries(SITES.map((s) => [s.id, { enabled: false }]));
  Object.assign(siteOverrides, {
    sbt: { enabled: true, template: `${b}/jp-grid?make={make|slug}&model={model|slug}` },
    goonet: { enabled: true, template: `${b}/yen-table?make={make|upper}` },
    autotrader: { enabled: true, template: `${b}/uk-cards?make={make|enc}[&price-to={priceMax}]` },
    tcv: { enabled: true, template: `${b}/blocked?make={make}` },
    cinch: { enabled: true, template: `${b}/empty?make={make}` },
    carwow: { enabled: true, template: `${b}/uk-cards?needs={make}&{keyword}` },
  });
  await setup.evaluate(
    (s) => chrome.storage.local.set({ settings: s }),
    {
      displayCurrency: 'USD',
      rates: { rates: { USD: 1, TRY: 40, GBP: 0.8, EUR: 0.9, JPY: 150 }, updatedAt: new Date().toISOString(), source: 'manuel', manual: true },
      costs: { shippingJP: { amount: 1500, currency: 'USD' }, shippingUK: { amount: 800, currency: 'GBP' }, insurancePct: 1, taxPct: 50, fixedFees: { amount: '', currency: 'TRY' } },
      runner: { mode: 'background', concurrency: 3, settleMs: 300, timeoutMs: 15000 },
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

test('panelden tüm sitelerde arama', async () => {
  const p = dashboard;
  await p.fill('input[name=make]', 'Toyota');
  await p.fill('input[name=model]', 'Prius');
  await p.click('#search-btn');
  await p.waitForFunction(() => document.querySelector('#search-btn').textContent === 'Tüm sitelerde ara' && !document.querySelector('#search-btn').disabled, null, { timeout: 60000 });

  const chips = await p.$$eval('#site-status .chip', (els) => els.map((e) => [e.className.replace('chip st-', ''), e.textContent]));
  const byState = Object.fromEntries(chips.map(([s, t]) => [t.split(':')[0].replace(/^\S+\s/, '').trim(), s]));
  assert.equal(byState['SBT Japan'], 'done');
  assert.equal(byState['Goo-net Exchange'], 'done');
  assert.equal(byState['AutoTrader UK'], 'done');
  assert.equal(byState['TCV (tradecarview)'], 'blocked');
  assert.equal(byState['cinch'], 'empty');
  assert.equal(byState['Carwow'], 'skipped', 'zorunlu {keyword} boş olduğu için atlanır');

  // 20 (JP ızgara) + 8 (yen tablo) + 12 (UK). 3 kartlık küçük promosyon şeridi ana listeye göre
  // çok zayıf puan aldığı için alınmaz.
  const count = await p.textContent('#result-count');
  assert.match(count, /toplam 40\)/);
  assert.equal(await p.locator('#results .card').count(), 40);

  // Varsayılan sıralama: fiyat artan (USD'ye çevrilmiş). Yen tablo en ucuz 1.170.000 JPY = 7800 USD,
  // UK en ucuz 9000 GBP = 11250 USD; JP ızgara 5000 USD en ucuz.
  const firstPrice = await p.textContent('#results .card:first-child .price');
  assert.match(firstPrice, /5\.000/);

  // Tahmini maliyet: 5000 + 1500 + %1 sigorta (65) = 6565 CIF, %50 vergi → 9847,5
  const cost = await p.textContent('#results .card:first-child .cost');
  assert.match(cost, /9\.84[78]/);

  if (process.env.SCREENSHOT_DIR) {
    await p.setViewportSize({ width: 1400, height: 900 });
    await p.screenshot({ path: join(process.env.SCREENSHOT_DIR, 'panel.png') });
    await p.emulateMedia({ colorScheme: 'dark' });
    await p.screenshot({ path: join(process.env.SCREENSHOT_DIR, 'panel-dark.png') });
    await p.emulateMedia({ colorScheme: 'light' });
    await p.setViewportSize({ width: 390, height: 844 });
    await p.screenshot({ path: join(process.env.SCREENSHOT_DIR, 'panel-mobile.png') });
    await p.setViewportSize({ width: 1400, height: 900 });
  }
});

test('filtreler', async () => {
  const p = dashboard;
  await p.selectOption('[data-f=country]', 'UK');
  assert.equal(await p.locator('#results .card').count(), 12);
  await p.selectOption('[data-f=country]', 'JP');
  assert.equal(await p.locator('#results .card').count(), 28);
  await p.fill('[data-f=yearMin]', '2020');
  // JP ızgara: 2015+(i%9) ≥ 2020 → i ∈ {5,6,7,8,14,15,16,17}; yen tablo 2018+(i%5) ≥ 2020 → i ∈ {2,3,4,7}
  assert.equal(await p.locator('#results .card').count(), 12);
  await p.selectOption('[data-f=age]', 'ok');
  const ages = await p.$$eval('#results .card .badge.ok, #results .card .badge.risky, #results .card .badge.no', (els) => els.map((e) => e.className));
  assert.ok(ages.every((c) => c.includes('ok')));
  await p.click('#reset-filters');
  assert.equal(await p.locator('#results .card').count(), 40);
  await p.fill('[data-f=text]', 'business edition');
  assert.equal(await p.locator('#results .card').count(), 12);
  await p.click('#reset-filters');
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

test('siteler ve ayarlar sekmeleri açılır', async () => {
  const p = dashboard;
  await p.click('.tabs button[data-tab=sites]');
  assert.equal(await p.locator('.site-row').count(), SITES.length);
  await p.click('.tabs button[data-tab=settings]');
  assert.equal(await p.inputValue('select[name=displayCurrency]'), 'USD');
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
