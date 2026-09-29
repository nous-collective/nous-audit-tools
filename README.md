# KKTC Araç Toplayıcı (Chrome eklentisi)

Japonya ve İngiltere'deki ikinci el araç sitelerini tek panelde toplar. İlanları buradan inceleyip filtreleyebilir, takip listesine alabilirsin. Her aracı KKTC'ye getirmek açısından da değerlendirir: yaş sınırını kontrol eder, tahmini varış maliyetini hesaplar, satıcıya gönderilecek teklif mesajını hazırlar.

## Kurulum

1. Bu depoyu indir (ya da `kktc-arac-toplayici.zip` dosyasını bir klasöre aç).
2. Chrome'da `chrome://extensions` adresini aç.
3. Sağ üstten **Geliştirici modu**'nu aç.
4. **Paketlenmemiş öğe yükle**'ye bas ve `extension` klasörünü seç.
5. Eklenti simgesine tıkla, **Paneli aç**'ı seç.

## Nasıl çalışır?

- **Arama:** Marka ve model girip *Tüm sitelerde ara*'ya bastığında eklenti her sitede arar ve ilanları panelde birleştirir.
  - Önce sayfayı pencere açmadan hızlıca indirir. Aranan marka/modelle eşleşen yeterli ilan çıkmazsa sayfayı küçültülmüş bir pencerede, gerçek bir sekmede açar. Böylece JavaScript ile çizilen siteler de okunur.
  - Siteye giriş yaptıysan senin oturumunla açılır.
  - Her siteden önce 50 ilan toplanır; bunun için sitenin sayfaları sırayla gezilir. Sayıyı arama formundaki *Siteden ilan* alanından ya da *Ayarlar*'dan değiştirebilirsin.
- **Sayfa sayfa gezinme:** Tüm sitelerin ilanları tek listede, en ucuzdan pahalıya sıralanır. Her sayfada 50 ilan var (*Ayarlar → Sayfa başına gösterilecek ilan*).
  - Beğenmediğin sayfayı altındaki **1 2 3 … Sonraki ›** tuşlarıyla geçersin.
  - Son sayfaya gelince eklenti, sonraki sayfası olan sitelerden yeni ilanları kendiliğinden getirir. Durum çubuğunda bu siteler *devamı var* diye işaretli.
  - Hiçbir sitede sayfa kalmayınca listenin altında *Tüm sitelerdeki ilanlar gösterildi* yazar.
  - Yeni gelen ilanlar da fiyat sırasına girer. Bu yüzden daha ucuz bir ilan önceki bir sayfaya yerleşebilir.
  - Yol vergisi ("£20 a yr road tax"), posta ve kargo tutarları fiyat sayılmaz. Mezat sitelerinde (Copart) gösterilen tutar güncel tekliftir ve kartta öyle yazar.
- **Akıllı sorgu:** Marka boş bırakılırsa modelden bulunur: "prius" → Toyota Prius, "chr" → Toyota C-HR. Marka alanına "toyota prius" yazılırsa marka ve model ayrılır. Model girilmezse siteler yalnızca markayla aranır, atlanmaz.
- **Kopya ayıklama:** Aynı ilan birden fazla kez görünmez. Birleştirilen durumlar:
  - aynı ilana giden farklı bağlantılar (fotoğrafta `?refkey=…`, başlıkta parametresiz; `www`/`sp`/`m` alt alan adları)
  - sayfadaki gizli mobil kopyalar
  - JSON-LD ile sayfadaki kartın ayrı gelmesi
- **Sayfa okuyucu:** Site başına sabit bir yapıya bağlı değil. Sayfadaki tekrar eden ilan kartlarını (fiyat, bağlantı, görsel) ve varsa schema.org JSON-LD verisini kendisi bulur. Bu yüzden siteler tasarım değiştirdiğinde çoğunlukla çalışmaya devam eder.
- **Filtreleme ve sıralama:** Ülke, site, yıl, fiyat (seçtiğin para birimine çevrilmiş), km, yakıt, vites, direksiyon ve KKTC yaş durumu.
  - *Sadece aranan marka/model* seçeneği, sitelerin "önerilen araçlar" gibi alakasız bölümlerini gizler. Kaç ilanın gizlendiği sonuç sayısının yanında yazar; kapatınca hepsi görünür.
