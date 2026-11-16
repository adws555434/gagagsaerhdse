'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const core = require('./phase1-backtest.cjs');
const archive = require('./phase2-archive.cjs');
const timing = require('./phase2-timing.cjs');
const root = fs.existsSync(path.join(__dirname, 'index.html')) ? __dirname : path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
const app = new Function(code + `;return {ARCHIVE_LEAGUES, MODEL_VERSION, ENGINE_VERSION, MARKET_VERSION, MARKET_SCORE_VERSION, checkedCsv,
 marketDevig, marketBlend, marketGoalFit, marketScoreDistribution, marketTeamKey, marketTotalsDistribution, marketMixedScores,
 matchOutcome, forecastDecision, strongestOutcome, validDate, createSimulationRandom, prepareForecastDistribution};`)();

const manifest = require('./phase2-inputs.json');
const competitions = {
 'Turkey|Süper Lig': 'tr.1', 'England|Premier League': 'en.1', 'Spain|La Liga': 'es.1',
 'Germany|Bundesliga': 'de.1', 'Italy|Serie A': 'it.1', 'France|Ligue 1': 'fr.1'
};
const modelNames = [
 'Yayın modeli', 'Lig sıklığı', 'Elo', 'Bağımsız Poisson', 'Belirsizlikli Poisson',
 'Piyasa · orantılı', 'Piyasa · power', 'Harman · power'
];
const statisticNames = ['logLoss','rps','brier','result','score','top3'];
const draws = 2000, seed = 19461116, minWeightTraining = 80;
const scale = 20;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const mean = values => values.reduce((a,b) => a+b,0)/values.length;
const outcome = value => ['1','X','2'].indexOf(value);
const join = (date, home, away) => [date,app.marketTeamKey(home),app.marketTeamKey(away)].join('|');

function parseClosing(text) {
 const fields = ['home','draw','away'];
 const price = (row,type) => fields.map(kind => Number(row['pin_'+type+'_'+kind]));
 const required = ['id','kickoff_utc','country','league','home','away','result','void_reason','teams_reversed_after_logging','record_hash',
  ...fields.map(x => 'pin_close_'+x),...fields.map(x => 'pin_open_'+x)];
 const rows = app.checkedCsv(text,required);
 const byLeague = new Map();
 for(const row of rows){
  const league = competitions[row.country+'|'+row.league];
  if(!league)continue;
  const kickoff = Date.parse(row.kickoff_utc);
  const date = row.kickoff_utc.slice(0,10);
  if(!Number.isFinite(kickoff)||!row.kickoff_utc.endsWith('+00:00')||!app.validDate(date)||!row.home||!row.away||!row.id)throw Error('Kapanış satırı geçersiz');
  const reason = row.void_reason || outcome(row.result)<0 ? 'void' :
   row.teams_reversed_after_logging!=='0' ? 'orientation' : null;
  const close = price(row,'close'),open = price(row,'open');
  const snapshot = {league,date,home:row.home,away:row.away,
   actual:outcome(row.result),reason,close,open,kickoff,id:row.id,recordHash:row.record_hash};
  const entries = byLeague.get(league)??new Map();
  const key = join(date,row.home,row.away);
  const old = entries.get(key);
  entries.set(key,old ? {...snapshot,reason:'duplicate'} : snapshot);
  byLeague.set(league,entries);
 }
 return byLeague;
}

function learnWeight(rows, field, before, minimum=minWeightTraining) {
 const training = rows.filter(row => row.date < before && row[field]);
 if(training.length<minimum)return null;
 const reference=training.map(row=>core.metricRow(row.models[0].outcomes,{outcome:-1,score:[''],top:[]},row.actualScore));
 const referenceLogLoss=mean(reference.map(x=>x[0])),referenceRps=mean(reference.map(x=>x[1]));
 const ranked = Array.from({length:scale+1},(_,index)=>{
  const weight = index/scale;
  const values = training.map(row=>{
   const p = app.marketBlend(row.models[0].outcomes,row[field],weight);
   return core.metricRow(p,{outcome:-1,score:[''],top:[]},row.actualScore);
  });
  const logLoss=mean(values.map(x=>x[0])),rps=mean(values.map(x=>x[1]));
  return {weight,n:training.length,logLoss,rps,objective:(logLoss/referenceLogLoss+rps/referenceRps)/2};
 });
 ranked.sort((a,b)=>a.objective-b.objective||a.logLoss-b.logLoss||a.weight-b.weight);
 return ranked[0];
}

