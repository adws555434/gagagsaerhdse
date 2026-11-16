# Kesin Tahmin · Süper Lig geçmiş testi

Arşiv 1994-08-13–2026-11-08 arasındaki 10.191 maçı kapsıyor. 267 maçta iki takımın da beş geçmiş maç koşulu sağlanamadı. Kalan 9.924 maç kronolojik olarak, aynı günün sonuçları dahil edilmeden ölçüldü. Maç sonucu, üç sonuç sınıfının toplam olasılığından seçilir. Kart skoru, seçilen sonuçla uyumlu skorların en sık çıkanıdır. İlk üç skor bütün skorlar arasından sıralanır.

## Karar kuralı

| Ölçüm | Doğru / maç | İsabet | %95 güven aralığı |
| :--- | :--- | :--- | :--- |
| Kazanan veya beraberlik | 5.285/9.924 | %53,25 | %52,27 – %54,23 |
| Kazananla uyumlu tek skor | 1.098/9.924 | %11,06 | %10,46 – %11,70 |
| Genel en sık skor | 1.193/9.924 | %12,02 | %11,40 – %12,68 |
| İlk üç skor | 3.230/9.924 | %32,55 | %31,63 – %33,48 |

## Olay etkileri ve skor düzeltmesi

Olay arşivindeki 5.223 maçtan 4.352 maç gol akışı ve final skor tutarlılığı kontrolünü geçti. 4.237 maç tarih, takımlar ve skorla model arşivine eşleşti. Öğrenilen katsayılar 5.119 test maçında uygulanabildi. İlk 100 eşleşmiş olay maçı tamamlanana kadar mevcut olay katsayıları kullanıldı. Her ayın katsayıları yalnızca önceki ayların verisiyle, maç önü gol beklentisi ofsetli Poisson modeliyle tahmin edildi. Uzatma dakikaları yarı içindeki göreli zamana çevrildi. Yapısal olarak her takımdaki ilk kırmızı kart temsil edildi.

Düzeltme adayı, beraberlik skorlarının ve 0–1 ya da 5+ toplam gollü uçların olasılığını çarpanlarla ayarlar. Çarpanlar geçmiş günlerde en düşük tam skor log loss değerini veren ayardan seçildi. Piyasa oranlı tarihsel yeniden test çalıştırılmadı.

### Tüm dönemler · 9.924 maç

| Model | Tam skor log loss | Log loss farkı ve %95 aralık | İlk üç doğru / maç | İlk üç isabeti ve %95 aralık | İlk üç farkı ve %95 aralık |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Varsayılan olay etkileri | 2,95910 | — | 3.230/9.924 | %32,55 · %31,63 – %33,48 | — |
| Olay etkileri kapalı | 2,95736 | -0,00174 · -0,00351 – +0,00011 | 3.200/9.924 | %32,25 · %31,33 – %33,17 | -0,30 puan · -0,71 puan – +0,13 puan |
| Arşivden öğrenilen olay etkileri | 2,95959 | +0,00048 · -0,00112 – +0,00195 | 3.223/9.924 | %32,48 · %31,56 – %33,40 | -0,07 puan · -0,34 puan – +0,18 puan |
| Beraberlik ve gol dağılımı düzeltmesi | 2,95708 | -0,00202 · -0,00381 – -0,00022 | 3.255/9.924 | %32,80 · %31,88 – %33,73 | +0,25 puan · -0,24 puan – +0,72 puan |

İlk üç skorun ortalama olasılığı **%33,32** (eşleştirilmiş haftalık örnekleme ile %95 aralık %33,23 – %33,40). Gerçek isabet **%32,55** (%95 aralık %31,63 – %33,48). Gerçek isabet eksi model beklentisi için eşleştirilmiş %95 aralık -1,75 puan – +0,17 puan.

| İlk üç skorun toplam ihtimali | Doğru / maç | Gerçek isabet | %95 aralık |
| :--- | :--- | :--- | :--- |
| <30% | 319/1.176 | %27,13 | %24,66 – %29,74 |
| 30–<35% | 2.080/6.244 | %33,31 | %32,15 – %34,49 |
| 35–<40% | 694/2.123 | %32,69 | %30,73 – %34,71 |
| ≥40% | 137/381 | %35,96 | %31,30 – %40,89 |

