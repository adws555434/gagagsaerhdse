'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const manifest=require('./phase2-timing-inputs.json');
const root=fs.existsSync(path.join(__dirname,'index.html'))?__dirname:path.resolve(__dirname,'..');
const scripts=fs.existsSync(path.join(__dirname,'market-snapshot.cjs'))?__dirname:path.join(root,'scripts');
const {summarizeEvent,SPORTS}=require(path.join(scripts,'market-snapshot.cjs'));
const hour=3600000;
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const iso=ms=>new Date(ms).toISOString();
const captureWindows={early:6*hour,dayBefore:24*hour,preKickoff:1000};
const fixtures={
 turkey1:'TUR_1_super-lig',premier:'ENG_1_premier-league',spain1:'ESP_1_la-liga',
 germany1:'GER_1_bundesliga',italy1:'ITA_1_serie-a',france1:'FRA_1_ligue-1'
};

async function pinnedInput(folder,input){
 fs.mkdirSync(folder,{recursive:true});
 const filename=path.join(folder,input.file);
 if(!fs.existsSync(filename)){
  const response=await fetch(input.url,{signal:AbortSignal.timeout(30_000)});
  if(!response.ok)throw Error('Sabit kaynak alınamadı: '+input.file+' HTTP '+response.status);
  const data=Buffer.from(await response.arrayBuffer());
  assert.equal(sha256(data),input.sha256,input.file);
  fs.writeFileSync(filename,data);
 }
 const bytes=fs.readFileSync(filename);
 assert.equal(sha256(bytes),input.sha256,input.file);
 return bytes;
}

function attachTrackTimes(matches,records){
 const byId=new Map();
 for(const record of records){
  const key=String(record.id);
  byId.set(key,byId.has(key)?null:record);
 }
 const rows=[],excluded={};
 for(const match of matches){
  const quote=match.quote;
  const record=byId.get(String(quote?.id));
  const logged=Date.parse(record?.logged_at_utc);
  const stamp=record?.pin_filled_at_utc==null?logged:Date.parse(record.pin_filled_at_utc);
  const reason=!record||quote.recordHash!==record.hash||Date.parse(record.kickoff_utc)!==quote.kickoff?'identity':
   !match.open||record.logged_before_kickoff!==1||record.settled!==1||record.void_reason||
    record.teams_reversed_after_logging!==0?'record_status':
   logged<Date.parse('2026-09-30T00:00:00Z')?'fill_timestamp_not_tracked':
   !(Number.isFinite(logged)&&Number.isFinite(stamp)&&logged<=stamp&&stamp<quote.kickoff)?'invalid_time':
   quote.kickoff-stamp<hour?'under_one_hour':null;
  if(reason){excluded[reason]=(excluded[reason]??0)+1;continue;}
  rows.push({...match,leadHours:(quote.kickoff-stamp)/hour});
 }
 return {rows,excluded};
}

function inspectHistorical(scope,payload,requested,maxLag){
 const stamp=Date.parse(payload?.timestamp);
 if(!Object.hasOwn(SPORTS,scope)||!Number.isFinite(stamp)||stamp>requested||requested-stamp>maxLag||
  !Array.isArray(payload.data)||payload.data.some(row=>!row?.id||row.sport_key!==SPORTS[scope])){
  throw Error('Tarihsel görüntü zamanı veya biçimi geçersiz');
 }
 const ids=new Set();
 const accepted=[];
 for(const event of payload.data){
  if(ids.has(event.id))throw Error('Tarihsel görüntüde mükerrer maç');
  ids.add(event.id);
  const row=summarizeEvent(event,scope,stamp);
  if(row)accepted.push({...row,capturedAt:iso(stamp),requestedAt:iso(requested)});
 }
 return accepted;
}

