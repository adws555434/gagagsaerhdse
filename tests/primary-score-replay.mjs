import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {SCOPE,VERSION,historyKey,sha256} from '../sim/super-lig-model.mjs';
import {analyticMatrix,SIZE,summarize} from '../sim/event-engine.mjs';
import {loadCases} from './event-cases.mjs';

const {loadInputs,auditTurkey,binomial,percentile,groupBy}=createRequire(import.meta.url)('./phase1-backtest.cjs');
const [historyPath,inputDir,tffPath,output]=process.argv.slice(2);
assert.ok(output,'Usage: node tests/primary-score-replay.mjs TURKEY_CSV INPUT_DIR TFF_JSON OUTPUT_JSON');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
const app=new Function(script+';return {MODEL_VERSION,clubModelKey,estimateGoals,forecastModel,prepareForecastDistribution,forecastDecision};')();
const {cases,inputSha}=await loadCases(historyPath,inputDir,tffPath);
const key=row=>[row.date,...[row.home,row.away].map(team=>historyKey(team,app.clubModelKey))].join('|');
const eventCases=new Map(cases.map(entry=>[key(entry.row),entry]));
const seasons=(await loadInputs(inputDir,false)).filter(row=>row.league==='tr.1'&&row.season>='2023-24')
 .map(row=>row.season==='2025-26'?auditTurkey(row,tffPath):row).sort((a,b)=>a.season.localeCompare(b.season));
const loss=p=>-Math.log(Math.max(1e-15,p||0));
const score=(h,a)=>h+'–'+a;
const rows=[];
for(const season of seasons){
 for(const match of season.rows){
  const {date,home,away,ft_home:h,ft_away:a}=match;
  const previous=season.rows.filter(row=>row.date<date);
  const base=app.estimateGoals(home,away,previous);
  if(!base)continue;
  const entry=eventCases.get(key(match));
  if(!entry)continue;
  assert.deepEqual([h,a],[entry.row.h,entry.row.a]);
  const rates=app.forecastModel(home,away,base,previous,{folder:SCOPE},{date}).rates;
  const publication=app.prepareForecastDistribution(rates.homeGoals,rates.awayGoals);
  const {matrix}=analyticMatrix(entry.input);
  const simulation=summarize(matrix);
  const actual=score(h,a);
  const result=(pick,top,probability)=>({pick,hit:Number(pick===actual),top3:Number(top.includes(actual)),loss:loss(probability)});
  rows.push({date,season:season.season,
   simulation:result(score(simulation.pick.home,simulation.pick.away),simulation.top.map(row=>score(row.home,row.away)),h<SIZE&&a<SIZE?matrix[h*SIZE+a]:0),
   release:result(publication.scores[0][0],publication.scores.slice(0,3).map(row=>row[0]),h<publication.size&&a<publication.size?publication.grid[h*publication.size+a]:0)});
 }
}
assert.ok(rows.length>0);
const mean=(list,fn)=>list.reduce((sum,row)=>sum+fn(row),0)/list.length;
const byModel=rows=>Object.fromEntries(['simulation','release'].map(name=>[
 name,{exact:binomial(rows.reduce((s,m)=>s+m[name].hit,0),rows.length),
  top3:binomial(rows.reduce((s,m)=>s+m[name].top3,0),rows.length),logLoss:mean(rows,r=>r[name].loss)}
]));
function interval(rows,metric){
 const groups=[...groupBy(rows,r=>Math.floor(Date.parse(r.date)/604800000)).values()]
  .map(group=>[group.length,group.reduce((sum,row)=>sum+row.simulation[metric]-row.release[metric],0)]);
 let state=0x519343e3;
 const sampled=Array.from({length:2000},()=>{
  let n=0,value=0;
  for(let i=0;i<groups.length;i++){
   state=(Math.imul(state,1664525)+1013904223)>>>0;
   const [size,total]=groups[Math.floor(state/4294967296*groups.length)];
   n+=size;value+=total;
  }
  return value/n;
 }).sort((a,b)=>a-b);
 return {delta:mean(rows,r=>r.simulation[metric]-r.release[metric]),ci95:[percentile(sampled,.025),percentile(sampled,.975)]};
}
const disagreements=rows.filter(row=>row.simulation.pick!==row.release.pick);
assert.ok(disagreements.length>0);
const paired={logLoss:interval(rows,'loss'),exact:interval(rows,'hit'),differentScores:interval(disagreements,'hit')};
// A challenger must improve log loss with a clear paired advantage and avoid a lower displayed-score hit rate.
const selected=paired.logLoss.ci95[0]>0&&paired.exact.delta<=0?'release':'simulation';
const report={version:1,scope:SCOPE,eventModel:VERSION,releaseModel:app.MODEL_VERSION,selected,
 period:[rows[0].date,rows.at(-1).date],n:rows.length,inputSha,
 sampleSha:await sha256(JSON.stringify(seasons.map(s=>[s.season,s.sha256,s.archiveSha256??null]))),
 bySeason:Object.fromEntries(Object.entries(Object.fromEntries(groupBy(rows,r=>r.season))).map(([season,rows])=>[season,rows.length])),
 models:byModel(rows),disagreements:{n:disagreements.length,models:byModel(disagreements)},paired,
 historicalMarket:'notRun',simulationMethod:'analytic'};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
