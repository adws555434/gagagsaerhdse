# Football Intelligence · Sürüm denetimi

## Süper Lig · Skor olasılığı ve tahmin edilebilirlik

Aynı 929 maç yeniden ölçüldü. 2023/24, 2024/25, 2025/26 ve 2026/27 sezon başından sırasıyla 327, 290, 258 ve 54 maç var. Takım gol beklentisi o sezonda maç gününden önce oynanan maçlardan gelir. Adayların lig parametreleri ilk 40 uygun tahminde Poisson değerinde başlar ve yalnızca önceki günlerde sonuçlanmış tahminlerin tam skor log loss'u ile güncellenir. Üç aday için 31, 48 ve 9 yapılandırma denendi. Adayların ve yayın modelinin tüm sonuçları aynı 929 maçta ölçüldü.

| Skor seçimi | Modelin ortalama olasılığı [%95 GA] | Gerçek isabet [%95 GA] |
| --- | --- | --- |
| Genel en olası tek skor | %12,27 [%12,18–%12,35] | 115/929 · %12,38 [%10,41–%14,65] |
| İlk üç skor | %32,99 [%32,78–%33,20] | 298/929 · %32,08 [%29,16–%35,15] |
| İlk beş skor | %49,66 [%49,37–%49,96] | 432/929 · %46,50 [%43,32–%49,72] |
| Sonuç seçimiyle tutarlı tek skor | %11,58 [%11,48–%11,68] | 91/929 · %9,80 [%8,05–%11,88] |

Tam skor log loss'u, gerçekleşen skor hücresine verilen olasılığın eksi doğal logaritmasıdır. Aday eksi yayın modeli farkları için sezon katmanlı, haftalık 2.000 eşleştirilmiş bootstrap kullanıldı. Üç adayın %95 fark aralığı sıfırı kapsıyor. İlk üç skor için iyileşme de kanıtlanmadı. Varsayılan skor dağılımı Poisson olarak kaldı.

| Model | Tam skor log loss | Farkın %95 aralığı | İlk üç skor |
| --- | ---: | --- | ---: |
| Yayın modeli | 2,98906 | — | 298/929 |
| Dixon–Coles | 2,98641 | -0,00768 – +0,00212 | 290/929 |
| Beraberlik ağırlıklı bivariate Poisson | 2,98843 | -0,00895 – +0,00749 | 293/929 |
| Negatif binom | 2,98937 | -0,00037 – +0,00106 | 298/929 |

Arşiv alt/üstü küçük bir araştırma örneğinde ölçüldü. OddsIntel kapanış arşiviyle eşleşen 13 maçta mevcut skor matrisi, kendi kazanma ve beraberlik olasılıklarını koruyarak 2,5 üst olasılığına uyarlandı. İlk üç isabet 5/13'ten 6/13'e, tam skor 0/13'ten 2/13'e çıktı. Skor log loss 2,83826'dan 2,83102'ye indi. Yeterli hafta bloğu olmadığı için eşleştirilmiş belirsizlik aralığı raporlanmadı. Canlı The Odds API testi ve 929 maçın tamamında piyasa karşılaştırması çalıştırılmadı.

[Ham olmayan ölçüm çıktısı ve bütün kalibrasyon tabloları](score-calibration.json) · [Test komutu](tests/score-calibration.cjs)

929 maçın tek tek ilk üç skor tahmini ve toplam olasılığı yalnızca özel çıktı yoluna yazılabilir. Bu çıktı için `SCORE_CALIBRATION_PRIVATE_MATCHES` değişkenine depo dışındaki dosyanın yolu verilir.

```sh
node tests/score-calibration.cjs /veri/sabit-fikstur /veri/tff-results.json score-calibration.json /veri/oddsintel.csv
node tests/score-calibration.cjs /veri/sabit-fikstur /veri/tff-results.json score-calibration.json --captures /ozel/2023-24.json /ozel/2024-25.json /ozel/2025-26.json
```

## Süper Lig · The Odds API alım planı

Güncel oran akışının kapsamı `soccer_turkey_super_league`, bölgesi `eu`, piyasaları `h2h,totals`. GitHub Actions alım kaydı sağlayıcının `x-requests-last`, `x-requests-used` ve `x-requests-remaining` başlıklarını gösterir. Eksik başlık için bilinmeyen değer kullanılır. Anahtar yapılandırılmadığında işin tüketimi sıfırdır. Sağlayıcı hesabındaki bakiye bu durumda doğrulanamaz.

SHA-256 ile sabit [Football Charts fikstür arşivinden](tests/phase2-timing-inputs.json) aynı UTC başlama saatindeki maçlar birleştirildi. İki hedef an maç başlangıcından 24 saat ve 1 saniye öncedir. API hedef an veya öncesindeki en yakın arşiv görüntüsünü döndürür. Arşivdeki son maç önü görüntüsü, bahis sağlayıcısının yayımladığı son fiyat için yaklaşık ölçüdür. Arşiv anı, maç ve fiyat zamanları ayrıca doğrulanır.

| Sezon | Maç | Başlama saati grubu | Çağrı | Kredi tavanı |
| --- | ---: | ---: | ---: | ---: |
| 2023/24 | 380 | 254 | 508 | 10.160 |
| 2024/25 | 342 | 257 | 514 | 10.280 |
| 2025/26 | 306 | 227 | 454 | 9.080 |
| Toplam | 1.028 | 738 | 1.476 | 29.520 |

