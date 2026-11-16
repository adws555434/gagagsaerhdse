'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const root=fs.existsSync(path.join(__dirname,'index.html'))?__dirname:path.resolve(__dirname,'..');
const script=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
const model=new Function(script+';return {MARKET_VERSION,MARKET_MAX_QUOTE_AGE,marketDevig};')();
const SPORTS={
 'TUR_1_super-lig':'soccer_turkey_super_league',
 'ENG_1_premier-league':'soccer_epl',
 'ESP_1_la-liga':'soccer_spain_la_liga',
 'GER_1_bundesliga':'soccer_germany_bundesliga',
 'ITA_1_serie-a':'soccer_italy_serie_a',
 'FRA_1_ligue-1':'soccer_france_ligue_one'
};
const markets=['h2h','totals'];
const freeMonthlyCredits=500;
const utcHours=[1,7,13,19];

function quotaPlan(scopeCount){
 if(!Number.isInteger(scopeCount)||scopeCount<1||scopeCount>Object.keys(SPORTS).length)throw Error('Geçersiz oran lig sayısı');
 const runs=utcHours.length*scopeCount*markets.length*31<=freeMonthlyCredits?utcHours:
  2*scopeCount*markets.length*31<=freeMonthlyCredits?[1,13]:[13];
 const callsPerDay=scopeCount*runs.length;
 const creditsPerDay=callsPerDay*markets.length;
 return {scopeCount,utcHours:runs,callsPerDay,creditsPerDay,credits31Days:31*creditsPerDay,freeMonthlyCredits};
}
const source='https://the-odds-api.com/';
const digest=text=>createHash('sha256').update(text).digest('hex');
const time=text=>typeof text==='string'&&/^\d{4}-\d\d-\d\dT/.test(text)?Date.parse(text):NaN;
const iso=ms=>new Date(ms).toISOString();

function selectPrices(group,names,point){
 if(!Array.isArray(group?.outcomes))return null;
 const prices=names.map(name=>{
  const matching=group.outcomes.filter(item=>item?.name===name&&(point===undefined||item.point===point));
  return matching.length===1?matching[0].price:null;
 });
 return prices.every(x=>Number.isFinite(x)&&x>1)?prices:null;
}

function summarizeEvent(event,scope,captured){
 const kickoff=time(event?.commence_time);
 const home=event?.home_team,away=event?.away_team;
 if(!(kickoff>captured)||event.sport_key!==SPORTS[scope]||typeof home!=='string'||typeof away!=='string'||
  !home.trim()||!away.trim()||home===away||!Array.isArray(event.bookmakers))return null;
 const fresh=(market,book)=>{
  const ms=time(market?.last_update??book.last_update);
  return ms<=captured&&captured-ms<=model.MARKET_MAX_QUOTE_AGE?ms:NaN;
 };
 const samples=[];
 const seen=new Set();
 for(const book of event.bookmakers){
  if(!book?.key||seen.has(book.key)||!Array.isArray(book.markets))continue;
  seen.add(book.key);
  const result=book.markets.find(x=>x.key===markets[0]),totals=book.markets.find(x=>x.key===markets[1]);
  const quoted=fresh(result,book);
  const prices=selectPrices(result,[home,'Draw',away]);
  if(!prices||!Number.isFinite(quoted))continue;
  const power=model.marketDevig(prices);
  if(!power)continue;
  const totalQuoted=fresh(totals,book);
  const totalPrices=Number.isFinite(totalQuoted)?selectPrices(totals,['Over','Under'],2.5):null;
  samples.push({quoted,power,proportional:model.marketDevig(prices,'proportional'),
   totalQuoted,totals:model.marketDevig(totalPrices)});
 }
 if(!samples.length)return null;
 const average=values=>values.reduce((a,b)=>a+b,0)/values.length;
 const averageModel=key=>[0,1,2].map(i=>average(samples.map(row=>row[key][i])));
 const totals=samples.filter(x=>x.totals);
 return {scope,home,away,kickoff:iso(kickoff),capturedAt:iso(captured),
  quotedAt:iso(Math.min(...samples.map(x=>x.quoted))),
  latestQuotedAt:iso(Math.max(...samples.map(x=>x.quoted))),
  books:samples.length,power:averageModel('power'),proportional:averageModel('proportional'),
  totalQuotedAt:totals.length?iso(Math.min(...totals.map(x=>x.totalQuoted))):null,
  over25:totals.length?average(totals.map(x=>x.totals[0])):null,totalsBooks:totals.length};
}

