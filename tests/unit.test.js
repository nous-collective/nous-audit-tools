import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildUrl, buildFirstUrl, missingFields, requiredFields, searchVars } from '../extension/src/template.js';
import {
  parsePrice,
  pickPrices,
  parseYearMonth,
  parseMileageKm,
  parseTransmission,
  parseFuel,
  detectMake,
  cleanUrl,
  toListing,
  toListings,
  listingKey,
  dedupeListings,
  PRICE_PATTERN,
} from '../extension/src/normalize.js';
import { normalizeQuery, matchesQuery } from '../extension/src/query.js';
import { ageStatus, landedCost, inquiryMessage } from '../extension/src/kktc.js';
import { makeConverter } from '../extension/src/currency.js';
import { SITES, siteForUrl, applySiteOverrides } from '../extension/src/sites.js';

const vars = (o) => ({ make: '', model: '', keyword: '', q: '', yearFrom: '', yearTo: '', priceMin: '', priceMax: '', kmMax: '', milesMax: '', postcode: '', ...o });
const site = (id) => SITES.find((s) => s.id === id);
const url = (id, v) => buildFirstUrl(site(id).templates, v);

test('şablon: doğrulanmış site URL yapıları', () => {
  const v = vars({ make: 'Toyota', model: 'Prius', q: 'Toyota Prius' });
  assert.equal(url('beforward', v), 'https://www.beforward.jp/stocklist/keyword=Toyota%20Prius');
  assert.equal(url('sbt', v), 'https://www.sbtjapan.com/used-cars/toyota/prius/');
  assert.equal(url('carfromjapan', v), 'https://carfromjapan.com/cheap-used-toyota-prius-for-sale');
  assert.equal(url('tcv', v), 'https://www.tc-v.com/used_car/toyota/prius/');
  assert.equal(url('goonet', v), 'https://www.goo-net-exchange.com/usedcars/TOYOTA/PRIUS/');
  assert.equal(url('realmotor', v), 'https://www.realmotor.jp/stock/TOYOTA/PRIUS');
  assert.equal(url('picknbuy24', v), 'https://www.picknbuy24.com/usedcar/?maker=toyota&model=prius');
  assert.equal(url('cardealpage', v), 'https://www.cardealpage.com/toyota/prius/');
  assert.equal(url('carjunction', v), 'https://www.carjunction.com/make/toyota/prius.html');
  assert.equal(url('satjapan', v), 'https://satjapan.com/used-cars/mk_toyota/md_prius');
  assert.equal(url('trust', v), 'https://japanesevehicles.com/stocklist?maker=TOYOTA&model=PRIUS');
  assert.equal(url('trust', vars({ make: 'Toyota', q: 'Toyota' })), 'https://japanesevehicles.com/stocklist?maker=TOYOTA');
  assert.equal(url('autorec', v), 'https://www.autorec.co.jp/used-cars-list.php?Sort=1&post_maker=TOYOTA');
  assert.equal(url('autotrader', v), 'https://www.autotrader.co.uk/cars/used/toyota/prius');
  assert.equal(url('ebay', v), 'https://www.ebay.co.uk/sch/i.html?_sacat=9801&_nkw=Toyota+Prius');
  assert.equal(url('gumtree', v), 'https://www.gumtree.com/cars-vans-motorbikes/cars/toyota/prius');
  assert.equal(url('motors', v), 'https://www.cazoo.co.uk/cars/toyota/prius/');
  assert.equal(url('pistonheads', v), 'https://www.pistonheads.com/buy/toyota/prius');
  assert.equal(url('cinch', v), 'https://www.cinch.co.uk/used-cars/toyota/prius');
  assert.equal(url('carwow', v), 'https://www.carwow.co.uk/toyota/prius/used');
  assert.equal(url('exchangeandmart', v), 'https://www.exchangeandmart.co.uk/used-cars-for-sale/toyota/prius');
  assert.equal(url('copart', v), 'https://www.copart.co.uk/lotSearchResults/?free=true&query=Toyota+Prius');
});

test('şablon: BE FORWARD yıl ve fiyat filtreleri', () => {
  const v = vars({ make: 'Toyota', model: 'Prius', q: 'Toyota Prius', yearFrom: 2021, yearTo: 2023, priceMax: 9000 });
  assert.equal(url('beforward', v), 'https://www.beforward.jp/stocklist/keyword=Toyota%20Prius/mfg_year_from=2021/mfg_year_to=2023/fob_price_to=9000');
});

test('şablon: çok kelimeli modeller', () => {
  const v = vars({ make: 'Toyota', model: 'Prius PHV', q: 'Toyota Prius PHV' });
  assert.equal(url('goonet', v), 'https://www.goo-net-exchange.com/usedcars/TOYOTA/PRIUS_PHV/');
  assert.equal(url('tcv', v), 'https://www.tc-v.com/used_car/toyota/prius%20phv/');
  assert.equal(url('sbt', v), 'https://www.sbtjapan.com/used-cars/toyota/prius-phv/');
  assert.equal(url('picknbuy24', v), 'https://www.picknbuy24.com/usedcar/?maker=toyota&model=prius+phv');
  assert.equal(url('realmotor', v), 'https://www.realmotor.jp/stock/TOYOTA/PRIUS%20PHV');
  const lr = vars({ make: 'Land Rover', model: 'Range Rover Evoque', q: 'Land Rover Range Rover Evoque' });
  assert.equal(url('motors', lr), 'https://www.cazoo.co.uk/cars/land-rover/range-rover-evoque/');
});