- **Takip listesi:** ☆ ile eklediğin ilanlara durum (İnceleniyor, Teklif istendi, Pazarlıkta, Ödeme yapıldı, Yolda…) ve not ekleyebilirsin. Listeyi CSV olarak indirebilirsin.
- **Teklif mesajı:** ✉ düğmesi satıcıya gönderilecek İngilizce mesajı panoya kopyalar.
  - Japon ihracatçılar için Gazimağusa'ya CIF fiyat, ilk tescil ayı ve auction sheet ister.
  - İngiliz satıcılar için V5C, MOT ve ihracata teslim bilgisi ister.
- **Satın alma:** Ödeme, sözleşme ve mezat teklifi güvenlik gereği her sitenin kendi sayfasında yapılır. *Sitede satın al ↗* ilanı açar; eklenti ödeme yapmaz ve kart bilgisi istemez.

### Mezat (açık artırma)

*Mezatları da ara* işaretliyse (varsayılan) şu kaynaklar da aranır:

- **Banzai24:** Japonya'daki araç mezatları (USS, TAA, CAA, JU, Honda AA…).
- **Banzai24 One Price:** mezat evlerinin sabit fiyatlı stokları.
- **Copart UK.**

Mezat lotlarında fiyatın ne olduğu kartta açıkça yazar:

- **Mezat son fiyatı (satıldı):** Lot satılmış, gerçekleşen fiyat.
- **Başlangıç fiyatı, son fiyat değil:** Mezat henüz yapılmadı ya da lot satılmadı.
- **Güncel teklif (Copart):** Mezat devam ediyor.
- **Mezat evi sabit fiyatı:** One Price stoku.

Kartta ayrıca mezat evi, lot no, mezat tarihi/saati, puan (grade) ve durum yer alır. *Satış türü* filtresiyle yalnızca sabit fiyatlı ilanları ya da yalnızca mezat lotlarını görebilirsin.

Mezattan araç almak için teklifi bir mezat aracısı verir. ✉ düğmesi mezat lotunda aracıya teklif talebi hazırlar: lot bilgisi, çevirili auction sheet isteği, azami teklif ve CIF Gazimağusa maliyeti.

Banzai24 bir aramada ilk 20 lotu verir; sayfalamayı site sayfa içinde yapıyor. Fazlası için sitede aşağı kaydırıp eklenti simgesinden *Bu sayfadaki ilanları topla*'yı kullan. Aleado, BCA, Manheim ve Aston Barclay üyelik istediği için "elle aç" grubunda.

### Satın aldığın aracı takip etme (gemi, yükleme ve varış tarihi)

1. Satıcının sitesinde siparişinin sayfasını aç (ör. "My Page", "Order", "Shipment").
2. Eklenti simgesine tıkla ve **Sipariş / nakliye bilgilerini al**'a bas.
3. Bulunan bilgileri kontrol et. Eklenti bilginin takip listesindeki hangi araca ait olduğunu tahmin eder; gerekirse seçimi değiştir. Sonra **Takip listesine kaydet**'e bas.

Takip listesinde araç kartı şunları gösterir:

- gemi, sefer, yükleme (ETD) ve varış (ETA) tarihleri
- B/L, konteyner ve şasi numarası, varış limanı
- "Varışa 18 gün" geri sayımı ve *Gemiyi izle* bağlantısı

KKTC yaş kontrolü artık gerçek ilk tescil tarihine ve ETA'ya göre yapılır. Panel açıldığında 12 saatten eski sipariş bilgileri senin oturumunla arka planda yeniden okunur; değişen alanlar (ör. ETA ertelendi) bildirilir ve kaydedilir. *Yeniden tara* ile istediğin zaman güncelleyebilirsin.

**Siteye özel kod yok.** Okuyucu sitenin hangi teknolojiyle yapıldığından bağımsız çalışır. Bilgiyi şu kaynaklardan toplar:

- HTML tabloları, tanım listeleri ve yan yana etiket–değer kutuları
- "Etiket: değer" metinleri ve form alanları
- sayfaya gömülü veri (Next.js, Nuxt, satır içi durum nesneleri, JSON)

JavaScript ile çizilen sayfalar gerçek sekmede okunur. Etiketler ve JSON anahtarları (`vesselName`, `eta_date`…) İngilizce, Japonca, Türkçe, Rusça ve Korece bir sözlükle eşleştirilir. Her değer doğrulanır: başka bir etiket, düğme metni ya da model kodu bilgi sanılmaz.

### Otomatik aranamayan siteler

Şablonu olmayan, robot doğrulaması isteyen ya da üyelik gerektiren siteler arama sonrası durum çubuğunda *Otomatik aranamayan N site* grubunda listelenir. Bunlarda şöyle yap:

