'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=fs.existsSync(path.join(__dirname,'index.html'))?__dirname:path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
const model=new Function(code+';return {LEARNING_VERSION,learningDecision,shotEstimate,forecastSnapshot,shotCandidates,parseEvidence,evidenceForm,validLearningCandidates,workload,reliabilityBand};')();
const {buildLeague}=require(root===__dirname?'./forecast-ledger.cjs':'../scripts/forecast-ledger.cjs');
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
test('workload window and reliability use settled fixtures',()=>{
 const counts=model.workload('Besiktas',[{date:'2026-11-16',home:'Besiktas'},{date:'2026-11-09',away:'Besiktas'},{date:'2026-11-02',home:'Besiktas'}],asOf,1);
 assert.deepEqual(counts,{seven:1,fourteen:2,away:1,europe:1});
 const band=model.reliabilityBand([{probabilities:[.61,.2,.19],actual:[2,0]},{probabilities:[.62,.2,.18],actual:[0,0]},{probabilities:[.61,.2,.19]}],[.61,.2,.19]);
 assert.deepEqual(band,{n:2,hits:1,band:6});
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
console.log(n+' checks passed');
