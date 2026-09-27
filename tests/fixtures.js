// Gerçek sitelerin yaygın liste düzenlerini taklit eden test sayfaları ve basit HTTP sunucusu.
import http from 'node:http';

const layout = (title, body, head = '') => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>${head}</head><body>
<header><nav><ul class="menu">
  <li class="menu-item"><a href="/">Home</a></li><li class="menu-item"><a href="/stock">Stock</a></li>
  <li class="menu-item"><a href="/about">About us</a></li><li class="menu-item"><a href="/contact">Contact</a></li>
</ul></nav></header>
<aside><ul class="makes">
  <li class="make"><a href="/toyota">Toyota (12,345)</a></li><li class="make"><a href="/nissan">Nissan (8,210)</a></li>
  <li class="make"><a href="/honda">Honda (5,002)</a></li><li class="make"><a href="/mazda">Mazda (3,100)</a></li>
</ul></aside>
${body}
<footer><ul class="links"><li class="l"><a href="/terms">Terms</a></li><li class="l"><a href="/privacy">Privacy</a></li><li class="l"><a href="/faq">FAQ</a></li></ul></footer>
</body></html>`;

// Japon ihracatçı: ızgara kartlar, FOB + toplam fiyat, sorgu bağlantısı, lazy görsel.
export function jpGrid(n = 20) {
  const cards = Array.from({ length: n }, (_, i) => {
    const year = 2015 + (i % 9);
    return `<li class="stocklist-row ${i % 5 === 0 ? 'is-new' : ''}">
      <div class="photo"><a href="/toyota/prius/BF${1000 + i}/id/${900000 + i}/"><img src="/img/loading.gif" data-src="/photos/${i}.jpg" width="200"></a></div>
      <div class="info">
        <p class="make-model"><a class="vehicle-url-link" href="/toyota/prius/BF${1000 + i}/id/${900000 + i}/">${year} TOYOTA PRIUS S</a></p>
        <table class="spec"><tr><th>Year</th><td>${year}/${(i % 12) + 1}</td><th>Mileage</th><td>${(40 + i) * 1000} km</td></tr>
        <tr><th>Engine</th><td>1,800cc</td><th>Trans.</th><td>AT</td></tr><tr><th>Fuel</th><td>Hybrid(Petrol)</td><th>Steering</th><td>Right</td></tr></table>
        <p class="price">Price <span>US$${(5000 + i * 250).toLocaleString('en-US')}</span></p>
        <p class="total">Total Price <span>US$${(6500 + i * 250).toLocaleString('en-US')}</span> (C&amp;F)</p>
        <a class="btn" href="/inquiry?id=${i}">Inquiry</a>
      </div></li>`;
  }).join('\n');
  return layout('Used TOYOTA PRIUS for Sale', `<main><h1>TOYOTA PRIUS</h1><ul class="stocklist">${cards}</ul></main>`);
}

// İngiliz ilan sitesi: kartın tamamı bağlantı, taksit ve eski fiyat, mil cinsinden km.
export function ukCards(n = 12) {
  const cards = Array.from({ length: n }, (_, i) => `<li class="search-page__result">
      <section data-testid="trader-seller-listing" class="listing">
        <a href="/car-details/2024${String(i).padStart(8, '0')}?utm_source=x" class="listing-link">
          <figure><img srcset="https://cdn.example/${i}-w480.jpg 480w, https://cdn.example/${i}-w960.jpg 960w" alt="Toyota Prius"></figure>
          <h3 class="product-card-details__title">Toyota Prius 1.8 VVT-h Business Edition ${i}</h3>
          <div class="product-card-pricing">${i % 3 === 0 ? '<span class="was">was £14,995</span> ' : ''}<span class="price">£${(9000 + i * 500).toLocaleString('en-GB')}</span>
          <span class="finance">£${199 + i} per month</span></div>
          <ul class="key-specs"><li>${2016 + (i % 8)} (${16 + (i % 8)} reg)</li><li>Hatchback</li><li>${(30000 + i * 1000).toLocaleString('en-GB')} miles</li><li>1.8L</li><li>Automatic</li><li>Hybrid</li></ul>
        </a>
      </section></li>`).join('\n');
  const promo = `<div class="promo-carousel">${['Honda Jazz', 'Mazda 2', 'Nissan Leaf']
    .map((t, i) => `<div class="promo-card"><a href="/promo/${i}">${t}</a><span>£${7000 + i * 100}</span></div>`)
    .join('')}</div>`;
  return layout('Toyota Prius cars for sale', `<main><ul class="results">${cards}</ul>${promo}</main>`);
}

// Tablo satırları, yen fiyatı.
export function yenTable(n = 8) {
  const rows = Array.from({ length: n }, (_, i) => `<tr class="car-row">
      <td><a href="/usedcars/TOYOTA/PRIUS/7000${i}/"><img src="/p/${i}.jpg" width="120"></a></td>
      <td><a href="/usedcars/TOYOTA/PRIUS/7000${i}/">TOYOTA PRIUS A TOURING SELECTION</a><br>${2018 + (i % 5)} | SILVER | ${(10000 + i * 5000).toLocaleString('en-US')} km</td>
      <td>FOB ¥${(1170000 + i * 100000).toLocaleString('en-US')}</td></tr>`).join('\n');
  return layout('Goo-net style list', `<table class="list"><thead><tr><th>Photo</th><th>Car</th><th>Price</th></tr></thead><tbody>${rows}</tbody></table>`);
}

// Yalnızca JSON-LD ile veri veren sayfa (DOM'da fiyat yok).
export function jsonLd() {
  const items = Array.from({ length: 4 }, (_, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: {
      '@type': 'Car',
      name: `Nissan Leaf Tekna ${i}`,
      url: `https://example.test/leaf/${i}`,
      image: [`https://example.test/leaf/${i}.jpg`],
      vehicleModelDate: String(2020 + i),
      dateVehicleFirstRegistered: `${2020 + i}-0${i + 3}-01`,
      mileageFromOdometer: { '@type': 'QuantitativeValue', value: 10000 * (i + 1), unitCode: 'SMI' },
      fuelType: 'Electric',
      offers: { '@type': 'Offer', price: 11000 + i * 1000, priceCurrency: 'GBP' },
    },
  }));
  const ld = { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: items };
  return layout('Leaf', '<main><p>Results loading…</p></main>', `<script type="application/ld+json">${JSON.stringify(ld)}</script>`);
}

