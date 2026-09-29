// Sayfadan toplanan ham ilan verisini (scraper.js çıktısı) ortak ilan biçimine çevirir.

export const MAKES = [
  'Toyota', 'Nissan', 'Honda', 'Mazda', 'Mitsubishi', 'Subaru', 'Suzuki', 'Daihatsu', 'Lexus',
  'Isuzu', 'Infiniti', 'Hino', 'Mitsuoka', 'BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen',
  'Land Rover', 'Jaguar', 'Mini', 'Ford', 'Vauxhall', 'Peugeot', 'Renault', 'Citroen', 'Kia',
  'Hyundai', 'Volvo', 'Skoda', 'SEAT', 'Fiat', 'Porsche', 'Tesla', 'Bentley', 'Jeep',
  'Alfa Romeo', 'Dacia', 'MG', 'Smart', 'Chevrolet', 'DS', 'Cupra', 'Genesis', 'BYD',
];

const MAKE_ALIASES = [
  ...MAKES.map((m) => [m, m]),
  ['Mercedes', 'Mercedes-Benz'],
  ['Merc', 'Mercedes-Benz'],
  ['VW', 'Volkswagen'],
  ['Range Rover', 'Land Rover'],
  ['Citroën', 'Citroen'],
  ['Škoda', 'Skoda'],
].sort((a, b) => b[0].length - a[0].length);

// Marka adları yalnızca harf, boşluk ve tire içerir; kaçış gerekmez.
const MAKE_YEAR_RE = new RegExp(String.raw`\b(19[89]\d|20[0-4]\d)\s+(?:${MAKE_ALIASES.map(([a]) => a).join('|')})\b`, 'i');

const CURRENCY_CODES = {
  'US$': 'USD', USD: 'USD', $: 'USD',
  '£': 'GBP', GBP: 'GBP',
  '¥': 'JPY', '￥': 'JPY', 'JP¥': 'JPY', JPY: 'JPY', 円: 'JPY', 万円: 'JPY',
  '€': 'EUR', EUR: 'EUR',
  '₺': 'TRY', TL: 'TRY', TRY: 'TRY',
};

