// Satın alınan aracın sipariş / nakliye bilgilerini herhangi bir sitenin sayfasından çıkarır.
// Siteye özel kod yoktur; sitenin hangi teknolojiyle yapıldığından bağımsız çalışır:
// scraper.js → collectPairs sayfadaki etiket–değer çiftlerini HTML tablolarından, tanım
// listelerinden, "Etiket: değer" metinlerinden, form alanlarından ve sayfaya gömülü JSON'dan
// (Next.js / Nuxt / satır içi durum nesneleri) toplar. Burada etiketler ve JSON anahtarları
// (vesselName → "vessel name") bir sözlükle eşleştirilir; sözlük farklı dillerdeki etiketleri de tanır.

// Her alan için etiket kalıpları. Etiket normalize edilip (küçük harf, noktalama yok) aranır.
export const ORDER_FIELDS = {
  vessel: ['vessel', 'vessel name', 'ship', 'ship name', 'carrier vessel', '船名', '本船', 'gemi', 'gemi adı', 'судно', 'теплоход', '선박', '선명'],
  voyage: ['voyage', 'voyage no', 'voy', 'voy no', '航海番号', '航海', 'sefer', 'sefer no', 'рейс', '항차'],
  etd: [
    'etd', 'departure', 'departure date', 'shipping date', 'shipment date', 'sailing date', 'loading date', 'date of shipment',
    '出港予定日', '出港日', '出航日', '船積日', '積出日', 'kalkış', 'kalkış tarihi', 'yükleme tarihi', 'sevk tarihi',
    'дата отправки', 'отправление', '출항일', '선적일',
  ],
  eta: [
    'eta', 'arrival', 'arrival date', 'estimated arrival', 'expected arrival', 'eta destination', 'eta port',
    '到着予定日', '到着日', '入港予定日', '入港日', 'varış', 'varış tarihi', 'tahmini varış', 'teslim tarihi',
    'дата прибытия', 'прибытие', '도착일', '도착예정일',
  ],
  bl: ['b/l', 'b/l no', 'bl no', 'bl', 'bl number', 'b/l number', 'bill of lading number', 'bill of lading', 'bill of lading no', 'b l no', '船荷証券', 'b/l番号', 'konşimento', 'konşimento no', 'коносамент', '선하증권'],
  container: ['container', 'container no', 'container number', 'コンテナ番号', 'konteyner', 'konteyner no', 'контейнер', '컨테이너'],
  chassis: [
    'chassis', 'chassis no', 'chassis number', 'frame no', 'frame number', 'vin', 'vin no', '車台番号', 'シャシー番号',
    'şasi', 'şasi no', 'şase no', 'номер кузова', 'vin номер', '차대번호',
  ],
  stockNo: ['stock no', 'stock id', 'stock number', 'ref no', 'reference no', 'order no', 'order number', 'invoice no', '在庫番号', '注文番号', 'sipariş no', 'ilan no', 'номер заказа', '주문번호'],
  pol: ['port of loading', 'loading port', 'pol', 'departure port', '積出港', '積地', 'yükleme limanı', 'порт отправления', '선적항'],
  pod: ['port of discharge', 'discharge port', 'destination port', 'destination', 'pod', '仕向港', '揚地', 'varış limanı', 'boşaltma limanı', 'порт назначения', '도착항'],
  status: ['status', 'order status', 'shipping status', 'shipment status', 'progress', 'ステータス', '状況', '進捗', 'durum', 'sipariş durumu', 'статус', '상태'],
  payment: ['payment status', 'payment', 'paid', '入金状況', '支払状況', 'ödeme', 'ödeme durumu', 'оплата', '결제'],
  firstReg: ['first registration', 'registration date', 'registration year', 'reg date', 'first reg', 'manufacture date', '初度登録', '初度登録年月', '年式', 'ilk tescil', 'tescil tarihi', 'первая регистрация', '최초등록'],
};

export const ORDER_LABEL_TR = {
  vessel: 'Gemi',
  voyage: 'Sefer',
  etd: 'Yükleme (ETD)',
  eta: 'Tahmini varış (ETA)',
  bl: 'Konşimento (B/L)',
  container: 'Konteyner',
  chassis: 'Şasi no',
  stockNo: 'Stok / sipariş no',
  pol: 'Yükleme limanı',
  pod: 'Varış limanı',
  status: 'Durum',
  payment: 'Ödeme',
  firstReg: 'İlk tescil',
};

const DATE_FIELDS = new Set(['etd', 'eta']);