async function fetchBook(scope,key,clock,fetcher){
 const url=new URL('https://api.the-odds-api.com/v4/sports/'+SPORTS[scope]+'/odds');
 url.search=new URLSearchParams({apiKey:key,regions:'eu',markets:markets.join(','),oddsFormat:'decimal'});
 let response;
 try{response=await fetcher(url,{signal:AbortSignal.timeout(12000)});}
 catch{throw Error('network');}
 if(!response.ok)throw Error('HTTP '+Number(response.status));
 let payload;
 try{payload=await response.text();}
 catch{throw Error('response');}
 let data;
 try{data=JSON.parse(payload);}
 catch{throw Error('invalid JSON');}
 if(!Array.isArray(data)||data.some(x=>!x||typeof x.id!=='string'||x.sport_key!==SPORTS[scope]||!Array.isArray(x.bookmakers))){
  throw Error('schema');
 }
 const remaining=response.headers.get('x-requests-remaining');
 return {scope,sha256:digest(payload),data,captured:clock(),remaining:remaining!=null&&/^\d+$/.test(remaining)?Number(remaining):null};
}

async function buildSnapshot({key,scopes=['TUR_1_super-lig'],clock=Date.now,fetcher=fetch}={}){
 if(!key)return {version:model.MARKET_VERSION,source,state:'unconfigured',capturedAt:null,dataSha256:null,events:[]};
 if(!scopes.length||scopes.some(scope=>!Object.hasOwn(SPORTS,scope))||new Set(scopes).size!==scopes.length)throw Error('Geçersiz oran lig listesi');
 const successes=[],failures=[];
 for(const scope of scopes){
  try{
   const last=successes.at(-1);
   if(last?.remaining!=null&&last.remaining<markets.length){failures.push({scope,reason:'quota'});break;}
   successes.push(await fetchBook(scope,key,clock,fetcher));
  }catch(error){
   failures.push({scope,reason:error.message});
   if(['HTTP 401','HTTP 403','HTTP 429'].includes(error.message))break;
  }
 }
 if(!successes.length)throw Error('Oran kaynağı başarısız ('+failures[0]?.reason+')');
 const captured=clock();
 const events=successes.flatMap(({scope,data,sha256,captured:received})=>{
  const ids=new Set();
  for(const event of data){
   if(ids.has(event.id))throw Error('Tekrarlanan oran fikstürü');
   ids.add(event.id);
  }
  return data.map(event=>summarizeEvent(event,scope,received)).filter(result=>result&&time(result.kickoff)>captured)
   .map(result=>({...result,dataSha256:sha256}));
 }).sort((a,b)=>a.kickoff.localeCompare(b.kickoff)||a.scope.localeCompare(b.scope)||a.home.localeCompare(b.home));
 const sources=successes.map(({scope,sha256,captured:received})=>({scope,sha256,capturedAt:iso(received)}));
 return {version:model.MARKET_VERSION,source,state:failures.length?'partial':'ready',capturedAt:iso(captured),
  dataSha256:digest(JSON.stringify(sources.map(({scope,sha256})=>[scope,sha256]))),
  sources,failures,events};
}

async function run(){
 const config=process.env.ODDS_API_SCOPES?.split(',').map(x=>x.trim()).filter(Boolean);
 const scopes=config?.length?config:['TUR_1_super-lig'];
 if(scopes.some(scope=>!Object.hasOwn(SPORTS,scope))||new Set(scopes).size!==scopes.length)throw Error('Geçersiz oran lig listesi');
 const plan=quotaPlan(scopes.length);
 if(process.argv.includes('--quota')){
  console.log(JSON.stringify(Object.keys(SPORTS).map((_,i)=>quotaPlan(i+1)),null,2));
  return;
 }
 const scheduled=process.env.ODDS_API_SCHEDULE;
 if(scheduled){
  const hours=scheduled.trim().split(/\s+/)[1];
  if(!utcHours.includes(Number(hours)))throw Error('Geçersiz oran toplama saati');
  if(!plan.utcHours.includes(Number(hours))){
   console.log(JSON.stringify({skipped:true,plan}));
   return;
  }
 }
 const snapshot=await buildSnapshot({key:process.env.ODDS_API_KEY,scopes});
 const output=path.join(root,'market-snapshot.json');
 if(snapshot.state==='unconfigured'&&fs.existsSync(output)){console.log('Oran kaynağı bağlı değil. Var olan dosya korundu.');return;}
 const data=JSON.stringify(snapshot,null,2)+'\n';
 fs.writeFileSync(output+'.tmp',data);
 fs.renameSync(output+'.tmp',output);
 console.log(JSON.stringify({state:snapshot.state,events:snapshot.events.length,capturedAt:snapshot.capturedAt,plan}));
}

module.exports={buildSnapshot,summarizeEvent,quotaPlan,SPORTS};
if(require.main===module)run().catch(error=>{console.error(error.message);process.exitCode=1;});
