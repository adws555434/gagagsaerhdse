'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {app}=require('./phase2-backtest.cjs');
const {manifest,pinnedInput,requestPlan,inspectHistorical,collectHistorical}=require('./phase2-timing.cjs');

async function run(){
 const [command,inputDir,outputFile,scope,season,offsetText]=process.argv.slice(2);
 if(!['plan','samples','capture'].includes(command)||!inputDir||!outputFile){
  throw Error('Kullanım: node tests/phase2-fetch-history.cjs plan|samples|capture GİRDİ_DİZİNİ ÇIKTI_JSON [LİG] [SEZON] [BAŞLANGIÇ]');
 }
 const write=report=>{
  fs.mkdirSync(path.dirname(outputFile),{recursive:true});
  const temporary=outputFile+'.tmp';
  fs.writeFileSync(temporary,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  fs.renameSync(temporary,outputFile);
 };
 if(command==='samples'){
  const report=await Promise.all(manifest.samples.map(async source=>{
   const file=await pinnedInput(inputDir,source);
   const raw=JSON.parse(file.toString('utf8'));
   const stamp=Date.parse(raw.timestamp),requested=Math.ceil(stamp/60000)*60000;
   const rows=inspectHistorical(source.scope,raw,requested,60000);
   return {scope:source.scope,sha256:source.sha256,capturedAt:raw.timestamp,events:raw.data.length,
    accepted:rows.length,totals25:rows.filter(row=>row.over25!=null).length};
  }));
  write(report);
  console.log(JSON.stringify(report));
  return;
 }
 const fixtures=(await pinnedInput(inputDir,manifest.fixtures)).toString('utf8');
 const plan=requestPlan(app,fixtures,{dayBefore:scope==='TUR_1_super-lig'});
 if(command==='plan'){
  if(scope==='TUR_1_super-lig'){
   const total=plan.leagues[scope];
   const seasons=Object.fromEntries(Object.entries(plan.counts).filter(([key])=>key.startsWith(scope+'|')).map(([key,fixtures])=>{
    const season=key.split('|')[1];
    const calls=plan.requests.filter(row=>row.scope===scope&&row.kickoff>=season.slice(0,4)+'-07-01'&&
     row.kickoff<season.slice(5)+'-07-01').length;
    return [season,{fixtures,kickoffGroups:calls/2,calls,creditCeiling:calls*20}];
   }));
   const summary={sportKey:'soccer_turkey_super_league',hoursBeforeKickoff:24,closingSecondsBeforeKickoff:1,
    usableBudget:20000,...total,seasons};
   write({...summary,fixtureSource:manifest.fixtures});
   console.log(JSON.stringify(summary));
   return;
  }
  const {requests,...summary}=plan;
  write({...summary,fixtureSource:manifest.fixtures});
  console.log(JSON.stringify(summary));
  return;
 }
 if(!process.env.GITHUB_ACTIONS||!process.env.ODDS_API_KEY)throw Error('Tarihsel alım için GitHub Actions ve ODDS_API_KEY secret gerekli');
 const budget=Number(process.env.HISTORICAL_CREDIT_LIMIT);
 const offset=Number(offsetText??'0');
 if(!Object.hasOwn(plan.leagues,scope)||!/^202[345]-(202[456])$/.test(season??'')||
   !Number.isSafeInteger(offset)||offset<0)throw Error('Lig, sezon veya başlangıç numarası geçersiz');
 const year=Number(season.slice(0,4));
 if(Number(season.slice(5))!==year+1)throw Error('Sezon sınırı geçersiz');
 const from=season.slice(0,4)+'-07-01',to=season.slice(5)+'-07-01';
 const selected=plan.requests.filter(row=>row.scope===scope&&row.kickoff>=from&&row.kickoff<to).slice(offset);
 if(!selected.length)throw Error('Seçilen dilimde fikstür yok');
 const collected=[];
 write({scope,season,offset,snapshots:collected});
 const report=await collectHistorical(selected,{key:process.env.ODDS_API_KEY,budget,onSnapshot:row=>{
  collected.push(row);
  write({scope,season,offset,snapshots:collected});
 }});
 console.log(JSON.stringify({scope,season,offset,nextOffset:offset+report.calls,remaining:report.requests-report.calls,
  calls:report.calls,creditCeiling:report.creditCeiling}));
}

if(require.main===module)run().catch(error=>{console.error(error.message);process.exitCode=1;});
