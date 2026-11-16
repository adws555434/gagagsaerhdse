import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {ARCHIVE_SOURCE,archiveCsv,historyKey,historyRows,sha256,trainChronologically} from '../sim/super-lig-model.mjs';

const {loadInputs,auditTurkey}=createRequire(import.meta.url)('./phase1-backtest.cjs');
export async function loadCases(historyFile,inputDir,tffFile){
 const read=file=>fs.readFileSync(file,'utf8');
 const history=read(historyFile);
 assert.equal(await sha256(history),ARCHIVE_SOURCE.sha);
 const recent=(await loadInputs(inputDir,false)).filter(row=>row.league==='tr.1'&&row.season>='2025-26')
  .flatMap(row=>row.season==='2025-26'?auditTurkey(row,tffFile).rows:row.rows);
 const page=read(new URL('../index.html',import.meta.url));
 const script=page.match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
 const {csv,clubModelKey}=new Function(script+';return {csv,clubModelKey};')();
 const rows=historyRows(archiveCsv(csv,history).concat(recent),clubModelKey),cases=[];
 trainChronologically(rows,(row,input)=>cases.push({row,input}));
 return {rows,cases,key:name=>historyKey(name,clubModelKey),inputSha:await sha256(JSON.stringify(rows))};
}