// İçerik JavaScript ile sonradan çiziliyor.
export function lateRender() {
  const script = `setTimeout(() => {
    const ul = document.createElement('ul');
    ul.className = 'grid';
    for (let i = 0; i < 6; i++) {
      const li = document.createElement('li');
      li.className = 'grid-item';
      li.innerHTML = '<a href="/car/' + (500 + i) + '"><img src="/i/' + i + '.jpg" width="100"><h2>2022 Honda Fit e:HEV ' + i + '</h2></a><b>US$ ' + (9000 + i) + '</b><span>' + (20 + i) + ',000 km</span>';
      ul.appendChild(li);
    }
    document.querySelector('main').appendChild(ul);
  }, 1500);`;
  return layout('SPA', `<main></main><script>${script}</script>`);
}

export function blocked() {
  return `<!doctype html><html><head><title>Just a moment...</title></head><body><p>Checking your browser before accessing the site.</p></body></html>`;
}

export function empty() {
  return layout('No results', '<main><p>No vehicles match your search.</p></main>');
}

// Aynı ilanın birden fazla temsili: fotoğraf bağlantısı ?refkey=…, başlık bağlantısı parametresiz,
// CSS ile gizlenmiş mobil kopya (farklı adres), JSON-LD'de kanonik adres.
export function dupes(n = 6) {
  const cards = Array.from({ length: n }, (_, i) => `<div class="car-card">
      <a href="/toyota/prius/${3000 + i}/?refkey=abc${i}"><img src="/p/${i}.jpg" width="200"></a>
      <h3><a href="/toyota/prius/${3000 + i}/">2019 TOYOTA PRIUS A ${i}</a></h3>
      <p>FOB US$${(8000 + i * 100).toLocaleString('en-US')}</p><p>${50 + i},000 km</p></div>`).join('');
  const mobile = Array.from({ length: n }, (_, i) => `<div class="m-card">
      <a href="/m/car.php?c=${3000 + i}&view=m"><img src="/p/${i}.jpg" width="100"></a>
      <span class="t">2019 TOYOTA PRIUS A ${i}</span><b>US$${(8000 + i * 100).toLocaleString('en-US')}</b><i>${50 + i},000 km</i></div>`).join('');
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: Array.from({ length: n }, (_, i) => ({
      '@type': 'ListItem',
      item: { '@type': 'Car', name: `2019 TOYOTA PRIUS A ${i}`, url: `/toyota/prius/${3000 + i}`, offers: { price: 8000 + i * 100, priceCurrency: 'USD' } },
    })),
  };
  return layout(
    'Dupes',
    `<main><div class="desktop-list">${cards}</div><div class="mobile-list">${mobile}</div></main>`,
    `<style>.mobile-list{display:none}</style><script type="application/ld+json">${JSON.stringify(ld)}</script>`,
  );
}

