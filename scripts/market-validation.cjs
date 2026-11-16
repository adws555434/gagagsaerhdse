'use strict';

const {createHash}=require('node:crypto');
const methods=['release','market','marketScore'];
const tiers=['%45 altı','%45–55','%55–65','%65+'];
const sha=value=>/^[a-f0-9]{64}$/.test(value??'');
const stamp=value=>typeof value==='string'?Date.parse(value):NaN;
const average=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const negativeLog=probability=>-Math.log(Math.max(1e-15,probability));

function validPrediction(prediction){
 const probabilities=prediction?.probabilities;
 return probabilities?.length===3&&probabilities.every(p=>Number.isFinite(p)&&p>=0&&p<=1)&&
  Math.abs(probabilities.reduce((sum,p)=>sum+p,0)-1)<1e-8&&/^\d+–\d+$/.test(prediction.consistentScore??'')&&
  prediction.scores?.length===3&&new Set(prediction.scores).size===3&&prediction.scores.every(score=>/^\d+–\d+$/.test(score));
}

function liveForecast(source,row,version,withTotals=false){
 return validPrediction(source)&&source.modelVersion===version&&source.simulationCount===0&&sha(source.dataSha256)&&
  stamp(source.quotedAt)<=stamp(source.capturedAt)&&stamp(source.capturedAt)<=source.savedAt&&
  row.savedAt<=source.savedAt&&source.savedAt<row.kickoff&&
  (!withTotals||(stamp(source.totalQuotedAt)<=stamp(source.capturedAt)&&source.over25>0&&source.over25<1))?source:null;
}

function scoreResult(probabilities,outcome){
 const left=probabilities[0]-Number(outcome===0);
 const right=probabilities[0]+probabilities[1]-Number(outcome!==2);
 return {logLoss:negativeLog(probabilities[outcome]),rps:(left*left+right*right)/2};
}

function binomial(hits,n){
 if(!n)return {hits,n,rate:null,interval95:null};
 const rate=hits/n;
 const z=1.959963984540054;
 const center=(rate+z*z/(2*n))/(1+z*z/n);
 const radius=z*Math.sqrt(rate*(1-rate)/n+z*z/(4*n*n))/(1+z*z/n);
 return {hits,n,rate,interval95:[Math.max(0,center-radius),Math.min(1,center+radius)]};
}

function summarize(rows,method,model){
 const measured=rows.filter(row=>row[method]);
 const items=measured.map(row=>{
  const prediction=row[method];
  const outcome=model.matchOutcome(...row.actual);
  const score=row.actual.join('–');
  return {...scoreResult(prediction.probabilities,outcome),result:model.strongestOutcome(prediction.probabilities)===outcome,
   score:prediction.consistentScore===score,top3:prediction.scores.includes(score),tier:model.confidenceTier(prediction.probabilities)};
 });
 const n=items.length;
 const hits=(data,key)=>data.filter(row=>row[key]).length;
 return {n,logLoss:average(items.map(row=>row.logLoss)),rps:average(items.map(row=>row.rps)),
  result:binomial(hits(items,'result'),n),score:binomial(hits(items,'score'),n),top3:binomial(hits(items,'top3'),n),
  tiers:tiers.map(label=>{
   const group=items.filter(row=>row.tier===label);
   return {label,coverage:binomial(group.length,n),accuracy:binomial(hits(group,'result'),group.length)};
  })};
}

function summaries(rows,model){
 return Object.fromEntries(methods.map(method=>[method,summarize(rows,method,model)]));
}

function weightFor(training,model){
 let best=null;
 for(let i=0;i<=20;i++){
  const weight=i/20;
  const losses=training.map(row=>scoreResult(model.marketBlend(row.release.probabilities,row.market.probabilities,weight),
   model.matchOutcome(...row.actual)));
  const objective=average(losses.map(row=>row.logLoss+row.rps));
  if(!best||objective<best.objective)best={weight,objective};
 }
 return best;
}

function exactProbability(distribution,[home,away]){
 return home<distribution.size&&away<distribution.size?distribution.grid[home*distribution.size+away]:0;
}

function scoreComparison(rows,model){
 const blocks=new Map();
 const deltas=rows.map(row=>{
  const release=model.prepareForecastDistribution(...row.rates);
  const market=model.marketTotalsDistribution(row.marketScore.probabilities,row.marketScore.over25);
  const value=negativeLog(exactProbability(market,row.actual))-negativeLog(exactProbability(release,row.actual));
  const key=Math.floor(row.kickoff/(7*86400000));
  const block=blocks.get(key)??{sum:0,n:0};
  block.sum+=value;
  block.n++;
  blocks.set(key,block);
  return value;
 });
 const groups=[...blocks.values()];
 const estimate=average(deltas);
 const replicates=2000;
 if(groups.length<8)return {n:rows.length,estimate,blocks:groups.length,replicates:0,interval95:null};
 const random=model.createSimulationRandom(27491);
 const draws=Array.from({length:replicates},()=>{
  let sum=0,n=0;
  for(let i=0;i<groups.length;i++){
   const block=groups[Math.floor(random()*groups.length)];
   sum+=block.sum;
   n+=block.n;
  }
  return sum/n;
 }).sort((a,b)=>a-b);
 return {n:rows.length,estimate,blocks:groups.length,replicates,interval95:[draws[49],draws[1949]]};
}