function evaluate(matches, weightByMonth, timing='close') {
 return matches.map(row=>{
  const weights=weightByMonth.get(row.date.slice(0,7));
  const market=timing==='close'?row.power:row.open;
  const weight=weights?.[timing]?.weight;
  const inherit=p=>app.marketScoreDistribution(row.models[0],p);
  const distributions=[...row.models,inherit(row.proportional),inherit(row.power)];
  if(weight!=null&&market)distributions.push(inherit(app.marketBlend(row.models[0].outcomes,market,weight)));
  return {...row,metrics:distributions.map(d=>core.metricRow(d.outcomes,app.forecastDecision(d),row.actualScore)),
   probabilities:distributions.map(d=>d.outcomes)};
 });
}

function stats(rows,index){
 if(!rows.length)return null;
 const values=rows.map(row=>row.metrics[index]);
 const p=rows.map(row=>Math.max(...row.probabilities[index]));
 const tiers=[[0,.45],[.45,.55],[.55,.65],[.65,1+Number.EPSILON]].map(([low,high])=>{
  const eligible=values.filter((_,i)=>p[i]>=low&&p[i]<high);
  return {low,high:Math.min(high,1),coverage:core.binomial(eligible.length,rows.length),
   accuracy:core.binomial(eligible.reduce((n,x)=>n+x[3],0),eligible.length)};
 });
 return {n:rows.length,tiers,...Object.fromEntries(statisticNames.map((key,i)=>{
  const total=values.reduce((s,x)=>s+x[i],0);
  return [key,i<3?total/rows.length:core.binomial(total,rows.length)];
 }))};
}

function paired(rows,model,reference=0){
 if(!rows.length)return null;
 const strata=[...core.groupBy(rows,row=>row.league+'|'+(row.season??'')).values()].map(matches=>
  [...core.groupBy(matches,row=>Math.floor(Date.parse(row.date)/604800000)).values()].map(week=>{
   const deltas=statisticNames.map((_,i)=>week.reduce((total,row)=>total+row.metrics[model][i]-row.metrics[reference][i],0));
   return {n:week.length,deltas};
  }));
 if(strata.every(x=>x.length<2))return null;
 const random=app.createSimulationRandom(seed);
 const outcomes=statisticNames.map(()=>new Float64Array(draws));
 for(let i=0;i<draws;i++){
  const d=Array(statisticNames.length).fill(0);
  let n=0;
  for(const blocks of strata)for(let b=0;b<blocks.length;b++){
   const picked=blocks[Math.floor(random()*blocks.length)];
   n+=picked.n;
   for(let m=0;m<d.length;m++)d[m]+=picked.deltas[m];
  }
  d.forEach((delta,m)=>outcomes[m][i]=delta/n);
 }
 return Object.fromEntries(outcomes.map((values,i)=>{
  const sorted=values.sort();
  return [statisticNames[i],{estimate:mean(rows.map(row=>row.metrics[model][i]-row.metrics[reference][i])),
   ci95:[core.percentile(sorted,.025),core.percentile(sorted,.975)]}];
 }));
}

function summarize(rows,withBlend){
 return rows.length?modelNames.slice(0,withBlend?8:7).map((name,i)=>({
  name,...stats(rows,i),versusRelease:i?paired(rows,i):null,
  versusProportional:i===6?paired(rows,i,5):null
 })):null;
}