test('şablon: model yoksa yalnızca markayla arayan şablona düşer (site atlanmaz)', () => {
  const onlyMake = vars({ make: 'Nissan', q: 'Nissan' });
  assert.equal(url('sbt', onlyMake), 'https://www.sbtjapan.com/used-cars/nissan/');
  assert.equal(url('carfromjapan', onlyMake), 'https://carfromjapan.com/cheap-used-nissan-for-sale');
  assert.equal(url('carjunction', onlyMake), 'https://www.carjunction.com/make/nissan.html');
  assert.equal(url('carwow', onlyMake), 'https://www.carwow.co.uk/nissan/used');
  assert.equal(url('autotrader', onlyMake), 'https://www.autotrader.co.uk/cars/used/nissan');
  assert.equal(url('sbt', vars({})), null, 'marka yoksa aranamaz');
  assert.deepEqual(missingFields(site('carjunction').templates, vars({})), ['make']);
  assert.deepEqual(requiredFields('https://x/{make}/{model}[/{yearFrom}]/{make}'), ['make', 'model']);

  // Her otomatik site en azından marka + model ile URL üretebilmeli.
  const full = vars({ make: 'Toyota', model: 'Prius', q: 'Toyota Prius' });
  for (const s of SITES.filter((x) => x.templates.length)) assert.ok(buildFirstUrl(s.templates, full), s.id);
  assert.equal(buildUrl('https://x/?q={q|plus}[&max={priceMax}]', vars({ q: 'a b', priceMax: 5 })), 'https://x/?q=a+b&max=5');
  assert.throws(() => buildUrl('https://x/{make|nope}', vars({ make: 'a' })), /değiştirici/);
});

test('şablon: fiyat sitenin para birimine çevrilir', () => {
  const convert = makeConverter({ USD: 1, TRY: 40, GBP: 0.8, EUR: 0.9, JPY: 150 });
  const v = searchVars({ make: 'Toyota', model: 'Prius', priceMax: '400000', kmMax: '100000', currency: 'TRY' }, site('sbt'), convert);
  assert.equal(v.priceMax, 10000);
  assert.equal(v.milesMax, 62137);
  assert.equal(v.q, 'Toyota Prius');
  const g = searchVars({ make: 'Toyota', priceMax: '400000', currency: 'TRY' }, site('goonet'), convert);
  assert.equal(g.priceMax, 1500000);
});

test('fiyat ayrıştırma', () => {
  assert.deepEqual(parsePrice('US$11,190'), { amount: 11190, currency: 'USD' });
  assert.deepEqual(parsePrice('FOB US$ 4,760'), { amount: 4760, currency: 'USD' });
  assert.deepEqual(parsePrice('£12,995'), { amount: 12995, currency: 'GBP' });
  assert.deepEqual(parsePrice('¥1,170,000'), { amount: 1170000, currency: 'JPY' });
  assert.deepEqual(parsePrice('1,170,000 JPY'), { amount: 1170000, currency: 'JPY' });
  assert.deepEqual(parsePrice('229.5万円'), { amount: 2295000, currency: 'JPY' });
  assert.deepEqual(parsePrice('€ 9.500'), { amount: 9500, currency: 'EUR' });
  assert.deepEqual(parsePrice('$ 12345.50'), { amount: 12345.5, currency: 'USD' });
  assert.equal(parsePrice('ASK'), null);
  assert.equal(parsePrice('Price on request'), null);
});

test('fiyat seçimi: toplam/CIF ve taksit ayrımı', () => {
  const r = pickPrices([
    { text: 'US$11,190', label: 'Price ' },
    { text: 'US$13,500', label: 'Total Price ' },
  ]);
  assert.deepEqual(r.price, { amount: 11190, currency: 'USD' });
  assert.deepEqual(r.total, { amount: 13500, currency: 'USD' });
  const uk = pickPrices([
    { text: '£199', label: 'from ' },
    { text: '£13,495', label: 'was ' },
    { text: '£12,995', label: '' },
  ]);
  assert.equal(uk.price.amount, 12995, '"from £199" taksit, "was" eski fiyat');
  const uk2 = pickPrices([
    { text: '£199', label: 'Toyota Prius ', after: ' per month' },
    { text: '£12,995', label: 'Business Edition ', after: ' 2019' },
  ]);
  assert.equal(uk2.price.amount, 12995, 'fiyattan sonra gelen "per month" taksittir');
  const nowWas = pickPrices([
    { text: '£13,495', label: 'was ' },
    { text: '£12,995', label: 'was £13,495 now ' },
  ]);
  assert.equal(nowWas.price.amount, 12995);
  const onlyTotal = pickPrices([{ text: 'US$9,000', label: 'Total price' }]);
  assert.equal(onlyTotal.price.amount, 9000);
  assert.equal(onlyTotal.total, null);
});

