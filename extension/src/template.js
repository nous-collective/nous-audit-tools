// Arama URL şablon motoru.
//
//   {alan}            zorunlu alan; boşsa şablon URL üretmez (null döner)
//   {alan|mod|mod}    değiştiricilerle: lower, upper, title, slug, under, plus, enc
//   [ ... ]           isteğe bağlı parça; içindeki alanlardan biri boşsa atlanır
//
// Alanlar: make, model, keyword, q (marka + model + anahtar kelime), yearFrom,
// yearTo, priceMin, priceMax, kmMax, milesMax, postcode.

const EMPTY = '\u0000';

const MODS = {
  lower: (v) => v.toLowerCase(),
  upper: (v) => v.toUpperCase(),
  title: (v) => v.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()),
  slug: (v) =>
    encodeURIComponent(
      v
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, ''),
    ),
  under: (v) => encodeURIComponent(v.trim().replace(/\s+/g, '_')),
  plus: (v) => encodeURIComponent(v.trim().replace(/\s+/g, ' ')).replace(/%20/g, '+'),
  enc: (v) => encodeURIComponent(v),
};

function fill(str, vars, onMissing) {
  return str.replace(/\{(\w+)((?:\|\w+)*)\}/g, (_, key, mods) => {
    const raw = vars[key];
    if (raw === undefined || raw === null || String(raw).trim() === '') {
      onMissing();
      return EMPTY;
    }
    let v = String(raw).trim();
    for (const m of mods.split('|').filter(Boolean)) {
      if (!MODS[m]) throw new Error(`Bilinmeyen şablon değiştiricisi: ${m}`);
      v = MODS[m](v);
    }
    return v;
  });
}

export function buildUrl(template, vars) {
  if (!template) return null;
  const withOptional = template.replace(/\[([^[\]]*)\]/g, (_, seg) => {
    let missing = false;
    const out = fill(seg, vars, () => (missing = true));
    return missing ? '' : out;
  });
  let missing = false;
  const url = fill(withOptional, vars, () => (missing = true));
  return missing ? null : url;
}

// Şablonun zorunlu (köşeli parantez dışındaki) alanları.
export function requiredFields(template) {
  if (!template) return [];
  const outside = template.replace(/\[[^[\]]*\]/g, '');
  return [...new Set([...outside.matchAll(/\{(\w+)/g)].map((m) => m[1]))];
}

// Şablon listesinden URL üretebilen ilkini kullanır (özelden genele).
export function buildFirstUrl(templates, vars) {
  for (const t of templates || []) {
    const url = buildUrl(t, vars);
    if (url) return url;
  }
  return null;
}

// Hiçbir şablon URL üretemediğinde eksik olan alanlar (en genel şablona göre).
export function missingFields(templates, vars) {
  const last = (templates || []).at(-1);
  return requiredFields(last).filter((f) => vars[f] === undefined || vars[f] === null || String(vars[f]).trim() === '');
}

// Arama formundaki değerlerden şablon değişkenlerini üretir.
// priceMin/priceMax formda görüntüleme para biriminde girilir; burada
// sitenin kendi para birimine çevrilir.
export function searchVars(form, site, convert) {
  const q = [form.make, form.model, form.keyword].filter((x) => x && String(x).trim()).join(' ');
  const toSite = (v) => {
    if (v === '' || v === null || v === undefined) return '';
    const n = convert(Number(v), form.currency, site.currency);
    return n === null ? '' : Math.round(n);
  };
  return {
    make: form.make || '',
    model: form.model || '',
    keyword: form.keyword || '',
    q,
    yearFrom: form.yearFrom || '',
    yearTo: form.yearTo || '',
    priceMin: toSite(form.priceMin),
    priceMax: toSite(form.priceMax),
    kmMax: form.kmMax || '',
    milesMax: form.kmMax ? Math.round(Number(form.kmMax) / 1.609344) : '',
    postcode: form.postcode || '',
  };
}