function assemble(inputs, market) {
 const matches=[],missing=[],counts={};
 const season='2026-27';
 for(const [league,book] of market){
  const archive=inputs.filter(input=>input.league===league);
  const test=archive.find(x=>x.season===season);
  const fit=core.fitSeason(league,archive.filter(x=>x.season<season),season);
  const source=counts[league]={scores:0,eligible:0,matched:0,openPair:0,closingRows:book.size,unmatchedClosingRows:0};
  if(!fit||!test)continue;
  const covered=new Set();
  for(const row of test.rows){
   const {date,home,away}=row;
   const key=join(date,home,away);
   const found=book.get(key);
   if(found)covered.add(key);
   source.scores++;
   const models=fit.predict({date,home,away},x=>x);
   if(models)source.eligible++;
   const actualScore=[row.ft_home,row.ft_away];
   const proportional=app.marketDevig(found?.close,'proportional');
   const power=app.marketDevig(found?.close);
   const reason=!found?'no_closing_row':found.reason||
    (found.actual!==app.matchOutcome(...actualScore)?'result_disagreement':
     !power||!proportional?'closing_incomplete':null);
   if(reason||!models){missing.push({league,date,home,away,modelEligible:Boolean(models),reason:reason??'model_history_short'});continue;}
   source.matched++;
   const open=app.marketDevig(found.open);
   if(open)source.openPair++;
   matches.push({league,season,date,actualScore,models,proportional,power,open,quote:found,overround:found.close.reduce((s,x)=>s+1/x,0)-1});
  }
  for(const [key,row] of book)if(!covered.has(key)){
   source.unmatchedClosingRows++;
   missing.push({league,date:row.date,home:row.home,away:row.away,reason:'archive_match_unavailable'});
  }
 }
 return {matches,missing,counts};
}

const earlyMinimum=40;
function pairedRow(row,distributions){
 return {...row,metrics:distributions.map(d=>core.metricRow(d.outcomes,app.forecastDecision(d),row.actualScore)),
  probabilities:distributions.map(d=>d.outcomes)};
}
function namedStats(rows,namesList){
 return rows.length?namesList.map((name,index)=>({name,...stats(rows,index),versusRelease:index?paired(rows,index):null})):null;
}
function promotionCheck(rows,completeSeasons,independent){
 const seasons=core.groupBy(rows,row=>row.season);
 const full=[...seasons].filter(([season])=>completeSeasons.has(season));
 const regressions=full.filter(([,games])=>mean(games.map(game=>game.metrics[2][0]-game.metrics[0][0]))>0).length;
 const interval=paired(rows,2)?.logLoss?.ci95??null;
 return {eligible:completeSeasons.size>=3&&full.length>=2&&regressions<full.length/2&&interval?.[1]<0&&independent>=500,
  fullArchiveSeasons:completeSeasons.size,fullTestSeasons:full.length,regressions,ci95:interval,independent};
}
function analyzeArchive(old,newData,independent){
 const all=new Map();
 const latest={};
 const modelSources=new Set(['consensus','timestamped']);
 const timestamped=new Set(newData.matches.filter(x=>x.source==='timestamped'&&x.early&&x.close).map(x=>[x.league,x.season,x.identity].join('|')));
 const preferred=row=>row.source==='timestamped'||!timestamped.has([row.league,row.season,row.identity].join('|'));
 const sourceMatches=newData.matches.filter(row=>modelSources.has(row.source)&&preferred(row));
 const consensusLeagues=new Set(sourceMatches.map(x=>x.league));
 const tips=old.filter(row=>row.open).map(row=>({...row,source:'tips',early:row.open,close:row.power}));
 const joined=[...sourceMatches.filter(row=>row.early&&row.close),
  ...tips.filter(row=>!consensusLeagues.has(row.league))];
 const inherited=(row,p)=>app.marketScoreDistribution(row.models[0],p);
 const timingFor=rows=>rows.map(row=>pairedRow(row,[row.models[0],inherited(row,row.early),inherited(row,row.close)]));
 const totalsFor=(rows,includeEarly)=>rows.filter(row=>row.closeMatrix&&(!includeEarly||row.earlyMatrix)).map(row=>
  pairedRow(row,includeEarly?[row.models[0],inherited(row,row.early),row.earlyMatrix,inherited(row,row.close),row.closeMatrix]:
   [row.models[0],inherited(row,row.close),row.closeMatrix]));
 const consensusTotals=sourceMatches;
 const researchTotals=newData.matches.filter(row=>row.source==='oddsintel');
 const blendRows=[];
 const weights={};
 for(const [league,rows] of core.groupBy(joined,row=>row.league)){
  const months=[...new Set(rows.map(row=>row.date.slice(0,7)))].sort();
  const history=new Map(months.map(month=>[month,learnWeight(rows,'early',month+'-01',earlyMinimum)]));
  weights[league]=Object.fromEntries(history);
  latest[league]={source:rows[0].source,early:learnWeight(rows,'early','2026-11-16',earlyMinimum)};
  for(const row of rows){
   const learned=history.get(row.date.slice(0,7));
   if(!learned)continue;
   const base=row.models[0],market=row.earlyMatrix??inherited(row,row.early);
   const blend=row.earlyMatrix?app.marketMixedScores(base,market,learned.weight):
    inherited(row,app.marketBlend(base.outcomes,row.early,learned.weight));
   blendRows.push(pairedRow(row,[base,market,blend]));
  }
 }
 for(const league of ['all',...Object.keys(core.leagueNames)]){
  const ofLeague=rows=>rows.filter(row=>league==='all'||league===row.league);
  const timing=timingFor(ofLeague(joined)), experiments=ofLeague(blendRows);
  const totals=totalsFor(ofLeague(consensusTotals),true);
  const closingResearch=totalsFor(ofLeague(researchTotals),false);
  const bySeason=core.groupBy(newData.coverage.filter(row=>row.fullSeason),row=>row.season);
  const timedFull=core.groupBy(newData.coverage.filter(row=>row.fullSeason&&row.source==='timestamped'),row=>row.season);
  const completeTimedSeasons=new Set([...timedFull].filter(([,rows])=>league==='all'?
   Object.keys(core.leagueNames).every(code=>rows.some(row=>row.league===code)):
   rows.some(row=>row.league===league)).map(([name])=>name));
  const completeSeasons=new Set(Array.from(bySeason).filter(([,coverage])=>league==='all'?
   Object.keys(core.leagueNames).every(code=>coverage.some(row=>row.league===code)):
   coverage.some(row=>row.league===league)).map(([name])=>name));
  const timingStats=namedStats(timing,['Yayın modeli','Erken piyasa · 1X2','Kapanış piyasası · 1X2']);
  const blendStats=namedStats(experiments,['Yayın modeli','Erken piyasa','Erken harman · Lig ağırlığı']);
  all.set(league,{timing:timingStats,timingDelta:paired(timing,2,1),
   totals:namedStats(totals,['Yayın modeli','Erken piyasa · 1X2','Erken piyasa · 1X2 + alt/üst','Kapanış piyasası · 1X2','Kapanış piyasası · 1X2 + alt/üst']),
   totalsVsOneXTwo:{early:paired(totals,2,1),closing:paired(totals,4,3),research:paired(closingResearch,2,1)},
   closingResearch:namedStats(closingResearch,['Yayın modeli','Kapanış piyasası · 1X2','Kapanış piyasası · 1X2 + alt/üst']),
   earlyBlend:blendStats,blendVsEarly:paired(experiments,2,1),
   tiers:[timingStats?.[1],timingStats?.[2],blendStats?.[2]].filter(Boolean).map(({name,tiers})=>({name,tiers})),
   seasonResults:Object.fromEntries(Array.from(core.groupBy(experiments,row=>row.season),([season,rows])=>
    [season,namedStats(rows,['Yayın modeli','Erken piyasa','Erken harman · Lig ağırlığı'])])),
   gate:{...promotionCheck(experiments,completeSeasons,
    league==='all'?independent?.blendSettled??0:independent?.blendByScope?.[league]??0),
     fullArchiveSeasons:completeSeasons.size,fullTimedSeasons:completeTimedSeasons.size}});
 }
 return {leagues:Object.fromEntries(all),latest,weights};
}