test('yıl/ay, km, vites, yakıt, marka', () => {
  assert.deepEqual(parseYearMonth('2019/Dec Toyota Prius'), { year: 2019, month: 12 });
  assert.deepEqual(parseYearMonth('Toyota Prius 2021/3'), { year: 2021, month: 3 });
  assert.deepEqual(parseYearMonth('2019 (19 reg) Hatchback'), { year: 2019, month: null });
  assert.deepEqual(parseYearMonth('2019 12 months MOT'), { year: 2019, month: null });
  assert.deepEqual(parseYearMonth('no year', 'Reg 2016 Sep'), { year: 2016, month: 9 });
  assert.deepEqual(parseYearMonth('Toyota Prius'), { year: null, month: null });
  assert.equal(parseYearMonth('Model 2099').year, null);

  assert.equal(parseMileageKm('Mileage 45,000km'), 45000);
  assert.equal(parseMileageKm('45,210 miles'), 72758);
  assert.equal(parseMileageKm('62k miles'), 99779);
  assert.equal(parseMileageKm('7300 km'), 7300);
  assert.equal(parseMileageKm('no mileage'), null);

  assert.equal(parseTransmission('Trans. AT'), 'automatic');
  assert.equal(parseTransmission('Automatic'), 'automatic');
  assert.equal(parseTransmission('available at our dealership'), null);
  assert.equal(parseTransmission('6 speed Manual'), 'manual');
  assert.equal(parseFuel('Hybrid(Petrol)'), 'hybrid');
  assert.equal(parseFuel('Plug-in Hybrid'), 'plug-in');
  assert.equal(parseFuel('Diesel'), 'diesel');

  assert.equal(detectMake('2019 TOYOTA PRIUS S'), 'Toyota');
  assert.equal(detectMake('Mercedes C200 AMG Line'), 'Mercedes-Benz');
  assert.equal(detectMake('Range Rover Evoque'), 'Land Rover');
  assert.equal(detectMake('VW Golf'), 'Volkswagen');
  assert.equal(detectMake('Mini Cooper'), 'Mini');
  assert.equal(detectMake('Something else'), null);
});

test('URL temizleme', () => {
  assert.equal(cleanUrl('https://x.com/car/1?utm_source=a&id=5#top'), 'https://x.com/car/1?id=5');
  assert.equal(cleanUrl('javascript:alert(1)'), null);
  assert.equal(cleanUrl('not a url'), null);
});

test('ilan dönüştürme', () => {
  const l = toListing(
    {
      url: 'https://www.sbtjapan.com/used-cars/toyota/prius/DP4248/',
      title: '2019 TOYOTA PRIUS S',
      image: 'https://img.sbtjapan.com/1.jpg',
      priceTexts: [{ text: 'US$11,190', label: 'Price' }],
      text: '2019/5 TOYOTA PRIUS S Mileage 45,000km 1,800cc AT Hybrid RHD',
    },
    site('sbt'),
  );
  assert.equal(l.price, 11190);
  assert.equal(l.currency, 'USD');
  assert.equal(l.year, 2019);
  assert.equal(l.month, 5, 'yıl başlıktan, ay metinden');
  assert.equal(l.km, 45000);
  assert.equal(l.engineCc, 1800);
  assert.equal(l.transmission, 'automatic');
  assert.equal(l.fuel, 'hybrid');
  assert.equal(l.steering, 'RHD');
  assert.equal(l.make, 'Toyota');
  assert.equal(l.country, 'JP');
  assert.equal(l.siteId, 'sbt');

  const bad = toListing({ url: 'https://x.com/1', title: 't', image: 'javascript:alert(1)', priceTexts: [], text: '' }, null);
  assert.equal(bad.image, null, 'http(s) olmayan görsel reddedilir');
  assert.equal(bad.siteId, 'host:x.com');
});

test('KKTC yaş kontrolü', () => {
  const now = new Date(2026, 8, 25); // 25 Eylül 2026, varış ~Kasım 2026, sınır Kasım 2021
  const opts = { maxAgeYears: 5, shippingMonths: 2, now };
  assert.equal(ageStatus({ year: 2023 }, opts), 'ok');
  assert.equal(ageStatus({ year: 2022, month: 6 }, opts), 'ok');
  assert.equal(ageStatus({ year: 2021, month: 12 }, opts), 'risky', 'sınıra 2 aydan az pay');
  assert.equal(ageStatus({ year: 2021 }, opts), 'risky', 'ay bilinmiyor');
  assert.equal(ageStatus({ year: 2021, month: 3 }, opts), 'no');
  assert.equal(ageStatus({ year: 2019 }, opts), 'no');
  assert.equal(ageStatus({ year: null }, opts), 'unknown');
});

