'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const main = script.slice(0, script.indexOf("$('go').addEventListener"));
const core = new Function(main + "return {archiveRows, estimateGoals, simulateScore};")();
const codes = ['tr.1', 'en.1', 'es.1', 'de.1', 'it.1', 'fr.1'];
const seasons = ['2023-24', '2024-25', '2025-26'];
const root = process.argv[2] || path.join(__dirname, 'audit-data');
const count = Number(process.argv[3] || 500000);
assert.ok(Number.isSafeInteger(count) && count > 0, 'A positive simulation count is required');
const cutoff = '2026-07-01';
const order = ['home','draw','away'];

function matchOutcome(home, away) {
  return home > away ? 'home' : home < away ? 'away' : 'draw';
}

function accumulator() {
  return {n: 0, hits: 0, exact: 0, logLoss: 0, brier: 0, baselineHits: 0, baselineLogLoss: 0, baselineBrier: 0};
}

function score(probs, truth) {
  const pred = order.reduce((best, key) => probs[key] > probs[best] ? key : best);
  return { hit: Number(pred === truth), loss: -Math.log(Math.max(1e-12, probs[truth])),
    brier: order.reduce((sum, key) => sum + (probs[key] - Number(truth === key)) ** 2, 0) };
}

function evaluate(leagues) {
  const all = accumulator(), summaries = {};
  for (const code of leagues) {
    const stats = accumulator();
    const coverage = [];
    for (const season of seasons) {
      const file = path.join(root, `${season}-${code}.json`);
      if (!fs.existsSync(file)) { coverage.push({season, unavailable: true}); continue; }
      const snapshot = core.archiveRows(fs.readFileSync(file, 'utf8'), cutoff);
      coverage.push({season, available: snapshot.rows.length, scheduled: snapshot.total});
      const played = snapshot.rows;
      for (let i = 0, firstToday = 0; i < played.length; i++) {
        const match = played[i];
        if (i > 0 && match.date !== played[i-1].date) firstToday = i;
        const history = played.slice(0, firstToday);
        assert.ok(history.every(row => row.date < match.date));
        const rates = core.estimateGoals(match.home, match.away, history);
        if (!rates) continue;
        const sim = core.simulateScore(rates.homeGoals, rates.awayGoals, count);
        const baseline = {home: 0, draw: 0, away: 0};
        for (const previous of history) baseline[matchOutcome(+previous.ft_home, +previous.ft_away)]++;
        const forecasts = Object.fromEntries(order.map(key => [key, sim.outcomes[key] / count]));
        const naive = Object.fromEntries(order.map(key => [key, (baseline[key]+1)/(history.length+3)]));
        const truth = matchOutcome(+match.ft_home, +match.ft_away);
        const model = score(forecasts, truth), basic = score(naive, truth);
        for (const target of [all, stats]) {
          target.n++;
          target.hits += model.hit;
          target.exact += Number(sim.scores[0][0] === `${match.ft_home}–${match.ft_away}`);
          target.logLoss += model.loss;
          target.brier += model.brier;
          target.baselineHits += basic.hit;
          target.baselineLogLoss += basic.loss;
          target.baselineBrier += basic.brier;
        }
      }
    }
    summaries[code] = {coverage, ...stats};
  }
  return {all, leagues:summaries};
}

console.log(JSON.stringify(evaluate(codes), null, 2));
