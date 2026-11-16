# Football Intelligence · Sürüm denetimi

16 Kasım 2026 · Ücretsiz, API anahtarı gerektirmeyen GitHub Pages sürümü

[Uygulamayı aç](https://adws555434.github.io/gagagsaerhdse/)

## Geçmiş sezonlu model karşılaştırması

Arşiv ayrıştırıcısı, `score.ft` alanının yanı sıra kaynakta doğrudan `score` dizisi olarak gelen tamamlanmış skorları da okur. Düz `[0, 0]` biçiminde gelen 122 maç, 2025/26 döneminde altı ligde geçmiş maç listelerine geri eklendi. Süper Lig dosyasındaki geçerli skor sayısı 90'dan 99'a çıktı. Bazı sezon dosyaları eksik olduğundan kapsama ligin bütün maçları dahil olmayabilir. Testteki 2025/26 örneklemi yeni ayrıştırıcıyla 1.561 maça çıktı. Aşağıdaki iki model aynı örneklemde ölçüldü.

Yeni karşılaştırma, güncel sezona önceki iki sezonu ekler, eski maçları 720 günlük yarı ömürle ağırlıklandırır ve düşük skorlara Dixon–Coles düzeltmesi uygular. İki takımın da arşivde en az beş maçı gerekir. Mevcut ana tahmin, kayıtlı tahmin geçmişi ve milli takım tahmin motoru önceki sürümdeki modelle çalışır.

| Dönem | Maç | Sonuç isabeti | Tam skor | İlk üç skor | Log loss | Brier |
|---|---:|---:|---:|---:|---:|---:|
| 2018/19–2019/20 · ayar seçiminde kullanılmadı | 3.573 | %50,32 → %51,69 | %12,48 → %12,03 | %31,88 → %32,41 | 1,0066 → 0,9949 | 0,6011 → 0,5931 |
| 2020/21–2024/25 · geliştirme | 8.387 | %51,39 → %52,03 | %12,33 → %12,75 | %32,49 → %33,11 | 1,0045 → 0,9941 | 0,5998 → 0,5927 |
| 2025/26 · geriye dönük karşılaştırma | 1.561 | %50,29 → %51,12 | %11,34 → %12,81 | %30,17 → %32,54 | 1,0187 → 1,0047 | 0,6099 → 0,5999 |
| 2026/27 sezon başı · geriye dönük karşılaştırma | 313 | %53,67 → %59,42 | %10,22 → %9,90 | %30,67 → %29,39 | 0,9611 → 0,9409 | 0,5704 → 0,5546 |

Toplam 13.834 kronolojik tahmin. Yüzdeler ana modelden geçmiş sezonlu karşılaştırmaya geçişi gösterir. Log loss ve Brier için düşük değer daha iyidir. Maçın oynandığı günün maçları hesap dışı tutuldu. 2025/26 ve 2026/27 sonuçlarına aday taraması sırasında bakıldı. Bunlar gerçek zamanlı başarı ölçümü değildir. Karşılaştırma son iki sezonda bazı lig ve skor ölçütlerinde gerilediği için varsayılan model olarak seçilmedi.

[Değerlendirme kodu](tests/archive-model-evaluation.cjs) · [Sabit veri kaynakları ve SHA-256 değerleri](tests/archive-model-data.json) · [Liglere göre ham sonuçlar](tests/archive-model-results.json) · [Dixon–Coles araştırması](https://doi.org/10.1111/1467-9876.00065)

Veri listesinde adı geçen dosyaları bir klasöre indirdikten sonra depo kökünde `node tests/archive-model-evaluation.cjs /veri/klasoru` komutuyla hesap tekrar edilebilir.

## Kulüp maç sonucu düzeltmesi

1.427 maçlık 2025/26 grubunda maç sonucu isabeti 768'den 775'e çıkarıldı. Kolonlardaki “Poisson + Elo” düşüşten önceki referanstır. “Önceki rakip modeli” 100 aday arasından önceki turda seçilen sürümdür.

| 2025/26 · 1.427 maç | Poisson + Elo | Önceki rakip modeli | Yayındaki model |
|---|---:|---:|---:|
| Maç sonucu | %54,24 | %53,82 | %54,31 |
| Tam skor | %11,63 | %11,70 | %12,40 |
| İlk üç skor | %30,90 | %32,94 | %32,10 |
| Log loss | 0,99727 | 0,98939 | 0,99104 |
| Brier | 0,59456 | 0,58919 | 0,59024 |

Toplam 10.127 tahmin, 2020/21 (1.937), 2021/22–2024/25 (6.450), 2025/26 (1.427) ve 2026/27 sezon başı (313) olmak üzere dört dönemde incelendi. Yeni ana model beş ölçütün her birinde bu dört dönem toplamlarında düşüşten önceki referansa eşit veya daha iyi. Bu kontrol, her ligde her ölçütün iyileştiği anlamına gelmez. Ayar taramasında bu dönemlerin ölçümleri kullanıldı, dolayısıyla bunlar yeni sürümün bağımsız testi sayılmaz.

2026/27 grubunda maç sonucu isabeti referansta %53,35, önceki rakip modelinde %55,59, yeni ana modelde %53,67. Bu grupta yeni model tam skorda %10,22; önceki rakip modeli %11,18. İki grubun da bütün ölçütlerinde iki eski sürümü birden geçen aday bulunmadı. Öncelik 2025/26 grubundaki maç sonucu düşüşünü düzeltmek ve dört test döneminde düşüşten önceki referansın beş ölçütünü korumaktı. Uygulamada önceki rakip modeli olasılıkları ve en olası skoru görülebilir. Milli takım modeli değiştirilmedi.

Yayındaki kulüp modeli rakip gücüne %45, gol paylaşımında Elo'ya %37,5 ağırlık verir. Ev sahibi gol oranı exp(0,035), deplasman oranı exp(−0,035) ile ölçeklenir. Tarafsız sahada bu ek düzeltme uygulanmaz. Beş ölçüt için yayın karşılaştırması doğrudan Poisson hesabıdır. Tarayıcı maç başına 100 milyon simülasyon yapmaya devam eder.

[Ham sonuçlar](tests/club-balance-results.json) · [Sabit veri listesi](tests/club-balance-data.json) · [Doğrulama kodu](tests/club-balance-evaluation.cjs)

Daha önceki arşivi `audit-data` klasörüne aşağıdaki “Geçmiş testi yeniden çalıştırma” bölümündeki adımlarla indir. Sabit veri listesindeki `url` dosyalarını `guard-data` klasörüne `file` alanındaki adla kaydet ve SHA-256 değerlerini denetle. Repo kökünde `node tests/club-balance-evaluation.cjs guard-data audit-data` çalıştır.

## Önceki sürüm · Rakip gücüne göre model seçimi

[300 fikir ve 100 öncelik](FORECAST_ROADMAP.md) · [Değerlendirme kodu](tests/candidate-evaluation.cjs) · [Ham sonuçlar](tests/candidate-results.json)

100 yapılandırma, beş zaman ağırlığı (tüm maçlar, 90, 180, 360, 720 gün yarı ömrü), beş rakip gücü ağırlığı ve dört Elo ağırlığı ile kuruldu. Bir referansla birlikte 101 yapılandırma karşılaştırıldı. Her aday yalnızca maç gününden önce biten sonuçları kullanır. Rakip gücü modeli hücum ve savunmayı ayrı tahmin eder. Az maçlı takımlarda değerler lig ortalamasına yakın başlar.

Kulüplerde 3.292 ve milli maçlarda 2.251 önceki tahminle aday seçildi. Daha yeni dönemde 1.427 kulüp ve 987 milli maç yalnızca karşılaştırma ve yayına alma eşiği için kullanıldı. Gelecek sezon bağımsız ölçüm için saklanır. Ayrı raporlanmış geçmiş bir dönemin sonuçları gelecekte aynı kazanımı garanti etmez.

| Yeni dönem | Metrik | Önceki sürüm | Rakip gücü modeli |
|---|---|---:|---:|
| Kulüp | Log loss | 0,99727 | 0,98939 |
| Kulüp | Brier | 0,59456 | 0,58919 |
| Kulüp | Maç sonucu | %54,24 | %53,82 |
| Kulüp | Tam skor | %11,63 | %11,70 |
| Kulüp | İlk üç skor | %30,90 | %32,94 |
| Milli | Log loss | 0,88339 | 0,82714 |
| Milli | Brier | 0,51956 | 0,48402 |
| Milli | Maç sonucu | %59,07 | %61,30 |
| Milli | Tam skor | %11,65 | %13,17 |
| Milli | İlk üç skor | %34,14 | %36,07 |

Her iki grupta log loss ve Brier daha düşük olduğu için rakip gücü modeli yayına alındı. Kulüp maçlarında en yüksek olasılıklı tek sonuç isabeti 774'ten 768'e düştü. Uygulamada önceki modelin olasılıkları da görülebilir. Test edilen altı kulüp liginde seçilen model rakip gücüne %75 ağırlık ve gol paylaşımında %20 Elo kullanır. Milli maçlarda seçilen model rakip gücünü kullanır. Diğer liglerde mevcut Poisson modeli çalışır. Ana tahmin ve gol senaryosu 100 milyon simülasyon üretir. Geçmiş test doğrudan Poisson olasılıklarını kullanır.

## Önceki sürüm · Poisson + Elo, tahmin geçmişi ve devre analizi

Ana model altı test edilmiş kulüp liginde ve erkek A milli takımlarında Poisson + Elo kullanır. Diğer liglerde Poisson ana seçenek olarak gösterilir. Elo her maç sonucu ile güncellenir. Poisson gol toplamı korunur ve takımlar arasındaki payın %35'i Elo beklentisiyle hesaplanır. Ana maç ve gol senaryosu 100 milyon deneme yapmaya devam eder.

| Örneklem | Model | Maç sonucu | Tam skor | İlk üç skor | Log loss |
|---|---|---:|---:|---:|---:|
| 4.719 kulüp maçı | Poisson | %52,11 | %11,34 | %31,17 | 1,00273 |
| 4.719 kulüp maçı | Poisson + Elo | %52,32 | %11,87 | %31,83 | 0,99628 |
| 3.238 milli maç | Poisson | %55,56 | %11,89 | %32,92 | 0,94837 |
| 3.238 milli maç | Poisson + Elo | %56,89 | %11,49 | %33,66 | 0,92221 |

Takımların maç tarihinden önce tamamlanan sonuçları kullanıldı. Karşılaştırma doğrudan Poisson olasılıklarıyla yapıldı. Daha yeni dönem kontrolünde (2025/26 kulüp sezonu, 2025 milli maçlar) de log loss kulüp maçlarında 1,00360 → 0,99727 ve milli maçlarda 0,91364 → 0,88339 oldu. Milli maçlarda tüm arşivde tek skor isabeti düşse de sonuç olasılıkları ve ilk üç skor iyileşti. Bu tarih aralığı bağımsız bir gelecek sezonu deneyi değildir.

Tahmin kartında önceki model, Elo ve arşivde benzer olasılık bandındaki isabet gösterilir. Olasılık bandının küçük örneklemlerinde güvenilir karşılaştırma yapılmaz. Açıklama puan ve gol ortalaması gibi model girdilerine dayanır. [Ölçüm kodu](tests/model-evaluation.cjs) · [Ham sonuçlar](tests/model-evaluation.json).

- Tarihi belirli fikstürlerde ilk maç önü tahmini tarayıcıya kaydedilir. Kaydın tarihi ve model sürümü görünür. Kullanıcı **Sonuçları güncelle** düğmesi ile sonuç, tam skor ve ilk üç skor isabetini toplam ve lig bazında görür. Aynı eşleşme tekrar çalıştırıldığında ilk tahmin korunur.
- İki takım için en az beş geçerli devre sonucu varsa ilk ve ikinci yarı skor tahmini hesaplanır. Gol dakikalarında yalnızca gol sayısıyla tutarlı kayıtlar kullanılır. Dakika dağılımı geçmiş maç gözlemidir.
- Bundesliga'da açık kaynakta isim bulunan son maç golcüleri gösterilir. Kadro senaryosu, oyuncu başına dakika, sakatlık, canlı akış ve xG bu güncellemenin kapsamında değildir.

## 100 milyon simülasyon sürümü

Yayındaki maç analizi ve gol senaryosu 100.000.000 deneme yapar. Hesap kısa parçalar halinde yürür ve ilerleme görünür. Yeni analiz başlatıldığında önceki gol senaryosu iptal edilir.

### 100 milyon denemeli geçmiş maç denetimi

Kulüp liglerinden sekizer maç (48) ve milli maçlardan tarih sırasına yayılmış 48 maç seçildi. Seçim puan veya gerçekleşen skor kullanılmadan, örneklemdeki sıralı konumlara göre yapıldı. Model yalnızca tahmin gününden önce tamamlanmış sonuçları gördü. 96 maçta toplam 9,6 milyar deneme yapıldı. [Maç bazında sayaçlar](tests/audit-100m/results.json).

| Veri grubu | Maç sonucu | Tam skor |
|---|---:|---:|
| Kulüp, 100 milyon | 25/48 (%52,08) | 3/48 (%6,25) |
| Milli, 100 milyon | 28/48 (%58,33) | 6/48 (%12,50) |
| Toplam | 53/96 (%55,21) | 9/96 (%9,38) |

Aynı 96 maç, 500 bin simülasyonda da aynı isabet sayılarını verdi. Poisson hesabıyla karşılaştırıldığında simülasyonun en büyük ev sahibi/beraberlik/deplasman farkı 0,0115 yüzde puandı. Bu örneklemde en olası skor ve maç sonucu seçimleri Poisson hesabıyla 96/96 aynı çıktı.

| Tüm arşiv · doğrudan Poisson hesabı | Maç sonucu | Tam skor |
|---|---:|---:|
| 4.719 kulüp maçı | 2.459/4.719 (%52,11) | 535/4.719 (%11,34) |
| 3.238 milli maç | 1.799/3.238 (%55,56) | 385/3.238 (%11,89) |

Tam arşivde olasılıklar bağımsız Poisson dağılımından doğrudan hesaplandı. Her takım için 0–40 gol olasılıkları birleştirildi; yayındaki en yüksek gol beklentisi 6 olduğunda kesilen kuyruk ihmal edilebilir düzeydedir. 96 maçlık doğrudan simülasyon ölçümü ve 7.957 maçlık model ölçümü farklı testlerdir.

Tekrar üretmek için [işlemci testi](tests/audit-100m/replay.c) aynı rastgele sayı dizisini, eşit skor sayılarındaki ilk görünme sırasını ve tarayıcının Poisson eşiklerini kullanır. [Denetim komutu](tests/audit-100m/audit.cjs) yayımdaki HTML’den model kodunu alır. Üç ayrı 100 milyonluk kontrol vakasında tarayıcı JavaScript kodu ile işlemci çıktısı birebir karşılaştırıldı. Aşağıdaki arşiv indirme adımlarını tamamladıktan sonra:

```bash
gcc -O3 -std=c11 -ffp-contract=off tests/audit-100m/replay.c -o /tmp/football-replay
node tests/audit-100m/audit.cjs results.csv /tmp/football-replay audit-data
```


## Özelliklerin durumu

| İstek | Durum |
|---|---|
| İki takım adıyla otomatik arama, Türkçe karakter ve BJK/GS gibi kısaltmalar | Çalışıyor. Belirsiz kısaltma için tam ad gerekiyor. |
| Fikstür, ev/deplasman, puan formu, karşılıklı maçlar | Çalışıyor. Karşılıklı eşleşme bulunursa fikstürdeki ev sahibi esas alınır. |
| Form, gol, şut, isabetli şut, korner, sarı kart, faul, ilk yarı skor ortalamaları, bir sonraki lig maçına kadar dinlenme | Kaynakta bulunduğu ölçüde. Dinlenme verisi diğer organizasyonları kapsamaz. |
| Puan tablosu | Sonuçlardan hesaplanır. Resmi sıralama, puan cezası ve kupa grupları hesaba katılmaz. |
| 50–100 maç ve eski sezonlar | Altı ligde mevcut kayıtlarla en fazla 100 maçlık uzun dönem formu ve son 10 karşılaşma. Eksik sezonlar işaretlenir. Ana skor modeli mevcut sezondaki takım başına son 20 maçı kullanır. |
| 100.000.000 Monte Carlo, en olası skor, üç alternatif skor, 1X2 | İki takım için de organizasyonda en az beş geçmiş maç olduğunda çalışıyor. Aynı veriyle sonuç yeniden üretilebilir. |
| İlk gol | Sabit gol hızı varsayımıyla ev sahibi, deplasman ve golsüz maç olasılığı. |
| İlk 20 dakikada gol senaryosu | Dakika ve öne geçen takım seçilebilir. Kalan süre 100.000.000 kez simüle edilir. Gerçek maç akışı ve taktik değişiklikleri ayrı veri gerektirir. |
| Ligler | Norveç Eliteserien dahil 14 ligde birer maç için skor simülasyonu doğrulandı. Üç UEFA kupasında veri geliyor, denetim günü beş maç eşiği sebebiyle skor üretilemedi. |
| Erkek A milli takımları | Türkçe ve İngilizce ülke adları, son 20 maçlık form, geçmiş eşleşmeler, 100.000.000 simülasyon ve bilinen tarafsız saha. 16 Kasım 2026 tarihli Uluslar Ligi fikstürü ayrı dosyada. Diğer eşleşmeler senaryo olarak hesaplanabilir. |
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

## Son uygulama denetimi · 100 milyonluk sürüm

Bu denetimde Firefox ile canlı sitede 12, WebKit ile kontrollü veri ortamında 19 tarayıcı senaryosu geçti. Ayrıca 17 organizasyonun veri bağlantısı kontrol edildi. 14 organizasyonda örnek fikstür skor üretti. Üç UEFA kupası için örneklem yetersizliği doğrulandı. 17 arşiv dosyasının SHA-256 eşleşmesi, canlı HTML ve 404 içeriği kontrol edildi. Firefox ve WebKit sonuçları gerçek iPhone cihaz testini kapsamaz.

## Önceki uygulama doğrulaması

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
node tests/backtest.cjs audit-data 500000
```

[100.000 simülasyon çıktısı](tests/backtest-summary.json) ve [500.000 simülasyon çıktısı](tests/backtest-500-clubs.json) lig bazında sayaçları ve arşiv kapsamını içerir.

## Veri ve gizlilik

Güncel maç sonuçları ve fikstür için [open-matchday](https://github.com/oladeeayo/open-matchday), geçmiş skorlar için [openfootball](https://github.com/openfootball/football.json). Veriler tarayıcıdan HTTPS ile okunur. Takım girişleri sağlayıcıya özel bir sorgu olarak gönderilmez. Erkek milli takım skorları için [Mart Jürisoo](https://github.com/martj42/international_results) arşivinin 2018 sonrası bölümü kullanılır. Bu yayında arşivin son kaydı 6 Ekim 2026. [Uluslar Ligi fikstürü](nations-fixtures.json) 16–17 Kasım maçları için UEFA takvimiyle doğrulanan sınırlı bir anlık görüntüdür. API anahtarı, kullanıcı hesabı veya oyuncu özel hayatı verisi kullanılmaz. Kaynak kapsamı ve kullanım şartları sağlayıcıya bağlıdır. Oyuncu sağlık verisi işlenmesi GDPR Madde 9 kapsamında özel nitelikli veri değerlendirmesi ve Avusturya'daki DSG § 1 dahil olmak üzere ayrıca hukuki değerlendirme gerektirir.

- [GDPR, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
- [Avusturya DSG](https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10001597)
