# xG ve ilk 11 ile %30 göreli isabet hedefi

Bu deneyde önceki denemedeki 414 ayar tekrarlanmadı. Beş ligde xG, arşivdeki ilk 11 ve bu ikisinin birleşimini kullanan 240 yeni ayar ölçüldü. İlk 11 bilgisinin yalnızca maç öncesi yayımlanma saati doğrulanmış hali canlı bir tahmin motoruna bağlanabilir. Bu tarihsel kaynak ilk 11'i içeriyor, ancak ilk 11'in ilan saatini içermiyor. Bu nedenle kadrolu sonuçlar tarihsel senaryo ölçümüdür.

| 2023/24–2025/26 · 4.457 maç | Ana model | xG ve ilk 11 adayı | Göreli artış | %30 hedefi |
|---|---:|---:|---:|---:|
| Maç sonucu isabeti | %51,31 (2.287) | %52,91 (2.358) | +%3,10 | %66,71 |
| Tam skor isabeti | %12,32 (549) | %12,65 (564) | +%2,73 | %16,01 |
| İlk üç skor isabeti | %31,52 (1.405) | %33,25 (1.482) | +%5,48 | %40,98 |

Maç sonucu log loss değeri 1,00124'ten 0,98386'ya, Brier skoru 0,59810'dan 0,58592'ye indi. Haftalık bloklarla yeniden örnekleme sonucunda %95 aralıkları, maç sonucu için +0,63 ila +2,63, tam skor için −0,49 ila +1,18 ve ilk üç skor için +0,70 ila +2,72 yüzde puan. Tam skor artışı bu aralıkta küçük bir düşüşle de uyumludur.

La Liga'da ana model 157 tam skor bilir, seçilen aday 148 bilir. Lig başına ayrı ayar seçen modelde bu sayı 152'dir. Lig başına ayarlar yalnızca doğrulama grubundan seçildi. Sezon, lig ve lig-sezon düzeylerinde gerilemeyen, ayrıca %30 artışa erişen aday yoktur. Süper Lig için eşleştirilebilir xG ve kadro kaydı bu arşivde bulunmadığından Türkiye'ye bir xG veya kadro iyileşmesi atfedilmedi. Ana tahmin yayındaki sürümüyle çalışmaya devam eder.

## Veri ve zaman sırası

Kaynak **openplay (Noah Bair), data-v0.1.0, CC BY 4.0**. Maç skoru, şut koordinatları ve başlangıç kadroları bu sürümden alındı. Kaynağın işaretlediği sorunlu maçlar xG ve ilk 11 geçmişine katılmadı. Ana motorun veri yeterliliğini sağlayan 18.615 maçtan, xG geçmişi ve kadro girdileri bulunan 11.954 maç aynı örneklemde eşleştirildi. Sezon başında ana tahminin veri yeterliliği koşulunu henüz karşılamayan maçlar bu sayılara dahil değildir.

Şuttan gole dönüşüm modeli 1 Temmuz 2018'den önce oynanan maçlardaki 179.398 penaltı dışı şut ve 2.123 penaltıyla eğitildi. Mesafe, görüş açısı, kafa vuruşu ve duran top alanları kullanıldı. Sonraki maçlarda şut olasılığı hesaplanırken o şutun gol sonucuna bakılmadı. Her maçın takım xG girdisi yalnızca önceki günlerin tamamlanmış maçlarından hesaplandı. Oyuncuya ilişkin girdiler, eski maçlardaki ilk 11 kayıtlarına ve xG farklarına dayalı, küçük örneklemde ortalamaya çekilen bir güç göstergesidir.

Maç tahmin katsayıları 4.417 maçta eğitildi, 3.080 maçta ayarlar karşılaştırıldı, ayrı 4.457 maçta sonuç ölçüldü. Bütün adaylar aynı 4.457 maça sahip. Sonuçlar kronolojik geriye dönük testtir. Canlı maç önü isabeti ayrıca, zaman damgalı yeni tahminlerle ölçülür.

[openplay sürümü ve veri lisansı](https://github.com/nlbair/openplay/releases/tag/data-v0.1.0) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) · [İlk 11 ve oyuncu dereceleri üzerine araştırma](https://ouci.dntb.gov.ua/en/works/4NeKygj7/)

## Yeniden çalıştırma

openplay sürümünden `matches.parquet`, `team_match_stats.parquet`, `lineups.parquet`, `data_issues.csv` ve `shots.parquet` dosyalarını bir klasöre indir. Veri dosyaları yayımlanan SHA-256 değerlerine göre doğrulanır. Python bağımlılıkları DuckDB 2.0.0, NumPy 2.3.5 ve SciPy 1.17.0.

```sh
OPENBLAS_NUM_THREADS=1 python tests/accuracy-xg/strict_xg.py /veri/klasoru > /tmp/football-xg-matches.json
node tests/accuracy-xg/features.cjs /tmp/football-xg-matches.json > /tmp/football-xg-features.json
OPENBLAS_NUM_THREADS=1 python tests/accuracy-xg/experiment.py /tmp/football-xg-features.json > /tmp/football-xg-results.json
```

[Ham sonuçlar, katsayılar ve lig-sezon ölçümleri](strict-results.json)
