import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {analyticMatrix,runSerial,verify,SIZE,emptyCounts,summarize,NO_EFFECTS} from '../sim/event-engine.mjs';
import {runWorkers} from '../sim/event-parallel.mjs';
import {historyRows,trainChronologically,TRIALS,VERSION,withMarket} from '../sim/super-lig-model.mjs';
import {collectEventLedger,scoreLedger} from '../sim/event-ledger.mjs';

const input={rates:[1.6,1.15],rho:-.12,uncertainty:[.16,.13]};
test('winner uses outcome totals; the headline score stays in that outcome',()=>{
 const buckets=emptyCounts();
 buckets[SIZE+1]=32;
 buckets[2*SIZE+1]=25;
 buckets[SIZE]=24;
 buckets[1]=19;
 const result=summarize(buckets);
 assert.deepEqual(result.outcomes,[49,32,19]);
 assert.equal(result.winner,0);
 assert.deepEqual(result.pick,{home:2,away:1,count:25});
 assert.deepEqual(result.top[0],{home:1,away:1,count:32});
});
test('no-event closed form agrees with generic transition matrix',()=>{
 const matrix=analyticMatrix({...input,effects:NO_EFFECTS}).matrix;
 const generic=analyticMatrix({...input,effects:{...NO_EFFECTS}}).matrix;
 assert.ok(matrix.every((p,i)=>Math.abs(p-generic[i])<1e-12));
});
test('analytic score mass is normalized and agrees with event paths',()=>{
 const {matrix,tail}=analyticMatrix(input);
 assert.ok(Math.abs(matrix.reduce((a,b)=>a+b,0)-1)<1e-12);
 assert.ok(matrix.every(x=>x>=0)&&tail<1e-8);
 const swapped=analyticMatrix({...input,rates:input.rates.slice().reverse(),uncertainty:input.uncertainty.slice().reverse()});
 for(let h=0;h<SIZE;h++)for(let a=0;a<SIZE;a++)assert.ok(Math.abs(matrix[h*SIZE+a]-swapped.matrix[a*SIZE+h])<1e-12);
 const result=runSerial(input,1234,1_000_000);
 assert.ok(verify(result.counts,input,1_000_000,.005).n===1_000_000);
 const broken=emptyCounts();
 broken[0]=1_000_000;
 assert.throws(()=>verify(broken,input,1_000_000),/denetiminden geçmedi/);
});
test('parallel scheduling gives the exact same draws and supports cancellation',async()=>{
 const count=2_100_000,seed=567;
 const reference=runSerial(input,seed,count);
 const parallel=await runWorkers({WorkerClass:Worker,workerCount:3,input,seed,count,check:false});
 assert.deepEqual(parallel,reference);
 const cancel=new AbortController();
 await assert.rejects(runWorkers({WorkerClass:Worker,workerCount:2,input,seed,signal:cancel.signal,
  onProgress:()=>cancel.abort()}),{name:'AbortError'});
});
test('chronological age weighting, five match gate, saved model state and market pooling',()=>{
 const rows=historyRows(Array.from({length:8},(_,i)=>({
  home:'H',away:'A',date:'2026-01-0'+(i+1),ft_home:i%3,ft_away:i%2
 })),s=>s);
 const observed=[];
 const full=trainChronologically(rows,(row,prediction)=>observed.push([row.date,prediction]));
 assert.equal(observed.length,3);
 assert.equal(observed[0][0],'2026-01-06');
 const state=trainChronologically(rows.slice(0,5)).snapshot();
 const restored=trainChronologically(rows.slice(5),undefined,JSON.parse(JSON.stringify(state)));
 const d=rows.at(-1).day+1;
 assert.deepEqual(full.current('H','A',d),restored.current('H','A',d));
 assert.equal(full.current('H','X',d),null);
 const modified=rows.map((r,i)=>i===7?{...r,h:9}:r),predictions=[];
 trainChronologically(modified,(_,forecast)=>predictions.push(forecast));
 assert.deepEqual(predictions,observed.map(x=>x[1]));
 const original=full.current('H','A',d);
 assert.deepEqual(withMarket(original,{rates:[1,1]}).rates,original.rates.map(Math.sqrt));
});
test('pre-match event records freeze once, settle automatically and reject unfinished or late runs',async()=>{
 const fixture={home:'H',away:'A',date:'2026-11-16',kickoff:2000};
 const app={clubModelKey:s=>s,knownKickoff:r=>r.kickoff,validScore:r=>Number.isInteger(r.ft_home),findMarketQuote:()=>null};
 let now=1000,simulations=0;
 const simulate=async()=>{simulations++;return {n:TRIALS,winner:0,pick:{home:2,away:1},
  top:[{home:1,away:1},{home:2,away:1},{home:1,away:0}]};};
 const common={fixtures:[fixture],app,clock:()=>now,prepare:async()=>({digest:'test',input:{}}),simulate};
 const first=await collectEventLedger({...common,prior:[],results:[]});
 assert.equal(first.length,1);assert.equal(first[0].version,VERSION);
 assert.deepEqual(await collectEventLedger({...common,prior:first,results:[]}),first);
 assert.equal(simulations,1);
 now=4000;
 const scored=await collectEventLedger({...common,prior:first,results:[{...fixture,ft_home:2,ft_away:1}]});
 assert.deepEqual(scoreLedger(scored),{n:1,winner:1,score:1,globalScore:0,top3:1});
 now=1000;
 assert.deepEqual(await collectEventLedger({...common,prior:[],results:[],simulate:async()=>{
  now=2000;return simulate();
 }}),[]);
});
