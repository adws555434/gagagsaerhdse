const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const root=fs.existsSync(path.join(__dirname,'index.html'))?__dirname:path.join(__dirname,'..');
const dataDir=process.argv[2]||path.join(root,'forecast-research-data');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'balanced-model-data.json'),'utf8'));
const inputs=new Map();
for(const {file,sha256} of manifest){
 const bytes=fs.readFileSync(path.join(dataDir,file));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),sha256,'Unexpected snapshot for '+file);
 inputs.set(file,bytes.toString('utf8'));
}
const src=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
const {archiveRows,cleanRows,csv,estimateGoals,eloRatings,scheduleStrength,adjustedCandidate,RELEASE_MODELS,canonicalClubRows,ARCHIVE_MODEL,archiveModelRates,compareDate,poissonScoreGrid,balancedScoreGrid,SCORE_GRID_SIZE,BALANCED_MODEL}=new Function(src+'return {archiveRows,cleanRows,csv,estimateGoals,eloRatings,scheduleStrength,adjustedCandidate,RELEASE_MODELS,canonicalClubRows,ARCHIVE_MODEL,archiveModelRates,compareDate,poissonScoreGrid,balancedScoreGrid,SCORE_GRID_SIZE,BALANCED_MODEL};')();
const feeds=['tr.1','en.1','es.1','de.1','it.1','fr.1'];
const years=['2010-11','2011-12','2012-13','2013-14','2014-15','2015-16','2016-17','2017-18','2018-19','2019-20','2020-21','2021-22','2022-23','2023-24','2024-25','2025-26','2026-27'];
const groups={locked:[],oldDevelopment:[],independentPrevious:[],research:[],validation:[],recent:[]};
for(const code of feeds){
 const earlier=[];
 for(const season of years){
  const file=season==='2026-27'?code+'.csv':season+'-'+code+'.json';
  if(!inputs.has(file))continue;
  const snapshot=inputs.get(file);
  const rows=canonicalClubRows(season==='2026-27'?cleanRows(csv(snapshot),'2026-11-15',true):archiveRows(snapshot,'2026-07-01',{includeFlatScores:true}).rows);
  if(season<'2012-13'){earlier.push(...rows);continue;}
  const kind=season<'2016-17'?'locked':season<'2018-19'?'oldDevelopment':season<'2020-21'?'independentPrevious':season<'2025-26'?'research':season==='2025-26'?'validation':'recent';
  groups[kind].push({code,season,rows,history:earlier.slice()});
  earlier.push(...rows);
 }
}

const empty=()=>({n:0,hits:0,exact:0,top3:0,logLoss:0,brier:0,scoreLoss:0});
const metrics=()=>Array.from({length:3},empty);
const outcome=(h,a)=>h>a?0:h===a?1:2;
function evaluateGrid(grid,row){
 const h=Number(row.ft_home),a=Number(row.ft_away);
 const actualScore=h<SCORE_GRID_SIZE&&a<SCORE_GRID_SIZE?h*SCORE_GRID_SIZE+a:-1;
 const actual=outcome(h,a),p=[0,0,0],top=[-1,-1,-1];
 for(let i=0;i<grid.length;i++){
  p[outcome(Math.floor(i/SCORE_GRID_SIZE),i%SCORE_GRID_SIZE)]+=grid[i];
  const spot=top.findIndex(j=>j<0||grid[i]>grid[j]);
  if(spot>=0){top.splice(spot,0,i);top.pop()}
 }
 assert.ok(Math.abs(p.reduce((n,v)=>n+v,0)-1)<1e-9);
 return {hits:Number(p.indexOf(Math.max(...p))===actual),exact:Number(top[0]===actualScore),top3:Number(top.includes(actualScore)),
  logLoss:-Math.log(p[actual]),brier:p.reduce((sum,x,i)=>sum+(x-Number(i===actual))**2,0),
  scoreLoss:-Math.log(Math.max(1e-15,grid[actualScore]??0))};
}
function update(target,record){
 target.n++;
 for(const [key,value] of Object.entries(record))target[key]+=value;
}
function evaluate(blocks){
 const results=metrics(),leagues=Object.fromEntries(feeds.map(code=>[code,metrics()]));
 for(const {code,season,rows,history} of blocks){
  const lower=String(Number(season.slice(0,4))-ARCHIVE_MODEL.history)+'-07-01';
  const archival=history.filter(row=>row.date>=lower).sort(compareDate);
  let start=0,current,rating,fit,pastFit,counts;
  for(let i=0;i<rows.length;i++){
   const row=rows[i];
   if(i&&row.date!==rows[i-1].date){start=i;current=null}
   if(!current){
    current=rows.slice(0,start);
    assert.ok(current.every(match=>match.date<row.date));
    rating=eloRatings(current);
    fit=scheduleStrength(current,0,row.date);
    const available=archival.filter(match=>match.date<row.date);
    pastFit=scheduleStrength([...available,...current],ARCHIVE_MODEL.decay,row.date);
    counts=new Map();
    for(const m of available)for(const team of [m.home,m.away])counts.set(team,(counts.get(team)??0)+1);
   }
   const base=estimateGoals(row.home,row.away,current,false);
   if(!base)continue;
   const h=rating.get(row.home)??1500,a=rating.get(row.away)??1500;
   const rates=adjustedCandidate(base,h,a,RELEASE_MODELS.clubs,fit,row.home,row.away,false);
   const hasArchive=Math.min(counts.get(row.home)??0,counts.get(row.away)??0)>=5;
   const past=hasArchive?archiveModelRates(base,h,a,pastFit,row.home,row.away,false):null;
   const original=poissonScoreGrid(...rates);
   const scores=[original,past?poissonScoreGrid(...past,ARCHIVE_MODEL.rho):original,balancedScoreGrid(...rates,past)];
   for(let j=0;j<scores.length;j++){
    const measured=evaluateGrid(scores[j],row);
    update(results[j],measured);update(leagues[code][j],measured);
   }
  }
 }
 return {metrics:results,leagues};
}
const raw=Object.fromEntries(Object.entries(groups).map(([key,blocks])=>[key,evaluate(blocks)]));
const primary=['hits','exact','top3'], losses=['logLoss','brier'];
for(const {metrics:[baseline,,candidate]} of Object.values(raw)){
 assert.equal(baseline.n,candidate.n);
 assert.ok(primary.every(metric=>candidate[metric]>=baseline[metric]));
 assert.ok(losses.every(metric=>candidate[metric]<=baseline[metric]));
}
console.log(JSON.stringify({order:['live','archive','balanced'],configuration:BALANCED_MODEL,raw},null,2));
