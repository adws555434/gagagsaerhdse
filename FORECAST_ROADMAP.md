# Football Intelligence · Tahmin doğruluğu adayları

300 fikir arasından 100 öncelik seçildi. Öncelik sırası beklenen katkı, ücretsiz veri kapsamı, maç öncesi kullanılabilirlik ve geçmiş maçlarda ölçülebilirlik esas alınarak belirlendi. Bu sıralama ölçülmüş özellik etkisi anlamına gelmez.

Bu sürümde rakip gücüne göre hücum ve savunma, maçların yaşına göre ağırlık ve Elo payı birlikte 100 farklı yapılandırmada denendi. Referans dahil toplam 101 yapılandırma var. Bu deney, 100 ayrı ürün özelliğinin uygulandığı anlamına gelmez. Kadro, xG, sakatlık ve canlı akış için tabloda belirtilen veri kapsamı gerekir.

## Öncelikli 100

| Sıra | Fikir | Kategori | Veri gereksinimi |
|---:|---|---|---|
| 1 | Rakibe göre hücum gücü | Takım gücü | Mevcut ücretsiz arşiv |
| 2 | Rakibe göre savunma gücü | Takım gücü | Mevcut ücretsiz arşiv |
| 3 | Son maçlara üstel ağırlık | Maç geçmişi | Mevcut ücretsiz arşiv |
| 4 | Dixon–Coles düşük skor düzeltmesi | Skor dağılımı | Mevcut ücretsiz arşiv |
| 5 | Log loss ile model seçimi | Kalibrasyon | Mevcut ücretsiz arşiv |
| 6 | İleri yürüyen model testi | Zamana bağlı değerlendirme | Mevcut ücretsiz arşiv |
| 7 | Son maçlarda xG ve xGA | Beklenen gol | Seçili arşiv veya lisanslı olay verisi |
| 8 | Resmi ilk 11 açıklaması | Kadro | Lisanslı veya onaylı kadro verisi |
| 9 | Önceki resmi maçtan dinlenme günü | Fikstür yükü | Kısmi ücretsiz kapsam |
| 10 | Ayrı gol toplamı ve gol paylaşımı parametreleri | Skor dağılımı | Mevcut ücretsiz arşiv |
| 11 | Bayesçi kalibrasyon küçültmesi | Kalibrasyon | Mevcut ücretsiz arşiv |
| 12 | Sonuçlanan ertelenmiş maç kimliğini izleme | Doğrulama korumaları | Mevcut ücretsiz arşiv |
| 13 | Çok sınıflı kalibrasyon eğrisi | Kalibrasyon | Mevcut ücretsiz arşiv |
| 14 | Sonradan düzeltme zamanını izleme | Doğrulama korumaları | Mevcut ücretsiz arşiv |
| 15 | Tek özellik kaldırma testi | Özellik seçimi | Mevcut ücretsiz arşiv |
| 16 | İlk haftalarda geçen sezonu ağırlıklı kullanma | Maç geçmişi | Mevcut ücretsiz arşiv |
| 17 | Bağımsız Poisson referansı | Skor dağılımı | Mevcut ücretsiz arşiv |
| 18 | Model seçimi için ayrı dönem | Zamana bağlı değerlendirme | Mevcut ücretsiz arşiv |
| 19 | Gelecek bilgi sızıntısı testi | Doğrulama korumaları | Mevcut ücretsiz arşiv |
| 20 | Aynı anda bağlı iki özelliğin etkileşim testi | Özellik seçimi | Mevcut ücretsiz arşiv |
| 21 | Takım başına kayan 50–100 maç | Maç geçmişi | Mevcut ücretsiz arşiv |
| 22 | Hücum ve savunma derecesini ayrı güncelleme | Takım gücü | Mevcut ücretsiz arşiv |
| 23 | Bivariate Poisson ortak gol bileşeni | Skor dağılımı | Mevcut ücretsiz arşiv |
| 24 | Brier skoru ile çapraz kontrol | Kalibrasyon | Mevcut ücretsiz arşiv |
| 25 | Gelecek sezon bağımsız değerlendirme | Zamana bağlı değerlendirme | Mevcut ücretsiz arşiv |
| 26 | Aynı takımın mükerrer kimliğini kontrol | Doğrulama korumaları | Mevcut ücretsiz arşiv |
| 27 | Sezonlar arası istikrar metriği | Özellik seçimi | Mevcut ücretsiz arşiv |
| 28 | Sezon başına ayrı lig baz gol oranı | Maç geçmişi | Mevcut ücretsiz arşiv |
| 29 | Ev ve deplasman için ayrı takım kuvveti | Takım gücü | Mevcut ücretsiz arşiv |
| 30 | Aşırı saçılım için negatif binom | Skor dağılımı | Mevcut ücretsiz arşiv |
| 31 | Sınıf bazında kalibrasyon | Kalibrasyon | Mevcut ücretsiz arşiv |
| 32 | Maç öncesi veri anlık görüntüsü | Zamana bağlı değerlendirme | Mevcut ücretsiz arşiv |
| 33 | Fikstür ve sonuç eşleşme anahtarını doğrulama | Doğrulama korumaları | Mevcut ücretsiz arşiv |
| 34 | Küçük fark için örneklem güven aralığı | Özellik seçimi | Mevcut ücretsiz arşiv |
| 35 | Veri azlığında lige doğru küçültme | Maç geçmişi | Mevcut ücretsiz arşiv |
| 36 | Elo saha avantajı | Takım gücü | Mevcut ücretsiz arşiv |
| 37 | Düşük tempolu maç karışım modeli | Skor dağılımı | Mevcut ücretsiz arşiv |
| 38 | Örneklem yeterliyse sıcaklık ölçekleme | Kalibrasyon | Mevcut ücretsiz arşiv |
| 39 | Yanlılık için lig ve sezon kırılımı | Zamana bağlı değerlendirme | Mevcut ücretsiz arşiv |
| 40 | Saha saat dilimini standardize etme | Doğrulama korumaları | Mevcut ücretsiz arşiv |
| 41 | Aday sürüm ve ana sürüm karşılaştırması | Özellik seçimi | Mevcut ücretsiz arşiv |
| 42 | Penaltısız xG | Beklenen gol | Seçili arşiv veya lisanslı olay verisi |
| 43 | Oyuncu dakika ağırlıklı takım gücü | Kadro | Lisanslı veya onaylı kadro verisi |
| 44 | Milli maçlarda maç türü ağırlığı | Maç geçmişi | Mevcut ücretsiz arşiv |
| 45 | Gol farkına duyarlı Elo | Takım gücü | Mevcut ücretsiz arşiv |
| 46 | Korelasyonlu devre modelleri | Skor dağılımı | Mevcut ücretsiz arşiv |
| 47 | Göç eden takım adlarını eşleştirme | Zamana bağlı değerlendirme | Mevcut ücretsiz arşiv |
| 48 | Zaman dilimine göre performans ayrımı | Özellik seçimi | Mevcut ücretsiz arşiv |
| 49 | Açık oyun xG | Beklenen gol | Seçili arşiv veya lisanslı olay verisi |
| 50 | İlk 11 belirsizliğini senaryolaştırma | Kadro | Lisanslı veya onaylı kadro verisi |
| 51 | Hazırlık ve resmi maç formunu ayırma | Maç geçmişi | Mevcut ücretsiz arşiv |
| 52 | Elo belirsizliği | Takım gücü | Mevcut ücretsiz arşiv |
| 53 | Beraberlik için lig bazlı düzeltme | Skor dağılımı | Mevcut ücretsiz arşiv |
| 54 | Aşırı kesin favorileri saptama | Kalibrasyon | Mevcut ücretsiz arşiv |
| 55 | Model adaylarını sabit referansla ölçme | Zamana bağlı değerlendirme | Mevcut ücretsiz arşiv |
| 56 | Normal süre ve uzatma ayrımı | Doğrulama korumaları | Mevcut ücretsiz arşiv |
| 57 | Eğitimde iyileşip testte bozulan aday işareti | Özellik seçimi | Mevcut ücretsiz arşiv |
| 58 | Duran top xG | Beklenen gol | Seçili arşiv veya lisanslı olay verisi |
| 59 | Kadro istikrarı | Kadro | Lisanslı veya onaylı kadro verisi |
| 60 | Yükselen takımın alt lig geçmişi | Maç geçmişi | Mevcut ücretsiz arşiv |
| 61 | Saha avantajını ligden öğrenme | Takım gücü | Mevcut ücretsiz arşiv |
| 62 | Olasılık aralığı başına güven aralığı | Kalibrasyon | Mevcut ücretsiz arşiv |
| 63 | Lig başına bootstrap güven aralığı | Zamana bağlı değerlendirme | Mevcut ücretsiz arşiv |
| 64 | Hükmen biten maçları işaretleme | Doğrulama korumaları | Mevcut ücretsiz arşiv |
| 65 | Lig bazlı taban model düşüş eşiği | Özellik seçimi | Mevcut ücretsiz arşiv |
| 66 | Şut başına xG | Beklenen gol | Seçili arşiv veya lisanslı olay verisi |
| 67 | Aynı mevkide yedek derinliği | Kadro | Lisanslı veya onaylı kadro verisi |
| 68 | Aynı gün verisini kesim dışında tutma | Maç geçmişi | Mevcut ücretsiz arşiv |
| 69 | Nötr saha katsayılarını ayrı ölçme | Takım gücü | Mevcut ücretsiz arşiv |
| 70 | Skor sıralamasında deterministik eşitlik kuralı | Skor dağılımı | Mevcut ücretsiz arşiv |
| 71 | Lig bazlı kayma ölçümü | Kalibrasyon | Mevcut ücretsiz arşiv |
| 72 | Maç tarihi yerine yayın zamanı kullanımı | Zamana bağlı değerlendirme | Mevcut ücretsiz arşiv |
| 73 | Eksik alanı sıfır saymama | Doğrulama korumaları | Mevcut ücretsiz arşiv |
| 74 | Model değişim günlüğü | Özellik seçimi | Mevcut ücretsiz arşiv |
| 75 | Rakibe göre xG farkı | Beklenen gol | Seçili arşiv veya lisanslı olay verisi |
| 76 | Kadrodaki kalecinin değişimi | Kadro | Lisanslı veya onaylı kadro verisi |
| 77 | Skor ve tarih kayıtlarını kaynaklar arasında doğrulama | Maç geçmişi | Mevcut ücretsiz arşiv |
| 78 | Yeni takım için lig tabanlı başlangıç derecesi | Takım gücü | Mevcut ücretsiz arşiv |
| 79 | Gol dağılımı kuyruğunu sayısal doğrulama | Skor dağılımı | Mevcut ücretsiz arşiv |
| 80 | Skor dağılımıyla 1X2 tutarlılığı | Kalibrasyon | Mevcut ücretsiz arşiv |
| 81 | Test koşullarını veri sürümüyle kaydetme | Zamana bağlı değerlendirme | Mevcut ücretsiz arşiv |
| 82 | Örneklem küçükse tahmini görünürce sınırlama | Doğrulama korumaları | Mevcut ücretsiz arşiv |
| 83 | Aday sayısını ve deneme aralığını raporlama | Özellik seçimi | Mevcut ücretsiz arşiv |
| 84 | Şut sonrası xG | Beklenen gol | Seçili arşiv veya lisanslı olay verisi |
| 85 | Forvet yokluğunda geçmiş hücum üretimi | Kadro | Lisanslı veya onaylı kadro verisi |
| 86 | Üretim ve bitiricilik ayrımı | Beklenen gol | Seçili arşiv veya lisanslı olay verisi |
| 87 | Stoper ikilisinin ortak maç sayısı | Kadro | Lisanslı veya onaylı kadro verisi |
| 88 | Minimum geçmiş maç kuralı | Güven ve belirsizlik | Mevcut ücretsiz arşiv |
| 89 | Birincil ve yedek kaynak desteği | Veri altyapısı | Mevcut ücretsiz arşiv |
| 90 | Aylık log loss takibi | Model drift | Mevcut ücretsiz arşiv |
| 91 | Kaleci karşısında engellenen gol değeri | Beklenen gol | Seçili arşiv veya lisanslı olay verisi |
| 92 | Birlikte oynama süresi | Kadro | Lisanslı veya onaylı kadro verisi |
| 93 | Parametre belirsizliği simülasyonu | Güven ve belirsizlik | Mevcut ücretsiz arşiv |
| 94 | Kaynak bazında doğrulama raporu | Veri altyapısı | Mevcut ücretsiz arşiv |
| 95 | Mevsimsel gol ortalaması kayması | Model drift | Mevcut ücretsiz arşiv |
| 96 | Gol ve xG farkını örneklemle küçültme | Beklenen gol | Seçili arşiv veya lisanslı olay verisi |
| 97 | Kadronun açıklanmasından sonra tahmini yeniden hesaplama | Kadro | Lisanslı veya onaylı kadro verisi |
| 98 | Veri kaynağı uyuşmazlığı göstergesi | Güven ve belirsizlik | Mevcut ücretsiz arşiv |
| 99 | Tarih ve skor alanı şema testi | Veri altyapısı | Mevcut ücretsiz arşiv |
| 100 | Beraberlik sıklığı değişimi | Model drift | Mevcut ücretsiz arşiv |