// Fiyat kalıbı. scraper.js'teki PRICE_SRC ile aynı olmalı (testte kontrol edilir).
export const PRICE_PATTERN =
  "(US\\s?\\$|USD|JP¥|\\$|£|GBP|¥|￥|JPY|€|EUR|₺|TRY|TL)\\s?((?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?(?!\\d)|\\d{1,3}(?:\\.\\d{3})+(?!\\d)|\\d{1,3}(?:[   ]\\d{3})+(?![\\d.,])|\\d{1,3}(?:'\\d{3})+(?!\\d)|\\d+(?:\\.\\d+)?))(\\s?万)?|(?<![\\d.,])((?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?(?!\\d)|\\d{1,3}(?:\\.\\d{3})+(?!\\d)|\\d{1,3}(?:[   ]\\d{3})+(?![\\d.,])|\\d{1,3}(?:'\\d{3})+(?!\\d)|\\d+(?:\\.\\d+)?))\\s?(万円|円|¥|￥|JPY|USD|GBP|EUR|€|₺|TRY|TL)(?![A-Za-z\\d])";

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function toNumber(s) {
  // "12,345" "12.345" "1,170,000" "12345.50" "229.5"
  const t = s.replace(/[\s  ']/g, '');
  if (/^\d{1,3}([,.])\d{3}(\1\d{3})*$/.test(t)) return Number(t.replace(/[,.]/g, ''));
  if (/^\d{1,3}(,\d{3})+\.\d+$/.test(t)) return Number(t.replace(/,/g, ''));
  return Number(t.replace(',', '.'));
}

export function parsePrice(text) {
  if (!text) return null;
  const re = new RegExp(PRICE_PATTERN, 'i');
  const m = text.match(re);
  if (!m) return null;
  let sym, num, man;
  if (m[1]) {
    sym = m[1].replace(/\s/g, '').toUpperCase();
    num = m[2];
    man = Boolean(m[3]);
  } else {
    num = m[4];
    sym = m[5].toUpperCase();
    man = sym === '万円';
  }
  const currency = CURRENCY_CODES[sym] || null;
  let amount = toNumber(num);
  if (!currency || !Number.isFinite(amount)) return null;
  if (man) amount *= 10000;
  if (amount <= 0) return null;
  return { amount, currency };
}

// Kart üzerindeki birden fazla fiyattan araç fiyatını ve (varsa) toplam/CIF fiyatını seçer.
export function pickPrices(priceTexts = []) {
  let price = null;
  let total = null;
  for (const { text, label = '', after = '', struck } of priceTexts) {
    const p = parsePrice(text);
    if (!p || struck) continue; // üstü çizili eski fiyat
    const l = label.toLowerCase();
    const a = after.toLowerCase();
    if (/^\s*(\/\s?mo|\/\s?month|per month|p\/m|pm\b|a month|monthly|pcm)/.test(a) || /\b(from|deposit|monthly|per month)\s*$/.test(l)) {
      continue; // taksit / peşinat
    }
    // İndirim rozeti ("£300 off", "£500 cashback", "save £1,000") araç fiyatı değildir.
    if (/^\s*(off\b|discount|cashback|saving|reduction|price drop|deposit contribution)/.test(a) || /\b(save|saving|discount|reduced by|price drop)\s*:?\s*$/.test(l)) {
      continue;
    }
    // Kampanya / hediye tutarı ("£695 HOME WALL CHARGER OFFER", "extras worth £545", "£1,000 bonus").
    // "£3,500 or best offer", "£2,000 ono" gerçek fiyattır.
    if ((/^[^£$¥€₺\d]{0,30}\b(offer|voucher|bonus|gift|incentive)\b/.test(a) && !/^\s*(or|ono|o\.n\.o|make an|best|near)/.test(a)) || /\b(worth|extras|value of|up to|bonus|voucher)\s*:?\s*$/.test(l)) {
      continue;
    }
    // Yol vergisi ("£20 a yr road tax"), posta/kargo ("+£45 postage") araç fiyatı değildir.
    if (/^\s*(a\s?yr|\/\s?yr|a year|per year|per annum|p\/?a\b|pa\b|road tax|tax\b|ved\b|(?:postage|delivery|shipping|collection)(?!\s*:))/.test(a) || /(road tax|tax|ved|\+|postage|delivery|shipping)\s*:?\s*$/.test(l)) {
      continue;
    }
    if (/(total|cif|c&f|c\s?and\s?f|toplam)/.test(l)) {
      total ??= p;
    } else if (/\b(was|previous|old price|rrp|save|saving|you save|discount|off)\b[^\d]*$/.test(l)) {
      continue;
    } else if (/\b(estimated|est\.|retail value|market value|valuation|cap value|guide value)\b[^\d]*$/.test(l)) {
      continue; // tahmini değer (Copart "Estimated retail value") satış fiyatı değildir
    } else if (!(p.amount > 0)) {
      continue; // "Current bid: £0.00" = henüz teklif yok
    } else {
      price ??= p;
    }
  }
  return { price: price || total, total: price ? total : null };
}

export function parseYearMonth(...texts) {
  const now = new Date().getFullYear();
  for (const t of texts) {
    if (!t) continue;
    // "2019", "2019/12", "2019.3", "2019年3", "2019/Dec", "2019 Dec"
    const re =
      /\b(19[89]\d|20[0-4]\d)\b(?:\s*[/.\-年]\s*(0?[1-9]|1[0-2])\b|\s*[/.\-]?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b)?/gi;
    // İlk geçerli yıl esas alınır; aynı yıl ileride ayıyla birlikte geçiyorsa ay oradan alınır.
    let found = null;
    for (const m of t.matchAll(re)) {
      const year = Number(m[1]);
      if (year > now + 1 || (found && year !== found.year)) continue;
      const month = m[2] ? Number(m[2]) : m[3] ? MONTHS[m[3].toLowerCase()] : null;
      found ??= { year, month: null };
      if (month) {
        found.month = month;
        break;
      }
    }
    if (found) return found;
  }
  return { year: null, month: null };
}

export function parseMileageKm(text, defaultUnit = 'km') {
  if (!text) return null;
  const k = text.match(/\b(\d+(?:\.\d+)?)\s?k\s?(miles|mi|km)\b/i);
  if (k) {
    const v = Number(k[1]) * 1000;
    return /^km/i.test(k[2]) ? v : Math.round(v * 1.609344);
  }
  // Binlik ayırıcı yalnızca , veya . : "-$30 118,000 km" içindeki boşluk sayıyı birleştirmesin.
  // Binlik ayırıcı tutarlı olmalı: "136 000 km", "118,000 km"; "-$30 118,000 km" içindeki 30 sayıya karışmaz.
  const NUM_UNIT = String.raw`(\d{1,3}(?:,\d{3})+|\d{1,3}(?:\.\d{3})+|\d{1,3}(?:[ \u00a0]\d{3})+|\d+)\s?\(?\s?(km|kms|kilometers|kilometres|miles|mile|mi)\b`;
  // Etiketli değer ("Mileage 76,497km") açıklamadaki yuvarlak sayıdan ("ONLY 77,000 KM") önce gelir.
  const m =
    text.match(new RegExp(String.raw`\b(?:mileage|odometer|走行距離)\s*[:：]?\s*` + NUM_UNIT, 'i')) ||
    text.match(new RegExp(String.raw`(?<![\d.,])` + NUM_UNIT, 'i'));
  if (!m) {
    // Birimsiz "Mileage: 66600" (birim sitenin ülkesine göre varsayılır).
    const bare = text.match(/\b(?:mileage|odometer)\s*:?\s*(\d{1,3}(?:[,.]\d{3})+|\d{2,7})(?![\d.,]*\s?(?:km|mi))/i);
    if (!bare) return null;
    const v = Number(bare[1].replace(/[,.]/g, ''));
    if (!v) return null; // "Odometer 0" = bilinmiyor
    return defaultUnit === 'mi' ? Math.round(v * 1.609344) : v;
  }
  const v = Number(m[1].replace(/[,.\s\u00a0]/g, ''));
  if (!Number.isFinite(v)) return null;
  return /^k/i.test(m[2]) ? v : Math.round(v * 1.609344);
}

const FUELS = [
  ['plug-in', /\b(plug[-\s]?in|phev)\b/i],
  ['hybrid', /\b(hybrid|hev)\b/i],
  ['electric', /\b(electric|ev|bev)\b/i],
  ['diesel', /\bdiesel\b/i],
  ['petrol', /\b(petrol|gasoline|gas)\b/i],
];
export const FUEL_LABEL = { 'plug-in': 'Plug-in hibrit', hybrid: 'Hibrit', electric: 'Elektrik', diesel: 'Dizel', petrol: 'Benzin' };

export function parseFuel(text) {
  for (const [k, re] of FUELS) if (re.test(text || '')) return k;
  return null;
}

export const TRANSMISSION_LABEL = { automatic: 'Otomatik', manual: 'Manuel' };
export function parseTransmission(text) {
  const t = text || '';
  // Kısaltmalar büyük harf duyarlı: "at" / "mt" düz metinde sık geçer.
  if (/\b(automatic|semi-auto)\b/i.test(t) || /\b(A\/?T|CVT|DCT)\b/.test(t)) return 'automatic';
  if (/\bmanual\b/i.test(t) || /\b(M\/?T)\b/.test(t)) return 'manual';
  return null;
}

export function parseSteering(text) {
  if (/\b(rhd|right[\s-]hand(?:\s+drive)?)\b/i.test(text || '')) return 'RHD';
  if (/\b(lhd|left[\s-]hand(?:\s+drive)?)\b/i.test(text || '')) return 'LHD';
  return null;
}

export function parseEngineCc(text) {
  const cc = (text || '').match(/\b(\d[,.]\d{3}|\d{3,4})\s?cc\b/i);
  if (cc) return Number(cc[1].replace(/[,.]/, ''));
  const l = (text || '').match(/\b([0-6]\.\d)\s?(?:l|litre|liter)\b/i);
  if (l) return Math.round(Number(l[1]) * 1000);
  return null;
}

export function detectMake(text) {
  if (!text) return null;
  for (const [alias, make] of MAKE_ALIASES) {
    const re = new RegExp(`(^|[^\\p{L}])${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`, 'iu');
    if (re.test(text)) return make;
  }
  return null;
}

// Görüntülenen bağlantıdan yalnızca bilinen izleme parametrelerini atar.
export function cleanUrl(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|gclid|fbclid|msclkid|yclid|dclid|mc_[ce]id|_trkparms|_trksid|hash$)/i.test(k)) u.searchParams.delete(k);
    }
    return u.toString();
  } catch {
    return null;
  }
}

