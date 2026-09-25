// Sitelerde arama yapıp ilanları toplar.
//
// Her sayfa için iki yol vardır:
//   fetch: sayfa HTML'i doğrudan indirilir ve panelde okunur. Hızlıdır, pencere
//          açmaz; sunucu tarafında çizilen (çoğu) ilan sitesinde yeterlidir.
//   tab  : sayfa kullanıcının tarayıcısında gerçek bir sekmede açılır; JavaScript
//          ile sonradan çizilen siteler ve robot doğrulamaları için gereklidir.
// "auto" modunda önce fetch denenir, yeterli ilan çıkmazsa sekmeye geçilir.

import { dedupeListings, toListings } from './normalize.js';
import { matchesQuery } from './query.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIN_FETCH_ITEMS = 5;

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
    chrome.tabs.get(tabId).then((t) => t.status === 'complete' && t.url !== 'about:blank' && finish(resolve), () => {});
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

// İndirilen HTML'in karakter kümesini (Shift_JIS vb.) doğru çözer.
async function fetchHtml(url, { timeoutMs, signal }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, {
      credentials: 'include',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' },
    });
    const buf = await res.arrayBuffer();
    const type = res.headers.get('content-type') || '';
    let charset = type.match(/charset=["']?([\w-]+)/i)?.[1];
    if (!charset) {
      const head = new TextDecoder('latin1').decode(buf.slice(0, 4096));
      charset = head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
    }
    let html;
    try {
      html = new TextDecoder(charset || 'utf-8').decode(buf);
    } catch {
      html = new TextDecoder('utf-8').decode(buf);
    }
    return { status: res.status, finalUrl: res.url || url, html, isHtml: /html|xml/i.test(type) || /<html|<body/i.test(html.slice(0, 2000)) };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

async function scrapeByFetch(url, opts) {
  const r = await fetchHtml(url, opts);
  if (!r.isHtml) throw new Error(`HTML değil (HTTP ${r.status})`);
  const doc = new DOMParser().parseFromString(r.html, 'text/html');
  const raw = await globalThis.__kktcScraper.run({ doc, baseUrl: r.finalUrl });
  return { ...raw, httpStatus: r.status, method: 'fetch' };
}

/**
 * jobs: [{ site, url }]
 * options: { mode: auto|background|visible, concurrency, settleMs, timeoutMs, maxPages, onUpdate }
 * onUpdate(siteId, { state, count?, message?, url, items?, diag? })
 *   state: queued | loading | done | empty | blocked | error | cancelled
 * Dönen nesnenin cancel() metodu aramayı durdurur.
 */
export function runSearch(jobs, { mode = 'auto', concurrency = 3, settleMs = 2500, timeoutMs = 45000, maxPages = 2, query = null, onUpdate }) {
  let cancelled = false;
  const abort = new AbortController();
  const openTabs = new Set();
  let windowId = null;
  let windowPromise = null;

  // Sekme penceresi yalnızca gerektiğinde açılır; kullanıcı kapatırsa yeniden açılır.
  async function getWindow() {
    if (windowId !== null) {
      try {
        await chrome.windows.get(windowId);
        return windowId;
      } catch {
        windowId = null;
        windowPromise = null;
      }
    }
    windowPromise ??= (async () => {
      const base = { url: 'about:blank', focused: mode === 'visible' };
      let win;
      try {
        win = await chrome.windows.create(mode === 'visible' ? base : { ...base, state: 'minimized' });
      } catch {
        win = await chrome.windows.create({ url: 'about:blank', focused: false });
      }
      windowId = win.id;
      return win.id;
    })();
    return windowPromise;
  }

  async function scrapeByTabUrl(url) {
    const wid = await getWindow();
    const tab = await chrome.tabs.create({ windowId: wid, url, active: mode === 'visible' });
    openTabs.add(tab.id);
    try {
      const loaded = await waitForLoad(tab.id, timeoutMs);
      if (cancelled) return null;
      await sleep(settleMs);
      // İlan sayısı sabitlenene kadar birkaç kez oku (geç yüklenen listeler, otomatik geçen robot kontrolleri).
      let best = null;
      let last = -1;
      const deadline = Date.now() + Math.max(8000, settleMs * 4);
      for (let i = 0; !cancelled; i++) {
        let raw = null;
        try {
          raw = await scrapeTab(tab.id, { scroll: i === 0 || last === 0 });
        } catch (e) {
          // Sayfa o sırada yönlendiriliyor olabilir.
          if (/Cannot access|permission/i.test(e.message)) throw e;
        }
        if (raw && (!best || raw.items.length > best.items.length || (best.blocked && !raw.blocked))) best = raw;
        const n = raw?.items.length ?? -1;
        if (n > 0 && n === last) break;
        last = n;
        if (Date.now() > deadline) break;
        await sleep(2000);
      }
      if (best) {
        best.method = 'tab';
        best.timedOut = loaded === 'timeout';
      }
      return best;
    } finally {
      openTabs.delete(tab.id);
      chrome.tabs.remove(tab.id).catch(() => {});
    }
  }

  // Aranan marka/modelle eşleşen ilan sayısı: sunucunun yalnızca "önerilen araçlar" gönderip
  // asıl sonuçları JavaScript ile çizdiği sitelerde indirme yetersiz sayılır ve sekmeye geçilir.
  const useful = (site, raw) => toListings(raw.items, site, raw.url).filter((l) => matchesQuery(l, query)).length;

  async function scrapePage(site, url, pageDiag) {
    let fetched = null;
    let fetchedUseful = 0;
    if (mode === 'auto' && site.render !== 'tab') {
      try {
        fetched = await scrapeByFetch(url, { timeoutMs: Math.min(timeoutMs, 30000), signal: abort.signal });
        fetchedUseful = useful(site, fetched);
        pageDiag.fetch = { status: fetched.httpStatus, items: fetched.items.length, matching: fetchedUseful, blocked: fetched.blocked, finalUrl: fetched.url, diag: fetched.diag };
        if (fetchedUseful >= MIN_FETCH_ITEMS && !fetched.blocked) return fetched;
      } catch (e) {
        if (cancelled) return null;
        pageDiag.fetch = { error: e.message };
      }
    }
    if (cancelled) return null;
    const tabbed = await scrapeByTabUrl(url);
    if (!tabbed) return fetched;
    const tabbedUseful = useful(site, tabbed);
    pageDiag.tab = { items: tabbed.items.length, matching: tabbedUseful, blocked: tabbed.blocked, finalUrl: tabbed.url, timedOut: tabbed.timedOut, diag: tabbed.diag };
    if (!fetched) return tabbed;
    if (tabbedUseful !== fetchedUseful) return tabbedUseful > fetchedUseful ? tabbed : fetched;
    return tabbed.items.length >= fetched.items.length ? tabbed : fetched;
  }

  async function runJob({ site, url }) {
    const diag = { site: site.id, url, pages: [] };
    onUpdate(site.id, { state: 'loading', url });
    let items = [];
    let lastRaw = null;
    let pageUrl = url;
    const seenPages = new Set();
    try {
      for (let page = 1; page <= Math.max(1, maxPages) && pageUrl && !cancelled; page++) {
        seenPages.add(pageUrl);
        const pageDiag = { page, url: pageUrl };
        diag.pages.push(pageDiag);
        const raw = await scrapePage(site, pageUrl, pageDiag);
        if (!raw) break;
        lastRaw = raw;
        pageDiag.method = raw.method;
        const found = toListings(raw.items, site, raw.url);
        pageDiag.listings = found.length;
        const before = items.length;
        items = dedupeListings([...items, ...found]);
        if (items.length) onUpdate(site.id, { state: 'loading', url, count: items.length, items, diag });
        // Yeni ilan gelmeyen sayfadan sonra devam etme.
        if (page > 1 && items.length === before) break;
        pageUrl = raw.next && !seenPages.has(raw.next) ? raw.next : null;
      }
      if (cancelled) return;
      if (items.length) {
        onUpdate(site.id, { state: 'done', count: items.length, url, items, diag, pages: diag.pages.length });
      } else if (lastRaw?.blocked) {
        onUpdate(site.id, {
          state: 'blocked',
          url: lastRaw.url || url,
          diag,
          message: 'Site robot doğrulaması istiyor. "Sitede aç" ile doğrulamayı geç, sonra eklenti simgesinden "Bu sayfadaki ilanları topla"yı kullan.',
        });
      } else {
        onUpdate(site.id, {
          state: 'empty',
          url: lastRaw?.url || url,
          diag,
          message: lastRaw?.timedOut ? 'Sayfa zamanında yüklenmedi.' : 'İlan bulunamadı (arama sonucu yok ya da sayfa yapısı tanınmadı).',
        });
      }
    } catch (e) {
      if (cancelled) return;
      diag.error = e.message;
      const msg = /Cannot access|permission/i.test(e.message)
        ? 'Sayfaya erişim izni yok (site başka bir alan adına yönlendirmiş olabilir).'
        : e.message;
      onUpdate(site.id, { state: 'error', url, message: msg, diag, count: items.length, items: items.length ? items : undefined });
    }
  }

  const promise = (async () => {
    jobs.forEach((j) => onUpdate(j.site.id, { state: 'queued', url: j.url }));
    const queue = [...jobs];
    const worker = async () => {
      while (queue.length && !cancelled) await runJob(queue.shift());
    };
    try {
      await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, jobs.length)) }, worker));
    } finally {
      if (cancelled) queue.forEach((j) => onUpdate(j.site.id, { state: 'cancelled', url: j.url }));
      if (windowId !== null) chrome.windows.remove(windowId).catch(() => {});
    }
  })();

  return {
    promise,
    cancel() {
      cancelled = true;
      abort.abort();
      for (const id of openTabs) chrome.tabs.remove(id).catch(() => {});
      if (windowId !== null) chrome.windows.remove(windowId).catch(() => {});
    },
  };
}