## Taranan 300 fikir

### Maç geçmişi

1. Son maçlara üstel ağırlık
2. İlk haftalarda geçen sezonu ağırlıklı kullanma
3. Takım başına kayan 50–100 maç
4. Sezon başına ayrı lig baz gol oranı
5. Veri azlığında lige doğru küçültme
6. Milli maçlarda maç türü ağırlığı
7. Hazırlık ve resmi maç formunu ayırma
8. Yükselen takımın alt lig geçmişi
9. Aynı gün verisini kesim dışında tutma
10. Skor ve tarih kayıtlarını kaynaklar arasında doğrulama

### Takım gücü

11. Rakibe göre hücum gücü
12. Rakibe göre savunma gücü
13. Hücum ve savunma derecesini ayrı güncelleme
14. Ev ve deplasman için ayrı takım kuvveti
15. Elo saha avantajı
16. Gol farkına duyarlı Elo
17. Elo belirsizliği
18. Saha avantajını ligden öğrenme
19. Nötr saha katsayılarını ayrı ölçme
20. Yeni takım için lig tabanlı başlangıç derecesi

### Skor dağılımı

21. Dixon–Coles düşük skor düzeltmesi
22. Bağımsız Poisson referansı
23. Bivariate Poisson ortak gol bileşeni
24. Aşırı saçılım için negatif binom
25. Düşük tempolu maç karışım modeli
26. Korelasyonlu devre modelleri
27. Beraberlik için lig bazlı düzeltme
28. Ayrı gol toplamı ve gol paylaşımı parametreleri
29. Skor sıralamasında deterministik eşitlik kuralı
30. Gol dağılımı kuyruğunu sayısal doğrulama

