// Eklentiyi Chromium'a yükleyip varsayılan site ayarlarıyla gerçek sitelerde
// "Siteleri test et" akışını çalıştırır ve raporu kaydeder.
//   node tools/live-test.mjs [çıktı.json]
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const out = process.argv[2] || 'live-test-report.json';
const extDir = new URL('../extension', import.meta.url).pathname;

const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  acceptDownloads: true,
  // Bulut test ortamında dışarı çıkış proxy üzerinden; kendi bilgisayarında gerekmez.
  ignoreHTTPSErrors: Boolean(process.env.HTTPS_PROXY),
  args: [
    `--disable-extensions-except=${extDir}`,
    `--load-extension=${extDir}`,
    // Başsız Chromium kimliğinde "HeadlessChrome" yazar ve bazı siteler bunu bot sayar;
    // kullanıcının gerçek Chrome'unu taklit et.
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    ...(process.env.HTTPS_PROXY ? [`--proxy-server=${process.env.HTTPS_PROXY}`, '--ignore-certificate-errors'] : []),
  ],
});
let [sw] = ctx.serviceWorkers();
sw ??= await ctx.waitForEvent('serviceworker');
const extId = new URL(sw.url()).host;

const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto(`chrome-extension://${extId}/dashboard.html`);
await page.click('.tabs button[data-tab=sites]');
await page.click('#run-site-test');
await page.waitForFunction(() => /sorunsuz çalışıyor/.test(document.querySelector('#site-test-result .test-summary')?.textContent || ''), null, {
  timeout: 15 * 60 * 1000,
});
const [download] = await Promise.all([page.waitForEvent('download'), page.click('#download-site-test')]);
const report = JSON.parse(readFileSync(await download.path(), 'utf8'));
writeFileSync(out, JSON.stringify(report, null, 2));
if (process.env.SCREENSHOT) await page.locator('.site-test').screenshot({ path: process.env.SCREENSHOT });
for (const [id, s] of Object.entries(report.sites)) {
  const m = s.metrics || {};
  console.log(
    id.padEnd(16),
    (m.verdict || s.status.state).padEnd(5),
    `${m.count ?? 0}/${m.matching ?? 0}`.padEnd(8),
    `p${m.pricePct ?? '-'} y${m.yearPct ?? '-'} k${m.kmPct ?? '-'} d${m.duplicates ?? '-'}`.padEnd(22),
    (s.diag?.pages || []).map((p) => p.method).join(','),
    (m.problems || []).join(' | '),
  );
}
await ctx.close();
