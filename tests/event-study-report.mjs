import fs from 'node:fs';
import assert from 'node:assert/strict';

const [study,samples,output,markdown]=process.argv.slice(2);
const report=JSON.parse(fs.readFileSync(study,'utf8'));
const verification=JSON.parse(fs.readFileSync(samples,'utf8'));
const rows=verification.samples;
assert.equal(verification.inputSha,report.inputSha);
assert.equal(verification.trials,100_000_000);
assert.equal(verification.planned,200);
assert.equal(rows.length,verification.planned);
const good=rows.filter(row=>row.verified);
const seconds=rows.map(row=>row.seconds).sort((a,b)=>a-b);
const era=(month)=>month<'2005'?'1994–2004':month<'2015'?'2005–2014':'2015–2026';
const grouped={};
for(const row of rows){
 const group=grouped[era(row.period)]??={n:0,verified:0,winner:0,top3Order:0};
 group.n++;group.verified+=Number(row.verified);
 group.winner+=Number(!!row.winner);group.top3Order+=Number(!!row.top3);
}
const summary=report.sampleSummary={trialsPerMatch:verification.trials,completed:rows.length,verified:good.length,
 winner:good.filter(row=>row.winner).length,top3Order:good.filter(row=>row.top3).length,
 maxScore:Math.max(...good.map(row=>row.maxScore)),maxOutcome:Math.max(...good.map(row=>row.maxOutcome)),
 minSeconds:seconds[0],medianSeconds:(seconds[99]+seconds[100])/2,maxSeconds:seconds.at(-1),byPeriod:grouped,
 failures:rows.filter(row=>!row.verified).reduce((counts,row)=>({...counts,[row.error]:(counts[row.error]??0)+1}),{})};