### Kalibrasyon

31. Çok sınıflı kalibrasyon eğrisi
32. Log loss ile model seçimi
33. Brier skoru ile çapraz kontrol
34. Sınıf bazında kalibrasyon
35. Örneklem yeterliyse sıcaklık ölçekleme
36. Bayesçi kalibrasyon küçültmesi
37. Aşırı kesin favorileri saptama
38. Olasılık aralığı başına güven aralığı
39. Lig bazlı kayma ölçümü
40. Skor dağılımıyla 1X2 tutarlılığı

### Zamana bağlı değerlendirme

41. İleri yürüyen model testi
42. Model seçimi için ayrı dönem
43. Gelecek sezon bağımsız değerlendirme
44. Maç öncesi veri anlık görüntüsü
45. Yanlılık için lig ve sezon kırılımı
46. Göç eden takım adlarını eşleştirme
47. Model adaylarını sabit referansla ölçme
48. Lig başına bootstrap güven aralığı
49. Maç tarihi yerine yayın zamanı kullanımı
50. Test koşullarını veri sürümüyle kaydetme

### Fikstür yükü

51. Önceki resmi maçtan dinlenme günü
52. Son 14 günde resmi maç sayısı
53. Son 28 günde resmi maç sayısı
54. Kupa ve lig yükünü birleştirme
55. Uzatma oynanan maçlardan sonra yük
56. Son 7 gündeki deplasman sayısı
57. Lig ve kupa arası gün farkı
58. Sıkışık fikstürde rotasyon ihtimali
59. Milli aradan dönüş etkisi
60. Art arda uzatma maçlarının etkisi

