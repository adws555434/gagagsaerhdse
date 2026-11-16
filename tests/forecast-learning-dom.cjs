'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=fs.existsSync(path.join(__dirname,'index.html'))?__dirname:path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const truth=JSON.parse(fs.readFileSync(path.join(root,root===__dirname?'balanced-model-results.json':'tests/balanced-model-results.json'),'utf8'));
const shotReport=JSON.parse(fs.readFileSync(path.join(root,root===__dirname?'shot-backtest-results.json':'tests/shot-backtest-results.json'),'utf8'));
const turkeyReport=JSON.parse(fs.readFileSync(path.join(root,root===__dirname?'super-lig-research/results.json':'tests/super-lig-research/results.json'),'utf8'));
const signalPath=root===__dirname?'super-lig-data/results.json':'tests/super-lig-data/results.json';
const signalAudit=JSON.parse(fs.readFileSync(path.join(root,signalPath),'utf8'));
const phase2Report=fs.readFileSync(path.join(root,'phase2-market-report.json'),'utf8');
const marketSnapshot=fs.readFileSync(path.join(root,'market-snapshot.json'),'utf8');
const phase1Summary=JSON.parse(fs.readFileSync(path.join(root,'phase1-summary.json'),'utf8'));
const lineupArchive=fs.readFileSync(path.join(root,'lineup-samples.json'),'utf8');
const errors=[];
const consoleSink=new VirtualConsole();
consoleSink.on('jsdomError',e=>errors.push(e.message));
consoleSink.on('error',e=>errors.push(String(e)));
const max=60000;
const live=Boolean(process.env.FOOTBALL_LIVE_TEST);
const site='https://adws555434.github.io/gagagsaerhdse/';
const stem='date,time,home,away,ft_home,ft_away,home_shots,away_shots,home_target,away_target,home_corners,away_corners,home_yellow,away_yellow,ht_home,ht_away,goal_minutes';
const past=Array.from({length:35},(_,i)=>{
 const date=new Date(Date.parse('2026-08-01T00:00:00Z')+i*86400000).toISOString().slice(0,10);
 return date+',19:00,'+(i%2?'Besiktas,Galatasaray':'Galatasaray,Besiktas')+',2,1,11,9,4,3,6,4,1,2,1,0,"12,46,85"';
});
const fixDate='2098-12-01';
const fixture='date,time,home,away\n'+fixDate+',19:00,Besiktas,Galatasaray';
const archive=JSON.stringify({matches:Array.from({length:6},(_,i)=>({date:'2025-11-0'+(i+1),team1:'Beşiktaş',team2:'Galatasaray',score:[i%3,0]}))});
const response=(text,ok=true)=>({ok,status:ok?200:404,text:async()=>text});
let feedMode='primary';
let oddsMode='unconfigured';
const feedCalls=new Map();
async function mock(url){
 feedCalls.set(url,(feedCalls.get(url)||0)+1);
 if(url.includes('phase2-market-report.json'))return response(phase2Report);
 if(url.includes('market-snapshot.json')){
  if(oddsMode==='unconfigured')return response(marketSnapshot);
  const captured=Date.now()-1000;
  return response(JSON.stringify({version:'2026.11-phase-2',state:'ready',
   capturedAt:new Date(captured).toISOString(),events:[{
    scope:'TUR_1_super-lig',home:'Beşiktaş JK',away:'Galatasaray',
    kickoff:fixDate+'T18:00:00Z',quotedAt:new Date(captured-1000).toISOString(),
    totalQuotedAt:new Date(captured-1000).toISOString(),books:2,
    power:[.21,.27,.52],proportional:[.23,.27,.50],over25:.55
   }]}));
 }
 if(url.includes('phase1-summary.json'))return response(JSON.stringify(phase1Summary));
 if(url.includes('lineup-samples.json'))return response(lineupArchive);
 if(url.includes('super-lig-data/results'))return response(JSON.stringify(signalAudit));
 if(url.includes('super-lig-research/results'))return response(JSON.stringify(turkeyReport));
 if(url.includes('forecast-ledger'))return response(JSON.stringify({checked:'2026-11-16T00:00:00Z',records:[]}));
 if(url.includes('balanced-model-results'))return response(JSON.stringify(truth));
 if(url.includes('shot-backtest-results'))return response(JSON.stringify(shotReport));
 if(url.includes('/nations-fixtures.json'))return response(JSON.stringify({matches:[]}));
 if(url.includes('international_results')){
  const rows=Array.from({length:14},(_,i)=>'2026-01-'+String(i+10)+',Turkey,Germany,1,1,Friendly,TRUE');
  return response('date,home_team,away_team,home_score,away_score,tournament,neutral\n'+rows.join('\n'));
 }
 if(url.includes('football.json'))return response(archive);
 if(!url.includes('TUR_1_super-lig'))return response('',false);
 if(feedMode==='offline')return response('',false);
 if(feedMode==='mirror'&&url.includes('cdn.jsdelivr.net'))return response('date,home,away,ft_home,ft_away\nnot-a-date,A,B,0,0');
 return response(url.includes('fixtures')?fixture:[stem,...past].join('\n'));
}
async function until(fn){
 const end=Date.now()+max;
 while(!fn()){
  if(Date.now()>end)throw Error('Timed out: '+fn.toString());
  await new Promise(resolve=>setTimeout(resolve,15));
 }
}
async function run(){
 const app=live?await (await fetch(site)).text():html;
 if(live)assert.match(app,/id="lineupAudit"/);
 const dom=new JSDOM(app,{url:site,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:consoleSink,beforeParse(w){
  w.TextEncoder=TextEncoder;
  Object.defineProperty(w.crypto,'subtle',{value:globalThis.crypto.subtle});
  w.fetch=(url,options)=>live?fetch(new URL(url,site),{cache:options?.cache,signal:AbortSignal.timeout(12000)}):mock(String(url));
 }});
 const {window}=dom,$=id=>window.document.getElementById(id);
 try{
  async function submit(a,b,national=false){
   $('a').value=a;$('b').value=b;$('nationalOnly').checked=national;$('go').click();
   await until(()=>!$('go').disabled);
   assert.match($('status').textContent,/Tamamlandı/,$('errText').textContent);
  }
  const examples=window.document.querySelectorAll('.example');
  examples[1].click();
  assert.equal($('a').value,'Türkiye');
  assert.equal($('b').value,'Almanya');
  assert.equal($('nationalOnly').checked,true);
  examples[0].click();
  assert.equal($('a').value,'Beşiktaş');
  assert.equal($('b').value,'Galatasaray');
  assert.equal($('nationalOnly').checked,false);
  assert.equal(window.document.activeElement,$('go'));
  await submit('Beşiktaş','Galatasaray');
  assert.equal($('archiveForm').querySelectorAll('section').length,2);
  assert.match($('matchHistoryScope').textContent,/Süper Lig maçları/);
  assert.match($('longForecast').textContent,/Uzun dönem tahmini · deneme/);
  assert.match($('forecast').querySelector('.score-value').textContent,/^\d+–\d+$/);
  assert.match($('forecast').querySelector('.score-winner').textContent,/kazanır|beraberlik/);
  const bars=[...$('forecast').querySelectorAll('.outcome-meter span')].map(node=>parseFloat(node.style.width));
  assert.equal(bars.length,3);
  assert.ok(Math.abs(bars.reduce((a,b)=>a+b,0)-100)<0.001);
  assert.equal($('scoreGridContent').querySelectorAll('tbody tr').length,11);
  assert.ok($('scoreGridContent').querySelector('.score-peak'));
  assert.match($('balancedModel').textContent,/Dengeli model/);
  assert.match($('workload').textContent,/son 7 \/ 14 gün/);
  assert.match($('learningModel').textContent,/İsabetli şut modeli/);
  $('lineupHome').value='-20';$('lineupRun').click();
  assert.match($('lineupResult').textContent,/yüzde puan/);
  $('scenarioTeam').value='custom';$('scenarioTeam').dispatchEvent(new window.Event('change'));
  $('scenarioMinute').value='90';$('scenarioHome').value='2';$('scenarioAway').value='1';$('scenarioRed').value='away';$('scenarioRun').click();
  await until(()=>!$('scenarioRun').disabled);
  assert.match($('scenarioResult').textContent,/kırmızı kart varsayımı.*2–1 Besiktas kazanır/);
  $('scenarioMinute').value='30';
  $('scenarioRun').click();
  $('scenarioCancel').click();
  await until(()=>!$('scenarioRun').disabled);
  assert.equal($('scenarioResult').textContent,'Senaryo iptal edildi.');
  $('historyLink').click();
  assert.equal($('historyPanel').open,true);
  await until(()=>$('leagueAudit').querySelectorAll('tbody tr').length===6);
  $('phase1Audit').open=true;
  await until(()=>$('phase1Models').querySelectorAll('tbody tr').length===5);
  assert.match($('phase1Status').textContent,new RegExp(phase1Summary.results['tr.1'][0].n+' ortak maç'));
  assert.equal($('phase1Tiers').querySelectorAll('tbody tr').length,4);
  const phase1League=$('phase1League');
  phase1League.value='all';phase1League.dispatchEvent(new window.Event('change'));
  await until(()=>$('phase1Status').textContent.includes(phase1Summary.results.all[0].n+' ortak maç'));
  assert.match($('phase1Models').textContent,/%95 GA/);
  assert.equal($('phase1Curve').querySelectorAll('polyline').length,3);
  assert.ok($('phase1Calibration').querySelectorAll('tbody tr').length>0);
  assert.ok($('phase1Months').querySelectorAll('tbody tr').length>0);
  $('marketAudit').open=true;
  await until(()=>$('marketAuditClose').querySelectorAll('tbody tr').length===7);
  assert.match($('marketAuditStatus').textContent,/ortak Pinnacle kapanış kaydı/);
  assert.equal($('marketAuditBlend').querySelectorAll('tbody tr').length,3);
  assert.equal($('marketAuditTiming').querySelectorAll('tbody tr').length,3);
  assert.equal($('marketAuditTimed').querySelectorAll('tbody tr').length,3);
  assert.match($('marketTimedCoverage').textContent,/48 saat ve üzeri/);
  assert.ok($('marketAuditTiers').querySelectorAll('tbody tr').length>=8);
  assert.equal($('marketAuditTotals').querySelectorAll('tbody tr').length,3);
  assert.equal($('marketResearchAttribution').hidden,false);
  const marketLeague=$('marketAuditLeague');
  marketLeague.value='all';marketLeague.dispatchEvent(new window.Event('change'));
  await until(()=>$('marketAuditTotals').querySelectorAll('tbody tr').length===5);
  assert.equal($('marketResearchAttribution').hidden,true);
  assert.match($('marketAuditClose').textContent,/%95 GA/);
  if(!live)assert.match($('marketStatus').textContent,/bağlı değil/);
  $('lineupAudit').open=true;
  await until(()=>$('lineupArchiveList').querySelectorAll('summary').length===3);
  assert.match($('lineupArchiveList').textContent,/Gençlerbirliği · 65 dk önce/);
  assert.equal($('lineupArchiveList').querySelectorAll('a').length,6);
  $('turkeyAudit').open=true;
  await until(()=>$('turkeyAuditContent').querySelectorAll('tbody tr').length===8);
  assert.match($('turkeyAuditStatus').textContent,/606 maçlık/);
  assert.match($('turkeyAuditContent').textContent,/332\/606/);
  assert.match($('turkeyAuditContent').textContent,/204\/606/);
  await until(()=>$('turkeySignalsContent').querySelectorAll('tbody tr').length===8);
  assert.match($('turkeySignalsStatus').textContent,/606 maçlık/);
  assert.ok($('turkeySignalsContent').textContent.includes('336/606'));
  assert.ok($('turkeySignalsContent').textContent.includes('1/54'));
  $('shotAudit').open=true;
  await until(()=>$('shotAuditContent').querySelectorAll('tbody tr').length>0);
  if(!live){
   const data={xg:[],players:[],lineups:[]};
   const day=fixDate;
   for(const team of ['Besiktas','Galatasaray']){
    for(let i=1;i<=5;i++){
     const date='2026-08-0'+i;
     const shared={team,opponent:'Rakip',date,publishedAt:date+'T20:00:00Z',source:'https://example.com/data'};
     data.xg.push({...shared,xg:1.53,xga:.98});
     data.players.push({...shared,player:'Örnek Oyuncu',minutes:90,goals:i===1?1:0,assists:0});
    }
    const opponent=team==='Besiktas'?'Galatasaray':'Besiktas';
    data.lineups.push({team,opponent,date:day,kickoff:day+'T18:00:00Z',source:'https://example.com/lineup',publishedAt:'2026-08-09T19:00:00Z',starters:Array.from({length:11},(_,i)=>'Oyuncu '+i),attackChange:team==='Besiktas'?-10:4});
   }
   Object.defineProperty($('evidenceFile'),'files',{value:[{size:1000,text:async()=>JSON.stringify(data)}],configurable:true});
   $('evidenceApply').click();
   await until(()=>$('evidenceOutput').textContent.includes('xG senaryosu'));
   assert.match($('evidenceOutput').textContent,/Örnek Oyuncu/);
   assert.match($('evidenceOutput').textContent,/dosyadaki ilk 11/);
   assert.equal($('lineupHome').value,'-10');
   const storageKey='football-intelligence-forecasts-v1';
   const records=JSON.parse(window.localStorage.getItem(storageKey));
   assert.equal(records.length,1);assert.equal(records[0].candidates.length,4);
   assert.match(records[0].dataSha256,/^[a-f0-9]{64}$/);assert.equal(records[0].simulationCount,100000);
   $('saveLineupTrial').click();
   assert.match($('lineupTrialStatus').textContent,/ilk tahminden sonraki yayın saati/);
   const publishedAt=new Date(Date.now()-60_000).toISOString();
   records[0].savedAt=Date.parse(publishedAt)-1000;
   for(const row of data.lineups)row.publishedAt=publishedAt;
   window.localStorage.setItem(storageKey,JSON.stringify(records));
   $('evidenceApply').click();
   await until(()=>$('saveLineupTrial').disabled===false);
   $('saveLineupTrial').click();
   assert.match($('lineupTrialStatus').textContent,/denemesi kaydedildi/);
   const saved=JSON.parse(window.localStorage.getItem(storageKey));
   assert.deepEqual(saved[0].probabilities,records[0].probabilities);
   assert.deepEqual(saved[0].lineupTrial.adjustments,[-10,4]);
   assert.match($('lineupAuditStatus').textContent,/1 kadro denemesi · 0 sonuçlanan maç/);
   saved[0].actual=[2,0];
   window.localStorage.setItem(storageKey,JSON.stringify(saved));
   window.renderHistory();
   assert.match($('lineupAuditStatus').textContent,/1 kadro denemesi · 1 sonuçlanan maç/);
   assert.equal($('lineupAuditScores').querySelectorAll('tbody tr').length,2);
   assert.match($('lineupAuditHistory').textContent,/Gerçek 2–0/);
  }
  await submit('Türkiye','Almanya',true);
  assert.match($('matchHistoryScope').textContent,/Erkek A milli maçları/);
  assert.equal($('longForecast').textContent,'');
  assert.equal($('balancedModel').textContent,'');
  assert.match($('learningModel').textContent,/yeterli isabetli şut kaydı/);
  if(!live){
   const nationalCache=JSON.parse(window.localStorage.getItem('football-verified-feed-v1:national/results'));
   assert.equal(nationalCache.rows.length,14);
   const folder='TUR_1_super-lig';
   const clearNetworkCache=()=>window.eval('cache.clear()');
   const key='football-verified-feed-v1:'+folder+'/results_2627.csv';
   const snapshot=JSON.parse(window.localStorage.getItem(key));
   assert.equal(snapshot.rows.length,35);
   clearNetworkCache();
   feedMode='mirror';
   await submit('Beşiktaş','Galatasaray');
   assert.match($('source').textContent,/Yedek veri bağlantısı/);
   clearNetworkCache();oddsMode='ready';
   await submit('Beşiktaş','Galatasaray');
   assert.equal($('marketComparison').querySelectorAll('tbody tr').length,3);
   assert.match($('marketComparison').textContent,/Piyasa skoru · test edilmedi/);
   assert.match($('marketTotals').textContent,/Piyasanın beklenen toplam golü/);
   assert.match($('activeForecastMethod').textContent,/Ana 1X2 · Piyasa · Alınma/);
   assert.match($('forecast').textContent,/Maç sonucu · PiyasaGalatasaray/);
   assert.match($('forecast').textContent,/Yayın modeli skoru/);
   oddsMode='unconfigured';
   clearNetworkCache();
   await submit('Beşiktaş','Galatasaray');
   assert.match($('activeForecastMethod').textContent,/Ana 1X2 · Yayın modeli/);
   oddsMode='unconfigured';
   clearNetworkCache();
   feedMode='offline';
   window.localStorage.removeItem('football-intelligence-forecasts-v1');
   await submit('Beşiktaş','Galatasaray');
   assert.match($('quality').textContent,/tarayıcı kopyası/);
   assert.match($('forecastNote').textContent,/Veri yetersiz/);
   assert.equal($('forecast').children.length,0);
   assert.equal(window.localStorage.getItem('football-intelligence-forecasts-v1'),null);
   window.localStorage.setItem(key,JSON.stringify({...snapshot,at:Date.now()-8*86400000}));
   const expired=await window.loadFolder(folder);
   assert.equal(expired.results.length,0);
   assert.equal(expired.partial,true);
   const parallelUrl='https://test.invalid/single-request';
   await Promise.allSettled([window.getText(parallelUrl),window.getText(parallelUrl)]);
   assert.equal(feedCalls.get(parallelUrl),1);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS club and national analysis, forecast cards, source file import, lineup, market and league audits, source failover, cache expiry and request coalescing.');
 }finally{window.close()}
}
run().catch(e=>{console.error(e);process.exitCode=1});
