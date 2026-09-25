import { siteForUrl } from './sites.js';
import { toListings } from './normalize.js';
import { addResults } from './storage.js';
import { scrapeTab } from './runner.js';

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

async function capture() {
  const btn = document.getElementById('capture');
  btn.disabled = true;
  say('Sayfa taranıyor…');
  try {
    // ?tab=<id>: testlerde popup ayrı sekmede açıldığında hedef sekme.
    const forced = Number(new URLSearchParams(location.search).get('tab'));
    const [tab] = forced ? [await chrome.tabs.get(forced)] : await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !/^https?:/.test(tab.url || '')) throw new Error('Bu sayfa taranamaz. Bir ilan sitesinde olmalısın.');
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
