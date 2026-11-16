import {SCOPE,TRIALS,VERSION} from './super-lig-model.mjs';
import {buildInputs,parseArchive} from './forecast-input.mjs';
import {fixtureId} from './event-ledger.mjs';
import {runWorkers} from './event-parallel.mjs';
import {analyticMatrix,summarize} from './event-engine.mjs';

const number=new Intl.NumberFormat('tr-TR');
const percent=new Intl.NumberFormat('tr-TR',{style:'percent',maximumFractionDigits:3});
const historicalPercent=new Intl.NumberFormat('tr-TR',{style:'percent',maximumFractionDigits:2,minimumFractionDigits:2});
export function connectEventMode(app){
 const $=id=>document.getElementById(id);
 const run=$('eventRun'),cancel=$('eventCancel'),panel=$('eventPanel'),progress=$('eventProgress');
 const status=$('eventStatus'),answer=$('eventAnswer'),output=$('eventOutput'),history=$('eventHistory');
 let controller,archiveRequest;
 const outcomes=fixture=>[fixture.home+' kazanır','Beraberlik',fixture.away+' kazanır'];
 const archive=()=>archiveRequest??=app.getText('./event-model-state.json').then(parseArchive)
  .catch(error=>{archiveRequest=null;throw error;});
 const markets=async()=>(await Promise.allSettled(app.MARKET_SNAPSHOT_URLS.map(url=>app.getText(url).then(JSON.parse))))
  .flatMap(x=>x.status==='fulfilled'&&x.value.version===app.MARKET_VERSION?[x.value]:[]);
 const oddsFor=(quotes,fixture,now)=>quotes.map(feed=>app.findMarketQuote(feed,SCOPE,fixture,now))
  .filter(quote=>quote?.over25!=null).sort((x,y)=>Date.parse(y.capturedAt)-Date.parse(x.capturedAt))[0];
 const ledger=()=>app.getText('./event-forecast-ledger.json').then(JSON.parse).catch(()=>null);
 function frozenFor(saved,fixture){
  return saved?.records?.find(row=>row.id===fixtureId(fixture,app)&&row.version===VERSION&&
   row.kickoff===app.knownKickoff(fixture)&&row.savedAt<row.kickoff&&row.result.n===TRIALS&&row.result.pick);
 }
 function finish(result,fixture,market,frozen,seconds){
  const top=result.pick;
  const score=top.home+'–'+top.away;
  answer.textContent=outcomes(fixture)[result.winner]+' · '+score;
  const describe=count=>number.format(count)+' kez · '+percent.format(count/result.n);
  $('eventPickCount').textContent='Bu skor '+describe(top.count)+'.';
  const scores=result.top.map(({home,away,count})=>[home+'–'+away,describe(count)]);
  $('eventScores').replaceChildren(app.dataTable(['Bütün skorlar içinde en sık çıkan 3 skor','Simülasyon sayısı ve ihtimali'],scores,true));
  $('eventCombined').textContent='Bu üç skordan biri · '+describe(result.top.reduce((sum,row)=>sum+row.count,0));
  $('eventOutcomes').replaceChildren(app.dataTable(['Maç sonucu','Simülasyon sayısı ve ihtimali'],
   outcomes(fixture).map((name,i)=>[name,describe(result.outcomes[i])]),true));
  status.textContent=(frozen?'Maçtan önce kaydedilen sonuç':'Simülasyon tamamlandı')+
   ' · '+number.format(result.n)+' maç · '+(market?'Takım modeli ve piyasa':'Takım modeli')+
   (seconds==null?'':' · '+new Intl.NumberFormat('tr-TR',{maximumFractionDigits:2}).format(seconds)+' sn');
  $('eventFixture').textContent=fixture.home+' – '+fixture.away+(fixture.time?' · '+fixture.date:'');
  progress.value=TRIALS;
  output.classList.remove('hidden');
  history.textContent='Geçmiş başarı raporu yükleniyor…';
  app.getText('./event-validation.json').then(JSON.parse).then(report=>{
   if(report.version!==VERSION)throw Error('Rapor sürümü uyuşmuyor.');
   const a=report.full100m??report.analytic, samples=report.sampleSummary?.verified??report.full100mSample.length;
   const line=(name,row)=>name+' '+number.format(row.hits)+'/'+number.format(row.n)+' · '+historicalPercent.format(row.rate)+
    ' · %95 aralık '+row.ci95.map(value=>historicalPercent.format(value)).join('–');
   history.textContent='Geçmiş Süper Lig · '+(report.full100mAllFixtures==='passed'?'100 milyonluk geçmiş test':'Analitik geçmiş test')+
    ' · '+[line('Kazanan veya beraberlik',a.winner),line('Kazananla uyumlu skor',a.score),line('Genel en sık skor',a.globalScore),line('İlk üç skor',a.top3)].join(' · ')+
    (report.full100mAllFixtures==='passed'?'':' · 100 milyon çekiliş '+samples+' geçmiş maçta ayrıca doğrulandı.');
  }).catch(()=>{history.textContent='Geçmiş başarı raporuna ulaşılamadı.';});
 }
 const ranking=$('predictableMatches');
 ranking.addEventListener('toggle',async()=>{
  if(!ranking.open)return;
  const message=$('eventPredictableStatus'),list=$('eventPredictableList');
  message.textContent='Kesin Tahmin sıralaması yükleniyor…';
  list.replaceChildren();
  try{
   const [data,state,quotes,saved]=await Promise.all([app.loadFolder(SCOPE),archive(),markets(),ledger()]);
   if(data.partial||data.cached)throw Error('Veri yetersiz.');
   const now=Date.now(),today=new Date(now).toISOString().slice(0,10);
   const prepare=buildInputs(data.results,today,app,state);
   const rows=[];
   let chunkStarted=performance.now();
   for(const fixture of data.fixtures){
    if(!(app.knownKickoff(fixture)>now))continue;
    const frozen=frozenFor(saved,fixture);
    if(frozen){
     const {top,n}=frozen.result;
     rows.push({fixture,top:top.map(row=>({...row,count:row.count/n}))});
    }else{
     const prepared=await prepare(fixture,oddsFor(quotes,fixture,now));
     if(prepared)rows.push({fixture,top:summarize(analyticMatrix(prepared.input).matrix).top});
    }
    if(performance.now()-chunkStarted>25){
     await new Promise(resolve=>setTimeout(resolve,0));
     chunkStarted=performance.now();
    }
   }
   const sorted=rows.map(row=>({...row,total:row.top.reduce((sum,score)=>sum+score.count,0)}))
    .sort((a,b)=>b.total-a.total||app.knownKickoff(a.fixture)-app.knownKickoff(b.fixture));
   message.textContent=sorted.length?'İlk üç skorun toplam ihtimaline göre sıralandı.':'Yeterli verisi olan yaklaşan maç yok.';
   if(sorted.length)list.append(app.dataTable(['Maç','İlk üç skor','Toplam ihtimal'],sorted.map(({fixture,top,total})=>[
    fixture.home+' – '+fixture.away+' · '+fixture.date,
    top.map(({home,away,count})=>home+'–'+away+' '+percent.format(count)).join(' / '),percent.format(total)
   ]),true));
  }catch{
   message.textContent='Kesin Tahmin sıralaması için veri yetersiz.';
  }
 });
 cancel.addEventListener('click',()=>controller?.abort());
 run.addEventListener('click',async()=>{
  if(run.disabled||$('go').disabled)return;
  const a=$('a').value.trim(),b=$('b').value.trim();
  if(!a||!b||app.clubModelKey(a)===app.clubModelKey(b)){
   panel.classList.remove('hidden');
   status.textContent='İki farklı Süper Lig takımı yaz.';
   output.classList.add('hidden');
   return;
  }
  panel.classList.remove('hidden');
  output.classList.add('hidden');
  answer.textContent='';
  progress.value=0;
  const abort=new AbortController();
  controller=abort;
  run.disabled=true;
  cancel.disabled=false;
  status.textContent='Süper Lig fikstürü ve geçmiş maçlar kontrol ediliyor…';
  try{
   if($('nationalOnly').checked)throw Error('Bu mod şu anda yalnızca Süper Lig için çalışıyor.');
   if(!globalThis.Worker)throw Error('Bu tarayıcı paralel simülasyonu desteklemiyor.');
   const data=await app.loadFolder(SCOPE);
   abort.signal.throwIfAborted();
   if(data.partial||data.cached)throw Error('Veri yetersiz. Güncel Süper Lig kaynağına ulaşılamadı.');
   const rows=data.results.concat(data.fixtures);
   const home=app.findTeam(a,rows),away=app.findTeam(b,rows);
   if(!home||!away||home===away)throw Error('Veri yetersiz. İki farklı Süper Lig takımı bulunamadı.');
   const scheduled=app.direct(home,away,data.fixtures.filter(fixture=>app.knownKickoff(fixture)>Date.now()));
   const fixture=scheduled??{home,away,date:new Date().toISOString().slice(0,10)};
   if(scheduled){
    const saved=await ledger();
    abort.signal.throwIfAborted();
    const frozen=frozenFor(saved,fixture);
    if(frozen){finish(frozen.result,fixture,frozen.market,true);return;}
   }
   const [state,quotes]=await Promise.all([archive(),scheduled?markets():[]]);
   abort.signal.throwIfAborted();
   const price=scheduled?oddsFor(quotes,fixture,Date.now()):null;
   const today=new Date().toISOString().slice(0,10);
   const input=await buildInputs(data.results,today,app,state)(fixture,price);
   if(!input)throw Error('Veri yetersiz. İki takımın da en az beş geçmiş maçı gerekli.');
   status.textContent=(scheduled?'':'Fikstür bulunamadı, yazdığın sıra ev sahibi ve deplasman olarak kullanılıyor. ')+'Maç simüle ediliyor…';
   const start=performance.now();
   const result=await runWorkers({...input,signal:abort.signal,WorkerClass:globalThis.Worker,
    workerCount:Math.max(1,Math.min(8,navigator.hardwareConcurrency??2)),
    onProgress:(done,total)=>{
     progress.value=done;
     status.textContent=done===total?'Analitik skor matrisiyle karşılaştırılıyor…':number.format(done)+' / '+number.format(total)+' maç';
    }});
   finish(result,fixture,input.input.market,false,(performance.now()-start)/1000);
  }catch(error){
   status.textContent=abort.signal.aborted?'Simülasyon iptal edildi.':error.message||'Simülasyon tamamlanamadı.';
  }finally{
   run.disabled=false;
   cancel.disabled=true;
   controller=null;
  }
 });
}