| Skor | Model | Gerçek | Fark (gerçek − model) | Düzeltme adayı | Adayın farkı |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 0–0 | %7,72 | %7,83 | +0,11 puan | %7,35 | +0,48 puan |
| 0–1 | %6,62 | %6,63 | +0,01 puan | %7,34 | -0,71 puan |
| 0–2 | %4,33 | %4,01 | -0,31 puan | %4,32 | -0,31 puan |
| 0–3 | %1,79 | %2,05 | +0,25 puan | %1,79 | +0,26 puan |
| 0–4 | %0,60 | %0,79 | +0,19 puan | %0,60 | +0,19 puan |
| 1–0 | %8,96 | %9,64 | +0,68 puan | %9,92 | -0,28 puan |
| 1–1 | %13,07 | %11,20 | -1,88 puan | %11,25 | -0,05 puan |
| 1–2 | %6,85 | %6,68 | -0,17 puan | %6,85 | -0,17 puan |
| 1–3 | %2,66 | %2,79 | +0,13 puan | %2,66 | +0,13 puan |
| 1–4 | %0,85 | %0,83 | -0,02 puan | %0,94 | -0,11 puan |
| 2–0 | %7,33 | %7,54 | +0,21 puan | %7,31 | +0,22 puan |
| 2–1 | %8,96 | %9,48 | +0,52 puan | %8,94 | +0,54 puan |
| 2–2 | %5,64 | %4,72 | -0,92 puan | %4,85 | -0,14 puan |
| 2–3 | %2,19 | %2,13 | -0,07 puan | %2,43 | -0,30 puan |
| 2–4 | %0,65 | %0,67 | +0,01 puan | %0,72 | -0,06 puan |
| 3–0 | %3,91 | %4,22 | +0,31 puan | %3,90 | +0,33 puan |
| 3–1 | %4,50 | %4,60 | +0,11 puan | %4,49 | +0,12 puan |
| 3–2 | %2,86 | %2,76 | -0,10 puan | %3,16 | -0,40 puan |
| 3–3 | %1,24 | %0,98 | -0,26 puan | %1,18 | -0,20 puan |
| 3–4 | %0,37 | %0,34 | -0,03 puan | %0,41 | -0,07 puan |
| 4–0 | %1,69 | %1,69 | +0,01 puan | %1,68 | +0,01 puan |
| 4–1 | %1,84 | %2,10 | +0,26 puan | %2,03 | +0,07 puan |
| 4–2 | %1,10 | %1,37 | +0,27 puan | %1,21 | +0,16 puan |
| 4–3 | %0,48 | %0,45 | -0,03 puan | %0,53 | -0,08 puan |
| 4–4 | %0,16 | %0,08 | -0,08 puan | %0,16 | -0,07 puan |

| Toplam gol | Model | Gerçek | Fark (gerçek − model) | Düzeltme adayı | Adayın farkı |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 0 | %7,72 | %7,83 | +0,11 puan | %7,35 | +0,48 puan |
| 1 | %15,58 | %16,27 | +0,69 puan | %17,26 | -0,99 puan |
| 2 | %24,73 | %22,74 | -1,99 puan | %22,89 | -0,15 puan |
| 3 | %21,51 | %22,43 | +0,92 puan | %21,48 | +0,95 puan |
| 4 | %15,09 | %14,59 | -0,50 puan | %14,28 | +0,31 puan |
| 5+ | %15,37 | %16,13 | +0,76 puan | %16,74 | -0,60 puan |

### 1994–2004 · 3.068 maç

| Model | Tam skor log loss | Log loss farkı ve %95 aralık | İlk üç doğru / maç | İlk üç isabeti ve %95 aralık | İlk üç farkı ve %95 aralık |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Varsayılan olay etkileri | 3,02716 | — | 994/3.068 | %32,40 · %30,77 – %34,08 | — |
| Olay etkileri kapalı | 3,02400 | -0,00316 · -0,00642 – +0,00030 | 991/3.068 | %32,30 · %30,67 – %33,98 | -0,10 puan · -0,92 puan – +0,75 puan |
| Arşivden öğrenilen olay etkileri | 3,02716 | 0,00000 · 0,00000 – 0,00000 | 994/3.068 | %32,40 · %30,77 – %34,08 | 0,00 puan · 0,00 puan – 0,00 puan |
| Beraberlik ve gol dağılımı düzeltmesi | 3,02446 | -0,00270 · -0,00566 – +0,00044 | 996/3.068 | %32,46 · %30,83 – %34,14 | +0,07 puan · -0,78 puan – +0,91 puan |