### Şut üretimi

61. Maç başına şut ortalaması
62. Maç başına isabetli şut
63. Rakibe verilen isabetli şut
64. Şut başına gol dönüşümü
65. Rakibe göre şut hacmi
66. İç saha isabetli şut farkı
67. Skor durumuna göre şut düzeltmesi
68. Duran top şut oranı
69. Açık oyun şut eğilimi
70. Ceza sahası içi şut payı

### Beklenen gol

71. Son maçlarda xG ve xGA
72. Penaltısız xG
73. Açık oyun xG
74. Duran top xG
75. Şut başına xG
76. Rakibe göre xG farkı
77. Şut sonrası xG
78. Üretim ve bitiricilik ayrımı
79. Kaleci karşısında engellenen gol değeri
80. Gol ve xG farkını örneklemle küçültme

### Kadro

81. Resmi ilk 11 açıklaması
82. Oyuncu dakika ağırlıklı takım gücü
83. İlk 11 belirsizliğini senaryolaştırma
84. Kadro istikrarı
85. Aynı mevkide yedek derinliği
86. Kadrodaki kalecinin değişimi
87. Forvet yokluğunda geçmiş hücum üretimi
88. Stoper ikilisinin ortak maç sayısı
89. Birlikte oynama süresi
90. Kadronun açıklanmasından sonra tahmini yeniden hesaplama