// Fiyatı "ASK" olan, km'si yazmayan kartlar + fiyat aralığı filtre bağlantıları.
export function askPrice() {
  const cards = Array.from({ length: 5 }, (_, i) => `<article class="stock">
      <a href="/stock/${7700 + i}"><img src="/s/${i}.jpg" width="160"></a>
      <a href="/stock/${7700 + i}" class="name">${2020 + (i % 3)} NISSAN NOTE e-POWER X</a>
      <div class="price">Price: ASK</div><div>Hybrid · Automatic</div></article>`).join('');
  const facets = ['1,000', '2,000', '3,000', '5,000', '8,000', '10,000']
    .map((p) => `<li class="facet"><a href="/ask-price?price_to=${p.replace(',', '')}">Under US$${p}</a></li>`)
    .join('');
  return layout('ASK', `<aside><ul class="facets">${facets}</ul></aside><main>${cards}</main>`);
}

// Sayfalama: /paged/1 → /paged/2 → /paged/3 (son sayfa).
export function paged(page) {
  const cards = Array.from({ length: 4 }, (_, i) => {
    const id = page * 100 + i;
    return `<li class="res"><a href="/car/${id}"><img src="/c/${id}.jpg" width="150"><h4>2021 Honda Vezel ${id}</h4></a><span>£${(15000 + id).toLocaleString('en-GB')}</span><span>${20 + i},000 miles</span></li>`;
  }).join('');
  const nav = page < 3 ? `<nav class="pagination"><a href="/paged/${page + 1}" rel="next" aria-label="Next page">›</a></nav>` : '';
  return layout(`Page ${page}`, `<ul class="results">${cards}</ul>${nav}`);
}

// Türk lirası fiyatlı kartlar.
export function tryPrices() {
  const cards = Array.from({ length: 3 }, (_, i) => `<div class="ilan"><a href="/ilan/${900 + i}"><img src="/t/${i}.jpg" width="120"><h2>2022 Toyota Corolla ${i}</h2></a><strong>₺${(1250000 + i * 1000).toLocaleString('tr-TR')}</strong><span>${30 + i}.000 km</span></div>`).join('');
  return layout('TRY', `<main>${cards}</main>`);
}

// Sunucu yalnızca alakasız "önerilen araçları" gönderir; asıl sonuçlar JavaScript ile gelir.
export function ssrRecommended() {
  const rec = Array.from({ length: 6 }, (_, i) => `<div class="rec"><a href="/rec/${i}"><img src="/r/${i}.jpg" width="90"><h5>2020 Mazda CX-5 ${i}</h5></a><span>US$${12000 + i}</span></div>`).join('');
  const script = `setTimeout(() => {
    const box = document.createElement('section');
    for (let i = 0; i < 7; i++) {
      const d = document.createElement('div');
      d.className = 'hit';
      d.innerHTML = '<a href="/hit/' + (40 + i) + '"><img src="/h/' + i + '.jpg" width="150"><h3>2021 TOYOTA PRIUS S ' + i + '</h3></a><p>US$ ' + (10000 + i * 10) + '</p><p>' + (30 + i) + ',000 km</p>';
      box.appendChild(d);
    }
    document.querySelector('main').appendChild(box);
  }, 800);`;
  return layout('SSR rec', `<main><aside class="recommended">${rec}</aside></main><script>${script}</script>`);
}

