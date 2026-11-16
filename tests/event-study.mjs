import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {ARCHIVE_SOURCE,VERSION} from '../sim/super-lig-model.mjs';
import {ASSUMED_EFFECTS,NO_EFFECTS,SIZE,analyticMatrix,outcomeOf,summarize} from '../sim/event-engine.mjs';
import {loadCases} from './event-cases.mjs';
import {chronologicalEventFit,matchEventArchive} from './event-fit.mjs';

const {binomial,percentile}=createRequire(import.meta.url)('./phase1-backtest.cjs');
const [history,inputs,tff,events,output,reusePath]=process.argv.slice(2);
const sample=JSON.parse(fs.readFileSync(events,'utf8'));
const {rows,cases,key,inputSha}=await loadCases(history,inputs,tff);
const previous=JSON.parse(fs.readFileSync(new URL('../event-validation.json',import.meta.url),'utf8'));
assert.equal(inputSha,previous.inputSha);
assert.equal(cases.length,9924);
const source=matchEventArchive(sample.matches,cases,key);
const fitter=chronologicalEventFit(source);
const reuse=reusePath?JSON.parse(fs.readFileSync(reusePath,'utf8')):null;
if(reuse){
 assert.equal(reuse.inputSha,inputSha);
 assert.equal(reuse.version,VERSION);
 assert.ok(reuse.study.results.disabled&&reuse.study.results.corrected);
}
const periods=['all','1994–2004','2005–2014','2015–2026'];
const variants=reuse?['assumed','fitted']:['assumed','disabled','fitted','corrected'];
const bands=['<30%','30–<35%','35–<40%','≥40%'];
const stats=Object.fromEntries(variants.map(name=>[name,Object.fromEntries(periods.map(period=>[period,makeStats()]))]));
const weeks=Object.fromEntries(variants.slice(1).map(name=>[name,new Map()]));
const totalsIndex=Uint8Array.from({length:SIZE*SIZE},(_,i)=>Math.min(5,Math.floor(i/SIZE)+i%SIZE));
const grid=[0,-.16,-.08,.08,.16].flatMap(draw=>[0,-.22,-.11,.11,.22].map(tail=>({
 draw,tail,loss:0,pending:0,
 weights:Float64Array.from({length:SIZE*SIZE},(_,i)=>Math.exp(draw*Number(Math.floor(i/SIZE)===i%SIZE)+tail*Number(totalsIndex[i]<=1||totalsIndex[i]===5)))
})));
let selected=grid[0],previousDay=-Infinity,training=0,fittedCases=0,largestTail=0;
const started=performance.now();

