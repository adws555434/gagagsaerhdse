# Süper Lig tahmin deneyi

2024/25, 2025/26 ve 2026/27 başındaki 606 maçta ana model ile doğrulama aşamasında seçilen aday karşılaştırıldı. 752 ayarın hiçbiri bu testte maç sonucu, tam skor veya ilk üç skor için tek başına %30 göreli artışı yakalayamadı. Ana tahmin önceki sürümüyle çalışır.

| Ölçüm | Ana model | Seçili aday | %30 göreli hedef için gereken isabet |
|---|---:|---:|---:|
| Kazanan veya beraberlik | 332/606 | 331/606 | 432 |
| Tam skor | 70/606 | 71/606 | 91 |
| İlk üç skor | 195/606 | 204/606 | 254 |

Olasılık hatası düştü. Log loss 0,9769'dan 0,9709'a, Brier skoru 0,5792'den 0,5754'e indi. Seçili aday 2024/25 grubunda iki maç sonucu ve bir tam skor daha az bildi. 2026/27 başında ise ilk üç skor isabeti 15'ten 12'ye düştü. Tek bir toplam puan bu gerilemeleri gizleyebileceği için yayındaki ana model değiştirilmedi.

## Kaynaklar ve zaman sırası

- James P. Curley'nin [engsoccerdata](https://github.com/jalapic/engsoccerdata) kaynağındaki üst lig sonuçları 2024/25 sonuna kadar kullanıldı. Kaynak, ticari olmayan kullanım için yayımlanıyor.
- [TFF'nin 2025/26 fikstürü](https://www.tff.org/default.aspx?pageID=1768) ve 34 haftalık ayrıntı sayfalarından 306 maçın skoru ve oynanma tarihi kontrol edildi. 18 takımın her biri 17 iç saha ve 17 deplasman maçıyla temsil edildi. Bunların 99'u eski openfootball kaydıyla aynı tarih, takım ve skorla eşleşti.
- 2026/27 sezon başı için [open-matchday](https://github.com/oladeeayo/open-matchday) anlık veri kopyası kullanıldı. 99 maç sonucunun 54'ünde ana modelin asgari maç şartı sağlandı.
- Eski engsoccerdata ve openfootball kopyalarının eşleşen 1.188 kaydında tek skor uyuşmazlığı bulundu. Bu maç eğitim dönemindedir. Tek sezon içinde kaynaklar birleştirilmedi.
- TFF'nin [Galatasaray–Beşiktaş resmî maç raporu](https://www.tff.org/Default.aspx?macId=283623&pageID=528) ilk 11'i gösteriyor. Kadronun maç öncesinde ne zaman yayımlandığını belgelemiyor. İlk 11 ve şut bazlı xG bu deneyde kullanılmadı. [Sportmonks](https://www.sportmonks.com/faq/) ücretli Süper Lig paketlerinde xG ve geçmiş veri sunuyor. Ücretsiz, sürekli ve programatik kullanım izni doğrulanmış eşdeğer bir kaynak bu araştırmada bulunamadı.

## Deney

2012/13–2021/22 arası 2.782 maçta katsayılar eğitildi. 2022/23–2023/24 arasındaki 619 maçta aday seçildi. 2024/25 ve sonrası 606 maç bu turda seçim için kullanılmadı. Bazı maçlar önceki projenin değerlendirmelerinde yer aldı. Her maç tahmini yalnızca o günden önce oynanan maçları gördü. Tarih sırası eski sezonların da maç gününe göre filtrelenmesiyle sağlandı. Geçmiş gol oranı, takım gücü, Elo, dinlenme, maç yoğunluğu, düşük skor düzeltmesi, ortak gol bileşeni ve negatif binom ayarları denendi.

[Ham sonuçlar ve maç sayıları](results.json) · [Sabit veri kaynağı listesi](sources.json)

## Yeniden üretim

Sabit kaynak listesindeki dosyaları bir klasöre indir. TFF için ayrıca 1–34 haftalarının sayfalarını aşağıdaki URL biçimiyle `haftalar/1.html` … `haftalar/34.html` olarak kaydet. Kaynak HTML ve maç satırları bu depoda barındırılmaz. Doğrulama, sayfaların maç alanlarından elde edilen dosyanın SHA-256 değerini kontrol eder.

- `https://www.tff.org/Default.aspx?hafta=1&pageID=1768`
- `python tests/super-lig-research/tff-fixtures.py /veri/haftalar > /veri/tff-results.json`
- `node tests/super-lig-research/features.cjs /veri > /tmp/super-lig-features.json`
- `OPENBLAS_NUM_THREADS=1 python tests/super-lig-research/experiment.py /tmp/super-lig-features.json > /tmp/super-lig-results.json`

Python bağımlılıkları NumPy 2.3.5 ve SciPy 1.17.0.
