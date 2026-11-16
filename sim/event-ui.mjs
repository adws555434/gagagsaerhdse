import {SCOPE,TRIALS,VERSION} from './super-lig-model.mjs';
import {buildInputs,parseArchive} from './forecast-input.mjs';
import {frozenEventFor} from './event-ledger.mjs?v=2';
import {runWorkers} from './event-parallel.mjs?v=2';
import {analyticMatrix,outcomeOf,summarize} from './event-engine.mjs';

const number=new Intl.NumberFormat('tr-TR');
const percent=new Intl.NumberFormat('tr-TR',{style:'percent',maximumFractionDigits:3});
const displayPercent=new Intl.NumberFormat('tr-TR',{style:'percent',minimumFractionDigits:1,maximumFractionDigits:1});
const date=new Intl.DateTimeFormat('tr-TR',{dateStyle:'long',timeZone:'UTC'});
const historicalPercent=new Intl.NumberFormat('tr-TR',{style:'percent',maximumFractionDigits:2,minimumFractionDigits:2});
function resultRows(rows){
 return rows.map(({label,value,highlight=false,probability})=>{
  const item=document.createElement('li');
  const name=document.createElement('span'),amount=document.createElement('strong');
  item.className='event-probability'+(highlight?' is-favorite':'');
  name.textContent=label;
  amount.textContent=value;
  item.append(name,amount);
  if(probability!=null){
   const meter=document.createElement('span'),fill=document.createElement('i');
   meter.className='event-meter';
   meter.setAttribute('aria-hidden','true');
   fill.style.width=probability*100+'%';
   meter.append(fill);item.append(meter);
  }
  return item;
 });
}
export function connectEventMode(app){
 const $=id=>document.getElementById(id);
 const cancel=$('eventCancel'),panel=$('eventPanel'),progress=$('eventProgress');
 const status=$('eventStatus'),answer=$('eventAnswer'),output=$('eventOutput'),history=$('eventHistory');
 let controller,archiveRequest;
 const name=app.displayTeamName;
 const outcomes=fixture=>[name(fixture.home)+' kazanır','Beraberlik',name(fixture.away)+' kazanır'];
 const archive=()=>archiveRequest??=app.getText('./event-model-state.json').then(parseArchive)
  .catch(error=>{archiveRequest=null;throw error;});
 const markets=async()=>(await Promise.allSettled(app.MARKET_SNAPSHOT_URLS.map(url=>app.getText(url).then(JSON.parse))))
  .flatMap(x=>x.status==='fulfilled'&&x.value.version===app.MARKET_VERSION?[x.value]:[]);
 const oddsFor=(quotes,fixture,now)=>quotes.map(feed=>app.findMarketQuote(feed,SCOPE,fixture,now))
  .filter(quote=>quote?.over25!=null).sort((x,y)=>Date.parse(y.capturedAt)-Date.parse(x.capturedAt))[0];
 const ledger=async()=>{
  const feeds=await Promise.allSettled(app.EVENT_LEDGER_URLS.map(url=>app.getText(url).then(JSON.parse)));
  return feeds.flatMap(feed=>feed.status==='fulfilled'&&feed.value?.version===VERSION&&Array.isArray(feed.value.records)
   ?feed.value.records:[]);
 };
 function finish(result,fixture,market,frozen,seconds){
  const top=result.pick;
  const labels=outcomes(fixture);
  const scoreLabel=(home,away)=>{
   const score=home+'–'+away;
   const outcome=outcomeOf(home,away);
   if(outcome===1)return score+' beraberlik';
   const winner=outcome===0?fixture.home:fixture.away;
   return name(winner)+' '+score+' kazanır';
  };
  answer.textContent=result.winner===1?'En olası sonuç beraberlik':'Favori '+name(result.winner===0?fixture.home:fixture.away);
  const scoreMark=document.createElement('strong');
  scoreMark.textContent=scoreLabel(top.home,top.away);
  $('eventPickCount').replaceChildren('Skor tahmini ',scoreMark,' · '+displayPercent.format(top.count/result.n)+' ihtimal');
  const scores=result.top.map(({home,away,count})=>({label:scoreLabel(home,away),count}));
  const results=labels.map((label,i)=>({label,count:result.outcomes[i],highlight:i===result.winner}));
  const show=({label,count,highlight})=>({label,value:displayPercent.format(count/result.n),highlight,probability:count/result.n});
  $('eventScores').replaceChildren(...resultRows(scores.map(show)));
  const combined=scores.reduce((sum,row)=>sum+row.count,0);
  $('eventCombined').textContent='Bu üç skordan birinin gelme ihtimali '+displayPercent.format(combined/result.n);
  $('eventOutcomes').replaceChildren(...resultRows(results.map(show)));
  $('eventCounts').replaceChildren(...resultRows([...results,...scores,{label:'Üç skorun toplamı',count:combined}].map(({label,count})=>({
   label,value:number.format(count)+' kez · '+percent.format(count/result.n)
  }))));
  $('eventMethod').textContent=number.format(result.n)+' simülasyon · '+(market?'Takım modeli ve piyasa oranları':'Takım modeli')+
   (seconds==null?'':' · '+new Intl.NumberFormat('tr-TR',{maximumFractionDigits:2}).format(seconds)+' sn');
  status.textContent=frozen?'Maçtan önce kaydedilen tahmin gösteriliyor.':'';
  $('eventFixture').textContent=name(fixture.home)+' – '+name(fixture.away)+(fixture.time?' · '+date.format(new Date(fixture.date)):'');
  progress.value=TRIALS;
  output.classList.remove('hidden');
  history.textContent='Geçmiş başarı raporu yükleniyor…';
  app.getText('./event-validation.json').then(JSON.parse).then(report=>{
   if(report.version!==VERSION)throw Error('Rapor sürümü uyuşmuyor.');
   const a=report.full100m??report.analytic;
   const explanation=document.createElement('p'),list=document.createElement('ul');
   explanation.className='muted tiny';
   explanation.textContent=number.format(a.winner.n)+' geçmiş Süper Lig maçındaki isabet oranları';
   list.className='event-probabilities';
   list.append(...resultRows([
    ['Maç sonucunu bildi',a.winner],['Yukarıdaki tek skor tahminini bildi',a.score],['Gerçek skor ilk üçe girdi',a.top3]
   ].map(([label,row])=>({label,value:historicalPercent.format(row.rate)}))));
   history.replaceChildren(explanation,list);
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
    const frozen=frozenEventFor(saved,fixture,app,now);
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
 return async ({a:home,b:away,results,fixtures,partial,cached})=>{
  if(controller)return;
  panel.classList.remove('hidden');
  output.classList.add('hidden');
  answer.textContent='';
  progress.value=0;
  $('eventTechnical').open=false;
  $('eventHistoryDetails').open=false;
  const abort=new AbortController();
  controller=abort;
  cancel.disabled=false;
  $('eventProgressRow').classList.remove('hidden');
  status.textContent='Süper Lig fikstürü ve geçmiş maçlar kontrol ediliyor…';
  try{
   if(partial||cached)throw Error('Veri yetersiz. Güncel Süper Lig kaynağına ulaşılamadı.');
   const scheduled=app.direct(home,away,fixtures.filter(fixture=>app.knownKickoff(fixture)>Date.now()));
   const fixture=scheduled??{home,away,date:new Date().toISOString().slice(0,10)};
   if(scheduled){
    const saved=await ledger();
    abort.signal.throwIfAborted();
    const frozen=frozenEventFor(saved,fixture,app);
    if(frozen){finish(frozen.result,fixture,frozen.market,true);return;}
   }
   if(!globalThis.Worker)throw Error('Bu tarayıcı paralel simülasyonu desteklemiyor.');
   const [state,quotes]=await Promise.all([archive(),scheduled?markets():[]]);
   abort.signal.throwIfAborted();
   const price=scheduled?oddsFor(quotes,fixture,Date.now()):null;
   const today=new Date().toISOString().slice(0,10);
   const input=await buildInputs(results,today,app,state)(fixture,price);
   abort.signal.throwIfAborted();
   if(!input)throw Error('Veri yetersiz. İki takımın da en az beş geçmiş maçı gerekli.');
   status.textContent=(scheduled?'':'Fikstür bulunamadı, yazdığın sıra ev sahibi ve deplasman olarak kullanılıyor. ')+'Maç simüle ediliyor…';
   const start=performance.now();
   const result=await runWorkers({...input,signal:abort.signal,WorkerClass:globalThis.Worker,
    workerUrl:app.workerUrl,
    workerCount:Math.max(1,Math.min(8,navigator.hardwareConcurrency??2)),
    onProgress:(done,total)=>{
     progress.value=done;
     status.textContent=done===total?'Sonuçlar kontrol ediliyor…':'Simülasyon sürüyor · '+Math.floor(100*done/total)+'%';
    }});
   finish(result,fixture,input.input.market,false,(performance.now()-start)/1000);
  }catch(error){
   status.textContent=abort.signal.aborted?'Simülasyon iptal edildi.':error.message||'Simülasyon tamamlanamadı.';
  }finally{
   cancel.disabled=true;
   $('eventProgressRow').classList.add('hidden');
   controller=null;
  }
 };
}