### Oyuncu formu

91. Son 5 ve önceki 15 maçta 90 dakika başına gol
92. 90 dakika başına xG
93. 90 dakika başına xA
94. Dakika ağırlıklı şut hacmi
95. Penaltıları ayrı değerlendirme
96. Kısa süreli form için regresyon
97. Rol değişiminden önce ve sonra üretim
98. Az dakika alan oyuncu için geniş belirsizlik
99. Rakibe göre oyuncu üretimi
100. Oyuncunun açık oyun pas yaratımı

### Maç olayları

101. İlk yarı gol beklentisi
102. İkinci yarı gol beklentisi
103. 15 dakikalık gol yoğunluğu
104. Gol dakikalarını uzatmadan ayırma
105. Korner zaman profili
106. Sarı kartların devreye dağılımı
107. Kırmızı kart sonrası gol hızını ölçme
108. İlk golden sonra tempo
109. Öne geçtiğinde savunma profili
110. Gerideyken şut hacmi

### Rakip eşleşmesi

111. Rakibin güçlü savunmalar karşısındaki üretimi
112. Rakibin güçlü hücumlar karşısındaki savunması
113. Benzer güçte rakiplere karşı form
114. Çapraz lig kuvvet endeksi
115. Kupa ile lig formunu ayrı tutma
116. Denk seviyede ev sahibi performansı
117. Üst düzey takımlara karşı skor varyansı
118. Devre arası taktik uyumu gözlemi
119. Geri dönüş profili
120. Favoriyken puan kaybı profili

### Taktik ve alan verisi

121. Baskı şiddeti
122. PPDA
123. İlerletici pas sayısı
124. İlerletici taşıma sayısı
125. Üçüncü bölge girişleri
126. Ceza alanına girişler
127. Geçiş hücumu süresi
128. Yüksek top kazanımı
129. Baskıdan çıkış başarı oranı
130. Kanat ve merkez hücum payı

### Kaleci ve savunma

131. Kalecinin yakın dönem kurtarış kalitesi
132. Ceza alanı hava topları
133. Ceza alanı savunma aksiyonları
134. Rakip kaliteli şutlarını engelleme
135. Stoper ikilisinin pas çıkışı
136. Kaleci pas başlangıcından top kaybı
137. Savunma çizgisi yüksekliği
138. Geçiş savunmasında geri koşu
139. Zayıf ayak yönlendirme profili
140. Topa müdahale sonrası top kazanımı

