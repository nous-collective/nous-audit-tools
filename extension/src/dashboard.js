import { applySiteOverrides, COUNTRY_FLAG, COUNTRY_LABEL, KIND_LABEL, SITES } from './sites.js';
import { buildFirstUrl, missingFields, searchVars } from './template.js';
import { CURRENCIES, fetchRates, formatMoney, makeConverter } from './currency.js';
import { FUEL_LABEL, MAKES, TRANSMISSION_LABEL, dedupeListings } from './normalize.js';
import { matchesQuery, normalizeQuery } from './query.js';
import { AGE_LABEL, ageStatus, inquiryMessage, landedCost } from './kktc.js';
import { getFavorites, getResults, getSettings, saveFavorites, saveResults, saveSettings } from './storage.js';
import { runSearch } from './runner.js';
import { TEST_QUERY, evaluateSite } from './sitetest.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'checked' || k === 'value' || k === 'disabled' || k === 'selected') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

const FIELD_LABEL = { make: 'marka', model: 'model', q: 'marka/model/kelime', keyword: 'anahtar kelime' };
const STATUS_TEXT = {
  queued: 'sırada',
  loading: 'yükleniyor…',
  done: 'ilan',
  empty: 'ilan yok',
  blocked: 'doğrulama gerekli',
  error: 'hata',
  skipped: 'atlandı',
  cancelled: 'durduruldu',
  manual: 'elle aç',
  login: 'giriş gerekli',
};
const FAV_STATUSES = ['İnceleniyor', 'Teklif istendi', 'Pazarlıkta', 'Ödeme yapıldı', 'Yolda', 'Teslim alındı', 'Vazgeçildi'];
const DEFAULT_FILTERS = {
  text: '', country: 'all', yearMin: '', yearMax: '', priceMin: '', priceMax: '', kmMax: '',
  fuel: '', transmission: '', age: 'all', hidePriceless: false, rhdOnly: false, onlyMatching: true,
};
// Tüm sitelerin ilanları tek listede, sayfa sayfa (1, 2, 3…) gösterilir.
const DEFAULT_PAGE_SIZE = 50;

const state = {
  settings: null,
  sites: [],
  results: [],
  favorites: {},
  statuses: new Map(),
  run: null,
  page: 1,
  cursors: {}, // site kimliği -> sitenin henüz açılmamış sonraki sayfası (null: bitti)
  perSite: 50,
  filters: { ...DEFAULT_FILTERS },
  excludedSites: new Set(),
  sort: 'price-asc',
  query: null, // son aramanın marka/modeli (eşleşme filtresi için)
  diagnostics: {}, // site kimliği -> son aramanın tanı bilgisi
};
let convert = () => null;

// ---------- yardımcılar ----------
const cur = () => state.settings.displayCurrency;
const fmtInt = (n) => Math.round(n).toLocaleString('tr-TR');
const pad2 = (n) => String(n).padStart(2, '0');
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

function toast(msg, ms = 3500) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), ms);
}

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] ??= {};
  o[keys.at(-1)] = value;
}

function priceIn(l) {
  return l.price == null ? null : convert(l.price, l.currency, cur());
}

function specsText(l) {
  return [
    l.year && (l.month ? `${l.year}/${pad2(l.month)}` : String(l.year)),
    l.km != null && `${fmtInt(l.km)} km`,
    FUEL_LABEL[l.fuel],
    TRANSMISSION_LABEL[l.transmission],
    l.steering,
    l.engineCc && `${fmtInt(l.engineCc)} cc`,
  ]
    .filter(Boolean)
    .join(' · ');
}

function persistResults() {
  clearTimeout(persistResults.timer);
  persistResults.timer = setTimeout(() => saveResults(state.results), 400);
}

async function persistSettings() {
  await saveSettings(state.settings);
  state.sites = applySiteOverrides(state.settings.siteOverrides);
  convert = makeConverter(state.settings.rates?.rates);
}

// ---------- kurlar ----------
async function ensureRates(force = false) {
  const r = state.settings.rates;
  const stale = !r || (!r.manual && Date.now() - new Date(r.updatedAt).getTime() > 12 * 3600 * 1000);
  if (!force && !stale) return;
  try {
    state.settings.rates = { ...(await fetchRates()), manual: false };
    await persistSettings();
    if (force) toast('Kurlar güncellendi.');
  } catch (e) {
    toast(`${e.message}. Ayarlar sekmesinden kurları elle girebilirsin.`, 6000);
  }
}

// ---------- sekmeler ----------
function showTab(name) {
  $$('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab').forEach((t) => t.classList.toggle('active', t.id === `tab-${name}`));
  try {
    localStorage.setItem('tab', name);
  } catch {}
  if (name === 'favorites') renderFavorites();
  if (name === 'sites') renderSites();
  if (name === 'settings') renderSettings();
}

// ---------- arama ----------
function readSearchForm() {
  const f = Object.fromEntries(new FormData($('#search-form')).entries());
  for (const k of Object.keys(f)) f[k] = String(f[k]).trim();
  return f;
}

