'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const path = require('node:path');
const core = require('./phase1-backtest.cjs');
const { app: market } = require('./phase2-backtest.cjs');
const { manifest: marketSources, readOne } = require('./phase2-archive.cjs');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
const app = new Function(script + ';return {MODEL_VERSION,ENGINE_VERSION,estimateGoals,forecastModel,prepareForecastDistribution,forecastDecision,poissonTerms,lowScoreFactor,boundedRho,scoreGridDistribution,createSimulationRandom};')();
const names = ['Poisson · Yayın modeli', 'Dixon–Coles', 'Beraberlik ağırlıklı bivariate Poisson', 'Negatif binom'];
const horizons = [1, 3, 5];
const minimumFit = 40;
const blockDraws = 2000;
const goalDifferenceLabels = ['-5 veya daha az', '-4', '-3', '-2', '-1', '0', '+1', '+2', '+3', '+4', '+5 veya daha çok'];
const totalLabels = ['0', '1', '2', '3', '4', '5+'];
const floor = 1e-15;
const seasonKeys = ['2023-24', '2024-25', '2025-26', '2026-27'];
const seasonCounts = [327, 290, 258, 54];
const sum = values => values.reduce((total, value) => total + value, 0);
const mean = values => sum(values) / values.length;
const loss = p => -Math.log(Math.max(floor, p));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const params = [
  Array.from({length: 31}, (_, i) => (i - 15) / 50),
  [0, .025, .05, .1, .15, .2, .3, .4].flatMap(shared =>
    [0, .025, .05, .075, .1, .15].map(draw => ({shared, draw}))),
  [0, .025, .05, .1, .15, .2, .3, .4, .6]
];
const starts = [15, 0, 0];

function bivariate(rateHome, rateAway, {shared, draw}, size) {
  const covariance = shared * Math.min(rateHome, rateAway);
  const home = app.poissonTerms(rateHome - covariance, size);
  const away = app.poissonTerms(rateAway - covariance, size);
  const common = app.poissonTerms(covariance, size);
  return {
    cell(h, a) {
      let p = 0;
      for (let sharedGoals = 0; sharedGoals <= Math.min(h, a); sharedGoals++) {
        p += home[h - sharedGoals] * away[a - sharedGoals] * common[sharedGoals];
      }
      return p;
    },
    draw
  };
}

function nbTerms(rate, dispersion, size) {
  if (!dispersion) return app.poissonTerms(rate, size);
  const shape = 1 / dispersion;
  const terms = [Math.exp(-shape * Math.log1p(rate / shape))];
  const q = rate / (rate + shape);
  for (let g = 1; g < size; g++) terms.push(terms[g-1] * (g-1+shape) / g * q);
  return terms;
}

function candidateScores(model, spec, homeRate, awayRate, base, actual) {
  const {size}=base;
  if (model === 0) {
    const rho = app.boundedRho(spec, homeRate, awayRate);
    const cell = (h, a) => base.grid[h * base.size + a] * app.lowScoreFactor(h, a, homeRate, awayRate, rho);
    return actual ? cell(...actual) : Array.from({length: size * size}, (_, i) => cell(Math.floor(i/size), i%size));
  }
  if (model === 1) {
    const {cell, draw} = bivariate(homeRate, awayRate, spec,size);
    const diagonal = sum(Array.from({length:size}, (_, i) => cell(i, i)));
    const inflated = (h, a) => cell(h, a) * (1-draw + (h===a ? draw/diagonal : 0));
    return actual ? inflated(...actual) : Array.from({length:size*size}, (_, i) => inflated(Math.floor(i/size), i%size));
  }
  const h = nbTerms(homeRate, spec,size), a = nbTerms(awayRate, spec,size);
  return actual ? h[actual[0]] * a[actual[1]] : h.flatMap(p => a.map(q => p*q));
}

function exactProbability(d, [home, away]) {
  return home < d.size && away < d.size ? d.grid[home*d.size+away] : 0;
}

function summary(d, actual) {
  const [h, a] = actual;
  const key = actual.join('–');
  const top = d.scores.slice(0,5);
  const decision = app.forecastDecision(d);
  const result = core.metricRow(d.outcomes, decision, actual);
  return {
    scoreLogLoss: loss(exactProbability(d, actual)),
    resultLogLoss: result[0],
    rps: result[1],
    outcomeHit: result[3],
    consistentHit: Number(decision.score[0] === key),
    consistentMass: decision.score[1],
    hits: horizons.map(n => Number(top.slice(0,n).some(([s]) => s===key))),
    mass: horizons.map(n => sum(top.slice(0,n).map(([,p]) => p)))
  };
}

