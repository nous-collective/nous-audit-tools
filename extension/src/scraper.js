// İlan okuyucu. Site başına sabit seçici kullanmaz:
//   1) JSON-LD (schema.org Car / Vehicle / Product) verisini okur,
//   2) sayfada tekrar eden, bağlantı + fiyat/km içeren kart yapılarını bulur.
// İki şekilde çalışır:
//   - sekmeye enjekte edilir: run({ scroll: true }) canlı sayfayı okur,
//   - panelde yüklenir: run({ doc, baseUrl }) indirilmiş HTML'i (DOMParser) okur.
// Sonuç ham veridir; ayrıştırma ve tekrar ayıklama normalize.js'te yapılır.
(() => {
  if (globalThis.__kktcScraper) return;

  // normalize.js'teki PRICE_PATTERN ile aynı olmalı (testte kontrol edilir).
  const PRICE_SRC =
    "(US\\s?\\$|USD|JP¥|\\$|£|GBP|¥|￥|JPY|€|EUR|₺|TRY|TL)\\s?(\\d{1,3}(?:[,.\\u00a0\\u202f']\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)(\\s?万)?|(\\d{1,3}(?:[,.\\u00a0\\u202f']\\d{3})+|\\d+(?:\\.\\d+)?)\\s?(万円|円|JPY|USD|GBP|EUR|€|₺|TRY|TL)(?![A-Za-z\\d])";
  const KM_RE = /\d\s?(km|kms|miles|mi)\b/i;
  const YEAR_RE = /\b(19[89]\d|20[0-4]\d)\b/;
  const VEHICLE_RE =
    /\b(toyota|nissan|honda|mazda|mitsubishi|subaru|suzuki|daihatsu|lexus|isuzu|bmw|mercedes|audi|volkswagen|vw|land rover|range rover|jaguar|mini|ford|vauxhall|peugeot|renault|citroen|kia|hyundai|volvo|skoda|seat|fiat|porsche|tesla|mileage|odometer|sedan|saloon|hatchback|estate|wagon|suv|coupe|minivan|mpv|4wd|awd|hybrid|petrol|diesel|automatic|manual)\b/i;
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'HEAD', 'IFRAME', 'SELECT', 'OPTION']);
  const BAD_LINK = /(inquir|enquir|contact|login|log-in|signin|sign-in|register|favou?rite|watchlist|compare|wishlist|javascript:|mailto:|tel:|whatsapp|facebook|twitter|share)/i;
  const BAD_IMG = /(icon|logo|flag|sprite|badge|loading|placeholder|spacer|blank\.gif|pixel|avatar)/i;
  const BLOCK_RE = /(just a moment|attention required|access denied|are you a robot|verify you are human|pardon our interruption|captcha|unusual traffic|request blocked)/i;
  const CLONE_CLASS = /(^|\s)(slick-cloned|swiper-slide-duplicate|clone|cloned)(\s|$)/i;
  const NEXT_TEXT = /^(next|next page|›|»|>|→|sonraki|次へ|次|次のページ)$/i;
  // İlan numarası taşıyan sorgu parametresi (liste ile detay aynı adresi kullanıyorsa).
  const ID_QUERY = /(^|[?&])(id|refno|ref_?no|stock_?(no|id)?|item_?id|lot_?(id|no)?|car_?id|vehicle_?id|vid|ad_?id|advert_?id|listing_?id|product_?id|pid)=[^&]/i;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const cls = (el) => (typeof el.getAttribute === 'function' ? el.getAttribute('class') || '' : '');

  // innerText düzen hesaplatır ve yavaştır; textContent ise hücre/öğe sınırlarını
  // yapıştırır ("Mileage40000"). Metin düğümlerini boşlukla birleştiriyoruz.
  function textOf(ctx, el) {
    const parts = [];
    const walker = ctx.doc.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (SKIP_TAGS.has(n.parentElement?.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.nodeValue.trim();
      if (t) parts.push(t);
    }
    return norm(parts.join(' '));
  }

  function priceTexts(text) {
    const out = [];
    for (const m of text.matchAll(new RegExp(PRICE_SRC, 'gi'))) {
      out.push({
        text: m[0],
        label: text.slice(Math.max(0, m.index - 30), m.index),
        after: text.slice(m.index + m[0].length, m.index + m[0].length + 20),
      });
      if (out.length >= 6) break;
    }
    return out;
  }

  function absUrl(ctx, u) {
    if (!u) return null;
    try {
      const url = new URL(u, ctx.base);
      return /^https?:$/.test(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  }

  // Görünmeyen kopyalar (mobil/masaüstü ikinci sürüm, karusel klonları) ilan sayılmaz.
  // aria-hidden'a bakılmaz: çerez pencereleri açıkken tüm içeriğe aria-hidden koyan siteler var.
  function isHidden(ctx, el) {
    for (let n = el; n && n !== ctx.doc.body; n = n.parentElement) {
      if (n.hidden || CLONE_CLASS.test(cls(n))) return true;
      if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(n.getAttribute('style') || '')) return true;
    }
    if (!ctx.layout || el.getClientRects().length) return false;
    // display: contents kutusuz ama çocukları görünür.
    return ![...el.children].some((c) => c.getClientRects().length);
  }

  function firstSrcset(v) {
    return v ? v.split(',')[0].trim().split(/\s+/)[0] : null;
  }

  function imageOf(ctx, el) {
    const imgs = el.tagName === 'IMG' ? [el] : el.querySelectorAll('img, source');
    for (const img of imgs) {
      const cands = [
        img.getAttribute('data-src'),
        img.getAttribute('data-original'),
        img.getAttribute('data-lazy-src'),
        img.getAttribute('data-lazy'),
        firstSrcset(img.getAttribute('data-srcset')),
        img.currentSrc,
        img.getAttribute('src'),
        firstSrcset(img.getAttribute('srcset')),
      ];
      for (const c of cands) {
        if (!c || c.startsWith('data:') || BAD_IMG.test(c)) continue;
        const w = img.naturalWidth || Number(img.getAttribute('width')) || 999;
        if (w < 40) continue;
        const abs = absUrl(ctx, c);
        if (abs) return abs;
      }
    }
    for (const n of el.querySelectorAll('[style*="background"]')) {
      const m = n.getAttribute('style').match(/url\(["']?([^"')]+)["']?\)/);
      if (m && !BAD_IMG.test(m[1])) {
        const abs = absUrl(ctx, m[1]);
        if (abs) return abs;
      }
    }
    return null;
  }

  function bestLink(ctx, el) {
    const anchors = [...el.querySelectorAll('a[href]')];
    const up = el.closest('a[href]');
    if (up) anchors.unshift(up);
    const page = new URL(ctx.base);
    let best = null;
    let bestScore = -Infinity;
    for (const a of anchors) {
      const href = absUrl(ctx, a.getAttribute('href'));
      if (!href) continue;
      const u = new URL(href);
      // Aynı arama sayfasının filtre/sıralama bağlantıları ilan değildir (ilan numarası taşımıyorsa).
      if (u.origin === page.origin && u.pathname === page.pathname && !ID_QUERY.test(u.search)) continue;
      if (BAD_LINK.test(href) || BAD_LINK.test(a.textContent || '')) continue;
      let score = 0;
      if (a.querySelector('img')) score += 3;
      if (a.querySelector('h1,h2,h3,h4,h5,h6')) score += 3;
      const t = textOf(ctx, a);
      if (t.length >= 8 && t.length <= 160) score += 2;
      if (/\d{4,}/.test(u.pathname + u.search)) score += 2;
      if (/(detail|stock|vehicle|car|product|listing|lot|item|advert|ad)\b/i.test(href)) score += 1;
      if (u.origin !== page.origin) score -= 3;
      if (a === up) score += 2;
      if (score > bestScore) {
        bestScore = score;
        best = { href, title: a.getAttribute('title') };
      }
    }
    if (best) {
      // Aynı ilana giden bağlantıların metinleri (görsel bağlantısı boş olabilir).
      best.texts = anchors
        .filter((a) => absUrl(ctx, a.getAttribute('href')) === best.href)
        .map((a) => textOf(ctx, a))
        .filter((t) => t.length >= 4 && t.length <= 200);
    }
    return best;
  }

  function titleOf(ctx, el, link) {
    const h = el.querySelector('h1,h2,h3,h4,h5,h6,[class*="title" i],[class*="heading" i],[class*="name" i]');
    const cands = [h && textOf(ctx, h), link?.title, ...(link?.texts || []), el.querySelector('img[alt]')?.getAttribute('alt')];
    for (const c of cands) {
      const t = norm(c);
      if (t.length >= 4 && t.length <= 200 && !/^(view|details|more|see more|more info|view details)$/i.test(t)) return t;
    }
    return null;
  }

  // ---------- 1) JSON-LD ----------
  function fromJsonLd(ctx) {
    const out = [];
    const types = /^(Car|Vehicle|Product|Motorcycle|MotorizedBicycle|BusOrCoach)$/i;
    const walk = (node, depth = 0) => {
      if (!node || typeof node !== 'object' || depth > 8) return;
      if (Array.isArray(node)) return node.forEach((n) => walk(n, depth + 1));
      const t = [].concat(node['@type'] || []).map(String);
      if (t.some((x) => types.test(x))) {
        const item = jsonLdItem(ctx, node);
        if (item) out.push(item);
      }
      for (const k of ['@graph', 'itemListElement', 'item', 'mainEntity', 'about']) {
        if (node[k]) walk(node[k], depth + 1);
      }
    };
    for (const s of ctx.doc.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        walk(JSON.parse(s.textContent));
      } catch {}
    }
    return out;
  }

  function jsonLdItem(ctx, n) {
    const offers = [].concat(n.offers || [])[0] || {};
    const id = typeof n['@id'] === 'string' && /^https?:/.test(n['@id']) ? n['@id'] : '';
    const url = absUrl(ctx, n.url || offers.url || id || ctx.base);
    const name = norm(n.name || [n.brand?.name || n.brand, n.model?.name || n.model].filter((x) => typeof x === 'string').join(' '));
    if (!url || !name) return null;
    const img = [].concat(n.image || [])[0];
    const odo = n.mileageFromOdometer || {};
    const odoVal = Number(String(odo.value ?? '').replace(/[^\d.]/g, ''));
    const date = String(n.dateVehicleFirstRegistered || n.productionDate || n.vehicleModelDate || n.modelDate || '');
    const ym = date.match(/(19|20)\d{2}(?:-(\d{2}))?/);
    return {
      url,
      title: name,
      image: absUrl(ctx, typeof img === 'string' ? img : img?.url || img?.contentUrl || ''),
      priceTexts: [],
      text: norm(n.description).slice(0, 800),
      source: 'jsonld',
      structured: {
        price: Number(offers.price ?? offers.lowPrice) || null,
        currency: offers.priceCurrency || null,
        year: ym ? Number(ym[0].slice(0, 4)) : null,
        month: ym?.[2] ? Number(ym[2]) : null,
        km: odoVal ? (/SMI|mi/i.test(odo.unitCode || odo.unitText || '') ? Math.round(odoVal * 1.609344) : odoVal) : null,
        fuel: typeof n.fuelType === 'string' ? n.fuelType : null,
        transmission: typeof n.vehicleTransmission === 'string' ? n.vehicleTransmission : null,
        make: typeof n.brand === 'string' ? n.brand : n.brand?.name || null,
      },
    };
  }

  // ---------- 2) Tekrar eden kart yapıları ----------
  function signature(el) {
    const c = cls(el)
      .split(/\s+/)
      .map((x) => x.replace(/\d+/g, '#'))
      .filter((x) => x && !/^(active|selected|odd|even|first|last|hover|focus|visible|is-|has-|js-|swiper-slide-(?:active|next|prev))/.test(x))
      .sort()
      .join('.');
    return `${el.tagName}|${c}`;
  }

  function fromRepeatedCards(ctx, diag) {
    const groups = new Map(); // imza -> öğeler
    for (const parent of ctx.doc.body.querySelectorAll('*')) {
      if (SKIP_TAGS.has(parent.tagName) || parent.children.length < 2) continue;
      const bySig = new Map();
      for (const k of parent.children) {
        if (SKIP_TAGS.has(k.tagName)) continue;
        const s = signature(k);
        if (!bySig.has(s)) bySig.set(s, []);
        bySig.get(s).push(k);
      }
      for (const [s, els] of bySig) {
        if (els.length < 2) continue;
        if (!groups.has(s)) groups.set(s, []);
        groups.get(s).push(...els);
      }
    }

    const scored = [];
    for (const [sig, els] of groups) {
      if (els.length < 3) continue;
      let good = 0;
      let withImg = 0;
      let withYear = 0;
      let withPriceOrKm = 0;
      let priceCount = 0;
      let textLen = 0;
      const cards = [];
      for (const el of els) {
        const text = textOf(ctx, el);
        if (text.length < 15 || text.length > 3000) continue;
        const hasLink = el.closest('a[href]') || el.querySelector('a[href]');
        if (!hasLink) continue;
        const prices = priceTexts(text);
        const hasKm = KM_RE.test(text);
        const hasYear = YEAR_RE.test(text);
        const hasImg = Boolean(el.querySelector('img, source, [style*="background"]'));
        // Fiyatı "ASK" olan ya da yalnızca üyelere gösteren sitelerde yıl + görsel + araç kelimesi yeterli.
        if (!prices.length && !hasKm && !(hasYear && hasImg && VEHICLE_RE.test(text))) continue;
        good++;
        priceCount += prices.length;
        textLen += text.length;
        if (hasImg) withImg++;
        if (hasYear) withYear++;
        if (prices.length || hasKm) withPriceOrKm++;
        cards.push({ el, text, prices });
      }
      if (good < 3 || good / els.length < 0.5) continue;
      const imgFrac = withImg / good;
      // Kısa metinli, görselsiz tekrarlar (fiyat aralığı filtreleri vb.) ilan değildir.
      if (textLen / good < 25 && imgFrac < 0.3) continue;
      const pkFrac = withPriceOrKm / good;
      let score = good * (1 + imgFrac + withYear / good + 2 * pkFrac);
      if (priceCount / good > 4) score *= 0.3; // muhtemelen birden fazla kart içeren satır
      scored.push({ sig, score, pkFrac, total: els.length, good, cards });
    }
    scored.sort((a, b) => b.score - a.score);
    diag.groups = scored.slice(0, 5).map((g) => ({
      signature: g.sig,
      total: g.total,
      good: g.good,
      score: Math.round(g.score),
      sampleText: g.cards[0].text.slice(0, 240),
      sampleHtml: g.cards[0].el.outerHTML.slice(0, 1500),
    }));
    if (!scored.length) return [];

    const top = scored[0];
    const chosen = scored
      .filter((g) => g.score >= top.score * 0.4 && !(top.pkFrac >= 0.5 && g.pkFrac < 0.3))
      .slice(0, 4);
    // Tüm adaylar gizli görünüyorsa (beklenmedik düzen durumu) gizlilik denetimi atlanır.
    const allHidden = chosen.every((g) => g.cards.every((c) => isHidden(ctx, c.el)));
    const out = [];
    const used = [];
    let hidden = 0;
    for (const g of chosen) {
      for (const { el, text, prices } of g.cards) {
        // İç içe seçilmiş gruplarda aynı kartı iki kez alma.
        if (used.some((u) => u.contains(el) || el.contains(u))) continue;
        if (!allHidden && isHidden(ctx, el)) {
          hidden++;
          continue;
        }
        const link = bestLink(ctx, el);
        if (!link) continue;
        used.push(el);
        out.push({
          url: link.href,
          title: titleOf(ctx, el, link),
          image: imageOf(ctx, el),
          priceTexts: prices,
          text: text.slice(0, 800),
          source: 'dom',
          structured: null,
        });
      }
    }
    diag.hiddenSkipped = hidden;
    return out;
  }

  // Sonraki sayfa bağlantısı (rel=next, "Next", "›", "次へ"…).
  function nextPageUrl(ctx) {
    const page = new URL(ctx.base);
    const cands = [
      ctx.doc.querySelector('link[rel~="next"]')?.getAttribute('href'),
      ctx.doc.querySelector('a[rel~="next"]')?.getAttribute('href'),
    ];
    for (const a of ctx.doc.querySelectorAll('a[href]')) {
      const label = `${a.getAttribute('aria-label') || ''} ${a.getAttribute('title') || ''}`;
      if (NEXT_TEXT.test(norm(a.textContent)) || /\bnext\b/i.test(label) || /(^|[\s_-])(next|pagination-next|pager-next)([\s_-]|$)/i.test(cls(a))) {
        cands.push(a.getAttribute('href'));
      }
    }
    for (const c of cands) {
      const u = absUrl(ctx, c);
      if (u && new URL(u).origin === page.origin && u.split('#')[0] !== ctx.base.split('#')[0]) return u;
    }
    return null;
  }

  async function autoScroll(steps) {
    const step = Math.max(window.innerHeight || 0, 800);
    let last = -1;
    for (let i = 0; i < steps; i++) {
      window.scrollBy(0, step);
      await sleep(300);
      const h = document.documentElement.scrollHeight;
      if (window.scrollY + step >= h && h === last) break;
      last = h;
    }
    window.scrollTo(0, 0);
  }

  function baseOf(doc, url) {
    const b = doc.querySelector('base[href]')?.getAttribute('href');
    try {
      return b ? new URL(b, url).href : url;
    } catch {
      return url;
    }
  }

  /**
   * opts.doc     : okunacak belge (varsayılan: bu sayfa)
   * opts.baseUrl : belgenin gerçek adresi (indirilmiş HTML için zorunlu)
   * opts.scroll  : geç yüklenen içerik için sayfayı kaydır (yalnızca canlı sayfada)
   */
  async function run(opts = {}) {
    const live = !opts.doc;
    const doc = opts.doc || document;
    const url = opts.baseUrl || location.href;
    const ctx = { doc, base: baseOf(doc, url), layout: live };
    if (live && opts.scroll) await autoScroll(opts.scrollSteps ?? 12);

    const diag = { title: doc.title, anchors: doc.querySelectorAll('a[href]').length };
    if (!doc.body) return { url, title: doc.title, blocked: false, items: [], next: null, diag };
    const bodyText = norm(live ? doc.body.innerText : doc.body.textContent).slice(0, 3000);
    diag.bodyTextSample = bodyText.slice(0, 400);
    const blocked = BLOCK_RE.test(doc.title) || (bodyText.length < 1500 && BLOCK_RE.test(bodyText));

    const ld = fromJsonLd(ctx);
    const dom = fromRepeatedCards(ctx, diag);
    diag.jsonLd = ld.length;
    diag.dom = dom.length;
    let items = [...ld, ...dom];
    // Arama sayfasının kendisini tanımlayan JSON-LD (kategori/ürün özeti) ilan değildir.
    if (items.length > 2) items = items.filter((it) => it.url.split('#')[0] !== url.split('#')[0]);
    return {
      url,
      title: doc.title,
      blocked,
      items: items.slice(0, opts.limit ?? 300),
      next: nextPageUrl(ctx),
      diag,
    };
  }

  globalThis.__kktcScraper = { run };
})();
