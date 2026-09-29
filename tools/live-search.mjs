// Gerçek sitelerde panelden arama yapar, sayfalamayı ve "devamını getir"i dener.
//   node tools/live-search.mjs [marka] [model]
import { chromium } from 'playwright';

const [make = 'Toyota', model = 'Prius'] = process.argv.slice(2);
const extDir = new URL('../extension', import.meta.url).pathname;
const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  ignoreHTTPSErrors: Boolean(process.env.HTTPS_PROXY),
  args: [
    `--disable-extensions-except=${extDir}`,
    `--load-extension=${extDir}`,
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    ...(process.env.HTTPS_PROXY ? [`--proxy-server=${process.env.HTTPS_PROXY}`, '--ignore-certificate-errors'] : []),
  ],
});
let [sw] = ctx.serviceWorkers();
sw ??= await ctx.waitForEvent('serviceworker');
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto(`chrome-extension://${new URL(sw.url()).host}/dashboard.html`);
const idle = () => page.waitForFunction(() => !document.querySelector('#search-btn').disabled, null, { timeout: 20 * 60 * 1000 });
const snap = async (label) => {
  const count = await page.textContent('#result-count');
  const pager = await page.textContent('#pager .pager-info').catch(() => '');
  const chips = await page.$$eval('#site-status > .chip', (els) => els.map((e) => e.textContent.trim()));
  console.log(`--- ${label}\n${count}\n${pager}\n${chips.join('\n')}`);
};
await page.fill('input[name=make]', make);
await page.fill('input[name=model]', model);
const t0 = Date.now();
await page.click('#search-btn');
await page.waitForTimeout(1000);
await idle();
console.log(`arama süresi: ${Math.round((Date.now() - t0) / 1000)} sn`);
await snap('ilk tur');
const prices = await page.$$eval('#results .card', (els) => els.slice(0, 8).map((c) => `${c.querySelector('.price')?.textContent.trim().replace(/\s+/g, ' ')} | ${c.querySelector('.badges .badge')?.textContent} | ${c.querySelector('a.title')?.textContent.slice(0, 50)}`));
console.log('ilk sayfanın başı:\n ' + prices.join('\n '));
// Son sayfaya git → sitelerden devamı gelsin.
const lastBtn = page.locator('#pager .pager-buttons button:not(:has-text("Önceki")):not(:has-text("Sonraki")):not(:has-text("getir"))').last();
await lastBtn.click();
await page.waitForTimeout(1000);
const t1 = Date.now();
await idle();
console.log(`devam süresi: ${Math.round((Date.now() - t1) / 1000)} sn`);
await snap('son sayfaya geçince');
await ctx.close();