Tek bölge ve iki piyasa ile tarihsel çağrı başına 20 kredi bütçelenir. Üç sezonun tamamı için 20.000 kredinin 9.520 kredi üzerinde bir tavan var. Boş tarihsel yanıtlar ücret kotasına sayılmayabilir. Bu hesap planlanan çağrıları kapsar. Yeniden denemeler ve zaman uyuşmazlığı araştırması bu sayıya dahil değildir. [API tarihsel belgeleri](https://the-odds-api.com/liveapi/guides/v4/#historical-odds)

```sh
node tests/phase2-fetch-history.cjs plan /veri/girdi /veri/plan.json TUR_1_super-lig
```

Ücretli çağrı kullanıcı onayı bekliyor. Arşiv edinilince SHA-256 ile sabitlenecek. Yayın modeli, kapanış piyasası, 24 saat öncesi piyasa ve yalnızca daha önceki maçlarda öğrenilen harman aynı eşleşmelerde ileri yürüyen testle ölçülecek. 1X2 log loss ve RPS için haftalık eşleştirilmiş bootstrap, isabet için Wilson %95 aralıkları raporlanacak. Ham geçmiş arşiv özel tutulur. Açık depoya toplu metrik, kapsam ve veri özetleri girer. [The Odds API kullanım şartları](https://the-odds-api.com/terms-and-conditions.html#restrictions)

## Faz 2 · Arşiv genişletme ve erken oran denetimi

| Bileşen | Durum |
|---|---|
| Açılış ve kapanış 1X2 karşılaştırması | **Çalışıyor.** Aynı maçlarda kaynak ve zaman gruplarına göre karşılaştırıldı. |
| Tarihsel 2,5 alt/üst | **Kısmi.** Dört ligin tam 2025/26 kaynak dosyaları ve Premier League’in 2026/27 kısmi kaydı alındı. Süper Lig ve Ligue 1 için kısa kapanış araştırma örneği var. |
| Oranlardan skor matrisi ve beklenen gol farkı | **Çalışıyor.** Tarihsel 1X2 + 2,5 alt/üst ile ölçüldü. Ortak örneklemde yayın modelinin tam skoru ve ilk üç skoru da hesaplandı. |
| Maç başına oran yayın saati | **Kısmi.** İlk fiyatın saati bir alt örneklemde doğrulandı. Başlangıca yakın tarihsel saat dilimleri ve kapanışın dakika damgası eksik. |
| Lig bazında erken harman ve güven kademeleri | **Çalışıyor.** Ağırlık her ay öncesi lig içindeki verilerle öğrenildi. Tarihsel test ve güven kademeleri yayımlandı. |
| Altı ligde üç tam sezon ve bağımsız maç önü ölçümü | **Kısmi.** Ortak tam sezon sayısı 0. Sonuçlanmış bağımsız harman karşılaştırması 0/500. Çok sezonlu yayın koşulu sağlanmadı. |
| Güncel oran API’si ve varsayılan tahmin | **Kısmi.** Canlı sağlayıcı testi çalıştırılmadı. Ana 1X2 için geçerli fiyat varsa piyasa, diğer maçlarda yayın modeli kullanılıyor. |

Skor ve değerlendirme sürümü `2026.11-phase-2-archive`. Yayın modeli `2026.11-club-balance`. Birleşik veri SHA-256 `ed20e601d25dbde785a093473853ec2953080c2e662d522e93973ed394ecf0ab`. Analitik tahmin başına 0 çekiliş. 2.000 lig–sezon katmanlı haftalık eşleştirilmiş bootstrap. Ham oran tabloları yerine özetler yayımlanır.

### Kaynak ve kullanım koşulları

| Kaynak | Bu aşamada kullanılabilen kapsam | Kullanım |
|---|---|---|
| [Min Maxxxer · Premier League 2025/26](https://huggingface.co/datasets/minmaxxxer/premier-league-closing-odds-2025-26), [2026/27](https://huggingface.co/datasets/minmaxxxer/premier-league-odds-2026-27), [La Liga, Serie A ve Bundesliga 2025/26](https://huggingface.co/datasets/minmaxxxer/laliga-serie-a-bundesliga-closing-odds-2025-26) | Açılış ve kapanış 1X2 + 2,5 alt/üst konsensüsü. Bir tam sezon ve Premier League için ek kısmi sezon. | Kaynak kartı [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) belirtiyor. Kaynak olasılıkları önceden marjdan arındırılmış. Yuvarlama dışı toplam hatası olan satırlar reddediliyor. |
| [TipsAudit](https://tipsaudit.com/data) | Süper Lig, Ligue 1 ve diğer liglerin 2026/27 kısmi döneminde Pinnacle’ın ilk ve kapanış 1X2 satırları. | CC BY 4.0. İlk fiyat sağlayıcının ilk kaydıdır. 2,5 alt/üst verisi yok. |
| [OddsIntel (oddsintel.app)](https://huggingface.co/datasets/margussellin/oddsintel-football-closes-sample) | 10–22 Ekim 2026 kapanış 1X2 + alt/üst araştırma örneği. | [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). Bu örnek yalnızca ticari olmayan tarihsel araştırma karşılaştırmasına kullanıldı. Harman eğitimi ve varsayılan tahmin kapsamına girmedi. |
| [Football-Data.co.uk](https://football-data.co.uk/contact.php) | Altı lig için çok sezonlu dosyalar yayımlıyor. | Ücretsiz veri kişisel ve akademik araştırmaya ayrılmış. Bu açık uygulamanın model eğitim hattına dahil edilmedi. Yazılı izin veya uygun lisans gerekir. |
| [The Odds API · tarihsel kapsama](https://the-odds-api.com/historical-odds-data/) ve [koşullar](https://the-odds-api.com/terms-and-conditions.html) | Altı ligi, 1X2 ve toplam gol piyasalarını içeren zaman damgalı geçmiş kayıtlar için ücretli seçenek. Fiilî sezon ve maç kapsamı örneklemeyle doğrulanmalı. | Model eğitimi, saklama ve türetilen olasılıkların uygulamada gösterilmesine izin veriyor. Ham veri dağıtımı kısıtlı. [Tarihsel erişim planı](https://the-odds-api.com/) 20.000 kredi için aylık 30 USD listeliyor. Bir bölge ve iki piyasa sorgusu en çok 20 tarihsel kredi. Bir çağrıda birden çok maç olabilir. Toplam maliyet maç saati kümeleri ve gereken anlık kayıt sayısına bağlı. |
| [TheStatsAPI](https://www.thestatsapi.com/odds-api/historical-football-odds), [Football Charts](https://www.football-charts.com/csv-downloads) | Açılış/kapanış veya son görülen fiyat arşivleri sunuyor. | Ücretli. Altı ligin üç tam sezonu ve bu uygulamadaki kullanım izni doğrulanmadığı için devreye alınmadı. |

Tarihsel oran arşivi bir satırda fiyatın ne zaman yayımlandığını vermiyor. Bu nedenle açılış ve kapanış, sağlayıcının sınıflandırmasına dayanıyor. Güncel servis altı saatte bir planlanmış yeni bir maç önü görüntüsü verir. Bu, maçtan birkaç saat önce alınan oran senaryosuna daha yakın. Açılış anı ve son kapanış anı ayrı. Panel gerçek görüntünün maç başlangıcına kalan saatini gösterir. Açılış verisi ölçümü, bu canlı akış için birebir saat kalibrasyonu sağlamaz.

### Gerçekleşen arşiv kapsamı

| Lig | Sezon | Kaynak | Dosyada | Skorla doğrulandı | Ortak 1X2 + alt/üst |
|---|---|---|---:|---:|---:|
| Premier League | 2025-26 | Min Maxxxer | 380 | 380 | 342 |
| La Liga | 2025-26 | Min Maxxxer | 380 | 380 | 306 |
| Bundesliga | 2025-26 | Min Maxxxer | 306 | 306 | 272 |
| Serie A | 2025-26 | Min Maxxxer | 380 | 380 | 342 |
| Premier League | 2026-27 | Min Maxxxer | 100 | 100 | 72 |
| Serie A | 2026-27 | OddsIntel | 19 | 19 | 17 |
| Bundesliga | 2026-27 | OddsIntel | 13 | 13 | 10 |
| Premier League | 2026-27 | OddsIntel | 15 | 15 | 9 |
| La Liga | 2026-27 | OddsIntel | 18 | 18 | 13 |
| Ligue 1 | 2026-27 | OddsIntel | 16 | 16 | 14 |
| Süper Lig | 2026-27 | OddsIntel | 13 | 13 | 9 |

Tarihe ve yönlü takım kimliklerine ek olarak iki kaynaktaki tam skor karşılaştırıldı. Önceki lig sezonlarında iki takım için de en az beş maç gerektiğinden, kaynakta bulunan bazı maçlar ortak testte yok. 232 arşiv dışlama kaydı [eksik veri raporunda](tests/phase2-missing.json). Sonuç puanları aynı satırlardaki yöntemler için aynı maçları kullanır. Birden çok kaynak aynı maçlara denk geldiğinde araştırma örneği ayrı tutulur.

### Erken oran ve kapanış

| Yöntem | N | Log loss | RPS | 1X2 [%95 GA] | Tutarlı tam skor [%95 GA] | İlk üç [%95 GA] |
|---|---:|---:|---:|---|---|---|
| Yayın modeli | 1447 | 1,00507 | 0,20726 | 746/1447 · %51,55 [%48,98–%54,12] | 156/1447 · %10,78 [%9,29–%12,48] | 455/1447 · %31,44 [%29,10–%33,88] |
| Erken piyasa · 1X2 | 1447 | 0,98067 | 0,19967 | 768/1447 · %53,08 [%50,50–%55,64] | 161/1447 · %11,13 [%9,61–%12,85] | 477/1447 · %32,96 [%30,59–%35,43] |
| Kapanış piyasası · 1X2 | 1447 | 0,97589 | 0,19808 | 780/1447 · %53,90 [%51,33–%56,46] | 158/1447 · %10,92 [%9,41–%12,63] | 473/1447 · %32,69 [%30,32–%35,15] |

Altı lig toplamı için kapanış eksi erken oran log loss farkı %95 aralığı **-0,01014 ile 0,00110**. Süper Lig için **-0,06948 ile 0,00022**. Bu iki karşılaştırmada kapanışın erken orana üstünlüğü kanıtlanamadı.

| Yöntem | N | Log loss | RPS | 1X2 [%95 GA] | Tutarlı tam skor [%95 GA] | İlk üç [%95 GA] |
|---|---:|---:|---:|---|---|---|
| Yayın modeli | 50 | 0,98572 | 0,21580 | 26/50 · %52,00 [%38,51–%65,20] | 4/50 · %8,00 [%3,15–%18,84] | 10/50 · %20,00 [%11,24–%33,04] |
| Erken piyasa · 1X2 | 50 | 0,93208 | 0,19644 | 27/50 · %54,00 [%40,40–%67,03] | 5/50 · %10,00 [%4,35–%21,36] | 14/50 · %28,00 [%17,47–%41,67] |
| Kapanış piyasası · 1X2 | 50 | 0,89758 | 0,18522 | 28/50 · %56,00 [%42,31–%68,84] | 5/50 · %10,00 [%4,35–%21,36] | 16/50 · %32,00 [%20,76–%45,81] |

### Alt/üst ve skor matrisi

Başlangıç Poisson toplamı 2,5 üst olasılığına göre, ev ve deplasmana dağıtım ise kazanma oranına göre çözülür. Ardından skor matrisi, 1X2 ile 2,5 üst marjinlerini birlikte koruyacak şekilde yeniden ağırlıklandırılır. Son matristeki gol ortalamaları beklenen toplam ve gol farkıdır. Aynı 1X2 ile alt/üst eklenince log loss ve RPS doğal olarak aynı kalır. Ayrım tam skor ve ilk üç skor isabetinde görülür.

| Yöntem | N | Log loss | RPS | 1X2 [%95 GA] | Tutarlı tam skor [%95 GA] | İlk üç [%95 GA] |
|---|---:|---:|---:|---|---|---|
| Yayın modeli | 1334 | 1,01012 | 0,20758 | 683/1334 · %51,20 [%48,52–%53,87] | 143/1334 · %10,72 [%9,17–%12,49] | 421/1334 · %31,56 [%29,12–%34,10] |
| Erken piyasa · 1X2 | 1334 | 0,98663 | 0,20034 | 701/1334 · %52,55 [%49,87–%55,22] | 145/1334 · %10,87 [%9,31–%12,65] | 440/1334 · %32,98 [%30,51–%35,55] |
| Erken piyasa · 1X2 + alt/üst | 1334 | 0,98663 | 0,20034 | 701/1334 · %52,55 [%49,87–%55,22] | 147/1334 · %11,02 [%9,45–%12,81] | 432/1334 · %32,38 [%29,93–%34,94] |
| Kapanış piyasası · 1X2 | 1334 | 0,98276 | 0,19908 | 713/1334 · %53,45 [%50,77–%56,11] | 144/1334 · %10,79 [%9,24–%12,57] | 437/1334 · %32,76 [%30,29–%35,32] |
| Kapanış piyasası · 1X2 + alt/üst | 1334 | 0,98276 | 0,19908 | 713/1334 · %53,45 [%50,77–%56,11] | 139/1334 · %10,42 [%8,89–%12,17] | 451/1334 · %33,81 [%31,32–%36,39] |

| Alt/üst eksi aynı 1X2 | Tutarlı tam skor farkı %95 GA | İlk üç skor farkı %95 GA |
|---|---|---|
| Erken | -1,24238 ile 1,53739 yüzde puan | -2,54496 ile 1,18276 yüzde puan |
| Kapanış | -1,81420 ile 1,04176 yüzde puan | -0,75490 ile 2,95859 yüzde puan |

Süper Lig’in [OddsIntel](https://oddsintel.app/) [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) kısa kapanış örneği ayrıca ölçüldü.

| Yöntem | N | Log loss | RPS | 1X2 [%95 GA] | Tutarlı tam skor [%95 GA] | İlk üç [%95 GA] |
|---|---:|---:|---:|---|---|---|
| Yayın modeli | 9 | 0,74780 | 0,15348 | 7/9 · %77,78 [%45,26–%93,68] | 1/9 · %11,11 [%1,99–%43,50] | 3/9 · %33,33 [%12,06–%64,58] |
| Kapanış piyasası · 1X2 | 9 | 0,70189 | 0,14126 | 7/9 · %77,78 [%45,26–%93,68] | 1/9 · %11,11 [%1,99–%43,50] | 3/9 · %33,33 [%12,06–%64,58] |
| Kapanış piyasası · 1X2 + alt/üst | 9 | 0,70189 | 0,14126 | 7/9 · %77,78 [%45,26–%93,68] | 1/9 · %11,11 [%1,99–%43,50] | 2/9 · %22,22 [%6,32–%54,74] |

### Lig bazında erken harman

Ağırlık ay başında donduruldu. Yalnızca aynı ligin önceki ayları kullanılabilir. Asgari eğitim örneklemi 40 maç. Log loss ile RPS’nin yayın modeline oranlarının ortalaması küçültülür. Bir hafta veya ay içinde sonraki maçın sonucu aynı dönemin ayarına girmez.

| Lig | Son ağırlığın eğitim maçları | Erken piyasaya ağırlık | Sonraki dönem test maçları |
|---|---:|---:|---:|
| Premier League | 414 | %100,00 | 360 |
| La Liga | 306 | %100,00 | 250 |
| Bundesliga | 272 | %85,00 | 232 |
| Serie A | 342 | %100,00 | 297 |
| Süper Lig | 50 | %100,00 | 4 |
| Ligue 1 | 63 | %100,00 | 5 |

| Yöntem | N | Log loss | RPS | 1X2 [%95 GA] | Tutarlı tam skor [%95 GA] | İlk üç [%95 GA] |
|---|---:|---:|---:|---|---|---|
| Yayın modeli | 1148 | 1,01099 | 0,20844 | 593/1148 · %51,66 [%48,76–%54,54] | 129/1148 · %11,24 [%9,54–%13,19] | 358/1148 · %31,18 [%28,57–%33,92] |
| Erken piyasa | 1148 | 0,98651 | 0,20057 | 605/1148 · %52,70 [%49,81–%55,57] | 128/1148 · %11,15 [%9,46–%13,10] | 360/1148 · %31,36 [%28,74–%34,10] |
| Erken harman · Lig ağırlığı | 1148 | 0,98939 | 0,20149 | 603/1148 · %52,53 [%49,63–%55,40] | 129/1148 · %11,24 [%9,54–%13,19] | 361/1148 · %31,45 [%28,83–%34,19] |

Harman eksi yayın log loss farkının %95 aralığı **-0,03352 ile -0,00974**. Harman eksi erken piyasa farkı **0,00026 ile 0,00546**. Süper Lig’de 4 sonraki dönem maçı kaldı. Haftalık eşleştirilmiş fark aralığı yeterli blok oluşmadığı için çalıştırılmadı. Varsayılan model için altı ligde çok sezonlu koşul ve bağımsız kayıt eşiği oluşmadı. Güncel oran gelse de harman kartta deneysel karşılaştırma olarak kalır.

### Güven kademeleri

Açılış ve kapanış piyasa satırları zaman karşılaştırması örneklemini, erken harman satırı yalnızca önceki aydan ağırlık öğrenilebilen maçları kapsar. Parantezlerde Wilson %95 aralığı bulunur.

| Yöntem | Kademe | Kapsam [%95 GA] | 1X2 isabeti [%95 GA] |
|---|---|---|---|
| Erken piyasa · 1X2 | %45–55 | 412/1447 · %28,47 [%26,21–%30,85] | 205/412 · %49,76 [%44,95–%54,57] |
| Erken piyasa · 1X2 | %55–65 | 289/1447 · %19,97 [%17,99–%22,11] | 181/289 · %62,63 [%56,92–%68,01] |
| Erken piyasa · 1X2 | %65+ | 216/1447 · %14,93 [%13,18–%16,86] | 165/216 · %76,39 [%70,29–%81,56] |
| Kapanış piyasası · 1X2 | %45–55 | 400/1447 · %27,64 [%25,40–%30,00] | 205/400 · %51,25 [%46,36–%56,11] |
| Kapanış piyasası · 1X2 | %55–65 | 286/1447 · %19,77 [%17,79–%21,90] | 175/286 · %61,19 [%55,43–%66,65] |
| Kapanış piyasası · 1X2 | %65+ | 216/1447 · %14,93 [%13,18–%16,86] | 171/216 · %79,17 [%73,26–%84,05] |
| Erken harman · Lig ağırlığı | %45–55 | 327/1148 · %28,48 [%25,95–%31,16] | 159/327 · %48,62 [%43,25–%54,03] |
| Erken harman · Lig ağırlığı | %55–65 | 244/1148 · %21,25 [%18,99–%23,71] | 151/244 · %61,89 [%55,65–%67,75] |
| Erken harman · Lig ağırlığı | %65+ | 159/1148 · %13,85 [%11,97–%15,97] | 118/159 · %74,21 [%66,90–%80,39] |

#### Süper Lig

| Yöntem | Kademe | Kapsam [%95 GA] | 1X2 isabeti [%95 GA] |
|---|---|---|---|
| Erken piyasa · 1X2 | %45–55 | 14/50 · %28,00 [%17,47–%41,67] | 6/14 · %42,86 [%21,38–%67,41] |
| Erken piyasa · 1X2 | %55–65 | 8/50 · %16,00 [%8,34–%28,51] | 6/8 · %75,00 [%40,93–%92,85] |
| Erken piyasa · 1X2 | %65+ | 12/50 · %24,00 [%14,30–%37,41] | 10/12 · %83,33 [%55,20–%95,30] |
| Kapanış piyasası · 1X2 | %45–55 | 14/50 · %28,00 [%17,47–%41,67] | 8/14 · %57,14 [%32,59–%78,62] |
| Kapanış piyasası · 1X2 | %55–65 | 7/50 · %14,00 [%6,95–%26,19] | 5/7 · %71,43 [%35,89–%91,78] |
| Kapanış piyasası · 1X2 | %65+ | 13/50 · %26,00 [%15,87–%39,55] | 11/13 · %84,62 [%57,77–%95,67] |
| Erken harman · Lig ağırlığı | %45–55 | 1/4 · %25,00 [%4,56–%69,94] | 1/1 · %100,00 [%20,65–%100,00] |
| Erken harman · Lig ağırlığı | %55–65 | 1/4 · %25,00 [%4,56–%69,94] | 0/1 · %0,00 [%0,00–%79,35] |
| Erken harman · Lig ağırlığı | %65+ | 1/4 · %25,00 [%4,56–%69,94] | 1/1 · %100,00 [%20,65–%100,00] |

### Yeniden üretme

[Faz 1 arşiv hazırlığı](#faz-1--ölçüm-altyapısı), [TipsAudit manifesti](tests/phase2-inputs.json) ve [ek kaynak manifesti](tests/phase2-archive-inputs.json) ile çalıştır. Ek klasörde dosya eksikse komut manifestteki sabit kopyayı indirip SHA-256 kontrolü yapar. [Kayıt defterinin ölçülen kopyası](https://raw.githubusercontent.com/adws555434/gagagsaerhdse/d5a023c26ca4cf0aaaaa2fb94a21b2c80ab676c1/forecast-ledger.json) kullanıldı.

```sh
node tests/phase2-backtest.cjs --self-test
node tests/phase2-market-test.cjs
node tests/phase2-backtest.cjs /veri/arsiv /veri/tips.csv /veri/cikti /veri/tff-results.json /veri/forecast-ledger.json /veri/ek-oran
```

[Ham karşılaştırmalar, lig/sezon aralıkları ve aylık ağırlıklar](tests/phase2-results.json)

### Ek doğrulama · İlk fiyat saati ve üç sezonluk veri alımı

**Zaman damgalı ilk fiyat testi çalışıyor.** TipsAudit’in sabit maç önü kayıtları, CSV’deki maç kimliği, kayıt özeti ve başlama saatiyle eşleştirildi. İlk Pinnacle fiyatı daha sonra doldurulmuşsa doldurma zamanı kullanıldı. Eksik fiyatın doldurulma zamanının tutulmadığı dönemden 182 maç bu incelemeye alınmadı. 186 maçta en erken doğrulanmış fiyatla kapanış karşılaştırıldı. Hepsinde ilk fiyat başlama saatinden en az 48 saat önceydi. 1–6, 6–24 ve 24–48 saat aralığındaki eşleşme sayıları sırasıyla 0, 0, 0. Yakın saatli geçmiş erken fiyat testi **çalıştırılmadı**. Arşivin kapanış fiyatı satır bazında ayrı bir yayın zamanı taşımıyor. [TipsAudit açıklaması](https://tipsaudit.com/about) · [Sabit girdiler](tests/phase2-timing-inputs.json)

| Örneklem | Model | Log loss | RPS | 1X2 ve %95 aralık |
|---|---|---:|---:|---|
| Altı lig | Yayın modeli | 0,94165 | 0,20449 | 107/186 · %57,53 [%50,34–%64,41] |
| Altı lig | Zaman damgalı erken 1X2 | 0,91388 | 0,19554 | 116/186 · %62,37 [%55,22–%69,01] |
| Altı lig | Kapanış 1X2 | 0,90764 | 0,19337 | 116/186 · %62,37 [%55,22–%69,01] |
| Süper Lig | Yayın modeli | 0,84336 | 0,18616 | 18/25 · %72,00 [%52,42–%85,72] |
| Süper Lig | Zaman damgalı erken 1X2 | 0,83378 | 0,18042 | 17/25 · %68,00 [%48,41–%82,79] |
| Süper Lig | Kapanış 1X2 | 0,76218 | 0,15828 | 18/25 · %72,00 [%52,42–%85,72] |

Kapanış eksi ilk fiyat log loss farkının eşleştirilmiş %95 aralığı altı ligde -0,02093 ile 0,00865, Süper Lig’de -0,09809 ile -0,04290. Süper Lig sonucu bu dar zaman örneğine ait. Canlıda akış yine maçtan saatler önceki son görüntüye daha yakın.

**Üç sezonluk sorgu planı çalışıyor.** [Football Charts](https://www.football-charts.com/dataset) CC BY 4.0 fikstür kopyasından aynı lig ve UTC başlama saatindeki maçlar gruplandı. Grup başına iki isteğin hedefi maçtan 6 saat ve 1 dakika önce. Sunucu hedef an veya öncesindeki en yakın görüntüyü döndürür. 1 dakika hedefi, son gerçekleşen kapanış fiyatı için yaklaşık bir ölçümdür. Sorgu planı 6.288 fikstür satırı, 4.657 zaman grubu, 9.314 çağrı ve bir bölge ile iki piyasa için en çok 186.280 kredi hesapladı. Bunlar plan değerleri. Fiilî kapsama, tablo kaynaklarının ek play-off kayıtları ve fiyat eksikleri nedeniyle ayrı ölçülecek. Bundesliga ile Ligue 1 planında kaynak fazladan fikstür barındırabilir. [The Odds API teknik tanımı](https://the-odds-api.com/historical-odds-data/)

| Lig | Fikstür satırı | Çağrı | Kredi tavanı |
|---|---:|---:|---:|
| Süper Lig | 1.028 | 1.476 | 29.520 |
| Premier League | 1.140 | 1.358 | 27.160 |
| La Liga | 1.140 | 2.092 | 41.840 |
| Bundesliga | 919 | 1.066 | 21.320 |
| Serie A | 1.140 | 1.948 | 38.960 |
| Ligue 1 | 921 | 1.374 | 27.480 |

The Odds API [kullanım koşulları](https://the-odds-api.com/terms-and-conditions.html) model eğitimine ve türetilmiş sonuçların gösterilmesine izin veriyor. Tek aylık alım karşılaştırmasında plan tavanı 20K ve 100K paketlerini aşıyor. Sağlayıcı [5M paketi](https://the-odds-api.com/) aylık 119 USD listeliyor. Gerçek kredi tüketimi sonuç içeriğine bağlı. [Football Charts satış şartları](https://www.football-charts.com/terms) türetilmiş modelleri kullanıcıya bırakıyor ve ham veri yayımını sınırlıyor. Bununla birlikte arşiv [La Liga için alt/üst yakalama eksiği](https://www.football-charts.com/data) belirtiyor. [Betfair Basic](https://historicdata.betfair.com/ExchangeHistoricalStore/) ücretsiz bir aday, ancak bu proje için altı ligde 2,5 alt/üst kapsamı ve türetilen sonuçların açık uygulamada kullanım izni doğrulanmadı. Ücretsiz ve uygun lisanslı üç tam sezonluk ortak fiyat arşivi hâlâ **bağlı değil**.

**Lisanslı alım iş akışı kısmi.** Sağlayıcının iki açık örnek görüntüsü gerçekten indirildi ve tarih, maç başlangıcı ve fiyat güncelliği denetiminden geçti. Premier League 20/20, Bundesliga 18/18 1X2 kaydı kabul edildi. Örneklerde toplam 0 alt/üst kaydı var. Ücretli API çağrısı **çalıştırılmadı**. Akış elle başlatılır, anahtarını GitHub Actions secret’ından alır ve kredi tavanında durur. Sonraki çağrı numarasından sürdürülebilir. Yayın dalına ham yanıt veya arşiv anahtarı yazılmaz. Çıktı, zaman damgası ve SHA-256 ile türetilen olasılıklardan oluşur. Otomatik varsayılan model değişikliği yapılmadı.

```sh
node tests/phase2-timing-test.cjs
node tests/phase2-fetch-history.cjs plan /veri/girdi /veri/plan.json
node tests/phase2-fetch-history.cjs samples /veri/girdi /veri/ornek.json
node tests/phase2-backtest.cjs /veri/arsiv /veri/tips.csv /veri/cikti /veri/tff-results.json /veri/forecast-ledger.json /veri/ek-oran /veri/yakalama/*.json
```

Alım GitHub’da [Historical market capture](https://github.com/adws555434/gagagsaerhdse/actions/workflows/market-history.yml) üzerinden bir lig ve sezon seçilerek başlatılır. Oluşan dosyalar backtest komutuna verilir. Raporun bu ölçümdeki birleşik girdi SHA-256 değeri `ed20e601d25dbde785a093473853ec2953080c2e662d522e93973ed394ecf0ab`. Bağımsız sonuçlanmış piyasa harmanı 0/500. Faz 2 tamamlanmış sayılmadı.

## Faz 2 · İlk piyasa sürümü

| Bileşen | Durum |
|---|---|
| Geçmiş kapanış 1X2, orantılı ve power marj düzeltmesi | **Çalışıyor.** TipsAudit’in CC BY 4.0 arşivindeki Pinnacle kapanış fiyatları. Ham fiyatlar bu depoya eklenmedi. |
| Piyasa ve harman backtest’i, üç güven kademesi, fark aralıkları ve kapsam | **Çalışıyor.** Maçlar tarih ve doğrulanmış takım kimlikleriyle eşleştirildi. İki kaynağın 1X2 sonuçları uyuşmalı. |
| Kapanış oranının yayın dakikasını bağımsız doğrulama | **Kısmi.** Kaynak fiyatı maç öncesi kapanış olarak tanımlıyor. Satır bazında fiyatın yayın saati verilmiyor. |
| Geçmiş alt/üst arşivi | **İlk sürümde bağlı değildi.** Güncel durum arşiv genişletme bölümünde. |
| 2,5 üst ve 1X2’den piyasa Poisson beklentileri | **Kısmi.** Kod ve analitik doğrulama testi çalışıyor. Gerçek zamanlı maç verisiyle doğrulama çalıştırılmadı. |
| Güncel oranlar, fark tablosu ve maç önü kayıt defteri | **Kısmi.** GitHub Actions, statik olasılık özeti ve güncel maç eşleştirmesi eklendi. Gerçek sağlayıcı çağrısı çalıştırılmadı. Statik dosyada 0 maç var. |
| Bağımsız değerlendirme ve model yükseltme | **Kısmi.** İlk maç önü karşılaştırması aynı anda kaydedilecek. Sabit kayıtta sonuçlanmış 0 eşleştirme var. Gereken en az 500 maç tamamlanana kadar bağımsız isabet çalıştırılmadı. |

Ölçüm sürümü `2026.11-phase-2`, mevcut model `2026.11-club-balance`, motor `2026.11-phase-0`. Oran dosyası SHA-256 `a35012902ca1078c3a9d206587364bdc7f53e4f897aac514ae48293887084a22`, birleşik veri SHA-256 `c9f841925f6b8d1b3d393810fed1376ac3368bc09452edc62218a5262ed3ca74`. Analitik tahmin başına 0 simülasyon. Eşleştirilmiş lig ve hafta bloklarıyla 2.000 bootstrap tekrarı, tohum `19461116`. Canlı örneğin son güncellemesi gelirken sağlayıcı yanıtı özeti ayrıca SHA-256 ile saklanır.

Football-Data.co.uk ücretsiz tarihsel CSV’lerinde kapanış 1X2 ve bazı alt/üst sütunları var. [Kullanım politikası](https://football-data.co.uk/contact.php) ücretsiz dosyaları kişisel/akademik kullanıma ayırıyor ve otomatik model eğitim ürünü kapsamını kısıtlıyor. Football Intelligence geçmiş 1X2 için [TipsAudit · CC BY 4.0](https://tipsaudit.com/data) kullanıyor. Kaynağın sabit kopyası ve lisans bilgisi [girdi manifestinde](tests/phase2-inputs.json). Eşleşen satırlarda ortalama ham Pinnacle marjı %3,26. Kaynaktaki ilk fiyat, tahminin kaydedildiği zaman veya sonrasında bulunan ilk maç önü fiyatı. Kapanış ve ilk fiyat, verilen sırayla ayrı analiz edildi.

### Kapanış fiyatı olan ortak örneklem

Faz 1’deki sezon başında dondurulan referanslar yeniden hesaplandı. Aynı maçlar tüm satırlarda kullanıldı. Kapanış arşivi 2026/27 sezonunun bir kısmını kapsıyor. 368 maçın 50 tanesi Süper Lig. Piyasa tam skoru, piyasa 1X2 olasılıklarını yayın modelinin sonuç içi skor dağılımıyla birleştirir. Tam skor tablosu ayrı bir kapanış kesin skor piyasasından gelmez. İsabet aralıkları Wilson %95’tir.

| Model | Maç | Log loss | RPS | Brier | 1X2 isabeti [%95 GA] | Tutarlı tam skor [%95 GA] | İlk üç [%95 GA] |
|---|---:|---:|---:|---:|---|---|---|
| Yayın modeli | 368 | 0,96583 | 0,20538 | 0,57220 | 195/368 · %52,99 [%47,89 ile %58,03] | 35/368 · %9,51 [%6,92 ile %12,94] | 98/368 · %26,63 [%22,37 ile %31,37] |
| Lig sıklığı | 368 | 1,06119 | 0,23813 | 0,64185 | 166/368 · %45,11 [%40,10 ile %50,22] | 28/368 · %7,61 [%5,32 ile %10,78] | 86/368 · %23,37 [%19,33 ile %27,95] |
| Elo | 368 | 0,95846 | 0,20367 | 0,56696 | 200/368 · %54,35 [%49,24 ile %59,37] | 31/368 · %8,42 [%6,00 ile %11,71] | 104/368 · %28,26 [%23,90 ile %33,07] |
| Bağımsız Poisson | 368 | 1,01779 | 0,22298 | 0,60818 | 180/368 · %48,91 [%43,84 ile %54,01] | 30/368 · %8,15 [%5,77 ile %11,40] | 95/368 · %25,82 [%21,61 ile %30,52] |
| Belirsizlikli Poisson | 368 | 0,96609 | 0,20544 | 0,57240 | 195/368 · %52,99 [%47,89 ile %58,03] | 35/368 · %9,51 [%6,92 ile %12,94] | 97/368 · %26,36 [%22,12 ile %31,09] |
| Piyasa · orantılı | 368 | 0,93711 | 0,19638 | 0,55175 | 210/368 · %57,07 [%51,96 ile %62,02] | 38/368 · %10,33 [%7,62 ile %13,86] | 103/368 · %27,99 [%23,65 ile %32,79] |
| Piyasa · power | 368 | 0,93475 | 0,19586 | 0,55028 | 210/368 · %57,07 [%51,96 ile %62,02] | 38/368 · %10,33 [%7,62 ile %13,86] | 104/368 · %28,26 [%23,90 ile %33,07] |

#### Süper Lig

| Model | Maç | Log loss | RPS | Brier | 1X2 isabeti [%95 GA] | Tutarlı tam skor [%95 GA] | İlk üç [%95 GA] |
|---|---:|---:|---:|---:|---|---|---|
| Yayın modeli | 50 | 0,98572 | 0,21580 | 0,58604 | 26/50 · %52,00 [%38,51 ile %65,20] | 4/50 · %8,00 [%3,15 ile %18,84] | 10/50 · %20,00 [%11,24 ile %33,04] |
| Piyasa · orantılı | 50 | 0,90076 | 0,18580 | 0,52530 | 28/50 · %56,00 [%42,31 ile %68,84] | 5/50 · %10,00 [%4,35 ile %21,36] | 15/50 · %30,00 [%19,10 ile %43,75] |
| Piyasa · power | 50 | 0,89758 | 0,18522 | 0,52350 | 28/50 · %56,00 [%42,31 ile %68,84] | 5/50 · %10,00 [%4,35 ile %21,36] | 16/50 · %32,00 [%20,76 ile %45,81] |

| Piyasa power güven kademesi | Süper Lig kapsamı [%95 GA] | Süper Lig isabeti [%95 GA] |
|---|---|---|
| %45 altı | 16/50 · %32,00 [%20,76 ile %45,81] | 4/16 · %25,00 [%10,18 ile %49,50] |
| %45–55 | 14/50 · %28,00 [%17,47 ile %41,67] | 8/14 · %57,14 [%32,59 ile %78,62] |
| %55–65 | 7/50 · %14,00 [%6,95 ile %26,19] | 5/7 · %71,43 [%35,89 ile %91,78] |
| %65+ | 13/50 · %26,00 [%15,87 ile %39,55] | 11/13 · %84,62 [%57,77 ile %95,67] |

| Tüm ligler | Log loss farkı, aday eksi yayın | Eşleştirilmiş %95 aralık | Sonuç |
|---|---:|---|---|
| Lig sıklığı | 0,09535 | 0,05752 ile 0,13352 | Daha yüksek hata |
| Elo | -0,00737 | -0,02152 ile 0,00608 | Fark kanıtlanamadı |
| Bağımsız Poisson | 0,05196 | 0,03423 ile 0,07060 | Daha yüksek hata |
| Belirsizlikli Poisson | 0,00026 | -0,00063 ile 0,00116 | Fark kanıtlanamadı |
| Piyasa · orantılı | -0,02872 | -0,04934 ile -0,00737 | Daha düşük hata |
| Piyasa · power | -0,03108 | -0,05178 ile -0,00947 | Daha düşük hata |
 
Power eksi orantılı yöntem log loss farkının %95 aralığı -0,00396 ile -0,00077. Aynı 368 maçta ilk fiyat log loss 0,94455, kapanış 0,93475. Kapanış eksi ilk fiyat farkının aralığı -0,01986 ile 0,00115. Kapanış ve ilk fiyat arasındaki fark kanıtlanamadı. Güncel API karşılaştırması, alım anındaki son maç önü kaydını kullanır. Sağlayıcı, kaynak sayısı ve zaman farkı nedeniyle arşiv ölçümü canlı uçtaki hata ölçümü olarak kullanılmaz.

### Harman ve yayın kararı

Ağırlık her ayın başında önceki aylardaki ortak maçlardan öğrenildi. Seçim ölçütü, yayın modeline göre normalize edilmiş log loss ve RPS’nin ortalaması. Ağırlık adımı %5,00, asgari örneklem 80. Kapanış piyasası ağırlığı 2026-10 için %100,00 (182 geçmiş maç), 2026-11 için %100,00 (346 geçmiş maç). Bu pencerelerde kapanış harmanı piyasa modeline eşit çıktı.

| Model | Maç | Log loss | RPS | Brier | 1X2 isabeti [%95 GA] | Tutarlı tam skor [%95 GA] | İlk üç [%95 GA] |
|---|---:|---:|---:|---:|---|---|---|
| Yayın modeli | 186 | 0,94165 | 0,20449 | 0,55512 | 107/186 · %57,53 [%50,34 ile %64,41] | 23/186 · %12,37 [%8,38 ile %17,87] | 50/186 · %26,88 [%21,03 ile %33,67] |
| Harman · power | 186 | 0,90764 | 0,19337 | 0,53056 | 116/186 · %62,37 [%55,22 ile %69,01] | 24/186 · %12,90 [%8,83 ile %18,48] | 54/186 · %29,03 [%22,99 ile %35,93] |

Kapanış harmanı eksi yayın için %95 log loss farkı aralığı -0,06640 ile -0,00457. İlk fiyatla öğrenilen ağırlıkların ileri testinde 186 ortak maç, harman log loss 0,91485 ve RPS 0,19580. İlk fiyat harmanı eksi yayın için %95 log loss farkı aralığı -0,06000 ile 0,00392. **Varsayılan model değişmedi.** Sezon çoğunluğu için tek kısmi sezon var. Ayrıca sonuçlanmış bağımsız piyasa eşleştirmesi 0.

Kapsam raporunda 128 sonuç satırı için eşleşen kapanış fiyatı yok. Oranı olan 103 maçın önceki lig geçmişi takım başına asgari beş maç kuralını karşılamadı. 3 sağlayıcı satırı tarih ve yönlü ev/deplasman eşleşmesinden geçmedi. Karşılaştırılabilir örneklemin dışında kalan maçlar için piyasa sonucu hesaplanmadı. [Ham metrikler, güven aralıkları ve ağırlıklar](tests/phase2-results.json) · [Eksik ve çelişkili maçlar](tests/phase2-missing.json)

### Güncel kaynağı açma ve yeniden üretim

GitHub deposunda **Settings → Secrets and variables → Actions → New repository secret** altında `ODDS_API_KEY` ekle. Ardından **Actions → Market probability snapshot → Run workflow** ile ilk alımı başlat. Varsayılan kapsam Süper Lig. `ODDS_API_SCOPES` Actions değişkenine virgülle ayrılmış klasör kimlikleri konursa diğer beş lig de seçilebilir. Bir bölge, iki piyasa ve günde dört çalıştırma, Süper Lig için 31 günlük ayda en çok 248 planlı kredi. Altı lig aynı sıklıkta 1.488 planlı kredi kullanabilir. Sağlayıcı ücretsiz planda ayda 500 kredi, ücretli 20K planda aylık 30 USD ve tarihsel erişim listeliyor. [Fiyatlar](https://the-odds-api.com/#get-access) · [Kredi hesabı](https://the-odds-api.com/liveapi/guides/v4/#usage-quota-costs) · [Kullanım koşulları](https://the-odds-api.com/terms-and-conditions.html)

Tarayıcıya yalnızca türetilen 1X2 ve alt/üst olasılıkları, kaynak sayıları, zamanlar ve SHA-256 gider. Oran sağlayıcısının ham satırları, bahisçi adları, bağlantıları ve anahtar Actions işinin dışında kullanılmaz. Son maç önü kaydı 24 saatten eskiyse bölüm veri yetersiz gösterir. Maç saati ve ev/deplasman eşleşmesi zorunludur. Otomatik kayıt ilk dondurulan tahmini korur. Yeni bir oran daha sonra geldiğinde onu geçmişteki ilk tahmine eklemez.

[Faz 1 arşiv hazırlığı](#faz-1--ölçüm-altyapısı) ile aynı tarihsel maç dosyalarını kullan. [TipsAudit sabit CSV](https://raw.githubusercontent.com/tipsaudit/track-record-public/a34f89771caa7cb6462e3bc769c767afcff58aba/datasets/tipsaudit-predictions-all.csv) ve [sabit maç önü kayıt defteri](https://raw.githubusercontent.com/adws555434/gagagsaerhdse/d5a023c26ca4cf0aaaaa2fb94a21b2c80ab676c1/forecast-ledger.json) girdilerini indir.

```sh
node tests/phase2-market-test.cjs
node tests/phase2-backtest.cjs --self-test
node tests/phase2-backtest.cjs /veri/arsiv /veri/tips.csv /veri/faz-2 /veri/tff-results.json /veri/forecast-ledger.json
```

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


## Faz 2 · Güncel piyasa kararı ve ileriye dönük ölçüm

**Ana 1X2 kuralı çalışıyor.** Aynı ligde, aynı ev/deplasman eşleşmesinde ve aynı UTC başlama saatinde geçerli piyasa fiyatı varsa ana 1X2 ve en yüksek olasılıklı sonuç marjı power yöntemiyle çıkarılmış piyasa uzlaşısından gelir. Fiyat veya fikstür doğrulanamazsa yayın modeli kullanılır. Alım ve sağlayıcı fiyat saatleri gösterilir. Yayın modeli karşılaştırma için görünür. Skor önceliği yayın modelinde kalır ve skoru hangi modelin verdiği ayrıca yazılır. Bu durumda piyasanın öngördüğü kazanan ile yayın skorunun kazananı farklı olabilir.

**Kararın tarihsel dayanağı.** Tek kısmi sezonda, aynı 368 Pinnacle kapanış maçında, piyasa eksi yayın modeli log loss farkı -0,03108 ve eşleştirilmiş %95 aralık [-0,05178, -0,00947]. Aralık sıfırı kapsamıyor. 186 doğrulanmış erken fiyatlı maçta erken harmanın yayın modeline göre log loss fark aralığı [-0,06000, 0,00392] ve sıfırı kapsıyor. Yeni güncel akışta erken fiyat üstünlüğü henüz kanıtlanmadı. Çok sezonlu doğrulama çalıştırılmadı. Kapanış sonucu güncel sağlayıcının farklı saatlerdeki fiyatlarına genellenmedi. Football-Data.co.uk açık izin gelene kadar kapalıdır.

**Piyasa skoru kısmi.** GitHub Actions tek API isteğinde 1X2 ve alt/üstü alır. Tam 2,5 hattı ve aynı alımda geçerli 1X2 bulunduğunda skor matrisi iki piyasayı aynı anda karşılayacak şekilde normalleştirilir. Beklenen toplam gol ve ev sahibi eksi deplasman gol farkı bu matristen hesaplanır. Piyasa skoru bağımsız maç önü sonuçları birikene kadar test edilmedi etiketiyle ayrı gösterilir. Piyasa 1X2 tek başına bulunduğunda karşılaştırma skorları yayın modelinin sonuç içi gol dağılımı ile birleştirilir.

**Kayıt ve puanlama çalışıyor.** Yayın tahmini ile ilk uygun piyasa ve ilk uygun piyasa skoru ayrı ayrı maç öncesinde dondurulur. 1X2 ile 2,5 üst verisi farklı zamanda ilk kez uygun olursa iki alım ve kayıt saati ayrı saklanır. Her tahminin kaynak SHA-256 özeti ve sürümü saklanır. Otomatik kayıt analitiktir ve simülasyon sayısı 0. Sonuçlar 1X2, tutarlı tam skor ve ilk üç skor (Wilson %95), log loss, RPS ve güven kademesi kapsam/isabetiyle puanlanır. Eşleşmiş üçlü ortak örneklem ayrı verilir. 200 maçta ilk rapor dondurulur. 500 maçta ilk dönemde log loss ve RPS ile harman ağırlıkları öğrenilir, sonraki UTC günleri ayrılmış testte ölçülür. Lig başına küçük eğitim grubunda havuz ağırlığı kullanılır. Varsayılan tam skor ancak sonraki dönemde piyasa skoru eksi yayın skoru log loss farkının haftalık bloklarla eşleştirilmiş %95 aralığının tamamı sıfırın altındaysa değişir. Harman ağırlığı ana 1X2 kararını otomatik değiştirmez. Testte yeterli hafta yoksa varsayılan korunur.

**Gerçek veri durumu.** Yayın akışında 7/7 kapsamdan maç sonuç kaynağı yanıt verdi. 18 donmuş maç önü kaydı var. Sonuçlanmış yayın kaydı 0, piyasa kaydı 0, üçlü kaydı 0. Güncel API yayını `unconfigured`. Gerçek anahtarla API testi ve canlı ileriye dönük iş sonuçları çalıştırılmadı. 200 ve 500 eşiği sentetik veride sınandı. Bu testteki isabet gerçek maç başarısı değildir.

**Ücretsiz kota.** The Odds API ücretsiz paketi aylık 500 kredi, tek bölge ve iki piyasa istek başına iki kredi tüketir. Aşağıda yeniden çalıştırılabilir `node scripts/market-snapshot.cjs --quota` çıktısındaki 31 günlük üst sınırlar var. Planlanan sıklık lig sayısına göre düşer. GitHub Actions gecikebilir. Elle çalıştırmalar ve aynı anahtarın başka uygulamalardaki kullanımı tabloya dahil değildir. Sağlayıcının kalan kredi başlığında yeterli bakiye görünmediğinde ek lig isteği atlanır. API anahtarı GitHub Actions `ODDS_API_KEY` secret'ından okunur. Tarihsel ücretli akış tetiklenmedi ve ham oranlar tarayıcıya gönderilmez.

| Lig sayısı | Lig başına günlük alım | Günlük HTTP isteği | Günlük kredi | 31 günlük kredi |
| --- | ---: | ---: | ---: | ---: |
| 1 | 4 | 4 | 8 | 248 |
| 2 | 4 | 8 | 16 | 496 |
| 3 | 2 | 6 | 12 | 372 |
| 4 | 2 | 8 | 16 | 496 |
| 5 | 1 | 5 | 10 | 310 |
| 6 | 1 | 6 | 12 | 372 |

[Sağlayıcının fiyatlandırması](https://the-odds-api.com/#pricing) · [Kota ve piyasalar](https://the-odds-api.com/liveapi/guides/v4/)

## Süper Lig · Kesin Tahmin olay simülasyonu

Kesin Tahmin modu maç sonucunu ev sahibi galibiyeti, beraberlik ve deplasman galibiyetinin toplam sayılarından seçer. Kartta seçilen sonuca uyan en sık skor gösterilir. İlk üç skor bütün skorlar arasından sıralanır.

Takım modeli zaman ağırlıklı hücum ve savunma gücünü, ev sahibi avantajını, lig ortalamasına küçültmeyi ve Dixon–Coles düzeltmesini kullanır. Her takım için en az beş geçmiş maç gerekir. Aynı günün sonuçları gün içindeki tahminlere girmez. Güncel ve doğrulanmış 1X2 ile 2,5 alt/üst görüntüsü varsa takım ve piyasa gol beklentileri birleştirilir.

Simülasyonun her bloğu SHA-256 ile belirlenen girdiye bağlı ayrı bir tohum akışı kullanır. Paralel çalıştırma sırası sonucu değiştirmez. Her çıktı tam 100.000.000 kabul edilmiş maçtan oluşur ve analitik skor matrisiyle karşılaştırılır.

[9.924 maçlık ileri yürüyen ölçüm, gol ve kart etkileri, dönem bazında skor kalibrasyonu ve 200 tam simülasyon](EVENT_CALIBRATION.md)