// Liste ve detay aynı adres: /same?make=… ve /same?id=…
export function samePath() {
  const cards = Array.from({ length: 4 }, (_, i) => `<li class="row"><a href="/same?sort=price">Sort</a><a href="/same?id=${500 + i}&from=list"><img src="/s/${i}.jpg" width="120">2019 Toyota Aqua ${i}</a><em>US$ ${6000 + i}</em> <em>${70 + i},000 km</em></li>`).join('');
  return layout('Same path', `<ul class="list">${cards}</ul>`);
}

// ---- Canlı sitelerde görülen yapılar (Eylül 2026) ----

// Goo-net: sınıfsız <li> kartlar; sayfadaki menüler de sınıfsız <li> dolu.
export function liveGoonet() {
  const nav = Array.from({ length: 60 }, (_, i) => `<li><a href="/maker/${i}">Maker ${i}</a></li>`).join('');
  const cards = Array.from({ length: 5 }, (_, i) => `<li><a class="spread_link_new_tab" href="/usedcars/TOYOTA/PRIUS/70007102323026091800${i}/"><div class="photo"><p><img data-src="https://picture1.example/${i}.jpg" alt="TOYOTA PRIUS Z" class="lazyload"></p></div>
    <div class="sub-content"><h3 class="title"> TOYOTA PRIUS Z </h3><p class="location">Hyogo Japan</p><div>Car Price (FOB) ¥${(4303900 + i).toLocaleString('en-US')}</div><div>2023.09</div><div>WHITE</div><div>20,46${i} km</div><div>2000cc</div></div></a></li>`).join('');
  return layout('Goo-net', `<ul class="nav">${nav}</ul><div id="list-cars"><ul class="list-listview">${cards}</ul></div><ul class="footer">${nav}</ul>`);
}

// CardealPage: önce "Click this link to continue" ara sayfası, sonra her ilan 4 tablo satırı.
export function liveCardealGate() {
  return `<html><body>Click this link to continue.<br><a href="/live-cardeal-list?token=1">/live-cardeal-list</a></body></html>`;
}
export function liveCardealList() {
  const rows = Array.from({ length: 6 }, (_, i) => {
    const id = 264690970 + i;
    const cls = `list_line${i % 2}`;
    return `<tr class="${cls}"><td class="MakerModel"><a href="/toyota/prius/${id}/?refkey=abc"><b>TOYOTA PRIUS</b></a></td>
      <td rowspan="3"><a href="/toyota/prius/${id}/?refkey=abc" class="Thumb"><img src="/img/${id}.jpg"></a></td>
      <td rowspan="4"><div class="listNowFob">US$ ${(11035 + i).toLocaleString('en-US')}</div></td><td rowspan="2">2020 <br /> Jan</td><td rowspan="2">80,32${i}<br />(km)</td></tr>
      <tr class="${cls}"><td></td></tr>
      <tr class="${cls}"><td colspan="8"><a class="link" onClick="addComparison()">Comparison</a> <a href="/toyota/prius/${id}/?refkey=abc" class="link">View Detail</a></td></tr>
      <tr class="${cls}"><td class="MakerModel">Ref No.${id}</td><td>Last Update:Sep/09/2026(JST)</td></tr>`;
  }).join('');
  return layout('CardealPage', `<table><tr><th><a href="/live-cardeal-list?s=1">Price</a></th><th><a href="/live-cardeal-list?s=3">Year</a></th></tr>${rows}</table>`);
}

// Car Junction: Bootstrap "row" kartlar, fiyat yok, birimsiz "Mileage: 66600".
export function liveCarJunction() {
  const cards = Array.from({ length: 4 }, (_, i) => `<div class="col-md-12 mb-5"><div class="row"><div class="col-md-3"><div class="row"><a href="/car-detail/toyota-prius-2022-13812${i}.html"><img class="lazy" src="/coming_soon.png" data-original="/car_images2/${i}/a.webp" alt="2022 Toyota / Prius ZVW51"></a></div></div>
    <div class="col-md-9"><div class="row"><a href="/car-detail/toyota-prius-2022-13812${i}.html"> 2022&nbsp;Toyota Prius&nbsp;ZVW51 </a></div><div class="row">Year: <strong>2022</strong></div><div class="row">Transmission: <strong>Automatic</strong></div><div class="row">Mileage: <strong>6660${i}</strong></div><div class="row"><a href="/enquiry?id=${i}">Enquiry</a></div></div></div></div>`).join('');
  const chrome = Array.from({ length: 30 }, (_, i) => `<div class="row"><a href="/p/${i}">Link ${i}</a></div>`).join('');
  return layout('Car Junction', `<div class="container">${chrome}</div><div class="list">${cards}</div>`);
}

