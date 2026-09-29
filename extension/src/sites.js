// Desteklenen siteler.
//
// templates: arama URL şablonları (bkz. template.js), en özelden en genele.
//   İlk URL üretebilen şablon kullanılır; örn. model girilmemişse yalnızca
//   markayla arayan şablona düşülür. Boş liste: site otomatik aramaya katılmaz,
//   "Sitede aç" + "Bu sayfadaki ilanları topla" ile kullanılır.
// verified: şablonların URL yapısı sitenin gerçek sayfalarıyla doğrulandı mı.
// currency: sitenin fiyat filtresinde kullandığı para birimi ({priceMax} bu
//   birime çevrilir).
// render: 'tab' ise sayfa doğrudan indirilmez, her zaman sekmede açılır
//   (ilanları tamamen JavaScript ile çizen siteler).
// kind: exporter (Japon ihracatçı), marketplace (ilan sitesi), auction
//   (açık artırma), agent (mezat aracısı).
// login: ilanları görmek / teklif vermek için üyelik veya bayi hesabı gerekir.

export const SITES = [
  // --- Japonya ---
  {
    id: 'beforward',
    name: 'BE FORWARD',
    country: 'JP',
    home: 'https://www.beforward.jp/stocklist',
    templates: [
      'https://www.beforward.jp/stocklist/keyword={q|enc}[/mfg_year_from={yearFrom}][/mfg_year_to={yearTo}][/fob_price_to={priceMax}]',
    ],
    verified: true,
    currency: 'USD',
    kind: 'exporter',
  },
  {
    id: 'sbt',
    name: 'SBT Japan',
    country: 'JP',
    home: 'https://www.sbtjapan.com/used-cars/',
    templates: ['https://www.sbtjapan.com/used-cars/{make|slug}/[{model|slug}/]'],
    verified: true,
    currency: 'USD',
    kind: 'exporter',
  },
  {
    id: 'carfromjapan',
    name: 'Car From Japan',
    country: 'JP',
    home: 'https://carfromjapan.com/',
    templates: ['https://carfromjapan.com/cheap-used-{make|slug}[-{model|slug}]-for-sale'],
    verified: true,
    currency: 'USD',
    kind: 'exporter',
  },
  {
    id: 'tcv',
    name: 'TCV (tradecarview)',
    country: 'JP',
    home: 'https://www.tc-v.com/used_car/all/all/',
    templates: ['https://www.tc-v.com/used_car/{make|lower|enc}/[{model|lower|enc}/]'],
    verified: true,
    currency: 'USD',
    kind: 'marketplace',
  },
  {
    id: 'goonet',
    name: 'Goo-net Exchange',
    country: 'JP',
    home: 'https://www.goo-net-exchange.com/',
    templates: ['https://www.goo-net-exchange.com/usedcars/{make|upper|under}/[{model|upper|under}/]'],
    verified: true,
    currency: 'JPY',
    kind: 'marketplace',
  },
  {
    id: 'realmotor',
    name: 'Real Motor Japan',
    country: 'JP',
    home: 'https://www.realmotor.jp/',
    templates: ['https://www.realmotor.jp/stock/{make|upper|enc}[/{model|upper|enc}]'],
    verified: true,
    currency: 'USD',
    kind: 'exporter',
  },
  {
    id: 'picknbuy24',
    name: 'PicknBuy24',
    country: 'JP',
    home: 'https://www.picknbuy24.com/usedcar/',
    templates: ['https://www.picknbuy24.com/usedcar/?maker={make|lower|plus}[&model={model|lower|plus}]'],
    verified: true,
    currency: 'USD',
    kind: 'exporter',
  },
  {
    id: 'cardealpage',
    name: 'CardealPage',
    country: 'JP',
    home: 'https://www.cardealpage.com/',
    templates: ['https://www.cardealpage.com/{make|lower|enc}/[{model|slug}/]'],
    verified: true,
    currency: 'USD',
    kind: 'exporter',
  },
  {
    id: 'carjunction',
    name: 'Car Junction',
    country: 'JP',
    home: 'https://www.carjunction.com/',
    templates: [
      'https://www.carjunction.com/make/{make|slug}/{model|slug}.html',
      'https://www.carjunction.com/make/{make|slug}.html',
    ],
    verified: true,
    currency: 'USD',
    kind: 'exporter',
  },
  {
    id: 'satjapan',
    name: 'SAT Japan',
    country: 'JP',
    home: 'https://satjapan.com/used-cars',
    templates: ['https://satjapan.com/used-cars/mk_{make|slug}[/md_{model|slug}]'],
    verified: true,
    currency: 'USD',
    kind: 'exporter',
  },
  {
    id: 'autorec',
    name: 'Autorec',
    country: 'JP',
    home: 'https://www.autorec.co.jp/car-stock',
    templates: ['https://www.autorec.co.jp/used-cars-list.php?Sort=1&post_maker={make|upper|enc}'],
    verified: true,
    currency: 'USD',
    kind: 'exporter',
  },
  {
    // TRUST Company (1988'den beri, Kıbrıs sayfası var). Site Eylül 2026'da yeni arayüze geçti:
    // eski stocklist.php model parametresini düşürerek /stocklist?maker= adresine yönlendiriyor.
    // Yeni arayüz JavaScript ile çizildiği için sekmede açılır; model=PRIUS canlı doğrulandı.
    id: 'trust',
    name: 'TRUST Japan (JapaneseVehicles.com)',
    country: 'JP',
    home: 'https://japanesevehicles.com/',
    templates: ['https://japanesevehicles.com/stocklist?maker={make|upper|enc}[&model={model|upper|enc}]'],
    verified: true,
    currency: 'USD',
    kind: 'exporter',
    render: 'tab',
  },
  {
    // Cloudflare korumalı; model sayfaları kimlik numarası istiyor (make-model/toyota-1-prius-134.html),
    // ilan kartları güvenilir okunamadı. Elle: sitede ara, sonra "Bu sayfadaki ilanları topla".
    id: 'japanesecartrade',
    name: 'Japanese Car Trade',
    country: 'JP',
    home: 'https://www.japanesecartrade.com/stock_list.php',
    templates: [],
    verified: false,
    currency: 'USD',
    kind: 'exporter',
  },
  { id: 'nichibo', name: 'Nichibo Japan (mezat aracısı)', country: 'JP', home: 'https://autosearch.nichibojapan.com/', templates: [], verified: false, currency: 'USD', kind: 'agent' },
  {
    // Stok listesi üyelere açık (girişsiz /accounts/login/'e yönlendirir; Eylül 2026'da kontrol edildi).
    // Arama parametreleri üye olmadan görülemediği için tüm stok açılır, marka/model filtresi panelde uygulanır.
    id: 'hasnihon',
    name: 'Has-Nihon',
    country: 'JP',
    home: 'https://www.hasnihon.com/',
    templates: ['https://www.hasnihon.com/used_vehicles/'],
    verified: false,
    currency: 'USD',
    kind: 'exporter',
    login: true,
  },
  {
    // Japonya araç mezatları (USS, TAA, CAA, JU, Honda AA…) tek arama; Eylül 2026'da canlı doğrulandı.
    // Fiyat mezat başlangıç fiyatıdır; teklif bir aracı üzerinden verilir.
    id: 'banzai24',
    name: 'Banzai24 (Japonya mezatları)',
    country: 'JP',
    home: 'https://banzai24.com/en',
    templates: ['https://banzai24.com/en/{make|upper|enc}[/{model|upper|enc}]?source=auctions&countryISO=JP'],
    verified: true,
    currency: 'JPY',
    kind: 'auction',
  },
  {
    // Mezat evlerinin sabit fiyatlı stokları (mezat beklemeden, aracı üzerinden alınır). Canlı doğrulandı.
    id: 'banzai24op',
    name: 'Banzai24 One Price (mezat evi sabit fiyat)',
    country: 'JP',
    home: 'https://banzai24.com/en?source=onePrice',
    templates: ['https://banzai24.com/en/{make|upper|enc}[/{model|upper|enc}]?source=onePrice&countryISO=JP'],
    verified: true,
    currency: 'JPY',
    kind: 'auction',
  },
  { id: 'aleado', name: 'Aleado (Japon mezat erişimi)', country: 'JP', home: 'https://aleado.com/', templates: [], verified: false, currency: 'JPY', kind: 'auction', login: true },
  { id: 'japancardirect', name: 'Japan Car Direct (mezat aracısı)', country: 'JP', home: 'https://www.japancardirect.com/', templates: [], verified: false, currency: 'USD', kind: 'agent' },
  { id: 'carsjapancy', name: 'CarsJapan Cyprus (mezat aracısı)', country: 'JP', home: 'https://carsjapan.cy/', templates: [], verified: false, currency: 'EUR', kind: 'agent' },

  // --- İngiltere ---
  {
    id: 'autotrader',
    name: 'AutoTrader UK',
    country: 'UK',
    home: 'https://www.autotrader.co.uk/',
    templates: ['https://www.autotrader.co.uk/cars/used/{make|slug}[/{model|slug}]'],
    verified: true,
    currency: 'GBP',
    kind: 'marketplace',
  },
  {
    id: 'ebay',
    name: 'eBay Motors UK',
    country: 'UK',
    home: 'https://www.ebay.co.uk/b/Cars/9801/bn_1839671',
    templates: ['https://www.ebay.co.uk/sch/i.html?_sacat=9801&_nkw={q|plus}[&_udlo={priceMin}][&_udhi={priceMax}]'],
    verified: true,
    currency: 'GBP',
    kind: 'marketplace',
  },
  {
    id: 'gumtree',
    name: 'Gumtree',
    country: 'UK',
    home: 'https://www.gumtree.com/cars',
    templates: ['https://www.gumtree.com/cars-vans-motorbikes/cars/{make|slug}[/{model|slug}]'],
    verified: true,
    currency: 'GBP',
    kind: 'marketplace',
  },
  {
    // Motors.co.uk artık cazoo.co.uk'ye yönlendiriyor (Eylül 2026'da canlı kontrol edildi).
    id: 'motors',
    name: 'Cazoo (eski Motors.co.uk)',
    country: 'UK',
    home: 'https://www.cazoo.co.uk/',
    templates: ['https://www.cazoo.co.uk/cars/{make|slug}/[{model|slug}/]'],
    verified: true,
    currency: 'GBP',
    kind: 'marketplace',
  },
  {
    id: 'pistonheads',
    name: 'PistonHeads',
    country: 'UK',
    home: 'https://www.pistonheads.com/buy',
    templates: ['https://www.pistonheads.com/buy/{make|slug}[/{model|slug}]'],
    verified: true,
    currency: 'GBP',
    kind: 'marketplace',
  },
  {
    id: 'cinch',
    name: 'cinch',
    country: 'UK',
    home: 'https://www.cinch.co.uk/used-cars',
    templates: ['https://www.cinch.co.uk/used-cars/{make|slug}[/{model|slug}]'],
    verified: true,
    currency: 'GBP',
    kind: 'marketplace',
  },
  {
    id: 'carwow',
    name: 'Carwow',
    country: 'UK',
    home: 'https://www.carwow.co.uk/used-cars',
    templates: ['https://www.carwow.co.uk/{make|slug}/{model|slug}/used', 'https://www.carwow.co.uk/{make|slug}/used'],
    verified: true,
    currency: 'GBP',
    kind: 'marketplace',
  },
  {
    id: 'exchangeandmart',
    name: 'Exchange & Mart',
    country: 'UK',
    home: 'https://www.exchangeandmart.co.uk/',
    templates: ['https://www.exchangeandmart.co.uk/used-cars-for-sale/{make|slug}[/{model|slug}]'],
    verified: true,
    currency: 'GBP',
    kind: 'marketplace',
  },
  {
    id: 'copart',
    name: 'Copart UK (hasarlı/pert)',
    country: 'UK',
    home: 'https://www.copart.co.uk/',
    templates: ['https://www.copart.co.uk/lotSearchResults/?free=true&query={q|plus}'],
    verified: true,
    currency: 'GBP',
    kind: 'auction',
    render: 'tab',
    login: true,
  },
  { id: 'cargurus', name: 'CarGurus UK', country: 'UK', home: 'https://www.cargurus.co.uk/', templates: [], verified: false, currency: 'GBP', kind: 'marketplace' },
  { id: 'bca', name: 'BCA (bayi mezatı)', country: 'UK', home: 'https://www.bca.co.uk/', templates: [], verified: false, currency: 'GBP', kind: 'auction', login: true },
  { id: 'manheim', name: 'Manheim UK (bayi mezatı)', country: 'UK', home: 'https://www.manheim.co.uk/', templates: [], verified: false, currency: 'GBP', kind: 'auction', login: true },
  { id: 'astonbarclay', name: 'Aston Barclay (bayi mezatı)', country: 'UK', home: 'https://www.astonbarclay.net/', templates: [], verified: false, currency: 'GBP', kind: 'auction', login: true },
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

// Kullanıcının kaydettiği şablon(lar)ı listeye çevirir. Eski sürümler tek
// "template" dizesi saklıyordu.
function overrideTemplates(o) {
  if (Array.isArray(o.templates)) return o.templates.map((t) => String(t).trim()).filter(Boolean);
  if (typeof o.template === 'string') return o.template.trim() ? [o.template.trim()] : [];
  return null;
}

// Varsayılan site listesine kullanıcının ayarlarını (açık/kapalı, şablon) uygular.
export function applySiteOverrides(overrides = {}) {
  return SITES.map((s) => {
    const o = overrides[s.id] || {};
    const custom = overrideTemplates(o);
    const templates = custom ?? s.templates;
    return {
      ...s,
      enabled: templates.length > 0 && (o.enabled ?? true),
      templates,
      customTemplate: custom !== null,
    };
  });
}
