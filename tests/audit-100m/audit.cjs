'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..','..');
const source = fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
const {archiveRows,nationalRows,estimateGoals,simulateScore,SIMULATIONS} = new Function(source+'return {archiveRows,nationalRows,estimateGoals,simulateScore,SIMULATIONS};')();
const [internationalFile, replayBinary, archiveDir = path.join(root,'audit-data')] = process.argv.slice(2);
const names = ['home','draw','away'];
const codes = ['tr.1','en.1','es.1','de.1','it.1','fr.1'];
const seasons = ['2023-24','2024-25','2025-26'];
const picks = 8;

function probabilities(lambda) {
  const p=[Math.exp(-lambda)];
  for(let i=1;i<=40;i++)p.push(p[i-1]*lambda/i);
  return p;
}

function exact(homeRate,awayRate) {
  const H=probabilities(homeRate), A=probabilities(awayRate);
  const outcomes=[0,0,0];
  let best=-1, score, runnerUp=-1;
  for(let h=0;h<H.length;h++)for(let a=0;a<A.length;a++){
    const p=H[h]*A[a];
    outcomes[h>a?0:h===a?1:2]+=p;
    if(p>best){runnerUp=best;best=p;score=h+'–'+a}
    else if(p>runnerUp)runnerUp=p;
  }
  const sorted=outcomes.slice().sort((a,b)=>b-a);
  return {outcomes,score,marginResult:sorted[0]-sorted[1],marginScore:best-runnerUp};
}

function score(metrics,forecast,match) {
  const h=+match.ft_home,a=+match.ft_away;
  const truth=h>a?0:h===a?1:2;
  const best=forecast.outcomes.indexOf(Math.max(...forecast.outcomes));
  metrics.n++;
  metrics.hits+=+(best===truth);
  metrics.exact+=+(forecast.score===h+'–'+a);
  metrics.logLoss-=Math.log(Math.max(1e-12,forecast.outcomes[truth]));
  metrics.brier+=forecast.outcomes.reduce((sum,p,i)=>sum+(p-+(i===truth))**2,0);
}

const empty=()=>({n:0,hits:0,exact:0,logLoss:0,brier:0});
function cases(rows,minimum) {
  const result=[];
  for(let i=0,start=0;i<rows.length;i++){
    const match=rows[i];
    if(i&&match.date!==rows[i-1].date)start=i;
    if(minimum&&match.date<minimum)continue;
    const earlier=rows.slice(0,start);
    assert.ok(earlier.every(row=>row.date<match.date));
    const rates=estimateGoals(match.home,match.away,earlier,match.neutral);
    if(rates)result.push({match,h:rates.homeGoals,a:rates.awayGoals});
  }
  return result;
}
function choose(rows,n){
  return Array.from({length:n},(_,i)=>rows[Math.floor((i+0.5)*rows.length/n)]);
}
const leagues = Object.fromEntries(codes.map(code=>[code,seasons.flatMap(season=>{
  const file=path.join(archiveDir,season+'-'+code+'.json');
  if(!fs.existsSync(file))return [];
  return cases(archiveRows(fs.readFileSync(file,'utf8'),'2026-07-01').rows);
})]));
const clubs=Object.values(leagues).flat();
const national=cases(nationalRows(fs.readFileSync(internationalFile,'utf8'),'2025-12-31'),'2023-01-01');
assert.equal(clubs.length,4719);
assert.equal(national.length,3238);
const sampleClubs=Object.values(leagues).flatMap(rows=>choose(rows,picks));
const sampleNational=choose(national,48);
const roster=[...sampleClubs,...sampleNational];
const report={
  simulations:SIMULATIONS,
  fullPoissonModel:{clubs:empty(),national:empty()},
  actualSimulation:{clubs:empty(),national:empty()},
  samplePoissonModel:{clubs:empty(),national:empty()},
  sample500000:{clubs:empty(),national:empty()},
  probabilityComparison:{maxAbsoluteDifferencePP:0,meanMaxAbsoluteDifferencePP:0,resultSelectionDifferences:0,scoreSelectionDifferences:0},
  sampleMethod:'Eight evenly spaced eligible matches per club league and 48 evenly spaced international matches. Selection does not use forecast success or scores.',
  matches:[]
};
for(const [key,rows] of [['clubs',clubs],['national',national]])for(const r of rows)score(report.fullPoissonModel[key],exact(r.h,r.a),r.match);
const children = Math.min(Number(process.env.REPLAY_WORKERS||9),roster.length);
const lines=roster.map(({h,a},id)=>[id,h,a,Math.exp(-h),Math.exp(-a)].join(' '));
function replay(slot) {
  return new Promise((resolve,reject)=>{
    const worker=spawn(replayBinary,[],{stdio:['pipe','pipe','inherit']});
    const stdout=[];
    worker.stdout.setEncoding('utf8');
    worker.stdout.on('data',chunk=>stdout.push(chunk));
    worker.on('error',reject);
    worker.on('close',code=>code===0?resolve(stdout.join('').trim().split('\n')):reject(new Error('Replay failed '+code)));
    worker.stdin.on('error',reject);
    worker.stdin.end(lines.filter((_,i)=>i%children===slot).join('\n')+'\n');
  });
}
(async()=>{
  const raw=(await Promise.all(Array.from({length:children},(_,i)=>replay(i)))).flat();
  const unique=new Set();
  for(const line of raw){
    const [id,h,d,a,sh,sa,frequency]=line.split(' ').map(Number);
    assert.ok(id>=0&&id<roster.length&&!unique.has(id));
    assert.equal(h+d+a,SIMULATIONS);
    assert.ok(frequency>0);
    unique.add(id);
    const item=roster[id], key=id<sampleClubs.length?'clubs':'national';
    const forecast={outcomes:[h,d,a].map(n=>n/SIMULATIONS),score:sh+'–'+sa};
    const precise=exact(item.h,item.a);
    const base=simulateScore(item.h,item.a,500000);
    score(report.actualSimulation[key],forecast,item.match);
    score(report.samplePoissonModel[key],precise,item.match);
    score(report.sample500000[key],{outcomes:names.map(k=>base.outcomes[k]/500000),score:base.scores[0][0]},item.match);
    const diff=100*Math.max(...precise.outcomes.map((p,k)=>Math.abs(p-forecast.outcomes[k])));
    const comp=report.probabilityComparison;
    comp.maxAbsoluteDifferencePP=Math.max(comp.maxAbsoluteDifferencePP,diff);
    comp.meanMaxAbsoluteDifferencePP+=diff/roster.length;
    const chosen=values=>values.indexOf(Math.max(...values));
    comp.resultSelectionDifferences+=+(chosen(forecast.outcomes)!==chosen(precise.outcomes));
    comp.scoreSelectionDifferences+=+(forecast.score!==precise.score);
    report.matches[id]={date:item.match.date,home:item.match.home,away:item.match.away,rates:[item.h,item.a],observed:[+item.match.ft_home,+item.match.ft_away],counts:[h,d,a],topScore:forecast.score,topScoreCount:frequency};
  }
  assert.equal(unique.size,roster.length);
  console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