export const normLabel = (s) =>
  String(s || '')
    // JSON anahtarları: vesselName / vessel_name / VESSEL-NAME → "vessel name"
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_\-]+/g, ' ')
    .toLocaleLowerCase('tr')
    .replace(/[：:*#. ]+$/g, '')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Etiketin hangi alana ait olduğu. En uzun (en özel) eşleşme kazanır: "payment status" → payment.
export function fieldForLabel(label) {
  const l = normLabel(label);
  if (!l || l.length > 40) return null;
  let best = null;
  for (const [field, labels] of Object.entries(ORDER_FIELDS)) {
    for (const cand of labels) {
      const c = normLabel(cand);
      const exact = l === c;
      // Kelime olarak geçmesi yeter ("eta date", "vessel name info"); kısa etiketler (eta, vin, pol)
      // yalnızca en fazla üç kelimelik etiketlerde aranır. Latin dışı yazılar kelime sınırı olmadan.
      const words = l.split(' ').length;
      const contains = (c.length >= 4 || words <= 3) && (` ${l} `.includes(` ${c} `) || (/[^\x00-\x7f]/.test(c) && l.includes(c)));
      if (exact || contains) {
        const score = (exact ? 100 : 0) + c.length;
        if (!best || score > best.score) best = { field, score };
      }
    }
  }
  return best?.field || null;
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, '0');

// Serbest tarih metnini YYYY-MM-DD'ye çevirir. Gün yoksa YYYY-MM.
export function parseDateAny(text) {
  const t = String(text || '').trim();
  let m;
  const ok = (y, mo, d) => y >= 1990 && y <= 2100 && mo >= 1 && mo <= 12 && (!d || (d >= 1 && d <= 31));
  // 2026/10/12, 2026-10-12, 2026.10.12, 2026年10月12日
  if ((m = t.match(/(\d{4})\s*[/.\-年]\s*(\d{1,2})\s*[/.\-月]\s*(\d{1,2})/))) {
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    if (ok(y, mo, d)) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  // 12-Oct-2026, 12 Oct 2026, Oct 12, 2026, October 12 2026
  if ((m = t.match(/(\d{1,2})[\s\-/]*([a-z]{3})[a-z]*\.?[\s\-/,]*(\d{4})/i)) && MONTHS[m[2].toLowerCase()]) {
    const [y, mo, d] = [+m[3], MONTHS[m[2].toLowerCase()], +m[1]];
    if (ok(y, mo, d)) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  if ((m = t.match(/([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i)) && MONTHS[m[1].toLowerCase()]) {
    const [y, mo, d] = [+m[3], MONTHS[m[1].toLowerCase()], +m[2]];
    if (ok(y, mo, d)) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  // 12.10.2026, 12/10/2026 (gün önce: Avrupa/Türkiye/İngiltere biçimi)
  if ((m = t.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/))) {
    const [d, mo, y] = [+m[1], +m[2], +m[3]];
    if (ok(y, mo, d)) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  // 2026/10, 2026年10月, Oct 2026
  if ((m = t.match(/(\d{4})\s*[/.\-年]\s*(\d{1,2})(?!\d)/)) && ok(+m[1], +m[2])) return `${m[1]}-${pad(+m[2])}`;
  if ((m = t.match(/([a-z]{3})[a-z]*\.?\s+(\d{4})/i)) && MONTHS[m[1].toLowerCase()]) return `${m[2]}-${pad(MONTHS[m[1].toLowerCase()])}`;
  return null;
}

const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, 120);

/**
 * pairs: [{ label, value }] (scraper.js collectPairs çıktısı)
 * Dönen: { fields: { vessel, eta: 'YYYY-MM-DD', … }, found: sayı }
 */
export function extractOrderInfo(pairs) {
  const fields = {};
  for (const { label, value } of pairs || []) {
    const field = fieldForLabel(label);
    const v = clean(value);
    if (!field || fields[field] || !valid(field, v)) continue;
    if (DATE_FIELDS.has(field) || field === 'firstReg') {
      const d = parseDateAny(v);
      if (d) fields[field] = d;
      continue;
    }
    fields[field] = v;
  }
  return { fields, found: Object.keys(fields).length };
}

// Alan değeri doğrulaması: gerçek sayfalarda etiketin yanında başka etiket, düğme metni ya da
// ilgisiz sayı olabiliyor ("Destination Port" → "Destination Port", "Payment" → "Change Consignee Info").
const ACTION = /^(change|edit|view|click|download|update|select|show|hide|add|remove|contact|login|sign|register|more|details|değiştir|görüntüle|tıkla|indir)\b/i;
// Arayüz kelimeleri: etiket yerine başka bir başlık ya da menü öğesi okunduğunu gösterir.
const UI_WORDS = /\b(shipment|shipping|method|destination|price|total|select|option|information|info|details|menu|search|stock|inquiry|quote)\b/i;
const PAYMENT_WORDS = /(paid|unpaid|partial|pending|received|confirmed|deposit|balance|due|complete|入金|支払|済|ödendi|ödenmedi|bekliyor|kısmi|оплачен|결제)/i;

function valid(field, v) {
  if (!v || v.length > 80 || /^[-—–?]+$/.test(v) || /^(n\/a|tbd|tba|none|null|undefined|未定|belirsiz|yok)$/i.test(v)) return false;
  if (fieldForLabel(v)) return false; // değer aslında başka bir etiket
  if (ACTION.test(v)) return false; // düğme / bağlantı metni
  switch (field) {
    case 'chassis':
      // Şasi/VIN en az 8 karakter (ZVW30-1581802, 17 haneli VIN); "ZVW51" gibi model kodu değil.
      return /^[A-Z0-9][A-Z0-9\-*]{7,}$/i.test(v.replace(/\s/g, '')) && /\d{3,}/.test(v);
    case 'bl':
    case 'container':
    case 'stockNo':
      return /\d/.test(v) && v.length <= 40;
    case 'vessel':
    case 'pol':
    case 'pod':
      return /\p{L}{2}/u.test(v) && v.length <= 40 && !/\d{4,}/.test(v) && !UI_WORDS.test(v);
    case 'payment':
      return v.length <= 40 && PAYMENT_WORDS.test(v);
    case 'voyage':
      return v.length <= 20;
    case 'status':
      return v.length <= 40 && !UI_WORDS.test(v);
    default:
      return true;
  }
}

// Varışa kalan gün (bugün = 0; geçmişse negatif). ETA yoksa null.
export function daysUntil(isoDate, now = new Date()) {
  if (!isoDate) return null;
  const [y, m, d] = isoDate.split('-').map(Number);
  const target = new Date(y, m - 1, d || 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}

export const vesselTrackUrl = (name) => `https://www.vesselfinder.com/vessels?name=${encodeURIComponent(name)}`;