function timedResults(matches,track){
 if(!track)return null;
 const linked=timing.attachTrackTimes(matches,track.predictions);
 const resultFor=rows=>{
  const records=rows.map(row=>pairedRow(row,[row.models[0],app.marketScoreDistribution(row.models[0],row.open),
   app.marketScoreDistribution(row.models[0],row.power)]));
  return {rows:records.length,models:namedStats(records,['Yayın modeli','Zaman damgalı erken 1X2','Kapanış 1X2']),
   closingVersusEarly:paired(records,2,1)?.logLoss??null};
 };
 const bands=[[1,6],[6,24],[24,48],[48,Infinity]];
 const byLeague=Object.fromEntries(['all',...Object.keys(core.leagueNames)].map(league=>{
  const rows=linked.rows.filter(row=>league==='all'||row.league===league);
  return [league,{all:resultFor(rows),bands:bands.map(([from,to])=>({from,to:Number.isFinite(to)?to:null,
   ...resultFor(rows.filter(row=>row.leadHours>=from&&row.leadHours<to))}))}];
 }));
 return {source:timing.manifest.tipsTrack,timedMatched:linked.rows.length,excluded:linked.excluded,byLeague};
}

function ledgerStatus(file){
 if(!file)return null;
 const bytes=fs.readFileSync(file);
 const {records,checked}=JSON.parse(bytes);
 const seen=new Set();
 const pairs=[];
 const scopeCounts={};
 for(const row of records.slice().sort((a,b)=>a.savedAt-b.savedAt)){
  const m=row.market;
  if(m?.version!==app.MARKET_VERSION||![row.savedAt,row.kickoff].every(Number.isFinite)||
   !(Date.parse(m.quotedAt)<=Date.parse(m.capturedAt)&&Date.parse(m.capturedAt)<=row.savedAt&&row.savedAt<row.kickoff)||
   !/^[a-f0-9]{64}$/.test(row.dataSha256??'')||!/^[a-f0-9]{64}$/.test(m.dataSha256??'')||
   !row.comparison?.release||!['power','proportional'].every(key=>Array.isArray(m[key]?.probabilities)&&m[key].probabilities.length===3))continue;
  const league=app.ARCHIVE_LEAGUES[row.scope];
  const key=[league,row.kickoff,app.marketTeamKey(row.home),app.marketTeamKey(row.away)].join('|');
  if(!league||seen.has(key))continue;
  seen.add(key);
  if(!Array.isArray(row.actual)||row.actual.length!==2||!row.actual.every(x=>Number.isSafeInteger(x)&&x>=0)||!(row.kickoff<=Date.parse(checked)))continue;
  const choices=[row.comparison.release,m.proportional,m.power,m.blend].filter(Boolean);
  const metric=(snapshot)=>core.metricRow(snapshot.probabilities,{
   outcome:app.strongestOutcome(snapshot.probabilities),
   score:[snapshot.consistentScore],top:snapshot.scores.map(value=>[value])
  },row.actual);
  pairs.push({league,date:row.date,metrics:choices.map(metric),probabilities:choices.map(choice=>choice.probabilities)});
  scopeCounts[league]=(scopeCounts[league]??0)+1;
 }
 const blends=pairs.filter(row=>row.metrics.length===4);
 return {checked,sha256:sha(bytes),captured:seen.size,settled:pairs.length,blendSettled:blends.length,byScope:scopeCounts,
  blendByScope:Object.fromEntries(Array.from(core.groupBy(blends,row=>row.league),([league,rows])=>[league,rows.length])),
  marketPower:pairs.length?{...stats(pairs,2),versusRelease:paired(pairs,2)}:null,
  blend:blends.length?{...stats(blends,3),versusRelease:paired(blends,3)}:null};
}