### Duran oyunlar

141. Maç başına korner üretimi
142. Rakibe verilen korner
143. Kornerden şut oranı
144. Kornerden xG
145. Serbest vuruştan şut hacmi
146. Uzun taç sonrası tehlike
147. Savunulan duran top xGA
148. Penaltı kazanma sıklığı
149. Penaltı verme sıklığı
150. Duran toplarda hava topu üstünlüğü

### Hakem ve disiplin

151. Hakemin kart ortalaması
152. Hakemin faul standardı
153. Takımların oyuncu başına kart oranı
154. Hakem ve fiziksel oyun etkileşimi
155. Doğrulanmış sarı kart cezası
156. Doğrulanmış kırmızı kart cezası
157. Hakem örnekleminin büyüklüğü
158. Hakem ataması sonrası saha modeli
159. Faul avantajı uygulama sıklığı
160. Uzatma süresi dağılımı

### Konum ve hava

161. Seyahat mesafesi
162. Saat dilimi değişimi
163. İrtifa farkı
164. Yüksek sıcaklık
165. Yoğun yağış
166. Güçlü rüzgar
167. Saha yüzeyi
168. Çatı durumu
169. Yerel hava tahmin ufku
170. Hava ölçümünün stadyuma yakınlığı

### Organizasyon bağlamı

171. Eleme ve grup maçını ayırma
172. İki ayaklı eşleşmede ilk maç sonucu
173. Uzaktan deplasman nötr saha ayrımı
174. Milli takım turnuva çeyrek finali etkisi
175. Alt lig kupa rakibi küçültmesi
176. Fikstür sonu düşme hattı bağlamı
177. Avrupa kupası ön eleme aşaması
178. Tek maç final bağlamı
179. Milli hazırlık maçında rotasyon
180. Son grup maçında puan ihtiyacı

### Maç öncesi doğrulanmış haber

181. Resmi kadro duyurusu zaman damgası
182. Teknik direktör değişikliği
183. Resmi transferin ilk uygunluk tarihi
184. Federasyon ceza ilanı
185. Takımın ilan ettiği oyuncu uygunluğu
186. İki kaynak arasında çelişki işareti
187. Haber yenilenince eski tahmin kaydı
188. Kaynağın son güncelleme süresi
189. Transfer sonrası ilk 11 belirsizliği
190. Kamuya açık basın toplantısı olay olarak işaretleme

### Canlı model

191. Dakikaya göre kalan gol hızı
192. Canlı skor koşullandırması
193. Canlı kırmızı kart durumu
194. Canlı oyuncu değişikliği
195. Canlı şut güncellemesi
196. Canlı xG güncellemesi
197. VAR sonrası skor düzeltmesi
198. Yarı zamanı ve duraklama
199. Geç gelen olayların sıralaması
200. Canlı bağlantı kesilince veri yaşı uyarısı

### Model adayları

201. Elo ve Poisson ağırlık taraması
202. Bradley–Terry derecelendirmesi
203. Davidson beraberlik modeli
204. Çok sınıflı lojistik referans
205. Hiyerarşik Bayes lig modeli
206. Dinamik durum uzayı
207. Gradient boosting deneysel model
208. Negatif binom regresyon
209. Düzenlileştirilmiş gol regresyonu
210. Model karışımı için dışarıda tutulan tahminler

### Doğrulama korumaları

211. Sonradan düzeltme zamanını izleme
212. Gelecek bilgi sızıntısı testi
213. Aynı takımın mükerrer kimliğini kontrol
214. Fikstür ve sonuç eşleşme anahtarını doğrulama
215. Saha saat dilimini standardize etme
216. Sonuçlanan ertelenmiş maç kimliğini izleme
217. Normal süre ve uzatma ayrımı
218. Hükmen biten maçları işaretleme
219. Eksik alanı sıfır saymama
220. Örneklem küçükse tahmini görünürce sınırlama

### Güven ve belirsizlik