function scoreCalibration() {
  const scoreLabels = Array.from({length:25}, (_,i) => Math.floor(i/5) + '–' + i%5).concat('Diğer');
  const groups = [scoreLabels, totalLabels, goalDifferenceLabels].map(labels => labels.map(label => ({label, predicted:0, hits:0})));
  const indices = (h,a) => [h<5&&a<5?h*5+a:25, Math.min(h+a,5), Math.max(-5, Math.min(5,h-a))+5];
  return {
    add(distribution, actual) {
      for (let i=0; i<distribution.grid.length; i++) {
        const p = distribution.grid[i];
        indices(Math.floor(i/distribution.size), i%distribution.size).forEach((j,k) => groups[k][j].predicted += p);
      }
      indices(...actual).forEach((i,k) => groups[k][i].hits++);
    },
    finish(n) {
      return Object.fromEntries(['scores','totalGoals','goalDifference'].map((name,i) => [name,
        groups[i].map(({label,predicted,hits}) => {
          const expected = predicted/n;
          return {label, expected, ...core.binomial(hits,n), difference:hits/n-expected};
        })
      ]));
    }
  };
}

function pairedBootstrap(rows, statistic) {
  if (!rows.length) return null;
  const bySeason = core.groupBy(rows, row => row.season);
  const groups = [...bySeason.values()].map(season => [...core.groupBy(season, row =>
    Math.floor(Date.parse(row.date)/604800000)).values()].map(block => [block.length, sum(block.map(statistic))]));
  const estimate=mean(rows.map(statistic));
  if (sum(groups.map(g => g.length)) < 10) return {estimate,ci95:null,ciAdjusted:null};
  const random = app.createSimulationRandom(20261116);
  const values = [];
  for (let i=0; i<blockDraws; i++) {
    let n=0, total=0;
    for (const blocks of groups) {
      for (let j=0; j<blocks.length; j++) {
        const [count,value] = blocks[Math.floor(random()*blocks.length)];
        n += count;
        total += value;
      }
    }
    values.push(total/n);
  }
  values.sort((a,b) => a-b);
  const interval = alpha => [core.percentile(values,alpha/2), core.percentile(values,1-alpha/2)];
  return {estimate, ci95:interval(.05), ciAdjusted:interval(.05/3)};
}

function probabilityBands(rows) {
  return ['%30 altı','%30–35','%35–40','%40 ve üstü'].map((label,i) => {
    const group = rows.filter(row => {
      const p = row.metrics.mass[1];
      return (p<.30?0:p<.35?1:p<.40?2:3) === i;
    });
    return {label, expected:group.length?mean(group.map(r=>r.metrics.mass[1])):null,
      ...core.binomial(sum(group.map(r=>r.metrics.hits[1])),group.length)};
  });
}

function reportMix(rows) {
  return {
    n: rows.length,
    scoreLogLoss: pairedBootstrap(rows, row=>row.metrics.scoreLogLoss),
    resultLogLoss: pairedBootstrap(rows, row=>row.metrics.resultLogLoss),
    rps: pairedBootstrap(rows, row=>row.metrics.rps),
    outcome: core.binomial(sum(rows.map(row=>row.metrics.outcomeHit)),rows.length),
    consistent: {
      expected:pairedBootstrap(rows,row=>row.metrics.consistentMass),
      actual:core.binomial(sum(rows.map(row=>row.metrics.consistentHit)),rows.length),
      difference:pairedBootstrap(rows,row=>row.metrics.consistentHit-row.metrics.consistentMass)
    },
    scores: Object.fromEntries(horizons.map((key,i) => [key,{
      expected:pairedBootstrap(rows,row=>row.metrics.mass[i]),
      actual:core.binomial(sum(rows.map(row=>row.metrics.hits[i])),rows.length),
      difference:pairedBootstrap(rows,row=>row.metrics.hits[i]-row.metrics.mass[i])
    }])),
    bands: probabilityBands(rows)
  };
}

function readCapturedTotals(files) {
  const totals=[];
  const sources=files.map(file=>{
    const bytes=fs.readFileSync(file);
    for(const snapshot of JSON.parse(bytes).snapshots){
      const captured=Date.parse(snapshot.capturedAt);
      const requested=Date.parse(snapshot.asOf);
      const kickoff=Date.parse(snapshot.kickoff);
      if(snapshot.scope!=='TUR_1_super-lig'||!(captured<=requested&&requested<kickoff&&kickoff-captured<=16*60000)||
       !/^[0-9a-f]{64}$/.test(snapshot.sourceSha256))continue;
      for(const row of snapshot.rows){
        const quoted=Date.parse(row.totalQuotedAt);
        if(Date.parse(row.kickoff)!==kickoff||Date.parse(row.capturedAt)!==captured||
         !(quoted<=captured&&captured-quoted<=86400000)||!(row.over25>0&&row.over25<1))continue;
        totals.push({date:row.kickoff.slice(0,10),home:row.home,away:row.away,close:{over25:row.over25}});
      }
    }
    return sha(bytes);
  });
  return {totals,sources};
}

