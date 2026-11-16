import fs from 'node:fs';
import {Worker} from 'node:worker_threads';
import {availableParallelism} from 'node:os';
import {parseArchive,buildInputs} from '../sim/forecast-input.mjs';
import {runWorkers} from '../sim/event-parallel.mjs';
import {collectEventLedger,scoreLedger} from '../sim/event-ledger.mjs';
import {SCOPE,VERSION} from '../sim/super-lig-model.mjs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const core=html.match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
const app=new Function(core+';return {BASES,MARKET_VERSION,clubModelKey,knownKickoff,findMarketQuote,marketTotalsDistribution,parseClubFeed,validScore,cleanRows};')();
async function text(url){
 const remote=await fetch(url,{signal:AbortSignal.timeout(15000)});
 if(!remote.ok)throw Error('HTTP '+remote.status);
 return remote.text();
}
async function getFeed(name,today){
 const file=name+'_2627.csv';
 for(const base of app.BASES.slice().reverse()){
  try{
   const raw=await text(base+SCOPE+'/'+file);
   return app.cleanRows(app.parseClubFeed(raw,file,['date','home','away',...(name==='results'?['ft_home','ft_away']:[])]),today,name==='results');
  }catch{}
 }
 throw Error('Süper Lig '+name+' kaynağına ulaşılamadı.');
}
const ledger=new URL('../event-forecast-ledger.json',import.meta.url);
const market=new URL('../market-snapshot.json',import.meta.url);
function write(rows){
 if(process.argv.includes('--dry-run'))return;
 const temporary=new URL('../event-forecast-ledger.json.tmp',import.meta.url);
 fs.writeFileSync(temporary,JSON.stringify({version:VERSION,records:rows,score:scoreLedger(rows)},null,2)+'\n');
 fs.renameSync(temporary,ledger);
}
async function main(){
 const today=new Date().toISOString().slice(0,10);
 const [results,fixtures]=await Promise.allSettled([getFeed('results',today),getFeed('fixtures',today)]);
 if(results.status==='rejected')throw results.reason;
 if(fixtures.status==='rejected')console.warn(fixtures.reason.message);
 const archive=parseArchive(fs.readFileSync(new URL('../event-model-state.json',import.meta.url),'utf8'));
 const prior=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')).records:[];
 const snapshot=fs.existsSync(market)?JSON.parse(fs.readFileSync(market,'utf8')):null;
 const records=await collectEventLedger({prior,results:results.value,fixtures:fixtures.value??[],market:snapshot,app,
  prepare:buildInputs(results.value,today,app,archive),
  simulate:({input,seed})=>runWorkers({input,seed,WorkerClass:Worker,workerCount:Math.min(availableParallelism(),8)}),onRecord:write});
 write(records);
 console.log(JSON.stringify({records:records.length,score:scoreLedger(records)}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
