'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=fs.existsSync(path.join(__dirname,'index.html'))?__dirname:path.join(__dirname,'..');
const src=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
const {archiveRows,cleanRows,csv,estimateGoals,eloRatings,matchOutcome,scheduleStrength,adjustedCandidate,resultDistribution,poissonDistribution,RELEASE_MODELS,PREVIOUS_CLUB_MODEL}=new Function(src+'return {archiveRows,cleanRows,csv,estimateGoals,eloRatings,matchOutcome,scheduleStrength,adjustedCandidate,resultDistribution,poissonDistribution,RELEASE_MODELS,PREVIOUS_CLUB_MODEL};')();
const [snapshotDir,archiveDir=path.join(root,'audit-data')]=process.argv.slice(2);
const codes=['tr.1','en.1','es.1','de.1','it.1','fr.1'];
const previous={team:0,elo:.35,decay:0};
const current=PREVIOUS_CLUB_MODEL;
const models=[previous,current,RELEASE_MODELS.clubs];
const snapshots={earlier:[],published:[],fresh:[]};
for(const code of codes){
 for(const season of ['2023-24','2024-25','2025-26']){
  const f=path.join(archiveDir,season+'-'+code+'.json');
  if(fs.existsSync(f))snapshots[season==='2025-26'?'published':'earlier'].push({code,rows:archiveRows(fs.readFileSync(f,'utf8'),'2026-07-01').rows});
 }
 const f=path.join(snapshotDir,code+'.csv');
 snapshots.fresh.push({code,rows:cleanRows(csv(fs.readFileSync(f,'utf8')),'2026-11-15',true)});
}
function metrics(){return {n:0,hits:0,exact:0,top3:0,logLoss:0,brier:0,bands:Array.from({length:7},()=>({n:0,hits:0}))}}
function topScores(h,a){
 const result=[];
 const modeH=Math.floor(h),modeA=Math.floor(a);
 for(let home=Math.max(0,modeH-3);home<=modeH+2;home++)for(let away=Math.max(0,modeA-3);away<=modeA+2;away++){
  let p=1;
  for(let i=1;i<=home;i++)p*=h/i;
  for(let i=1;i<=away;i++)p*=a/i;
  result.push([home+'–'+away,p]);
 }
 return result.sort((x,y)=>y[1]-x[1]).slice(0,3);
}
function add(m,row,h,a){
 const probabilities=resultDistribution(h,a);
 const trueOutcome=matchOutcome(+row.ft_home,+row.ft_away);
 const max=Math.max(...probabilities);
 const correct=+(probabilities.indexOf(max)===trueOutcome);
 const top=topScores(h,a);
 const observed=row.ft_home+'–'+row.ft_away;
 m.n++;m.hits+=correct;
 m.exact+=+(top[0][0]===observed);
 m.top3+=+top.some(([s])=>s===observed);
 m.logLoss-=Math.log(probabilities[trueOutcome]);
 m.brier+=probabilities.reduce((sum,p,i)=>sum+(p-+(i===trueOutcome))**2,0);
 const bin=m.bands[Math.min(6,Math.max(0,Math.floor(max*10)-3))];
 bin.n++;bin.hits+=correct;
}
function evaluate(blocks,chosen){
 const aggregate=chosen.map(metrics);
 const leagues=Object.fromEntries(codes.map(c=>[c,chosen.map(metrics)]));
 for(const {code,rows} of blocks){
  let prior,ratings,fits,start=0;
  for(let i=0;i<rows.length;i++){
   const row=rows[i];
   if(i&&rows[i-1].date!==row.date){start=i;prior=null}
   if(!prior){
    prior=rows.slice(0,start);
    assert.ok(prior.every(x=>x.date<row.date));
    ratings=eloRatings(prior);
    fits=new Map();
   }
   const base=estimateGoals(row.home,row.away,prior,row.neutral);
   if(!base)continue;
   const hr=ratings.get(row.home)??1500,ar=ratings.get(row.away)??1500;
   chosen.forEach((model,index)=>{
    if(model.team&&!fits.has(model.decay))fits.set(model.decay,scheduleStrength(prior,model.decay,row.date));
    const rates=adjustedCandidate(base,hr,ar,model,fits.get(model.decay),row.home,row.away,row.neutral);
    add(aggregate[index],row,...rates);
    add(leagues[code][index],row,...rates);
   });
  }
 }
 return {aggregate,leagues};
}
function satisfies(candidate,references){
 return references.every(old=>candidate.n===old.n&&candidate.hits>=old.hits&&candidate.exact>=old.exact&&
 candidate.top3>=old.top3&&candidate.logLoss<=old.logLoss+1e-10&&candidate.brier<=old.brier+1e-10);
}
for(const h of [.08,.8,1,1.95,3,6])for(const a of [.08,.8,1,1.95,3,6]){
 const large=poissonDistribution(h,a).scores.slice(0,3);
 const short=topScores(h,a);
 assert.deepEqual(short.map(x=>x[0]),large.map(x=>x[0]));
}
for(const code of codes)for(const season of ['2021-22','2022-23']){
 const f=path.join(snapshotDir,season+'-'+code+'.json');
 if(fs.existsSync(f))snapshots.earlier.push({code,rows:archiveRows(fs.readFileSync(f,'utf8'),'2023-07-01').rows});
}
const older=codes.flatMap(code=>{
 const f=path.join(snapshotDir,'2020-21-'+code+'.json');
 return fs.existsSync(f)?[{code,rows:archiveRows(fs.readFileSync(f,'utf8'),'2021-07-01').rows}]:[];
});
const report={models,periods:{
 older:evaluate(older,models),
 earlier:evaluate(snapshots.earlier,models),
 published:evaluate(snapshots.published,models),
 fresh:evaluate(snapshots.fresh,models)
}};
for(const [period,x] of Object.entries(report.periods)){
 assert.ok(satisfies(x.aggregate[2],[x.aggregate[0]]),period+' fell below the original model');
}
for(const [period,x] of Object.entries(report.periods)) console.error(period,x.aggregate.map(r=>[r.n,r.hits,r.exact,r.top3,r.logLoss/r.n,r.brier/r.n]));
console.log(JSON.stringify(report,null,2));
