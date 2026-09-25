import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildUrl, requiredFields, searchVars } from '../extension/src/template.js';
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
} from '../extension/src/normalize.js';
import { ageStatus, landedCost, inquiryMessage } from '../extension/src/kktc.js';
import { makeConverter } from '../extension/src/currency.js';
import { SITES, siteForUrl, applySiteOverrides } from '../extension/src/sites.js';

const vars = (o) => ({ make: '', model: '', keyword: '', q: '', yearFrom: '', yearTo: '', priceMin: '', priceMax: '', kmMax: '', milesMax: '', postcode: '', ...o });
const site = (id) => SITES.find((s) => s.id === id);

test('şablon: doğrulanmış site URL yapıları', () => {
  const v = vars({ make: 'Toyota', model: 'Prius', q: 'Toyota Prius' });
  assert.equal(buildUrl(site('sbt').template, v), 'https://www.sbtjapan.com/used-cars/toyota/prius/');
  assert.equal(buildUrl(site('carfromjapan').template, v), 'https://carfromjapan.com/cheap-used-toyota-prius-for-sale');
  assert.equal(buildUrl(site('tcv').template, v), 'https://www.tc-v.com/used_car/toyota/prius/');
  assert.equal(buildUrl(site('goonet').template, v), 'https://www.goo-net-exchange.com/usedcars/TOYOTA/PRIUS/');
  assert.equal(buildUrl(site('realmotor').template, v), 'https://www.realmotor.jp/stock/TOYOTA/PRIUS');
  assert.equal(buildUrl(site('picknbuy24').template, v), 'https://www.picknbuy24.com/usedcar/?maker=toyota&model=prius');
  assert.equal(buildUrl(site('cardealpage').template, v), 'https://www.cardealpage.com/toyota/prius/');
  assert.equal(buildUrl(site('carjunction').template, v), 'https://www.carjunction.com/make/toyota/prius.html');
  assert.equal(buildUrl(site('gumtree').template, v), 'https://www.gumtree.com/cars-vans-motorbikes/cars/toyota/prius');
  assert.equal(buildUrl(site('motors').template, v), 'https://www.motors.co.uk/toyota/prius/used-cars/');
  assert.equal(buildUrl(site('pistonheads').template, v), 'https://www.pistonheads.com/buy/toyota/prius');
  assert.equal(buildUrl(site('cinch').template, v), 'https://www.cinch.co.uk/used-cars/toyota/prius');
  assert.equal(buildUrl(site('carwow').template, v), 'https://www.carwow.co.uk/toyota/prius/used');
});

test('şablon: çok kelimeli modeller', () => {
  const v = vars({ make: 'Toyota', model: 'Prius PHV', q: 'Toyota Prius PHV' });
  assert.equal(buildUrl(site('goonet').template, v), 'https://www.goo-net-exchange.com/usedcars/TOYOTA/PRIUS_PHV/');
  assert.equal(buildUrl(site('tcv').template, v), 'https://www.tc-v.com/used_car/toyota/prius%20phv/');
  assert.equal(buildUrl(site('sbt').template, v), 'https://www.sbtjapan.com/used-cars/toyota/prius-phv/');
  assert.equal(buildUrl(site('picknbuy24').template, v), 'https://www.picknbuy24.com/usedcar/?maker=toyota&model=prius+phv');
  assert.equal(buildUrl(site('realmotor').template, v), 'https://www.realmotor.jp/stock/TOYOTA/PRIUS%20PHV');
  const lr = vars({ make: 'Land Rover', model: 'Range Rover Evoque', q: 'Land Rover Range Rover Evoque' });
  assert.equal(buildUrl(site('motors').template, lr), 'https://www.motors.co.uk/land-rover/range-rover-evoque/used-cars/');
});

test('şablon: isteğe bağlı parçalar ve zorunlu alanlar', () => {
  const onlyMake = vars({ make: 'Nissan', q: 'Nissan' });
  assert.equal(buildUrl(site('sbt').template, onlyMake), 'https://www.sbtjapan.com/used-cars/nissan/');
  assert.equal(buildUrl(site('carfromjapan').template, onlyMake), 'https://carfromjapan.com/cheap-used-nissan-for-sale');
  assert.equal(buildUrl(site('carjunction').template, onlyMake), null, 'model zorunlu');
  assert.equal(buildUrl(site('sbt').template, vars({})), null, 'marka zorunlu');
  assert.deepEqual(requiredFields(site('carjunction').template), ['make', 'model']);
  assert.deepEqual(requiredFields(site('sbt').template), ['make']);

  const at = buildUrl(site('autotrader').template, vars({ make: 'Toyota', model: 'Prius', yearFrom: 2021, priceMax: 15000, milesMax: 31069 }));
  assert.equal(at, 'https://www.autotrader.co.uk/car-search?make=Toyota&model=Prius&year-from=2021&price-to=15000&maximum-mileage=31069');
  const eb = buildUrl(site('ebay').template, vars({ q: 'Toyota Prius', priceMax: 9000 }));
  assert.equal(eb, 'https://www.ebay.co.uk/sch/i.html?_sacat=9801&_nkw=Toyota+Prius&_udhi=9000');
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
  assert.equal(siteForUrl('https://example.com/'), null);
  const ids = SITES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'site kimlikleri benzersiz');

  const s = applySiteOverrides({ sbt: { enabled: false }, autorec: { template: 'https://www.autorec.co.jp/?q={q|enc}' }, gumtree: { template: '' } });
  assert.equal(s.find((x) => x.id === 'sbt').enabled, false);
  assert.equal(s.find((x) => x.id === 'autorec').template, 'https://www.autorec.co.jp/?q={q|enc}');
  assert.equal(s.find((x) => x.id === 'autorec').enabled, true);
  assert.equal(s.find((x) => x.id === 'gumtree').template, null);
  assert.equal(s.find((x) => x.id === 'cargurus').enabled, false, 'şablonsuz site varsayılan kapalı');
});