test('tahmini maliyet', () => {
  const convert = makeConverter({ USD: 1, TRY: 40, GBP: 0.8, EUR: 0.9, JPY: 150 });
  const settings = {
    displayCurrency: 'USD',
    costs: {
      shippingJP: { amount: 1500, currency: 'USD' },
      shippingUK: { amount: 800, currency: 'GBP' },
      insurancePct: 1,
      taxPct: 50,
      fixedFees: { amount: 4000, currency: 'TRY' },
    },
  };
  const c = landedCost({ price: 10000, currency: 'USD', country: 'JP' }, settings, convert);
  assert.equal(c.shipping, 1500);
  assert.equal(c.insurance, 115);
  assert.equal(c.tax, 5807.5);
  assert.equal(c.fees, 100);
  assert.equal(c.total, 17522.5);
  const uk = landedCost({ price: 8000, currency: 'GBP', country: 'UK' }, settings, convert);
  assert.equal(uk.price, 10000);
  assert.equal(uk.shipping, 1000);
  assert.equal(landedCost({ price: 1, currency: 'USD' }, { ...settings, costs: { ...settings.costs, taxPct: '' } }, convert), null, 'vergi oranı yoksa tahmin yok');
  assert.equal(landedCost({ price: null, currency: null }, settings, convert), null);
});

test('teklif mesajı', () => {
  const jp = inquiryMessage({ title: 'TOYOTA PRIUS', url: 'https://a/1', country: 'JP' }, { name: 'Ali', email: 'a@b.c' });
  assert.match(jp, /Famagusta/);
  assert.match(jp, /Ali\na@b\.c$/);
  const uk = inquiryMessage({ title: 'Prius', url: 'https://b/2', country: 'UK' }, {});
  assert.match(uk, /V5C/);
});

test('siteler: URL eşleme ve ayarlar', () => {
  assert.equal(siteForUrl('https://www.beforward.jp/stocklist')?.id, 'beforward');
  assert.equal(siteForUrl('https://sp.beforward.jp/x')?.id, 'beforward');
  assert.equal(siteForUrl('https://carfromjapan.com/x')?.id, 'carfromjapan');
  assert.equal(siteForUrl('https://www.satjapan.com/used-cars/toyota/prius/sat-1')?.id, 'satjapan');
  assert.equal(siteForUrl('https://example.com/'), null);
  const ids = SITES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'site kimlikleri benzersiz');

  const s = applySiteOverrides({
    sbt: { enabled: false },
    japancardirect: { templates: ['https://www.japancardirect.com/?q={q|enc}'] },
    gumtree: { templates: [] },
    cinch: { template: 'https://old/{make}' }, // eski sürümün tek şablon kaydı
  });
  assert.equal(s.find((x) => x.id === 'sbt').enabled, false);
  assert.deepEqual(s.find((x) => x.id === 'japancardirect').templates, ['https://www.japancardirect.com/?q={q|enc}']);
  assert.equal(s.find((x) => x.id === 'japancardirect').enabled, true);
  assert.deepEqual(s.find((x) => x.id === 'gumtree').templates, []);
  assert.equal(s.find((x) => x.id === 'gumtree').enabled, false);
  assert.deepEqual(s.find((x) => x.id === 'cinch').templates, ['https://old/{make}']);
  assert.equal(s.find((x) => x.id === 'cargurus').enabled, false, 'şablonsuz site varsayılan kapalı');
});

test('ilan kimliği: aynı ilana giden farklı bağlantılar tek anahtar', () => {
  const same = (a, b) => assert.equal(listingKey(a), listingKey(b), `${a} ≠ ${b}`);
  const diff = (a, b) => assert.notEqual(listingKey(a), listingKey(b), `${a} = ${b}`);
  same('https://www.cardealpage.com/toyota/prius/241748446/?refkey=774441d3', 'https://www.cardealpage.com/toyota/prius/241748446/');
  same('https://www.cardealpage.com/toyota/prius/241748446', 'http://cardealpage.com/toyota/prius/241748446/');
  same('https://sp.beforward.jp/toyota/prius/bf123/id/456/', 'https://www.beforward.jp/toyota/prius/bf123/id/456/');
  same('https://www.autotrader.co.uk/car-details/202409011234567?sort=relevance&advertising-location=at_cars&position=3', 'https://www.autotrader.co.uk/car-details/202409011234567');
  same('https://www.realmotor.jp/stock_detail?id=85839&form=2&maker=43&model=&year_from=', 'https://www.realmotor.jp/stock_detail?maker=43&id=85839');
  same('https://www.goo-net-exchange.com/usedcars/TOYOTA/PRIUS/963026030309800108005/', 'https://www.goo-net-exchange.com/usedcars/toyota/prius/963026030309800108005');
  same('https://www.ebay.co.uk/itm/1234567890?_trkparms=x&hash=item1', 'https://www.ebay.co.uk/itm/1234567890');
  diff('https://www.picknbuy24.com/detail/?refno=0122222081', 'https://www.picknbuy24.com/detail/?refno=0122222082');
  diff('https://www.autorec.co.jp/car-detail.php?refno=18107PT07', 'https://www.autorec.co.jp/car-detail.php?refno=18107PT08');
  diff('https://x.com/vehicle?v=12', 'https://x.com/vehicle?v=13');
  diff('https://www.sbtjapan.com/used-cars/toyota/prius/DP4248/', 'https://www.sbtjapan.com/used-cars/toyota/prius/DP4249/');
});

