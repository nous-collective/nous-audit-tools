// Arama formundaki serbest girişi site şablonlarının beklediği marka/model
// biçimine getirir ve toplanan ilanların aramayla eşleşip eşleşmediğini kontrol eder.

import { MAKES, detectMake } from './normalize.js';

// Model adından markayı bulmak için sık aranan modeller (yalnızca marka boş bırakıldığında kullanılır).
const MODEL_MAKE = {
  Toyota: [
    'Prius', 'Aqua', 'Corolla', 'Corolla Fielder', 'Corolla Axio', 'Yaris', 'Yaris Cross', 'Vitz', 'C-HR', 'RAV4',
    'Hilux', 'Land Cruiser', 'Land Cruiser Prado', 'Prado', 'Harrier', 'Alphard', 'Vellfire', 'Voxy', 'Noah',
    'Esquire', 'Sienta', 'Passo', 'Crown', 'Camry', 'Mark X', 'Auris', 'Wish', 'Estima', 'Probox', 'Succeed',
    'Hiace', 'Townace', 'Raize', 'Roomy', 'Tank', 'Rush', 'Fortuner', 'Allion', 'Premio', 'Belta', 'Ractis',
    'Porte', 'Spade', 'bB', 'Isis', 'Kluger', 'GR86', 'GT86', 'Supra', 'Aygo', 'bZ4X', 'Mirai',
  ],
  Nissan: [
    'Note', 'Note e-Power', 'Leaf', 'Juke', 'Qashqai', 'X-Trail', 'Serena', 'March', 'Micra', 'Dayz', 'Roox',
    'Kicks', 'Sylphy', 'Tiida', 'Wingroad', 'AD', 'Cube', 'Elgrand', 'Skyline', 'Fuga', 'Teana', 'Navara',
    'Patrol', 'Caravan', 'NV200', 'NV350', 'Moco', 'Lafesta', 'Murano', 'Ariya', 'GT-R', 'Fairlady Z',
  ],
  Honda: [
    'Fit', 'Jazz', 'Vezel', 'HR-V', 'CR-V', 'Freed', 'Stepwgn', 'Step Wagon', 'Odyssey', 'Civic', 'Accord',
    'Insight', 'Shuttle', 'Grace', 'N-Box', 'N-WGN', 'N-One', 'N-Van', 'Stream', 'Airwave', 'ZR-V', 'e:Ny1',
  ],
  Mazda: ['Demio', 'Mazda2', 'Mazda3', 'Axela', 'Atenza', 'Mazda6', 'CX-3', 'CX-30', 'CX-5', 'CX-60', 'CX-8', 'MX-5', 'Roadster', 'Premacy', 'Biante', 'Bongo', 'Flair'],
  Mitsubishi: ['Outlander', 'Pajero', 'Delica', 'eK Wagon', 'eK Space', 'Mirage', 'ASX', 'RVR', 'L200', 'Triton', 'Eclipse Cross', 'Lancer', 'Colt'],
  Subaru: ['Impreza', 'Forester', 'Outback', 'Legacy', 'Levorg', 'XV', 'Crosstrek', 'BRZ', 'WRX', 'Exiga', 'Stella', 'Pleo'],
  Suzuki: ['Swift', 'Jimny', 'Vitara', 'Escudo', 'Hustler', 'Wagon R', 'Alto', 'Spacia', 'Every', 'Carry', 'Solio', 'Ignis', 'SX4', 'S-Cross', 'Baleno', 'XBee'],
  Daihatsu: ['Tanto', 'Move', 'Mira', 'Mira e:S', 'Cast', 'Rocky', 'Thor', 'Wake', 'Hijet', 'Copen', 'Boon', 'Terios'],
  Lexus: ['CT200h', 'IS', 'ES', 'GS', 'LS', 'NX', 'RX', 'UX', 'LX', 'LBX', 'RC'],
  Volkswagen: ['Golf', 'Polo', 'Passat', 'Tiguan', 'T-Roc', 'T-Cross', 'Touran', 'Up', 'ID.3', 'ID.4', 'Arteon', 'Scirocco', 'Transporter', 'Caddy'],
  Ford: ['Fiesta', 'Focus', 'Kuga', 'Puma', 'Mondeo', 'Ranger', 'Transit', 'EcoSport', 'S-Max', 'Galaxy', 'Mustang'],
  Vauxhall: ['Corsa', 'Astra', 'Insignia', 'Mokka', 'Crossland', 'Grandland', 'Zafira', 'Vivaro', 'Adam', 'Viva'],
  'Land Rover': ['Range Rover', 'Range Rover Sport', 'Range Rover Evoque', 'Evoque', 'Range Rover Velar', 'Velar', 'Discovery', 'Discovery Sport', 'Defender', 'Freelander'],
  BMW: ['1 Series', '2 Series', '3 Series', '4 Series', '5 Series', 'X1', 'X2', 'X3', 'X4', 'X5', 'i3', 'i4', 'iX'],
  'Mercedes-Benz': ['A Class', 'B Class', 'C Class', 'E Class', 'S Class', 'CLA', 'GLA', 'GLB', 'GLC', 'GLE', 'Vito', 'Sprinter'],
  Audi: ['A1', 'A3', 'A4', 'A5', 'A6', 'Q2', 'Q3', 'Q5', 'Q7', 'TT', 'e-tron'],
  Kia: ['Picanto', 'Rio', 'Ceed', 'Sportage', 'Niro', 'Stonic', 'Sorento', 'EV6', 'Soul', 'XCeed'],
  Hyundai: ['i10', 'i20', 'i30', 'Tucson', 'Kona', 'Ioniq', 'Ioniq 5', 'Santa Fe', 'Bayon'],
  Peugeot: ['108', '208', '308', '2008', '3008', '5008', 'Partner', 'Rifter'],
  Renault: ['Clio', 'Captur', 'Megane', 'Kadjar', 'Zoe', 'Twingo', 'Scenic', 'Arkana', 'Austral'],
  Mini: ['Cooper', 'Countryman', 'Clubman', 'Hatch', 'Paceman'],
};

