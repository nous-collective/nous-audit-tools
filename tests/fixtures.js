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

export const ROUTES = {
  '/jp-grid': jpGrid,
  '/uk-cards': ukCards,
  '/yen-table': yenTable,
  '/json-ld': jsonLd,
  '/late': lateRender,
  '/blocked': blocked,
  '/empty': empty,
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