İlk üç skorun ortalama olasılığı **%32,50** (eşleştirilmiş haftalık örnekleme ile %95 aralık %32,36 – %32,64). Gerçek isabet **%32,40** (%95 aralık %30,77 – %34,08). Gerçek isabet eksi model beklentisi için eşleştirilmiş %95 aralık -1,63 puan – +1,59 puan.

| İlk üç skorun toplam ihtimali | Doğru / maç | Gerçek isabet | %95 aralık |
| :--- | :--- | :--- | :--- |
| <30% | 164/572 | %28,67 | %25,12 – %32,51 |
| 30–<35% | 652/1.949 | %33,45 | %31,39 – %35,58 |
| 35–<40% | 168/499 | %33,67 | %29,66 – %37,92 |
| ≥40% | 10/48 | %20,83 | %11,73 – %34,26 |

| Skor | Model | Gerçek | Fark (gerçek − model) | Düzeltme adayı | Adayın farkı |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 0–0 | %6,95 | %7,33 | +0,38 puan | %6,66 | +0,67 puan |
| 0–1 | %5,71 | %6,29 | +0,58 puan | %6,23 | +0,06 puan |
| 0–2 | %3,96 | %3,26 | -0,70 puan | %3,96 | -0,70 puan |
| 0–3 | %1,71 | %1,79 | +0,08 puan | %1,71 | +0,08 puan |
| 0–4 | %0,60 | %0,62 | +0,02 puan | %0,60 | +0,02 puan |
| 1–0 | %8,35 | %9,00 | +0,64 puan | %9,08 | -0,08 puan |
| 1–1 | %12,38 | %10,56 | -1,82 puan | %10,92 | -0,36 puan |
| 1–2 | %6,48 | %6,62 | +0,13 puan | %6,48 | +0,14 puan |
| 1–3 | %2,59 | %2,74 | +0,15 puan | %2,59 | +0,15 puan |
| 1–4 | %0,85 | %0,95 | +0,09 puan | %0,93 | +0,02 puan |
| 2–0 | %7,58 | %8,08 | +0,51 puan | %7,55 | +0,53 puan |
| 2–1 | %9,02 | %9,19 | +0,17 puan | %9,00 | +0,19 puan |
| 2–2 | %5,63 | %4,37 | -1,26 puan | %4,96 | -0,60 puan |
| 2–3 | %2,20 | %2,18 | -0,02 puan | %2,40 | -0,22 puan |
| 2–4 | %0,67 | %0,81 | +0,14 puan | %0,73 | +0,08 puan |
| 3–0 | %4,46 | %4,56 | +0,10 puan | %4,44 | +0,12 puan |
| 3–1 | %4,93 | %4,82 | -0,11 puan | %4,91 | -0,09 puan |
| 3–2 | %3,06 | %2,18 | -0,88 puan | %3,32 | -1,14 puan |
| 3–3 | %1,32 | %0,91 | -0,40 puan | %1,26 | -0,35 puan |
| 3–4 | %0,40 | %0,49 | +0,09 puan | %0,43 | +0,06 puan |
| 4–0 | %2,14 | %2,31 | +0,17 puan | %2,13 | +0,18 puan |
| 4–1 | %2,22 | %2,61 | +0,39 puan | %2,39 | +0,22 puan |
| 4–2 | %1,28 | %1,76 | +0,48 puan | %1,38 | +0,38 puan |
| 4–3 | %0,55 | %0,52 | -0,03 puan | %0,60 | -0,07 puan |
| 4–4 | %0,18 | %0,10 | -0,09 puan | %0,18 | -0,08 puan |

| Toplam gol | Model | Gerçek | Fark (gerçek − model) | Düzeltme adayı | Adayın farkı |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 0 | %6,95 | %7,33 | +0,38 puan | %6,66 | +0,67 puan |
| 1 | %14,06 | %15,29 | +1,23 puan | %15,31 | -0,02 puan |
| 2 | %23,92 | %21,90 | -2,01 puan | %22,44 | -0,54 puan |
| 3 | %21,68 | %22,16 | +0,48 puan | %21,64 | +0,53 puan |
| 4 | %15,89 | %14,86 | -1,02 puan | %15,19 | -0,33 puan |
| 5+ | %17,50 | %18,45 | +0,95 puan | %18,75 | -0,31 puan |

### 2005–2014 · 2.950 maç