test('kopya ayıklama: bağlantı ve içerik', () => {
  const site = { id: 'cdp', name: 'CDP', country: 'JP' };
  const raws = [
    { url: 'https://www.cardealpage.com/toyota/prius/1001/?refkey=a', title: '2018 TOYOTA PRIUS', priceTexts: [{ text: 'US$15,490' }], text: '2018 45,000 km' },
    { url: 'https://www.cardealpage.com/toyota/prius/1001/', title: '2018 TOYOTA PRIUS', image: 'https://img/1.jpg', priceTexts: [{ text: 'US$15,490' }], text: '2018 45,000 km AT' },
    // Mobil kopya: farklı bağlantı, aynı başlık/fiyat/yıl/km
    { url: 'https://m.example.com/car?view=mobile&c=1001', title: '2018 Toyota Prius', priceTexts: [{ text: 'US$15,490' }], text: '2018 45,000 km' },
    { url: 'https://www.cardealpage.com/toyota/prius/1002/', title: '2018 TOYOTA PRIUS', priceTexts: [{ text: 'US$15,990' }], text: '2018 38,000 km' },
  ];
  const out = toListings(raws, site, 'https://www.cardealpage.com/toyota/prius/');
  assert.equal(out.length, 2);
  const a = out.find((l) => l.price === 15490);
  assert.equal(a.image, 'https://img/1.jpg', 'kopyadaki eksik alanlar birleştirilir');
  assert.equal(a.transmission, 'automatic');
  assert.equal(a.url, 'https://www.cardealpage.com/toyota/prius/1001/', 'parametresiz bağlantı tercih edilir');

  // Fiyatı ya da yılı/km'si olmayan ilanlar yalnızca bağlantıyla birleştirilir (yanlışlıkla birleşmez).
  const noPrice = dedupeListings([
    { id: 'a', siteId: 's', title: 'Toyota Prius', price: null, year: 2018, km: null, url: 'https://a' },
    { id: 'b', siteId: 's', title: 'Toyota Prius', price: null, year: 2018, km: null, url: 'https://b' },
  ]);
  assert.equal(noPrice.length, 2);
  // Farklı sitelerdeki aynı araç ayrı kalır.
  const cross = dedupeListings([
    { id: 'a', siteId: 's1', title: 'Toyota Prius', price: 1, currency: 'USD', year: 2018, km: 5, url: 'https://a' },
    { id: 'b', siteId: 's2', title: 'Toyota Prius', price: 1, currency: 'USD', year: 2018, km: 5, url: 'https://b' },
  ]);
  assert.equal(cross.length, 2);
});

test('TL fiyatları ve fiyat kalıbı senkronu', () => {
  assert.deepEqual(parsePrice('₺1.250.000'), { amount: 1250000, currency: 'TRY' });
  assert.deepEqual(parsePrice('850.000 TL'), { amount: 850000, currency: 'TRY' });
  assert.deepEqual(parsePrice('JP¥1,170,000'), { amount: 1170000, currency: 'JPY' });
  assert.equal(parsePrice('Model 2019 TLC'), null);
  const scraper = readFileSync(new URL('../extension/src/scraper.js', import.meta.url), 'utf8');
  const src = scraper.match(/const PRICE_SRC =\s*"((?:[^"\\]|\\.)*)"/)[1];
  assert.equal(JSON.parse(`"${src}"`), PRICE_PATTERN, 'scraper.js PRICE_SRC ile normalize.js PRICE_PATTERN aynı olmalı');
});

test('sorgu düzeltme: marka/model çıkarımı', () => {
  const n = (f) => normalizeQuery({ make: '', model: '', keyword: '', ...f }).form;
  assert.deepEqual(pick(n({ model: 'prius' })), { make: 'Toyota', model: 'Prius', keyword: '' });
  assert.deepEqual(pick(n({ make: 'toyota prius' })), { make: 'Toyota', model: 'Prius', keyword: '' });
  assert.deepEqual(pick(n({ make: 'TOYOTA', model: 'toyota c-hr' })), { make: 'Toyota', model: 'C-HR', keyword: '' });
  assert.deepEqual(pick(n({ keyword: 'toyota chr hybrid' })), { make: 'Toyota', model: 'C-HR', keyword: 'hybrid' });
  assert.deepEqual(pick(n({ keyword: 'nissan note e-power' })), { make: 'Nissan', model: 'Note e-Power', keyword: '' });
  assert.deepEqual(pick(n({ make: 'mercedes c200' })), { make: 'Mercedes-Benz', model: 'C200', keyword: '' });
  assert.deepEqual(pick(n({ make: 'bmw', model: 'x5' })), { make: 'BMW', model: 'X5', keyword: '' });
  assert.deepEqual(pick(n({ model: 'range rover evoque' })), { make: 'Land Rover', model: 'Range Rover Evoque', keyword: '' });
  assert.deepEqual(pick(n({ make: 'Honda', model: 'vezel' })), { make: 'Honda', model: 'Vezel', keyword: '' });
  assert.deepEqual(pick(n({ keyword: 'this is fine' })), { make: '', model: '', keyword: 'this is fine' }, '"is" Lexus IS sayılmaz');
  assert.deepEqual(pick(n({ make: 'Toyota', model: 'rav4' })), { make: 'Toyota', model: 'RAV4', keyword: '' });
  assert.deepEqual(pick(n({ make: 'Suzuki', model: 'wagon r' })), { make: 'Suzuki', model: 'Wagon R', keyword: '' });
  assert.deepEqual(normalizeQuery({ make: '', model: 'prius', keyword: '' }).inferred, ['make']);
});
const pick = ({ make, model, keyword }) => ({ make, model, keyword });

