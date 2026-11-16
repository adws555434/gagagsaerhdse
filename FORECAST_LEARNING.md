# Tahminlerin ölçümü ve öğrenen model

## Neden bazı değerler düştü?

Maç sonucu isabeti, ev sahibi galibiyeti, beraberlik ve deplasman galibiyeti arasındaki en yüksek olasılığı ölçer. Tam skor isabeti, skor tablosunun en yüksek olasılıklı tek hücresini ölçer. İlk üç skor ise üçüncü hücreye kadar olan sıralamayı ölçer. Örneğin gerçek skor 2–0 iken 1–0 tahmini, maç sonucu ölçüsünde doğru ve tam skor ölçüsünde yanlış sayılır. Yeni bir ağırlık bu ölçüleri farklı yönlerde hareket ettirebilir.

2026/27 sezon başındaki geriye dönük ölçümde 313 maçtan aynı 313'ü kullanıldı. Aşağıdaki adaylar yalnızca maçın gününden önceki sonuçları ve isabetli şutları görür. Her adayda şut ve gol tabanlı gol beklentileri sabit ağırlıkla birleştirilir.

| İsabetli şut payı | Maç sonucu | Tam skor | İlk üç skor | Log loss |
|---:|---:|---:|---:|---:|
| %0 | 168/313 | 32/313 | 96/313 | 0,9611 |
| %15 | 170/313 | 33/313 | 91/313 | 0,9612 |
| %30 | 173/313 | 34/313 | 87/313 | 0,9626 |
| %50 | 173/313 | 28/313 | 87/313 | 0,9663 |

Bu testte üç isabet ölçüsünü birlikte karşılayan aday çıkmadı. İsabetli şut tahmini model panelinde deneme olarak gösterilir. 100 milyon simülasyonlu tahmin mevcut ana modelle hesaplanır. [Lig tablosu ve ham veriler](tests/shot-backtest-results.json)

## Hatalardan öğrenme

Başlama saatinden önce alınan 0, 15, 30 ve 50 yüzdelik şut adayları ayrı ayrı saklanır. Gerçek sonuç geldiğinde dört aday da aynı maçta değerlendirilir. Aynı maçın ortak ve tarayıcı kayıtları tek sayılır. Sonuçlanan maçlar lig ve tahmin sürümüyle filtrelenir. İlk tarih grubundan şut ağırlığı seçilir. Daha sonraki grupta maç sonucu, tam skor ve ilk üç skor isabetlerinin korunması ve log loss değerinin düşmesi gerekir. Brier skoru da artmamalıdır. Öğrenen kartın ağırlığı ilk grupta en az 30, ikinci grupta en az 20 uygun kayıt gerektirir. Bu doğrulama sonraki yeni maçlarda garanti vermez.