// İlan kimliğini belirleyen sorgu parametreleri (stok/ilan numarası).
const ID_PARAM =
  /^(id|refno|ref_?no|stock_?(no|id|number)?|item_?id|item|lot_?(id|no)?|car_?id|vehicle_?id|vid|ad_?id|advert_?id|listing_?id|product_?id|pid|chassis_?no)$/i;
// Kimliği etkilemeyen parametreler (izleme, sıralama, arama oturumu…).
const NOISE_PARAM =
  /^(utm_|gclid|fbclid|msclkid|yclid|dclid|mc_|_trk|hash$|ref$|refkey|ref_?src|source|src|from|position|pos$|sp$|search_?id|sid$|session|sort|order|page$|index|rank|click_?id|campaign|cmp_?id|cid$|tracking|advertising-location|journey|onesearchad|channel|include-delivery-option|lang$|currency$|country$)/i;

/**
 * Aynı ilana giden farklı bağlantıları (fotoğraf bağlantısı ?refkey=…, başlık
 * bağlantısı parametresiz, mobil sp./m. alt alan adı, sondaki "/"…) tek anahtara indirger.
 */
export function listingKey(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  const host = u.hostname.toLowerCase().replace(/^(www\d?|m|sp|mobile)\./, '');
  let path = u.pathname.replace(/\/index\.(html?|php|aspx?)$/i, '').replace(/\/+$/, '') || '/';
  try {
    path = decodeURIComponent(path);
  } catch {}
  path = path.toLowerCase();
  const params = [...u.searchParams].filter(([, v]) => v !== '');
  const idParams = params.filter(([k]) => ID_PARAM.test(k));
  const lastSeg = path.split('/').filter(Boolean).pop() || '';
  let query = [];
  if (idParams.length) query = idParams;
  else if (!/\d{3,}/.test(lastSeg)) query = params.filter(([k]) => !NOISE_PARAM.test(k));
  const q = query
    .map(([k, v]) => `${k.toLowerCase()}=${v.toLowerCase()}`)
    .sort()
    .join('&');
  return `${host}${path}${q ? `?${q}` : ''}`;
}

