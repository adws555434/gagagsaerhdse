'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const nearby=path.resolve(__dirname,'..');
const root=fs.existsSync(path.join(nearby,'index.html'))?nearby:path.resolve(nearby,'..');
const source=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
const engine=new Function(source+';return {estimateGoals,forecastModel,scheduleStrength,balancedScoreGrid,ARCHIVE_MODEL,archiveModelRates,eloRatings,SCORE_GRID_SIZE};')();
const {estimateGoals,forecastModel,scheduleStrength,balancedScoreGrid,ARCHIVE_MODEL,archiveModelRates,eloRatings,SCORE_GRID_SIZE}=engine;
const matches=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
assert.ok(matches.every(row=>/^\d{4}-\d{2}-\d{2}$/.test(row.date)));
const folders={eng:'ENG_1_premier-league',esp:'ESP_1_la-liga',fra:'FRA_1_ligue-1',ger:'GER_1_bundesliga',ita:'ITA_1_serie-a'};
const asRow=r=>({date:r.date,home:String(r.h),away:String(r.a),ft_home:r.gh,ft_away:r.ga});
const rate=(fit,home,away)=>{
 const h=fit.teams.get(home),a=fit.teams.get(away);
 return h&&a?[fit.home*h.attack*a.defense,fit.away*a.attack*h.defense]:null;
};
const windows=[90,240,600];
function bound(x){return Math.max(.08,Math.min(6,x));}
function scoreGrid(rates,past){
 const side=9,grid=balancedScoreGrid(...rates,past);
 return Array.from({length:side},(_,i)=>grid.slice(i*SCORE_GRID_SIZE,i*SCORE_GRID_SIZE+side)).flat();
}
const records=[];
for(const [comp,folder] of Object.entries(folders)){
 const league=matches.filter(row=>row.league===comp);
 let prior=[],curr=[],currentSeason;
 const squads=new Map(),players=new Map();
 function register(row){
  const {h,a,gh,ga,xh,xa,sh,sa}=row;
  const entries=[[h,sh,xh-xa],[a,sa,xa-xh]];
  if(row.ok&&Number.isFinite(xh)&&Number.isFinite(xa))for(const [team,xi,diff] of entries){
   if(!xi||new Set(xi).size!==11)continue;
   const recent=squads.get(team)||[];
   recent.push(xi);
   squads.set(team,recent.slice(-8));
   // Record only completed-match player affiliations and shrunk goal-difference evidence.
   for(const id of xi){
    const entry=players.get(id)||{n:0,total:0};
    players.set(id,{n:.975*entry.n+1,total:.975*entry.total+diff});
   }
  }
  prior.push(row);curr.push(row);
 }
 function lineupInputs(team,xi){
  const recent=squads.get(team);
  if(!recent||recent.length<3||!xi||new Set(xi).size!==11)return null;
  const rate=id=>{
   const p=players.get(id);
   return p?p.total/(8+p.n):0;
  };
  const strength=members=>members.reduce((sum,id)=>sum+rate(id),0)/11;
  const recentStrength=recent.reduce((sum,group)=>sum+strength(group),0)/recent.length;
  const stability=xi.reduce((sum,id)=>sum+recent.filter(group=>group.includes(id)).length,0)/(11*recent.length);
  return [strength(xi)-recentStrength,stability];
 }
 const batches=new Map();
 for(const match of league){
  if(!batches.has(match.date))batches.set(match.date,[]);
  batches.get(match.date).push(match);
 }
 for(const [date,today] of batches){
  const season=today[0].season;
  if(season!==currentSeason){curr=[];currentSeason=season;}
  if(curr.length>=20){
   assert.ok(curr.every(row=>row.date<date));
   const cutoff=(Date.parse(date)-730*86400000);
   const history=prior.filter(r=>Date.parse(r.date)>=cutoff);
   const hrows=history.filter(row=>row.ok&&Number.isFinite(row.xh)&&Number.isFinite(row.xa));
   const baserows=curr.map(asRow);
   const xgRows=hrows.map(row=>({...asRow(row),ft_home:row.xh,ft_away:row.xa}));
   const count=new Map();
   for(const row of hrows)for(const t of [row.h,row.a])count.set(t,(count.get(t)||0)+1);
   const fits=windows.map(days=>scheduleStrength(xgRows,days,date));
   const all=history.map(asRow),ago=history.filter(row=>row.season!==season).map(asRow);
   const archived=scheduleStrength(all,720,date);
   const arCount=new Map();
   for(const row of ago)for(const t of [row.home,row.away])arCount.set(t,(arCount.get(t)||0)+1);
   const ratings=eloRatings(baserows);
   for(const row of today){
    const home=String(row.h),away=String(row.a);
    const base=estimateGoals(home,away,baserows,false);
    if(!base)continue;
    const f=forecastModel(home,away,base,baserows,{folder},{date});
    const baseline=[f.rates.homeGoals,f.rates.awayGoals];
    const hasHistory=Math.min(arCount.get(home)||0,arCount.get(away)||0)>=5;
    const older=hasHistory?archiveModelRates(base,ratings.get(home)??1500,ratings.get(away)??1500,archived,home,away,false):null;
    const covered=Math.min(count.get(row.h)||0,count.get(row.a)||0)>=8;
    const xg=covered?fits.map(fit=>(rate(fit,home,away)||baseline).map(bound)):null;
    const first=lineupInputs(row.h,row.sh),second=lineupInputs(row.a,row.sa);
    const xi=row.ok&&first&&second?[first,second]:null;
    assert.ok([baseline,older,...(xg||[])].filter(Boolean).every(pair=>pair.every(Number.isFinite)));
    records.push({id:row.id,league:comp,year:2000+Number(row.season.slice(0,2)),date,y:[row.gh,row.ga],baseline,older,balanced:scoreGrid(baseline,older),xg,xi});
   }
  }
  for(const row of today)register(row);
 }
}
process.stdout.write(JSON.stringify(records));