async function startSearch(e) {
  e.preventDefault();
  if (state.run) return;
  const { form, inferred } = normalizeQuery(readSearchForm());
  // Düzeltilen marka/modeli forma geri yaz (ör. "prius" → Toyota + Prius).
  for (const k of ['make', 'model', 'keyword']) $('#search-form').elements[k].value = form[k];
  if (inferred.length) toast(`Arama düzenlendi: ${[form.make, form.model, form.keyword].filter(Boolean).join(' / ')}`);
  state.query = form.make || form.model ? { make: form.make, model: form.model } : null;
  await chrome.storage.local.set({ lastSearch: form, lastQuery: state.query });

  const inCountry = (s) => form.country === 'all' || s.country === form.country;
  const vars = { ...form, currency: cur(), postcode: state.settings.postcode };
  const jobs = [];
  state.statuses = new Map();
  state.diagnostics = {};
  for (const site of state.sites.filter((s) => s.enabled && s.templates.length && inCountry(s))) {
    const sv = searchVars(vars, site, convert);
    let url = null;
    try {
      url = buildFirstUrl(site.templates, sv);
    } catch (err) {
      state.statuses.set(site.id, { state: 'error', url: site.home, message: err.message });
      continue;
    }
    if (!url) {
      const need = missingFields(site.templates, sv).map((f) => FIELD_LABEL[f] || f).join(', ');
      state.statuses.set(site.id, { state: 'skipped', url: site.home, message: `Bu sitede aramak için gerekli: ${need}` });
      continue;
    }
    jobs.push({ site, url });
  }
  // Otomatik aranamayan siteler de görünsün: tıklayınca site açılır, "Bu sayfadaki ilanları topla" ile eklenir.
  for (const site of state.sites.filter((s) => !s.templates.length && inCountry(s))) {
    state.statuses.set(site.id, {
      state: 'manual',
      url: site.home,
      message: site.login
        ? 'Bu site üyelik/bayi hesabı istiyor. Sitede giriş yapıp aramanı yap, sonra eklenti simgesinden "Bu sayfadaki ilanları topla".'
        : 'Bu site otomatik aranamıyor. Sitede aramanı yap, sonra eklenti simgesinden "Bu sayfadaki ilanları topla".',
    });
  }
  renderStatus();
  if (!jobs.length) {
    toast('Aranabilecek site yok. Marka ya da model gir veya Siteler sekmesinden site aç.');
    return;
  }

  clearTimeout(persistResults.timer);
  state.results = [];
  state.page = 1;
  state.cursors = {};
  state.perSite = Number(form.perSite) || Number(state.settings.runner.perSite) || 50;
  saveCursors();
  await saveResults([]);
  Object.assign(state.filters, {
    yearMin: form.yearFrom || '',
    yearMax: form.yearTo || '',
    priceMax: form.priceMax || '',
    kmMax: form.kmMax || '',
    country: form.country || 'all',
    onlyMatching: true,
  });
  state.excludedSites.clear();
  syncFilterInputs();
  renderResults();

  await runJobs(jobs);
  const ok = [...state.statuses.values()].filter((s) => s.state === 'done').length;
  const matching = state.query ? state.results.filter((l) => matchesQuery(l, state.query)).length : state.results.length;
  toast(
    matching === state.results.length
      ? `Arama bitti: ${ok} siteden ${state.results.length} ilan.`
      : `Arama bitti: ${ok} siteden ${state.results.length} ilan, ${matching} tanesi aranan marka/modelle eşleşiyor.`,
    5000,
  );
}

function setBusy(busy) {
  $('#search-btn').disabled = busy;
  $('#search-btn').textContent = busy ? 'Aranıyor…' : 'Tüm sitelerde ara';
  $('#stop-btn').hidden = !busy;
}

async function runJobs(jobs) {
  const r = state.settings.runner;
  setBusy(true);
  state.run = runSearch(jobs, {
    mode: r.mode,
    concurrency: Number(r.concurrency) || 3,
    settleMs: num(r.settleMs) ?? 2500,
    timeoutMs: Number(r.timeoutMs) || 45000,
    maxPages: Number(r.maxPages) || 5,
    perSite: state.perSite,
    query: state.query,
    onUpdate,
  });
  renderPager();
  try {
    await state.run.promise;
  } catch (err) {
    toast(`Arama hatası: ${err.message}`, 6000);
  }
  state.run = null;
  setBusy(false);
  renderResults();
}

// Sitelerin sonraki sayfa adresleri saklanır: panel kapanıp açılınca da "devamı" getirilebilir.
function saveCursors() {
  chrome.storage.local.set({ cursors: state.cursors, perSite: state.perSite });
}

const sitesWithMore = () => Object.entries(state.cursors).filter(([, next]) => next).map(([id]) => id);

// Sonraki sayfası olan her siteden bir tur daha ilan getirir.
async function loadMore() {
  if (state.run) return;
  const ids = sitesWithMore();
  if (!ids.length) return;
  const jobs = ids.map((id) => ({ site: state.sites.find((s) => s.id === id), url: state.cursors[id] })).filter((j) => j.site);
  for (const j of jobs) state.cursors[j.site.id] = null;
  saveCursors();
  const before = state.results.length;
  await runJobs(jobs);
  const added = state.results.length - before;
  toast(added ? `${added} yeni ilan eklendi.` : 'Sitelerden yeni ilan gelmedi.');
}

function onUpdate(siteId, st) {
  const { items, diag, next, ...rest } = st;
  state.statuses.set(siteId, rest);
  if (['done', 'empty', 'blocked', 'error', 'login'].includes(st.state)) {
    state.cursors[siteId] = next || null;
    saveCursors();
  }
  if (diag) state.diagnostics[siteId] = diag;
  if (items?.length) {
    state.results = dedupeListings([...state.results, ...items]);
    persistResults();
    renderResults();
  }
  renderStatus();
}

function stopSearch() {
  if (!state.run) return;
  state.run.cancel();
  for (const [id, s] of state.statuses) {
    if (s.state === 'loading' || s.state === 'queued') state.statuses.set(id, { ...s, state: 'cancelled' });
  }
  renderStatus();
}

