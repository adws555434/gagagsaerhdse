'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const core=require('./phase1-backtest.cjs');
const manifest=require('./phase2-archive-inputs.json');

const leagues={'LaLiga':'es.1','Serie A':'it.1','Bundesliga':'de.1',
 'Premier League (England)':'en.1','LaLiga (Spain)':'es.1','La Liga (Spain)':'es.1',
 'Serie A (Italy)':'it.1','Bundesliga (Germany)':'de.1','Ligue 1 (France)':'fr.1',
 'Süper Lig (Turkey)':'tr.1','SuperLiga (Turkey)':'tr.1'};
const outcomes=['home','draw','away'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const identity=(app,date,home,away)=>[date,app.marketTeamKey(home),app.marketTeamKey(away)].join('|');
const goals=value=>/^\d+$/.test(value??'')?Number(value):null;

function probabilities(raw){
 if(!Array.isArray(raw)||raw.length!==3||!raw.every(p=>Number.isFinite(p)&&p>0&&p<1))return null;
 const sum=raw.reduce((a,b)=>a+b,0);
 return Math.abs(sum-1)<=.002?raw.map(p=>p/sum):null;
}
const over=value=>Number(value)>0&&Number(value)<1?Number(value):null;
const snapshot=(p,total)=>p?{p,over25:total}:null;

function readOne(app,file,source){
 const bytes=fs.readFileSync(file);
 assert.equal(sha(bytes),source.sha256,'Oran SHA-256 uyuşmazlığı: '+source.file);
 const consensus=source.kind==='consensus';
 const required=consensus?['date_uk','season','open_over25_prob','close_over25_prob',...outcomes.flatMap(key=>['open_'+key+'_prob','close_'+key+'_prob'])]:
  ['competition','ou25_over_fair_p',...outcomes.map(key=>'1x2_'+key+'_fair_p')];
 const rows=app.checkedCsv(bytes.toString('utf8'),['match_id','kickoff_utc','home_team','away_team','result','home_goals','away_goals',...required]);
 const data=[];
 for(const row of rows){
  const league=source.league??leagues[consensus?row.league:row.competition];
  if(!league)continue;
  const kickoff=Date.parse(row.kickoff_utc+(row.kickoff_utc.endsWith('Z')||row.kickoff_utc.includes('+')?'':'Z'));
  const date=consensus?row.date_uk:row.kickoff_utc.slice(0,10);
  const home=row.home_team,away=row.away_team;
  const actual=[goals(row.home_goals),goals(row.away_goals)];
  if(!Number.isFinite(kickoff)||!app.validDate(date)||!home||!away||!row.match_id||
   (consensus&&row.season!==source.season))throw Error('Oran fikstürü geçersiz: '+source.file+' '+row.match_id);
  const declared=outcomes.indexOf(row.result);
  const verified=declared>=0&&actual.every(value=>value!=null)&&app.matchOutcome(...actual)===declared;
  const fromConsensus=key=>snapshot(probabilities(outcomes.map(kind=>Number(row[key+'_'+kind+'_prob']))),over(row[key+'_over25_prob']));
  const early=consensus?fromConsensus('open'):null;
  const close=consensus?fromConsensus('close'):snapshot(probabilities(outcomes.map(key=>Number(row['1x2_'+key+'_fair_p']))),over(row.ou25_over_fair_p));
  data.push({league,season:source.season,date,home,away,actual,verified,early,close,kickoff});
 }
 return data;
}

async function loadOdds(app,folder){
 if(!folder)return [];
 fs.mkdirSync(folder,{recursive:true});
 return Promise.all(manifest.map(async source=>{
  const file=path.join(folder,source.file);
  if(!fs.existsSync(file)){
   const response=await fetch(source.url,{signal:AbortSignal.timeout(30_000)});
   if(!response.ok)throw Error('Oran arşivi alınamadı: '+source.file+' HTTP '+response.status);
   const bytes=Buffer.from(await response.arrayBuffer());
   assert.equal(sha(bytes),source.sha256,source.file);
   fs.writeFileSync(file,bytes);
  }
  return {source,rows:readOne(app,file,source)};
 }));
}

function joinArchive(app,inputs,files){
 const matches=[],exclusions=[],coverage=[];
 const cache=new Map();
 const fit=(league,season)=>{
  const key=league+'|'+season;
  if(!cache.has(key)){
   const available=inputs.filter(input=>input.league===league);
   const test=available.find(input=>input.season===season);
   assert.ok(test,key);
   const records=new Map();
   const names=new Set();
   for(const game of test.rows){
    const id=identity(app,game.date,game.home,game.away);
    assert.ok(!records.has(id),'Aynı takım kimliği ve tarihte mükerrer skor: '+key+' '+id);
    records.set(id,game);
    names.add(game.home);names.add(game.away);
   }
   const canonical=new Map();
   for(const name of names){
    const id=app.marketTeamKey(name);
    assert.ok(!canonical.has(id)||canonical.get(id)===name,'Takım kimliği çakıştı: '+key+' '+id);
    canonical.set(id,name);
   }
   cache.set(key,{records,sourceRows:test.sourceRows,model:core.fitSeason(league,available.filter(input=>input.season<season),season)});
  }
  return cache.get(key);
 };
 for(const {source,rows} of files){
  for(const [group,odds] of core.groupBy(rows,row=>row.league+'|'+row.season)){
   const [league,season]=group.split('|');
   const {model,records,sourceRows}=fit(league,season);
   assert.ok(model);
   const identified=core.groupBy(odds,row=>identity(app,row.date,row.home,row.away));
   const tally={league,season,source:source.kind,listed:odds.length,archiveN:records.size,
    fullSeason:(Number(season.slice(0,4))+1)+'-07-01'<=core.snapshotEnd&&
     odds.length===sourceRows&&identified.size===odds.length&&
     odds.every(row=>row.early&&row.close&&row.early.over25!=null&&row.close.over25!=null),
    verified:0,early:0,close:0,both:0,earlyTotals:0,closeTotals:0,bothTotals:0};
   coverage.push(tally);
   for(const [id,snapshots] of identified){
    const row=snapshots[0], archive=records.get(id);
    const exactScore=archive&&row.verified&&(source.kind==='timestamped'||
     (row.actual[0]===archive.ft_home&&row.actual[1]===archive.ft_away));
    const excluded=reason=>exclusions.push({league,season,source:source.kind,date:row.date,home:row.home,away:row.away,reason});
    if(snapshots.length!==1){excluded('duplicate');continue;}
    if(!exactScore){excluded(!archive?'archive_match_unavailable':'score_disagreement');continue;}
    tally.verified++;
    const release=model.predict({date:archive.date,home:archive.home,away:archive.away},d=>d)?.[0];
    if(!release){excluded('model_history_short');continue;}
    if(!row.early&&!row.close){excluded('incomplete_market');continue;}
    const earlyMatrix=app.marketTotalsDistribution(row.early?.p,row.early?.over25);
    const closeMatrix=app.marketTotalsDistribution(row.close?.p,row.close?.over25);
    tally.early+=Number(Boolean(row.early));tally.close+=Number(Boolean(row.close));
    tally.both+=Number(Boolean(row.early&&row.close));
    tally.earlyTotals+=Number(Boolean(earlyMatrix));tally.closeTotals+=Number(Boolean(closeMatrix));
    tally.bothTotals+=Number(Boolean(earlyMatrix&&closeMatrix));
    matches.push({league,season,date:row.date,identity:id,source:source.kind,actualScore:[archive.ft_home,archive.ft_away],
     models:[release],early:row.early?.p,close:row.close?.p,earlyMatrix,closeMatrix});
   }
   tally.fullSeason=tally.fullSeason&&tally.verified===sourceRows;
   for(const [id,record] of records){
    if(identified.has(id)||source.kind==='oddsintel')continue;
    exclusions.push({league,season,source:source.kind,date:record.date,home:record.home,away:record.away,reason:'market_match_unavailable'});
   }
  }
 }
 return {matches,exclusions,coverage};
}

module.exports={loadOdds,joinArchive,manifest,probabilities};
