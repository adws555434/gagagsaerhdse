import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Worker} from 'node:worker_threads';
import {createRequire} from 'node:module';
import {connectEventMode} from '../sim/event-ui.mjs';
import {fixtureId} from '../sim/event-ledger.mjs';
import {VERSION,TRIALS} from '../sim/super-lig-model.mjs';

const {JSDOM}=createRequire(import.meta.url)('jsdom');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const model=JSON.parse(fs.readFileSync(new URL('../event-model-state.json',import.meta.url),'utf8'));
const validation=JSON.parse(fs.readFileSync(process.env.EVENT_VALIDATION_PATH??new URL('../event-validation.json',import.meta.url),'utf8'));
const before=Date.now();
const fixture={home:'Besiktas',away:'Galatasaray',date:'2098-12-01',time:'19:00'};
const kickoff=Date.parse(fixture.date+'T18:00:00Z');
const fixtureResults=Array.from({length:12},(_,i)=>({
 date:'2026-08-'+String(i+1).padStart(2,'0'),home:'Besiktas',away:'Galatasaray',ft_home:1,ft_away:1
}));
const data={results:fixtureResults,fixtures:[fixture],partial:false,cached:false};
let browserWorkers=0;
class BrowserWorker {
 constructor(url,options){
  assert.equal(options.type,'module');
  browserWorkers++;
  this.worker=new Worker(url);
  this.worker.on('message',data=>this.onmessage({data}));
  this.worker.on('error',error=>this.onerror(error));
 }
 postMessage(message){this.worker.postMessage(message);}
 terminate(){return this.worker.terminate();}
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(predicate){
 const deadline=Date.now()+90000;
 while(Date.now()<deadline){if(predicate())return;await sleep(40);}
 throw Error('Süre aşıldı: '+document.getElementById('eventStatus').textContent);
}
test('new mode cancels, rejects insufficient data, runs 100 million, and reuses frozen predictions',async()=>{
 const dom=new JSDOM(html);
 globalThis.document=dom.window.document;
 const originalWorker=globalThis.Worker;
 const oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 globalThis.Worker=BrowserWorker;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{hardwareConcurrency:6}});
 const $=id=>document.getElementById(id);
 const app={
  clubModelKey:name=>name.toLowerCase(),loadFolder:async()=>data,
  findTeam:(q,rows)=>rows.some(r=>r.home===q||r.away===q)?q:null,
  direct:()=>fixture,knownKickoff:()=>kickoff,findMarketQuote:()=>null,
  MARKET_SNAPSHOT_URLS:[],dataTable:(headers,rows)=>{const t=document.createElement('div');t.textContent=rows.flat().join(' ');return t;},
  getText:async url=>JSON.stringify(url.includes('model-state')?model:url.includes('validation')?validation:frozen)
 };
 let frozen={records:[]};
 try{
  const run=connectEventMode(app);
  const match={...data,a:fixture.home,b:fixture.away};
  await run({...match,partial:true});
  assert.match($('eventStatus').textContent,/Veri yetersiz/);
  const cancelled=run(match);
  await wait(()=>$('eventProgress').value>0);
  $('eventCancel').click();
  await cancelled;
  assert.match($('eventStatus').textContent,/iptal/);
  assert.ok($('eventOutput').classList.contains('hidden'));
  const started=Date.now();
  await run(match);
  assert.equal($('eventProgress').value,TRIALS);
  assert.match($('eventStatus').textContent,/100\.000\.000/);
  assert.match($('eventAnswer').textContent,/\d+–\d+/);
  assert.match($('eventPickCount').textContent,/kez/);
  assert.match($('eventCombined').textContent,/üç skordan/);
  await wait(()=>$('eventHistory').textContent.includes('%53,25'));
  const running=browserWorkers;
  frozen={records:[{id:fixtureId(fixture,app),version:VERSION,kickoff,savedAt:before,result:{
   n:TRIALS,outcomes:[47_000_000,29_000_000,24_000_000],winner:0,pick:{home:2,away:1,count:10_000_000},
   top:[{home:1,away:1,count:15_000_000},{home:2,away:1,count:10_000_000},{home:1,away:0,count:9_000_000}]
  }}]};
  await run(match);
  assert.equal(browserWorkers,running);
  assert.equal($('eventAnswer').textContent,'Besiktas kazanır · 2–1');
  assert.match($('eventScores').textContent,/^1–1/);
  assert.match($('eventStatus').textContent,/önce kaydedilen/);
  $('predictableMatches').open=true;
  await wait(()=>$('eventPredictableList').textContent.includes('Besiktas'));
  assert.match($('eventPredictableList').textContent,/34/);
  assert.equal(browserWorkers,running);
  console.log(JSON.stringify({trials:TRIALS,workers:running,seconds:(Date.now()-started)/1000}));
 }finally{
  dom.window.close();
  delete globalThis.document;
  globalThis.Worker=originalWorker;
  if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);
 }
});
