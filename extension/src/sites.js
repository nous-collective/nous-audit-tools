// Desteklenen siteler.
//
// template: arama URL şablonu (bkz. template.js). null ise site otomatik
//   aramaya katılmaz; "Sitede aç" + "Bu sayfadaki ilanları topla" ile kullanılır.
// verified: şablonun URL yapısı sitenin gerçek sayfalarıyla doğrulandı mı.
// currency: sitenin fiyat filtresinde kullandığı para birimi ({priceMax} bu
//   birime çevrilir).
// kind: exporter (Japon ihracatçı), marketplace (ilan sitesi), auction
//   (açık artırma), agent (mezat aracısı).
// login: ilanları görmek / teklif vermek için üyelik veya bayi hesabı gerekir.

export const SITES = [
  // --- Japonya ---
  {
    id: 'beforward',
    name: 'BE FORWARD',
    country: 'JP',
    home: 'https://www.beforward.jp/',
    template: 'https://www.beforward.jp/stocklist/keyword={q|enc}[/fob_price_to={priceMax}]',
    verified: false,
    currency: 'USD',
    kind: 'exporter',
  },
  {
    id: 'sbt',
    name: 'SBT Japan',
    country: 'JP',
    home: 'https://www.sbtjapan.com/',
    template: 'https://www.sbtjapan.com/used-cars/{make|slug}/[{model|slug}/]',
    verified: true,
    currency: 'USD',
    kind: 'exporter',
  },
  {
    id: 'carfromjapan',
    name: 'Car From Japan',
    country: 'JP',
    home: 'https://carfromjapan.com/',
    template: 'https://carfromjapan.com/cheap-used-{make|slug}[-{model|slug}]-for-sale',
    verified: true,
    currency: 'USD',
    kind: 'exporter',
  },
  {
    id: 'tcv',
    name: 'TCV (tradecarview)',
    country: 'JP',
    home: 'https://www.tc-v.com/',
    template: 'https://www.tc-v.com/used_car/{make|lower|enc}/[{model|lower|enc}/]',
    verified: true,
    currency: 'USD',
    kind: 'marketplace',
  },
  {
    id: 'goonet',
    name: 'Goo-net Exchange',
    country: 'JP',
    home: 'https://www.goo-net-exchange.com/',
    template: 'https://www.goo-net-exchange.com/usedcars/{make|upper|under}/[{model|upper|under}/]',
    verified: true,
    currency: 'JPY',
    kind: 'marketplace',
  },
  {
    id: 'realmotor',
    name: 'Real Motor Japan',
    country: 'JP',
    home: 'https://www.realmotor.jp/',
    template: 'https://www.realmotor.jp/stock/{make|upper|enc}[/{model|upper|enc}]',
    verified: true,
    currency: 'USD',
    kind: 'exporter',
  },
  {
    id: 'picknbuy24',
    name: 'PicknBuy24',
    country: 'JP',
    home: 'https://www.picknbuy24.com/',
    template: 'https://www.picknbuy24.com/usedcar/?maker={make|lower|plus}[&model={model|lower|plus}]',
    verified: true,
    currency: 'USD',
    kind: 'exporter',
  },
  {
    id: 'cardealpage',
    name: 'CardealPage',
    country: 'JP',
    home: 'https://www.cardealpage.com/',
    template: 'https://www.cardealpage.com/{make|lower|enc}/[{model|slug}/]',
    verified: true,
    currency: 'USD',
    kind: 'exporter',
  },
  {
    id: 'carjunction',
    name: 'Car Junction',
    country: 'JP',
    home: 'https://www.carjunction.com/',
    template: 'https://www.carjunction.com/make/{make|slug}/{model|slug}.html',
    verified: true,
    currency: 'USD',
    kind: 'exporter',
  },
  { id: 'autorec', name: 'Autorec', country: 'JP', home: 'https://www.autorec.co.jp/', template: null, verified: false, currency: 'USD', kind: 'exporter' },
  { id: 'enhanceauto', name: 'Enhance Auto', country: 'JP', home: 'https://www.enhanceauto.com/', template: null, verified: false, currency: 'USD', kind: 'exporter' },
  { id: 'tomisho', name: 'Tomisho', country: 'JP', home: 'https://www.tomisho.com/', template: null, verified: false, currency: 'USD', kind: 'exporter' },
  { id: 'satjapan', name: 'SAT Japan', country: 'JP', home: 'https://www.satjapan.com/', template: null, verified: false, currency: 'USD', kind: 'exporter' },
  { id: 'japancardirect', name: 'Japan Car Direct (mezat aracısı)', country: 'JP', home: 'https://www.japancardirect.com/', template: null, verified: false, currency: 'USD', kind: 'agent' },
  { id: 'carsjapancy', name: 'CarsJapan Cyprus (mezat aracısı)', country: 'JP', home: 'https://carsjapan.cy/', template: null, verified: false, currency: 'EUR', kind: 'agent' },

  // --- İngiltere ---
  {
    id: 'autotrader',
    name: 'AutoTrader UK',
    country: 'UK',
    home: 'https://www.autotrader.co.uk/',
    template:
      'https://www.autotrader.co.uk/car-search?make={make|enc}[&model={model|enc}][&year-from={yearFrom}][&year-to={yearTo}][&price-to={priceMax}][&maximum-mileage={milesMax}][&postcode={postcode|enc}]',
    verified: false,
    currency: 'GBP',
    kind: 'marketplace',
  },
  {
    id: 'ebay',
    name: 'eBay Motors UK',
    country: 'UK',
    home: 'https://www.ebay.co.uk/b/Cars/9801/bn_1839671',
    template: 'https://www.ebay.co.uk/sch/i.html?_sacat=9801&_nkw={q|plus}[&_udlo={priceMin}][&_udhi={priceMax}]',
    verified: false,
    currency: 'GBP',
    kind: 'marketplace',
  },
  {
    id: 'gumtree',
    name: 'Gumtree',
    country: 'UK',
    home: 'https://www.gumtree.com/cars',
    template: 'https://www.gumtree.com/cars-vans-motorbikes/cars/{make|slug}[/{model|slug}]',
    verified: true,
    currency: 'GBP',
    kind: 'marketplace',
  },
  {
    id: 'motors',
    name: 'Motors.co.uk (Cazoo)',
    country: 'UK',
    home: 'https://www.motors.co.uk/',
    template: 'https://www.motors.co.uk/{make|slug}/[{model|slug}/]used-cars/',
    verified: true,
    currency: 'GBP',
    kind: 'marketplace',
  },
  {
    id: 'pistonheads',
    name: 'PistonHeads',
    country: 'UK',
    home: 'https://www.pistonheads.com/buy',
    template: 'https://www.pistonheads.com/buy/{make|slug}[/{model|slug}]',
    verified: true,
    currency: 'GBP',
    kind: 'marketplace',
  },
  {
    id: 'cinch',
    name: 'cinch',
    country: 'UK',
    home: 'https://www.cinch.co.uk/used-cars',
    template: 'https://www.cinch.co.uk/used-cars/{make|slug}[/{model|slug}]',
    verified: true,
    currency: 'GBP',
    kind: 'marketplace',
  },
  {
    id: 'carwow',
    name: 'Carwow',
    country: 'UK',
    home: 'https://www.carwow.co.uk/used-cars',
    template: 'https://www.carwow.co.uk/{make|slug}/{model|slug}/used',
    verified: true,
    currency: 'GBP',
    kind: 'marketplace',
  },
  {
    id: 'copart',
    name: 'Copart UK (hasarlı/pert)',
    country: 'UK',
    home: 'https://www.copart.co.uk/',
    template: 'https://www.copart.co.uk/lotSearchResults?query={q|enc}',
    verified: false,
    currency: 'GBP',
    kind: 'auction',
    login: true,
  },
  { id: 'cargurus', name: 'CarGurus UK', country: 'UK', home: 'https://www.cargurus.co.uk/', template: null, verified: false, currency: 'GBP', kind: 'marketplace' },
  { id: 'exchangeandmart', name: 'Exchange & Mart', country: 'UK', home: 'https://www.exchangeandmart.co.uk/', template: null, verified: false, currency: 'GBP', kind: 'marketplace' },
  { id: 'bca', name: 'BCA (bayi mezatı)', country: 'UK', home: 'https://www.bca.co.uk/', template: null, verified: false, currency: 'GBP', kind: 'auction', login: true },
  { id: 'manheim', name: 'Manheim UK (bayi mezatı)', country: 'UK', home: 'https://www.manheim.co.uk/', template: null, verified: false, currency: 'GBP', kind: 'auction', login: true },
  { id: 'astonbarclay', name: 'Aston Barclay (bayi mezatı)', country: 'UK', home: 'https://www.astonbarclay.net/', template: null, verified: false, currency: 'GBP', kind: 'auction', login: true },
];

export const COUNTRY_LABEL = { JP: 'Japonya', UK: 'İngiltere' };
export const COUNTRY_FLAG = { JP: '🇯🇵', UK: '🇬🇧' };
export const KIND_LABEL = {
  exporter: 'İhracatçı',
  marketplace: 'İlan sitesi',
  auction: 'Açık artırma',
  agent: 'Mezat aracısı',
};

function baseDomain(url) {
  return new URL(url).hostname.replace(/^www\./, '');
}

// Bir URL'nin hangi siteye ait olduğunu bulur (yakalanan sayfalar için).
export function siteForUrl(url, sites = SITES) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  return sites.find((s) => {
    const d = baseDomain(s.home);
    return host === d || host.endsWith('.' + d);
  }) || null;
}

// Varsayılan site listesine kullanıcının ayarlarını (açık/kapalı, şablon) uygular.
export function applySiteOverrides(overrides = {}) {
  return SITES.map((s) => {
    const o = overrides[s.id] || {};
    const custom = typeof o.template === 'string';
    const template = custom ? o.template || null : s.template;
    return {
      ...s,
      enabled: Boolean(template) && (o.enabled ?? true),
      template,
      customTemplate: custom,
    };
  });
}
