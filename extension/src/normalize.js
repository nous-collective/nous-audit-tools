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

const CURRENCY_CODES = {
  'US$': 'USD', 'US $': 'USD', USD: 'USD', $: 'USD',
  '£': 'GBP', GBP: 'GBP',
  '¥': 'JPY', '￥': 'JPY', JPY: 'JPY', 円: 'JPY', 万円: 'JPY',
  '€': 'EUR', EUR: 'EUR',
};

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
  const re =
    /(US\s?\$|USD|\$|£|GBP|¥|￥|JPY|€|EUR)\s?(\d{1,3}(?:[,.  ']\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(\s?万)?|(\d{1,3}(?:[,.  ']\d{3})+|\d+(?:\.\d+)?)\s?(万円|円|JPY|USD|GBP|EUR|€)/i;
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
  const currency = CURRENCY_CODES[sym] || CURRENCY_CODES[sym.replace('US', 'US$')] || null;
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
  for (const { text, label = '', after = '' } of priceTexts) {
    const p = parsePrice(text);
    if (!p) continue;
    const l = label.toLowerCase();
    const a = after.toLowerCase();
    if (/^\s*(\/\s?mo|\/\s?month|per month|p\/m|pm\b|a month|monthly|pcm)/.test(a) || /\b(from|deposit|monthly|per month)\s*$/.test(l)) {
      continue; // taksit / peşinat
    }
    if (/(total|cif|c&f|c\s?and\s?f|toplam)/.test(l)) {
      total ??= p;
    } else if (/\b(was|previous|old price|rrp|save|saving|you save|discount|off)\b[^\d]*$/.test(l)) {
      continue;
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

export function parseMileageKm(text) {
  if (!text) return null;
  const k = text.match(/\b(\d+(?:\.\d+)?)\s?k\s?(miles|mi|km)\b/i);
  if (k) {
    const v = Number(k[1]) * 1000;
    return /^km/i.test(k[2]) ? v : Math.round(v * 1.609344);
  }
  const m = text.match(/\b(\d{1,3}(?:[,.\s]\d{3})+|\d+)\s?(km|kms|kilometers|kilometres|miles|mile|mi)\b/i);
  if (!m) return null;
  const v = Number(m[1].replace(/[,.\s]/g, ''));
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

export function cleanUrl(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|gclid|fbclid|_trkparms|_trksid|hash$)/i.test(k)) u.searchParams.delete(k);
    }
    return u.toString();
  } catch {
    return null;
  }
}

function cleanText(s, max = 200) {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

// raw: scraper.js çıktısındaki bir öğe. site: sites.js kaydı (yoksa null).
export function toListing(raw, site, pageUrl) {
  const url = cleanUrl(raw.url);
  if (!url) return null;
  const s = raw.structured || {};
  const text = raw.text || '';
  const title = cleanText(raw.title || text, 160);
  if (!title) return null;

  let price = s.price && s.currency ? { amount: Number(s.price), currency: s.currency.toUpperCase() } : null;
  let total = null;
  if (!price || !Number.isFinite(price.amount) || price.amount <= 0) {
    ({ price, total } = pickPrices(raw.priceTexts));
  }

  let ym;
  if (s.year) {
    ym = { year: Number(s.year), month: s.month ? Number(s.month) : null };
  } else {
    // Başlıktaki yıl önceliklidir; ay yalnızca metinde yazıyorsa oradan alınır.
    const a = parseYearMonth(title);
    const b = parseYearMonth(text);
    ym = a.year ? { year: a.year, month: a.month ?? (b.year === a.year ? b.month : null) } : b;
  }
  const km = s.km ?? parseMileageKm(text);
  const all = `${title} ${text}`;

  let host = '';
  try {
    host = new URL(pageUrl || url).hostname.replace(/^www\./, '');
  } catch {}

  return {
    id: url,
    url,
    siteId: site?.id || `host:${host}`,
    siteName: site?.name || host,
    country: site?.country || null,
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
    make: s.make || detectMake(title) || detectMake(text),
    summary: cleanText(text, 300),
    foundAt: new Date().toISOString(),
  };
}

export function toListings(raws, site, pageUrl) {
  const seen = new Set();
  const out = [];
  for (const r of raws || []) {
    const l = toListing(r, site, pageUrl);
    if (!l || seen.has(l.id)) continue;
    seen.add(l.id);
    out.push(l);
  }
  return out;
}
