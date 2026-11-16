# %30 göreli isabet artışı deneyi

## Sonuç

414 ayar denendi. Son testte yeni modeller %30 göreli artış hedefini üç isabet ölçüsünün hiçbirinde karşılamadı. Doğrulama döneminde en düşük maç sonucu log loss değerini veren aday, testte altı ligin toplamında 42 maç sonucu, 27 tam skor ve 56 ilk üç skor daha bildi. Aynı aday Süper Lig test grubunda 1 maç sonucu daha bildi, 4 tam skor ve 15 ilk üç skor isabeti kaybetti. Varsayılan tahmin için bu aday seçilmedi.

| 2024/25–2026/27 başı · 3.656 maç | Ana model | Dengeli model | En düşük doğrulama log loss adayının testi | Göreli artış | %30 hedefi |
|---|---:|---:|---:|---:|---:|
| Maç sonucu isabeti | %51,64 | %52,63 | %52,79 | +%2,22 | %67,13 |
| Tam skor isabeti | %11,54 | %11,68 | %12,28 | +%6,40 | %15,01 |
| İlk üç skor isabeti | %31,15 | %32,58 | %32,69 | +%4,92 | %40,50 |

Adayın maç sonucu log loss değeri 0,9995'ten 0,9846'ya, Brier skoru 0,5965'ten 0,5862'ye indi. Haftaları blok olarak yeniden örnekleyen %95 aralıkları, ana modele göre maç sonucu için +0,22 ila +2,16, tam skor için −0,23 ila +1,68 ve ilk üç skor için +0,74 ila +2,39 yüzde puan. Tam skor artışı bu örneklemde belirsiz.

| Süper Lig · 395 maç | Ana model | En düşük log loss adayı |
|---|---:|---:|
| Maç sonucu isabeti | 223/395 | 224/395 |
| Tam skor isabeti | 45/395 | 41/395 |
| İlk üç skor isabeti | 135/395 | 120/395 |

2026/27 başındaki 313 maçta aynı aday 187 maç sonucu, 32 tam skor ve 97 ilk üç skor bildi. Ana model 168, 32 ve 96 isabet elde etti. Sonuç isabeti bu dönemde göreli %11,31 arttı. 313 maçın 54'ü Süper Lig'e ait.

## Tahmin güveni ve kapsama

En düşük doğrulama log loss değerini veren adayda, en yüksek maç sonucu olasılığı %60 ve üzeri olan 786 maçta sonuç isabeti %72,52. Bu grup, 3.656 maçın %21,50'sini kapsıyor. Aynı grubun tam skor ve ilk üç skor isabeti %12,47 ve %32,44. Bu ölçüm, tahmin güvenine göre seçilen bir alt grubun geriye dönük sonucudur.

## Yöntem

- 2016/17–2022/23 sezonları katsayı eğitimi için kullanıldı. 2023/24 sezonu ayar ve aday seçimine ayrıldı. 2024/25–2026/27 başı bu araştırmanın son testi olarak tutuldu. Test sezonlarının bazıları projenin önceki çalışmalarında kullanılmıştı.
- Altı ligde her maç için aynı gün ve sonrasındaki sonuçlar dışarıda bırakıldı. Tahmin karşılaştırması, ana modelin asgari geçmiş şartını sağlayan eşleşmelerde yapıldı. Bazı lig ve sezon arşivleri kısmi.
- 402 genel ayar test edildi. Bunlara farklı zaman ağırlıkları, Dixon–Coles düşük skor düzeltmesi, ortak gol bileşenli Poisson, negatif binom ve puan farkı, maç yoğunluğu, dinlenme süresi kullanan gol modeli dahil. Ayrıca lig ve iç saha etkisini ayrı öğrenen 12 ayar test edildi. Şut ağırlığı %15 olan önceki model de referans olarak ölçüldü.
- İki genel aday, doğrulama dönemindeki sonuçlarına göre seçildi. Biri ana modeli beş ölçüde yakalayan adaylar arasından birleşik ölçüte göre, diğeri en düşük maç sonucu log loss değerine göre. Son testte her ikisinin performansı raporlandı. Katsayılar son test sonuçlarına göre yeniden ayarlanmadı.
- Doğrulama döneminde şut kapsaması bulunmadığından, şut ağırlığı farklı dönemlerde seçilen yeni adaylara eklenmedi. Kadro ve xG dahil edilmedi.
- Skor dağılımı araştırmada 0–19 aralığında hesaplandı, toplam olasılık 1'e ölçeklendi. Yayındaki Dengeli model için 0–9 hücreleri doğrudan mevcut JavaScript motorundan alındı. Daha yüksek skor kuyruğu ana model kullanılarak tamamlandı. Testte ana modelin üç isabet sayısı önceki denetimle eşleşti.

Yöntem kaynakları arasında [Dixon–Coles](https://doi.org/10.1111/1467-9876.00065), [Karlis–Ntzoufras](https://doi.org/10.1111/1467-9884.00366) ve [Penn–Donnelly](https://pmc.ncbi.nlm.nih.gov/articles/PMC9119507/) var.

## Yeniden çalıştırma

Veri dosyalarını [sabit kaynak listesindeki](../balanced-model-data.json) URL'lerden bir klasöre indir ve bağımlılık olarak NumPy 2.3.5 ile SciPy 1.17.0 kur. İlk komut kaynak dosyalarının SHA-256 değerlerini kontrol eder.

```sh
node tests/accuracy-research/features.cjs /veri/klasoru > /tmp/football-features.json
OPENBLAS_NUM_THREADS=1 python tests/accuracy-research/scan.py /tmp/football-features.json > /tmp/football-results.json
```

[Ham ölçümler ve seçilen adayların katsayıları](results.json)
