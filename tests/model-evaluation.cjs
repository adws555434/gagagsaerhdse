'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=fs.existsSync(path.join(__dirname,'index.html'))?__dirname:path.join(__dirname,'..');
const script=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
const {archiveRows,nationalRows,estimateGoals,eloRatings,eloAdjustedRates,poissonDistribution,matchOutcome}=new Function(script+'return {archiveRows,nationalRows,estimateGoals,eloRatings,eloAdjustedRates,poissonDistribution,matchOutcome};')();
const [internationalFile,archiveDir=path.join(root,'audit-data')]=process.argv.slice(2);
const leagueCodes=['tr.1','en.1','es.1','de.1','it.1','fr.1'];
const seasons=['2023-24','2024-25','2025-26'];
const models=['poisson','eloBlend'];
const holdouts={clubs:'2025-07-01',national:'2025-01-01'};
const names=['clubs','national'];
function metrics(){
 return {n:0,resultHits:0,scoreHits:0,top3Hits:0,logLoss:0,brier:0,bands:Array.from({length:7},()=>({n:0,hits:0,predicted:0}))};
}
const bins=()=>Object.fromEntries(names.map(k=>[k,Object.fromEntries(models.map(m=>[m,metrics()]))]));
const report=bins();
const recent=bins();
function measure(target,forecast,outcome,score){
 const p=Math.max(...forecast.outcomes),pick=forecast.outcomes.indexOf(p);
 const band=target.bands[Math.min(6,Math.max(0,Math.floor(p*10)-3))];
 const correct=+(pick===outcome);
 target.n++;
 target.resultHits+=correct;
 target.scoreHits+=+(forecast.scores[0][0]===score);
 target.top3Hits+=+forecast.scores.slice(0,3).some(([s])=>s===score);
 target.logLoss-=Math.log(Math.max(1e-12,forecast.outcomes[outcome]));
 target.brier+=forecast.outcomes.reduce((sum,x,i)=>sum+(x-+(i===outcome))**2,0);
 band.n++;band.hits+=correct;band.predicted+=p;
}
function evaluate(rows,from,type){
 let startOfDay=0;
 for(let i=0;i<rows.length;i++){
  const row=rows[i];
  if(i&&rows[i-1].date!==row.date)startOfDay=i;
  if(row.date<from)continue;
  const prior=rows.slice(0,startOfDay);
  assert.ok(prior.every(x=>x.date<row.date));
  const rates=estimateGoals(row.home,row.away,prior,row.neutral);
  if(!rates)continue;
  const ratings=eloRatings(prior);
  const diff=r=>[r.homeGoals,r.awayGoals];
  const outcome=matchOutcome(Number(row.ft_home),Number(row.ft_away));
  const score=row.ft_home+'–'+row.ft_away;
  const predictions={
   poisson:poissonDistribution(...diff(rates)),
   eloBlend:poissonDistribution(...eloAdjustedRates(rates,ratings.get(row.home)??1500,ratings.get(row.away)??1500))
  };
  for(const key of models){
   measure(report[type][key],predictions[key],outcome,score);
   if(row.date>=holdouts[type])measure(recent[type][key],predictions[key],outcome,score);
  }
 }
}
for(const code of leagueCodes)for(const season of seasons){
 const file=path.join(archiveDir,season+'-'+code+'.json');
 if(fs.existsSync(file))evaluate(archiveRows(fs.readFileSync(file,'utf8'),'2026-07-01').rows,'2020-01-01','clubs');
}
evaluate(nationalRows(fs.readFileSync(internationalFile,'utf8'),'2025-12-31'),'2023-01-01','national');
assert.equal(report.clubs.poisson.n,4719);
assert.equal(report.national.poisson.n,3238);
console.log(JSON.stringify({...report,recent},null,2));