function statusChip(id, st) {
  const site = state.sites.find((s) => s.id === id);
  const total = state.results.filter((l) => l.siteId === id).length;
  let label = st.state === 'done' ? `${total || st.count} ${STATUS_TEXT.done}` : STATUS_TEXT[st.state];
  if (st.state === 'done' && st.pages > 1) label += ` · ${st.pages} sayfa`;
  if (st.state === 'done' && state.cursors[id]) label += ' · devamı var';
  if (st.state === 'loading' && st.count) label = `${st.count} ilan, devam ediyor…`;
  return h(
    'span',
    {
      class: `chip st-${st.state}`,
      title: `${st.message || ''}${st.message ? '\n' : ''}Tıkla: sitede aç\n${st.url || ''}`,
      onclick: () => st.url && chrome.tabs.create({ url: st.url }),
    },
    h('span', { class: 'dot' }),
    `${COUNTRY_FLAG[site?.country] || ''} ${site?.name || id}: ${label}`,
  );
}

function renderStatus() {
  const box = $('#site-status');
  const entries = [...state.statuses];
  const auto = entries.filter(([, st]) => st.state !== 'manual' && st.state !== 'skipped');
  const skipped = entries.filter(([, st]) => st.state === 'skipped');
  const manual = entries.filter(([, st]) => st.state === 'manual');
  const wasOpen = box.querySelector('details')?.open;
  box.replaceChildren(...[...auto, ...skipped].map(([id, st]) => statusChip(id, st)));
  if (manual.length) {
    box.append(
      h(
        'details',
        { class: 'manual-sites', open: wasOpen || null },
        h('summary', { class: 'chip st-manual' }, h('span', { class: 'dot' }), `Otomatik aranamayan ${manual.length} site`),
        h('p', { class: 'muted' }, 'Bu sitelerde aramayı kendin yap, sonra eklenti simgesinden "Bu sayfadaki ilanları topla"ya bas.'),
        ...manual.map(([id, st]) => statusChip(id, st)),
      ),
    );
  }
}

// ---------- filtreleme ----------
function syncFilterInputs() {
  for (const el of $$('[data-f]')) {
    const v = state.filters[el.dataset.f];
    if (el.type === 'checkbox') el.checked = Boolean(v);
    else el.value = v ?? '';
  }
}

function filteredResults() {
  const f = state.filters;
  const words = f.text.toLocaleLowerCase('tr').split(/\s+/).filter(Boolean);
  const out = state.results.filter((l) => {
    if (f.onlyMatching && state.query && !matchesQuery(l, state.query)) return false;
    if (f.country !== 'all' && l.country !== f.country) return false;
    if (state.excludedSites.has(l.siteId)) return false;
    if (words.length) {
      const t = `${l.title} ${l.summary || ''}`.toLocaleLowerCase('tr');
      if (!words.every((w) => t.includes(w))) return false;
    }
    if (f.yearMin && l.year && l.year < Number(f.yearMin)) return false;
    if (f.yearMax && l.year && l.year > Number(f.yearMax)) return false;
    if (f.kmMax && l.km != null && l.km > Number(f.kmMax)) return false;
    if (f.fuel && l.fuel !== f.fuel) return false;
    if (f.transmission && l.transmission !== f.transmission) return false;
    if (f.rhdOnly && l.steering === 'LHD') return false;
    const p = priceIn(l);
    if (f.hidePriceless && p == null) return false;
    if (f.priceMin && p != null && p < Number(f.priceMin)) return false;
    if (f.priceMax && p != null && p > Number(f.priceMax)) return false;
    if (f.age !== 'all') {
      const a = ageStatus(l, state.settings.kktc);
      if (f.age === 'ok' && a !== 'ok') return false;
      if (f.age === 'okrisky' && a !== 'ok' && a !== 'risky') return false;
    }
    return true;
  });

  const nullsLast = (a, b, dir) => (a == null && b == null ? 0 : a == null ? 1 : b == null ? -1 : dir * (a - b));
  const costOf = (l) => landedCost(l, state.settings, convert)?.total ?? null;
  const sorters = {
    'price-asc': (a, b) => nullsLast(priceIn(a), priceIn(b), 1),
    'price-desc': (a, b) => nullsLast(priceIn(a), priceIn(b), -1),
    'cost-asc': (a, b) => nullsLast(costOf(a), costOf(b), 1),
    'year-desc': (a, b) => nullsLast(a.year && a.year * 12 + (a.month || 0), b.year && b.year * 12 + (b.month || 0), -1),
    'km-asc': (a, b) => nullsLast(a.km, b.km, 1),
    site: (a, b) => a.siteName.localeCompare(b.siteName, 'tr') || nullsLast(priceIn(a), priceIn(b), 1),
  };
  return out.sort(sorters[state.sort] || sorters['price-asc']);
}

function renderSiteFilter() {
  const counts = new Map();
  for (const l of state.results) counts.set(l.siteId, { name: l.siteName, country: l.country, n: (counts.get(l.siteId)?.n || 0) + 1 });
  const box = $('#site-filter');
  box.replaceChildren();
  if (!counts.size) {
    box.append(h('span', { class: 'muted' }, '—'));
    return;
  }
  for (const [id, { name, country, n }] of [...counts].sort((a, b) => a[1].name.localeCompare(b[1].name, 'tr'))) {
    box.append(
      h(
        'label',
        null,
        h('input', {
          type: 'checkbox',
          checked: !state.excludedSites.has(id),
          onchange: (e) => {
            if (e.target.checked) state.excludedSites.delete(id);
            else state.excludedSites.add(id);
            state.page = 1;
            renderResults();
          },
        }),
        `${COUNTRY_FLAG[country] || '🌐'} ${name}`,
        h('span', { class: 'n' }, n),
      ),
    );
  }
}

