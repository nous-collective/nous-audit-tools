// KKTC'ye özel hesaplar: yaş sınırı kontrolü, tahmini maliyet, satıcıya teklif mesajı.
// Mevzuat değişebilir; varsayılanlar Ayarlar sekmesinden değiştirilebilir.

export const AGE_LABEL = {
  ok: 'KKTC yaş sınırına uygun',
  risky: 'Sınırda: ilk tescil ayını kontrol et',
  no: 'Yaş sınırını aşıyor',
  unknown: 'Yıl bilinmiyor',
};

// Aracın ilk tescil tarihi ile KKTC limanına varış tarihi arasındaki farkı kontrol eder.
export function ageStatus(listing, { maxAgeYears = 5, shippingMonths = 2, now = new Date() } = {}) {
  if (!listing.year) return 'unknown';
  const arrival = new Date(now.getFullYear(), now.getMonth() + Number(shippingMonths || 0), now.getDate());
  const limit = new Date(arrival.getFullYear() - Number(maxAgeYears), arrival.getMonth(), arrival.getDate());
  // Ay bilinmiyorsa en kötü (Ocak) ve en iyi (Aralık) durumu dene.
  const earliest = new Date(listing.year, (listing.month || 1) - 1, 1);
  const latest = listing.month ? earliest : new Date(listing.year, 11, 1);
  if (earliest >= limit) {
    // Varışta 2 aydan az pay kalıyorsa gecikme riskine karşı uyar.
    const margin = new Date(limit.getFullYear(), limit.getMonth() + 2, limit.getDate());
    return earliest < margin ? 'risky' : 'ok';
  }
  return latest >= limit ? 'risky' : 'no';
}

// Tahmini varış maliyeti (görüntüleme para biriminde). Ayarlarda vergi oranı
// girilmemişse null döner, uydurma oran kullanılmaz.
export function landedCost(listing, settings, convert) {
  const to = settings.displayCurrency;
  const cost = settings.costs || {};
  if (listing.price === null || cost.taxPct === '' || cost.taxPct === null || cost.taxPct === undefined) return null;
  const price = convert(listing.price, listing.currency, to);
  if (price === null) return null;
  const ship = listing.country === 'UK' ? cost.shippingUK : cost.shippingJP;
  const shipping = ship?.amount ? convert(Number(ship.amount), ship.currency, to) : 0;
  const insurance = ((price + (shipping || 0)) * Number(cost.insurancePct || 0)) / 100;
  const cif = price + (shipping || 0) + insurance;
  const tax = (cif * Number(cost.taxPct)) / 100;
  const fees = cost.fixedFees?.amount ? convert(Number(cost.fixedFees.amount), cost.fixedFees.currency, to) || 0 : 0;
  return { price, shipping: shipping || 0, insurance, tax, fees, total: cif + tax + fees, currency: to };
}

export function inquiryMessage(listing, contact = {}) {
  const sign = [contact.name, contact.email, contact.phone].filter(Boolean).join('\n');
  if (listing.auction && listing.auctionInfo) {
    // Mezat lotu: mezat aracısına teklif verme talebi.
    const a = listing.auctionInfo;
    return [
      'Hello,',
      '',
      'I would like you to bid on my behalf for this auction lot:',
      listing.title,
      [a.house, a.lot && `Lot ${a.lot}`, a.date].filter(Boolean).join(', '),
      listing.url,
      '',
      'Before bidding, please send me the auction sheet (translated), grade, and the first registration date (year/month).',
      'My maximum bid: ______ JPY. The car will be shipped to Famagusta (Gazimağusa), Northern Cyprus.',
      'Please include your service fee, inland transport, export and shipping (CIF Famagusta) costs.',
      '',
      'Thank you,',
      sign,
    ].join('\n');
  }
  if (listing.country === 'UK') {
    return [
      'Hello,',
      '',
      'I am interested in this vehicle:',
      listing.title,
      listing.url,
      '',
      'Is it still available? I am buying for export to Northern Cyprus. Could you please confirm:',
      '- date of first registration (month/year) and V5C logbook',
      '- mileage, MOT expiry and service history',
      '- HPI / finance status',
      '- whether you can deliver the car to a shipping agent or port, and the final price for export',
      '',
      'Thank you,',
      sign,
    ].join('\n');
  }
  return [
    'Hello,',
    '',
    'I am interested in this vehicle:',
    listing.title,
    listing.url,
    '',
    'Could you please send me a CIF quotation to Famagusta (Gazimağusa), Northern Cyprus?',
    'Please also confirm:',
    '- first registration date (year and month)',
    '- mileage and auction grade / inspection sheet',
    '- chassis number and export certificate availability',
    '- estimated shipping schedule and payment terms',
    '',
    'Thank you,',
    sign,
  ].join('\n');
}
