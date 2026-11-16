'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const root=fs.existsSync(path.join(__dirname,'index.html'))?__dirname:path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const core=html.match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
const model=new Function(core+';return {BASES,NATIONAL_RESULTS,NATIONAL_MIRROR,LEAGUES,ARCHIVE_LEAGUES,MODEL_VERSION,ENGINE_VERSION,LEARNING_VERSION,parseClubFeed,cleanRows,knownKickoff,rowKey,estimateGoals,forecastModel,shotEstimate,shotCandidates,settleHistory,validForecastRecord,nationalRows,nationalFixtures,forecastInputPayload,prepareForecastDistribution,forecastDecision,leagueScoreReference,eloScoreReference,findMarketQuote,marketScoreDistribution,marketBlend,marketWeight,MARKET_VERSION};')();
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
function ledgerMarket(snapshot,report,scope,fixture,base,now){
 if(snapshot?.version!==model.MARKET_VERSION||!Array.isArray(snapshot.events)||!/^[a-f0-9]{64}$/.test(snapshot.dataSha256??''))return null;
 const quote=model.findMarketQuote(snapshot,scope,fixture,now.getTime());
 if(!quote)return null;
 const record=outcomes=>{
  const decision=model.forecastDecision(model.marketScoreDistribution(base,outcomes));
  return {probabilities:outcomes,consistentScore:decision.score[0],scores:decision.top.slice(0,3).map(([key])=>key)};
 };
 const weight=model.marketWeight(report,now.getTime());
 return {version:model.MARKET_VERSION,capturedAt:snapshot.capturedAt,quotedAt:quote.quotedAt,
  dataSha256:snapshot.dataSha256,simulationCount:0,proportional:record(quote.proportional),power:record(quote.power),
  ...(weight==null?{}:{weight,weightDataSha256:report.dataSha256??null,blend:record(model.marketBlend(base.outcomes,quote.power,weight))})};
}
function buildLeague(saved,folder,league,results,fixtures,now,marketSnapshot,marketReport){
 const national=folder==='national';
 const today=now.toISOString().slice(0,10);
 const eligible=results.filter(row=>row.date<today);
 const updated=model.settleHistory(saved,folder,eligible);
 const known=new Set(updated.map(row=>row.id)),played=new Set(results.map(model.rowKey));
 const limit=now.getTime()+48*60*60*1000;
 for(const fixture of fixtures){
  const kickoff=model.knownKickoff(fixture);
  const key=model.rowKey(fixture);
  const id=folder+'|'+key;
  if(kickoff==null||kickoff<=now.getTime()||kickoff>limit||known.has(id)||played.has(key))continue;
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
  const market=comparison?ledgerMarket(marketSnapshot,marketReport,folder,fixture,distribution,now):null;
  const inputs=model.forecastInputPayload(eligible,fixture.home,fixture.away,fixture,folder,today);
  const dataSha256=createHash('sha256').update(inputs).digest('hex');
  updated.push({id,scope:folder,league,date:fixture.date,home:fixture.home,away:fixture.away,savedAt:now.getTime(),kickoff,
   model:forecast.name+' · '+model.MODEL_VERSION,...candidates[0],rates,candidates,learningVersion:model.LEARNING_VERSION,
   modelVersion:model.MODEL_VERSION,engineVersion:model.ENGINE_VERSION,dataSha256,simulationCount:0,consistentScore:decision.score[0],actual:null,
   ...(comparison?{measurementVersion,comparison}:{}),...(market?{market}:{})});
  known.add(id);
 }
 return updated;
}
async function collectLedger(prior,{clock=()=>new Date(),fetchSource=fetch,marketSnapshot,marketReport}={}){
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
   updated=buildLeague(updated,folder,league,scores.rows,upcoming?.rows??[],checked,marketSnapshot,marketReport);
   coverage++;
  }
  const details={scope:folder,results:scores?.state??'unavailable',fixtures:upcoming?.state??'unavailable'};
  if(!scores)details.resultsError=results.reason?.message??'Unknown';
  if(!upcoming)details.fixturesError=fixtures.reason?.message??'Unknown';
  return details;
 });
 if(!coverage)throw Error('No result sources available. Existing ledger preserved.');
 if(!updated.every(model.validForecastRecord))throw Error('New ledger failed validation');
 return {checked:checked.toISOString(),source:'open-matchday / Mart Jürisoo / UEFA',coverage,feeds:status,records:updated};
}
async function run(){
 const prior=fs.existsSync(ledgerPath)?JSON.parse(fs.readFileSync(ledgerPath,'utf8')).records:[];
 const optional=file=>{
  try{return JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));}
  catch(error){
   if(error.code!=='ENOENT')console.warn('Piyasa dosyası okunamadı: '+file);
   return null;
  }
 };
 const snapshot=await collectLedger(prior,{marketSnapshot:optional('market-snapshot.json'),marketReport:optional('phase2-market-report.json')});
 if(!process.argv.includes('--dry-run')){
  fs.writeFileSync(ledgerPath+'.tmp',JSON.stringify(snapshot,null,2)+'\n');
  fs.renameSync(ledgerPath+'.tmp',ledgerPath);
 }
 console.log(JSON.stringify({coverage:snapshot.coverage,feeds:snapshot.feeds,records:snapshot.records.length,
  settled:snapshot.records.filter(row=>row.actual).length},null,2));
}
if(require.main===module)run().catch(error=>{console.error(error.message);process.exitCode=1});
module.exports={buildLeague,collectLedger};
