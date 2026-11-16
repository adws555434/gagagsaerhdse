import {SCOPE,TRIALS,VERSION} from './super-lig-model.mjs';
import {buildInputs,parseArchive} from './forecast-input.mjs';
import {fixtureId} from './event-ledger.mjs';
import {runWorkers} from './event-parallel.mjs';

const number=new Intl.NumberFormat('tr-TR');
const percent=new Intl.NumberFormat('tr-TR',{style:'percent',maximumFractionDigits:3});
export function connectEventMode(app){
 const $=id=>document.getElementById(id);
 const run=$('eventRun'),cancel=$('eventCancel'),panel=$('eventPanel'),progress=$('eventProgress');
 const status=$('eventStatus'),answer=$('eventAnswer'),output=$('eventOutput'),history=$('eventHistory');
 let controller,archiveRequest;
 function finish(result,fixture,market,frozen){
  const [top]=result.top;
  const score=top.home+'–'+top.away;
  const winner=top.home>top.away?fixture.home+' kazanır':top.away>top.home?fixture.away+' kazanır':'Beraberlik';
  answer.textContent=winner+' · '+score;
  const describe=count=>number.format(count)+' kez · '+percent.format(count/result.n);
  $('eventPickCount').textContent='Bu skor '+describe(top.count)+'.';
  const scores=result.top.map(({home,away,count})=>[home+'–'+away,describe(count)]);
  $('eventScores').replaceChildren(app.dataTable(['En sık çıkan skor','Simülasyon sayısı ve ihtimali'],scores,true));
  $('eventCombined').textContent='Bu üç skordan biri · '+describe(result.top.reduce((sum,row)=>sum+row.count,0));
  $('eventOutcomes').replaceChildren(app.dataTable(['Maç sonucu','Simülasyon sayısı ve ihtimali'],
   [fixture.home+' kazanır','Beraberlik',fixture.away+' kazanır'].map((name,i)=>[name,describe(result.outcomes[i])]),true));
  status.textContent=(frozen?'Maçtan önce kaydedilen sonuç':'Simülasyon tamamlandı')+
   ' · '+number.format(result.n)+' maç · '+(market?'Takım modeli ve piyasa':'Takım modeli');
  progress.value=TRIALS;
  output.classList.remove('hidden');
  history.textContent='Geçmiş başarı raporu yükleniyor…';
  app.getText('./event-validation.json').then(JSON.parse).then(report=>{
   if(report.version!==VERSION)throw Error('Rapor sürümü uyuşmuyor.');
   const a=report.full100m??report.analytic, samples=report.full100mSample;
   const line=(name,row)=>name+' '+app.accuracyLabel(row.hits,row.n);
   history.textContent='Geçmiş Süper Lig · '+(report.full100mAllFixtures==='passed'?'100 milyonluk geçmiş test':'Analitik geçmiş test')+
    ' · '+[line('Kazanan veya beraberlik',a.winner),line('Tam skor',a.score),line('İlk üç skor',a.top3)].join(' · ')+
    (report.full100mAllFixtures==='passed'?'':' · 100 milyon çekiliş '+samples.length+' geçmiş maçta ayrıca doğrulandı.');
  }).catch(()=>{history.textContent='Geçmiş başarı raporuna ulaşılamadı.';});
 }
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
    const saved=await app.getText('./event-forecast-ledger.json').then(JSON.parse).catch(()=>null);
    abort.signal.throwIfAborted();
    const frozen=saved?.records?.find(row=>row.id===fixtureId(fixture,app)&&row.version===VERSION&&
     row.kickoff===app.knownKickoff(fixture)&&row.savedAt<row.kickoff&&row.result.n===TRIALS);
    if(frozen){finish(frozen.result,fixture,frozen.market,true);return;}
   }
   if(!archiveRequest)archiveRequest=app.getText('./event-model-state.json').then(parseArchive).catch(error=>{archiveRequest=null;throw error;});
   const [archive,quotes]=await Promise.all([archiveRequest,scheduled?
    Promise.allSettled(app.MARKET_SNAPSHOT_URLS.map(url=>app.getText(url).then(JSON.parse))):[]]);
   abort.signal.throwIfAborted();
   const price=quotes.flatMap(x=>x.status==='fulfilled'&&x.value.version===app.MARKET_VERSION?
    [app.findMarketQuote(x.value,SCOPE,fixture,Date.now())]:[]).filter(x=>x?.over25!=null)
    .sort((x,y)=>Date.parse(y.capturedAt)-Date.parse(x.capturedAt))[0];
   const today=new Date().toISOString().slice(0,10);
   const input=await buildInputs(data.results,today,app,archive)(fixture,price);
   if(!input)throw Error('Veri yetersiz. İki takımın da en az beş geçmiş maçı gerekli.');
   status.textContent=(scheduled?'':'Fikstür bulunamadı, yazdığın sıra ev sahibi ve deplasman olarak kullanılıyor. ')+'Maç simüle ediliyor…';
   const result=await runWorkers({...input,signal:abort.signal,WorkerClass:globalThis.Worker,
    workerCount:Math.max(1,Math.min(8,navigator.hardwareConcurrency??2)),
    onProgress:(done,total)=>{
     progress.value=done;
     status.textContent=done===total?'Analitik skor matrisiyle karşılaştırılıyor…':number.format(done)+' / '+number.format(total)+' maç';
    }});
   finish(result,fixture,input.input.market,false);
  }catch(error){
   status.textContent=abort.signal.aborted?'Simülasyon iptal edildi.':error.message||'Simülasyon tamamlanamadı.';
  }finally{
   run.disabled=false;
   cancel.disabled=true;
   controller=null;
  }
 });
}