function requestPlan(app,text,{reuseEarly=false}={}){
 const rows=app.checkedCsv(text,['league','season','kickoff_utc','home_team','away_team','home_goals','away_goals']);
 const kickoffGroups=new Map();
 const counts={};
 const fixtureRows=[];
 for(const row of rows){
  const scope=fixtures[row.league];
  if(!scope||!['2023-2024','2024-2025','2025-2026'].includes(row.season))continue;
  const kickoff=Date.parse(row.kickoff_utc);
  assert.ok(Number.isFinite(kickoff)&&row.kickoff_utc.endsWith('Z')&&row.home_team&&row.away_team);
  const group=scope+'|'+row.season;
  if(reuseEarly&&scope===fixtures.turkey1)fixtureRows.push({
   season:row.season,kickoff:iso(kickoff),home:row.home_team,away:row.away_team
  });
  counts[group]=(counts[group]??0)+1;
  const key=scope+'|'+kickoff;
  if(!kickoffGroups.has(key))kickoffGroups.set(key,{scope,kickoff,fixtures:0});
  kickoffGroups.get(key).fixtures++;
 }
 const groups=[...kickoffGroups.values()].sort((a,b)=>a.kickoff-b.kickoff||a.scope.localeCompare(b.scope));
 const requests=groups.flatMap(({scope,kickoff,fixtures:count})=>{
  const reuse=reuseEarly&&scope===fixtures.turkey1;
  const windows=reuse?[['reuseEarly',1000]]:[['early',captureWindows.early],['preKickoff',60000]];
  return windows.map(([kind,lead])=>({scope,kind,kickoff:iso(kickoff),asOf:iso(kickoff-lead),fixtures:count}));
 });
 const leagues=Object.fromEntries(Object.keys(SPORTS).map(scope=>{
  const teamGroups=groups.filter(g=>g.scope===scope);
  const count=teamGroups.reduce((sum,g)=>sum+g.fixtures,0);
  const calls=requests.filter(r=>r.scope===scope).length;
  return [scope,{fixtures:count,kickoffGroups:teamGroups.length,calls,creditCeiling:calls*20}];
 }));
 return {counts,leagues,fixtures:groups.reduce((sum,g)=>sum+g.fixtures,0),kickoffGroups:groups.length,
  calls:requests.length,creditCeiling:requests.length*20,requests,fixtureRows};
}

function validWindow(kind,lead){
 if(kind==='reuseEarly')return lead===1000;
 return Object.hasOwn(captureWindows,kind)&&(lead===captureWindows[kind]||(kind==='preKickoff'&&lead===60000));
}

async function collectHistorical(plan,{key,budget,minimumReserve=0,fetcher=fetch,onSnapshot=()=>{}}){
 if(!key)throw Error('Tarihsel API anahtarı tanımlı değil');
 if(!Number.isInteger(budget)||budget<20)throw Error('Tarihsel çağrılar için geçerli kredi sınırı gerekiyor');
 if(minimumReserve){
  const endpoint=new URL('https://api.the-odds-api.com/v4/sports/');
  endpoint.search=new URLSearchParams({apiKey:key});
  let response;
  try{response=await fetcher(endpoint,{signal:AbortSignal.timeout(15000)});}
  catch{throw Error('Kredi bakiyesi kontrol edilemedi');}
  const remaining=response.headers?.get('x-requests-remaining');
  if(!response.ok||remaining==null||!/^\d+$/.test(remaining)||Number(remaining)<minimumReserve+20)
   throw Error('Arşiv alımı için kredi bakiyesi doğrulanamadı veya yedek yetersiz');
  budget=Math.min(budget,Number(remaining)-minimumReserve);
 }
 const selected=[];
 let reserved=0;
 for(const request of plan){
  if(reserved+20>budget)break;
  const kickoff=Date.parse(request.kickoff),asOf=Date.parse(request.asOf);
  if(!Object.hasOwn(SPORTS,request.scope)||!validWindow(request.kind,kickoff-asOf)){
   throw Error('Tarihsel sorgu planı geçersiz');
  }
  const endpoint=new URL('https://api.the-odds-api.com/v4/historical/sports/'+SPORTS[request.scope]+'/odds');
  endpoint.search=new URLSearchParams({apiKey:key,regions:'eu',markets:'h2h,totals',oddsFormat:'decimal',date:request.asOf,
   commenceTimeFrom:request.kickoff});
  const reuseEarly=request.kind==='reuseEarly';
  if(!reuseEarly)endpoint.searchParams.set('commenceTimeTo',iso(kickoff+1000));
  reserved+=20;
  let response;
  try{response=await fetcher(endpoint,{signal:AbortSignal.timeout(15000)});}
  catch{throw Error('Tarihsel oran kaynağına ulaşılamadı');}
  if(!response.ok)throw Error('Tarihsel oran isteği başarısız: HTTP '+Number(response.status));
  let raw,payload;
  try{raw=await response.text();payload=JSON.parse(raw);}
  catch{throw Error('Tarihsel oran yanıtı JSON biçiminde değil');}
  const rows=inspectHistorical(request.scope,payload,asOf,15*60000)
   .filter(row=>reuseEarly?row.kickoff>=request.kickoff:row.kickoff===request.kickoff);
  const captured=Date.parse(payload.timestamp);
  const snapshot={...request,sourceSha256:sha256(raw),capturedAt:iso(captured),
   rows:reuseEarly?rows.map(row=>({...row,window:row.kickoff===request.kickoff?'close':'early',
    leadHours:(Date.parse(row.kickoff)-captured)/hour})):rows};
  await onSnapshot(snapshot,raw);
  selected.push(snapshot);
  const remaining=response.headers?.get('x-requests-remaining');
  if(minimumReserve&&(remaining==null||!/^\d+$/.test(remaining)))break;
  if(remaining!=null&&/^\d+$/.test(remaining)&&Number(remaining)<minimumReserve+20)break;
 }
 return {requests:plan.length,calls:selected.length,creditCeiling:reserved,snapshots:selected};
}