// ---------- ilan kartları ----------
function ageBadge(l) {
  const a = ageStatus(l, state.settings.kktc);
  const short = { ok: 'KKTC ✓', risky: 'KKTC: sınırda', no: 'KKTC: yaşlı', unknown: 'Yıl ?' }[a];
  return h('span', { class: `badge ${a}`, title: AGE_LABEL[a] }, short);
}

function costLine(l) {
  const c = landedCost(l, state.settings, convert);
  if (!c) return null;
  const f = (v) => formatMoney(v, c.currency);
  return h(
    'div',
    {
      class: 'cost',
      title: `Araç: ${f(c.price)}\nNakliye: ${f(c.shipping)}\nSigorta: ${f(c.insurance)}\nGümrük/vergi: ${f(c.tax)}\nSabit masraf: ${f(c.fees)}`,
    },
    `Tahmini KKTC maliyeti: ${f(c.total)}`,
  );
}

function priceBlock(l) {
  if (l.price == null) return h('div', { class: 'price' }, 'Fiyat sorunuz');
  const conv = priceIn(l);
  return h(
    'div',
    { class: 'price' },
    formatMoney(l.price, l.currency),
    l.currency !== cur() && conv != null ? h('small', null, `≈ ${formatMoney(conv, cur())}`) : null,
    l.priceTotal != null ? h('small', null, `Toplam/CIF: ${formatMoney(l.priceTotal, l.priceTotalCurrency)}`) : null,
    l.auction ? h('small', null, 'Mezat: güncel teklif, son fiyat değil') : null,
  );
}

async function copyInquiry(l) {
  try {
    await navigator.clipboard.writeText(inquiryMessage(l, state.settings.contact));
    toast('Teklif mesajı panoya kopyalandı. İlan sayfasındaki iletişim formuna yapıştırabilirsin.');
  } catch {
    toast('Panoya kopyalanamadı.');
  }
}

async function toggleFavorite(l) {
  if (state.favorites[l.id]) delete state.favorites[l.id];
  else state.favorites[l.id] = { listing: l, status: FAV_STATUSES[0], note: '', addedAt: new Date().toISOString() };
  await saveFavorites(state.favorites);
  updateFavCount();
  renderResults();
}