async function main() {
  const [archiveDir,tffFile,outputFile,...oddsArgs] = process.argv.slice(2);
  assert.ok(archiveDir && tffFile && outputFile,'Kullanım: node tests/score-calibration.cjs ARŞİV TFF_JSON RAPOR_JSON [ODDSINTEL_CSV | --captures ÖZEL_ALIM_JSON ...]');
  const inputs = (await core.loadInputs(archiveDir,false))
    .filter(input=>input.league==='tr.1'&&seasonKeys.includes(input.season))
    .map(input=>input.season==='2025-26'?core.auditTurkey(input,tffFile):input)
    .sort((a,b)=>a.season.localeCompare(b.season));
  const source = marketSources.find(row=>row.kind==='oddsintel');
  const capture=oddsArgs[0]==='--captures';
  assert.ok(!capture||oddsArgs.length>1,'Özel alım dosyaları gerekli');
  const captured=capture?readCapturedTotals(oddsArgs.slice(1)):null;
  const oddsFile=capture?null:oddsArgs[0];
  const odds = oddsFile?readOne(market,oddsFile,source).filter(row=>row.league==='tr.1'&&row.verified&&row.close?.over25!=null):[];
  const fixtureKey = ({date,home,away}) => [date,market.marketTeamKey(home),market.marketTeamKey(away)].join('|');
  const available=captured?.totals??odds;
  const oddsByFixture = new Map(available.map(row=>[fixtureKey(row),row]));
  assert.equal(oddsByFixture.size,available.length,'Mükerrer piyasa eşleşmesi');
  const cumulative = params.map(group=>group.map(()=>0));
  const output = [];
  const calibration = scoreCalibration();
  const marketCalibrations = [scoreCalibration(), scoreCalibration()];
  const marketRows = [];
  const fitBySeason = {};
  let trained = 0;

  for (const [index,input] of inputs.entries()) {
    let scored = 0;
    for (const [date,matches] of core.groupBy(input.rows, match=>match.date)) {
      const previous = input.rows.filter(row=>row.date<date);
      const ready = [];
      const best = cumulative.map((values,i) => trained<minimumFit?starts[i]:values.indexOf(Math.min(...values)));
      for (const match of matches) {
        const {home,away,ft_home,ft_away} = match;
        const base = app.estimateGoals(home,away,previous);
        if (!base) continue;
        const {rates} = app.forecastModel(home,away,base,previous,{folder:'TUR_1_super-lig'},{date});
        const h=rates.homeGoals,a=rates.awayGoals;
        const d = app.prepareForecastDistribution(h,a);
        const {size}=d;
        const actual = [ft_home,ft_away];
        const row = {season:input.season,date,home,away,actual,
          top:d.scores.slice(0,5),metrics:summary(d,actual),candidates:[]};
        const price = oddsByFixture.get(fixtureKey(match));
        const usableTotals=price&&(!price.actual||price.actual.every((g,i)=>g===actual[i]))?price.close.over25:null;
        const marketCandidates=[];
        for (let i=0; i<params.length; i++) {
          const weights = candidateScores(i,params[i][best[i]],h,a,d);
          const mass=sum(weights);
          assert.ok(weights.every(p=>Number.isFinite(p)&&p>=0));
          assert.ok(Math.abs(mass-1)<1e-7);
          const grid=weights.map(p=>p/mass);
          const candidate={...app.scoreGridDistribution(grid,size),grid,size};
          row.candidates.push(summary(candidate,actual));
          if(usableTotals!=null){
            const adjusted=market.marketTotalsDistribution(candidate.outcomes,usableTotals,candidate);
            assert.ok(adjusted,'Piyasa alt/üst adayı uyarlanamadı');
            marketCandidates.push(summary(adjusted,actual));
          }
        }
        calibration.add(d,actual);
        if (usableTotals!=null) {
          const adjusted = market.marketTotalsDistribution(d.outcomes,usableTotals,d);
          if (adjusted) {
            assert.ok(adjusted.outcomes.every((p,i)=>Math.abs(p-d.outcomes[i])<1e-9));
            assert.ok(Math.abs(sum(adjusted.grid.filter((_,i)=>Math.floor(i/adjusted.size)+i%adjusted.size>=3))-usableTotals)<1e-9);
            marketCalibrations[0].add(d,actual);
            marketCalibrations[1].add(adjusted,actual);
            marketRows.push({season:input.season,date,baseline:row.metrics,
              metrics:summary(adjusted,actual),marketTotal:adjusted.expectedTotal,
              originalTotal:h+a,candidatesBefore:row.candidates,candidatesAfter:marketCandidates});
          }
        }
        ready.push({h,a,d,actual});
        output.push(row);
        scored++;
      }
      // Every fixture on the date uses the fit from strictly older dates.
      for (const {h,a,d,actual} of ready) {
        for (let i=0; i<params.length; i++) {
          params[i].forEach((spec,j)=> cumulative[i][j] += loss(candidateScores(i,spec,h,a,d,actual)));
        }
        trained++;
      }
      if(ready.length)fitBySeason[input.season] = {date,trainingCountAtPrediction:trained-ready.length,
        rho:params[0][best[0]], bivariate:params[1][best[1]], dispersion:params[2][best[2]]};
    }
    assert.equal(scored,seasonCounts[index],input.season);
  }
  assert.deepEqual(inputs.map(input=>input.season),seasonKeys);
  assert.equal(output.length,929);
  const comparison = names.slice(1).map((name,i) => {
    const asCandidate = output.map(row=>({...row,metrics:row.candidates[i]}));
    const delta = key => pairedBootstrap(output,row=>row.candidates[i][key]-row.metrics[key]);
    return {name, ...reportMix(asCandidate), scoreLogLossDelta:delta('scoreLogLoss'), resultLogLossDelta:delta('resultLogLoss'),
      top3Delta:pairedBootstrap(output,row=>row.candidates[i].hits[1]-row.metrics.hits[1])};
  });
  const marketWithout = marketRows.map(row=>({...row,metrics:row.baseline}));
  const report = {
    version:'2026.11-score-calibration-v1', model:app.MODEL_VERSION, engine:app.ENGINE_VERSION, n:output.length, blockDraws,
    seasonCounts, minimumFit, testedConfigurations:params.map(group=>group.length),
    inputSha256:sha(JSON.stringify(inputs.map(input=>[input.file,input.sha256,input.archiveSha256??null]))),
    base:reportMix(output), calibration:calibration.finish(output.length), comparison, fitBySeason,
    matches:output.map(({season,date,home,away,actual,top,metrics})=>({
      season,date,home,away,actual,top3:top.slice(0,3),top3Mass:metrics.mass[1],top3Hit:metrics.hits[1]
    })).sort((a,b)=>b.top3Mass-a.top3Mass),
    market:marketRows.length?{
      status:capture?'captured':'research', n:marketRows.length,
      source:capture?'The Odds API · zaman damgalı özel alım':source.source,
      sourceSha256:capture?captured.sources:source.sha256,
      license:capture?'The Odds API kullanım şartları':source.license,
      before:reportMix(marketWithout), after:reportMix(marketRows),
      calibrationBefore:marketCalibrations[0].finish(marketRows.length), calibrationAfter:marketCalibrations[1].finish(marketRows.length),
      scoreLogLossDelta:pairedBootstrap(marketRows,row=>row.metrics.scoreLogLoss-row.baseline.scoreLogLoss),
      top3Delta:pairedBootstrap(marketRows,row=>row.metrics.hits[1]-row.baseline.hits[1]),
      expectedGoals:{before:mean(marketRows.map(row=>row.originalTotal)),after:mean(marketRows.map(row=>row.marketTotal))},
      candidates:names.slice(1).map((name,i)=>({
        name,
        before:reportMix(marketRows.map(row=>({...row,metrics:row.candidatesBefore[i]}))),
        after:reportMix(marketRows.map(row=>({...row,metrics:row.candidatesAfter[i]})))
      }))
    }:{status:'notRun',n:0},
    defaultChanged:false,
    independentProspective:false
  };
  if(process.env.SCORE_CALIBRATION_PRIVATE_MATCHES){
    const privateFile=process.env.SCORE_CALIBRATION_PRIVATE_MATCHES;
    assert.notEqual(path.resolve(privateFile),path.resolve(outputFile),'Özel çıktı ile özet dosyası farklı olmalı');
    fs.writeFileSync(privateFile,JSON.stringify(report.matches)+'\n',{mode:0o600});
  }
  delete report.matches;
  fs.writeFileSync(outputFile, JSON.stringify(report)+'\n');
  console.log(JSON.stringify({matches:report.n,base:report.base,comparison:comparison.map(({name,scoreLogLoss,scoreLogLossDelta,resultLogLossDelta,top3Delta})=>
    ({name,scoreLogLoss,scoreLogLossDelta,resultLogLossDelta,top3Delta})),market:report.market.n},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
