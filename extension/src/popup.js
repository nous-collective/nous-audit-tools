import { siteForUrl } from './sites.js';
import { toListings, listingKey } from './normalize.js';
import { addResults, getFavorites, saveFavorites } from './storage.js';
import { scrapeTab } from './runner.js';
import { readOrderFromTab, guessFavorite, applyOrder } from './ordertrack.js';
import { ORDER_LABEL_TR } from './orderinfo.js';

const DASHBOARD = chrome.runtime.getURL('dashboard.html');
const msg = document.getElementById('msg');

function say(text, cls = 'muted') {
  msg.textContent = text;
  msg.className = cls;
}

async function openDashboard() {
  const [existing] = await chrome.tabs.query({ url: DASHBOARD });
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: DASHBOARD });
  }
  window.close();
}

async function targetTab() {
  // ?tab=<id>: testlerde popup ayrı sekmede açıldığında hedef sekme.
  const forced = Number(new URLSearchParams(location.search).get('tab'));
  const [tab] = forced ? [await chrome.tabs.get(forced)] : await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https?:/.test(tab.url || '')) throw new Error('Bu sayfa taranamaz. Bir web sitesinde olmalısın.');
  return tab;
}

let pendingOrder = null;

async function readOrder() {
  const btn = document.getElementById('order');
  btn.disabled = true;
  say('Sipariş bilgileri okunuyor…');
  try {
    const tab = await targetTab();
    const info = await readOrderFromTab(tab.id);
    if (!info.found) {
      say('Bu sayfada sipariş / nakliye bilgisi bulunamadı (gemi, ETA, şasi no gibi).', 'err');
      return;
    }
    const favorites = await getFavorites();
    pendingOrder = { info, url: info.url, title: info.title, favorites };
    const ul = document.getElementById('order-fields');
    ul.replaceChildren(
      ...Object.entries(info.fields).map(([k, v]) => {
        const li = document.createElement('li');
        li.textContent = `${ORDER_LABEL_TR[k] || k}: ${v}`;
        return li;
      }),
    );
    const sel = document.getElementById('order-target');
    const guess = guessFavorite(favorites, info, info.url);
    const opts = Object.values(favorites).map((fav) => {
      const o = document.createElement('option');
      o.value = fav.listing.id;
      o.textContent = fav.listing.title.slice(0, 60);
      o.selected = fav.listing.id === guess;
      return o;
    });
    const neu = document.createElement('option');
    neu.value = '__new__';
    neu.textContent = '+ Takip listesine yeni araç olarak ekle';
    neu.selected = !guess;
    sel.replaceChildren(...opts, neu);
    document.getElementById('order-box').hidden = false;
    say(`${info.found} bilgi bulundu. Aracı kontrol edip kaydet.`, 'ok');
  } catch (e) {
    say(e.message, 'err');
  } finally {
    btn.disabled = false;
  }
}

async function saveOrder() {
  if (!pendingOrder) return;
  const { info, url, title } = pendingOrder;
  const favorites = await getFavorites();
  let id = document.getElementById('order-target').value;
  if (id === '__new__') {
    const name = title || 'Satın alınan araç';
    id = listingKey(url);
    favorites[id] = {
      listing: { id, url, title: name, siteName: new URL(url).hostname.replace(/^www\./, ''), siteId: 'order', country: null, price: null, currency: null, year: null, month: null, km: null },
      status: 'Ödeme yapıldı',
      note: '',
      addedAt: new Date().toISOString(),
    };
  }
  const changes = applyOrder(favorites[id], info, url);
  await saveFavorites(favorites);
  document.getElementById('order-box').hidden = true;
  say(changes.length ? `Kaydedildi. Değişen: ${changes.map((k) => ORDER_LABEL_TR[k] || k).join(', ')}.` : 'Kaydedildi. Takip listesinde görebilirsin.', 'ok');
}

async function capture() {
  const btn = document.getElementById('capture');
  btn.disabled = true;
  say('Sayfa taranıyor…');
  try {
    const tab = await targetTab();
    const raw = await scrapeTab(tab.id, { scroll: true });
    const site = siteForUrl(raw.url);
    const items = toListings(raw.items, site, raw.url);
    if (!items.length) {
      say(raw.blocked ? 'Site robot doğrulaması gösteriyor. Önce doğrulamayı geç.' : 'Bu sayfada ilan bulunamadı. Arama sonuç listesinde olduğundan emin ol.', 'err');
      return;
    }
    const added = await addResults(items);
    say(
      added
        ? `${items.length} ilan bulundu, ${added} yeni ilan panele eklendi.`
        : `${items.length} ilan bulundu; hepsi panelde zaten vardı.`,
      'ok',
    );
  } catch (e) {
    say(e.message, 'err');
  } finally {
    btn.disabled = false;
  }
}

document.getElementById('open').addEventListener('click', openDashboard);
document.getElementById('capture').addEventListener('click', capture);
document.getElementById('order').addEventListener('click', readOrder);
document.getElementById('order-save').addEventListener('click', saveOrder);
