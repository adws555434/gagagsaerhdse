# Football Intelligence · Sürüm denetimi

## Faz 1 · Ölçüm altyapısı

| Bileşen | Durum |
|---|---|
| Sezon sezon ileri yürüyen backtest ve referanslar | **Çalışıyor.** Aynı maç kümesinde lig 1X2 sıklığı, Elo, bağımsız Poisson, mevcut yayın modeli ve gol beklentisi belirsizliği adayı. |
| Metrikler ve aralıklar | **Çalışıyor.** Log loss, RPS, üç sınıf toplam Brier, 1X2, tutarlı tam skor ve ilk üç genel skor. Lig, sezon, lig × sezon ve genel sonuçlarda model farkları için eşleştirilmiş bootstrap. |
| Sınıf kalibrasyonu, aylık izleme ve güven kademeleri | **Çalışıyor.** Tahmin edilen olasılık ve gözlenen sıklık yan yana. Sezon başlangıcı, ortası ve sonu ham sonuçlarda ayrı. Kalibrasyon dönüşümü **bağlı değil**. |
| Kapsam denetimi | **Çalışıyor.** Eksik skor, eksik fikstür alanı ve yetersiz takım geçmişi tarih ve takımla raporlanır. |
| Bağımsız maç önü kayıtları | **Kısmi.** Yeni uygun kulüp fikstürlerine aynı anda yayın tahmini ve dört referans kaydedilir. Önceki kayıtlar korunur. Sonuç bekleyen ve sürüm bilgisi eksik kayıtlar bağımsız örnekleme girmez. |
| Piyasa, canlı piyasa API’si, oyuncu etkisi ve yeni bağlam | **Bağlı değil.** Bu faz bunları ölçmedi. |

Ölçüm sürümü `2026.11-phase-1`, gol modeli `2026.11-club-balance`, analitik motor `2026.11-phase-0`. Kaynak dosyalarının sıralı SHA-256 özeti `54503d5e961ca3a4d884097793207b7d9f7f4cd23c13801dcee93b7d2b118f4c`. Tarihsel tahmin başına 0 Monte Carlo çekilişi. Analitik matris kullanıldı. Eşleştirilmiş farklar için 2.000 bootstrap tekrarı, tohum `20261116`. Kaynak kesimi `2026-11-15`.

Her test sezonu için model 1 Temmuz'da donduruldu ve yalnızca önceki sezonların o tarihten eski skorlarını gördü. Canlı yayın modeli son maçlardan güncellenir. Bu tablodaki “yayın modeli” aynı yöntemin dondurulmuş denemesidir. Geçmiş arşivin yayımlanma saatleri bulunmadığı için sonuçlar tarihsel tekrardır. Bazı sezonlar eski model geliştirmesinde de kullanılmıştır. Ayar için kullanılmayan maçları ayırmanın ötesinde, bağımsız ölçüm için kayıt defterinde maç başlamadan dondurulan tahmin şartı geçerlidir.

Sonuç seçimi en yüksek 1X2 olasılığıdır. Tam skor, seçilen 1X2 sınıfındaki en olası skordur. İlk üç skor bütün matristen gelir. İsabet ve kapsam için köşeli parantezler Wilson %95 aralığıdır. Model farkları için lig-sezon katmanlarında ardışık yedi günlük bloklar aynı örnek üzerinden çekildi. RPS, ev–beraberlik–deplasman sıralamasında iki kümülatif hatanın ortalamasıdır. İlk 90 gün başlangıç, 90–239. günler orta dönem, kalanı sezon sonudur. Her pencere arşivdeki ilk fikstür tarihinden sayılır.

### Yayın yönteminin lig bazında ölçümü