function decide(rows,model){
 // All test matches kick off on later UTC dates than the first 200 planned training matches.
 const cutoff=(Math.floor(rows[199].kickoff/86400000)+1)*86400000;
 const training=rows.slice(0,200).filter(row=>row.settledAt<cutoff);
 const test=rows.slice(200).filter(row=>row.kickoff>=cutoff);
 const pooled=training.length>=100?weightFor(training,model):null;
 const byLeague={};
 for(const scope of new Set(training.map(row=>row.scope))){
  const matches=training.filter(row=>row.scope===scope);
  if(matches.length>=30)byLeague[scope]={...weightFor(matches,model),n:matches.length};
 }
 const blend=test.map(row=>{
  const weight=byLeague[row.scope]?.weight??pooled?.weight;
  return weight==null?null:scoreResult(model.marketBlend(row.release.probabilities,row.market.probabilities,weight),
   model.matchOutcome(...row.actual));
 }).filter(Boolean);
 const comparison=scoreComparison(test,model);
 return {cutoff:new Date(cutoff).toISOString(),training:training.length,holdout:test.length,weights:{pooled,byLeague},
  blend:blend.length?{n:blend.length,logLoss:average(blend.map(row=>row.logLoss)),rps:average(blend.map(row=>row.rps))}:null,
  holdoutMetrics:summaries(test,model),marketScoreMinusRelease:comparison,
  scoreDecision:comparison.interval95?.[1]<0?'marketScore':'release'};
}

function checkpoint(rows,model,checked){
 const input=rows.map(({release,market,marketScore,rates,actual,id,scope,kickoff,settledAt})=>
  ({release,market,marketScore,rates,actual,id,scope,kickoff,settledAt}));
 return {checked:checked.toISOString(),modelVersion:model.LIVE_MARKET_VERSION,n:rows.length,simulationCount:0,
  dataSha256:createHash('sha256').update(JSON.stringify(input)).digest('hex'),metrics:summaries(rows,model)};
}

function evaluateMarketLedger(records,model,prior,checked){
 const version=model.LIVE_MARKET_VERSION;
 const candidates=records.filter(row=>sha(row.dataSha256)&&row.modelVersion&&Array.isArray(row.rates)&&row.rates.length===2&&
  row.rates.every(rate=>Number.isFinite(rate)&&rate>0&&rate<=100)&&row.savedAt<row.kickoff&&row.kickoff<=row.settledAt&&
  row.settledAt<=checked.getTime()&&row.actual?.length===2&&row.actual.every(value=>Number.isInteger(value)&&value>=0));
 const seen=new Set();
 const settled=[];
 for(const row of candidates.sort((a,b)=>a.kickoff-b.kickoff||a.id.localeCompare(b.id))){
  const release={probabilities:row.probabilities,consistentScore:row.consistentScore,scores:row.scores,modelVersion:row.modelVersion,
   dataSha256:row.dataSha256,savedAt:row.savedAt,simulationCount:row.simulationCount};
  if(seen.has(row.id)||!validPrediction(release))continue;
  seen.add(row.id);
  const quote=row.liveMarket?.version===version?row.liveMarket:null;
  const market=liveForecast(quote?.market,row,version);
  const marketScore=market?liveForecast(quote?.marketScore,row,version,true):null;
  settled.push({...row,release,market,marketScore});
 }
 const paired=settled.filter(row=>row.market&&row.marketScore);
 const counts={release:settled.length,market:settled.filter(row=>row.market).length,marketScore:paired.length};
 const previous=prior?.version===version?prior:{};
 // Take the first eligible matches by settlement, so delayed results do not rewrite a published report.
 const bySettlement=paired.slice().sort((a,b)=>a.settledAt-b.settledAt||a.kickoff-b.kickoff||a.id.localeCompare(b.id));
 const first=count=>bySettlement.slice(0,count).sort((a,b)=>a.kickoff-b.kickoff||a.id.localeCompare(b.id));
 const report={version,counts,metrics:summaries(settled,model),common:summaries(paired,model),
  milestone200:previous.milestone200??(paired.length>=200?checkpoint(first(200),model,checked):null),
  milestone500:previous.milestone500??null};
 if(!report.milestone500&&paired.length>=500){
  const rows=first(500);
  report.milestone500={...checkpoint(rows,model,checked),...decide(rows,model)};
 }
 return report;
}

module.exports={evaluateMarketLedger};