1. Gruptaki siteye ya da *Siteler* sekmesindeki **Sitede aç**'a bas.
2. Sitede kendi aramanı yap (gerekirse giriş yap veya doğrulamayı geç).
3. Eklenti simgesine tıklayıp **Bu sayfadaki ilanları topla**'ya bas. İlanlar panele eklenir.

## Siteler

| Ülke | Otomatik arama | Yalnızca "Sitede aç" + sayfayı topla |
| --- | --- | --- |
| 🇯🇵 Japonya | BE FORWARD, SBT Japan, Car From Japan, TCV, Goo-net Exchange, Real Motor Japan, PicknBuy24, CardealPage, Car Junction, SAT Japan, Autorec, TRUST Japan, Has-Nihon (üyelik gerekli), Banzai24 mezatları, Banzai24 One Price | Japanese Car Trade, Nichibo (mezat aracısı), Aleado, Japan Car Direct, CarsJapan Cyprus (mezat aracıları) |
| 🇬🇧 İngiltere | AutoTrader UK, eBay Motors UK, Gumtree, Motors.co.uk (Cazoo), PistonHeads, cinch, Carwow, Exchange & Mart, Copart UK | CarGurus UK, BCA, Manheim, Aston Barclay |

Arama URL'leri *Siteler* sekmesindeki şablonlardan üretilir. Otomatik aranan 20 sitenin marka + model arama adresleri, sitelerin arama motorlarında görünen gerçek sayfa adresleriyle karşılaştırılarak doğrulandı. Yalnızca markayla arama biçimleri Car Junction, Carwow, AutoTrader, SBT ve TCV'de doğrulandı; diğerlerinde aynı yapının kısaltmasıdır. Bir site adres yapısını değiştirirse ve sonuç gelmezse: sitede kendi aramanı yap, adres çubuğundaki URL'yi şablona uyarla.

Has-Nihon stok listesini yalnızca üyelere gösteriyor. Sitede oturum açtıysan eklenti senin oturumunla tüm stoku açar ve aradığın marka/model panelde süzülür. Oturum yoksa durum çubuğunda *giriş gerekli* yazar. Has-Nihon'un stok sayfası üye olmadan görülemediği için test edilemedi.

Enhance Auto (alan adı satılık) ve Tomisho (kaydı bulunamadı) listeden çıkarıldı. Motors.co.uk artık Cazoo'ya yönlendirdiği için şablon cazoo.co.uk'yi kullanıyor.

### Canlı test sonucu (27 Eylül 2026, "Toyota Prius")

Eklenti gerçek sitelerde, bir bulut sunucusundan test edildi.

| Durum | Siteler |
| --- | --- |
| Çalışıyor (16) | BE FORWARD, SBT Japan, Car From Japan, TCV, Goo-net Exchange, Real Motor Japan, PicknBuy24, CardealPage, AutoTrader UK, eBay, Gumtree, PistonHeads, cinch, Carwow, Exchange & Mart, Copart |
| İlanlar geliyor, fiyat yok | Car Junction (site fiyatı yazmıyor, "Enquiry" ile soruluyor) |
| Bot kontrolü | Cazoo (Vercel), SAT Japan (Cloudflare). Veri merkezi IP'lerine çıkıyor; kendi tarayıcında çoğunlukla geçer. Çıkarsa *Ayarlar → Pencere → görünür pencere* seçeneğini kullan. |
| Test edilemedi | Autorec (test sunucusundan bağlantı kurulamadı) |

Testi kendin tekrarlamak için *Siteler → Siteleri test et*'e bas. Geliştirme ortamında `node tools/live-test.mjs rapor.json` da aynı testi yapar.

Şablon sözdizimi:

- `{make}`, `{model}`, `{q}`, `{yearFrom}`, `{yearTo}`, `{priceMin}`, `{priceMax}`, `{kmMax}`, `{milesMax}`, `{postcode}` alanları kullanılabilir.
- Değiştiriciler: `|lower`, `|upper`, `|title`, `|slug`, `|under`, `|plus`, `|enc`.
- `[ … ]` içindeki kısım, alan boşsa atlanır.
- Her satıra bir şablon yazılabilir. Üstteki önce denenir; gereken alan boşsa (ör. model girilmemişse) alttakine geçilir.

## KKTC hesapları

