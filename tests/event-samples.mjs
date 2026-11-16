import fs from 'node:fs';
import {Worker} from 'node:worker_threads';
import {runWorkers} from '../sim/event-parallel.mjs';
import {analyticMatrix,summarize} from '../sim/event-engine.mjs';
import {sha256,VERSION,TRIALS} from '../sim/super-lig-model.mjs';
import {loadCases} from './event-cases.mjs';

const [archive,inputs,tff,output,amount='200',effectsPath]=process.argv.slice(2);
const {cases,inputSha}=await loadCases(archive,inputs,tff);
const effects=effectsPath?JSON.parse(fs.readFileSync(effectsPath,'utf8')):null;
const count=Number(amount);
if(!Number.isSafeInteger(count)||count<2||count>cases.length)throw Error('Invalid historical sample count');
const signature=await sha256(JSON.stringify({inputSha,VERSION,count,effects}));
const report=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')):{signature,inputSha,trials:TRIALS,planned:count,samples:[]};
if(report.signature!==signature)throw Error('Sample checkpoint mismatch');
for(let i=report.samples.length;i<count;i++){
 const {row,input}=cases[Math.round(i*(cases.length-1)/(count-1))];
 const chosen={...input,...(effects?{effects}:null)};
 const seed=parseInt((await sha256(JSON.stringify([VERSION,row.date,row.home,row.away,chosen]))).slice(0,8),16);
 const matrix=summarize(analyticMatrix(chosen).matrix);
 const start=performance.now();
 const record={period:row.date.slice(0,7),verified:false};
 try{
  const result=await runWorkers({input:chosen,seed,WorkerClass:Worker,workerCount:8});
  Object.assign(record,{verified:true,maxScore:result.maxScore,maxOutcome:result.maxOutcome,
   winner:matrix.winner===result.winner,
   top3:matrix.top.every((score,j)=>score.home===result.top[j]?.home&&score.away===result.top[j]?.away)});
 }catch(error){record.error=error.message;}
 record.seconds=(performance.now()-start)/1000;
 report.samples.push(record);
 fs.writeFileSync(output+'.tmp',JSON.stringify(report));
 fs.renameSync(output+'.tmp',output);
 if((i+1)%10===0||i+1===count)console.log(i+1,JSON.stringify(record));
}
