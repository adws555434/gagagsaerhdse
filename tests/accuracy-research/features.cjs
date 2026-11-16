'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const appRoot=fs.existsSync(path.join(__dirname,'../index.html'))?path.resolve(__dirname,'..'):path.resolve(__dirname,'../..');
const dataRoot=process.argv[2];
if(!dataRoot)throw Error('Usage: node features.cjs /snapshot/directory');
const manifestPath=fs.existsSync(path.join(appRoot,'balanced-model-data.json'))?'balanced-model-data.json':'tests/balanced-model-data.json';
const manifest=JSON.parse(fs.readFileSync(path.join(appRoot,manifestPath),'utf8'));
const snap=new Map(manifest.map(row=>{
 const bytes=fs.readFileSync(path.join(dataRoot,row.file));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256,row.file);
 return [row.file,bytes.toString('utf8')];
}));
const app=fs.readFileSync(path.join(appRoot,'index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
const m=new Function(app+';return {archiveRows,cleanRows,csv,estimateGoals,eloRatings,scheduleStrength,adjustedCandidate,RELEASE_MODELS,canonicalClubRows,ARCHIVE_MODEL,archiveModelRates,compareDate,poissonScoreGrid,balancedScoreGrid,shotEstimate,clubModelKey,rowKey,SCORE_GRID_SIZE};')();
const leagues=['tr.1','en.1','es.1','de.1','it.1','fr.1'];
const windows=[60,120,240,480,720];
const gridSide=10;
function fitRates(fit,home,away){
 const h=fit.teams.get(home),a=fit.teams.get(away);
 return h&&a?[fit.home*h.attack*a.defense,fit.away*a.attack*h.defense].map(x=>Math.max(.08,Math.min(6,x))):null;
}
function cutGrid(grid){
 return Array.from({length:gridSide},(_,i)=>grid.slice(i*m.SCORE_GRID_SIZE,i*m.SCORE_GRID_SIZE+gridSide)).flat();
}
const out=[];
for(const code of leagues){
 let previous=[];
 for(let year=2010;year<=2026;year++){
  const season=String(year)+'-'+String(year+1).slice(-2);
  const input=snap.get(year===2026?code+'.csv':season+'-'+code+'.json');
  if(!input)continue;
  const rows=m.canonicalClubRows(year===2026?m.cleanRows(m.csv(input),'2026-11-15',true):m.archiveRows(input,'2026-07-01',{includeFlatScores:true}).rows);
  const historical=previous.filter(r=>r.date>=String(year-2)+'-07-01');
  const dates=[...new Set(rows.map(r=>r.date))];
  for(const date of dates){
   if(year<2012)continue;
   const current=rows.filter(row=>row.date<date);
   const archive=historical.filter(row=>row.date<date);
   const all=[...new Map([...archive,...current].map(r=>[m.rowKey(r),r])).values()].sort(m.compareDate);
   if(current.length<20)continue;
   const fit=m.scheduleStrength(current,0,date);
   const ratings=m.eloRatings(current),across=m.eloRatings(all);
   const strengths=windows.map(days=>m.scheduleStrength(all,days,date));
   const counts=new Map();
   for(const row of archive)for(const team of [row.home,row.away])counts.set(team,(counts.get(team)??0)+1);
   for(const {home,away,ft_home:h,ft_away:a} of rows.filter(r=>r.date===date)){
    const base=m.estimateGoals(home,away,current);
    if(!base)continue;
    const hr=ratings.get(home)??1500,ar=ratings.get(away)??1500;
    const live=m.adjustedCandidate(base,hr,ar,m.RELEASE_MODELS.clubs,fit,home,away,false);
    const past=Math.min(counts.get(home)??0,counts.get(away)??0)>=5?m.archiveModelRates(base,hr,ar,strengths[4],home,away,false):null;
    const rest=[home,away].map(team=>{
     const last=all.findLast(row=>row.home===team||row.away===team);
     return last?Math.min(14,(Date.parse(date)-Date.parse(last.date))/86400000):14;
    });
    const recent=[home,away].map(team=>all.filter(r=>(r.home===team||r.away===team)&&(Date.parse(date)-Date.parse(r.date))/86400000<=14).length);
    out.push({code,year,date,home,away,h:+h,a:+a,live,past,balanced:cutGrid(m.balancedScoreGrid(...live,past)),current:fitRates(fit,home,away),strengths:strengths.map(f=>fitRates(f,home,away)||live),
     shots:year===2026?m.shotEstimate(home,away,current,false,date)?.rates??null:null,elo:hr-ar,eloAll:(across.get(home)??1500)-(across.get(away)??1500),rest:rest[0]-rest[1],load:recent[0]-recent[1],base:[base.homeGoals,base.awayGoals],n:current.length});
   }
  }
  previous.push(...rows);
 }
}
process.stdout.write(JSON.stringify(out));