| Lig | Maç | Log loss | RPS | 1X2 isabeti [%95 GA] | Tutarlı tam skor [%95 GA] | İlk üç genel skor [%95 GA] |
|---|---:|---:|---:|---|---|---|
| Süper Lig | 545 | 0,96898 | 0,19552 | 291/545 · %53,39 [%49,20–%57,54] | 45/545 · %8,26 [%6,23–%10,87] | 161/545 · %29,54 [%25,86–%33,50] |
| Premier League | 1028 | 1,02292 | 0,21298 | 510/1028 · %49,61 [%46,56–%52,66] | 95/1028 · %9,24 [%7,62–%11,17] | 288/1028 · %28,02 [%25,36–%30,84] |
| La Liga | 996 | 0,99061 | 0,20152 | 518/996 · %52,01 [%48,90–%55,10] | 138/996 · %13,86 [%11,85–%16,14] | 373/996 · %37,45 [%34,50–%40,50] |
| Bundesliga | 815 | 1,01005 | 0,20965 | 411/815 · %50,43 [%47,00–%53,85] | 63/815 · %7,73 [%6,09–%9,77] | 218/815 · %26,75 [%23,82–%29,89] |
| Serie A | 978 | 0,99143 | 0,20028 | 512/978 · %52,35 [%49,22–%55,47] | 117/978 · %11,96 [%10,08–%14,15] | 345/978 · %35,28 [%32,34–%38,32] |
| Ligue 1 | 779 | 1,00863 | 0,21446 | 390/779 · %50,06 [%46,56–%53,57] | 79/779 · %10,14 [%8,21–%12,46] | 233/779 · %29,91 [%26,80–%33,22] |
| **Tümü** | 5141 | 1,00075 | 0,20619 | 2632/5141 · %51,20 [%49,83–%52,56] | 537/5141 · %10,45 [%9,64–%11,31] | 1618/5141 · %31,47 [%30,22–%32,76] |

### Süper Lig model karşılaştırması

| Model | Log loss | RPS | Brier | 1X2 isabeti [%95 GA] | Tutarlı tam skor [%95 GA] | İlk üç genel skor [%95 GA] |
|---|---:|---:|---:|---|---|---|
| Yayın modeli | 0,96898 | 0,19552 | 0,57619 | 291/545 · %53,39 [%49,20–%57,54] | 45/545 · %8,26 [%6,23–%10,87] | 161/545 · %29,54 [%25,86–%33,50] |
| Lig sıklığı | 1,07244 | 0,23081 | 0,64870 | 242/545 · %44,40 [%40,29–%48,60] | 53/545 · %9,72 [%7,51–%12,50] | 151/545 · %27,71 [%24,11–%31,61] |
| Elo | 0,98192 | 0,19846 | 0,58267 | 281/545 · %51,56 [%47,37–%55,73] | 54/545 · %9,91 [%7,67–%12,70] | 163/545 · %29,91 [%26,22–%33,88] |
| Bağımsız Poisson | 0,99221 | 0,20408 | 0,59255 | 282/545 · %51,74 [%47,55–%55,91] | 41/545 · %7,52 [%5,59–%10,05] | 161/545 · %29,54 [%25,86–%33,50] |
| Belirsizlikli Poisson | 0,96966 | 0,19564 | 0,57647 | 291/545 · %53,39 [%49,20–%57,54] | 45/545 · %8,26 [%6,23–%10,87] | 156/545 · %28,62 [%24,99–%32,56] |

| Süper Lig güven kademesi | Kapsam [%95 GA] | 1X2 isabeti [%95 GA] |
|---|---|---|
| %45 altı | 181/545 · %33,21 [%29,39–%37,27] | 74/181 · %40,88 [%33,98–%48,16] |
| %45–55 | 163/545 · %29,91 [%26,22–%33,88] | 73/163 · %44,79 [%37,36–%52,45] |
| %55–65 | 93/545 · %17,06 [%14,14–%20,45] | 63/93 · %67,74 [%57,70–%76,38] |
| %65+ | 108/545 · %19,82 [%16,69–%23,37] | 81/108 · %75,00 [%66,07–%82,21] |

### Yayın kararı ve veri kapsamı

| Aday | Tüm liglerde log loss farkı, aday eksi yayın modeli, %95 GA | Gerilemeyen sezon | Tarihsel değerlendirme |
|---|---|---:|---|
| Lig sıklığı | 0,062583 ile 0,083209 | 0/4 | Yayın modelinden daha yüksek hata |
| Elo | 0,002400 ile 0,010398 | 1/4 | Yayın modelinden daha yüksek hata |
| Bağımsız Poisson | 0,022745 ile 0,032135 | 0/4 | Yayın modelinden daha yüksek hata |
| Belirsizlikli Poisson | -0,000276 ile 0,000233 | 1/4 | Fark kanıtlanamadı |

