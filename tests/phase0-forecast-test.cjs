'use strict';

const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {performance}=require('node:perf_hooks');

const root=fs.existsSync(path.join(__dirname,'index.html'))?__dirname:path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const code=html.match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
const model=new Function(code+';return {MODEL_VERSION,ENGINE_VERSION,SIMULATIONS,SIMULATION_SEED,prepareForecastDistribution,poissonScoreGrid,simulateDistribution,simulationAgreement,forecastDecision,estimateGoals,runSimulation,forecastInputPayload,forecastDataVersion,confidenceTier};')();

const validationTrials=1_000_000;
const tolerance=.0025;
const cases=[
 ['Poisson',[1.55,1.08],{}],
 ['Dixon–Coles',[1.7,1.15],{rho:-.13}],
 ['Belirsizlikli Dixon–Coles',[2.15,.87],{rho:-.09,matches:[8,14]}],
 ['Nötr ve eşit güç',[1.24,1.24],{matches:[5,5]}],
 ['Sıfır gol beklentisi',[0,0],{rho:-.1,matches:[10,10]}],
 ['Çok düşük gol beklentisi',[.00001,.00002],{matches:[5,7]}],
 ['Çok yüksek gol beklentisi',[100,85],{rho:-.12,matches:[5,5]}],
 ['Kalan süre ve mevcut skor',[.55,.67],{initialHome:1,initialAway:2,matches:[8,13]}],
];

function normalized(distribution){
 assert.ok(distribution.grid.every(p=>Number.isFinite(p)&&p>=0));
 assert.ok(Math.abs(distribution.grid.reduce((sum,p)=>sum+p,0)-1)<1e-12);
 assert.ok(Math.abs(distribution.outcomes.reduce((sum,p)=>sum+p,0)-1)<1e-12);
 assert.ok(distribution.tail>=0&&distribution.tail<1);
 assert.ok(distribution.size>=11);
}

async function main(){
 assert.doesNotMatch(code,/\bMath\.random\b/);
 assert.ok(model.SIMULATIONS>=100000&&model.SIMULATIONS<=1000000);
 assert.equal(model.estimateGoals('A','B',[]),null);
 assert.throws(()=>model.prepareForecastDistribution(-1,1),/Geçersiz/);
 assert.throws(()=>model.prepareForecastDistribution(1,1,{matches:[4,10]}),/yetersiz/);
 for(const p of [.45,.55,.65])assert.notEqual(model.confidenceTier([p,.2,1-p-.2]),'%45 altı');
 const regular=model.poissonScoreGrid(2.2,1.7,-.2);
 assert.ok(Math.abs(regular.reduce((sum,p)=>sum+p,0)-1)<1e-12);
 const a=model.prepareForecastDistribution(2.25,1.2,{rho:-.08,matches:[12,9]});
 const b=model.prepareForecastDistribution(1.2,2.25,{rho:-.08,matches:[9,12]});
 for(const [i,j] of [[0,2],[1,1],[2,0]])assert.ok(Math.abs(a.outcomes[i]-b.outcomes[j])<1e-12);
 for(let i=0;i<a.size;i++)for(let j=0;j<a.size;j++){
  assert.ok(Math.abs(a.grid[i*a.size+j]-b.grid[j*b.size+i])<1e-12);
 }
 const neutralRows=Array.from({length:7},(_,i)=>({date:'2026-03-0'+(i+1),home:'A',away:'B',ft_home:2,ft_away:1,neutral:true}));
 const n1=model.estimateGoals('A','B',neutralRows,true),n2=model.estimateGoals('B','A',neutralRows,true);
 assert.equal(n1.homeGoals,n2.awayGoals);
 assert.equal(n1.awayGoals,n2.homeGoals);
 const first=model.simulateDistribution(a,10000,42);
 assert.deepEqual(first,model.simulateDistribution(a,10000,42));
 assert.notDeepEqual(first,model.simulateDistribution(a,10000,43));
 assert.notDeepEqual(a.outcomes,model.prepareForecastDistribution(2.25,1.2,{rho:-.08}).outcomes);
 const cancel=new AbortController();
 const pending=model.runSimulation(a,{signal:cancel.signal});
 cancel.abort();
 assert.equal(await pending,null);
 const payload=model.forecastInputPayload(neutralRows,'A','B',null,'national','2026-04-01');
 assert.equal(await model.forecastDataVersion(payload),createHash('sha256').update(payload).digest('hex'));
 assert.notEqual(await model.forecastDataVersion(payload),await model.forecastDataVersion(payload+' '));

 const started=performance.now(),runs=[];
 for(const [name,rates,options] of cases){
  const distribution=model.prepareForecastDistribution(...rates,options);
  normalized(distribution);
  const sample=model.simulateDistribution(distribution,validationTrials);
  const difference=model.simulationAgreement(distribution,sample);
  const expected=model.forecastDecision(distribution),actual=model.forecastDecision(sample);
  assert.equal(expected.outcome,distribution.outcomes.indexOf(Math.max(...distribution.outcomes)));
  const selected=expected.score[0].split('–').map(Number);
  assert.equal(selected[0]>selected[1]?0:selected[0]===selected[1]?1:2,expected.outcome);
  assert.ok(difference.outcomeDelta<tolerance,name+' 1X2 exceeds numerical threshold');
  assert.ok(difference.scoreDelta<tolerance,name+' top five exceeds numerical threshold');
  runs.push({name,tail:distribution.tail,...difference,analyticScore:expected.score[0],simulatedScore:actual.score[0]});
 }
 const ledger=JSON.parse(fs.readFileSync(path.join(root,'forecast-ledger.json'),'utf8'));
 const distinct=new Map(ledger.records.filter(row=>row.actual&&row.savedAt<row.kickoff).map(row=>[row.id,row]));
 const audit={engineVersion:model.ENGINE_VERSION,modelVersion:model.MODEL_VERSION,seed:model.SIMULATION_SEED,
  browserTrials:model.SIMULATIONS,validationTrials,tolerance,validationInputSha256:createHash('sha256').update(JSON.stringify(cases)).digest('hex'),
  cases:runs,elapsedMs:Math.round(performance.now()-started),independentSettled:distinct.size};
 console.log(JSON.stringify(audit,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});
