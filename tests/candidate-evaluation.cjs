'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=fs.existsSync(path.join(__dirname,'index.html'))?__dirname:path.join(__dirname,'..');
const script=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
const {archiveRows,nationalRows,estimateGoals,eloRatings,matchOutcome,MODEL_CANDIDATES,scheduleStrength,adjustedCandidate,resultDistribution,poissonDistribution}=new Function(script+'return {archiveRows,nationalRows,estimateGoals,eloRatings,matchOutcome,MODEL_CANDIDATES,scheduleStrength,adjustedCandidate,resultDistribution,poissonDistribution};')();
const [internationalFile,archiveDir=path.join(root,'audit-data')]=process.argv.slice(2);
const codes=['tr.1','en.1','es.1','de.1','it.1','fr.1'];
const seasons=['2023-24','2024-25','2025-26'];
const groups={clubs:seasons.flatMap(season=>codes.map(code=>path.join(archiveDir,season+'-'+code+'.json')).filter(file=>fs.existsSync(file)).map(file=>archiveRows(fs.readFileSync(file,'utf8'),'2026-07-01').rows)),national:[nationalRows(fs.readFileSync(internationalFile,'utf8'),'2025-12-31')]};
const holdout={clubs:'2025-07-01',national:'2025-01-01'};
const minimum={clubs:'2020-01-01',national:'2023-01-01'};
const blank=()=>({n:0,loss:0,brier:0,hits:0,exact:0,top3:0,bands:Array.from({length:7},()=>({n:0,hits:0}))});
const decays=[...new Set(MODEL_CANDIDATES.map(x=>x.decay))];
function* walk(rows,kind){
 let start=0,prior,ratings,fits;
 for(let i=0;i<rows.length;i++){
  const row=rows[i];
  if(i&&row.date!==rows[i-1].date){start=i;prior=null}
  if(row.date<minimum[kind])continue;
  if(!prior){
   prior=rows.slice(0,start);
   assert.ok(prior.every(x=>x.date<row.date));
   ratings=eloRatings(prior);
   fits=new Map();
  }
  const base=estimateGoals(row.home,row.away,prior,row.neutral);
  if(!base)continue;
  const compute=model=>{
   if(model.team&&!fits.has(model.decay))fits.set(model.decay,scheduleStrength(prior,model.decay,row.date));
   return adjustedCandidate(base,ratings.get(row.home)??1500,ratings.get(row.away)??1500,model,fits.get(model.decay),row.home,row.away,row.neutral);
  };
  yield {row,compute};
 }
}
function score(metrics,p,actual,scorelines=null,realScore=null){
 const max=Math.max(...p),correct=Number(p.indexOf(max)===actual);
 metrics.n++;metrics.hits+=correct;
 metrics.loss-=Math.log(Math.max(p[actual],1e-12));
 metrics.brier+=p.reduce((sum,x,i)=>sum+(x-Number(i===actual))**2,0);
 const band=metrics.bands[Math.min(6,Math.max(0,Math.floor(max*10)-3))];
 band.n++;band.hits+=correct;
 if(scorelines){
  metrics.exact+=Number(scorelines[0][0]===realScore);
  metrics.top3+=Number(scorelines.slice(0,3).some(([value])=>value===realScore));
 }
}
const report={};
for(const [kind,blocks] of Object.entries(groups)){
 const training=MODEL_CANDIDATES.map(blank);
 for(const rows of blocks)for(const {row,compute} of walk(rows,kind)){
  if(row.date>=holdout[kind])break;
  const actual=matchOutcome(+row.ft_home,+row.ft_away);
  MODEL_CANDIDATES.forEach((model,i)=>score(training[i],resultDistribution(...compute(model)),actual));
 }
 const ranking=training.map((m,i)=>({i,loss:m.loss/m.n})).sort((a,b)=>a.loss-b.loss);
 const best=ranking[0].i;
 const testing=[blank(),blank()],calibration=[blank(),blank()];
 const chosen=[MODEL_CANDIDATES[0],MODEL_CANDIDATES[best]];
 for(const rows of blocks)for(const {row,compute} of walk(rows,kind)){
  const actual=matchOutcome(+row.ft_home,+row.ft_away),scoreline=row.ft_home+'–'+row.ft_away;
  chosen.forEach((model,i)=>{
   const d=poissonDistribution(...compute(model));
   score(calibration[i],d.outcomes,actual,d.scores,scoreline);
   if(row.date>=holdout[kind])score(testing[i],d.outcomes,actual,d.scores,scoreline);
  });
 }
 const accepted=best!==0&&testing[1].loss<testing[0].loss&&testing[1].brier<testing[0].brier;
 report[kind]={holdout:holdout[kind],training:training[0].n,configurationCount:training.length,best,accepted,chosen,testing,calibration,ranking};
 console.error(kind,JSON.stringify({best,accepted,model:chosen[1],testing:testing.map(({n,loss,brier,hits,exact})=>({n,loss:loss/n,brier:brier/n,hits,exact}))}));
}
console.log(JSON.stringify(report,null,2));
