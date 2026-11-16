'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {evaluateMarketLedger}=require('./market-validation.cjs');
const root=fs.existsSync(path.join(__dirname,'index.html'))?__dirname:path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const core=html.match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
const model=new Function(core+';return {BASES,NATIONAL_RESULTS,NATIONAL_MIRROR,LEAGUES,ARCHIVE_LEAGUES,MODEL_VERSION,ENGINE_VERSION,LEARNING_VERSION,parseClubFeed,cleanRows,knownKickoff,rowKey,estimateGoals,forecastModel,shotEstimate,shotCandidates,settleHistory,validForecastRecord,nationalRows,nationalFixtures,forecastInputPayload,prepareForecastDistribution,forecastDecision,leagueScoreReference,eloScoreReference,findMarketQuote,frozenMarketComparison,marketTotalsDistribution,createSimulationRandom,matchOutcome,strongestOutcome,confidenceTier,marketBlend,MARKET_VERSION,LIVE_MARKET_VERSION};')();
const ledgerPath=path.join(root,'forecast-ledger.json');
const competitions=model.LEAGUES.filter(([folder])=>model.ARCHIVE_LEAGUES[folder]);
const measurementVersion='2026.11-phase-1';
function comparisonSnapshots(base,forecast,history){
 const frequency=model.leagueScoreReference(history);
 if(!frequency)return null;
 const {h,a,rates}=forecast;
 const distributions={
  release:model.prepareForecastDistribution(rates.homeGoals,rates.awayGoals),
  frequency,
  elo:model.eloScoreReference(frequency,h,a),
  poisson:model.prepareForecastDistribution(base.homeGoals,base.awayGoals),
  uncertainty:model.prepareForecastDistribution(rates.homeGoals,rates.awayGoals,{matches:[rates.H.matches,rates.A.matches]})
 };
 return Object.fromEntries(Object.entries(distributions).map(([key,distribution])=>{
  const decision=model.forecastDecision(distribution);
  return [key,{probabilities:distribution.outcomes,consistentScore:decision.score[0],scores:decision.top.slice(0,3).map(([score])=>score)}];
 }));
}
const nationalCompetition=['national','Erkek A milli takımları'];

