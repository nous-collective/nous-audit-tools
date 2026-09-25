# KKTC Araç Toplayıcı (Chrome eklentisi)

Japonya ve İngiltere'deki ikinci el araç sitelerini tek panelde toplar. İlanları buradan inceleyip filtreleyebilir, takip listesine alabilirsin. Her aracı KKTC'ye getirmek açısından da değerlendirir: yaş sınırını kontrol eder, tahmini varış maliyetini hesaplar, satıcıya gönderilecek teklif mesajını hazırlar.

## Kurulum

1. Bu depoyu indir (ya da `kktc-arac-toplayici.zip` dosyasını bir klasöre aç).
2. Chrome'da `chrome://extensions` adresini aç.
3. Sağ üstten **Geliştirici modu**'nu aç.
4. **Paketlenmemiş öğe yükle**'ye bas ve `extension` klasörünü seç.
5. Eklenti simgesine tıkla, **Paneli aç**'ı seç.

## Nasıl çalışır?

- **Arama:** Marka ve model girip *Tüm sitelerde ara*'ya bastığında eklenti her siteyi arka planda, küçültülmüş bir pencerede açar. Sayfa yüklendikten sonra ilanları okur ve panelde birleştirir.
  - Sayfalar senin tarayıcında açıldığı için JavaScript ile çizilen siteler de çalışır.
  - Siteye giriş yaptıysan senin oturumunla açılır.
- **Sayfa okuyucu:** Site başına sabit bir yapıya bağlı değil. Sayfadaki tekrar eden ilan kartlarını (fiyat, bağlantı, görsel) ve varsa schema.org JSON-LD verisini kendisi bulur. Bu yüzden siteler tasarım değiştirdiğinde çoğunlukla çalışmaya devam eder.
- **Filtreleme ve sıralama:** Ülke, site, yıl, fiyat (seçtiğin para birimine çevrilmiş), km, yakıt, vites, direksiyon ve KKTC yaş durumu.
- **Takip listesi:** ☆ ile eklediğin ilanlara durum (İnceleniyor, Teklif istendi, Pazarlıkta, Ödeme yapıldı, Yolda…) ve not ekleyebilirsin. Listeyi CSV olarak indirebilirsin.
- **Teklif mesajı:** ✉ düğmesi satıcıya gönderilecek İngilizce mesajı panoya kopyalar.
  - Japon ihracatçılar için Gazimağusa'ya CIF fiyat, ilk tescil ayı ve auction sheet ister.
  - İngiliz satıcılar için V5C, MOT ve ihracata teslim bilgisi ister.
- **Satın alma:** Ödeme, sözleşme ve mezat teklifi güvenlik gereği her sitenin kendi sayfasında yapılır. *Sitede satın al ↗* ilanı açar; eklenti ödeme yapmaz ve kart bilgisi istemez.

### Otomatik aranamayan siteler

Şablonu olmayan, robot doğrulaması isteyen ya da üyelik gerektiren sitelerde şöyle yap:

1. *Siteler* sekmesinden ya da durum çipinden **Sitede aç**'a bas.
2. Sitede kendi aramanı yap (gerekirse giriş yap veya doğrulamayı geç).
3. Eklenti simgesine tıklayıp **Bu sayfadaki ilanları topla**'ya bas. İlanlar panele eklenir.

## Siteler

| Ülke | Otomatik arama | Yalnızca "Sitede aç" + sayfayı topla |
| --- | --- | --- |
| 🇯🇵 Japonya | BE FORWARD, SBT Japan, Car From Japan, TCV, Goo-net Exchange, Real Motor Japan, PicknBuy24, CardealPage, Car Junction | Autorec, Enhance Auto, Tomisho, SAT Japan, Japan Car Direct, CarsJapan Cyprus |
| 🇬🇧 İngiltere | AutoTrader UK, eBay Motors UK, Gumtree, Motors.co.uk (Cazoo), PistonHeads, cinch, Carwow, Copart UK | CarGurus UK, Exchange & Mart, BCA, Manheim, Aston Barclay |

Arama URL'leri *Siteler* sekmesindeki şablonlardan üretilir. Otomatik aranan 17 sitenin 13'ünün URL yapısı gerçek sayfalarla doğrulandı. BE FORWARD, AutoTrader, eBay ve Copart **Doğrulanmadı** olarak işaretli: bunlardan sonuç gelmezse sitede kendi aramanı yap ve adres çubuğundaki URL'yi şablona uyarla.

Şablon sözdizimi:

- `{make}`, `{model}`, `{q}`, `{yearFrom}`, `{yearTo}`, `{priceMin}`, `{priceMax}`, `{kmMax}`, `{milesMax}`, `{postcode}` alanları kullanılabilir.
- Değiştiriciler: `|lower`, `|upper`, `|title`, `|slug`, `|under`, `|plus`, `|enc`.
- `[ … ]` içindeki kısım, alan boşsa atlanır.

## KKTC hesapları

- **Yaş sınırı:** Bulunan kaynaklara göre KKTC'ye ithal edilen ikinci el aracın ilk tescil tarihi ile KKTC limanına varış tarihi arasında en fazla 5 yıl olmalı. Eklenti, nakliye süresini (varsayılan 2 ay) ekleyerek her ilanı *uygun / sınırda / yaşlı* diye işaretler. İlk tescil ayı bilinmiyorsa en kötü durumu varsayar.
- **Tahmini maliyet:** Araç fiyatı + nakliye + sigorta = CIF. Bunun üzerine gümrük ve vergi yüzdesi ile sabit masraflar eklenir. Oranlar araç tipine ve motor hacmine göre değiştiği için vergi oranını *Ayarlar*'dan senin girmen gerekir. Oran girilmeden maliyet gösterilmez.
- **Döviz kurları:** open.er-api.com'dan (yedek: frankfurter.dev) alınır, istersen elle girebilirsin.

> Mevzuat değişebilir. Araç almadan önce KKTC Gümrük ve Rüsumat Dairesi, Motorlu Araçlar Mukayyitliği ve bir gümrük müşaviriyle teyit et.

## Sorun giderme

- **Bir site "ilan yok" diyor ama sitede ilan var:** Şablon yanlış olabilir. *Siteler* sekmesinde **Dene**'ye basıp açılan sayfayı kontrol et. Gerekirse sitede kendi aramanı yapıp URL'yi şablona uyarla.
- **"Doğrulama gerekli":** Site robot kontrolü gösteriyor. *Ayarlar → Arama motoru → Pencere* seçeneğini **Görünür pencerede** yap ya da sayfayı elle açıp *Bu sayfadaki ilanları topla*'yı kullan.
- **Arka planda bazı siteler eksik yükleniyor:** Bazı siteler küçültülmüş pencerede ilanları geç çizer. *Sayfa yüklendikten sonra bekleme* süresini artır (ör. 5000 ms) ya da görünür pencere modunu kullan.
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
- `extension/src/scraper.js`: sayfaya enjekte edilen ilan okuyucu
- `extension/src/normalize.js`: fiyat, yıl, km vb. ayrıştırma
- `extension/src/runner.js`: siteleri sekmelerde açıp tarayan motor
- `extension/src/kktc.js`: yaş sınırı, maliyet ve teklif mesajı
- `extension/src/dashboard.js`: panel arayüzü
- `extension/src/popup.js`: eklenti simgesindeki menü
