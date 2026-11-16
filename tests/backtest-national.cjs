'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
const {nationalRows,estimateGoals,simulateScore}=new Function(script+'return {nationalRows,estimateGoals,simulateScore};')();
const rows=nationalRows(fs.readFileSync(process.argv[2],'utf8'),'2025-12-31');
const results=Object.fromEntries([100000,500000].map(count=>[count,{games:0,resultCorrect:0,scoreCorrect:0,logLoss:0,brier:0}]));
const outcomes=['home','draw','away'];
for(let i=0,startOfDay=0;i<rows.length;i++){
  const match=rows[i];
  if(i>0&&rows[i-1].date!==match.date)startOfDay=i;
  if(match.date<'2023-01-01')continue;
  const earlier=rows.slice(0,startOfDay);
  assert.ok(earlier.every(row=>row.date<match.date));
  const model=estimateGoals(match.home,match.away,earlier,match.neutral);
  if(!model)continue;
  const h=+match.ft_home,a=+match.ft_away;
  const truth=h===a?'draw':h>a?'home':'away';
  for(const [count,stats] of Object.entries(results)){
    const sim=simulateScore(model.homeGoals,model.awayGoals,+count);
    const best=outcomes.reduce((max,key)=>sim.outcomes[key]>sim.outcomes[max]?key:max);
    stats.games++;
    stats.resultCorrect+=+(best===truth);
    stats.scoreCorrect+=+(sim.scores[0][0]===h+'–'+a);
    stats.logLoss-=Math.log(Math.max(sim.outcomes[truth]/count,1e-12));
    stats.brier+=outcomes.reduce((sum,k)=>sum+(sim.outcomes[k]/count-+(truth===k))**2,0);
  }
}
console.log(JSON.stringify(results,null,2));
