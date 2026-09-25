// Siteleri gerçek tarayıcı sekmelerinde açıp ilanları toplar. Sayfalar
// kullanıcının kendi tarayıcısında yüklendiği için JavaScript ile çizilen
// siteler ve çerez/oturum gerektiren sayfalar da çalışır.

import { toListings } from './normalize.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function waitForLoad(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (fn, arg) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      fn(arg);
    };
    const onUpdated = (id, info) => {
      if (id === tabId && info.status === 'complete') finish(resolve);
    };
    const onRemoved = (id) => {
      if (id === tabId) finish(reject, new Error('Sekme kapatıldı'));
    };
    const timer = setTimeout(() => finish(resolve, 'timeout'), timeoutMs);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    chrome.tabs.get(tabId).then((t) => t.status === 'complete' && finish(resolve), () => {});
  });
}

// Scraper'ı bir sekmeye enjekte edip ham sonucu döndürür.
export async function scrapeTab(tabId, opts = {}) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['src/scraper.js'] });
  const [res] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (o) => globalThis.__kktcScraper.run(o),
    args: [opts],
  });
  return res?.result;
}

async function openWindow(mode) {
  const base = { url: 'about:blank', focused: mode === 'visible' };
  try {
    return await chrome.windows.create(mode === 'visible' ? base : { ...base, state: 'minimized' });
  } catch {
    return chrome.windows.create({ url: 'about:blank', focused: false });
  }
}

/**
 * jobs: [{ site, url }]
 * onUpdate(siteId, { state, count?, message?, url, items? })
 *   state: queued | loading | done | empty | blocked | error | cancelled
 * Dönen nesnenin cancel() metodu aramayı durdurur.
 */
export function runSearch(jobs, { mode = 'background', concurrency = 3, settleMs = 2500, timeoutMs = 45000, onUpdate }) {
  let cancelled = false;
  const openTabs = new Set();
  let windowId = null;

  const promise = (async () => {
    jobs.forEach((j) => onUpdate(j.site.id, { state: 'queued', url: j.url }));
    if (!jobs.length) return;
    const win = await openWindow(mode);
    windowId = win.id;
    const queue = [...jobs];

    const worker = async () => {
      while (queue.length && !cancelled) {
        const job = queue.shift();
        const { site, url } = job;
        onUpdate(site.id, { state: 'loading', url });
        let tabId = null;
        try {
          const tab = await chrome.tabs.create({ windowId, url, active: false });
          tabId = tab.id;
          openTabs.add(tabId);
          const loaded = await waitForLoad(tabId, timeoutMs);
          if (cancelled) break;
          await sleep(settleMs);
          let raw = await scrapeTab(tabId, { scroll: true });
          if (raw && !raw.blocked && raw.items.length === 0) {
            // Geç yüklenen sayfalar için bir kez daha dene.
            await sleep(Math.max(settleMs, 3000));
            raw = await scrapeTab(tabId, { scroll: true });
          }
          if (!raw) throw new Error('Sayfa okunamadı');
          const items = toListings(raw.items, site, raw.url);
          if (items.length) {
            onUpdate(site.id, { state: 'done', count: items.length, url: raw.url, items });
          } else if (raw.blocked) {
            onUpdate(site.id, {
              state: 'blocked',
              url: raw.url,
              message: 'Site robot doğrulaması istiyor. "Sitede aç" ile doğrulamayı geç, sonra eklenti simgesinden "Bu sayfadaki ilanları topla"yı kullan.',
            });
          } else {
            onUpdate(site.id, {
              state: 'empty',
              url: raw.url,
              message: loaded === 'timeout' ? 'Sayfa zamanında yüklenmedi.' : 'İlan bulunamadı (sonuç yok ya da şablon yanlış olabilir).',
            });
          }
        } catch (e) {
          if (!cancelled) {
            const msg = /Cannot access|permission/i.test(e.message)
              ? 'Sayfaya erişim izni yok (site başka bir alan adına yönlendirmiş olabilir).'
              : e.message;
            onUpdate(site.id, { state: 'error', url, message: msg });
          }
        } finally {
          if (tabId !== null) {
            openTabs.delete(tabId);
            chrome.tabs.remove(tabId).catch(() => {});
          }
        }
      }
    };

    try {
      await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, jobs.length)) }, worker));
    } finally {
      if (cancelled) queue.forEach((j) => onUpdate(j.site.id, { state: 'cancelled', url: j.url }));
      chrome.windows.remove(windowId).catch(() => {});
    }
  })();

  return {
    promise,
    cancel() {
      cancelled = true;
      for (const id of openTabs) chrome.tabs.remove(id).catch(() => {});
      if (windowId !== null) chrome.windows.remove(windowId).catch(() => {});
    },
  };
}