const squashTitle = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// Farklı bağlantılı aynı ilan (mobil/masaüstü kopya vb.): aynı sitede aynı fiyat + km + yıl.
// Km yazmıyorsa başlık da aranır. Kopyaların başlığı farklı okunabildiği için km varken başlığa bakılmaz.
function fingerprint(l) {
  if (l.price == null) return null;
  if (l.km != null) return [l.siteId, l.price, l.currency, l.km, l.year ?? ''].join('|');
  if (l.year) return [l.siteId, l.price, l.currency, l.year, squashTitle(l.title)].join('|');
  return null;
}

function urlScore(url) {
  let sc = 0;
  if (!url.includes('?')) sc += 2;
  if (/(detail|stock|car-details|vehicle|listing|\/itm\/|\/lot\/)/i.test(url)) sc += 1;
  if (/(search|keyword=|[?&]q=|sort=)/i.test(url)) sc -= 3;
  return sc;
}

// İki kayıttan boş olmayan alanları birleştirir; kısa (parametresiz) bağlantı tercih edilir.
export function mergeListing(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (out[k] === null || out[k] === undefined || out[k] === '') out[k] = v;
  }
  // Asıl ilan sayfası tercih edilir: parametresiz, "detail/stock" içeren; arama/anahtar kelime bağlantısı değil.
  if (b.url && urlScore(b.url) > urlScore(a.url || '')) out.url = b.url;
  // Daha açıklayıcı (uzun) başlık tercih edilir: "PRIUS L" yerine "2011 TOYOTA PRIUS L".
  if ((b.title || '').length > (a.title || '').length && (b.title || '').length <= 160) out.title = b.title;
  out.id = a.id;
  return out;
}

