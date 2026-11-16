# Football Intelligence · Sürüm denetimi

16 Kasım 2026 · Ücretsiz, API anahtarı gerektirmeyen GitHub Pages sürümü

[Uygulamayı aç](https://adws555434.github.io/gagagsaerhdse/)

## Özelliklerin durumu

| İstek | Durum |
|---|---|
| İki takım adıyla otomatik arama, Türkçe karakter ve BJK/GS gibi kısaltmalar | Çalışıyor. Belirsiz kısaltma için tam ad gerekiyor. |
| Fikstür, ev/deplasman, puan formu, karşılıklı maçlar | Çalışıyor. Karşılıklı eşleşme bulunursa fikstürdeki ev sahibi esas alınır. |
| Form, gol, şut, isabetli şut, korner, sarı kart, faul, ilk yarı skor ortalamaları, bir sonraki lig maçına kadar dinlenme | Kaynakta bulunduğu ölçüde. Dinlenme verisi diğer organizasyonları kapsamaz. |
| Puan tablosu | Sonuçlardan hesaplanır. Resmi sıralama, puan cezası ve kupa grupları hesaba katılmaz. |
| 50–100 maç ve eski sezonlar | Altı ligde mevcut kayıtlarla en fazla 100 maçlık uzun dönem formu ve son 10 karşılaşma. Eksik sezonlar işaretlenir. Ana skor modeli mevcut sezondaki takım başına son 20 maçı kullanır. |
| 500.000 Monte Carlo, en olası skor, üç alternatif skor, 1X2 | İki takım için de organizasyonda en az beş geçmiş maç olduğunda çalışıyor. Aynı veriyle sonuç yeniden üretilebilir. |
| İlk gol | Sabit gol hızı varsayımıyla ev sahibi, deplasman ve golsüz maç olasılığı. |
| İlk 20 dakikada gol senaryosu | Dakika ve öne geçen takım seçilebilir. Kalan süre 500.000 kez simüle edilir. Gerçek maç akışı ve taktik değişiklikleri ayrı veri gerektirir. |
| Ligler | Norveç Eliteserien dahil 14 ligde birer maç için skor simülasyonu doğrulandı. Üç UEFA kupasında veri geliyor, denetim günü beş maç eşiği sebebiyle skor üretilemedi. |
| Erkek A milli takımları | Türkçe ve İngilizce ülke adları, son 20 maçlık form, geçmiş eşleşmeler, 500.000 simülasyon ve bilinen tarafsız saha. 16 Kasım 2026 tarihli Uluslar Ligi fikstürü ayrı dosyada. Diğer eşleşmeler senaryo olarak hesaplanabilir. |
| Veri kalitesi ve kaynaklar | Sonuç, fikstür, seçili istatistik alanlarının doluluk oranı ve arşiv kapsamı görünür. |
| Oyuncu formu, sakatlık, ceza, kadro, dakika, gol/asist ve kart/hata riski | Açık ve yeterli maç öncesi oyuncu verisi henüz bağlı değil. Oyuncu özel hayatı ve sağlık bilgileri işlenmez. |
| xG, xA, PPDA, gelişmiş pas/baskı, taktik, antrenman, hava, saha, hakem, motivasyon ve takım içi uyum | Bu yayında kullanılmıyor. |
| İlk ve ikinci yarı tam skor dağılımı, gol dakikası riski, fiziksel ve taktik üstünlük, oyuncu değişikliği / kırmızı kart senaryoları | Henüz bağlı değil. |
| Canlı skor ve olaylar, sohbet, otomatik raporlar, geçmiş tahmin kaydı, kalibrasyon, kendini yeniden eğitme, Elo/Bayes/ML ensemble | Henüz bu sürümde yok. Geçmiş maç başarı testi çevrimdışı çalıştırıldı. |
| Ücretsiz çalışma, HTTPS ve dar ekran görünümü | Doğrulandı. Gerçek iPhone cihazı bu test kapsamına dahil değildi. |

## Geçmiş maç testi

2023/24–2025/26 arasında [openfootball](https://github.com/openfootball/football.json) arşivinin erişilebilir ve tamamlanmış sonuçları. Her lig ve sezon kendi içinde kronolojik ilerletildi. Her tahmin yalnızca o sezonun daha erken günlerindeki tamamlanmış maçları görür. Maç günü ve sonraki günlerin kayıtları, kadrolar ve oranlar modele verilmedi. İki takımın da en az beş geçmiş maçının bulunduğu eşleşmeler ölçüldü. Canlıdaki aynı Poisson fonksiyonu ve aynı maçlar için 100.000 ve 500.000 simülasyonlu koşular karşılaştırıldı.

| Lig | Maç | 100.000 sonuç | 500.000 sonuç | 100.000 tam skor | 500.000 tam skor |
|---|---:|---:|---:|---:|---:|
| Süper Lig | 331 | 189 (%57,10) | 189 (%57,10) | 36 (%10,88) | 34 (%10,27) |
| Premier League | 957 | 502 (%52,46) | 503 (%52,56) | 95 (%9,93) | 95 (%9,93) |
| La Liga | 963 | 487 (%50,57) | 489 (%50,78) | 128 (%13,29) | 129 (%13,40) |
| Bundesliga | 769 | 394 (%51,24) | 393 (%51,11) | 67 (%8,71) | 71 (%9,23) |
| Serie A | 940 | 501 (%53,30) | 501 (%53,30) | 126 (%13,40) | 131 (%13,94) |
| Ligue 1 | 759 | 384 (%50,59) | 384 (%50,59) | 75 (%9,88) | 75 (%9,88) |
| Toplam | 4.719 | 2457 (%52,07) | 2459 (%52,11) | 527 (%11,17) | 535 (%11,34) |

- Sonuç isabeti en yüksek olasılıklı ev sahibi/beraberlik/deplasman seçeneğinin gerçek sonuçla eşleşmesidir. Tam skor isabeti en yüksek olasılıklı skorun birebir eşleşmesidir.
- Log loss modelde **1,003**, basit lig geçmişinde **1,072**. Üç sınıfın toplam kare hatasıyla hesaplanan Brier skoru **0,598** ve **0,648**. İki ölçütte düşük değer daha iyi.
- Basit karşılaştırma yalnızca o güne kadar aynı lig/sezonun 1X2 sıklığını kullanır. Üç seçeneğe birer başlangıç sayımı eklenir. Piyasa oranlarına veya başka profesyonel modellere karşı karşılaştırma yapılmadı.
- Süper Lig arşivi 2023/24 için erişilemedi. 2024/25 için 338/342, 2025/26 için 90/306 sonuç kullanılabilir durumdaydı. Diğer sezonlarda da skor kaydı eksikliği görülebilir. Bu örneklem sonuçlarını tüm maçlara genellemek için ek sezonlar ve bağımsız bir değerlendirme gerekir.

## Milli maç geçmiş testi

2023–2025 yıllarında 3.238 erkek A milli takım arşiv eşleşmesi. Geçmiş girdi 2018’den başlar ve tahmin gününden önceki maçlarla sınırlıdır. Arşiv tarafsız dediğinde model saha avantajı kullanmaz. Arşiv skorları varsa uzatmayı içerir. Seri penaltılar dahil değildir.

| Simülasyon | Maç sonucu (1X2) | Tam skor |
|---|---:|---:|
| 100.000 | 1.800/3.238 (%55,59) | 382/3.238 (%11,80) |
| 500.000 | 1.800/3.238 (%55,59) | 383/3.238 (%11,83) |

Milli takım testi için [sabit kaynak CSV](https://raw.githubusercontent.com/martj42/international_results/b0948cb558c927c357db4067eac5b37b96d0e4bb/results.csv) ve [test komutu](tests/backtest-national.cjs) kullanılabilir. Dosyanın SHA-256 değeri `09aac809e317f3004c69720a38addb656c49ebb19f1937deab96f96e3362257a`. Node.js ile `node tests/backtest-national.cjs results.csv` çalıştır. [Milli takım ölçüm çıktısı](tests/backtest-500-national.json).

Daha fazla simülasyon aynı modelin olasılık hesabındaki örnekleme farkını azaltır. Kulüp ve milli maç yüzdeleri farklı test gruplarına aittir.

## Uygulama doğrulaması

- Firefox ve WebKit'te 38 yerel otomatik senaryo. Motor açılışı, iki takım girişi, boş giriş, aynı takım, bilinmeyen takım, Türkçe karakter ve kısaltma, 320 px görünüm, tekrar üretim, önceki maç arşivi, çift kayıt ve ileri tarih filtresi, bozuk kaynak yedeği, eksik fikstür, yetersiz örneklem, internet kesilmesi, gol senaryosu, tarayıcı JavaScript hataları.
- Canlı veriyle 17 kulüp organizasyonu kontrolü. 14'ünde skor simülasyonu, üçünde veri yetersizliği davranışı doğrulandı.
- Firefox ve WebKit'te yayımlanan sürüm üzerinde 24 ek uçtan uca senaryo geçti. İki tarayıcıda da Süper Lig ve Premier League, gol senaryosu, sabit sonuç, giriş doğrulaması ve JavaScript hataları kontrol edildi.
- Canlı dağıtımın kimliği ve özel 404 sayfasındaki ana sayfa bağlantısı kontrol edildi. Sayfa gerçek 404 yanıtı verir.
- 38 yerel tarayıcı + 24 canlı tarayıcı + 17 kulüp veri kaynağı denetimi = 79/79 geçen son kontrol. Gerçek iPhone testi, kodun tüm olası durumlarını veya gelecekteki kaynak değişikliklerini kapsamaz.

## Geçmiş testi yeniden çalıştırma

[Arşiv dosya listesi ve SHA-256 değerleri](tests/backtest-data-manifest.json) kullanılan 17 arşiv dosyasını ve kaynak sürümünü sabitler. Node.js 18+ ve internet bağlantısıyla repo kökünde aşağıdaki komutları çalıştır.

```bash
python3 - <<'PYTHON'
import hashlib, json, pathlib, urllib.request
manifest = json.loads(pathlib.Path('tests/backtest-data-manifest.json').read_text())
target = pathlib.Path('audit-data')
target.mkdir(exist_ok=True)
for entry in manifest['files']:
    with urllib.request.urlopen(manifest['source'] + entry['source'], timeout=20) as response:
        data = response.read()
    if hashlib.sha256(data).hexdigest() != entry['sha256']:
        raise ValueError(entry['file'])
    (target / entry['file']).write_bytes(data)
PYTHON
node tests/backtest.cjs audit-data
```

[100.000 simülasyon çıktısı](tests/backtest-summary.json) ve [500.000 simülasyon çıktısı](tests/backtest-500-clubs.json) lig bazında sayaçları ve arşiv kapsamını içerir.

## Veri ve gizlilik

Güncel maç sonuçları ve fikstür için [open-matchday](https://github.com/oladeeayo/open-matchday), geçmiş skorlar için [openfootball](https://github.com/openfootball/football.json). Veriler tarayıcıdan HTTPS ile okunur. Takım girişleri sağlayıcıya özel bir sorgu olarak gönderilmez. Erkek milli takım skorları için [Mart Jürisoo](https://github.com/martj42/international_results) arşivinin 2018 sonrası bölümü kullanılır. Bu yayında arşivin son kaydı 6 Ekim 2026. [Uluslar Ligi fikstürü](nations-fixtures.json) 16–17 Kasım maçları için UEFA takvimiyle doğrulanan sınırlı bir anlık görüntüdür. API anahtarı, kullanıcı hesabı veya oyuncu özel hayatı verisi kullanılmaz. Kaynak kapsamı ve kullanım şartları sağlayıcıya bağlıdır. Oyuncu sağlık verisi işlenmesi GDPR Madde 9 kapsamında özel nitelikli veri değerlendirmesi ve Avusturya'daki DSG § 1 dahil olmak üzere ayrıca hukuki değerlendirme gerektirir.

- [GDPR, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
- [Avusturya DSG](https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10001597)