// AutoTrader: kartta yalnızca başlık + fiyat; yıl ve mil satır içi betikteki durumda.
export function liveAutotrader() {
  const ids = ['202609236317551', '202605152423999', '202609266402124'];
  const cards = ids.map((id, i) => `<div class="HZeRDq__root xcjgVW__cardContainer"><a href="/car-details/${id}"><h3>Toyota Prius</h3><p>1.8 VVT-h T3 CVT 5dr</p></a><p class="VEW9xq__displayPrice">£${(2999 + i).toLocaleString('en-GB')}</p><picture><img src="https://m.atcdn.example/${id}.jpg" width="600"></picture></div>`).join('');
  const state = ids.map((id, i) => `{"__typename":"Advert","id":"${id}","title":"Toyota Prius","price":${2999 + i},"imageList":{"images":[${Array.from({ length: 30 }, (_, k) => `{"url":"https://m.atcdn.example/a/${id}/${k}.jpg"}`).join(',')}]},"mileage":{"__typename":"Mileage","mileage":${133837 + i},"unit":"MILE"},"year":${2009 - i}}`).join(',');
  return layout('AutoTrader', `<div class="CAcY1W__showroomGrid">${cards}</div><script>window.__STATE__ = {"adverts":[${state}]};</script>`);
}

// cinch: tek ilan; veri Next.js JSON'unda, sayfada yalnızca detay bağlantısı.
export function liveCinch() {
  const data = { props: { pageProps: { searchResults: { response: { vehicleListings: [{ vehicleId: '1d2a07e7-3f87-4f2b-b049-37e36e89e520', make: 'Toyota', model: 'Prius', variant: '1.8 VVTi Plug-in Excel 5dr CVT', price: 12600, mileage: 70428, vehicleYear: 2018, fuelType: 'Plug-in hybrid', transmissionType: 'Automatic', thumbnailUrl: 'https://cdn.example/06_md.jpg' }] } } } } };
  return layout('cinch', `<main><a href="/used-cars/toyota/prius/details/1d2a07e7-3f87-4f2b-b049-37e36e89e520">Toyota Prius</a></main><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>`);
}

// ---- Sipariş / nakliye sayfaları: farklı site teknolojileri ----
const ORDER = { vessel: 'MORNING CHERRY', voyage: '112A', etd: '2026-10-12', eta: '2026-11-03', bl: 'NYKS1234567', chassis: 'ZVW50-8012345', stock: 'BF123456' };

// Klasik sunucu tarafı (PHP vb.): <th>/<td> tablo.
export function orderHtmlTable() {
  return layout('My Order', `<h2>Order BF123456</h2><table class="order">
    <tr><th>Stock No.</th><td>${ORDER.stock}</td></tr><tr><th>Chassis No.</th><td>${ORDER.chassis}</td></tr>
    <tr><th>Vessel Name</th><td>${ORDER.vessel}</td></tr><tr><th>Voyage No.</th><td>${ORDER.voyage}</td></tr>
    <tr><th>ETD</th><td>12-Oct-2026</td></tr><tr><th>ETA</th><td>Nov 3, 2026</td></tr>
    <tr><th>Port of Loading</th><td>YOKOHAMA</td></tr><tr><th>Port of Discharge</th><td>FAMAGUSTA</td></tr>
    <tr><th>B/L No.</th><td>${ORDER.bl}</td></tr><tr><th>Payment Status</th><td>Paid</td></tr></table>`);
}