function makeStats(){
 return {n:0,winner:0,score:0,globalScore:0,top3:0,loss:0,mass:0,
  scores:Array.from({length:25},()=>[0,0]),totals:Array.from({length:6},()=>[0,0]),
  bands:bands.map(()=>({n:0,hits:0,mass:0})),blocks:new Map(),params:{}};
}
function observe(model,row,matrix,prepared,week){
 const {winner,pick,top}=prepared;
 const exact=top[0];
 const goal=row.h*SIZE+row.a;
 const hit=Number(top.some(s=>s.home===row.h&&s.away===row.a));
 const mass=top.reduce((sum,s)=>sum+s.count,0);
 const loss=-Math.log(Math.max(1e-15,matrix[goal]??0));
 model.n++;
 model.winner+=Number(winner===outcomeOf(row.h,row.a));
 model.score+=Number(pick.home===row.h&&pick.away===row.a);
 model.globalScore+=Number(exact.home===row.h&&exact.away===row.a);
 model.top3+=hit;model.mass+=mass;model.loss+=loss;
 const band=model.bands[(mass<.30?0:mass<.35?1:mass<.40?2:3)];
 band.n++;band.hits+=hit;band.mass+=mass;
 const block=model.blocks.get(week)??[0,0,0];
 block[0]++;block[1]+=mass;block[2]+=hit;
 model.blocks.set(week,block);
 for(let h=0;h<=4;h++)for(let a=0;a<=4;a++){
  const entry=model.scores[h*5+a];
  entry[0]+=matrix[h*SIZE+a];
  entry[1]+=Number(h===row.h&&a===row.a);
 }
 for(let i=0;i<matrix.length;i++)model.totals[totalsIndex[i]][0]+=matrix[i];
 model.totals[Math.min(5,row.h+row.a)][1]++;
 return [loss,hit];
}
function observeDelta(name,period,week,base,value){
 for(const group of ['all',period]){
  const map=weeks[name].get(group)??new Map();
  const block=map.get(week)??[0,0,0];
  block[0]++;block[1]+=value[0]-base[0];block[2]+=value[1]-base[1];
  map.set(week,block);weeks[name].set(group,map);
 }
}
function bootstrap(blocks){
 const values=[...blocks.values()], loss=[], hit=[], diff=[];
 let seed=0x3a445749;
 for(let i=0;i<2000;i++){
  let n=0,x=0,y=0;
  for(let j=0;j<values.length;j++){
   seed=(Math.imul(seed,1664525)+1013904223)>>>0;
   const [m,a,b]=values[Math.floor(seed/4294967296*values.length)];
   n+=m;x+=a;y+=b;
  }
  loss.push(x/n);hit.push(y/n);diff.push((y-x)/n);
 }
 return [loss,hit,diff].map(numbers=>{
  numbers.sort((a,b)=>a-b);
  return [percentile(numbers,.025),percentile(numbers,.975)];
 });
}
function measure(model){
 const {n,scores,totals,blocks}=model;
 const frequency=([predicted,hits],label)=>({label,predicted:predicted/n,actual:hits/n,delta:(hits-predicted)/n,hits});
 const [massCI,,gapCI]=bootstrap(blocks);
 return {n,winner:binomial(model.winner,n),score:binomial(model.score,n),globalScore:binomial(model.globalScore,n),
  top3:binomial(model.top3,n),logLoss:model.loss/n,expectedTop3:model.mass/n,expectedTop3CI95:massCI,
  top3GapCI95:gapCI,scores:scores.map((entry,i)=>frequency(entry,Math.floor(i/5)+'–'+i%5)),
  totals:totals.map((entry,i)=>frequency(entry,i===5?'5+':String(i))),
  bands:model.bands.map((x,i)=>({band:bands[i],...binomial(x.hits,x.n),expected:x.n?x.mass/x.n:null})),params:model.params};
}
for(const {row,input} of cases){
 const year=Number(row.date.slice(0,4));
 const period=periods[year<=2004?1:year<=2014?2:3];
 const week=Math.floor(row.day/7);
 if(row.day!==previousDay){
  for(const setting of grid){setting.loss+=setting.pending;setting.pending=0;}
  if(training>=100)selected=grid.reduce((best,x)=>x.loss<best.loss?x:best);
  previousDay=row.day;
 }
 const assumed=analyticMatrix(input);
 largestTail=Math.max(largestTail,assumed.tail);
 const fitted=fitter.at(row.date);
 if(fitted!==ASSUMED_EFFECTS)fittedCases++;
 const matrices={assumed:assumed.matrix,fitted:fitted===ASSUMED_EFFECTS?assumed.matrix:analyticMatrix({...input,effects:fitted}).matrix};
 if(!reuse){
  matrices.disabled=analyticMatrix({...input,effects:NO_EFFECTS}).matrix;
  const actual=row.h*SIZE+row.a;
  for(const setting of grid){
   const normal=assumed.matrix.reduce((sum,p,i)=>sum+p*setting.weights[i],0);
   setting.pending-=Math.log(Math.max(1e-15,(assumed.matrix[actual]??0)*(setting.weights[actual]??1)/normal));
   if(setting===selected)matrices.corrected=assumed.matrix.map((p,i)=>p*setting.weights[i]/normal);
  }
  for(const model of [stats.corrected.all,stats.corrected[period]]){
   const k=selected.draw+':'+selected.tail;
   model.params[k]=(model.params[k]??0)+1;
  }
 }
 training++;
 const metrics={};
 for(const name of variants){
  const matrix=matrices[name],prediction=summarize(matrix);
  metrics[name]=observe(stats[name].all,row,matrix,prediction,week);
  observe(stats[name][period],row,matrix,prediction,week);
  if(name!=='assumed')observeDelta(name,period,week,metrics.assumed,metrics[name]);
 }
 if(training%1000===0)console.log('Scored',training,', coefficients available',fittedCases);
}
const results={...reuse?.study.results,...Object.fromEntries(variants.map(name=>[name,Object.fromEntries(periods.map(period=>[period,measure(stats[name][period])]))]))};
const comparisons={...reuse?.study.comparisons,...Object.fromEntries(variants.slice(1).map(name=>[name,Object.fromEntries(periods.map(period=>{
 const [logLossCI95,top3CI95]=bootstrap(weeks[name].get(period));
 const baseline=results.assumed[period],candidate=results[name][period];
 return [period,{n:candidate.n,logLossDelta:candidate.logLoss-baseline.logLoss,logLossCI95,
  top3Delta:candidate.top3.rate-baseline.top3.rate,top3CI95}];
}))]))};
const baseline=results.assumed.all;
const eligibleCandidates=Object.keys(comparisons).filter(name=>comparisons[name].all.logLossCI95[1]<0&&comparisons[name].all.top3CI95[0]>=0);
assert.equal(baseline.winner.hits,5285);
assert.equal(baseline.top3.hits,3230);
const accuracy=Object.fromEntries(['winner','score','globalScore','top3'].map(k=>[k,baseline[k]]));
const report={version:VERSION,sourceArchiveSha:ARCHIVE_SOURCE.sha,inputSha,marketBacktest:'notRun',full100mAllFixtures:'notRun',
 analytic:{archive:rows.length,eligible:cases.length,unavailable:rows.length-cases.length,from:rows[0].date,through:rows.at(-1).date,
  ...accuracy,largestTail},
 study:{events:{sha:sample.sha,sourceMatches:sample.sourceMatches,completeMatches:sample.matches.length,joined:source.length,
  fittedCases,trainingMatches:fitter.count(),lastParameters:fitter.at(rows.at(-1).date)},
  results,comparisons,eligibleCandidates,seconds:(performance.now()-started)/1000},
 full100mSample:[]};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({accuracy,events:report.study.events,eligibleCandidates,
 comparisons:Object.fromEntries(Object.entries(comparisons).map(([k,v])=>[k,v.all])),seconds:report.study.seconds}));
