'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {app}=require('./phase2-backtest.cjs');
const {manifest,pinnedInput,requestPlan,inspectHistorical,collectHistorical,earlyCoverage}=require('./phase2-timing.cjs');

async function run(){
 const [command,inputDir,outputFile,scope,season,offsetText]=process.argv.slice(2);
 if(!['plan','samples','capture','coverage'].includes(command)||!inputDir||!outputFile){
  throw Error('Kullanım: node tests/phase2-fetch-history.cjs plan|samples|capture|coverage GİRDİ_DİZİNİ ÇIKTI_JSON [LİG] [SEZON] [BAŞLANGIÇ]');
 }
 if(command==='capture'){
  if(process.env.HISTORICAL_CAPTURE_APPROVAL!=='onaylıyorum'||process.env.HISTORICAL_REPOSITORY_PRIVATE!=='true')
   throw Error('Tarihsel alım için açık onay ve özel GitHub deposu gerekli');
  if(!process.env.GITHUB_ACTIONS||!process.env.ODDS_API_KEY)
   throw Error('Tarihsel alım için GitHub Actions ve ODDS_API_KEY secret gerekli');
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
 if(command==='coverage'){
  const inputs=process.argv.slice(5);
  if(!inputs.length)throw Error('Kapsam için özel alım JSON dosyaları gerekli');
  const {fixtureRows}=requestPlan(app,fixtures,{reuseEarly:true});
  const snapshots=inputs.flatMap(file=>JSON.parse(fs.readFileSync(file,'utf8')).snapshots);
  const coverage=earlyCoverage(app,fixtureRows,snapshots);
  write(coverage);
  const {withoutEarly,...counts}=coverage;
  console.log(JSON.stringify({...counts,withoutEarly:withoutEarly.length}));
  return;
 }
 const reuseEarly=scope==='TUR_1_super-lig';
 const plan=requestPlan(app,fixtures,{reuseEarly});
 if(command==='plan'){
  if(scope==='TUR_1_super-lig'){
   const total=plan.leagues[scope];
   const groups=plan.requests.filter(row=>row.scope===scope).map(row=>Date.parse(row.kickoff));
   const uncovered=plan.fixtureRows.filter(row=>Date.parse(row.kickoff)===groups[0]);
   const seasons=Object.fromEntries(Object.entries(plan.counts).filter(([key])=>key.startsWith(scope+'|')).map(([key,fixtures])=>{
    const season=key.split('|')[1];
    const rows=plan.fixtureRows.filter(row=>row.season===season);
    const kickoffGroups=new Set(rows.map(row=>row.kickoff)).size;
    const within24Hours=rows.filter(row=>{
     const kickoff=Date.parse(row.kickoff);
     return groups.some(group=>group<kickoff&&kickoff-group+1000<=24*3600000);
    }).length;
    const between24And48Hours=rows.filter(row=>{
     const kickoff=Date.parse(row.kickoff);
     return groups.some(group=>kickoff-group+1000>=24*3600000&&kickoff-group+1000<=48*3600000);
    }).length;
    return [season,{fixtures,kickoffGroups,calls:kickoffGroups,creditCeiling:kickoffGroups*20,
     scheduledWithin24Hours:within24Hours,withoutScheduledWithin24Hours:fixtures-within24Hours,
     scheduledBetween24And48Hours:between24And48Hours}];
   }));
   const summary={sportKey:'soccer_turkey_super_league',closingSecondsBeforeKickoff:1,
    budget:20000,minimumReserve:3000,...total,reserve:20000-total.creditCeiling,
    matchesWithoutAnyScheduledEarlierSnapshot:uncovered,actualEarlyCoverage:null,seasons};
   write({...summary,fixtureSource:manifest.fixtures});
   console.log(JSON.stringify(summary));
   return;
  }
  const {requests,fixtureRows,...summary}=plan;
  write({...summary,fixtureSource:manifest.fixtures});
  console.log(JSON.stringify(summary));
  return;
 }
 const budget=Number(process.env.HISTORICAL_CREDIT_LIMIT);
 if(reuseEarly&&budget>17000)throw Error('En az 3.000 kredi yedek kalmalı');
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
 const report=await collectHistorical(selected,{key:process.env.ODDS_API_KEY,budget,minimumReserve:reuseEarly?3000:0,onSnapshot:(row,raw)=>{
  if(reuseEarly){
   const rawDir=path.join(path.dirname(outputFile),'raw');
   fs.mkdirSync(rawDir,{recursive:true,mode:0o700});
   const rawPath=path.join(rawDir,row.sourceSha256+'.json');
   if(!fs.existsSync(rawPath))fs.writeFileSync(rawPath,raw,{mode:0o600,flag:'wx'});
  }
  collected.push(row);
  write({scope,season,offset,snapshots:collected});
 }});
 if(reuseEarly){
  const coverage=earlyCoverage(app,plan.fixtureRows.filter(row=>row.season===season),collected);
  write({scope,season,offset,snapshots:collected,coverage});
 }
 console.log(JSON.stringify({scope,season,offset,nextOffset:offset+report.calls,remaining:report.requests-report.calls,
  calls:report.calls,creditCeiling:report.creditCeiling}));
}

if(require.main===module)run().catch(error=>{console.error(error.message);process.exitCode=1;});
