# Süper Lig · ek şut verisi deneyi

2025/26'da TFF'nin 306 maçından 279'u, veri arşiviyle İstanbul yerel tarihi, ev sahibi, deplasman ve tam skor üzerinden bire bir eşleşti. Bu 279 maçın tümünde iki takımın isabetli şut sayısı, 273'ünde ceza sahası içi şut ve bölge tabanlı gol tahmini, 268'inde iki takımın dizilişi mevcut. Sezon sıralarıyla diğer yılların kapsaması [sonuç dosyasında](results.json) gösterilir.

Ham kaynağın tek başına lig koduna güvenilmedi. Belirsiz, eşleşmeyen veya geçersiz zaman damgalı satırlar atlandı. Kaynağın xG alanı, şut bölgelerinden türetilen yaklaşık gol beklentisidir. Şut başına konum ve açı bilgisiyle hesaplanan xG seviyesinde ayrıntı sağlamaz. Diziliş tablosunda kadronun halka açık ilk duyuru saati bulunmadığı için güncel kadrolar tahmin girdisi olarak kullanılmadı. Kaynak, istatistik için başlama saati artı 105 dakikayı `known_at` olarak belgeliyor. Bu alan yayının gerçek zaman damgasını doğrulamaz.

## Aynı 606 maçta sonuç

| Ölçüm | Ana model | Seçilen şut adayı |
|---|---:|---:|
| Kazanan veya beraberlik | 332/606 | 336/606 |
| Tam skor | 70/606 | 74/606 |
| İlk üç skor | 195/606 | 200/606 |
| Maç sonucu log loss | 0,97688 | 0,96559 |
| Brier | 0,57918 | 0,57336 |

2016/17–2021/22 dönemindeki 1.738 maçta katsayılar öğrenildi. 2022/23–2023/24 arasındaki 619 maçta 150 ayar karşılaştırıldı. 2024/25–2026/27 başındaki 606 maç, bu deneyde aday seçimi için kullanılmadı. Bunlar önceki turda da ölçülen maçlardır. 492 maçta yeni sinyal için yeterli geçmiş vardı. Uygun verisi olmayan maçta ana model kullanıldı. Maç günü ve sonrasındaki şut istatistikleri hesap dışı bırakıldı.

Yalnızca ceza sahası içi şut verisi verilen aday, toplamda ilk üç skor isabetini 195'ten 207'ye çıkardı. Seçili birleşik aday 2026/27 başında 3 yerine 1 tam skor, 15 yerine 14 ilk üç skor bildi. Bütün sezonlarda üç isabet türünü ve iki olasılık hata ölçüsünü koruyan seçili aday bulunmadı. 150 ayarın hiçbiri son test toplamında üç isabet ölçüsünü %30 göreli artırmadı. Haftalık bloklarla %95 belirsizlik aralıkları üç isabet artışı için sıfırı içeriyor. Ana tahmin bu sonuçlar üzerine değiştirilmedi.

## Kaynak ve yeniden üretim

- TFF maçları ve ana model için [Süper Lig deneyinin kaynak listesi](../super-lig-research/README.md).
- Şut verisi, [eatpizzanot/soccer-dataset](https://huggingface.co/datasets/eatpizzanot/soccer-dataset/tree/f0cbe86bee3f28cc4b803f735a5287968741c471) anlık kopyası. Arşiv yayımlayıcısı CC BY 4.0 belirtiyor. Türetilen araştırmanın kaynakları API-Football ve football-data.co.uk. [API-Football](https://www.api-football.com/terms) kendi kullanım açıklamasında yayın haklarının ayrı olabileceğini belirtiyor. Bu depoya toplu ham istatistik veya kadro eklenmedi.
- [Cornerflick](https://cornerflick.com/data) 2026/27 için maç sonu ilk 11 ve istatistik dosyaları yayımlıyor. Örnek maç dosyasının güncelleme saati maç sonrasına ait. Bu arşiv bu deneyde kullanılmadı.

Bağımlılıklar DuckDB 2.0.0, NumPy 2.3.5, SciPy 1.17.0. Sabit Hugging Face kopyasından `fixtures.parquet`, `match_stats.parquet`, `teams.parquet` ve `fixture_lineups.parquet` dosyalarını indir. Kod dört dosyanın SHA-256 değerlerini doğrular.

```sh
python tests/super-lig-data/extract.py /veri/parquet > /tmp/super-lig-stats.json
node tests/super-lig-research/features.cjs /veri/super-lig > /veri/super-lig/features.json
node tests/super-lig-data/assemble.cjs /veri/super-lig /tmp/super-lig-stats.json > /tmp/super-lig-assembled.json
OPENBLAS_NUM_THREADS=1 python tests/super-lig-data/evaluate.py /tmp/super-lig-assembled.json /veri/super-lig/features.json > /tmp/super-lig-stats-results.json
```

İlk 11 katkısının maç öncesi ölçümü için saklanacak asgari alanlar maç kimliği, takım, 11 oyuncu, kaynak bağlantısı, gerçek gözlem saati, başlama saati ve model sürümüdür. Mevcut kadro yükleme biçimi için [uygulama belgesi](../../FORECAST_LEARNING.md).