Ortak kayıtlar altı kulüp ligi ve erkek A milli takımlarında çalışır. İşlem günde dört kez planlanır. Milli fikstür, uygulamadaki kaynaklı UEFA Uluslar Ligi dosyasının kapsadığı maçlarla sınırlıdır. Açık maçın ilk tahmini korunur, sonuç farklı bir gün kaynakta göründüğünde kayda bağlanır. Fikstür kaynağı kesilirse eldeki sonuçlarla geçmiş tahminler yine puanlanır. Sonuç kaynaklarının tamamı kesilirse önceki arşiv korunur. Tahminler ve her kaynağın son durumu [ortak arşivden](https://github.com/adws555434/gagagsaerhdse/blob/main/forecast-ledger.json) okunur. Tarayıcıda ayrıca kullanıcının kendi geçmişi tutulur.

Aynı anda istenen aynı adres tek ağ isteği paylaşır. Kulüp ve milli maçları için iki bağlantı da başarısız olursa tarayıcı, varsa son geçerli kopyayı en fazla yedi gün kullanabilir. Verinin kaynağı ve kopyanın alınma saati ekranda gösterilir. Bu akışla açılan ilk tahminler başarı geçmişine girmez. Fikstür ve sonuç taşıma durumları ayrı hesaplanır.

## İlk 11, oyuncu formu ve xG dosyası

Analizden sonra **Kadro senaryosu → Kaynaklı ilk 11, oyuncu formu ve xG yükle** bölümünden JSON dosyası seçilir. Dosya tarayıcıda okunur. Aşağıdaki örnek yalnızca alan biçimini gösterir. Kendi dosyanda doğrulanmış veriyi ve kullanılmasına izin verilen kaynağın HTTPS bağlantısını kullan. Zaman damgası saat dilimi içermeli. Boş istatistikler için kayıt ekleme veya isteğe bağlı asist alanını boş bırak. Uygulama bağlantının türünü ve zaman tutarlılığını kontrol eder. Verilen değerlerin URL'deki kaynaktan geldiğini otomatik doğrulamaz.

```json
{
  "xg": [
    {
      "team": "Beşiktaş",
      "opponent": "Galatasaray",
      "date": "2026-11-12",
      "publishedAt": "2026-11-12T22:00:00+03:00",
      "source": "https://example.com/match",
      "xg": 1.3,
      "xga": 0.8
    }
  ],
  "players": [
    {
      "team": "Beşiktaş",
      "opponent": "Galatasaray",
      "player": "Örnek Oyuncu",
      "date": "2026-11-12",
      "publishedAt": "2026-11-12T22:00:00+03:00",
      "source": "https://example.com/match",
      "minutes": 78,
      "goals": 1,
      "assists": 0
    }
  ],
  "lineups": [
    {
      "team": "Beşiktaş",
      "opponent": "Galatasaray",
      "date": "2026-11-16",
      "kickoff": "2026-11-16T20:00:00+03:00",
      "publishedAt": "2026-11-16T19:00:00+03:00",
      "source": "https://example.com/lineups",
      "starters": ["O1", "O2", "O3", "O4", "O5", "O6", "O7", "O8", "O9", "O10", "O11"],
      "attackChange": -5
    }
  ]
}
```

İlk 11, uygulamanın bulduğu fikstür saatiyle eşleşir ve başlama saatinden önce yayımlanmış olmalıdır. `attackChange` isteğe bağlı bir senaryo varsayımıdır. xG senaryosu, iki takım için en az beşer maç varsa gösterilir. Oyuncu formu dosyada bulunan son beş ve on maç, toplam dakika, gol, asist ve 90 dakika başına üretimi gösterir. Resmî ilk 11, sakatlık, canlı kart ve güncel xG için otomatik kapsam mevcut ücretsiz veri sağlayıcısında bulunmuyor. StatsBomb açık arşivi seçili geçmiş maçları içerir ve ayrı kaynak koşullarına tabidir.

**İlk 11 deneyi ve kaynak arşivi** bölümünde üç Süper Lig maçı için iki takımın da 11 oyuncusu ve maçtan önceki yayın saati bulunur. Saatleri [arşiv dosyasındaki](lineup-samples.json) duyurulardan, başlama saatlerini sabit Süper Lig test verisinden ve bağımsız maç kayıtlarından kontrol ettik. Canlı anlatımlarda genel makale giriş saati yerine ilk 11 bölümünün saati kaydedildi. Geçmiş örnekler gözlem arşividir ve deney başarı oranına girmez.

Yeni bir maç için önce kadrolar açıklanmadan ana tahmin kaydedilir. Ardından iki takımın da `opponent` bilgisi, 11 oyuncusu ve kaynak zamanı dosyaya eklenip **Kadro denemesini kaydet** seçilir. Başlama saatinden önce yalnızca bir deney eklenebilir. Karşılaştırma, ilk tahminin gol beklentilerini sabitleyerek bunların değiştirilmemiş ve hücum etkisi uygulanmış Poisson dağılımlarını puanlar. Hücum etkisi kullanıcı varsayımıdır. Maç sonucu geldiğinde eşleşen iki tahmin için 1X2, tam skor, ilk üç skor, log loss ve Brier hesaplanır. Deney tarayıcıda tutulur ve ana tahminin algoritmasını değiştirmez.

Tek kırmızı kart senaryosunda eksik takımın gol hızı ×0,72, rakibinki ×1,20 kabul edilir. İki takımın da birer oyuncu eksik olduğu durumda iki gol hızı ×0,90 kabul edilir. Bu katsayılar senaryo girdileridir.

## Yeniden üretim

- `node tests/forecast-learning-test.cjs`
- `node tests/shot-backtest.cjs /dosya/klasoru` — altı CSV'yi [sabit kaynak listesinden](tests/balanced-model-data.json) al.
- `node scripts/forecast-ledger.cjs` — güncel sonuç ve fikstürle otomatik arşivi günceller.