function selfTest(){
 const geo=app.marketDevig([2,3,4]);
 assert.ok(Math.abs(geo.reduce((sum,n)=>sum+n,0)-1)<1e-12);
 assert.ok(geo[0]>app.marketDevig([2,3,4],'proportional')[0]);
 assert.deepEqual(app.marketDevig([2,2]),[.5,.5]);
 assert.equal(app.marketDevig([0,3,4]),null);
 assert.equal(app.marketDevig([2,undefined,4]),null);
 const d=app.prepareForecastDistribution(1.7,1.1), total=2.8;
 const fit=app.marketGoalFit(d.outcomes,1-Math.exp(-total)*(1+total+total**2/2));
 assert.ok(Math.abs(fit.rates[0]-1.7)<1e-8&&Math.abs(fit.rates[1]-1.1)<1e-8);
 assert.equal(app.marketGoalFit(d.outcomes,null),null);
 const sumCells=(distribution,predicate)=>distribution.grid.reduce((sum,p,i)=>{
  return sum+(predicate(Math.floor(i/distribution.size),i%distribution.size)?p:0);
 },0);
 const market=app.marketTotalsDistribution([.45,.30,.25],.6);
 assert.ok(market.grid.every(p=>Number.isFinite(p)&&p>=0));
 assert.ok(Math.abs(market.grid.reduce((a,b)=>a+b,0)-1)<1e-12);
 assert.ok(Math.abs(sumCells(market,(h,a)=>h+a>2)-.6)<1e-12);
 assert.ok(market.outcomes.every((p,i)=>Math.abs(p-[.45,.3,.25][i])<1e-12));
 assert.equal(app.marketTotalsDistribution([.4,.3,.3],null),null);
 assert.equal(app.marketTotalsDistribution([.4,.3,.31],.6),null);
 const symmetry=app.marketTotalsDistribution([.25,.30,.45],.6);
 assert.ok(Math.abs(symmetry.expectedDifference+market.expectedDifference)<1e-12);
 assert.ok(app.marketMixedScores(d,market,.4).outcomes.every((p,i)=>Math.abs(p-(.6*d.outcomes[i]+.4*market.outcomes[i]))<1e-12));
 assert.ok(Math.abs(sumCells(app.marketMixedScores(d,market,.4),(h,a)=>h+a>2)-
   (.6*sumCells(d,(h,a)=>h+a>2)+.4*.6))<1e-12);
 assert.equal(promotionCheck([],new Set(),500).eligible,false);

 const custom=app.marketScoreDistribution(d,[.1,.6,.3]);
 const classes=[0,0,0];
 for(const [key,p] of custom.scores)classes[app.matchOutcome(...key.split('–').map(Number))]+=p;
 assert.ok(classes.every((p,i)=>Math.abs(p-custom.outcomes[i])<1e-12));
 assert.equal(app.forecastDecision(custom).outcome,1);
 const matches=Array.from({length:90},()=>({date:'2026-08-01',models:[d],power:[.7,.2,.1],actualScore:[1,0]}));
 const before=learnWeight(matches,'power','2026-09-01');
 assert.deepEqual(learnWeight(matches.concat({ ...matches[0], date:'2026-09-01',actualScore:[0,9]}),'power','2026-09-01'),before);
 assert.equal(learnWeight(matches,'power','2026-08-01'),null);
 assert.equal(app.marketTeamKey('Gençlerbirliği S.K.'),app.marketTeamKey('Genclerbirligi'));
 console.log('Faz 2 · marj, gol beklentisi, skor kararları ve dönem sızıntısı denetimleri geçti');
}

