import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {createRequire} from 'node:module';
import {ARCHIVE_SOURCE,TRIALS,VERSION,archiveCsv,historyRows,sha256,trainChronologically} from '../sim/super-lig-model.mjs';
import {analyticMatrix,summarize} from '../sim/event-engine.mjs';
import {runWorkers} from '../sim/event-parallel.mjs';

const require=createRequire(import.meta.url);
const {binomial,loadInputs,auditTurkey}=require('./phase1-backtest.cjs');
const [historyFile,inputDir,tffFile,outputFile]=process.argv.slice(2);
assert.ok(outputFile,'Usage: node tests/event-backtest.mjs TURKEY_CSV INPUT_DIR TFF_JSON OUTPUT_JSON');
const read=file=>fs.readFileSync(file,'utf8');
const history=read(historyFile);
assert.equal(await sha256(history),ARCHIVE_SOURCE.sha);
const tff=(await loadInputs(inputDir,false)).filter(row=>row.league==='tr.1'&&row.season>='2025-26')
 .flatMap(row=>row.season==='2025-26'?auditTurkey(row,tffFile).rows:row.rows);
const page=read(new URL('../index.html',import.meta.url));
const script=page.match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
const {csv,clubModelKey}=new Function(script+';return {csv,clubModelKey};')();
const rows=historyRows(archiveCsv(csv,history).concat(tff),clubModelKey);
const hits={n:0,winner:0,score:0,top3:0,modalWinner:0};
const groups={};
const sampleTargets=['1995-03','2005-03','2015-03','2024-04','2025-10','2026-10'];
const sample=[];
const allTrials=process.argv.includes('--all-100m');
const backlog=[];
const cutoff='2026-07-01';
const archiveRows=rows.filter(row=>row.date<cutoff);
if(process.env.EVENT_MODEL_STATE){
 const snapshot=trainChronologically(archiveRows).snapshot();
 const archiveSha=await sha256(JSON.stringify(archiveRows.map(({day,home,away,h,a})=>[day,home,away,h,a])));
 fs.writeFileSync(process.env.EVENT_MODEL_STATE,JSON.stringify({version:VERSION,cutoff,archiveSha,state:snapshot})+'\n');
}
if(process.argv.includes('--state-only'))process.exit(0);
let largestTail=0;
const start=performance.now();
function add(totals,row,prediction){
 const [top]=prediction.top;
 const side=Math.sign(row.h-row.a);
 totals.n++;
 totals.winner+=Number(Math.sign(top.home-top.away)===side);
 totals.modalWinner+=Number([1,0,-1][prediction.outcomes.indexOf(Math.max(...prediction.outcomes))]===side);
 totals.score+=Number(top.home===row.h&&top.away===row.a);
 totals.top3+=Number(prediction.top.some(score=>score.home===row.h&&score.away===row.a));
}
trainChronologically(rows,(row,input)=>{
 const exact=analyticMatrix(input);
 largestTail=Math.max(largestTail,exact.tail);
 const prediction=summarize(exact.matrix);
 add(hits,row,prediction);
 if(allTrials)backlog.push({row,input});
 const group=groups[row.date.slice(0,4)]??={n:0,winner:0,score:0,top3:0,modalWinner:0};
 add(group,row,prediction);
 if(sampleTargets.some(date=>row.date.startsWith(date))&&!sample.some(entry=>entry.row.date.slice(0,7)===row.date.slice(0,7))){
  sample.push({row,input,prediction});
 }
 if(hits.n%2000===0)console.error('Scored',hits.n);
});
const archiveDigest=await sha256(JSON.stringify(rows));
const measured={
 archive:rows.length,eligible:hits.n,unavailable:rows.length-hits.n,from:rows[0].date,through:rows.at(-1).date,
 winner:binomial(hits.winner,hits.n),score:binomial(hits.score,hits.n),top3:binomial(hits.top3,hits.n),
 modalWinner:binomial(hits.modalWinner,hits.n),largestTail,byYear:groups,
 seconds:(performance.now()-start)/1000
};
const report={version:VERSION,sourceArchiveSha:ARCHIVE_SOURCE.sha,inputSha:archiveDigest,marketBacktest:'notRun',
 full100mAllFixtures:'notRun',analytic:measured,full100mSample:[]};
const save=()=>fs.writeFileSync(outputFile,JSON.stringify(report,null,2)+'\n');
save();
console.log(JSON.stringify({analytic: {archive:measured.archive,eligible:measured.eligible,notEnough:measured.unavailable,
 winner:measured.winner,score:measured.score,top3:measured.top3,modalWinner:measured.modalWinner,seconds:measured.seconds}}));
if(process.env.EVENT_BACKTEST_SAMPLE_FILE){
 fs.writeFileSync(process.env.EVENT_BACKTEST_SAMPLE_FILE,JSON.stringify(sample));
}
if(process.argv.includes('--samples')){
 for(const {row,input,prediction} of sample){
  const seed=((row.day*2654435761)>>>0);
  const started=performance.now();
  const sim=await runWorkers({input,seed,WorkerClass:Worker,workerCount:8});
  assert.equal(sim.n,TRIALS);
  report.full100mSample.push({period:row.date.slice(0,7),n:sim.n,overflow:sim.overflow,
   topThreeMatchesAnalytic:sim.top.every((pick,i)=>pick.home===prediction.top[i].home&&pick.away===prediction.top[i].away),
   maxScore:sim.maxScore,maxOutcome:sim.maxOutcome,tail:sim.tail,proposals:sim.proposals,
   seconds:(performance.now()-started)/1000});
  save();
  console.log(JSON.stringify(report.full100mSample.at(-1)));
 }
}

if(allTrials){
 const checkpoint=outputFile+'.checkpoint';
 const preserved=fs.existsSync(checkpoint)?JSON.parse(read(checkpoint)):null;
 if(preserved){assert.equal(preserved.inputSha,report.inputSha);assert.equal(preserved.version,VERSION);}
 const counts=preserved?.counts??{n:0,winner:0,score:0,top3:0,modalWinner:0};
 assert.ok(Number.isSafeInteger(counts.n)&&counts.n>=0&&counts.n<=backlog.length);
 const start=performance.now();
 for(const {row,input} of backlog.slice(counts.n)){
  const sim=await runWorkers({input,seed:(row.day*2654435761)>>>0,WorkerClass:Worker,workerCount:8});
  add(counts,row,sim);
  if(counts.n%10===0){
   fs.writeFileSync(checkpoint+'.tmp',JSON.stringify({inputSha:report.inputSha,version:VERSION,counts}));
   fs.renameSync(checkpoint+'.tmp',checkpoint);
   report.full100mCompleted=counts.n;
   save();
  }
 }
 report.full100mAllFixtures='passed';
 report.full100mCompleted=counts.n;
 report.full100m={n:counts.n,winner:binomial(counts.winner,counts.n),
  score:binomial(counts.score,counts.n),top3:binomial(counts.top3,counts.n),
  secondsThisRun:(performance.now()-start)/1000};
 save();
 if(fs.existsSync(checkpoint))fs.unlinkSync(checkpoint);
}