- **Yaş sınırı:** Bulunan kaynaklara göre KKTC'ye ithal edilen ikinci el aracın ilk tescil tarihi ile KKTC limanına varış tarihi arasında en fazla 5 yıl olmalı. Eklenti, nakliye süresini (varsayılan 2 ay) ekleyerek her ilanı *uygun / sınırda / yaşlı* diye işaretler. İlk tescil ayı bilinmiyorsa en kötü durumu varsayar.
- **Tahmini maliyet:** Araç fiyatı + nakliye + sigorta = CIF. Bunun üzerine gümrük ve vergi yüzdesi ile sabit masraflar eklenir. Oranlar araç tipine ve motor hacmine göre değiştiği için vergi oranını *Ayarlar*'dan senin girmen gerekir. Oran girilmeden maliyet gösterilmez.
- **Döviz kurları:** open.er-api.com'dan (yedek: frankfurter.dev) alınır, istersen elle girebilirsin.

> Mevzuat değişebilir. Araç almadan önce KKTC Gümrük ve Rüsumat Dairesi, Motorlu Araçlar Mukayyitliği ve bir gümrük müşaviriyle teyit et.

## Siteleri test etme

*Siteler* sekmesindeki **Siteleri test et** düğmesi tüm otomatik sitelerde "Toyota Prius" arar. Her site için bir satırda şunları gösterir:

- gelen ilan sayısı ve bunlardan aranan araçla eşleşenler
- fiyatı, yılı ve km'si okunabilen ilanların oranı
- kopya şüphesi
- sayfanın nasıl okunduğu (indirme ya da sekme)
- örnek bir ilan

Her site *Çalışıyor*, *Sorunlu* ya da *Çalışmıyor* olarak işaretlenir. **Test raporunu indir** ile inen JSON dosyasını paylaşırsan sorunlu siteler doğrudan düzeltilebilir. Test, arama sonuçlarına karışmaz.

## Sorun giderme

- **Bir site "ilan yok" diyor ama sitede ilan var:** Aramadan sonra **Tanı raporu**'na bas ve inen JSON dosyasını paylaş. Raporda her site için şunlar var: açılan adres, yöntem (indirme/sekme), HTTP durumu ve sayfada tanınan kart yapılarından örnekler. Kişisel ayarların (iletişim bilgileri) rapora girmez. Kendin bakmak istersen *Siteler* sekmesinde **Dene**'ye basıp açılan sayfayı kontrol et.
- **Çok ilan gizli görünüyor:** Başlıkta aranan model geçmeyen ilanlar gizlenir. *Sadece aranan marka/model* kutusunu kapat.
- **"Doğrulama gerekli":** Site robot kontrolü gösteriyor. *Ayarlar → Arama motoru → Pencere* seçeneğini **görünür pencere** yap ya da sayfayı elle açıp *Bu sayfadaki ilanları topla*'yı kullan.
- **Sekmede açılan bazı siteler eksik yükleniyor:** *Sayfa yüklendikten sonra bekleme* süresini artır (ör. 5000 ms) ya da görünür pencere modunu kullan.
- **Arama sırasında panel sekmesini kapatma:** Tarama panel sayfası üzerinden yürür; sekme kapanırsa arama durur.

## Gizlilik

Tüm veriler (sonuçlar, takip listesi, ayarlar) yalnızca tarayıcının yerel deposunda (`chrome.storage.local`) tutulur. Eklenti, ilan siteleri ve döviz kuru servisi dışında hiçbir sunucuya bağlanmaz.

## Geliştirme

```bash
npm install
npm test          # birim + sayfa okuyucu + uçtan uca eklenti testleri (Chromium)
npm run zip       # extension/ klasörünü kktc-arac-toplayici.zip olarak paketler
npm run icons     # ikonları yeniden üretir
```

Dosyalar:

- `extension/src/sites.js`: site listesi ve arama şablonları
- `extension/src/query.js`: marka/model çıkarımı ve arama eşleşmesi
- `extension/src/scraper.js`: ilan okuyucu (sekmeye enjekte edilir ya da indirilen HTML'de çalışır)
- `extension/src/normalize.js`: fiyat, yıl, km ayrıştırma, ilan kimliği ve kopya ayıklama
- `extension/src/runner.js`: siteleri indirip gerekirse sekmede açan, sayfaları gezen motor
- `extension/src/kktc.js`: yaş sınırı, maliyet ve teklif mesajı
- `extension/src/dashboard.js`: panel arayüzü
- `extension/src/popup.js`: eklenti simgesindeki menü
