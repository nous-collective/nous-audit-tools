// Kaydedilmiş bir HTML dosyasını eklentinin okuyucusuyla (indirme modu) okur.
//   node tools/scrape-file.mjs dosya.html https://asıl.adres/ [siteId]
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { toListings } from '../extension/src/normalize.js';
import { SITES } from '../extension/src/sites.js';

const [file, url, siteId] = process.argv.slice(2);
const html = readFileSync(file, 'utf8');
const scraper = readFileSync(new URL('../extension/src/scraper.js', import.meta.url), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');
await page.addScriptTag({ content: scraper });
const raw = await page.evaluate(async ([h, u]) => {
  const doc = new DOMParser().parseFromString(h, 'text/html');
  return globalThis.__kktcScraper.run({ doc, baseUrl: u });
}, [html, url]);
await browser.close();
const site = SITES.find((s) => s.id === siteId) || null;
const items = toListings(raw.items, site, url);
console.log('title:', raw.title, '| blocked:', raw.blocked, '| raw:', raw.items.length, '| listings:', items.length, '| next:', raw.next);
for (const g of raw.diag.groups || []) console.log('  grp', g.signature, g.total, g.good, g.score, '|', g.sampleText.slice(0, 140));
for (const l of items.slice(0, Number(process.env.N || 6))) console.log(' -', l.title.slice(0, 70), '|', l.price, l.currency, '|', l.year, l.month, '|', l.km, '|', l.url);