**Varsayılan model değişmedi.** Sabitlenen kayıt defterinde 18 eski maç önü kaydı vardı. Bu kayıtların 18 tanesinde yeni sürüm bilgisi veya veri özeti eksikti. Yeni şemayla sonuçlanmış 0 maç ve adayların birlikte puanlanabildiği 0 maç vardı. Bağımsız ölçüm için en az 500 ortak sonuç gerekiyor. Bağımsız isabet çalıştırılmadı.

Süper Lig 2025/26 arşivindeki 207 eksik skor TFF’nin hafta kayıtlarından tamamlandı. Her iki kaynaktaki 99 skor, takım ve tarih eşleşti. Açık arşivdeki eksikler sezonun ikinci kısmında yoğunlaştı. İki yönlü tarih permütasyon testinde p = 0,00050. Bu test yalnızca zamansal yoğunlaşmayı ölçer. 2024/25 arşivinde 338/342 skor kullanılabildi. Son sezon CSV dosyaları yalnızca yayımlanan skorları içerir. Bu dosyaların dışında kalan fikstürlerin kapsamı ölçülmedi. Önceki üst lig geçmişi yetersiz olan takımlar tüm modellerde ortak kümenin dışında kaldı. Alt lig, kupa ve milli takım ölçümü bu backtest’e bağlı değil.

[Ham lig, sezon, aylık, kalibrasyon ve bootstrap sonuçları](tests/phase1-results.json) · [Eksik kapsam](tests/phase1-coverage.json) · [Sabit girdi listesi](tests/phase1-inputs.json)

