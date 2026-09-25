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
  - Varsayılan olarak her sitede 2 sayfa gezilir (*Ayarlar → Site başına en fazla sayfa*).
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

### Otomatik aranamayan siteler

Şablonu olmayan, robot doğrulaması isteyen ya da üyelik gerektiren siteler arama sonrası durum çubuğunda *Otomatik aranamayan N site* grubunda listelenir. Bunlarda şöyle yap:

1. Gruptaki siteye ya da *Siteler* sekmesindeki **Sitede aç**'a bas.
2. Sitede kendi aramanı yap (gerekirse giriş yap veya doğrulamayı geç).
3. Eklenti simgesine tıklayıp **Bu sayfadaki ilanları topla**'ya bas. İlanlar panele eklenir.

## Siteler

| Ülke | Otomatik arama | Yalnızca "Sitede aç" + sayfayı topla |
| --- | --- | --- |
| 🇯🇵 Japonya | BE FORWARD, SBT Japan, Car From Japan, TCV, Goo-net Exchange, Real Motor Japan, PicknBuy24, CardealPage, Car Junction, SAT Japan, Autorec | Japan Car Direct, CarsJapan Cyprus (mezat aracıları) |
| 🇬🇧 İngiltere | AutoTrader UK, eBay Motors UK, Gumtree, Motors.co.uk (Cazoo), PistonHeads, cinch, Carwow, Exchange & Mart, Copart UK | CarGurus UK, BCA, Manheim, Aston Barclay |

Arama URL'leri *Siteler* sekmesindeki şablonlardan üretilir. Otomatik aranan 20 sitenin marka + model arama adresleri, sitelerin arama motorlarında görünen gerçek sayfa adresleriyle karşılaştırılarak doğrulandı. Yalnızca markayla arama biçimleri Car Junction, Carwow, AutoTrader, SBT ve TCV'de doğrulandı; diğerlerinde aynı yapının kısaltmasıdır. Bir site adres yapısını değiştirirse ve sonuç gelmezse: sitede kendi aramanı yap, adres çubuğundaki URL'yi şablona uyarla.

Enhance Auto (alan adı satılık) ve Tomisho (kaydı bulunamadı) listeden çıkarıldı.

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