function image(l, cls) {
  const wrap = h('div', { class: cls });
  if (l.image) {
    const img = h('img', { src: l.image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
    img.addEventListener('error', () => img.replaceWith(h('span', { class: 'noimg' }, 'Görsel yüklenemedi')));
    wrap.append(img);
  } else {
    wrap.append(h('span', { class: 'noimg' }, 'Görsel yok'));
  }
  return wrap;
}

function card(l) {
  const fav = Boolean(state.favorites[l.id]);
  return h(
    'article',
    { class: 'card' },
    h('a', { href: l.url, target: '_blank', rel: 'noopener noreferrer', class: 'img-link' }, image(l, 'img')),
    h(
      'div',
      { class: 'body' },
      h('div', { class: 'badges' }, h('span', { class: 'badge' }, `${COUNTRY_FLAG[l.country] || '🌐'} ${l.siteName}`), ageBadge(l)),
      h('a', { class: 'title', href: l.url, target: '_blank', rel: 'noopener noreferrer', title: l.title }, l.title),
      h('div', { class: 'specs' }, specsText(l) || '—'),
      priceBlock(l),
      costLine(l),
    ),
    h(
      'div',
      { class: 'actions' },
      h(
        'a',
        {
          class: 'btn-a buy',
          href: l.url,
          target: '_blank',
          rel: 'noopener noreferrer',
          title: 'İlanı sitesinde açar. Ödeme ve satın alma güvenlik gereği sitenin kendi sayfasında yapılır.',
        },
        'Sitede satın al ↗',
      ),
      h('button', { type: 'button', class: fav ? 'fav-on' : '', title: 'Takip listesine ekle', onclick: () => toggleFavorite(l) }, fav ? '★' : '☆'),
      h('button', { type: 'button', title: 'Satıcıya teklif mesajını kopyala', onclick: () => copyInquiry(l) }, '✉'),
    ),
  );
}

function renderResults() {
  renderSiteFilter();
  const list = filteredResults();
  const unmatched = state.filters.onlyMatching && state.query ? state.results.filter((l) => !matchesQuery(l, state.query)).length : 0;
  $('#result-count').textContent = state.results.length
    ? `${list.length} / ${state.results.length} ilan${unmatched ? ` · ${unmatched} tanesi aranan marka/modelle eşleşmediği için gizli` : ''}`
    : '';
  $('#empty-state').hidden = state.results.length > 0;
  const size = pageSize();
  const pages = Math.max(1, Math.ceil(list.length / size));
  state.page = Math.min(Math.max(1, state.page), pages);
  $('#results').replaceChildren(...list.slice((state.page - 1) * size, state.page * size).map(card));
  renderPager(pages, list.length);
}

const pageSize = () => Number(state.settings.runner.pageSize) || DEFAULT_PAGE_SIZE;

// 1 2 3 … sayfa tuşları (sonuçların üstünde ve altında).
function renderPager(pages, count) {
  if (pages === undefined) return renderResults();
  const p = state.page;
  const nums = [...new Set([1, p - 2, p - 1, p, p + 1, p + 2, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const more = sitesWithMore().length;
  let info;
  if (state.run) info = 'Sitelerden ilanlar yükleniyor…';
  else if (more) info = `${more} sitede daha fazla ilan var: son sayfaya gelince otomatik getirilir.`;
  else if (count) info = 'Tüm sitelerdeki ilanlar gösterildi.';
  const build = () => {
    const nav = [];
    if (pages > 1 || more) {
      nav.push(h('button', { type: 'button', disabled: p <= 1, onclick: () => goPage(p - 1) }, '‹ Önceki'));
      let last = 0;
      for (const n of nums) {
        if (n - last > 1) nav.push(h('span', { class: 'gap' }, '…'));
        nav.push(h('button', { type: 'button', class: n === p ? 'current' : '', 'aria-current': n === p ? 'page' : null, onclick: () => goPage(n) }, String(n)));
        last = n;
      }
      nav.push(h('button', { type: 'button', disabled: p >= pages && !more, onclick: () => (p >= pages ? loadMore() : goPage(p + 1)) }, p >= pages && more ? 'Daha fazla getir ›' : 'Sonraki ›'));
    }
    return [h('div', { class: 'pager-buttons' }, nav), count ? h('div', { class: 'pager-info muted' }, `Sayfa ${p} / ${pages} · ${count} ilan${info ? ` · ${info}` : ''}`) : null];
  };
  $('#pager').replaceChildren(...build());
  $('#pager-top').replaceChildren(...build());
}

function goPage(n) {
  state.page = n;
  renderResults();
  $('#pager-top').scrollIntoView({ block: 'start' });
  const pages = Math.max(1, Math.ceil(filteredResults().length / pageSize()));
  if (state.page >= pages && sitesWithMore().length) loadMore();
}

// ---------- takip listesi ----------
function updateFavCount() {
  $('#fav-count').textContent = Object.keys(state.favorites).length;
}

function renderFavorites() {
  const box = $('#favorites');
  const favs = Object.values(state.favorites).sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  if (!favs.length) {
    box.replaceChildren(h('div', { class: 'empty' }, 'Takip listen boş. Sonuçlarda ☆ simgesine basarak ilan ekleyebilirsin.'));
    return;
  }
  const save = () => saveFavorites(state.favorites);
  box.replaceChildren(
    ...favs.map((fav) => {
      const l = fav.listing;
      let noteTimer;
      return h(
        'div',
        { class: 'panel fav' },
        l.image ? h('img', { src: l.image, alt: '', referrerpolicy: 'no-referrer' }) : h('div', { class: 'img' }),
        h(
          'div',
          { class: 'meta' },
          h('div', { class: 'badges' }, h('span', { class: 'badge' }, `${COUNTRY_FLAG[l.country] || '🌐'} ${l.siteName}`), ageBadge(l)),
          h('a', { href: l.url, target: '_blank', rel: 'noopener noreferrer' }, h('strong', null, l.title)),
          h('span', { class: 'muted' }, specsText(l)),
          priceBlock(l),
          costLine(l),
          h('span', { class: 'muted' }, `Eklendi: ${new Date(fav.addedAt).toLocaleString('tr-TR')}`),
        ),
        h(
          'div',
          { class: 'side' },
          h(
            'select',
            {
              onchange: (e) => {
                fav.status = e.target.value;
                save();
              },
            },
            FAV_STATUSES.map((s) => h('option', { value: s, selected: s === fav.status }, s)),
          ),
          h('textarea', {
            placeholder: 'Not (satıcı yanıtı, pazarlık, şasi no…)',
            value: fav.note,
            oninput: (e) => {
              fav.note = e.target.value;
              clearTimeout(noteTimer);
              noteTimer = setTimeout(save, 500);
            },
          }),
          h(
            'div',
            { class: 'btns' },
            h('a', { class: 'btn-a', href: l.url, target: '_blank', rel: 'noopener noreferrer' }, 'İlana git'),
            h('button', { type: 'button', onclick: () => copyInquiry(l) }, 'Mesajı kopyala'),
            h(
              'button',
              {
                type: 'button',
                onclick: async () => {
                  delete state.favorites[l.id];
                  await save();
                  updateFavCount();
                  renderFavorites();
                  renderResults();
                },
              },
              'Kaldır',
            ),
          ),
        ),
      );
    }),
  );
}

// ---------- siteler ----------
function renderSites() {
  const box = $('#sites-table');
  box.replaceChildren();
  const overrides = state.settings.siteOverrides;
  const update = async (id, patch) => {
    overrides[id] = { ...overrides[id], ...patch };
    await persistSettings();
  };
  for (const country of ['JP', 'UK']) {
    box.append(h('div', { class: 'site-group' }, `${COUNTRY_FLAG[country]} ${COUNTRY_LABEL[country]}`));
    for (const s of state.sites.filter((x) => x.country === country)) {
      const def = SITES.find((x) => x.id === s.id);
      const tplInput = h('textarea', {
        class: 'tpl',
        rows: Math.max(1, s.templates.length),
        value: s.templates.join('\n'),
        placeholder: 'Şablon yok: yalnızca "Sitede aç" + sayfayı topla',
        title: 'Her satıra bir şablon. Üstteki önce denenir; alanlar eksikse alttakine geçilir.',
        onchange: async (e) => {
          const list = e.target.value.split('\n').map((x) => x.trim()).filter(Boolean);
          if (list.join('\n') === def.templates.join('\n')) {
            if (overrides[s.id]) {
              delete overrides[s.id].templates;
              delete overrides[s.id].template;
            }
            await persistSettings();
          } else {
            await update(s.id, { templates: list, template: undefined, enabled: list.length > 0 });
          }
          renderSites();
        },
      });
      box.append(
        h(
          'div',
          { class: 'site-row' },
          h('input', {
            type: 'checkbox',
            checked: s.enabled,
            disabled: !s.templates.length,
            title: s.templates.length ? 'Otomatik aramaya dahil et' : 'Şablon olmadan otomatik aranamaz',
            onchange: (e) => update(s.id, { enabled: e.target.checked }),
          }),
          h(
            'div',
            { class: 'name' },
            h('a', { href: s.home, target: '_blank', rel: 'noopener noreferrer' }, s.name),
            h('div', { class: 'sub' }, [KIND_LABEL[s.kind], s.currency, s.login ? 'üyelik gerekli' : null].filter(Boolean).join(' · ')),
          ),
          h(
            'div',
            { class: 'kind' },
            s.templates.length
              ? s.customTemplate
                ? h('span', { class: 'badge risky' }, 'Özel şablon')
                : s.verified
                  ? h('span', { class: 'badge ok', title: 'URL yapısı sitenin gerçek sayfalarıyla doğrulandı' }, 'Doğrulandı')
                  : h('span', { class: 'badge risky', title: 'URL yapısı doğrulanamadı; sonuç gelmezse şablonu düzenle' }, 'Doğrulanmadı')
              : h('span', { class: 'badge' }, 'Manuel'),
          ),
          tplInput,
          h(
            'div',
            { class: 'btns' },
            h(
              'button',
              {
                type: 'button',
                disabled: !s.templates.length,
                title: 'Toyota Prius örneğiyle arama URL\'sini aç',
                onclick: () => {
                  const url = buildFirstUrl(s.templates, searchVars({ make: 'Toyota', model: 'Prius', currency: cur() }, s, convert));
                  if (url) chrome.tabs.create({ url });
                  else toast('Şablon bu örnekle URL üretemedi.');
                },
              },
              'Dene',
            ),
            h('button', { type: 'button', onclick: () => chrome.tabs.create({ url: s.home }) }, 'Sitede aç'),
          ),
        ),
      );
    }
  }
}

// ---------- site testi ----------
let siteTest = null; // { startedAt, rows: Map(siteId -> {site, status, items, diag, metrics}) }

async function runSiteTest() {
  if (state.run || siteTest?.running) return toast('Önce devam eden aramanın bitmesini bekle.');
  const sites = state.sites.filter((s) => s.enabled && s.templates.length);
  const vars = { ...TEST_QUERY, keyword: '', currency: cur(), postcode: state.settings.postcode };
  const jobs = [];
  siteTest = { running: true, startedAt: new Date().toISOString(), rows: new Map() };
  for (const site of sites) {
    const url = buildFirstUrl(site.templates, searchVars(vars, site, convert));
    siteTest.rows.set(site.id, { site, status: url ? { state: 'queued' } : { state: 'skipped', message: 'Şablon URL üretemedi' }, items: [] });
    if (url) jobs.push({ site, url });
  }
  $('#run-site-test').disabled = true;
  $('#download-site-test').disabled = true;
  renderSiteTest();
  const r = state.settings.runner;
  const run = runSearch(jobs, {
    mode: r.mode,
    concurrency: Number(r.concurrency) || 3,
    settleMs: num(r.settleMs) ?? 2500,
    timeoutMs: Number(r.timeoutMs) || 45000,
    maxPages: 1,
    query: TEST_QUERY,
    onUpdate: (id, st) => {
      const row = siteTest.rows.get(id);
      const { items, diag, ...status } = st;
      row.status = status;
      if (items) row.items = items;
      if (diag) row.diag = diag;
      renderSiteTest();
    },
  });
  try {
    await run.promise;
  } finally {
    siteTest.running = false;
    siteTest.finishedAt = new Date().toISOString();
    $('#run-site-test').disabled = false;
    $('#download-site-test').disabled = false;
    renderSiteTest();
  }
}

function renderSiteTest() {
  const box = $('#site-test-result');
  if (!siteTest) return box.replaceChildren();
  const verdictBadge = { ok: ['ok', 'Çalışıyor'], warn: ['risky', 'Sorunlu'], fail: ['no', 'Çalışmıyor'] };
  let ok = 0;
  let done = 0;
  const rows = [...siteTest.rows.values()].map((row) => {
    const running = ['queued', 'loading'].includes(row.status.state);
    row.metrics = running ? null : evaluateSite(row.items, row.status);
    if (row.metrics) done++;
    if (row.metrics?.verdict === 'ok') ok++;
    const m = row.metrics;
    const [cls, text] = m ? verdictBadge[m.verdict] : ['', row.status.state === 'queued' ? 'Sırada' : 'Test ediliyor…'];
    const sample = m?.sample;
    return h(
      'tr',
      null,
      h('td', null, `${COUNTRY_FLAG[row.site.country]} `, h('a', { href: row.status.url || row.site.home, target: '_blank', rel: 'noopener noreferrer' }, row.site.name)),
      h('td', null, h('span', { class: `badge ${cls}` }, text), m?.problems.length ? h('div', { class: 'sample' }, m.problems.join(' · ')) : null),
      h('td', { class: 'num' }, m ? `${m.count} / ${m.matching}` : ''),
      h('td', { class: 'num hide-sm' }, m && m.count ? `${m.pricePct}% · ${m.yearPct}% · ${m.kmPct}%` : ''),
      h('td', { class: 'num hide-sm' }, m ? String(m.duplicates) : ''),
      h('td', { class: 'hide-sm' }, row.diag?.pages?.map((p) => ({ fetch: 'indirme', tab: 'sekme' })[p.method]).filter(Boolean).join(', ') || ''),
      h(
        'td',
        { class: 'sample' },
        sample ? `${sample.title} — ${sample.price != null ? formatMoney(sample.price, sample.currency) : 'fiyat ?'} · ${sample.year || 'yıl ?'} · ${sample.km != null ? `${fmtInt(sample.km)} km` : 'km ?'}` : '',
      ),
    );
  });
  box.replaceChildren(
    h('div', { class: 'test-summary' }, siteTest.running ? `Test ediliyor: ${done} / ${siteTest.rows.size} site bitti` : `${siteTest.rows.size} siteden ${ok} tanesi sorunsuz çalışıyor.`),
    h(
      'table',
      { class: 'test-table' },
      h(
        'thead',
        null,
        h('tr', null, h('th', null, 'Site'), h('th', null, 'Sonuç'), h('th', null, 'İlan / eşleşen'), h('th', { class: 'hide-sm' }, 'Fiyat · yıl · km okunan'), h('th', { class: 'hide-sm' }, 'Kopya'), h('th', { class: 'hide-sm' }, 'Yöntem'), h('th', null, 'Örnek ilan')),
      ),
      h('tbody', null, rows),
    ),
  );
}

function downloadSiteTest() {
  if (!siteTest) return;
  const report = {
    kind: 'site-test',
    extension: chrome.runtime.getManifest().version,
    startedAt: siteTest.startedAt,
    finishedAt: siteTest.finishedAt,
    userAgent: navigator.userAgent,
    runner: state.settings.runner,
    query: TEST_QUERY,
    sites: Object.fromEntries(
      [...siteTest.rows].map(([id, row]) => [
        id,
        {
          status: row.status,
          metrics: row.metrics && { ...row.metrics, sample: row.metrics.sample && { title: row.metrics.sample.title, url: row.metrics.sample.url, price: row.metrics.sample.price, currency: row.metrics.sample.currency, year: row.metrics.sample.year, km: row.metrics.sample.km } },
          listings: row.items.slice(0, 5).map((l) => ({ title: l.title, url: l.url, price: l.price, currency: l.currency, year: l.year, month: l.month, km: l.km })),
          diag: row.diag,
        },
      ]),
    ),
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: `kktc-arac-site-testi-${Date.now()}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- ayarlar ----------
function fillCurrencySelect(sel) {
  sel.replaceChildren(...CURRENCIES.map((c) => h('option', { value: c }, c)));
}

function renderSettings() {
  const form = $('#settings-form');
  fillCurrencySelect(form.elements.displayCurrency);
  $$('select[data-currency]', form).forEach(fillCurrencySelect);
  for (const el of form.elements) {
    if (!el.name || el.name.startsWith('rate.')) continue;
    const v = getPath(state.settings, el.name);
    el.value = v ?? '';
  }
  const rates = state.settings.rates?.rates || {};
  $('#rates-inputs').replaceChildren(
    ...CURRENCIES.filter((c) => c !== 'USD').map((c) =>
      h('label', null, `1 USD = ? ${c}`, h('input', { name: `rate.${c}`, type: 'number', step: 'any', min: '0', value: rates[c] ?? '' })),
    ),
  );
  const r = state.settings.rates;
  $('#rates-info').textContent = r
    ? `Son güncelleme: ${new Date(r.updatedAt).toLocaleString('tr-TR')} (${r.manual ? 'elle girildi' : r.source})`
    : 'Kur bilgisi yok.';
}

async function saveSettingsForm(e) {
  e.preventDefault();
  const form = $('#settings-form');
  const numeric = new Set(['kktc.maxAgeYears', 'kktc.shippingMonths', 'runner.concurrency', 'runner.settleMs', 'runner.timeoutMs', 'runner.maxPages', 'runner.perSite', 'runner.pageSize']);
  const newRates = { USD: 1 };
  let ratesChanged = false;
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.name.startsWith('rate.')) {
      const c = el.name.slice(5);
      const v = num(el.value);
      newRates[c] = v;
      if (v !== (state.settings.rates?.rates?.[c] ?? null)) ratesChanged = true;
      continue;
    }
    setPath(state.settings, el.name, numeric.has(el.name) ? num(el.value) : el.value.trim());
  }
  if (ratesChanged) {
    if (CURRENCIES.some((c) => !(newRates[c] > 0))) {
      toast('Kurların hepsi pozitif sayı olmalı.');
      return;
    }
    state.settings.rates = { rates: newRates, updatedAt: new Date().toISOString(), source: 'manuel', manual: true };
  }
  await persistSettings();
  applyCurrencyLabels();
  renderSettings();
  renderResults();
  toast('Ayarlar kaydedildi.');
}

function applyCurrencyLabels() {
  $$('.cur-label').forEach((el) => (el.textContent = `(${cur()})`));
}

// ---------- tanı raporu ----------
// Sorun bildirmek için: her sitenin istenen/ulaşılan adresi, yöntemi (indirme/sekme),
// bulunan ilan sayısı ve sayfada tanınan kart yapılarından örnekler. Kişisel ayarlar eklenmez.
function downloadDiagnostics() {
  const report = {
    extension: chrome.runtime.getManifest().version,
    date: new Date().toISOString(),
    userAgent: navigator.userAgent,
    runner: state.settings.runner,
    query: state.query,
    statuses: Object.fromEntries([...state.statuses].map(([id, st]) => [id, st])),
    sites: state.diagnostics,
    results: { total: state.results.length, perSite: Object.fromEntries(countBy(state.results, (l) => l.siteId)) },
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: `kktc-arac-tani-${Date.now()}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function countBy(list, fn) {
  const m = new Map();
  for (const x of list) m.set(fn(x), (m.get(fn(x)) || 0) + 1);
  return m;
}

// ---------- CSV ----------
function downloadCsv(filename, rows, cols) {
  const esc = (v) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = `'${s}`;
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.map((c) => c[0]), ...rows.map((r) => cols.map((c) => c[1](r)))];
  const blob = new Blob(['﻿' + lines.map((l) => l.map(esc).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function listingCols() {
  const round = (v) => (v == null ? '' : Math.round(v));
  return [
    ['Site', (l) => l.siteName],
    ['Ülke', (l) => COUNTRY_LABEL[l.country] || ''],
    ['Başlık', (l) => l.title],
    ['Yıl', (l) => l.year ?? ''],
    ['Ay', (l) => l.month ?? ''],
    ['Km', (l) => l.km ?? ''],
    ['Yakıt', (l) => FUEL_LABEL[l.fuel] || ''],
    ['Vites', (l) => TRANSMISSION_LABEL[l.transmission] || ''],
    ['Fiyat', (l) => l.price ?? ''],
    ['Para birimi', (l) => l.currency ?? ''],
    [`Fiyat (${cur()})`, (l) => round(priceIn(l))],
    [`Tahmini maliyet (${cur()})`, (l) => round(landedCost(l, state.settings, convert)?.total)],
    ['KKTC yaş', (l) => AGE_LABEL[ageStatus(l, state.settings.kktc)]],
    ['URL', (l) => l.url],
  ];
}

// ---------- başlatma ----------
async function init() {
  state.settings = await getSettings();
  state.sites = applySiteOverrides(state.settings.siteOverrides);
  convert = makeConverter(state.settings.rates?.rates);
  state.results = await getResults();
  state.favorites = await getFavorites();

  $('#makes').replaceChildren(...MAKES.map((m) => h('option', { value: m })));
  const { lastSearch, lastQuery, cursors, perSite } = await chrome.storage.local.get(['lastSearch', 'lastQuery', 'cursors', 'perSite']);
  state.query = lastQuery || null;
  state.cursors = cursors || {};
  state.perSite = perSite || Number(state.settings.runner.perSite) || 50;
  if (lastSearch) {
    for (const [k, v] of Object.entries(lastSearch)) {
      const el = $('#search-form').elements[k];
      if (el) el.value = v;
    }
  }

  // Olaylar
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  $('#search-form').addEventListener('submit', startSearch);
  $('#stop-btn').addEventListener('click', stopSearch);
  $('#sort').addEventListener('change', (e) => {
    state.sort = e.target.value;
    renderResults();
  });
  $('#filters').addEventListener('input', (e) => {
    const k = e.target.dataset.f;
    if (!k) return;
    state.filters[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    state.page = 1;
    renderResults();
  });
  $('#reset-filters').addEventListener('click', () => {
    state.filters = { ...DEFAULT_FILTERS };
    state.excludedSites.clear();
    syncFilterInputs();
    renderResults();
  });
  $('#clear-results').addEventListener('click', async () => {
    if (!confirm('Tüm arama sonuçları silinsin mi? (Takip listesi korunur.)')) return;
    clearTimeout(persistResults.timer);
    state.results = [];
    state.cursors = {};
    saveCursors();
    state.page = 1;
    state.statuses.clear();
    await saveResults([]);
    renderStatus();
    renderResults();
  });
  $('#export-results').addEventListener('click', () => downloadCsv('kktc-arac-sonuclar.csv', filteredResults(), listingCols()));
  $('#export-diag').addEventListener('click', downloadDiagnostics);
  $('#export-favorites').addEventListener('click', () => {
    const favs = Object.values(state.favorites);
    const cols = [...listingCols(), ['Durum', (f) => f.status], ['Not', (f) => f.note]].map(([n, fn], i, arr) =>
      i < arr.length - 2 ? [n, (f) => fn(f.listing)] : [n, fn],
    );
    downloadCsv('kktc-arac-takip.csv', favs, cols);
  });
  $('#run-site-test').addEventListener('click', runSiteTest);
  $('#download-site-test').addEventListener('click', downloadSiteTest);
  $('#reset-sites').addEventListener('click', async () => {
    if (!confirm('Tüm site ayarları ve özel şablonlar varsayılana dönsün mü?')) return;
    state.settings.siteOverrides = {};
    await persistSettings();
    renderSites();
  });
  $('#settings-form').addEventListener('submit', saveSettingsForm);
  $('#fetch-rates').addEventListener('click', async () => {
    await ensureRates(true);
    renderSettings();
    renderResults();
  });

  // Eklenti simgesinden "Bu sayfadaki ilanları topla" ile eklenen sonuçlar.
  // Kendi kayıtlarımız da buraya düşer; birleştirme yalnızca yeni ilanları ekler.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.results) return;
    const known = new Set(state.results.map((x) => x.id));
    const fresh = (changes.results.newValue || []).filter((it) => !known.has(it.id));
    if (!fresh.length) return;
    const before = state.results.length;
    state.results = dedupeListings([...state.results, ...fresh]);
    if (state.results.length !== before) renderResults();
  });

  applyCurrencyLabels();
  syncFilterInputs();
  updateFavCount();
  renderResults();
  let tab = 'results';
  try {
    tab = localStorage.getItem('tab') || 'results';
  } catch {}
  showTab(tab);

  await ensureRates();
  renderResults();
}

init();