| Model | Tam skor log loss | Log loss farkı ve %95 aralık | İlk üç doğru / maç | İlk üç isabeti ve %95 aralık | İlk üç farkı ve %95 aralık |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Varsayılan olay etkileri | 2,89343 | — | 981/2.950 | %33,25 · %31,58 – %34,98 | — |
| Olay etkileri kapalı | 2,89276 | -0,00066 · -0,00362 – +0,00230 | 956/2.950 | %32,41 · %30,74 – %34,12 | -0,85 puan · -1,59 puan – -0,10 puan |
| Arşivden öğrenilen olay etkileri | 2,89365 | +0,00023 · -0,00226 – +0,00260 | 974/2.950 | %33,02 · %31,34 – %34,74 | -0,24 puan · -0,71 puan – +0,20 puan |
| Beraberlik ve gol dağılımı düzeltmesi | 2,89153 | -0,00190 · -0,00510 – +0,00124 | 986/2.950 | %33,42 · %31,74 – %35,15 | +0,17 puan · -0,71 puan – +1,06 puan |

İlk üç skorun ortalama olasılığı **%34,69** (eşleştirilmiş haftalık örnekleme ile %95 aralık %34,56 – %34,83). Gerçek isabet **%33,25** (%95 aralık %31,58 – %34,98). Gerçek isabet eksi model beklentisi için eşleştirilmiş %95 aralık -3,18 puan – +0,36 puan.

| İlk üç skorun toplam ihtimali | Doğru / maç | Gerçek isabet | %95 aralık |
| :--- | :--- | :--- | :--- |
| <30% | 37/151 | %24,50 | %18,33 – %31,94 |
| 30–<35% | 541/1.598 | %33,85 | %31,58 – %36,21 |
| 35–<40% | 311/956 | %32,53 | %29,64 – %35,57 |
| ≥40% | 92/245 | %37,55 | %31,72 – %43,76 |

| Skor | Model | Gerçek | Fark (gerçek − model) | Düzeltme adayı | Adayın farkı |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 0–0 | %8,70 | %9,46 | +0,75 puan | %8,28 | +1,18 puan |
| 0–1 | %7,39 | %6,61 | -0,78 puan | %8,25 | -1,64 puan |
| 0–2 | %4,53 | %4,47 | -0,05 puan | %4,53 | -0,05 puan |
| 0–3 | %1,77 | %1,90 | +0,13 puan | %1,77 | +0,13 puan |
| 0–4 | %0,56 | %0,88 | +0,33 puan | %0,56 | +0,33 puan |
| 1–0 | %9,82 | %11,02 | +1,20 puan | %10,95 | +0,07 puan |
| 1–1 | %13,66 | %10,88 | -2,78 puan | %11,63 | -0,75 puan |
| 1–2 | %6,90 | %6,61 | -0,29 puan | %6,90 | -0,29 puan |
| 1–3 | %2,55 | %2,95 | +0,40 puan | %2,55 | +0,40 puan |
| 1–4 | %0,77 | %0,75 | -0,02 puan | %0,86 | -0,11 puan |
| 2–0 | %7,44 | %7,76 | +0,33 puan | %7,43 | +0,34 puan |
| 2–1 | %8,87 | %9,69 | +0,82 puan | %8,86 | +0,83 puan |
| 2–2 | %5,40 | %4,88 | -0,52 puan | %4,60 | +0,28 puan |
| 2–3 | %2,02 | %1,53 | -0,49 puan | %2,25 | -0,72 puan |
| 2–4 | %0,57 | %0,58 | +0,00 puan | %0,64 | -0,06 puan |
| 3–0 | %3,67 | %4,00 | +0,33 puan | %3,66 | +0,34 puan |
| 3–1 | %4,16 | %4,14 | -0,03 puan | %4,15 | -0,02 puan |
| 3–2 | %2,58 | %2,98 | +0,40 puan | %2,88 | +0,11 puan |
| 3–3 | %1,08 | %0,78 | -0,30 puan | %1,03 | -0,25 puan |
| 3–4 | %0,31 | %0,10 | -0,21 puan | %0,35 | -0,25 puan |
| 4–0 | %1,45 | %1,39 | -0,06 puan | %1,44 | -0,05 puan |
| 4–1 | %1,58 | %1,73 | +0,15 puan | %1,75 | -0,02 puan |
| 4–2 | %0,93 | %1,49 | +0,56 puan | %1,03 | +0,46 puan |
| 4–3 | %0,40 | %0,37 | -0,03 puan | %0,44 | -0,07 puan |
| 4–4 | %0,13 | %0,10 | -0,03 puan | %0,12 | -0,02 puan |

