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
| 100.000 Monte Carlo, en olası skor, üç alternatif skor, 1X2 | İki takım için de organizasyonda en az beş geçmiş maç olduğunda çalışıyor. Aynı veriyle sonuç yeniden üretilebilir. |
| İlk gol | Sabit gol hızı varsayımıyla ev sahibi, deplasman ve golsüz maç olasılığı. |
| İlk 20 dakikada gol senaryosu | Dakika ve öne geçen takım seçilebilir. Kalan süre 100.000 kez simüle edilir. Gerçek maç akışı ve taktik değişiklikleri ayrı veri gerektirir. |
| Ligler | 13 ligde birer maç için skor simülasyonu doğrulandı. Üç UEFA kupasında veri geliyor, denetim günü beş maç eşiği sebebiyle skor üretilemedi. |
| Veri kalitesi ve kaynaklar | Sonuç, fikstür, seçili istatistik alanlarının doluluk oranı ve arşiv kapsamı görünür. |
| Oyuncu formu, sakatlık, ceza, kadro, dakika, gol/asist ve kart/hata riski | Açık ve yeterli maç öncesi oyuncu verisi henüz bağlı değil. Oyuncu özel hayatı ve sağlık bilgileri işlenmez. |
| xG, xA, PPDA, gelişmiş pas/baskı, taktik, antrenman, hava, saha, hakem, motivasyon ve takım içi uyum | Bu yayında kullanılmıyor. |
| İlk ve ikinci yarı tam skor dağılımı, gol dakikası riski, fiziksel ve taktik üstünlük, oyuncu değişikliği / kırmızı kart senaryoları | Henüz bağlı değil. |
| Canlı skor ve olaylar, sohbet, otomatik raporlar, geçmiş tahmin kaydı, kalibrasyon, kendini yeniden eğitme, Elo/Bayes/ML ensemble | Henüz bu sürümde yok. Geçmiş maç başarı testi çevrimdışı çalıştırıldı. |
| Ücretsiz çalışma, HTTPS ve dar ekran görünümü | Doğrulandı. Gerçek iPhone cihazı bu test kapsamına dahil değildi. |

## Geçmiş maç testi

2023/24–2025/26 arasında [openfootball](https://github.com/openfootball/football.json) arşivinin erişilebilir ve tamamlanmış sonuçları. Her lig ve sezon kendi içinde kronolojik ilerletildi. Her tahmin yalnızca o sezonun daha erken günlerindeki tamamlanmış maçları görür. Maç günü ve sonraki günlerin kayıtları, kadrolar ve oranlar modele verilmedi. İki takımın da en az beş geçmiş maçının bulunduğu eşleşmeler ölçüldü. Canlıdaki aynı Poisson fonksiyonu ve maç başına 100.000 simülasyon kullanıldı.

| Lig | Maç | Doğru sonuç 1X2 | Doğru tam skor | Basit lig geçmişi 1X2 |
|---|---:|---:|---:|---:|
| Süper Lig | 331 | 189 (%57,10) | 36 (%10,88) | %49,24 |
| Premier League | 957 | 502 (%52,46) | 95 (%9,93) | %44,20 |
| La Liga | 963 | 487 (%50,57) | 128 (%13,29) | %46,31 |
| Bundesliga | 769 | 394 (%51,24) | 67 (%8,71) | %41,61 |
| Serie A | 940 | 501 (%53,30) | 126 (%13,40) | %41,38 |
| Ligue 1 | 759 | 384 (%50,59) | 75 (%9,88) | %43,74 |
| Toplam | 4.719 | 2.457 (%52,07) | 527 (%11,17) | %43,93 |

- Sonuç isabeti en yüksek olasılıklı ev sahibi/beraberlik/deplasman seçeneğinin gerçek sonuçla eşleşmesidir. Tam skor isabeti en yüksek olasılıklı skorun birebir eşleşmesidir.
- Log loss modelde **1,003**, basit lig geçmişinde **1,072**. Üç sınıfın toplam kare hatasıyla hesaplanan Brier skoru **0,598** ve **0,648**. İki ölçütte düşük değer daha iyi.
- Basit karşılaştırma yalnızca o güne kadar aynı lig/sezonun 1X2 sıklığını kullanır. Üç seçeneğe birer başlangıç sayımı eklenir. Piyasa oranlarına veya başka profesyonel modellere karşı karşılaştırma yapılmadı.
- Süper Lig arşivi 2023/24 için erişilemedi. 2024/25 için 338/342, 2025/26 için 90/306 sonuç kullanılabilir durumdaydı. Diğer sezonlarda da skor kaydı eksikliği görülebilir. Bu örneklem sonuçlarını tüm maçlara genellemek için ek sezonlar ve bağımsız bir değerlendirme gerekir.

## Uygulama doğrulaması

- Firefox ve WebKit'te 32 otomatik senaryo. Motor açılışı, iki takım girişi, boş giriş, aynı takım, bilinmeyen takım, Türkçe karakter ve kısaltma, 320 px görünüm, tekrar üretim, önceki maç arşivi, çift kayıt ve ileri tarih filtresi, bozuk kaynak yedeği, eksik fikstür, yetersiz örneklem, internet kesilmesi, gol senaryosu, tarayıcı JavaScript hataları.
- Canlı veriyle 16 organizasyon kontrolü. 13'ünde skor simülasyonu, üçünde veri yetersizliği davranışı doğrulandı.
- Canlı dağıtımın kimliği ve özel 404 sayfasındaki ana sayfa bağlantısı kontrol edildi.

## Veri ve gizlilik

Güncel maç sonuçları ve fikstür için [open-matchday](https://github.com/oladeeayo/open-matchday), geçmiş skorlar için [openfootball](https://github.com/openfootball/football.json). Veriler tarayıcıdan HTTPS ile okunur. Takım girişleri sağlayıcıya özel bir sorgu olarak gönderilmez. API anahtarı, kullanıcı hesabı veya oyuncu özel hayatı verisi kullanılmaz. Kaynak kapsamı ve kullanım şartları sağlayıcıya bağlıdır. Oyuncu sağlık verisi işlenmesi GDPR Madde 9 kapsamında özel nitelikli veri değerlendirmesi ve Avusturya'daki DSG § 1 dahil olmak üzere ayrıca hukuki değerlendirme gerektirir.

- [GDPR, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
- [Avusturya DSG](https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10001597)