// Adresteki uzun stok/ilan numarası (7+ rakam). Aynı ilana farklı adres biçimleriyle giden
// bağlantıları birleştirir: /detail/?refno=0122340268, /detail/toyota/prius/0122340268.html, ?keyword=0122340268
function refToken(url) {
  try {
    const u = new URL(url);
    const nums = decodeURIComponent(u.pathname + u.search).match(/\d{7,}/g);
    return nums ? nums.sort((a, b) => b.length - a.length)[0] : null;
  } catch {
    return null;
  }
}

export function dedupeListings(list) {
  const byId = new Map();
  for (const l of list) {
    if (!l) continue;
    byId.set(l.id, byId.has(l.id) ? mergeListing(byId.get(l.id), l) : l);
  }
  const byPrint = new Map();
  const byRef = new Map();
  const out = [];
  for (const l of byId.values()) {
    const fp = fingerprint(l);
    const ref = refToken(l.url);
    const rk = ref && `${l.siteId}|${ref}`;
    const idx = (fp && byPrint.get(fp)) ?? (rk && byRef.get(rk));
    if (idx !== undefined && idx !== null) {
      out[idx] = mergeListing(out[idx], l);
      const m = out[idx];
      const mfp = fingerprint(m);
      if (mfp) byPrint.set(mfp, idx);
      continue;
    }
    if (fp) byPrint.set(fp, out.length);
    if (rk) byRef.set(rk, out.length);
    out.push(l);
  }
  return out;
}