test('arama eşleşmesi', () => {
  const q = { make: 'Toyota', model: 'C-HR' };
  assert.ok(matchesQuery({ title: '2019 TOYOTA C-HR G', make: 'Toyota' }, q));
  assert.ok(matchesQuery({ title: 'Toyota CHR Hybrid', make: 'Toyota' }, q));
  assert.ok(!matchesQuery({ title: '2019 Toyota Prius', make: 'Toyota' }, q));
  assert.ok(!matchesQuery({ title: '2019 Lexus UX C-HR based', make: 'Lexus' }, q));
  assert.ok(matchesQuery({ title: 'C-HR 1.8 Excel', make: null }, q), 'başlıkta marka yazmayan ilan modelle eşleşir');
  assert.ok(matchesQuery({ title: 'Anything' }, null));
  assert.ok(matchesQuery({ title: '2020 TOYOTA PRIUS S', make: 'Toyota' }, { make: 'Toyota', model: '' }));
});

test('manifest izinleri tüm siteleri kapsar', () => {
  const manifest = JSON.parse(readFileSync(new URL('../extension/manifest.json', import.meta.url), 'utf8'));
  const covers = (host) =>
    manifest.host_permissions.some((p) => {
      const m = p.match(/^\*:\/\/\*\.([^/]+)\/\*$/);
      return m && (host === m[1] || host.endsWith(`.${m[1]}`));
    });
  for (const s of SITES) {
    const hosts = [s.home, ...s.templates.map((t) => t.replace(/\{[^}]*\}/g, 'x').replace(/[[\]]/g, ''))].map((u) => new URL(u).hostname);
    for (const h of hosts) assert.ok(covers(h), `${s.id}: ${h} manifest'te yok`);
  }
});

test('site testi değerlendirmesi', async () => {
  const { evaluateSite, suspectedDuplicates } = await import('../extension/src/sitetest.js');
  const L = (i, o = {}) => ({ title: `2019 TOYOTA PRIUS S ${i}`, price: 5000 + i, currency: 'USD', year: 2019, km: 1000 * i, image: 'https://i', make: 'Toyota', ...o });
  const good = evaluateSite([L(1), L(2), L(3), L(4)], { state: 'done' });
  assert.equal(good.verdict, 'ok');
  assert.equal(good.matching, 4);
  assert.equal(good.pricePct, 100);

  const dup = evaluateSite([L(1), L(1), L(2), L(3)], { state: 'done' });
  assert.equal(dup.duplicates, 1);
  assert.equal(dup.verdict, 'warn');

  const noPrice = evaluateSite([L(1, { price: null }), L(2, { price: null }), L(3, { price: null })], { state: 'done' });
  assert.deepEqual(noPrice.problems, ['Fiyatların çoğu okunamadı']);

  const wrong = evaluateSite([L(1, { title: 'Honda Fit', make: 'Honda' }), L(2, { title: 'Honda Fit 2', make: 'Honda' }), L(3, { title: 'Mazda', make: 'Mazda' })], { state: 'done' });
  assert.ok(wrong.problems.includes('Aranan araçla eşleşen ilan az'));

  const none = evaluateSite([], { state: 'blocked', message: 'robot' });
  assert.equal(none.verdict, 'fail');
  assert.deepEqual(none.problems, ['robot']);
  assert.equal(suspectedDuplicates([L(1, { price: null }), L(1, { price: null })]), 0);
});