function licensedOdds(app,snapshots){
 const events=new Map();
 const metadata={kind:'timestamped',provider:'The Odds API'};
 for(const snapshot of snapshots){
  const kickoff=Date.parse(snapshot.kickoff),cutoff=Date.parse(snapshot.asOf),captured=Date.parse(snapshot.capturedAt);
  if(!Object.hasOwn(SPORTS,snapshot.scope)||!/^[a-f0-9]{64}$/.test(snapshot.sourceSha256??'')||
   !Number.isFinite(captured)||captured>cutoff||cutoff>=kickoff||cutoff-captured>15*60000||
   !validWindow(snapshot.kind,kickoff-cutoff)||
   !Array.isArray(snapshot.rows))throw Error('Sabit tarihsel görüntü doğrulanamadı');
  for(const row of snapshot.rows){
   const rowKickoff=Date.parse(row.kickoff);
   const reused=snapshot.kind==='reuseEarly';
   if(row.scope!==snapshot.scope||row.capturedAt!==snapshot.capturedAt||
    (reused?!(rowKickoff>=kickoff&&row.window===(rowKickoff===kickoff?'close':'early')&&
     row.leadHours===(rowKickoff-captured)/hour):row.kickoff!==snapshot.kickoff)||
    !row.home||!row.away||!Array.isArray(row.power)||!row.power.every(p=>Number.isFinite(p)&&p>0&&p<1)||row.power.length!==3||
    Math.abs(row.power.reduce((a,b)=>a+b,0)-1)>1e-8||!(Date.parse(row.quotedAt)<=captured&&captured-Date.parse(row.quotedAt)<=24*hour)||
    (row.over25!=null&&(!(row.over25>0&&row.over25<1)||!(Date.parse(row.totalQuotedAt)<=captured&&captured-Date.parse(row.totalQuotedAt)<=24*hour))))continue;
   const league=app.ARCHIVE_LEAGUES[row.scope];
   const date=row.kickoff.slice(0,10);
   const year=Number(date.slice(0,4))-(date.slice(5,7)<'07'?1:0);
   const season=year+'-'+String(year+1).slice(-2);
   const key=[league,row.kickoff,app.marketTeamKey(row.home),app.marketTeamKey(row.away)].join('|');
   const result=events.get(key)??{league,season,date,home:row.home,away:row.away,
    kickoff:rowKickoff,verified:true,early:null,close:null};
   if(reused&&row.window==='early'){
    const price={p:row.power,over25:row.over25,capturedAt:snapshot.capturedAt,leadHours:row.leadHours};
    if(!result.early||price.leadHours<result.early.leadHours)result.early=price;
    if(price.leadHours>=24&&(!result.dayBefore||price.leadHours<result.dayBefore.leadHours))result.dayBefore=price;
    events.set(key,result);
    continue;
   }
   const label=snapshot.kind==='early'?'early':snapshot.kind==='dayBefore'?'dayBefore':'close';
   if(result[label])throw Error('Aynı maç ve zamanda mükerrer oran');
   result[label]={p:row.power,over25:row.over25};
   events.set(key,result);
  }
 }
 return {source:metadata,rows:[...events.values()]};
}

function earlyCoverage(app,fixtures,snapshots){
 const key=row=>[row.kickoff,app.marketTeamKey(row.home),app.marketTeamKey(row.away)].join('|');
 const byMatch=new Map(fixtures.map(row=>[key(row),{...row,early:[],closing:false}]));
 assert.equal(byMatch.size,fixtures.length,'Fikstürde mükerrer maç');
 for(const snapshot of snapshots){
  for(const row of snapshot.rows){
   const match=byMatch.get(key(row));
   if(!match)continue;
   if(row.window==='close')match.closing=true;
   if(row.window==='early'&&row.leadHours>0)match.early.push({
    capturedAt:snapshot.capturedAt,leadHours:row.leadHours,hasTotals:row.over25!=null
   });
  }
 }
 const matches=[...byMatch.values()];
 return {
  matches:matches.length,withEarly:matches.filter(row=>row.early.length).length,
  withoutEarly:matches.filter(row=>!row.early.length),
  withoutEarlyTotals:matches.filter(row=>!row.early.some(quote=>quote.hasTotals)).length,
  withoutClosing:matches.filter(row=>!row.closing).length
 };
}

module.exports={manifest,pinnedInput,attachTrackTimes,requestPlan,inspectHistorical,collectHistorical,licensedOdds,earlyCoverage};