async function readSource(urls,parse,fetchSource){
 let lastError;
 for(const [i,url] of urls.entries()){
  try{
   const response=await fetchSource(url,{signal:AbortSignal.timeout(8000),headers:{'User-Agent':'Football-Intelligence-Research'}});
   if(!response.ok)throw Error('HTTP '+response.status);
   return {rows:parse(await response.text()),state:i?'mirror':'live'};
  }catch(error){lastError=error;}
 }
 throw lastError;
}
function readClub(folder,name,now,fetchSource){
 const file=name+'_2627.csv';
 const results=name==='results';
 const required=['date','home','away',...(results?['ft_home','ft_away']:[])];
 const day=now.toISOString().slice(0,10);
 return readSource(model.BASES.slice().reverse().map(base=>base+folder+'/'+file),text=>{
  const parsed=model.parseClubFeed(text,file,required);
  const rows=model.cleanRows(parsed,day,results);
  if(results&&parsed.length&&!rows.length)throw Error('No valid results for this date');
  return rows;
 },fetchSource);
}
function readNational(name,now,fetchSource){
 if(name==='fixtures'){
  const text=fs.readFileSync(path.join(root,'nations-fixtures.json'),'utf8');
  return {rows:model.nationalFixtures(text,now).fixtures,state:'local'};
 }
 return readSource([model.NATIONAL_RESULTS,model.NATIONAL_MIRROR],text=>{
  const rows=model.nationalRows(text,now.toISOString().slice(0,10));
  if(!rows.length)throw Error('No valid national results');
  return rows;
 },fetchSource);
}
function freezeMarket(record,snapshot,fixture,now){
 if(record.liveMarket?.marketScore||record.actual||!record.rates||
  !/^[a-f0-9]{64}$/.test(record.dataSha256??'')||snapshot?.version!==model.MARKET_VERSION||
  record.kickoff!==model.knownKickoff(fixture)||!(record.savedAt<=now&&now<record.kickoff))return record;
 const quote=model.findMarketQuote(snapshot,record.scope,fixture,now);
 if(!quote)return record;
 const dataSha256=quote.dataSha256??snapshot.dataSha256;
 if(!/^[a-f0-9]{64}$/.test(dataSha256??''))return record;
 const previous=record.liveMarket?.version===model.LIVE_MARKET_VERSION?record.liveMarket:{};
 const market=model.frozenMarketComparison(model.prepareForecastDistribution(...record.rates),quote);
 const metadata={dataSha256,savedAt:now,simulationCount:0,modelVersion:model.LIVE_MARKET_VERSION};
 return {...record,liveMarket:{version:model.LIVE_MARKET_VERSION,
  market:previous.market??{...market.market,...metadata},
  marketScore:previous.marketScore??(market.marketScore?{...market.marketScore,...metadata}:null)}};
}
function buildLeague(saved,folder,league,results,fixtures,now,marketSnapshot){
 const national=folder==='national';
 const today=now.toISOString().slice(0,10);
 const eligible=results.filter(row=>row.date<today);
 const updated=model.settleHistory(saved,folder,eligible).map((row,i)=>
  row!==saved[i]&&!saved[i].actual&&row.actual?{...row,settledAt:now.getTime()}:row);
 const known=new Map(updated.map((row,index)=>[row.id,index])),played=new Set(results.map(model.rowKey));
 const limit=now.getTime()+48*60*60*1000;
 for(const fixture of fixtures){
  const kickoff=model.knownKickoff(fixture);
  const key=model.rowKey(fixture);
  const id=folder+'|'+key;
  if(kickoff==null||kickoff<=now.getTime()||kickoff>limit||played.has(key))continue;
  if(known.has(id)){
   const index=known.get(id);
   updated[index]=freezeMarket(updated[index],marketSnapshot,fixture,now.getTime());
   continue;
  }
  const neutral=fixture.neutral===true;
  const base=model.estimateGoals(fixture.home,fixture.away,eligible,neutral);
  if(!base)continue;
  const forecast=model.forecastModel(fixture.home,fixture.away,base,eligible,{folder,national},fixture);
  const rates=[forecast.rates.homeGoals,forecast.rates.awayGoals];
  const shots=national?null:model.shotEstimate(fixture.home,fixture.away,eligible,neutral,today);
  const candidates=model.shotCandidates(rates,shots);
  const distribution=model.prepareForecastDistribution(...rates);
  const decision=model.forecastDecision(distribution);
  const comparison=national?null:comparisonSnapshots(base,forecast,eligible);
  const inputs=model.forecastInputPayload(eligible,fixture.home,fixture.away,fixture,folder,today);
  const dataSha256=createHash('sha256').update(inputs).digest('hex');
  const entry={id,scope:folder,league,date:fixture.date,home:fixture.home,away:fixture.away,savedAt:now.getTime(),kickoff,
   model:forecast.name+' · '+model.MODEL_VERSION,...candidates[0],rates,candidates,learningVersion:model.LEARNING_VERSION,
   modelVersion:model.MODEL_VERSION,engineVersion:model.ENGINE_VERSION,dataSha256,simulationCount:0,consistentScore:decision.score[0],actual:null,
   ...(comparison?{measurementVersion,comparison}:{})};
  known.set(id,updated.length);
  updated.push(freezeMarket(entry,marketSnapshot,fixture,now.getTime()));
 }
 return updated;
}
async function collectLedger(prior,{clock=()=>new Date(),fetchSource=fetch,marketSnapshot,marketValidation}={}){
 if(!Array.isArray(prior)||!prior.every(model.validForecastRecord))throw Error('Existing ledger failed validation');
 const started=clock();
 const leagues=[...competitions,nationalCompetition];
 const feeds=await Promise.all(leagues.map(async([folder,league])=>{
  const [results,fixtures]=await Promise.allSettled(['results','fixtures'].map(async name=>
   folder==='national'?readNational(name,started,fetchSource):readClub(folder,name,started,fetchSource)));
  return {folder,league,results,fixtures};
 }));
 const checked=clock();
 let updated=prior,coverage=0;
 const status=feeds.map(({folder,league,results,fixtures})=>{
  const scores=results.value;
  const upcoming=fixtures.value;
  if(scores){
   updated=buildLeague(updated,folder,league,scores.rows,upcoming?.rows??[],checked,marketSnapshot);
   coverage++;
  }
  const details={scope:folder,results:scores?.state??'unavailable',fixtures:upcoming?.state??'unavailable'};
  if(!scores)details.resultsError=results.reason?.message??'Unknown';
  if(!upcoming)details.fixturesError=fixtures.reason?.message??'Unknown';
  return details;
 });
 if(!coverage)throw Error('No result sources available. Existing ledger preserved.');
 if(!updated.every(model.validForecastRecord))throw Error('New ledger failed validation');
 return {checked:checked.toISOString(),source:'open-matchday / Mart Jürisoo / UEFA',coverage,feeds:status,records:updated,
  marketValidation:evaluateMarketLedger(updated,model,marketValidation,checked)};
}
async function run(){
 const prior=fs.existsSync(ledgerPath)?JSON.parse(fs.readFileSync(ledgerPath,'utf8')):{records:[]};
 const optional=file=>{
  try{return JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));}
  catch(error){
   if(error.code!=='ENOENT')console.warn('Piyasa dosyası okunamadı: '+file);
   return null;
  }
 };
 const snapshot=await collectLedger(prior.records,{marketSnapshot:optional('market-snapshot.json'),marketValidation:prior.marketValidation});
 if(!process.argv.includes('--dry-run')){
  fs.writeFileSync(ledgerPath+'.tmp',JSON.stringify(snapshot,null,2)+'\n');
  fs.renameSync(ledgerPath+'.tmp',ledgerPath);
 }
 console.log(JSON.stringify({coverage:snapshot.coverage,feeds:snapshot.feeds,records:snapshot.records.length,
  settled:snapshot.records.filter(row=>row.actual).length,marketValidation:snapshot.marketValidation.counts},null,2));
}
if(require.main===module)run().catch(error=>{console.error(error.message);process.exitCode=1});
module.exports={buildLeague,collectLedger};
