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
};

export function startServer() {
  const server = http.createServer((req, res) => {
    const path = new URL(req.url, 'http://x').pathname;
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