const MODEL_INDEX = Object.entries(MODEL_MAKE)
  .flatMap(([make, models]) => models.map((m) => [m, make]))
  .sort((a, b) => b[0].length - a[0].length);

export const squash = (s) =>
  String(s || '')
    .toLocaleLowerCase('en')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');

function canonicalMake(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  return MAKES.find((m) => squash(m) === squash(t)) || detectMake(t) || t;
}

// Bilinen model yazımını (C-HR, RAV4, X-Trail…) kullanır; bilinmiyorsa baş harfleri büyütür.
function canonicalModel(text, make) {
  const t = String(text || '').trim().replace(/\s+/g, ' ');
  if (!t) return '';
  const known = (MODEL_MAKE[make] || []).find((m) => squash(m) === squash(t)) || MODEL_INDEX.find(([m]) => squash(m) === squash(t))?.[0];
  if (known) return known;
  return t
    .split(' ')
    .map((w) => (/\d/.test(w) || (w.length <= 3 && /-/.test(w)) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

// Metindeki ardışık 1-3 kelimeden biri bilinen bir modelle eşleşiyor mu?
// ("chr", "c-hr", "c hr" → C-HR). Kelime sınırına bakılır: "this" içindeki "is" Lexus IS sayılmaz.
// Eşleşen kelimeler çıkarılmış metni de döndürür.
function findModel(text, onlyMake) {
  const tokens = String(text || '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  let best = null;
  for (let i = 0; i < tokens.length; i++) {
    for (let n = 1; n <= 3 && i + n <= tokens.length; n++) {
      const w = squash(tokens.slice(i, i + n).join(''));
      // Marka bilinmiyorsa kısa (IS, X5) ya da yalnızca rakam (208) model adları sıradan kelimelerle karışır.
      const hit = MODEL_INDEX.find(
        ([m, mk]) => squash(m) === w && (onlyMake ? mk === onlyMake : w.length >= 3 && /\p{L}/u.test(w)),
      );
      if (hit && (!best || hit[0].length > best.model.length)) {
        best = { model: hit[0], make: hit[1], rest: [...tokens.slice(0, i), ...tokens.slice(i + n)].join(' ') };
      }
    }
  }
  return best;
}

function stripMake(text, make) {
  if (!make || !text) return text || '';
  const aliases = [make, make.replace('-', ' '), make === 'Mercedes-Benz' ? 'Mercedes' : null, make === 'Volkswagen' ? 'VW' : null].filter(Boolean);
  let out = ` ${text} `;
  for (const a of aliases) out = out.replace(new RegExp(`\\s${a.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}(?=\\s)`, 'i'), ' ');
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Formdaki marka/model/anahtar kelimeyi düzenler:
 *  - "toyota prius" marka alanına yazılmışsa marka + model olarak ayırır,
 *  - marka boşsa model ya da anahtar kelimeden markayı bulur (Prius → Toyota),
 *  - model boşsa anahtar kelimedeki bilinen modeli model alanına taşır,
 *  - markayı ve modeli sitelerin beklediği yazıma getirir (toyota → Toyota, chr → C-HR).
 * Dönen `form` girişin kopyasıdır; `inferred` doldurulan alanları listeler.
 */
export function normalizeQuery(input) {
  const f = { ...input };
  const inferred = [];
  let make = String(f.make || '').trim();
  let model = String(f.model || '').trim();
  let keyword = String(f.keyword || '').trim();

  if (make) {
    const detected = detectMake(make);
    if (detected) {
      // Marka alanına "Toyota Prius" yazılmış olabilir.
      const rest = stripMake(make, detected);
      if (rest && squash(rest) !== squash(detected)) {
        if (!model) {
          model = rest;
          inferred.push('model');
        } else {
          keyword = `${rest} ${keyword}`.trim();
        }
      }
      make = detected;
    } else {
      make = canonicalMake(make);
    }
  } else {
    make = detectMake(model) || detectMake(keyword) || '';
    if (make) inferred.push('make');
  }
  model = stripMake(model, make);
  keyword = stripMake(keyword, make);

  if (!model && keyword) {
    const hit = findModel(keyword, make || null);
    if (hit) {
      model = hit.model;
      keyword = hit.rest;
      make ||= hit.make;
      inferred.push('model');
      if (!inferred.includes('make') && !input.make) inferred.push('make');
    }
  }
  if (!make && model) {
    const hit = findModel(model);
    if (hit && squash(hit.model) === squash(model)) {
      make = hit.make;
      inferred.push('make');
    }
  }

  f.make = make;
  f.model = canonicalModel(model, make);
  f.keyword = keyword;
  return { form: f, inferred: [...new Set(inferred)] };
}

// İlan başlığı aranan marka ve modeli içeriyor mu? (Sitelerin "önerilen araçlar" gibi
// alakasız bölümlerini ayıklamak için.) Aranan bir şey yoksa her ilan eşleşir.
export function matchesQuery(listing, q) {
  if (!q) return true;
  const title = squash(`${listing.title} ${listing.summary || ''}`);
  if (q.make) {
    const make = listing.make || detectMake(listing.title);
    if (make && squash(make) !== squash(q.make)) return false;
    if (!make && !title.includes(squash(q.make))) {
      // Başlıkta marka yoksa modelle yetin.
      if (!q.model) return false;
    }
  }
  if (q.model && !title.includes(squash(q.model))) return false;
  return true;
}
