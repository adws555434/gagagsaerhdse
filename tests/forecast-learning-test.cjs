'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=fs.existsSync(path.join(__dirname,'index.html'))?__dirname:path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
const model=new Function(code+';return {LEARNING_VERSION,learningDecision,shotEstimate,forecastSnapshot,shotCandidates,parseEvidence,evidenceForm,validLearningCandidates,workload,reliabilityBand,createLineupTrial,validLineupTrial,lineupArchiveEntries,settleHistory,candidateMetrics,archiveRows,archiveHistoryRows,longHistory,longHistoryForecast,archiveName,canonicalClubRows};')();
const {buildLeague,collectLedger}=require(root===__dirname?'./forecast-ledger.cjs':'../scripts/forecast-ledger.cjs');
let n=0;
function test(name,fn){fn();n++;console.log('PASS '+name);}
const scope='TUR_1_super-lig',stamp='2026-09-01T00:00:00Z',asOf='2026-11-16';
const loses={probabilities:[.2,.2,.6],scores:['0–1','0–2','1–1']};
const wins={probabilities:[.8,.1,.1],scores:['2–0','1–0','0–0']};
const records=Array.from({length:64},(_,i)=>{
 const time=Date.parse(stamp)+(i+1)*86400000, date=new Date(time).toISOString().slice(0,10);
 return {id:String(i),scope,date,kickoff:time+72000000,savedAt:time-3600000,learningVersion:model.LEARNING_VERSION,actual:[2,0],candidates:[loses,wins,loses,loses]};
});
test('learner selects weight from training and passes later validation',()=>{
 const result=model.learningDecision(records,scope,asOf);
 assert.equal(result.index,1);assert.equal(result.train,41);assert.equal(result.check,23);
 assert.equal(result.candidate.score,23);
});
test('learner rejects a weight when later score accuracy fell',()=>{
 const regressed=records.map((row,i)=>i<41?row:{...row,candidates:[wins,loses,loses,loses]});
 const result=model.learningDecision(regressed,scope,asOf);
 assert.equal(result.index,0);assert.equal(result.candidate.score,0);assert.equal(result.baseline.score,23);
});
test('future, same-day, wrong league and post-kickoff data do not train',()=>{
 assert.equal(model.learningDecision(records,'national',asOf).n,0);
 assert.equal(model.learningDecision(records,scope,'2026-09-02').n,0);
 assert.equal(model.learningDecision(records.slice(0,20),scope,asOf).index,0);
 assert.equal(model.learningDecision(records.map(row=>({...row,savedAt:row.kickoff})),scope,asOf).n,0);
 const duplicated=records.map(row=>({...row,date:'2026-10-01'}));
 assert.equal(model.learningDecision(duplicated,scope,asOf).index,0);
});
const history=Array.from({length:35},(_,i)=>{
 const date=new Date(Date.parse('2026-08-01T00:00:00Z')+i*86400000).toISOString().slice(0,10);
 return {date,home:i%2?'Besiktas':'Galatasaray',away:i%2?'Galatasaray':'Besiktas',home_target:'4',away_target:'3',ft_home:'2',ft_away:'1'};
});
test('shot candidates have normalized probabilities and preserve baseline',()=>{
 const shots=model.shotEstimate('Besiktas','Galatasaray',history,false,asOf);
 assert.deepEqual(shots.counts,[35,35]);
 const candidates=model.shotCandidates([1.4,1.1],shots);
 assert.equal(candidates.length,4);
 assert.deepEqual(candidates[0],model.forecastSnapshot([1.4,1.1]));
 assert.equal(model.validLearningCandidates(candidates),true);
 assert.equal(model.validLearningCandidates([{probabilities:[.4,.1,.1],scores:['1–0','1–1','0–0']}]),false);
});
test('missing shots do not get treated as zeros',()=>{
 const missing=history.map((row,i)=>({...row,away_target:i>6?'':row.away_target}));
 assert.equal(model.shotEstimate('Besiktas','Galatasaray',missing,false,asOf),null);
 assert.equal(model.shotCandidates([1.2,1.1],null).length,1);
});
test('verified format, date and duplicated imports',()=>{
 const common={team:'Beşiktaş',opponent:'Galatasaray',date:'2026-11-12',publishedAt:'2026-11-12T20:00:00Z',source:'https://example.com/data'};
 const xg={...common,xg:1.6,xga:.8};
 const player={...common,player:'Test',minutes:90,goals:1,assists:0};
 const lineup={...common,date:'2026-11-16',kickoff:'2026-11-16T19:00:00Z',publishedAt:'2026-11-16T18:00:00Z',starters:Array.from({length:11},(_,i)=>'Oyuncu '+i),attackChange:-4};
 const now=Date.parse('2026-11-16T18:30:00Z');
 const parsing=value=>model.parseEvidence(JSON.stringify(value),['Besiktas','Galatasaray'],asOf,now);
 const clean=parsing({xg:[xg,xg,{...xg,date:asOf}],players:[player],lineups:[lineup,{...lineup,publishedAt:lineup.kickoff}]});
 assert.equal(clean.xg.length,1);assert.equal(clean.players.length,1);assert.equal(clean.lineups.length,1);
 assert.match(model.evidenceForm(clean.players,5),/90 dk başına gol 1.00|90 dk başına gol 1.0/);
 assert.throws(()=>parsing({xg:[{...xg,source:'javascript:alert(1)'}]}));
 assert.throws(()=>parsing({lineups:[{...lineup,starters:['A']}]}));
});
const lineupArchive=fs.readFileSync(path.join(root,'lineup-samples.json'),'utf8');
test('three published lineup pairs match kickoff before kickoff and retain both teams',()=>{
 const archive=model.lineupArchiveEntries(lineupArchive,Date.parse('2026-11-16T00:00:00Z'));
 assert.deepEqual(archive.map(row=>(row.kickoff-row.published)/60000),[65,19,63]);
 assert.ok(archive.every(row=>row.home.starters.length===11&&row.away.starters.length===11));
 assert.equal(model.lineupArchiveEntries(lineupArchive,Date.parse('2026-11-01T00:00:00Z')).length,0);
 const altered=JSON.parse(lineupArchive);
 altered.lineups[0].publishedAt=altered.lineups[0].kickoff;
 assert.equal(model.lineupArchiveEntries(JSON.stringify(altered),Date.parse('2026-11-16T00:00:00Z')).length,2);
});
test('lineup trial compares the original frozen rates and settles both arms on the same result',()=>{
 const fixture={date:'2026-11-16',time:'19:00',zone:'UTC',home:'Besiktas',away:'Galatasaray'};
 const at=when=>Date.parse(fixture.date+'T'+when+':00Z');
 const row={...fixture,scope,savedAt:at('17:00'),kickoff:at('19:00'),rates:[1.45,1.3]};
 const lineups=[fixture.home,fixture.away].map((team,i,teams)=>({team,opponent:teams[1-i],date:fixture.date,
  kickoff:'2026-11-16T22:00:00+03:00',publishedAt:'2026-11-16T18:00:00Z',source:'https://example.com/lineup',
  starters:Array.from({length:11},(_,i)=>'Oyuncu '+i)}));
 const trial=model.createLineupTrial(row,fixture,lineups,[20,-15],at('18:15'));
 assert.equal(model.validLineupTrial({...row,lineupTrial:trial}),true);
 assert.deepEqual(trial.candidates[0],model.forecastSnapshot(row.rates));
 assert.ok(trial.candidates[1].probabilities[0]>trial.candidates[0].probabilities[0]);
 const [settled]=model.settleHistory([{...row,lineupTrial:trial}],scope,[{...fixture,ft_home:'2',ft_away:'0'}]);
 const paired=[{...settled,candidates:trial.candidates}];
 assert.deepEqual(settled.actual,[2,0]);
 assert.equal(model.candidateMetrics(paired,0).n,1);
 assert.equal(model.candidateMetrics(paired,1).n,1);
 assert.equal(model.validLineupTrial({...row,lineupTrial:{...trial,savedAt:at('19:00')}}),false);
 assert.throws(()=>model.createLineupTrial(row,fixture,lineups,[20,-15],at('19:00')),/başlamamış/);
 assert.throws(()=>model.createLineupTrial(row,fixture,lineups,[20,-15],at('17:59')),/yayın saati/);
 assert.throws(()=>model.createLineupTrial({...row,savedAt:at('18:00')},fixture,lineups,[20,-15],at('18:15')),/yayın saati/);
 assert.throws(()=>model.createLineupTrial(row,fixture,[lineups[0],{...lineups[1],opponent:'Rakip'}],[20,-15],at('18:15')),/doğru rakip/);
 assert.throws(()=>model.createLineupTrial(row,fixture,lineups,[0,0],at('18:15')),/değişiklik yok/);
 assert.throws(()=>model.createLineupTrial({...row,lineupTrial:trial},fixture,lineups,[20,-15],at('18:15')),/zaten/);
});
test('workload window and reliability use settled fixtures',()=>{
 const counts=model.workload('Besiktas',[{date:'2026-11-16',home:'Besiktas'},{date:'2026-11-09',away:'Besiktas'},{date:'2026-11-02',home:'Besiktas'}],asOf,1);
 assert.deepEqual(counts,{seven:1,fourteen:2,away:1,europe:1});
 const band=model.reliabilityBand([{probabilities:[.61,.2,.19],actual:[2,0]},{probabilities:[.62,.2,.18],actual:[0,0]},{probabilities:[.61,.2,.19]}],[.61,.2,.19]);
 assert.deepEqual(band,{n:2,hits:1,band:6});
});
test('100 match window uses dated scores, deduplicates aliases and prefers current source scores',()=>{
 const archive=fs.readFileSync(path.join(root,'assets','super-lig-2023-24.json'),'utf8');
 const parsed=model.archiveRows(archive,'2026-11-16');
 assert.equal(parsed.rows.length,380);
 assert.equal(model.longHistory('Beşiktaş',parsed.rows,model.archiveName).length,38);
 const rows=Array.from({length:121},(_,i)=>({date:new Date(Date.parse('2026-01-01')+i*86400000).toISOString().slice(0,10),
  home:'Beşiktaş',away:'Kasımpaşa SK',ft_home:1,ft_away:0}));
 const replacement={...rows[119],home:'Besiktas',away:'Kasimpasa',ft_home:3};
 const merged=model.archiveHistoryRows([replacement,{...rows[118],ft_home:null}],rows,rows[120].date,model.archiveName);
 assert.equal(merged.length,120);
 const span=model.longHistory('Besiktas',merged,model.archiveName);
 assert.equal(span.length,100);
 assert.equal(span[0].date,rows[20].date);
 assert.equal(span.at(-1).ft_home,3);
 const prediction=model.longHistoryForecast('besiktas','kasimpasa',model.canonicalClubRows(merged),{date:rows[120].date});
 assert.deepEqual(prediction.counts,[100,100]);
 assert.ok(Math.abs(prediction.probabilities.reduce((sum,p)=>sum+p,0)-1)<1e-6);
});
test('scheduled ledger deduplicates and settles, rejects unknown or late kickoffs',()=>{
 const now=new Date('2026-11-16T12:00:00Z');
 const fixtures=[{date:'2026-11-16',time:'18:00',home:'Besiktas',away:'Galatasaray'},
  {date:'2026-11-16',time:'11:00',home:'Galatasaray',away:'Besiktas'},
  {date:'2026-11-17',time:'',home:'Galatasaray',away:'Besiktas'}];
 const rows=buildLeague([],scope,'Süper Lig',history,fixtures,now);
 assert.equal(rows.length,1);assert.equal(rows[0].candidates.length,4);assert.equal(rows[0].actual,null);
 assert.ok(rows[0].savedAt<rows[0].kickoff);
 assert.equal(buildLeague(rows,scope,'Süper Lig',history,fixtures,now).length,1);
 const result=[...history,{...fixtures[0],ft_home:'2',ft_away:'0'}];
 const settled=buildLeague(rows,scope,'Süper Lig',result,fixtures,new Date('2026-11-17T12:00:00Z'));
 assert.deepEqual(settled[0].actual,[2,0]);assert.equal(settled[0].savedAt,rows[0].savedAt);
});
async function testSources(){
 const now=new Date('2026-11-16T12:00:00Z');
 const upcoming={date:'2026-11-16',time:'18:00',home:'Besiktas',away:'Galatasaray'};
 const prior=buildLeague([],scope,'Süper Lig',history,[upcoming],now);
 const scores='date,home,away,ft_home,ft_away\n2026-11-16,Besiktas,Galatasaray,2,0';
 const next=new Date('2026-11-17T12:00:00Z');
 const fallback=async url=>{
  if(!url.includes(scope)||!url.endsWith('results_2627.csv'))return {ok:false,status:503};
  if(url.includes('raw.githubusercontent.com'))return {ok:true,text:async()=>'<html>broken</html>'};
  return {ok:true,text:async()=>scores};
 };
 const snapshot=await collectLedger(prior,{clock:()=>next,fetchSource:fallback});
 assert.equal(snapshot.coverage,1);
 assert.equal(snapshot.feeds.length,7);
 assert.equal(snapshot.feeds.find(row=>row.scope===scope).results,'mirror');
 assert.equal(snapshot.feeds.find(row=>row.scope===scope).fixtures,'unavailable');
 assert.deepEqual(snapshot.records[0].actual,[2,0]);
 assert.equal(snapshot.records[0].savedAt,prior[0].savedAt);
 assert.equal(prior[0].actual,null);
 await assert.rejects(collectLedger(prior,{clock:()=>next,fetchSource:async()=>({ok:false,status:503})}),/Existing ledger preserved/);
 n++;console.log('PASS malformed primary falls back, fixture outage still settles results, total outage preserves the prior ledger');
 const fixture={date:'2026-11-17',time:'18:00',zone:'UTC',home:'Türkiye',away:'Almanya',neutral:true};
 const nationalRows=history.map(row=>({...row,home:row.home==='Besiktas'?'Türkiye':'Almanya',away:row.away==='Besiktas'?'Türkiye':'Almanya'}));
 const national=buildLeague([],'national','Erkek A milli takımları',nationalRows,[fixture,{...fixture,time:'24:00'}],next);
 assert.equal(national.length,1);
 assert.equal(national[0].kickoff,Date.parse('2026-11-17T18:00:00Z'));
 assert.equal(national[0].candidates.length,1);
 assert.match(national[0].model,/Rakip gücüne göre Poisson/);
 n++;console.log('PASS national forecasts use UTC, reject invalid fixture time and use the national model');
 console.log(n+' checks passed');
}
testSources().catch(error=>{console.error(error);process.exitCode=1});