| Toplam gol | Model | Gerçek | Fark (gerçek − model) | Düzeltme adayı | Adayın farkı |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 0 | %8,70 | %9,46 | +0,75 puan | %8,28 | +1,18 puan |
| 1 | %17,21 | %17,63 | +0,42 puan | %19,20 | -1,57 puan |
| 2 | %25,62 | %23,12 | -2,50 puan | %23,59 | -0,47 puan |
| 3 | %21,21 | %22,20 | +0,99 puan | %21,19 | +1,01 puan |
| 4 | %14,12 | %14,24 | +0,12 puan | %13,30 | +0,93 puan |
| 5+ | %13,14 | %13,36 | +0,22 puan | %14,44 | -1,08 puan |

### 2015–2026 · 3.906 maç

| Model | Tam skor log loss | Log loss farkı ve %95 aralık | İlk üç doğru / maç | İlk üç isabeti ve %95 aralık | İlk üç farkı ve %95 aralık |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Varsayılan olay etkileri | 2,95525 | — | 1.255/3.906 | %32,13 · %30,68 – %33,61 | — |
| Olay etkileri kapalı | 2,95380 | -0,00145 · -0,00456 – +0,00143 | 1.253/3.906 | %32,08 · %30,63 – %33,56 | -0,05 puan · -0,73 puan – +0,58 puan |
| Arşivden öğrenilen olay etkileri | 2,95631 | +0,00106 · -0,00241 – +0,00423 | 1.255/3.906 | %32,13 · %30,68 – %33,61 | 0,00 puan · -0,56 puan – +0,54 puan |
| Beraberlik ve gol dağılımı düzeltmesi | 2,95367 | -0,00159 · -0,00453 – +0,00134 | 1.273/3.906 | %32,59 · %31,14 – %34,08 | +0,46 puan · -0,31 puan – +1,25 puan |

İlk üç skorun ortalama olasılığı **%32,92** (eşleştirilmiş haftalık örnekleme ile %95 aralık %32,84 – %33,01). Gerçek isabet **%32,13** (%95 aralık %30,68 – %33,61). Gerçek isabet eksi model beklentisi için eşleştirilmiş %95 aralık -2,32 puan – +0,74 puan.

| İlk üç skorun toplam ihtimali | Doğru / maç | Gerçek isabet | %95 aralık |
| :--- | :--- | :--- | :--- |
| <30% | 118/453 | %26,05 | %22,22 – %30,28 |
| 30–<35% | 887/2.697 | %32,89 | %31,14 – %34,68 |
| 35–<40% | 215/668 | %32,19 | %28,75 – %35,82 |
| ≥40% | 35/88 | %39,77 | %30,18 – %50,22 |

| Skor | Model | Gerçek | Fark (gerçek − model) | Düzeltme adayı | Adayın farkı |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 0–0 | %7,57 | %6,99 | -0,58 puan | %7,19 | -0,20 puan |
| 0–1 | %6,74 | %6,91 | +0,17 puan | %7,52 | -0,61 puan |
| 0–2 | %4,46 | %4,25 | -0,21 puan | %4,45 | -0,21 puan |
| 0–3 | %1,87 | %2,36 | +0,49 puan | %1,86 | +0,49 puan |
| 0–4 | %0,62 | %0,84 | +0,22 puan | %0,62 | +0,22 puan |
| 1–0 | %8,80 | %9,11 | +0,32 puan | %9,80 | -0,69 puan |
| 1–1 | %13,17 | %11,93 | -1,24 puan | %11,21 | +0,72 puan |
| 1–2 | %7,11 | %6,78 | -0,33 puan | %7,11 | -0,32 puan |
| 1–3 | %2,81 | %2,71 | -0,10 puan | %2,81 | -0,09 puan |
| 1–4 | %0,90 | %0,79 | -0,11 puan | %1,00 | -0,21 puan |
| 2–0 | %7,06 | %6,94 | -0,12 puan | %7,04 | -0,11 puan |
| 2–1 | %8,98 | %9,55 | +0,57 puan | %8,96 | +0,59 puan |
| 2–2 | %5,83 | %4,86 | -0,97 puan | %4,96 | -0,10 puan |
| 2–3 | %2,32 | %2,53 | +0,22 puan | %2,58 | -0,05 puan |
| 2–4 | %0,70 | %0,61 | -0,09 puan | %0,78 | -0,17 puan |
| 3–0 | %3,66 | %4,12 | +0,46 puan | %3,65 | +0,47 puan |
| 3–1 | %4,41 | %4,79 | +0,37 puan | %4,40 | +0,39 puan |
| 3–2 | %2,91 | %3,05 | +0,13 puan | %3,24 | -0,20 puan |
| 3–3 | %1,30 | %1,18 | -0,12 puan | %1,23 | -0,06 puan |
| 3–4 | %0,40 | %0,41 | +0,01 puan | %0,44 | -0,03 puan |
| 4–0 | %1,51 | %1,43 | -0,08 puan | %1,51 | -0,07 puan |
| 4–1 | %1,75 | %1,97 | +0,22 puan | %1,94 | +0,03 puan |
| 4–2 | %1,09 | %0,97 | -0,12 puan | %1,22 | -0,24 puan |
| 4–3 | %0,50 | %0,46 | -0,04 puan | %0,55 | -0,09 puan |
| 4–4 | %0,17 | %0,05 | -0,12 puan | %0,16 | -0,11 puan |

