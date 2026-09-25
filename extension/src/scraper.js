// Sayfaya enjekte edilen ilan toplayıcı. Site başına sabit seçici kullanmaz:
//   1) JSON-LD (schema.org Car / Vehicle / Product) verisini okur,
//   2) sayfada tekrar eden, fiyat + bağlantı içeren kart yapılarını bulur.
// Sonuç ham veridir; ayrıştırma normalize.js'te yapılır.
(() => {
  if (globalThis.__kktcScraper) return;

  const PRICE_SRC =
    "(US\\s?\\$|USD|\\$|£|GBP|¥|￥|JPY|€|EUR)\\s?(\\d{1,3}(?:[,.\\u00a0\\u202f']\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)(\\s?万)?|(\\d{1,3}(?:[,.\\u00a0\\u202f']\\d{3})+|\\d+(?:\\.\\d+)?)\\s?(万円|円|JPY|USD|GBP|EUR|€)";
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'HEAD', 'IFRAME', 'SELECT', 'OPTION']);
  const BAD_LINK = /(inquir|enquir|contact|login|log-in|signin|sign-in|register|favou?rite|watchlist|compare|wishlist|javascript:|mailto:|tel:|whatsapp|facebook|twitter|share)/i;
  const BAD_IMG = /(icon|logo|flag|sprite|badge|loading|placeholder|spacer|blank\.gif|pixel|avatar)/i;
  const BLOCK_RE = /(just a moment|attention required|access denied|are you a robot|verify you are human|pardon our interruption|captcha|unusual traffic|request blocked)/i;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

  // innerText düzen hesaplatır ve yavaştır; textContent ise hücre/öğe sınırlarını
  // yapıştırır ("Mileage40000"). Metin düğümlerini boşlukla birleştiriyoruz.
  function textOf(el) {
    const parts = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
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

  function absUrl(u) {
    try {
      const url = new URL(u, location.href);
      return /^https?:$/.test(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  }

  function firstSrcset(v) {
    return v ? v.split(',')[0].trim().split(/\s+/)[0] : null;
  }

  function imageOf(el) {
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
        const abs = absUrl(c);
        if (abs) return abs;
      }
    }
    for (const n of el.querySelectorAll('[style*="background"]')) {
      const m = n.getAttribute('style').match(/url\(["']?([^"')]+)["']?\)/);
      if (m && !BAD_IMG.test(m[1])) {
        const abs = absUrl(m[1]);
        if (abs) return abs;
      }
    }
    return null;
  }

  function bestLink(el) {
    const anchors = [...el.querySelectorAll('a[href]')];
    const up = el.closest('a[href]');
    if (up) anchors.unshift(up);
    let best = null;
    let bestScore = -Infinity;
    for (const a of anchors) {
      const href = absUrl(a.getAttribute('href'));
      if (!href || href.split('#')[0] === location.href.split('#')[0]) continue;
      if (BAD_LINK.test(href) || BAD_LINK.test(a.textContent || '')) continue;
      let score = 0;
      if (a.querySelector('img')) score += 3;
      if (a.querySelector('h1,h2,h3,h4,h5,h6')) score += 3;
      const t = textOf(a);
      if (t.length >= 8 && t.length <= 160) score += 2;
      if (/\d{4,}/.test(href)) score += 2;
      if (/(detail|stock|vehicle|car|product|listing|lot|item|advert|ad)\b/i.test(href)) score += 1;
      if (a === up) score += 2;
      if (score > bestScore) {
        bestScore = score;
        best = { href, title: a.getAttribute('title') };
      }
    }
    if (best) {
      // Aynı ilana giden bağlantıların metinleri (görsel bağlantısı boş olabilir).
      best.texts = anchors
        .filter((a) => absUrl(a.getAttribute('href')) === best.href)
        .map((a) => textOf(a))
        .filter((t) => t.length >= 4 && t.length <= 200);
    }
    return best;
  }

  function titleOf(el, link) {
    const h = el.querySelector('h1,h2,h3,h4,h5,h6,[class*="title" i],[class*="heading" i],[class*="name" i]');
    const cands = [h && textOf(h), link?.title, ...(link?.texts || []), el.querySelector('img[alt]')?.getAttribute('alt')];
    for (const c of cands) {
      const t = norm(c);
      if (t.length >= 4 && t.length <= 200 && !/^(view|details|more|see more|more info)$/i.test(t)) return t;
    }
    return null;
  }

  // ---------- 1) JSON-LD ----------
  function fromJsonLd() {
    const out = [];
    const types = /^(Car|Vehicle|Product|Motorcycle|MotorizedBicycle|BusOrCoach)$/i;
    const walk = (node, depth = 0) => {
      if (!node || typeof node !== 'object' || depth > 8) return;
      if (Array.isArray(node)) return node.forEach((n) => walk(n, depth + 1));
      const t = [].concat(node['@type'] || []).map(String);
      if (t.some((x) => types.test(x))) {
        const item = jsonLdItem(node);
        if (item) out.push(item);
      }
      for (const k of ['@graph', 'itemListElement', 'item', 'mainEntity', 'about']) {
        if (node[k]) walk(node[k], depth + 1);
      }
    };
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        walk(JSON.parse(s.textContent));
      } catch {}
    }
    return out;
  }

  function jsonLdItem(n) {
    const offers = [].concat(n.offers || [])[0] || {};
    const url = absUrl(n.url || offers.url || (typeof n['@id'] === 'string' && /^https?:/.test(n['@id']) ? n['@id'] : '') || location.href);
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
      image: absUrl(typeof img === 'string' ? img : img?.url || img?.contentUrl || ''),
      priceTexts: [],
      text: norm(n.description).slice(0, 800),
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
    const cls = [...el.classList]
      .map((c) => c.replace(/\d+/g, '#'))
      .filter((c) => c && !/^(active|selected|odd|even|first|last|hover|focus|visible|is-|has-|js-|swiper-slide-(?:active|next|prev))/.test(c))
      .sort()
      .join('.');
    return `${el.tagName}|${cls}`;
  }

  function fromRepeatedCards() {
    const groups = new Map(); // imza -> { els: Set }
    for (const parent of document.body.querySelectorAll('*')) {
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
      let priceCount = 0;
      const cards = [];
      for (const el of els) {
        const text = textOf(el);
        if (text.length < 15 || text.length > 3000) continue;
        const prices = priceTexts(text);
        const hasLink = el.closest('a[href]') || el.querySelector('a[href]');
        const hasKm = /\d\s?(km|miles|mi)\b/i.test(text);
        if (!hasLink || (!prices.length && !hasKm)) continue;
        good++;
        priceCount += prices.length;
        if (el.querySelector('img') || /background/.test(el.innerHTML.slice(0, 2000))) withImg++;
        if (/\b(19[89]\d|20[0-4]\d)\b/.test(text)) withYear++;
        cards.push({ el, text, prices });
      }
      if (good < 3 || good / els.length < 0.5) continue;
      const avgPrices = priceCount / good;
      let score = good * (1 + withImg / good + withYear / good);
      if (avgPrices > 4) score *= 0.3; // muhtemelen birden fazla kart içeren satır
      scored.push({ sig, score, cards });
    }
    scored.sort((a, b) => b.score - a.score);
    if (!scored.length) return [];

    const best = scored[0].score;
    const chosen = scored.filter((g) => g.score >= best * 0.4).slice(0, 4);
    const out = [];
    const used = new Set();
    for (const g of chosen) {
      for (const { el, text, prices } of g.cards) {
        // İç içe seçilmiş gruplarda aynı kartı iki kez alma.
        if ([...used].some((u) => u.contains(el) || el.contains(u))) continue;
        const link = bestLink(el);
        if (!link) continue;
        used.add(el);
        out.push({
          url: link.href,
          title: titleOf(el, link),
          image: imageOf(el),
          priceTexts: prices,
          text: text.slice(0, 800),
          structured: null,
        });
      }
    }
    return out;
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

  async function run(opts = {}) {
    if (opts.scroll) await autoScroll(opts.scrollSteps ?? 12);
    const bodyText = norm(document.body?.innerText || '').slice(0, 3000);
    const blocked = BLOCK_RE.test(document.title) || (bodyText.length < 1500 && BLOCK_RE.test(bodyText));

    const byUrl = new Map();
    for (const item of [...fromJsonLd(), ...fromRepeatedCards()]) {
      const key = item.url.split('#')[0];
      const prev = byUrl.get(key);
      if (!prev) byUrl.set(key, item);
      else {
        // JSON-LD yapısal veri + DOM'daki fiyat/görsel birleştirilir.
        byUrl.set(key, {
          ...prev,
          title: prev.title || item.title,
          image: prev.image || item.image,
          priceTexts: prev.priceTexts.length ? prev.priceTexts : item.priceTexts,
          text: prev.text.length > item.text.length ? prev.text : item.text,
          structured: prev.structured || item.structured,
        });
      }
    }
    // Arama sayfasının kendisini tanımlayan JSON-LD (kategori/ürün özeti) ilan değildir.
    if (byUrl.size > 2) byUrl.delete(location.href.split('#')[0]);
    return {
      url: location.href,
      title: document.title,
      blocked,
      items: [...byUrl.values()].slice(0, opts.limit ?? 200),
    };
  }

  globalThis.__kktcScraper = { run };
})();
