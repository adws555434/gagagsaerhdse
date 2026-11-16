'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');

const parent=path.resolve(__dirname,'..');
const root=fs.existsSync(path.join(parent,'index.html'))?parent:path.resolve(parent,'..');
const fpath=process.argv[2];
if(!fpath)throw Error('Usage: node features.cjs /data/folder');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'sources.json'),'utf8'));
const sources=Object.fromEntries(manifest.map(({file,sha256})=>{
 const buffer=fs.readFileSync(path.join(fpath,file));
 assert.equal(createHash('sha256').update(buffer).digest('hex'),sha256,file);
 return [file,buffer.toString('utf8')];
}));
const src=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
const m=new Function(src+';return {csv,cleanRows,archiveRows,clubModelKey,rowKey,compareDate,estimateGoals,forecastModel,ARCHIVE_MODEL,archiveModelRates,balancedScoreGrid,SCORE_GRID_SIZE,scheduleStrength,eloRatings};')();
const alias={
 addemirspor:'adanademirspor',antalya:'antalyaspor',erzurum:'erzurumspor',bberzurumspor:'erzurumspor',
 eyup:'eyupspor',gaziantepbb:'gaziantep',goztep:'goztepe',karagumruksk:'fatihkaragumruk',
 karagumruk:'fatihkaragumruk',buyuksehyr:'basaksehir',buyuksehir:'basaksehir',rizespor:'caykurrizespor',
 bodrum:'bodrumspor',yms:'yenimalatyaspor'
};
function team(name){
 const key=m.clubModelKey(name);
 if(!key)throw Error('Missing team');
 return alias[key]||key;
}
function rows(rows,cutoff){
 return m.cleanRows(rows.map(r=>({...r,home:team(r.home),away:team(r.away)})),cutoff,true);
}
const historic=m.csv(sources['turkey.csv']).filter(row=>row.tier==='1')
 .map(row=>({year:Number(row.Season),date:row.Date,home:row.home,away:row.visitor,ft_home:row.hgoal,ft_away:row.vgoal}));
const tff=JSON.parse(sources['tff-results.json']).matches;
assert.equal(tff.length,306);
const tffRows=tff.map(row=>({...row,ft_home:row.score[0],ft_away:row.score[1]}));
const years=Array.from({length:17},(_,i)=>2010+i);
const dated=Object.fromEntries(years.map(year=>[year,rows(year<2025?historic.filter(row=>row.year===year):
 year===2025?tffRows:
 m.csv(sources['tr.1.csv']),'2026-11-15')]));
const folder='TUR_1_super-lig';
const days=[45,90,180,360,720];
const cutoffDays=(after,before)=>(Date.parse(after)-Date.parse(before))/86400000;
const limit=x=>Math.min(6,Math.max(.08,x));
function rates(fit,h,a,otherwise){
 const home=fit.teams.get(h),away=fit.teams.get(a);
 return home&&away?[limit(fit.home*home.attack*away.defense),limit(fit.away*away.attack*home.defense)]:otherwise;
}
function scoreGrid(live,past){
 const grid=m.balancedScoreGrid(...live,past);
 return Array.from({length:10},(_,i)=>grid.slice(i*m.SCORE_GRID_SIZE,i*m.SCORE_GRID_SIZE+10)).flat();
}
const features=[];
for(const year of years.slice(2)){
 const season=dated[year];
 const old=[...dated[year-2],...dated[year-1]].sort(m.compareDate);
 const historicalCount=new Map();
 for(const row of old)for(const t of [row.home,row.away])historicalCount.set(t,(historicalCount.get(t)||0)+1);
 const dates=[...new Set(season.map(row=>row.date))];
 const schedule=old.concat(season);
 for(const date of dates){
  const current=season.filter(row=>row.date<date);
  const prior=schedule.filter(row=>row.date<date).sort(m.compareDate);
  if(current.length<20)continue;
  assert.ok(prior.every(row=>row.date<date));
  const fits=days.map(d=>m.scheduleStrength(prior,d,date));
  const currentElo=m.eloRatings(current),longElo=m.eloRatings(prior);
  for(const row of season.filter(r=>r.date===date)){
   const {home,away}=row;
   const base=m.estimateGoals(home,away,current,false);
   if(!base)continue;
   const liveModel=m.forecastModel(home,away,base,current,{folder},{date});
   const live=[liveModel.rates.homeGoals,liveModel.rates.awayGoals];
   const historical=Math.min(historicalCount.get(home)||0,historicalCount.get(away)||0)>=5;
   const past=historical?m.archiveModelRates(base,currentElo.get(home)??1500,currentElo.get(away)??1500,fits[4],home,away,false):null;
   const histories=[home,away].map(t=>prior.filter(r=>r.home===t||r.away===t));
   const rest=histories.map(h=>h.length?Math.min(14,cutoffDays(date,h.at(-1).date)):14);
   const load=histories.map(h=>h.filter(r=>cutoffDays(date,r.date)<=14).length);
   features.push({code:'tr.1',year,date,home,away,h:Number(row.ft_home),a:Number(row.ft_away),live,past,balanced:scoreGrid(live,past),
    strengths:fits.map(fit=>rates(fit,home,away,live)),shots:null,
    elo:(currentElo.get(home)??1500)-(currentElo.get(away)??1500),eloAll:(longElo.get(home)??1500)-(longElo.get(away)??1500),rest:rest[0]-rest[1],load:load[0]-load[1]});
  }
 }
}
const cross=new Map(historic.map(row=>[m.rowKey({...row,home:team(row.home),away:team(row.away)}),[row.ft_home,row.ft_away].map(Number)]));
const audit={};
for(const year of [2018,2019,2020,2024,2025]){
 const file=path.join(fpath,year+'-'+String(year+1).slice(-2)+'-tr.1.json');
 const priorSource=rows(m.archiveRows(fs.readFileSync(file,'utf8'),'2026-07-01',{includeFlatScores:true}).rows,'2026-07-01');
 let common=0,agree=0;
 for(const row of priorSource){
  const matched=year===2025?dated[year].find(item=>m.rowKey(item)===m.rowKey(row)):null;
  const matches=matched?[matched.ft_home,matched.ft_away]:cross.get(m.rowKey(row));
  if(matches){common++;agree+=Number(matches[0]===Number(row.ft_home)&&matches[1]===Number(row.ft_away));}
 }
 audit[year]={archive:priorSource.length,common,agree};
}
process.stdout.write(JSON.stringify({features,coverage:Object.fromEntries(years.map(year=>[year,dated[year].length])),audit}));