221. Minimum geçmiş maç kuralı
222. Parametre belirsizliği simülasyonu
223. Veri kaynağı uyuşmazlığı göstergesi
224. Son güncelleme zamanı
225. Bilinen eksikler etiketi
226. Skor olasılığında belirsizlik aralığı
227. İki model arası olasılık ayrılığı
228. Tahmin kartında lig geçmişi başarısı
229. Saha ve rakip gücü katkısı
230. Rastgele örnekleme hatası göstergesi

### Tahmin kayıtları

231. İlk maç önü tahminini dondurma
232. Model sürümünü kaydetme
233. Gerçek sonucu otomatik eşleme
234. İlk üç skor başarısı
235. Ayrı 1X2 ve tam skor yüzdesi
236. Kayıt dışa aktarma
237. Fikstür ertelemesini kayıtta izleme
238. Sonuçlanmayan tahmin sayımı
239. Lig ve sezon başarı filtresi
240. Olasılık değişiminin zaman serisi

### Veri altyapısı

241. Birincil ve yedek kaynak desteği
242. Kaynak bazında doğrulama raporu
243. Tarih ve skor alanı şema testi
244. Geçersiz devre skorlarını filtreleme
245. Yinelenen maç satırını ayıklama
246. Ad normalizasyonunda transliterasyon
247. Çakışan kısaltmayı belirsiz sayma
248. Farklı kaynaklarda birleştirme kalite ölçümü
249. Veri lisansı kaydı
250. Yayımdan önce örnek veri testi

### Milli maç bağlamı

251. Konfederasyon bazlı takım gücü
252. Birleşik lig bazına nötr maç düzeltmesi
253. Dünya Kupası ve kıta elemesi ayrımı
254. Ev sahibi ülkeyi stadyumdan doğrulama
255. Son dostluk maçlarına ayrı ağırlık
256. Tarafsız maç örneklemi yeterliliği
257. Güçlü rakiplerle yıllık maç adedi
258. Uzun aradan sonra ilk turnuva maçı
259. Yedek kadrolu hazırlık dönemi
260. Alternatif federasyon takımını ayırma

### Özellik seçimi

261. Tek özellik kaldırma testi
262. Aynı anda bağlı iki özelliğin etkileşim testi
263. Sezonlar arası istikrar metriği
264. Küçük fark için örneklem güven aralığı
265. Aday sürüm ve ana sürüm karşılaştırması
266. Zaman dilimine göre performans ayrımı
267. Eğitimde iyileşip testte bozulan aday işareti
268. Lig bazlı taban model düşüş eşiği
269. Model değişim günlüğü
270. Aday sayısını ve deneme aralığını raporlama

### Model drift

271. Aylık log loss takibi
272. Mevsimsel gol ortalaması kayması
273. Beraberlik sıklığı değişimi
274. Yeni takım yükselince model davranışı
275. Sezon başı kalibrasyon eğrisi
276. Lig değişikliğinde performans düşüşü
277. Son beş haftada raf ömrü
278. Veri kaynağı değişince alarm
279. Yeni sezon yeniden uyum testi
280. Geri alma eşiği

### Maç durumları

281. Bir gol öndeyken kazanma olasılığı
282. İki gol öndeyken beraberlik riski
283. Dakikaya göre alternatif skor dağılımı
284. İlk 20 dakikada gol senaryosu
285. Devreden sonra geri dönüş senaryosu
286. Oyuncu değişikliği senaryo testi
287. Büyük favori geriye düştüğünde profil
288. İlk golü atan takımın olasılığı
289. Golsüz maç olasılığı
290. Deplasman öne geçince tempo profili

### İşletim ve sunum

291. Hesap sırasında görünür ilerleme
292. Düşük cihaz gücünde isteğe bağlı hızlı mod
293. Aynı veriyle aynı hesap sonucu
294. Tekrar tahmin ekranında değişen faktörler
295. Takım verilerini karşılaştıran grafik
296. Sürüm bazlı model raporu
297. Kaynak ve fikstür tarihinin açıklanması
298. Hata anında yeniden deneme
299. Mobil ekran doğrulaması
300. İşlem iptalinde eski sonucun görünmesini engelleme