delete report.full100mSample;
const labels={assumed:'Varsayılan olay etkileri',disabled:'Olay etkileri kapalı',fitted:'Arşivden öğrenilen olay etkileri',corrected:'Beraberlik ve gol dağılımı düzeltmesi'};
const outcomeLabels={winner:'Kazanan veya beraberlik',score:'Kazananla uyumlu tek skor',globalScore:'Genel en sık skor',top3:'İlk üç skor'};
const fmt=(n,d=2)=>n==null?'—':n.toLocaleString('tr-TR',{minimumFractionDigits:d,maximumFractionDigits:d});
const count=n=>fmt(n,0);
const pct=n=>n==null?'—':'%'+fmt(100*n);
const ci=(x,format=pct)=>x?x.map(format).join(' – '):'—';
const accuracy=x=>[count(x.hits)+'/'+count(x.n),pct(x.rate),ci(x.ci95)];
const table=(head,rows)=>[head,head.map(()=>':---'),...rows].map(row=>'| '+row.join(' | ')+' |').join('\n');
const {analytic:a,study:s}=report;
const sections=['# Kesin Tahmin · Süper Lig geçmiş testi',
 `Arşiv ${a.from}–${a.through} arasındaki ${count(a.archive)} maçı kapsıyor. ${count(a.unavailable)} maçta iki takımın da beş geçmiş maç koşulu sağlanamadı. Kalan ${count(a.eligible)} maç kronolojik olarak, aynı günün sonuçları dahil edilmeden ölçüldü. Maç sonucu, üç sonuç sınıfının toplam olasılığından seçilir. Kart skoru, seçilen sonuçla uyumlu skorların en sık çıkanıdır. İlk üç skor bütün skorlar arasından sıralanır.`,
 '## Karar kuralı',
 table(['Ölçüm','Doğru / maç','İsabet','%95 güven aralığı'],Object.entries(outcomeLabels).map(([key,label])=>[label,...accuracy(a[key])])),
 '## Olay etkileri ve skor düzeltmesi',
 `Olay arşivindeki ${count(s.events.sourceMatches)} maçtan ${count(s.events.completeMatches)} maç gol akışı ve final skor tutarlılığı kontrolünü geçti. ${count(s.events.joined)} maç tarih, takımlar ve skorla model arşivine eşleşti. Öğrenilen katsayılar ${count(s.events.fittedCases)} test maçında uygulanabildi. İlk 100 eşleşmiş olay maçı tamamlanana kadar mevcut olay katsayıları kullanıldı. Her ayın katsayıları yalnızca önceki ayların verisiyle, maç önü gol beklentisi ofsetli Poisson modeliyle tahmin edildi. Uzatma dakikaları yarı içindeki göreli zamana çevrildi. Yapısal olarak her takımdaki ilk kırmızı kart temsil edildi.`,
 'Düzeltme adayı, beraberlik skorlarının ve 0–1 ya da 5+ toplam gollü uçların olasılığını çarpanlarla ayarlar. Çarpanlar geçmiş günlerde en düşük tam skor log loss değerini veren ayardan seçildi. Piyasa oranlı tarihsel yeniden test çalıştırılmadı.',
 ...Object.keys(s.results.assumed).flatMap(period=>{
  const published=s.results.assumed[period],corrected=s.results.corrected[period];
  const delta=n=>(n>0?'+':'')+fmt(n,5),point=n=>(n>0?'+':'')+fmt(n*100)+' puan';
  const frequency=(name,entries,after)=>table([name,'Model','Gerçek','Fark (gerçek − model)','Düzeltme adayı','Adayın farkı'],
   entries.map((entry,i)=>[entry.label,pct(entry.predicted),pct(entry.actual),point(entry.delta),pct(after[i].predicted),point(after[i].delta)]));
  return [`### ${period==='all'?'Tüm dönemler':period} · ${count(published.n)} maç`,
   table(['Model','Tam skor log loss','Log loss farkı ve %95 aralık','İlk üç doğru / maç','İlk üç isabeti ve %95 aralık','İlk üç farkı ve %95 aralık'],
    Object.entries(s.results).map(([key,results])=>{
     const row=results[period],cmp=s.comparisons[key]?.[period];
    return [labels[key],fmt(row.logLoss,5),cmp?delta(cmp.logLossDelta)+' · '+ci(cmp.logLossCI95,delta):'—',
      count(row.top3.hits)+'/'+count(row.top3.n),pct(row.top3.rate)+' · '+ci(row.top3.ci95),
      cmp?point(cmp.top3Delta)+' · '+ci(cmp.top3CI95,point):'—'];
    })),
   `İlk üç skorun ortalama olasılığı **${pct(published.expectedTop3)}** (eşleştirilmiş haftalık örnekleme ile %95 aralık ${ci(published.expectedTop3CI95)}). Gerçek isabet **${pct(published.top3.rate)}** (%95 aralık ${ci(published.top3.ci95)}). Gerçek isabet eksi model beklentisi için eşleştirilmiş %95 aralık ${ci(published.top3GapCI95,point)}.`,
   table(['İlk üç skorun toplam ihtimali','Doğru / maç','Gerçek isabet','%95 aralık'],published.bands.map(row=>[row.band,...accuracy(row)])),
   frequency('Skor',published.scores,corrected.scores),frequency('Toplam gol',published.totals,corrected.totals)];
 }),
 'Değişiklik ölçütü, tam skor log loss farkı için eşleştirilmiş %95 aralığın tamamının sıfır altında ve ilk üç isabeti farkı aralığının alt sınırının en az sıfır olmasıdır. Oranların kendi %95 aralıkları Wilson yöntemiyle, model farkları ise 2.000 tekrarlı eşleştirilmiş hafta bloklarıyla hesaplandı.',
 s.eligibleCandidates.length?`Geçiş ölçütünü karşılayan adaylar: ${s.eligibleCandidates.map(k=>labels[k]).join(', ')}.`:'Geçiş ölçütünü karşılayan aday çıkmadı. Mevcut olay etkileri yayında kullanılıyor.',
 '## 200 maçta 100 milyon simülasyon',
 `Tüm arşive eşit aralıklarla yayılmış ${count(summary.completed)} maçın her biri için ${count(summary.trialsPerMatch)} kabul edilmiş simülasyon çalıştırıldı. Matematiksel kontrol ${count(summary.verified)}/${count(summary.completed)}, maç sonucu eşleşmesi ${count(summary.winner)}/${count(summary.completed)}, ilk üç skorun aynı sırada eşleşmesi ${count(summary.top3Order)}/${count(summary.completed)}. En büyük fark tek skor için ${fmt(summary.maxScore*100,5)}, maç sonucu için ${fmt(summary.maxOutcome*100,5)} yüzde puandı. Tolerans 0,05 yüzde puan. Sekiz iş parçacıklı çalışma ortamında maç başına süre medyan ${fmt(summary.medianSeconds)} sn, aralık ${fmt(summary.minSeconds)}–${fmt(summary.maxSeconds)} sn.`,
 table(['Dönem','Maç','Matematiksel kontrol','Maç sonucu aynı','İlk üç sıra aynı'],Object.entries(grouped).map(([key,x])=>[key,x.n,x.verified,x.winner,x.top3Order])),
 '9.924 maçın her biri için 100 milyon çekiliş ve gerçek telefon testi çalıştırılmadı.',
 '## Kaynaklar ve yeniden üretim',
 `[Maç sonuç arşivi](https://github.com/jalapic/engsoccerdata) · [TFF](https://www.tff.org/default.aspx?pageID=1768) · [Güncel maç verisi](https://github.com/oladeeayo/open-matchday) · [Olay arşivi](https://github.com/c0ze/super-lig)\n\nMaç girdisi SHA-256 \`${report.inputSha}\`\n\nOlay arşivi SHA-256 \`${s.events.sha}\``,
 'Ham veri yerel ölçümde kullanıldı. Makinece okunabilir özetler [event-validation.json](event-validation.json) dosyasındadır.',
 '```sh\npython tests/event-archive.py site.db exposure.private.json\nnode tests/event-study.mjs turkey.csv forecast-data tff-results.json exposure.private.json study.json\nnode tests/event-samples.mjs turkey.csv forecast-data tff-results.json samples.json\nnode tests/event-study-report.mjs study.json samples.json event-validation.json EVENT_CALIBRATION.md\n```'];
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(markdown,sections.join('\n\n')+'\n');
console.log(JSON.stringify(summary));
assert.equal(summary.verified,summary.completed);
