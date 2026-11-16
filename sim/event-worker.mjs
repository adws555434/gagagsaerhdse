import {simulateBlock,verify} from './event-engine.mjs';

async function work(message,reply){
 try{
  const out=message.verify
   ?verify(message.counts,message.input,message.expected)
   :simulateBlock(message.input,message.seed,message.block,message.count);
  reply({id:message.id,block:message.block,out},out.counts?[out.counts.buffer]:[]);
 }catch(error){reply({id:message.id,error:error.message});}
}
if(typeof self!=='undefined')self.onmessage=({data})=>work(data,(result,transfer)=>self.postMessage(result,transfer));
else {
 const {parentPort}=await import('node:worker_threads');
 parentPort.on('message',data=>work(data,(result,transfer)=>parentPort.postMessage(result,transfer)));
}