async function run(){
 selfTest();
 if(process.argv.includes('--self-test'))return;
 const [dataDir,marketFile,outputDir,tffFile,ledgerFile,extraDir,...licensedFiles]=process.argv.slice(2);
 if(!outputDir)throw Error('Kullanım: node tests/phase2-backtest.cjs ARŞİV_DİZİNİ ORAN_CSV ÇIKTI_DİZİNİ [TFF_JSON] [LEDGER_JSON] [EK_ORAN_DİZİNİ] [ZAMAN_DAMGALI_ORAN_JSON]');
 const bytes=fs.readFileSync(marketFile);
 assert.equal(sha(bytes),manifest.sha256,'Oran kaynağının SHA-256 değeri değişti');
 let inputs=await core.loadInputs(dataDir,false);
 if(tffFile)inputs=inputs.map(input=>input.league==='tr.1'&&input.season==='2025-26'?core.auditTurkey(input,tffFile):input);
 const {matches,missing,counts}=assemble(inputs,parseClosing(bytes.toString('utf8')));
 assert.ok(matches.length);
 const months=[...new Set(matches.map(row=>row.date.slice(0,7)))].sort();
 const weights=new Map(months.map(month=>[month,{
  close:learnWeight(matches,'power',month+'-01'),open:learnWeight(matches,'open',month+'-01')
 }]));
 const all=evaluate(matches,weights),blind=all.filter(row=>row.metrics.length===8);
 const early=evaluate(matches.filter(row=>row.open),weights,'open').filter(row=>row.metrics.length===8);
 const earlyBlend=early.length?{n:early.length,release:stats(early,0),blend:stats(early,7),versusRelease:paired(early,7)}:null;
 const groups=Object.fromEntries(Array.from(core.groupBy(matches,row=>row.league),([league,rows])=>{
  const selected=all.filter(row=>row.league===league);
  return [league,{closing:summarize(selected,false),blend:summarize(selected.filter(row=>row.metrics.length===8),true)}];
 }));
 const openClose=matches.filter(row=>row.open).map(row=>{
  const evalOdds=p=>core.metricRow(p,app.forecastDecision(app.marketScoreDistribution(row.models[0],p)),row.actualScore);
  return {...row,metrics:[evalOdds(row.open),evalOdds(row.power)]};
 });
 const independent=ledgerStatus(ledgerFile);
 const extended=await archive.loadOdds(app,extraDir);
 const licensed=licensedFiles.map(file=>fs.readFileSync(file));
 if(licensed.length)extended.push(timing.licensedOdds(app,licensed.flatMap(bytes=>JSON.parse(bytes).snapshots)));
 const extra=archive.joinArchive(app,inputs,extended);
 const track=extraDir?JSON.parse((await timing.pinnedInput(extraDir,timing.manifest.tipsTrack)).toString('utf8')):null;
 const timed=timedResults(matches,track);
 const extension=analyzeArchive(matches,extra,independent);
 const report={version:app.MARKET_VERSION,scoreVersion:app.MARKET_SCORE_VERSION,baseModel:app.MODEL_VERSION,engine:app.ENGINE_VERSION,source:manifest,
  dataSha256:sha(JSON.stringify([...inputs.flatMap(x=>[x.sha256,...(x.archiveSha256?[x.archiveSha256]:[])]),manifest.sha256,...(extraDir?[...archive.manifest.map(file=>file.sha256),timing.manifest.tipsTrack.sha256]:[]),...licensed.map(sha)])),
  licensedSnapshotHashes:licensed.map(sha),historySnapshotEnd:core.snapshotEnd,predictionTrials:0,bootstrapDraws:draws,seed,weightStep:1/scale,minWeightTraining,
  publicationTimeAuditedPerClosingQuote:false,closingTotals:extraDir?'partial':null,archiveCoverage:extra.coverage,archiveSources:extraDir?archive.manifest:[],independent,defaultChanged:false,
  cutoff:'2026-11-16',leagueLabels:core.leagueNames,counts,weights:Object.fromEntries(weights),
  experimentalWeights:{byLeague:extension.latest,preMatch:learnWeight(matches,'open','2026-11-16'),closing:learnWeight(matches,'power','2026-11-16')},
  closing:summarize(all,false),blend:summarize(blind,true),earlyBlend,leagues:groups,
  openVsClose:{n:openClose.length,openLogLoss:mean(openClose.map(x=>x.metrics[0][0])),
   closingLogLoss:mean(openClose.map(x=>x.metrics[1][0])),openRps:mean(openClose.map(x=>x.metrics[0][1])),
   closingRps:mean(openClose.map(x=>x.metrics[1][1])),paired:paired(openClose,1)},
  extension,timed,meanPinnacleOverround:mean(matches.map(x=>x.overround))};
 const compact=rows=>rows?.map(({versusRelease,versusProportional,tiers,...row})=>row)??null;
 const publicExtension=Object.fromEntries(Object.entries(extension.leagues).map(([key,value])=>[key,{
  timing:compact(value.timing),totals:compact(value.totals),closingResearch:compact(value.closingResearch),
  earlyBlend:compact(value.earlyBlend),tiers:value.tiers
 }]));
 const timingRows=timed?Object.fromEntries(Object.entries(timed.byLeague).map(([key,rows])=>[key,{
  all:compact(rows.all.models),bands:rows.bands.map(({from,to,models})=>({from,to,models:compact(models)}))
 }])):null;
 const written={version:report.version,timingRows,scoreVersion:report.scoreVersion,dataSha256:report.dataSha256,cutoff:report.cutoff,source:report.source,leagueLabels:report.leagueLabels,
  experimentalWeights:report.experimentalWeights,closingEvidence:report.closing[6]?.versusRelease?.logLoss??null,extension:publicExtension,closing:compact(report.closing),blend:compact(report.blend),
  leagues:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,{closing:compact(v.closing),blend:compact(v.blend)}]))};
 fs.mkdirSync(outputDir,{recursive:true});
 for(const [file,data] of [['phase2-results.json',report],['phase2-market-report.json',written],['phase2-missing.json',{counts,missing,archive:extra.exclusions}]]){
  fs.writeFileSync(path.join(outputDir,file),JSON.stringify(data)+'\n');
 }
 console.log(JSON.stringify({closingN:all.length,harmonizedN:blind.length,counts,weights:report.weights,openVsClose:{
  n:openClose.length,open:report.openVsClose.openLogLoss,close:report.openVsClose.closingLogLoss
 },archiveCoverage:extra.coverage,extensionWeights:extension.latest,unmatchedSamples:missing.filter(x=>x.reason==='archive_match_unavailable').slice(0,50)},null,2));
}

module.exports={app,promotionCheck};

if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
