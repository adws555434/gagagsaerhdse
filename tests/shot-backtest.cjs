'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const root=fs.existsSync(path.join(__dirname,'index.html'))?__dirname:path.resolve(__dirname,'..');
const dataDir=process.argv[2];
if(!dataDir)throw Error('Pass the folder containing the six pinned current-season CSV files');
const source=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
const model=new Function(source+';return {LEARNING_WEIGHTS,cleanRows,csv,estimateGoals,forecastModel,shotEstimate,shotCandidates,candidateMetrics};')();
const manifest=JSON.parse(fs.readFileSync(path.join(root,root===__dirname?'balanced-model-data.json':'tests/balanced-model-data.json'),'utf8'));
const leagues={'tr.1':'TUR_1_super-lig','en.1':'ENG_1_premier-league','es.1':'ESP_1_la-liga','de.1':'GER_1_bundesliga','it.1':'ITA_1_serie-a','fr.1':'FRA_1_ligue-1'};
const groups={};
for(const [code,folder] of Object.entries(leagues)){
 const filename=code+'.csv';
 const bytes=fs.readFileSync(path.join(dataDir,filename));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.find(row=>row.file===filename).sha256);
 const rows=model.cleanRows(model.csv(bytes.toString('utf8')),'2026-11-15',true);
 const tests=[];
 for(const row of rows){
  const prior=rows.filter(item=>item.date<row.date);
  const base=model.estimateGoals(row.home,row.away,prior,false);
  if(!base)continue;
  const adjusted=model.forecastModel(row.home,row.away,base,prior,{folder},{date:row.date});
  const shots=model.shotEstimate(row.home,row.away,prior,false,row.date);
  if(!shots)continue;
  const {homeGoals,awayGoals}=adjusted.rates;
  const candidates=model.shotCandidates([homeGoals,awayGoals],shots);
  assert.equal(candidates.length,model.LEARNING_WEIGHTS.length);
  tests.push({actual:[Number(row.ft_home),Number(row.ft_away)],candidates,date:row.date});
 }
 groups[code]=tests;
}
const overall=Object.values(groups).flat();
function score(rows){return model.LEARNING_WEIGHTS.map((_,i)=>model.candidateMetrics(rows,i));}
console.log(JSON.stringify({weights:model.LEARNING_WEIGHTS,overall:score(overall),league:Object.fromEntries(Object.entries(groups).map(([code,rows])=>[code,score(rows)]))},null,2));