test('canlı sitelerden çıkan düzeltmeler', () => {
  // PicknBuy24: gömülü veride büyük harfli marka
  const l = toListing({ url: 'https://www.picknbuy24.com/detail/?refno=1', title: '2011 TOYOTA PRIUS L', structured: { make: 'TOYOTA', price: 1160, currency: 'USD' }, priceTexts: [], text: '' }, { id: 'p', country: 'JP' });
  assert.equal(l.make, 'Toyota');
  assert.ok(matchesQuery(l, { make: 'Toyota', model: 'Prius' }));
  assert.ok(matchesQuery({ title: 'x prius', make: 'TOYOTA' }, { make: 'Toyota', model: 'Prius' }));
  // Copart: "Lot info" başlığı yerine adresteki araç adı
  const c = toListing({ url: 'https://www.copart.co.uk/lot/56012246/clean-title-2017-toyota-prius-sandwich', title: 'Lot info', priceTexts: [{ text: '£1,300' }], text: 'Lot info £1,300' }, { id: 'copart', country: 'UK' });
  assert.equal(c.title, 'Clean Title 2017 Toyota Prius Sandwich');
  assert.equal(c.year, 2017);
  // CardealPage: parantezli birim; PicknBuy24: boşlukla ayrılmış önceki sayı km'ye karışmaz
  assert.equal(parseMileageKm('80,320 (km)'), 80320);
  assert.equal(parseMileageKm('-$30 118,000 km (73,200 mile)'), 118000);
  // Car Junction: birimsiz "Mileage: 66600" (Japon sitesi km, İngiliz sitesi mil)
  assert.equal(parseMileageKm('Year: 2022 Mileage: 66600 Doors: 4'), 66600);
  assert.equal(parseMileageKm('Mileage: 10000', 'mi'), 16093);
  // PicknBuy24: aynı stok numarası üç farklı adres biçimi → tek ilan
  const site = { id: 'pb', name: 'PB', country: 'JP' };
  const d = toListings(
    [
      { url: 'https://www.picknbuy24.com/usedcar/?keyword=0122340268', title: 'PRIUS L', priceTexts: [{ text: 'US$1,160' }], text: '' },
      { url: 'https://www.picknbuy24.com/detail/?refno=0122340268', title: '2011 TOYOTA PRIUS L', priceTexts: [{ text: 'US$ 1,160' }], text: '118,000 km' },
      { url: 'https://www.picknbuy24.com/detail/toyota/prius/0122340268.html', title: '2011 TOYOTA PRIUS L', priceTexts: [{ text: 'US$ 1,160' }], text: '' },
    ],
    site,
  );
  assert.equal(d.length, 1);
  assert.equal(d[0].title, '2011 TOYOTA PRIUS L');
  assert.equal(d[0].km, 118000);
  assert.ok(!d[0].url.includes('keyword='), 'arama bağlantısı yerine ilan sayfası');
});

test('yol vergisi, posta ve kargo fiyat sayılmaz (eBay/Gumtree canlı)', () => {
  const t = (text) => pickPrices([...text.matchAll(new RegExp(PRICE_PATTERN, 'gi'))].map((m) => ({ text: m[0], label: text.slice(Math.max(0, m.index - 30), m.index), after: text.slice(m.index + m[0].length, m.index + m[0].length + 20) }))).price?.amount;
  assert.equal(t('UK CAR £20 a yr road tax 66 reg Toyota Prius 1.8 £8,995'), 8995);
  assert.equal(t('Toyota, PRIUS, 2009, Petrol/Hybrid, Automatic, £20 tax, £2,450'), 2450);
  assert.equal(t('2019 Toyota Prius £12,500 +£45.00 postage'), 12500);
  assert.equal(t('Road tax: £0 Price £4,995'), 4995);
  const c = toListing({ url: 'https://www.copart.co.uk/lot/1/x', title: '2011 Toyota Prius', priceTexts: [{ text: '£30' }], text: '' }, { id: 'copart', country: 'UK', kind: 'auction' });
  assert.equal(c.auction, true);
});

test('indirim rozeti fiyat sayılmaz (cinch canlı)', () => {
  const t = (text) => pickPrices([...text.matchAll(new RegExp(PRICE_PATTERN, 'gi'))].map((m) => ({ text: m[0], label: text.slice(Math.max(0, m.index - 30), m.index), after: text.slice(m.index + m[0].length, m.index + m[0].length + 20) }))).price?.amount;
  assert.equal(t('Nissan Qashqai 1.5 dCi £300 off was £8,899 £8,599 £144 /month HP'), 8599);
  assert.equal(t('£500 cashback £12,995'), 12995);
  assert.equal(t('Save £1,000 now £9,995'), 9995);
});

test('sipariş bilgisi: etiket ve JSON anahtarı eşleştirme, tarih biçimleri', async () => {
  const { fieldForLabel, parseDateAny, extractOrderInfo, daysUntil } = await import('../extension/src/orderinfo.js');
  // HTML etiketleri, JSON anahtarları, farklı diller
  for (const [label, field] of [
    ['Vessel Name', 'vessel'], ['vesselName', 'vessel'], ['vessel_name', 'vessel'], ['船名', 'vessel'], ['Gemi adı', 'vessel'],
    ['ETA', 'eta'], ['etaDate', 'eta'], ['Estimated Arrival', 'eta'], ['到着予定日', 'eta'], ['Tahmini varış', 'eta'],
    ['ETD', 'etd'], ['Shipping Date', 'etd'], ['出港予定日', 'etd'],
    ['B/L No.', 'bl'], ['blNo', 'bl'], ['bl_number', 'bl'], ['Chassis No.', 'chassis'], ['chassisNumber', 'chassis'], ['車台番号', 'chassis'],
    ['Payment Status', 'payment'], ['Shipping Status', 'status'], ['Port of Discharge', 'pod'], ['portOfDischarge', 'pod'],
  ]) assert.equal(fieldForLabel(label), field, label);
  assert.equal(fieldForLabel('Customer Review Rating Summary Headline Text Block'), null, 'uzun metin etiket değildir');
  assert.equal(fieldForLabel('Beta version'), null, '"beta" içindeki "eta" sayılmaz');

  for (const [t, iso] of [
    ['2026/11/03', '2026-11-03'], ['2026-11-03T00:00:00Z', '2026-11-03'], ['2026年11月3日', '2026-11-03'],
    ['03-Nov-2026', '2026-11-03'], ['3 Nov 2026', '2026-11-03'], ['Nov 3, 2026', '2026-11-03'], ['November 3rd, 2026', '2026-11-03'],
    ['03.11.2026', '2026-11-03'], ['03/11/2026', '2026-11-03'], ['2026/11', '2026-11'], ['Nov 2026', '2026-11'],
  ]) assert.equal(parseDateAny(t), iso, t);
  assert.equal(parseDateAny('TBD'), null);

  const r = extractOrderInfo([
    { label: 'ETA', value: 'TBD' }, // geçersiz → sonraki aday
    { label: 'Estimated Arrival', value: '2026/11/03' },
    { label: 'Vessel', value: '-' },
    { label: 'vesselName', value: 'MORNING CHERRY' },
    { label: 'Mileage', value: '45,000 km' },
    // Gerçek sayfalarda görülen gürültü (SBT / BE FORWARD detay sayfaları)
    { label: 'Destination Port', value: 'Destination Port' },
    { label: 'Payment', value: 'Change Consignee Info' },
    { label: 'Chassis No', value: 'ZVW51' },
    { label: 'Port of Discharge', value: 'FAMAGUSTA' },
  ]);
  assert.deepEqual(r.fields, { eta: '2026-11-03', vessel: 'MORNING CHERRY', pod: 'FAMAGUSTA' });
  assert.equal(daysUntil('2026-11-03', new Date(2026, 9, 27)), 7);
});

