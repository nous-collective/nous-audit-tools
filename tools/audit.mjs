// Doğruluk denetimi: eklentiyle gerçek sitelerde arama yapar, her siteden örnek ilanların
// detay sayfasını açar ve eklentinin okuduğu fiyat / yıl / km / başlığın o sayfada gerçekten
// yazdığını kontrol eder.
//   node tools/audit.mjs [marka] [model] [site başına örnek] [rapor.json]
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const [make = 'Toyota', model = 'Prius', perSite = '5', out = 'audit-report.json'] = process.argv.slice(2);
const extDir = new URL('../extension', import.meta.url).pathname;
const proxy = process.env.HTTPS_PROXY;
const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  ignoreHTTPSErrors: Boolean(proxy),
  args: [
    `--disable-extensions-except=${extDir}`,
    `--load-extension=${extDir}`,
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    ...(proxy ? [`--proxy-server=${proxy}`, '--ignore-certificate-errors'] : []),
  ],
});
let [sw] = ctx.serviceWorkers();
sw ??= await ctx.waitForEvent('serviceworker');
const dash = await ctx.newPage();
await dash.goto(`chrome-extension://${new URL(sw.url()).host}/dashboard.html`);
await dash.evaluate(async () => {
  const { settings = {} } = await chrome.storage.local.get('settings');
  settings.runner = { ...(settings.runner || {}), maxPages: 1, perSite: 20 };
  settings.version = 3;
  await chrome.storage.local.set({ settings });
});
await dash.reload();
await dash.fill('input[name=make]', make);
await dash.fill('input[name=model]', model);
await dash.click('#search-btn');
await dash.waitForTimeout(1500);
await dash.waitForFunction(() => !document.querySelector('#search-btn').disabled, null, { timeout: 20 * 60 * 1000 });
const { results } = await dash.evaluate(() => chrome.storage.local.get('results'));
console.log(`toplam ilan: ${results.length}`);

// Sayının sayfada geçebileceği yazımlar: 11190 → 11,190 / 11.190 / 11 190 / 11190
const variants = (n) => {
  const s = String(Math.round(n));
  const g = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return [s, g, g.replace(/,/g, '.'), g.replace(/,/g, ' '), g.replace(/,/g, ' '), g.replace(/,/g, ' ')];
};
const has = (text, n) => variants(n).some((v) => new RegExp(`(^|[^\\d])${v.replace(/[.]/g, '\\.')}([^\\d]|$)`).test(text));

const bySite = {};
for (const l of results) (bySite[l.siteId] ||= []).push(l);
const report = {};
for (const [site, list] of Object.entries(bySite)) {
  const sample = list.filter((l) => l.url).slice(0, Number(perSite));
  const rows = [];
  for (const l of sample) {
    const p = await ctx.newPage();
    let text = '';
    let status = 'ok';
    try {
      await p.goto(l.url, { waitUntil: 'load', timeout: 45000 });
      await p.waitForTimeout(3000);
      text = await p.evaluate(() => `${document.title}\n${document.body.innerText}`);
      if (/just a moment|verify you are human|security checkpoint|access denied|captcha/i.test(text.slice(0, 2000)) || text.length < 300) status = 'blocked';
    } catch (e) {
      status = `error: ${e.message.slice(0, 60)}`;
    }
    await p.close();
    const check = {};
    if (status === 'ok') {
      if (l.price != null) check.price = has(text, l.price);
      if (l.year) check.year = text.includes(String(l.year));
      if (l.km != null) check.km = has(text, l.km) || has(text, l.km / 1.609344) || has(text, Math.round(l.km / 1.609344)) || has(text, Math.floor(l.km / 1.609344)) || has(text, Math.ceil(l.km / 1.609344));
      const words = l.title.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3).slice(0, 3);
      check.title = words.every((w) => text.toLowerCase().includes(w));
    }
    const bad = Object.entries(check).filter(([, v]) => !v).map(([k]) => k);
    rows.push({ url: l.url, title: l.title, price: l.price, currency: l.currency, year: l.year, month: l.month, km: l.km, status, bad });
  }
  const checked = rows.filter((r) => r.status === 'ok');
  report[site] = { total: list.length, checked: checked.length, wrong: checked.filter((r) => r.bad.length).length, rows };
  const line = `${site.padEnd(16)} ilan ${String(list.length).padStart(3)} | kontrol ${checked.length} | hatalı ${report[site].wrong}`;
  console.log(line + (rows.some((r) => r.status !== 'ok') ? ` | açılamayan ${rows.filter((r) => r.status !== 'ok').length}` : ''));
  for (const r of rows.filter((x) => x.bad.length)) console.log(`   ✗ ${r.bad.join(',')} | ${r.title.slice(0, 40)} | ${r.price} ${r.currency} | ${r.year} | ${r.km} | ${r.url}`);
}
writeFileSync(out, JSON.stringify(report, null, 2));
await ctx.close();