// React/Vue uygulaması: içerik JavaScript ile sonradan, etiket/değer kutuları olarak çizilir.
export function orderSpa() {
  const script = `setTimeout(() => {
    const rows = [['Vessel','${ORDER.vessel}'],['Estimated Departure','2026/10/12'],['Estimated Arrival','2026/11/03'],['Bill of Lading','${ORDER.bl}'],['Frame No','${ORDER.chassis}'],['Shipping Status','On board']];
    document.querySelector('#app').innerHTML = rows.map(([l, v]) => '<div class="row"><span class="lbl">' + l + '</span><span class="val">' + v + '</span></div>').join('');
  }, 800);`;
  return layout('Shipment', '<div id="app">Loading…</div>', `<script>${script}</script>`);
}

// Next.js: veri yalnızca __NEXT_DATA__ içinde, sayfada neredeyse hiçbir şey yok.
export function orderNext() {
  const data = { props: { pageProps: { order: { stockId: ORDER.stock, chassisNumber: ORDER.chassis, shipment: { vesselName: ORDER.vessel, voyageNo: ORDER.voyage, etd: '2026-10-12T00:00:00Z', eta: '2026-11-03T00:00:00Z', blNo: ORDER.bl, portOfDischarge: 'Famagusta' } } } } };
  return layout('Order', '<div id="__next"></div>', `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>`);
}

// Satır içi durum nesnesi (Angular/jQuery tarzı): window.__STATE__ = {...}
export function orderInlineState() {
  return layout('Order', '<main><h1>Your vehicle</h1></main>', `<script>window.__STATE__ = {"shipment":{"vessel_name":"${ORDER.vessel}","eta_date":"03.11.2026","etd_date":"12.10.2026","bl_number":"${ORDER.bl}"}};</script>`);
}

// Japonca site: tablo etiketleri Japonca, tarihler 年月日.
export function orderJapanese() {
  return layout('ご注文', `<table><tr><td>車台番号</td><td>${ORDER.chassis}</td></tr><tr><td>船名</td><td>${ORDER.vessel}</td></tr>
    <tr><td>出港予定日</td><td>2026年10月12日</td></tr><tr><td>到着予定日</td><td>2026年11月3日</td></tr><tr><td>仕向港</td><td>FAMAGUSTA</td></tr></table>`);
}

// Düz metin: "Etiket: değer" satırları.
export function orderText() {
  return layout('Order', `<pre>Vessel: ${ORDER.vessel}\nETD: 12/10/2026\nETA: 03/11/2026\nB/L No: ${ORDER.bl}\nChassis No: ${ORDER.chassis}</pre>`);
}

export const ROUTES = {
  '/jp-grid': jpGrid,
  '/uk-cards': ukCards,
  '/yen-table': yenTable,
  '/json-ld': jsonLd,
  '/late': lateRender,
  '/blocked': blocked,
  '/empty': empty,
  '/dupes': dupes,
  '/ask-price': askPrice,
  '/paged/1': () => paged(1),
  '/paged/2': () => paged(2),
  '/paged/3': () => paged(3),
  '/try': tryPrices,
  '/ssr-recommended': ssrRecommended,
  '/same': samePath,
  '/live-goonet': liveGoonet,
  '/live-cardeal': liveCardealGate,
  '/live-cardeal-list': liveCardealList,
  '/live-carjunction': liveCarJunction,
  '/live-autotrader': liveAutotrader,
  '/live-cinch': liveCinch,
  '/order-table': orderHtmlTable,
  '/order-spa': orderSpa,
  '/order-next': orderNext,
  '/order-state': orderInlineState,
  '/order-ja': orderJapanese,
  '/order-text': orderText,
};

export function startServer() {
  const server = http.createServer((req, res) => {
    const path = new URL(req.url, 'http://x').pathname;
    // Üyelere özel sayfa: giriş sayfasına yönlendirir (Has-Nihon gibi).
    if (path === '/members-only') {
      res.writeHead(302, { location: '/accounts/login/?next=/members-only' });
      return res.end();
    }
    if (path === '/accounts/login/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(layout('Login', '<form><input name="username"><input name="password" type="password"><button>Login</button></form>'));
    }
    const route = ROUTES[path];
    if (route) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(route());
    } else {
      res.writeHead(404);
      res.end('not found');
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` })));
}