test('mezat teklif mesajı', () => {
  const m = inquiryMessage({ title: 'TOYOTA PRIUS, S', url: 'https://banzai24.com/en/car/JP/x', auction: true, auctionInfo: { house: 'TAA Kinki', lot: '4006', date: '2026-09-29 10:00' } }, { name: 'Ali' });
  assert.match(m, /bid on my behalf/);
  assert.match(m, /TAA Kinki, Lot 4006, 2026-09-29 10:00/);
  assert.match(m, /auction sheet/);
  assert.match(m, /Famagusta/);
});

test('son kontrol: kampanya tutarı, üstü çizili fiyat, "Delivery:" etiketi, etiketli km', () => {
  const p = (arr) => pickPrices(arr).price?.amount ?? null;
  // Exchange & Mart: başlıktaki kampanya rozeti
  assert.equal(p([{ text: '£695', label: '5dr ', after: ' HOME WALL CHARGER OFFER £22,677 or Fi' }, { text: '£22,677', label: 'OFFER ', after: ' or Finance from £332' }]), 22677);
  assert.equal(p([{ text: '£545', label: 'optional extras worth ', after: '. Specification' }]), null);
  assert.equal(p([{ text: '£3,500', label: 'Prius ', after: ' or Best Offer' }]), 3500, 'pazarlık payı gerçek fiyattır');
  assert.equal(p([{ text: '£9,995', label: 'Prius ', after: ' Free delivery' }]), 9995);
  // CarFromJapan: "Delivery: Baltimore" etiketi kargo ücreti değildir; üstü çizili eski fiyat atlanır
  assert.equal(p([{ text: 'US$ 21,938', label: 'Car Price : ', after: ' Delivery: Baltimore, MD (Port)' }]), 21938);
  assert.equal(p([{ text: 'US$ 22,980', label: 'Car Price : ', after: ' US$ 22,337', struck: true }, { text: 'US$ 22,337', label: '', after: ' Delivery:' }]), 22337);
  assert.equal(p([{ text: '+£45', label: '£3,000 ', after: ' delivery' }]), null);
  // Copart: tahmini değer ve 0 teklif fiyat değildir
  assert.equal(p([{ text: '£7,549.00', label: ' 95972 Estimated retail value ', after: ' GBP' }, { text: '£0.00', label: 'Current bid: ', after: ' GBP' }]), null);
  assert.equal(parseMileageKm('★ONLY 77,000 KM★ Mileage 76,497km'), 76497);
  assert.equal(parseMileageKm('Odometer 0 Estimated'), null);
});

test('son kontrol: ithal aracın İngiltere kayıt yılı yerine marka önündeki üretim yılı', () => {
  const site = { id: 'exchangeandmart', country: 'UK', currency: 'GBP', kind: 'marketplace' };
  const l = toListing({ url: 'https://www.exchangeandmart.co.uk/ad/33677479', title: 'Honda Fit Hybrid Electric', priceTexts: [{ text: '£8,495', label: 'Electric ', after: ' or Finance from £188' }], text: 'Honda Fit Hybrid Electric £8,495 or Finance from £188 per month 2026 Other Tax: £200 Mileage: 61,000 Hybrid Welcome SmartDrive Motors A stunning, ultra-economical 2015 Honda Fit (Jazz) 1.5 Petrol Hybrid' }, site);
  assert.deepEqual([l.year, l.km, l.price], [2015, Math.round(61000 * 1.609344), 8495]);
  // Etiketli yıl varsa o geçerlidir
  const b = toListing({ url: 'https://x.jp/1', title: 'TOYOTA PRIUS', priceTexts: [], text: 'Year : 2012.03 compare 2019 Toyota Aqua' }, null);
  assert.deepEqual([b.year, b.month], [2012, 3]);
});