Yeniden üretim için [TFF haftalarından skor dosyasını oluştur](tests/super-lig-research/README.md#yeniden-üretim) ve [maç önü kayıt defterinin sabit kopyasını](https://raw.githubusercontent.com/adws555434/gagagsaerhdse/1879a9aa54fa6ab01780076b44dad71884116fe8/forecast-ledger.json) indir. TFF ham skor dosyası bu depoya eklenmedi. Node.js 22 ile çalıştırılabilir. TFF seçeneği verilmezse açık arşivle kapsamı daha dar bir rapor üretilir.

```sh
node tests/phase1-backtest.cjs --self-test
node tests/phase1-backtest.cjs --download --tff /veri/tff-results.json /veri/arsiv /veri/forecast-ledger.json /veri/faz-1
```

## Faz 0 · Analitik matris ve simülasyon

| Bileşen | Durum |
|---|---|
| Tohumlu Monte Carlo | **Çalışıyor.** Mulberry32, tohum `260127`, tarayıcıda 100,000 ve sayısal denetimde koşu başına 1,000,000 çekiliş. |
| Poisson ve Dixon–Coles matrisi | **Çalışıyor.** Arayüzde 0–10 skor hücreleri ve iki farklı kuyruk gösterilir. Motor daha geniş bir matris kullanır ve hesaplanan hücreleri normalize eder. |
| Parametre belirsizliği | **Çalışıyor, deneysel.** Her koşuda önce takım başına üç destek noktasından gol hızı seçilir. Ortalama korunur, göreli aralık gözlenen maç sayısının kareköküyle küçülür. Ardından seçilen hızlara ait Poisson/Dixon–Coles matrisinden skor çekilir. Bu dağılım bir başlangıç varsayımıdır ve kalibre edilmedi. |
| Analitik karar | **Çalışıyor.** En yüksek 1X2 seçilir, o sonuçtaki en olası skor ana kartta görünür, genel mod ve ilk üç skor ayrı gösterilir. Sayısal eşitlikte 1, X, 2 sırası geçerlidir. |
| Simülasyonla karar eşleşmesi | **Kısmi.** 1X2 7/8, tutarlı skor 6/8, ilk üç sıra 7/8. Beraber olasılıklar veya yakın skorlar örneklemle sıralama değiştirebilir. Karar kartı analitik sonucu kullanır. |
| Veri ve sürüm kaydı | **Çalışıyor.** Yeni kayıtlar gol modeli sürümü, motor sürümü, girdilerin SHA-256 özeti ve kullanılan deneme sayısını saklar. Analitik otomatik kayıtta deneme sayısı 0’dır. |
| Veri yetersizliği ve iptal | **Çalışıyor.** Güncel kaynak eksikliği veya takım başına beşten az geçmiş maçta ana tahmin kapatılır. İptal edilen gol senaryosu ekrana eski sonuç yazmaz. Gelecek veri filtrelerinin testleri çalıştırıldı. |
| Güven kademesi | **Kısmi.** Kart eşikleri %45, %55 ve %65’te gösterir. İleri yürüyen isabet ve kapsama ölçümü çalıştırılmadı. |
| Kalibrasyon, RPS, log loss ile ayar ve bağımsız doğruluk | **Bağlı değil.** Faz 0’da yeni maç doğruluğu testi çalıştırılmadı. Denetlenen ortak kayıtta 0 tamamlanmış maç önü tahmini vardı, gerekli en az 500 maç sağlanmadı. |
| Model yükseltme, piyasa, otomatik kadro ve yeni bağlam verisi | **Bağlı değil.** Bu fazdaki deneysel parametre modeli ana modele yükseltilmedi. Eşleştirilmiş bootstrap ve sezon ölçümü çalıştırılmadı, fark kanıtlanamadı. |

Motor `2026.11-phase-0`. Gol modeli `2026.11-club-balance`. Sayısal test girdilerinin SHA-256 değeri `d03cac4526f6bfc11b7b4ff8ac214c2c8a7a6ea74f3f213b455e4eef481d8671`.

Her satır 1,000,000 simülasyondur. Farklar yüzde puandır. 1X2 ve ilk beş skor için mutlak eşik 0.25 yüzde puandı. En büyük farklar sırasıyla 0.05268 ve 0.05560 yüzde puan. Testlerde kesilen en büyük kuyruk 3.4784e-31 olasılık kütlesiydi.

| Koşu | En büyük 1X2 farkı | En büyük ilk beş skor farkı | 1X2 kararı | Tutarlı skor analitik / örneklem | İlk üç sıra |
|---|---:|---:|---|---|---|
| Poisson | 0.05268 | 0.05560 | Aynı | 1–0 / 1–0 | Aynı |
| Dixon–Coles | 0.02049 | 0.02368 | Aynı | 2–1 / 2–1 | Aynı |
| Belirsizlikli Dixon–Coles | 0.04763 | 0.04090 | Aynı | 2–0 / 2–0 | Aynı |
| Nötr ve eşit güç | 0.02824 | 0.03669 | Farklı | 1–0 / 0–1 | Aynı |
| Sıfır gol beklentisi | 0.00000 | 0.00000 | Aynı | 0–0 / 0–0 | Aynı |
| Çok düşük gol beklentisi | 0.00030 | 0.00030 | Aynı | 0–0 / 0–0 | Aynı |
| Çok yüksek gol beklentisi | 0.02140 | 0.00231 | Aynı | 100–85 / 98–85 | Farklı |
| Kalan süre ve mevcut skor | 0.02310 | 0.05010 | Aynı | 1–2 / 1–2 | Aynı |

Sayısal test eşik dışına çıkarsa GitHub Actions doğrulaması ve otomatik tahmin kayıt işi başarısız olur. Sayfa dağıtımı GitHub Pages’in kendi akışıdır. Yerel doğrulama için [ham sonuçlar](tests/phase0-results.json) ve aşağıdaki komutlar kullanılabilir.

```sh
node tests/phase0-forecast-test.cjs
node tests/forecast-learning-test.cjs
```

## Önceki sürümlerin denetimi

Aşağıdaki sonuçlar geçmiş sürümlere aittir ve Faz 0 modeli için bağımsız ölçüm olarak kullanılmaz.

## Geçmiş maç testi

2023/24–2025/26 arasında [openfootball](https://github.com/openfootball/football.json) arşivinin erişilebilir ve tamamlanmış sonuçları. Her lig ve sezon kendi içinde kronolojik ilerletildi. Her tahmin yalnızca o sezonun daha erken günlerindeki tamamlanmış maçları görür. Maç günü ve sonraki günlerin kayıtları, kadrolar ve oranlar modele verilmedi. İki takımın da en az beş geçmiş maçının bulunduğu eşleşmeler ölçüldü. Canlıdaki aynı Poisson fonksiyonu ve aynı maçlar için 100.000 ve 500.000 simülasyonlu koşular karşılaştırıldı.

| Lig | Maç | 100.000 sonuç | 500.000 sonuç | 100.000 tam skor | 500.000 tam skor |
|---|---:|---:|---:|---:|---:|
| Süper Lig | 331 | 189/331 · %57,10 · %95 GA %51,72–%62,32 | 189/331 · %57,10 · %95 GA %51,72–%62,32 | 36/331 · %10,88 · %95 GA %7,96–%14,69 | 34/331 · %10,27 · %95 GA %7,44–%14,01 |
| Premier League | 957 | 502/957 · %52,46 · %95 GA %49,29–%55,60 | 503/957 · %52,56 · %95 GA %49,39–%55,71 | 95/957 · %9,93 · %95 GA %8,19–%11,98 | 95/957 · %9,93 · %95 GA %8,19–%11,98 |
| La Liga | 963 | 487/963 · %50,57 · %95 GA %47,42–%53,72 | 489/963 · %50,78 · %95 GA %47,62–%53,93 | 128/963 · %13,29 · %95 GA %11,29–%15,58 | 129/963 · %13,40 · %95 GA %11,39–%15,69 |
| Bundesliga | 769 | 394/769 · %51,24 · %95 GA %47,71–%54,75 | 393/769 · %51,11 · %95 GA %47,58–%54,62 | 67/769 · %8,71 · %95 GA %6,92–%10,92 | 71/769 · %9,23 · %95 GA %7,38–%11,49 |
| Serie A | 940 | 501/940 · %53,30 · %95 GA %50,10–%56,47 | 501/940 · %53,30 · %95 GA %50,10–%56,47 | 126/940 · %13,40 · %95 GA %11,37–%15,73 | 131/940 · %13,94 · %95 GA %11,87–%16,30 |
| Ligue 1 | 759 | 384/759 · %50,59 · %95 GA %47,04–%54,14 | 384/759 · %50,59 · %95 GA %47,04–%54,14 | 75/759 · %9,88 · %95 GA %7,96–%12,21 | 75/759 · %9,88 · %95 GA %7,96–%12,21 |
| Toplam | 4.719 | 2457/4719 · %52,07 · %95 GA %50,64–%53,49 | 2459/4719 · %52,11 · %95 GA %50,68–%53,53 | 527/4719 · %11,17 · %95 GA %10,30–%12,10 | 535/4719 · %11,34 · %95 GA %10,46–%12,27 |

- Sonuç isabeti en yüksek olasılıklı ev sahibi/beraberlik/deplasman seçeneğinin gerçek sonuçla eşleşmesidir. Tam skor isabeti en yüksek olasılıklı skorun birebir eşleşmesidir.
- Log loss modelde **1,003**, basit lig geçmişinde **1,072**. Üç sınıfın toplam kare hatasıyla hesaplanan Brier skoru **0,598** ve **0,648**. İki ölçütte düşük değer daha iyi.
- Basit karşılaştırma yalnızca o güne kadar aynı lig/sezonun 1X2 sıklığını kullanır. Üç seçeneğe birer başlangıç sayımı eklenir. Piyasa oranlarına veya başka profesyonel modellere karşı karşılaştırma yapılmadı.
- Süper Lig arşivi 2023/24 için erişilemedi. 2024/25 için 338/342, 2025/26 için 90/306 sonuç kullanılabilir durumdaydı. Diğer sezonlarda da skor kaydı eksikliği görülebilir. Bu örneklem sonuçlarını tüm maçlara genellemek için ek sezonlar ve bağımsız bir değerlendirme gerekir.

## Milli maç geçmiş testi

2023–2025 yıllarında 3.238 erkek A milli takım arşiv eşleşmesi. Geçmiş girdi 2018’den başlar ve tahmin gününden önceki maçlarla sınırlıdır. Arşiv tarafsız dediğinde model saha avantajı kullanmaz. Arşiv skorları varsa uzatmayı içerir. Seri penaltılar dahil değildir.

| Simülasyon | Maç sonucu (1X2) | Tam skor |
|---|---:|---:|
| 100.000 | 1800/3238 · %55,59 · %95 GA %53,87–%57,29 | 382/3238 · %11,80 · %95 GA %10,73–%12,95 |
| 500.000 | 1800/3238 · %55,59 · %95 GA %53,87–%57,29 | 383/3238 · %11,83 · %95 GA %10,76–%12,99 |

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
