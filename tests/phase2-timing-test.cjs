'use strict';

const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const {app,promotionCheck}=require('./phase2-backtest.cjs');
const {attachTrackTimes,requestPlan,inspectHistorical,collectHistorical,licensedOdds,earlyCoverage}=require('./phase2-timing.cjs');

async function main(){
 const blocked=spawnSync(process.execPath,[path.join(__dirname,'phase2-fetch-history.cjs'),'capture','unused','unused','TUR_1_super-lig'],{
  encoding:'utf8',env:{...process.env,HISTORICAL_CAPTURE_APPROVAL:'onaylıyorum',HISTORICAL_REPOSITORY_PRIVATE:'false'}
 });
 assert.equal(blocked.status,1);
 assert.match(blocked.stderr,/özel GitHub deposu gerekli/);
 const scope='TUR_1_super-lig',kickoff='2026-10-16T17:00:00.000Z',stamp='2026-10-16T11:00:00.000Z';
 const odds={id:'match-id',sport_key:'soccer_turkey_super_league',commence_time:kickoff,home_team:'Beşiktaş',away_team:'Galatasaray',
  bookmakers:[{key:'example',last_update:'2026-10-16T10:50:00Z',markets:[
   {key:'h2h',outcomes:[{name:'Beşiktaş',price:2.4},{name:'Draw',price:3.1},{name:'Galatasaray',price:2.9}]},
   {key:'totals',outcomes:[{name:'Over',price:2.1,point:2.5},{name:'Under',price:1.9,point:2.5}]}
  ]}]};
 const response={timestamp:stamp,data:[odds]};
 assert.equal(inspectHistorical(scope,response,Date.parse(stamp),0).length,1);
 assert.throws(()=>inspectHistorical(scope,response,Date.parse(stamp)-1,60000));
 assert.equal(inspectHistorical(scope,{...response,data:[{...odds,commence_time:stamp}]},Date.parse(stamp),0).length,0);
 assert.throws(()=>inspectHistorical(scope,{...response,data:[odds,odds]},Date.parse(stamp),0));

 const match={quote:{id:'7',recordHash:'checked',kickoff:Date.parse(kickoff)},open:[.4,.3,.3]};
 const record={id:7,hash:'checked',kickoff_utc:kickoff,logged_at_utc:'2026-10-16T08:00:00Z',pin_filled_at_utc:stamp,
  settled:1,logged_before_kickoff:1,teams_reversed_after_logging:0};
 assert.equal(attachTrackTimes([match],[record]).rows[0].leadHours,6);
 assert.equal(attachTrackTimes([match],[{...record,pin_filled_at_utc:kickoff}]).rows.length,0);
 assert.equal(attachTrackTimes([match],[{...record,hash:'different'}]).excluded.identity,1);
 assert.equal(attachTrackTimes([match],[{...record,logged_at_utc:'2026-09-29T12:00:00Z'}]).excluded.fill_timestamp_not_tracked,1);

 const csv='league,season,kickoff_utc,home_team,away_team,home_goals,away_goals\n'+
  'turkey1,2025-2026,2026-04-16T17:00:00Z,A,B,1,0\n'+
  'turkey1,2025-2026,2026-04-16T17:00:00Z,C,D,3,1\n'+
  'turkey1,2025-2026,2026-04-16T18:00:00Z,E,F,0,2';
 const plan=requestPlan(app,csv);
 assert.equal(plan.calls,4);
 assert.equal(plan.creditCeiling,80);
 assert.equal(plan.fixtures,3);
 assert.equal(plan.requests[0].asOf,'2026-04-16T11:00:00.000Z');
 const reused=requestPlan(app,csv,{reuseEarly:true});
 assert.equal(reused.leagues[scope].calls,2);
 assert.equal(reused.leagues[scope].creditCeiling,40);
 assert.equal(reused.requests[0].kind,'reuseEarly');
 assert.equal(reused.requests[0].asOf,'2026-04-16T16:59:59.000Z');
 assert.equal(promotionCheck([],new Set(['2024-25']),0).eligible,false);

 const early={scope,kind:'early',kickoff,asOf:stamp};
 const records=await collectHistorical([early,early],{key:'fixture-key',budget:20,fetcher:async url=>{
  assert.equal(url.searchParams.get('date'),stamp);
  assert.equal(url.searchParams.get('commenceTimeFrom'),kickoff);
  assert.equal(url.searchParams.get('markets'),'h2h,totals');
  return {ok:true,text:async()=>JSON.stringify(response)};
 }});
 assert.equal(records.calls,1);
 assert.equal(records.creditCeiling,20);
 assert.equal(records.snapshots[0].rows.length,1);
 assert.ok(records.snapshots[0].rows[0].over25>0);
 assert.equal(JSON.stringify(records).includes('fixture-key'),false);
 assert.equal(JSON.stringify(records).includes('"bookmakers"'),false);
 const normalized=licensedOdds(app,records.snapshots);
 assert.equal(normalized.rows[0].season,'2026-27');
 assert.deepEqual(normalized.rows[0].early.p,records.snapshots[0].rows[0].power);
 const daySnapshot={...records.snapshots[0],kind:'dayBefore',asOf:'2026-10-15T17:00:00.000Z',
  capturedAt:'2026-10-15T17:00:00.000Z',rows:[{...records.snapshots[0].rows[0],capturedAt:'2026-10-15T17:00:00.000Z',
   quotedAt:'2026-10-15T16:59:00.000Z',totalQuotedAt:'2026-10-15T16:59:00.000Z'}]};
 const twoHorizons=licensedOdds(app,[records.snapshots[0],daySnapshot]).rows[0];
 assert.deepEqual(twoHorizons.dayBefore,twoHorizons.early);
 assert.throws(()=>licensedOdds(app,[{...daySnapshot,asOf:stamp}]),/doğrulanamadı/);
 const anchor={scope,kind:'reuseEarly',kickoff,asOf:'2026-10-16T16:59:59.000Z'};
 const later={...odds,id:'later',commence_time:'2026-10-17T17:00:00.000Z'};
 const earlier={...odds,id:'earlier',commence_time:'2026-10-16T16:50:00.000Z'};
 const wide={timestamp:'2026-10-16T16:55:00Z',data:[odds,later,earlier]};
 const wideCapture=await collectHistorical([anchor],{key:'fixture-key',budget:20,fetcher:async url=>{
  assert.equal(url.searchParams.has('commenceTimeTo'),false);
  return {ok:true,text:async()=>JSON.stringify(wide)};
 }});
 const [snapshot]=wideCapture.snapshots;
 assert.deepEqual(snapshot.rows.map(row=>row.window),['close','early']);
 assert.equal(snapshot.rows[1].leadHours,24+5/60);
 const withEarly=licensedOdds(app,[snapshot]).rows;
 assert.equal(withEarly[1].dayBefore.leadHours,24+5/60);
 const cover=earlyCoverage(app,[
  {kickoff,home:odds.home_team,away:odds.away_team},
  {kickoff:later.commence_time,home:later.home_team,away:later.away_team}
 ],[snapshot]);
 assert.equal(cover.withEarly,1);
 assert.equal(cover.withoutEarly[0].kickoff,kickoff);
 const reserved=await collectHistorical([anchor,anchor],{key:'fixture-key',budget:40,minimumReserve:3000,fetcher:async url=>({
  ok:true,text:async()=>JSON.stringify(wide),headers:new Headers({
   'x-requests-remaining':url.pathname==='/v4/sports/'?'3039':'3019'
  })
 })});
 assert.equal(reserved.calls,1);
 await assert.rejects(collectHistorical([anchor],{key:'fixture-key',budget:20,minimumReserve:3000,fetcher:async url=>{
  assert.equal(url.pathname,'/v4/sports/');
  return {ok:true,headers:new Headers({'x-requests-remaining':'3019'})};
 }}),/yedek yetersiz/);
 assert.throws(()=>licensedOdds(app,[records.snapshots[0],records.snapshots[0]]),/mükerrer/);
 await assert.rejects(collectHistorical([early],{key:'fixture-key',budget:19}),/kredi sınırı/);
 await assert.rejects(collectHistorical([early],{key:'fixture-key',budget:20,fetcher:async()=>{throw Error('fixture-key');}}),
  error=>error.message.includes('ulaşılamadı')&&!error.message.includes('fixture-key'));
 console.log('PASS historical market cutoff, timestamp identity, same kickoff grouping, quota, private key and licensed snapshot ingestion');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