| Toplam gol | Model | Gerçek | Fark (gerçek − model) | Düzeltme adayı | Adayın farkı |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 0 | %7,57 | %6,99 | -0,58 puan | %7,19 | -0,20 puan |
| 1 | %15,54 | %16,03 | +0,48 puan | %17,33 | -1,30 puan |
| 2 | %24,69 | %23,12 | -1,57 puan | %22,71 | +0,41 puan |
| 3 | %21,61 | %22,81 | +1,20 puan | %21,58 | +1,23 puan |
| 4 | %15,19 | %14,64 | -0,55 puan | %14,30 | +0,34 puan |
| 5+ | %15,40 | %16,41 | +1,02 puan | %16,89 | -0,48 puan |

Değişiklik ölçütü, tam skor log loss farkı için eşleştirilmiş %95 aralığın tamamının sıfır altında ve ilk üç isabeti farkı aralığının alt sınırının en az sıfır olmasıdır. Oranların kendi %95 aralıkları Wilson yöntemiyle, model farkları ise 2.000 tekrarlı eşleştirilmiş hafta bloklarıyla hesaplandı.

Geçiş ölçütünü karşılayan aday çıkmadı. Mevcut olay etkileri yayında kullanılıyor.

## 200 maçta 100 milyon simülasyon

Tüm arşive eşit aralıklarla yayılmış 200 maçın her biri için 100.000.000 kabul edilmiş simülasyon çalıştırıldı. Matematiksel kontrol 200/200, maç sonucu eşleşmesi 200/200, ilk üç skorun aynı sırada eşleşmesi 200/200. En büyük fark tek skor için 0,01051, maç sonucu için 0,01426 yüzde puandı. Tolerans 0,05 yüzde puan. Sekiz iş parçacıklı çalışma ortamında maç başına süre medyan 6,58 sn, aralık 4,10–12,77 sn.

| Dönem | Maç | Matematiksel kontrol | Maç sonucu aynı | İlk üç sıra aynı |
| :--- | :--- | :--- | :--- | :--- |
| 1994–2004 | 62 | 62 | 62 | 62 |
| 2005–2014 | 59 | 59 | 59 | 59 |
| 2015–2026 | 79 | 79 | 79 | 79 |

9.924 maçın her biri için 100 milyon çekiliş ve gerçek telefon testi çalıştırılmadı.

## Kaynaklar ve yeniden üretim

[Maç sonuç arşivi](https://github.com/jalapic/engsoccerdata) · [TFF](https://www.tff.org/default.aspx?pageID=1768) · [Güncel maç verisi](https://github.com/oladeeayo/open-matchday) · [Olay arşivi](https://github.com/c0ze/super-lig)

Maç girdisi SHA-256 `7c8b7bc00b8c5884ad3d9f1f92e2c795528f8e72a0ff064acdc0c4b8ce2d39c6`

Olay arşivi SHA-256 `31fb3c03c548f1e1ae1bb8662fc12574a5ff2a5db944d974cb089fe909ec5bb0`

Ham veri yerel ölçümde kullanıldı. Makinece okunabilir özetler [event-validation.json](event-validation.json) dosyasındadır.

```sh
python tests/event-archive.py site.db exposure.private.json
node tests/event-study.mjs turkey.csv forecast-data tff-results.json exposure.private.json study.json
node tests/event-samples.mjs turkey.csv forecast-data tff-results.json samples.json
node tests/event-study-report.mjs study.json samples.json event-validation.json EVENT_CALIBRATION.md
```
