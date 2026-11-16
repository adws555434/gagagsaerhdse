import {BLOCK,TRIALS} from './super-lig-model.mjs';
import {addCounts,emptyCounts} from './event-engine.mjs';

export function runWorkers({input,seed,WorkerClass,workerCount,signal,onProgress=()=>{},count=TRIALS,check=true}){
 const workers=[],counts=emptyCounts();
 const blocks=Math.ceil(count/BLOCK);
 let next=0,finished=0,proposals=0,closed=false;
 return new Promise((resolve,reject)=>{
  const stop=()=>{
   closed=true;
   signal?.removeEventListener('abort',cancel);
   for(const worker of workers)worker.terminate();
  };
  const fail=error=>{stop();reject(error);};
  const cancel=()=>fail(new DOMException('Simülasyon iptal edildi.','AbortError'));
  if(signal?.aborted){cancel();return;}
  signal?.addEventListener('abort',cancel,{once:true});
  const assign=worker=>{
   if(next>=blocks)return;
   const block=next++;
   worker.postMessage({input,seed,block,count:Math.min(BLOCK,count-block*BLOCK)});
  };
  try{
   for(let i=0;i<Math.min(workerCount,blocks);i++){
    const worker=new WorkerClass(new URL('./event-worker.mjs',import.meta.url),{type:'module'});
    workers.push(worker);
    const message=({out,error,block})=>{
     if(closed)return;
     if(error){fail(Error(error));return;}
     if(block===undefined){stop();resolve({...out,proposals});return;}
     addCounts(counts,out.counts);proposals+=out.proposals;
     finished++;
     onProgress(Math.min(count,finished*BLOCK),count);
     if(closed)return;
     if(finished===blocks){
      if(check)worker.postMessage({verify:true,counts,input,expected:count});
      else{stop();resolve({counts,proposals});}
     }else assign(worker);
    };
    if(typeof worker.on==='function'){
     worker.on('message',message);
     worker.on('error',fail);
    }else{
     worker.onmessage=event=>message(event.data);
     worker.onerror=()=>fail(Error('Simülasyon iş parçacığı çalışamadı.'));
    }
    assign(worker);
   }
  }catch(error){fail(error);}
 });
}
