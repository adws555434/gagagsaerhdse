# Football Intelligence · Sürüm denetimi

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