function cleanText(s, max = 200) {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

// Mezat lotu bilgileri (genel etiketlerden): lot no, mezat evi, tarih/saat, puan, başlangıç/son fiyat, durum.
export function parseAuction(text, priceTexts = []) {
  const t = text || '';
  const info = {};
  const lot = t.match(/\blot\s*(?:no\.?|#)?\s*[:：]?\s*(\d{1,10})(?!\d)(?:\s*,\s*([^,]{3,40}?)\s*,)?/i);
  if (lot) {
    info.lot = lot[1];
    if (lot[2]) info.house = lot[2].trim();
  }
  const when = t.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})\s+(\d{1,2}:\d{2})/) || t.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})\s+(\d{1,2}:\d{2})/);
  if (when) {
    const iso = when[1].length === 4 ? `${when[1]}-${String(when[2]).padStart(2, '0')}-${String(when[3]).padStart(2, '0')}` : `${when[3]}-${String(when[2]).padStart(2, '0')}-${String(when[1]).padStart(2, '0')}`;
    info.date = `${iso} ${when[4]}`;
  }
  const grade = t.match(/(?:\b(?:grade|rating|score|puan)\s*[:：]?\s*([0-9](?:\.5)?|R|RA|S|X)\b)|(?:\b([0-9](?:\.5)?|R|RA|S)\s+(?:rating|grade)\b)/i);
  if (grade) info.grade = (grade[1] || grade[2]).toUpperCase();
  for (const { text: pt, label = '' } of priceTexts || []) {
    const p = parsePrice(pt);
    if (!p) continue;
    if (/(start|starting|başlangıç|старт)/i.test(label) && !info.start) info.start = p;
    else if (/(final|sold for|hammer|winning|son fiyat|конечн)/i.test(label) && !info.final) info.final = p;
    else if (/(fixed price|one price|buy now|sabit fiyat)/i.test(label) && !info.fixed) info.fixed = p;
    else if (/(current bid|high bid|highest bid|güncel teklif)\s*:?\s*$/i.test(label) && !info.bid && p.amount > 0) info.bid = p;
  }
  if (info.final && !(info.final.amount > 0)) delete info.final;
  const status = t.match(/\b(not sold|unsold|for sale|sold|awaiting auction|awaiting|upcoming|negotiat\w*)\b/i);
  if (status) info.status = status[1].toLowerCase();
  return Object.keys(info).length ? info : undefined;
}

