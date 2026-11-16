'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=fs.existsSync(path.join(__dirname,'index.html'))?__dirname:path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const core=html.match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
const model=new Function(core+';return {LEAGUES,ARCHIVE_LEAGUES,MODEL_VERSION,LEARNING_VERSION,csv,cleanRows,knownKickoff,rowKey,estimateGoals,forecastModel,shotEstimate,shotCandidates,settleHistory,validForecastRecord};')();
const file=path.join(root,'forecast-ledger.json');
const prior=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')).records:[];
const now=new Date();
const today=now.toISOString().slice(0,10);
const competition=model.LEAGUES.filter(([folder])=>model.ARCHIVE_LEAGUES[folder]);
const base='https://raw.githubusercontent.com/oladeeayo/open-matchday/master/data/';
const fileFor=(folder,name)=>base+folder+'/'+name+'_2627.csv';
async function fetchCSV(folder,name){
 const response=await fetch(fileFor(folder,name),{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'Football-Intelligence-Research'}});
 if(!response.ok)throw Error('HTTP '+response.status);
 const data=model.csv(await response.text());
 const fields=['date','home','away',...(name==='results'?['ft_home','ft_away']:[])];
 if(!data.length||!fields.every(key=>Object.hasOwn(data[0],key)))throw Error('CSV missing required fields');
 return model.cleanRows(data,today,name==='results');
}
function buildLeague(saved,folder,league,results,fixtures,now){
 const scope=folder;
 const eligible=results.filter(row=>row.date<now.toISOString().slice(0,10));
 const updated=model.settleHistory(saved,scope,eligible);
 const known=new Set(updated.map(row=>row.id)),played=new Set(results.map(model.rowKey));
 const limit=now.getTime()+48*60*60*1000;
 for(const fixture of fixtures){
  const kickoff=model.knownKickoff(fixture);
  const key=model.rowKey(fixture);
  const id=scope+'|'+key;
  if(kickoff==null||kickoff<=now.getTime()||kickoff>limit||known.has(id)||played.has(key))continue;
  const base=model.estimateGoals(fixture.home,fixture.away,eligible,false);
  if(!base)continue;
  const forecast=model.forecastModel(fixture.home,fixture.away,base,eligible,{folder},fixture);
  const rates=[forecast.rates.homeGoals,forecast.rates.awayGoals];
  const shots=model.shotEstimate(fixture.home,fixture.away,eligible,false,now.toISOString().slice(0,10));
  const candidates=model.shotCandidates(rates,shots);
  updated.push({id,scope,league,date:fixture.date,home:fixture.home,away:fixture.away,savedAt:now.getTime(),kickoff,
   model:forecast.name+' · '+model.MODEL_VERSION,...candidates[0],candidates,learningVersion:model.LEARNING_VERSION,actual:null});
  known.add(id);
 }
 return updated;
}
async function run(){
 if(!Array.isArray(prior)||!prior.every(model.validForecastRecord))throw Error('Existing ledger failed validation');
 const feeds=await Promise.allSettled(competition.map(async([folder,league])=>{
  const [results,fixtures]=await Promise.all([fetchCSV(folder,'results'),fetchCSV(folder,'fixtures')]);
  return {folder,league,results,fixtures};
 }));
 let updated=prior,successful=0;
 for(let i=0;i<feeds.length;i++){
  const feed=feeds[i];
  if(feed.status==='rejected'){console.error(competition[i][0],feed.reason.message);continue;}
  const {folder,league,results,fixtures}=feed.value;
  const stamp=new Date();
  updated=buildLeague(updated,folder,league,results,fixtures,stamp);
  successful++;
 }
 if(!successful)throw Error('No sources available. Existing ledger preserved.');
 if(!updated.every(model.validForecastRecord))throw Error('New ledger failed validation');
 const snapshot=JSON.stringify({checked:now.toISOString(),source:'open-matchday',coverage:successful,records:updated},null,2)+'\n';
 fs.writeFileSync(file+'.tmp',snapshot);
 fs.renameSync(file+'.tmp',file);
 console.log(successful+' sources · '+updated.length+' records · '+updated.filter(row=>row.actual).length+' settled');
}
if(require.main===module)run().catch(error=>{console.error(error.message);process.exitCode=1});
module.exports={buildLeague};
