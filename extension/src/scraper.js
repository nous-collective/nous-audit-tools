// İlan okuyucu. Site başına sabit seçici kullanmaz:
//   1) JSON-LD (schema.org Car / Vehicle / Product) verisini okur,
//   2) sayfada tekrar eden, bağlantı + fiyat/km içeren kart yapılarını bulur.
// İki şekilde çalışır:
//   - sekmeye enjekte edilir: run({ scroll: true }) canlı sayfayı okur,
//   - panelde yüklenir: run({ doc, baseUrl }) indirilmiş HTML'i (DOMParser) okur.
// Sonuç ham veridir; ayrıştırma ve tekrar ayıklama normalize.js'te yapılır.
(() => {
  if (globalThis.__kktcScraper?.pairs) return;

  // normalize.js'teki PRICE_PATTERN ile aynı olmalı (testte kontrol edilir).
  const PRICE_SRC =
    "(US\\s?\\$|USD|JP¥|\\$|£|GBP|¥|￥|JPY|€|EUR|₺|TRY|TL)\\s?((?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?(?!\\d)|\\d{1,3}(?:\\.\\d{3})+(?!\\d)|\\d{1,3}(?:[   ]\\d{3})+(?![\\d.,])|\\d{1,3}(?:'\\d{3})+(?!\\d)|\\d+(?:\\.\\d+)?))(\\s?万)?|(?<![\\d.,])((?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?(?!\\d)|\\d{1,3}(?:\\.\\d{3})+(?!\\d)|\\d{1,3}(?:[   ]\\d{3})+(?![\\d.,])|\\d{1,3}(?:'\\d{3})+(?!\\d)|\\d+(?:\\.\\d+)?))\\s?(万円|円|¥|￥|JPY|USD|GBP|EUR|€|₺|TRY|TL)(?![A-Za-z\\d])";
  const KM_RE = /\d\s?\(?\s?(km|kms|miles|mi)\b|\b(mileage|odometer)\s*:?\s*\d/i;
  const YEAR_RE = /\b(19[89]\d|20[0-4]\d)\b/;
  const VEHICLE_RE =
    /\b(toyota|nissan|honda|mazda|mitsubishi|subaru|suzuki|daihatsu|lexus|isuzu|bmw|mercedes|audi|volkswagen|vw|land rover|range rover|jaguar|mini|ford|vauxhall|peugeot|renault|citroen|kia|hyundai|volvo|skoda|seat|fiat|porsche|tesla|mileage|odometer|sedan|saloon|hatchback|estate|wagon|suv|coupe|minivan|mpv|4wd|awd|hybrid|petrol|diesel|automatic|manual)\b/i;
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'HEAD', 'IFRAME', 'SELECT', 'OPTION']);
  const BAD_LINK = /(inquir|enquir|contact|login|log-in|signin|sign-in|register|favou?rite|watchlist|compare|wishlist|javascript:|mailto:|tel:|whatsapp|facebook|twitter|share)/i;
  const BAD_IMG = /(icon|logo|flag|sprite|badge|loading|placeholder|spacer|blank\.gif|pixel|avatar)/i;
  const BLOCK_RE = /(just a moment|attention required|access denied|are you a robot|verify you are human|verifying your browser|security checkpoint|security verification|pardon our interruption|captcha|unusual traffic|request blocked)/i;
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
    // Önce gerçek başlık etiketleri, sonra "title/name" sınıflı öğeler.
    const h = el.querySelector('h1,h2,h3,h4,h5,h6');
    // "title/name" sınıflı öğelerden fiyat ya da yalnızca sayı olmayan ilki ("price-title" gibi sınıflar var).
    const named = [...el.querySelectorAll('[class*="title" i],[class*="heading" i],[class*="name" i]')]
      .map((n) => textOf(ctx, n))
      .find((t) => t && /\p{L}{2}/u.test(t) && !new RegExp(PRICE_SRC, 'i').test(t));
    const cands = [h && textOf(ctx, h), named, link?.title, ...(link?.texts || []), el.querySelector('img[alt]')?.getAttribute('alt'), el.querySelector('[alt]')?.getAttribute('alt')];
    const ok = cands
      .map((c) => norm(c))
      .filter((t) => {
        // Fiyattan ibaret metin ("70 000 ¥") başlık değildir.
        const rest = t.replace(new RegExp(PRICE_SRC, 'gi'), '').replace(/[^\p{L}]/gu, '');
        return t.length >= 4 && t.length <= 200 && rest.length >= 3 && !/^(view|details|more|see more|more info|view details)$/i.test(t);
      });
    // Marka/araç kelimesi içeren kısa aday öne ("There are 4 more photos…" gibi metinler yerine).
    return ok.find((t) => t.length <= 90 && VEHICLE_RE.test(t)) || ok[0] || null;
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
    // Gruplar "ebeveyn imzası > öğe imzası" ile ayrılır: sınıfsız <li> ya da her yerde geçen
    // "row" gibi öğeler, menülerdeki benzerleriyle aynı gruba düşüp oranı bozmasın.
    const groups = new Map(); // imza -> öğeler
    for (const parent of ctx.doc.body.querySelectorAll('*')) {
      if (SKIP_TAGS.has(parent.tagName) || parent.children.length < 2) continue;
      const ps = signature(parent);
      const bySig = new Map();
      for (const k of parent.children) {
        if (SKIP_TAGS.has(k.tagName)) continue;
        const s = `${ps}>${signature(k)}`;
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
      // Bir ilanı birden fazla tablo satırına bölen siteler (CardealPage: 4 satır) için
      // yeterince çok iyi kart varsa oran eşiği düşer.
      if (good < 3 || good / els.length < (good >= 5 ? 0.2 : 0.5)) continue;
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

  // ---------- 3) Sayfaya gömülü veri (Next.js / JSON / Apollo durumu) ----------
  function inlineScripts(ctx) {
    const out = [];
    let total = 0;
    for (const sc of ctx.doc.querySelectorAll('script:not([src])')) {
      const t = sc.textContent || '';
      if (t.length < 50 || /ld\+json/i.test(sc.getAttribute('type') || '')) continue;
      out.push({ el: sc, text: t });
      total += t.length;
      if (total > 8e6) break;
    }
    return out;
  }

  // İlan adresindeki kimlik: uzun sayı, UUID ya da harf+rakam stok kodu.
  function idToken(url) {
    let u;
    try {
      u = new URL(url);
    } catch {
      return null;
    }
    const s = decodeURIComponent(u.pathname + u.search);
    const uuid = s.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (uuid) return uuid[0];
    const nums = s.match(/\d{6,}/g);
    if (nums) return nums.sort((a, b) => b.length - a.length)[0];
    return null;
  }

  // Kartta yazmayan yıl/km'yi gömülü verideki aynı ilan kaydından tamamlar.
  function enrichFromScripts(scripts, items) {
    if (!scripts.length) return;
    const big = scripts.map((x) => x.text).join('\n');
    for (const it of items) {
      const tok = idToken(it.url);
      if (!tok) continue;
      const at = big.indexOf(`"${tok}"`);
      if (at < 0) continue;
      // Kayıtta uzun resim listeleri olabilir; bir sonraki kaydın kimliğine kadar oku.
      let win = big.slice(at + tok.length + 2, at + 10000);
      const nextId = win.search(/"(?:id|vehicleId|advertId|stockId)"\s*:/);
      if (nextId > 0) win = win.slice(0, nextId);
      const e = {};
      const y = win.match(/"(?:year|vehicleYear|modelYear|registrationYear|firstRegistrationYear)"\s*:\s*"?((?:19|20)\d\d)/);
      if (y) e.year = Number(y[1]);
      const m = win.match(/"(?:mileage|odometer|odometerReading)"\s*:\s*(?:\{[^{}]*?"(?:mileage|value|amount)"\s*:\s*)?"?(\d{1,7})/);
      if (m) {
        e.mileage = Number(m[1]);
        const unit = win.match(/"(?:unit|unitCode|mileageUnit)"\s*:\s*"(mile|miles|mi|smi|km|kilometre|kilometer|kmt)/i);
        if (unit) e.mileageUnit = /^(km|kilo|kmt)/i.test(unit[1]) ? 'km' : 'mi';
      }
      if (Object.keys(e).length) it.embedded = e;
    }
  }

  const PRICE_KEYS = ['price', 'priceIncludingAdminFee', 'salePrice', 'askingPrice', 'totalPrice', 'fobPrice', 'vehiclePrice', 'retailPrice'];
  const numOf = (v) => (typeof v === 'number' ? v : typeof v === 'string' && /^\d+(\.\d+)?$/.test(v) ? Number(v) : v && typeof v === 'object' ? numOf(v.amount ?? v.value) : null);

  // JSON içindeki araç kayıtları (marka/model/başlık + fiyat). Tek ilanlı sayfaları da yakalar.
  function fromEmbeddedJson(ctx, scripts) {
    const hrefs = [...ctx.doc.querySelectorAll('a[href]')].map((a) => absUrl(ctx, a.getAttribute('href'))).filter(Boolean);
    const out = [];
    let budget = 200000;
    const isVehicle = (o) =>
      o && typeof o === 'object' && !Array.isArray(o) && PRICE_KEYS.some((k) => numOf(o[k]) > 0) && (o.make || o.model || o.title || o.name);
    const walk = (node, depth) => {
      if (!node || typeof node !== 'object' || depth > 14 || --budget < 0) return;
      if (Array.isArray(node)) {
        if (node.length && node.length <= 500 && isVehicle(node[0])) {
          for (const o of node) if (isVehicle(o)) out.push(o);
          return;
        }
        for (const x of node) walk(x, depth + 1);
        return;
      }
      for (const v of Object.values(node)) walk(v, depth + 1);
    };
    for (const { el, text } of scripts) {
      const type = el.getAttribute('type') || '';
      if (el.id !== '__NEXT_DATA__' && !/json/i.test(type)) continue;
      try {
        walk(JSON.parse(text), 0);
      } catch {}
    }
    const items = [];
    for (const o of out) {
      const str = (v) => (typeof v === 'string' ? v : v?.name || '');
      let url = typeof o.url === 'string' ? absUrl(ctx, o.url) : typeof o.href === 'string' ? absUrl(ctx, o.href) : null;
      if (!url) {
        // Kaydın kimliklerinden birini içeren sayfa bağlantısı.
        const ids = ['vehicleId', 'id', 'stockId', 'advertId', 'listingId', 'slug', 'vrm', 'refNo']
          .map((k) => o[k])
          .filter((v) => (typeof v === 'string' && v.length >= 5) || (typeof v === 'number' && v > 9999))
          .map(String);
        url = hrefs.find((h) => ids.some((id) => h.includes(id))) || null;
      }
      if (!url) continue;
      const price = PRICE_KEYS.map((k) => numOf(o[k])).find((v) => v > 0);
      const title = norm(o.title || o.name || [str(o.make), str(o.model), o.variant || o.trim || o.derivative].filter(Boolean).join(' '));
      const yr = o.vehicleYear ?? o.year ?? o.modelYear ?? o.registrationYear;
      const img = o.thumbnailUrl || o.imageUrl || o.image || o.mainImage || (Array.isArray(o.images) ? o.images[0] : null);
      items.push({
        url,
        title,
        image: absUrl(ctx, typeof img === 'string' ? img : img?.url || ''),
        priceTexts: [],
        text: norm([title, o.fuelType, o.transmissionType || o.transmission].filter((x) => typeof x === 'string').join(' ')),
        source: 'json',
        structured: {
          price,
          currency: o.currency || o.priceCurrency || null,
          year: /^(19|20)\d\d$/.test(String(yr)) ? Number(yr) : null,
          mileage: numOf(o.mileage ?? o.odometer),
          fuel: typeof o.fuelType === 'string' ? o.fuelType : null,
          transmission: typeof (o.transmissionType || o.transmission) === 'string' ? o.transmissionType || o.transmission : null,
          make: str(o.make) || null,
        },
      });
    }
    return items;
  }

  // ---------- 4) Etiket–değer çiftleri (sipariş/nakliye sayfaları) ----------
  // Sitenin teknolojisinden bağımsız: HTML tablo/tanım listesi, yan yana etiket-değer
  // kutuları, "Etiket: değer" metni, salt okunur form alanları ve gömülü JSON.
  function collectPairs(ctx) {
    const pairs = [];
    const add = (label, value, via) => {
      const l = norm(label).replace(/[：:]$/, '').trim();
      const v = norm(value);
      if (l && v && l.length <= 60 && v.length <= 200 && l !== v) pairs.push({ label: l, value: v, via });
    };
    const doc = ctx.doc;
    // Tablolar: <th>etiket</th><td>değer</td> ve <td>etiket</td><td>değer</td> dizileri
    for (const tr of doc.querySelectorAll('tr')) {
      const cells = [...tr.children].filter((c) => /^(TH|TD)$/.test(c.tagName));
      for (let i = 0; i + 1 < cells.length; i++) {
        const a = textOf(ctx, cells[i]);
        const b = textOf(ctx, cells[i + 1]);
        if (cells[i].tagName === 'TH' || (a.length <= 40 && b && (i % 2 === 0 || cells.length === 2))) add(a, b, 'table');
      }
    }
    // Sütun başlıklı tablolar: <thead> başlığı + ilk veri satırı
    for (const table of doc.querySelectorAll('table')) {
      const head = [...(table.querySelector('thead tr, tr:first-child')?.children || [])].filter((c) => c.tagName === 'TH');
      if (head.length < 2) continue;
      const row = [...table.querySelectorAll('tr')].find((r) => r.querySelector('td'));
      const cells = row ? [...row.children] : [];
      head.forEach((th, i) => cells[i] && add(textOf(ctx, th), textOf(ctx, cells[i]), 'table-head'));
    }
    // Tanım listeleri
    for (const dt of doc.querySelectorAll('dt')) {
      const dd = dt.nextElementSibling;
      if (dd?.tagName === 'DD') add(textOf(ctx, dt), textOf(ctx, dd), 'dl');
    }
    // Yan yana kutular: kısa metinli öğe + hemen ardından gelen kardeşi (div/span/p/label/strong)
    for (const el of doc.querySelectorAll('div, span, p, label, strong, b, li, h4, h5, h6')) {
      if (el.children.length > 1) continue;
      const a = textOf(ctx, el);
      if (!a || a.length > 40) continue;
      const sib = el.nextElementSibling;
      if (sib && sib.children.length <= 3) {
        const b = textOf(ctx, sib);
        if (b && b.length <= 120) add(a, b, 'sibling');
      }
    }
    // "Etiket: değer" metinleri (satır satır)
    const body = live(ctx) ? doc.body.innerText : textOf(ctx, doc.body);
    for (const line of String(body || '').split(/\n| {3,}|\t/)) {
      const m = line.match(/^\s*([^:：]{2,40})[:：]\s*(.{1,120})$/);
      if (m) add(m[1], m[2], 'text');
    }
    // Salt okunur form alanları
    for (const inp of doc.querySelectorAll('input[value]:not([type=hidden]):not([type=password]), textarea')) {
      const id = inp.getAttribute('id');
      const lab = (id && doc.querySelector(`label[for="${CSS.escape(id)}"]`)) || inp.closest('label');
      const label = (lab && textOf(ctx, lab)) || inp.getAttribute('aria-label') || inp.getAttribute('placeholder') || inp.getAttribute('name');
      add(label, inp.value || inp.getAttribute('value') || inp.textContent, 'input');
    }
    // Gömülü JSON: anahtar → metin/sayı değerleri (Next.js, Nuxt, satır içi durum, JSON-LD)
    let budget = 20000;
    const walk = (node, key, depth) => {
      if (--budget < 0 || depth > 12 || node == null) return;
      if (typeof node === 'string' || typeof node === 'number') {
        if (key && !/^\d+$/.test(key)) add(key, String(node), 'json');
        return;
      }
      if (Array.isArray(node)) return node.slice(0, 50).forEach((x) => walk(x, key, depth + 1));
      if (typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, k, depth + 1);
    };
    for (const sc of doc.querySelectorAll('script:not([src])')) {
      const t = sc.textContent || '';
      if (t.length < 20 || t.length > 3e6) continue;
      const type = sc.getAttribute('type') || '';
      if (/json/i.test(type) || sc.id === '__NEXT_DATA__' || sc.id === '__NUXT_DATA__') {
        try {
          walk(JSON.parse(t), '', 0);
          continue;
        } catch {}
      }
      // Satır içi betik: "anahtar":"değer" / anahtar: 'değer' çiftleri
      for (const m of t.matchAll(/["']?([A-Za-z_][\w]{1,40})["']?\s*:\s*["']([^"'\\]{1,120})["']/g)) {
        if (--budget < 0) break;
        add(m[1], m[2], 'script');
      }
    }
    return pairs;
  }

  function live(ctx) {
    return ctx.layout;
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
    // "Devam etmek için tıklayın" ara sayfası: tek bağlantılı kısa sayfa.
    let continueUrl = null;
    if (bodyText.length < 400 && /(continue|click|proceed|redirect|devam)/i.test(bodyText)) {
      const links = [...doc.querySelectorAll('a[href]')].map((a) => absUrl(ctx, a.getAttribute('href'))).filter((u) => u && new URL(u).origin === new URL(url).origin);
      if (links.length >= 1 && links.length <= 2) continueUrl = links[0];
    }

    const ld = fromJsonLd(ctx);
    const dom = fromRepeatedCards(ctx, diag);
    const scripts = inlineScripts(ctx);
    const json = fromEmbeddedJson(ctx, scripts);
    enrichFromScripts(scripts, dom);
    diag.jsonLd = ld.length;
    diag.dom = dom.length;
    diag.json = json.length;
    // Sitenin kendi verisi (JSON-LD, gömülü JSON) sayfa metninden önce gelir: birleştirmede
    // fiyat gibi alanlar yapısal veriden alınır ("£300 off" rozeti fiyat sanılmaz).
    let items = [...ld, ...json, ...dom];
    // Arama sayfasının kendisini tanımlayan JSON-LD (kategori/ürün özeti) ilan değildir.
    if (items.length > 2) items = items.filter((it) => it.url.split('#')[0] !== url.split('#')[0]);
    return {
      url,
      title: doc.title,
      blocked,
      items: items.slice(0, opts.limit ?? 300),
      next: nextPageUrl(ctx),
      continueUrl,
      diag,
    };
  }

  // Sipariş/nakliye sayfası: yalnızca etiket–değer çiftleri.
  async function pairs(opts = {}) {
    const doc = opts.doc || document;
    const url = opts.baseUrl || location.href;
    const ctx = { doc, base: baseOf(doc, url), layout: !opts.doc };
    return { url, title: doc.title, pairs: doc.body ? collectPairs(ctx) : [] };
  }

  globalThis.__kktcScraper = { run, pairs };
})();
