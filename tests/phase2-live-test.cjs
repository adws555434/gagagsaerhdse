'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=fs.existsSync(path.join(__dirname,'index.html'))?__dirname:path.resolve(__dirname,'..');
const directory=root===__dirname?root:path.join(root,'scripts');
const {evaluateMarketLedger}=require(path.join(directory,'market-validation.cjs'));
const {quotaPlan}=require(path.join(directory,'market-snapshot.cjs'));
const script=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
const app=new Function(script+';return {LIVE_MARKET_VERSION,prepareForecastDistribution,marketTotalsDistribution,marketComparisonForMatch,primaryForecast,forecastSnapshotForLedger,frozenMarketComparison,marketBlend,matchOutcome,strongestOutcome,confidenceTier,createSimulationRandom};')();
const release=app.prepareForecastDistribution(2.4,.65);
const quote={power:[.18,.22,.60],over25:.52};
const comparison=app.marketComparisonForMatch(release,quote);
const selected=app.primaryForecast(release,comparison,'release');
assert.equal(selected.method,'market');
assert.equal(selected.scoreMethod,'release');
assert.equal(app.strongestOutcome(release.outcomes),0);
assert.equal(app.strongestOutcome(selected.probabilities),2);
assert.equal(app.primaryForecast(release,null,'marketScore').method,'release');
assert.equal(app.primaryForecast(release,comparison,'marketScore').score,comparison.structural);
assert.equal(app.primaryForecast(release,app.marketComparisonForMatch(release,{power:quote.power}),'marketScore').score,release);
const {grid,size,expectedTotal,expectedDifference}=comparison.structural;
const sum=values=>values.reduce((a,b)=>a+b,0);
const scoreCells=grid.map((p,index)=>({p,h:Math.floor(index/size),a:index%size}));
assert.ok(Math.abs(sum(grid)-1)<1e-12);
assert.ok(grid.every(p=>p>=0));
assert.ok(Math.abs(sum(scoreCells.filter(({h,a})=>h+a>2).map(({p})=>p))-.52)<1e-12);
assert.ok(Math.abs(sum(scoreCells.map(({p,h,a})=>p*(h+a)))-expectedTotal)<1e-12);
assert.ok(Math.abs(sum(scoreCells.map(({p,h,a})=>p*(h-a)))-expectedDifference)<1e-12);
assert.ok(comparison.structural.outcomes.every((p,i)=>Math.abs(p-quote.power[i])<1e-12));
assert.deepEqual(Array.from({length:6},(_,i)=>quotaPlan(i+1).credits31Days),[248,496,372,496,310,372]);
assert.throws(()=>quotaPlan(0));
assert.throws(()=>quotaPlan(7));

const day=86400000;
const hash='a'.repeat(64);
const version=app.LIVE_MARKET_VERSION;
const releaseSnapshot=app.forecastSnapshotForLedger(release);
const start=Date.parse('2025-01-01T16:00:00Z');
const records=Array.from({length:501},(_,i)=>{
 const kickoff=start+i*day;
 const savedAt=kickoff-3600000;
 const published=new Date(savedAt-300000).toISOString();
 const candidates=app.frozenMarketComparison(release,{...quote,capturedAt:published,quotedAt:published,totalQuotedAt:published});
 const metadata={dataSha256:hash,savedAt,simulationCount:0,modelVersion:version};
 return {id:'fixture-'+i,scope:i%2?'TUR_1_super-lig':'ESP_1_la-liga',kickoff,savedAt,rates:[2.4,.65],
  actual:[0,2],settledAt:kickoff+3*3600000,dataSha256:hash,simulationCount:0,modelVersion:'release-test',...releaseSnapshot,
  liveMarket:{version,market:{...candidates.market,...metadata},marketScore:{...candidates.marketScore,...metadata}}};
});
const checked=new Date(start+502*day);
const evaluate=(rows,previous)=>evaluateMarketLedger(rows,app,previous,checked);
const a=evaluate(records.slice(0,199));
assert.equal(a.milestone200,null);
const b=evaluate(records.slice(0,200),a);
assert.equal(b.milestone200.n,200);
assert.match(b.milestone200.dataSha256,/^[a-f0-9]{64}$/);
assert.equal(b.common.market.result.hits,200);
assert.equal(b.common.release.result.hits,0);
assert.deepEqual(b.common.market.tiers[2].accuracy,b.common.market.result);
const c=evaluate(records.slice(0,499),b);
assert.equal(c.milestone500,null);
const d=evaluate(records.slice(0,500),c);
assert.deepEqual(d.milestone200,b.milestone200);
assert.equal(d.milestone500.training,200);
assert.equal(d.milestone500.holdout,300);
assert.equal(d.milestone500.weights.pooled.weight,1);
assert.equal(d.milestone500.weights.byLeague['TUR_1_super-lig'].weight,1);
assert.equal(d.milestone500.scoreDecision,'marketScore');
assert.ok(d.milestone500.marketScoreMinusRelease.interval95[1]<0);
const y=evaluate(records.map(row=>({...row,actual:[3,0]})));
assert.equal(y.milestone500.scoreDecision,'release');
assert.ok(y.milestone500.marketScoreMinusRelease.interval95[0]>0);
const stale={...records[500],liveMarket:{...records[500].liveMarket,
 marketScore:{...records[500].liveMarket.marketScore,savedAt:records[500].kickoff}}};
const updated=evaluate([...records.slice(0,500),stale,records[0]],d);
assert.deepEqual(updated.milestone500,d.milestone500);
assert.deepEqual(updated.counts,{release:501,market:501,marketScore:500});
assert.equal(updated.common.market.n,500);
assert.equal(updated.metrics.market.n,501);
const postdated={...records[0],liveMarket:{...records[0].liveMarket,market:{...records[0].liveMarket.market,
 quotedAt:new Date(records[0].kickoff).toISOString()}}};
assert.deepEqual(evaluate([postdated]).counts,{release:1,market:0,marketScore:0});
console.log(JSON.stringify({status:'PASS',syntheticOnly:true,combined:updated.counts,thresholds:[b.milestone200.n,d.milestone500.n],
 holdout:d.milestone500.holdout,bootstrapReplicates:d.milestone500.marketScoreMinusRelease.replicates,
 maximumMassError:Math.abs(sum(grid)-1),quota31Days:Array.from({length:6},(_,i)=>quotaPlan(i+1).credits31Days)}));
