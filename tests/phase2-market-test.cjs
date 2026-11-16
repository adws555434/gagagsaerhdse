'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=fs.existsSync(path.join(__dirname,'index.html'))?__dirname:path.resolve(__dirname,'..');
const script=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
const app=new Function(script+';return {findMarketQuote,marketScoreDistribution,marketDevig,marketGoalFit,knownKickoff,marketTeamKey};')();
const {buildSnapshot,summarizeEvent}=require(root===__dirname?'./market-snapshot.cjs':'../scripts/market-snapshot.cjs');
const now=Date.parse('2026-11-20T12:00:00Z');
const scope='TUR_1_super-lig';
const fixture={home:'Beşiktaş',away:'Galatasaray',date:'2026-11-20',time:'18:00'};
const h2h={key:'h2h',last_update:'2026-11-20T11:50:00Z',outcomes:[
 {name:'Galatasaray',price:3.2},{name:'Draw',price:3.1},{name:'Besiktas JK',price:2.3}]};
const total={key:'totals',last_update:'2026-11-20T11:55:00Z',outcomes:[
 {name:'Under',point:2.5,price:1.9},{name:'Over',point:2.5,price:2.01},{name:'Over',point:3.5,price:2.9}]};
const payload={id:'a',sport_key:'soccer_turkey_super_league',commence_time:'2026-11-20T17:00:00Z',
 home_team:'Besiktas JK',away_team:'Galatasaray',
 bookmakers:[{key:'example',markets:[total,h2h]},{key:'old',last_update:'2026-11-17T08:00:00Z',markets:[{...h2h,last_update:undefined}]}]};

async function main(){
 const disabled=await buildSnapshot({fetcher:()=>assert.fail('Key is required')});
 assert.equal(disabled.state,'unconfigured');
 assert.deepEqual(disabled.events,[]);
 const report=await buildSnapshot({key:'test-key',clock:()=>now,fetcher:async url=>{
  assert.equal(url.hostname,'api.the-odds-api.com');
  assert.equal(url.searchParams.get('markets'),'h2h,totals');
  assert.equal(url.searchParams.get('apiKey'),'test-key');
  return {ok:true,text:async()=>JSON.stringify([payload]),headers:new Headers({'x-requests-remaining':'1'})};
 }});
 const quote=report.events[0];
 assert.equal(report.events.length,1);
 assert.equal(report.state,'ready');
 assert.equal(quote.books,1);
 assert.equal(quote.totalsBooks,1);
 assert.deepEqual(quote.power,app.marketDevig([2.3,3.1,3.2]));
 assert.ok(Math.abs(quote.over25-app.marketDevig([2.01,1.9])[0])<1e-12);
 assert.equal(JSON.stringify(report).includes('2.01'),false);
 assert.equal(JSON.stringify(report).includes('test-key'),false);
 assert.equal(JSON.stringify(report).includes('bookmakers'),false);
 assert.match(report.dataSha256,/^[a-f0-9]{64}$/);
 assert.strictEqual(app.findMarketQuote(report,scope,fixture,now),quote);
 assert.equal(app.findMarketQuote(report,scope,fixture,now-1),null);
 assert.equal(app.findMarketQuote(report,scope,fixture,app.knownKickoff(fixture)),null);
 assert.equal(app.findMarketQuote(report,scope,{...fixture,time:'19:00'},now),null);
 assert.equal(app.findMarketQuote(report,scope,{...fixture,home:fixture.away,away:fixture.home},now),null);
 assert.equal(app.findMarketQuote({...report,events:[quote,quote]},scope,fixture,now),null);
 assert.equal(app.findMarketQuote({...report,events:[{...quote,quotedAt:'2026-11-21T11:00:00Z'}]},scope,fixture,now),null);
 assert.equal(app.findMarketQuote({...report,events:[{...quote,totalQuotedAt:null}]},scope,fixture,now).over25,null);
 assert.equal(summarizeEvent({...payload,commence_time:'2026-11-20T11:00:00Z'},scope,now),null);
 const noTotals=summarizeEvent({...payload,bookmakers:[{key:'sample',markets:[h2h]}]},scope,now);
 assert.equal(noTotals.over25,null);
 assert.equal(app.marketGoalFit(noTotals.power,noTotals.over25),null);
 await assert.rejects(buildSnapshot({key:'secret-key',fetcher:async()=>{throw Error('secret-key');}}),
  error=>error.message.includes('network')&&!error.message.includes('secret-key'));
 await assert.rejects(buildSnapshot({key:'test-key',fetcher:async()=>({ok:false,status:401})}),/HTTP 401/);
 await assert.rejects(buildSnapshot({key:'test-key',fetcher:async()=>({ok:true,text:async()=>'X'})}),/invalid JSON/);
 const partial=await buildSnapshot({key:'test-key',clock:()=>now,scopes:[scope,'ENG_1_premier-league'],fetcher:async()=>({
  ok:true,text:async()=>JSON.stringify([payload]),headers:new Headers({'x-requests-remaining':'1'})
 })});
 assert.equal(partial.state,'partial');
 assert.equal(partial.failures[0].reason,'quota');
 console.log('PASS odds API adapter, missing secret, schema, quota, redaction, exact fixture identity, freshness, no post-kickoff odds and missing totals.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
