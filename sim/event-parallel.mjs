import {BLOCK,TRIALS} from './super-lig-model.mjs';
import {addCounts,emptyCounts} from './event-engine.mjs';

export function runWorkers({input,seed,WorkerClass,workerCount,signal,onProgress=()=>{},count=TRIALS,check=true,
 workerUrl=new URL('./event-worker.mjs',import.meta.url),idleTimeout=90_000}){
 if(!Number.isSafeInteger(count)||count<1||count>TRIALS||!Number.isSafeInteger(workerCount)||workerCount<1||
  !Number.isSafeInteger(idleTimeout)||idleTimeout<1)return Promise.reject(Error('Geçersiz simülasyon ayarı.'));
 const workers=[],counts=emptyCounts();
 const blocks=Math.ceil(count/BLOCK);
 let next=0,finished=0,drawn=0,proposals=0,closed=false,watchdog;
 return new Promise((resolve,reject)=>{
  const stop=()=>{
   closed=true;
   clearTimeout(watchdog);
   signal?.removeEventListener('abort',cancel);
   for(const worker of workers)worker.terminate();
  };
  const fail=error=>{if(!closed){stop();reject(error);}};
  const watch=()=>{
   clearTimeout(watchdog);
   watchdog=setTimeout(()=>fail(Error('Simülasyon yanıt vermedi. Tekrar dene.')),idleTimeout);
  };
  const cancel=()=>fail(new DOMException('Simülasyon iptal edildi.','AbortError'));
  if(signal?.aborted){cancel();return;}
  signal?.addEventListener('abort',cancel,{once:true});
  const assign=worker=>{
   if(next>=blocks)return;
   const block=next++;
   worker.postMessage({input,seed,block,count:Math.min(BLOCK,count-block*BLOCK)});
  };
  try{
   watch();
   for(let i=0;i<Math.min(workerCount,blocks);i++){
    const worker=new WorkerClass(workerUrl,{type:'module'});
    workers.push(worker);
    const message=({out,error,block})=>{
     if(closed)return;
     if(error){fail(Error(error));return;}
     if(block===undefined){stop();resolve({...out,proposals});return;}
     watch();
     addCounts(counts,out.counts);proposals+=out.proposals;
     finished++;
     drawn+=Math.min(BLOCK,count-block*BLOCK);
     onProgress(drawn,count);
     if(closed)return;
     if(finished===blocks){
      if(check)worker.postMessage({verify:true,counts,input,expected:count});
      else{stop();resolve({counts,proposals});}
     }else assign(worker);
    };
    if(typeof worker.on==='function'){
     worker.on('message',message);
     worker.on('error',fail);
     worker.on('exit',()=>fail(Error('Simülasyon iş parçacığı sonuç vermeden kapandı.')));
    }else{
     worker.onmessage=event=>message(event.data);
     worker.onerror=()=>fail(Error('Simülasyon iş parçacığı çalışamadı.'));
     worker.onmessageerror=()=>fail(Error('Simülasyon iş parçacığının yanıtı okunamadı.'));
    }
    assign(worker);
   }
  }catch(error){fail(error);}
 });
}