// raw: scraper.js çıktısındaki bir öğe. site: sites.js kaydı (yoksa null).
export function toListing(raw, site, pageUrl) {
  const url = cleanUrl(raw.url);
  if (!url) return null;
  const s = raw.structured || {};
  const text = raw.text || '';
  // Başlık bulunamadıysa kart metninin fiyattan/km'den önceki kısmı kullanılır.
  const lead = text.split(new RegExp(`${PRICE_PATTERN}|\\d[\\d,.]*\\s?(?:km|miles)\\b`, 'i'))[0];
  let title = cleanText(raw.title || (lead && lead.trim().length >= 4 ? lead : text), 160);
  // "Lot info", "View details" gibi genel başlıklar yerine adresteki araç adı (Copart: /lot/123/2017-toyota-prius-…).
  if (/^(lot info|view details?|details|more info|see details)$/i.test(title)) {
    const slug = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || '').replace(/[-_]+/g, ' ').trim();
    title = slug.length >= 6 && /[a-z]/i.test(slug) ? cleanText(slug.replace(/\b\w/g, (c) => c.toUpperCase()), 160) : lead?.trim() || title;
  }
  if (!title) return null;

  const sCur = s.currency || (s.price && site?.currency) || null;
  let price = s.price && sCur ? { amount: Number(s.price), currency: String(sCur).toUpperCase() } : null;
  let total = null;
  if (!price || !Number.isFinite(price.amount) || price.amount <= 0) {
    ({ price, total } = pickPrices(raw.priceTexts));
  }

  const e = raw.embedded || {};
  let ym;
  if (s.year) {
    ym = { year: Number(s.year), month: s.month ? Number(s.month) : null };
  } else {
    // Başlıktaki yıl önceliklidir; ay yalnızca metinde yazıyorsa oradan alınır.
    const a = parseYearMonth(title);
    // Etiketli yıl ("Year : 2019.01", "Registration: 2019/1") mezat/ilan tarihinden önce gelir.
    const labeled = text.match(/\b(?:year|model year|reg(?:istration)?(?: year| date)?|first registration|初度登録|年式)\s*[:：]?\s*((?:19|20)\d\d(?:\s*[/.\-年]\s*\d{1,2}|\s*[/.\-]?\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b)?)/i);
    // Marka adının hemen önündeki yıl ("A stunning 2015 Honda Fit"): ithal aracın İngiltere kayıt yılı
    // (ör. 2026) ilan alanında geçse de üretim yılı budur.
    const makeYear = labeled ? null : text.match(MAKE_YEAR_RE);
    const b = labeled ? parseYearMonth(labeled[1]) : makeYear ? { year: Number(makeYear[1]), month: null } : parseYearMonth(text);
    ym = a.year ? { year: a.year, month: a.month ?? (b.year === a.year ? b.month : null) } : b;
    if (!ym.year && e.year) ym = { year: e.year, month: null };
  }
  // Birimi belirtilmemiş kilometre sayacı: İngiliz sitelerinde mil, diğerlerinde km.
  const unit = site?.country === 'UK' ? 'mi' : 'km';
  const toKm = (v, u) => (v == null ? null : (u || unit) === 'mi' ? Math.round(v * 1.609344) : v);
  const km = s.km ?? toKm(s.mileage, s.mileageUnit) ?? parseMileageKm(text, unit) ?? toKm(e.mileage, e.mileageUnit);
  const all = `${title} ${text}`;

  let host = '';
  try {
    host = new URL(pageUrl || url).hostname.replace(/^www\./, '');
  } catch {}

  // Mezat lotu: satıldıysa son fiyat, değilse başlangıç fiyatı (Copart: güncel teklif).
  const auctionInfo = site?.kind === 'auction' ? parseAuction(text, raw.priceTexts) : undefined;
  let priceKind;
  if (site?.kind === 'auction') {
    if (auctionInfo?.fixed) {
      price = auctionInfo.fixed;
      priceKind = 'fixed';
    } else if (auctionInfo?.final) {
      price = auctionInfo.final;
      priceKind = 'final';
    } else {
      if (auctionInfo?.bid) {
        price = auctionInfo.bid;
        priceKind = 'bid';
      } else if (auctionInfo?.start) {
        price = auctionInfo.start;
        priceKind = 'start';
      } else {
        priceKind = site.id === 'copart' ? 'bid' : 'start';
      }
    }
  }

  // Satılmış / rezerve ilan ("SOLD OUT", "Reserved", "売約済"); mezatta durum auctionInfo'dadır.
  let availability = null;
  if (site?.kind !== 'auction') {
    // Büyük harfli "SOLD" rozeti; "12 sold", "Sold by" gibi ifadeler sayılmaz.
    if (/\bsold\s?out\b|売約済|成約済|\bsatıldı\b/i.test(text) || /\bSOLD\b(?!\s+(?:BY|TO|WITH|IN|ON|AS|FOR)\b)/.test(text)) availability = 'sold';
    else if (/\b(reserved|under offer|sale agreed|on hold)\b|商談中/i.test(text)) availability = 'reserved';
  }

  return {
    id: listingKey(url),
    url,
    siteId: site?.id || `host:${host}`,
    siteName: site?.name || host,
    country: site?.country || null,
    auction: site?.kind === 'auction' || undefined,
    auctionInfo,
    priceKind,
    availability,
    title,
    image: raw.image && /^https?:/i.test(raw.image) ? raw.image : null,
    price: price?.amount ?? null,
    currency: price?.currency ?? null,
    priceTotal: total?.amount ?? null,
    priceTotalCurrency: total?.currency ?? null,
    year: ym.year,
    month: ym.month,
    km: Number.isFinite(km) ? km : null,
    fuel: s.fuel ? parseFuel(s.fuel) : parseFuel(all),
    transmission: s.transmission ? parseTransmission(s.transmission) : parseTransmission(all),
    steering: parseSteering(all),
    engineCc: parseEngineCc(all),
    // Standart yazım: gömülü veride "TOYOTA" gibi geçebilir.
    make: (s.make && (detectMake(s.make) || s.make)) || detectMake(title) || detectMake(text),
    summary: cleanText(text, 300),
    foundAt: new Date().toISOString(),
  };
}

export function toListings(raws, site, pageUrl) {
  return dedupeListings((raws || []).map((r) => toListing(r, site, pageUrl)));
}
