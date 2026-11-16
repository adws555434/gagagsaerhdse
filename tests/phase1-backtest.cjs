'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const root = fs.existsSync(path.join(__dirname, 'index.html')) ? __dirname : path.resolve(__dirname, '..');
const ledgerCommit = '1879a9aa54fa6ab01780076b44dad71884116fe8';
const tffSnapshot = '86db50af8c1f409db836a8d6fdaa2917320976d0f048342d0412d7d4636ca961';
const version = '2026.11-phase-1';
const seeds = { bootstrap: 20261116, missing: 45117 };
const repetitions = 2000;
const minimumIndependent = 500;
const pinnedLedgerSha256 = '7781c81eb2855f0bdb77eef2046aad83755a811b9af7d6746c70ef4b532510c1';
const snapshotEnd = '2026-11-15';
const metrics = ['logLoss', 'rps', 'brier', 'result', 'score', 'top3'];
const comparisonKeys = ['release', 'frequency', 'elo', 'poisson', 'uncertainty'];
const names = ['Yayın modeli', 'Lig sıklığı', 'Elo', 'Bağımsız Poisson', 'Belirsizlikli Poisson'];
const confidenceLabels = ['%45 altı', '%45–55', '%55–65', '%65+'];
const leagueNames = {
  'tr.1': 'Süper Lig', 'en.1': 'Premier League', 'es.1': 'La Liga',
  'de.1': 'Bundesliga', 'it.1': 'Serie A', 'fr.1': 'Ligue 1'
};
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const mean = (values, n = values.length) => n ? values.reduce((sum, value) => sum + value, 0) / n : null;
const toDay = date => Date.parse(date + 'T00:00:00Z') / 86400000;
const bucket = p => p >= .65 ? 3 : p >= .55 ? 2 : p >= .45 ? 1 : 0;
const seasonStart = season => season.slice(0, 4) + '-07-01';

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
const app = new Function(script + `;return {ARCHIVE_LEAGUES, ENGINE_VERSION, MODEL_VERSION,
  checkedCsv, clubModelKey, matchOutcome, compareDate, validDate,
  validScore, validForecastRecord, estimateGoals, forecastModel, leagueScoreReference, eloScoreReference,
  prepareForecastDistribution, createSimulationRandom, forecastDecision, strongestOutcome};`)();

async function loadInputs(dir, download) {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'phase1-inputs.json'), 'utf8'));
  if (download) fs.mkdirSync(dir, { recursive: true });
  return Promise.all(manifest.map(async entry => {
    const input = entry.local ? path.join(root, entry.local) : path.join(dir, entry.file);
    if (download && !entry.local && !fs.existsSync(input)) {
      const response = await fetch(entry.url, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw Error('Kaynak indirilemedi: ' + entry.file + ' HTTP ' + response.status);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(sha256(bytes), entry.sha256, entry.file);
      fs.writeFileSync(input, bytes);
    }
    const bytes = fs.readFileSync(input);
    assert.equal(sha256(bytes), entry.sha256, entry.file);
    const csv = entry.file.endsWith('.csv');
    const season = entry.season ?? (csv ? '2026-27' : entry.file.slice(0, 7));
    const league = entry.league ?? entry.file.split('-').at(-1).slice(0, 4);
    const text = bytes.toString('utf8');
    const records = csv ? app.checkedCsv(text, ['date', 'home', 'away', 'ft_home', 'ft_away']) :
      JSON.parse(text).matches.map(row => {
        const score = Array.isArray(row.score) ? row.score : row.score?.ft;
        return { date: row.date, home: row.team1, away: row.team2, ft_home: score?.[0], ft_away: score?.[1] };
      });
    const seen = new Map();
    const rows = [];
    const missing = [];
    for (const source of records) {
      const { date, home, away } = source;
      const validIdentity = app.validDate(date) && home && away;
      const row = { date: date ?? null, home: home ?? null, away: away ?? null };
      if (!validIdentity) { missing.push({ ...row, reason: 'fixture' }); continue; }
      if (date > snapshotEnd) continue;
      const match = {
        ...row, home: app.clubModelKey(home), away: app.clubModelKey(away),
        ft_home: Number(source.ft_home), ft_away: Number(source.ft_away)
      };
      assert.notEqual(match.home, match.away, entry.file + ' ' + date);
      const key = [date, match.home, match.away].join('|');
      const usable = app.validScore(source);
      if (seen.has(key)) {
        const previous = seen.get(key);
        assert.equal(previous, usable ? [match.ft_home, match.ft_away].join('-') : null,
          'Çelişen maç kaydı: ' + entry.file + ' ' + key);
        continue;
      }
      seen.set(key, usable ? [match.ft_home, match.ft_away].join('-') : null);
      if (!usable) { missing.push({ ...row, reason: 'score' }); continue; }
      rows.push(match);
    }
    return { league, season, file: entry.file, sha256: entry.sha256,
      rows: rows.sort(app.compareDate), missing, sourceRows: records.length };
  }));
}

function auditTurkey(input, file) {
  const bytes = fs.readFileSync(file);
  assert.equal(sha256(bytes), tffSnapshot, 'TFF dosyasının özeti değişti');
  const official = JSON.parse(bytes).matches.map(row => {
    assert.ok(app.validDate(row.date) && row.home && row.away && row.score.length === 2);
    const [ft_home, ft_away] = row.score;
    const match = { date: row.date, home: app.clubModelKey(row.home), away: app.clubModelKey(row.away), ft_home, ft_away };
    assert.ok(app.validScore(match));
    return match;
  });
  const key = row => [row.home, row.away].join('|');
  const byGame = new Map(official.map(row => [key(row), row]));
  assert.equal(official.length, byGame.size);
  assert.equal(official.length, input.sourceRows);
  for (const row of input.rows) {
    assert.deepEqual(byGame.get(key(row)), row, 'Kaynaklar arasında tarih veya skor farkı: ' + key(row));
  }
  for (const row of input.missing) {
    const game = byGame.get(key({ home: app.clubModelKey(row.home), away: app.clubModelKey(row.away) }));
    assert.ok(game, 'TFF kaydında eşleşmeyen arşiv fikstürü');
  }
  return { ...input, file: 'tff-results.json', sha256: tffSnapshot,
    rows: official.sort(app.compareDate), missing: [], archiveRecovered: input.missing.length,
    archiveFile: input.file, archiveSha256: input.sha256, archiveMissing: input.missing,
    archiveMissingPattern: missingPattern(input), matchedArchiveScores: input.rows.length };
}

function metricRow(probabilities, decision, actual) {
  assert.ok(probabilities.every(p => Number.isFinite(p) && p >= 0));
  assert.ok(Math.abs(probabilities.reduce((sum, p) => sum + p, 0) - 1) < 1e-10);
  const outcome = app.matchOutcome(...actual);
  const score = actual.join('–');
  return [
    -Math.log(Math.max(1e-15, probabilities[outcome])),
    ((probabilities[0] - Number(outcome === 0)) ** 2 +
      (probabilities[0] + probabilities[1] - Number(outcome !== 2)) ** 2) / 2,
    probabilities.reduce((sum, p, index) => sum + (p - Number(outcome === index)) ** 2, 0),
    Number(decision.outcome === outcome),
    Number(decision.score[0] === score),
    Number(decision.top.slice(0, 3).some(([key]) => key === score))
  ];
}

function fitSeason(league, historical, season) {
  const asOf = seasonStart(season);
  const history = historical.flatMap(input => {
    assert.ok(input.season < season, 'Aynı veya sonraki sezon eğitim girdisi olamaz');
    return input.rows.filter(row => row.date < asOf);
  }).sort(app.compareDate);
  if (!history.length) return null;
  const folder = Object.keys(app.ARCHIVE_LEAGUES).find(key => app.ARCHIVE_LEAGUES[key] === league);
  assert.ok(folder);
  const frequency = app.leagueScoreReference(history);
  const appearances = new Map();
  for (const row of history) for (const team of [row.home, row.away]) {
    appearances.set(team, (appearances.get(team) ?? 0) + 1);
  }
  function predict({ home, away, date }, transform = null) {
    assert.ok(date >= asOf, 'Test maçı sezon başlangıcından önce');
    const base = app.estimateGoals(home, away, history);
    if (!base || !frequency) return null;
    const { rates, h, a } = app.forecastModel(home, away, base, history, { folder }, { date: asOf });
    return [
      app.prepareForecastDistribution(rates.homeGoals, rates.awayGoals),
      frequency,
      app.eloScoreReference(frequency, h, a),
      app.prepareForecastDistribution(base.homeGoals, base.awayGoals),
      app.prepareForecastDistribution(rates.homeGoals, rates.awayGoals, { matches: [rates.H.matches, rates.A.matches] })
    ].map(distribution => transform ? transform(distribution) : ({
      p: distribution.outcomes, decision: app.forecastDecision(distribution)
    }));
  }
  return { predict, appearances, trainingN: history.length, trainingLatest: history.at(-1).date, asOf };
}

function backtest(inputs) {
  const windows = [];
  const outcomes = [];
  for (const league of Object.keys(leagueNames)) {
    const available = inputs.filter(input => input.league === league).sort((a, b) => a.season.localeCompare(b.season));
    for (let index = 1; index < available.length; index++) {
      const target = available[index];
      const model = fitSeason(league, available.slice(0, index), target.season);
      const window = { league, season: target.season, trainingEnd: model.asOf,
        trainingLatest: model.trainingLatest, trainingN: model.trainingN, eligible: 0, excluded: [] };
      assert.ok(window.trainingLatest < window.trainingEnd);
      const first = target.rows[0]?.date;
      for (const row of target.rows) {
        const { date, home, away } = row;
        const predictions = model.predict({ date, home, away });
        if (!predictions) {
          window.excluded.push({
            date, home, away, homePriorMatches: model.appearances.get(home) ?? 0,
            awayPriorMatches: model.appearances.get(away) ?? 0
          });
          continue;
        }
        const actual = [row.ft_home, row.ft_away];
        const seasonDay = toDay(date) - toDay(first);
        outcomes.push({ league, season: target.season, date,
          week: Math.floor(seasonDay / 7), segment: seasonDay < 90 ? 'start' : seasonDay < 240 ? 'middle' : 'end',
          actual: app.matchOutcome(...actual), predictions: predictions.map(({ p, decision }) => ({
            p, values: metricRow(p, decision, actual)
          }))
        });
        window.eligible++;
      }
      windows.push(window);
    }
  }
  return { windows, outcomes };
}

function groupBy(values, key) {
  const groups = new Map();
  for (const value of values) {
    const k = key(value);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(value);
  }
  return groups;
}

function binomial(hits, n) {
  if (!n) return { hits, n, rate: null, ci95: null };
  const p = hits / n, z = 1.959963984540054;
  const d = 1 + z * z / n;
  const center = (p + z * z / (2 * n)) / d;
  const radius = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return { hits, n, rate: p, ci95: [Math.max(0, center - radius), Math.min(1, center + radius)] };
}

function percentile(sorted, q) {
  const index = (sorted.length - 1) * q;
  const left = Math.floor(index);
  return sorted[left] + (index - left) * (sorted[Math.ceil(index)] - sorted[left]);
}

function bootstrap(rows, trials = repetitions) {
  if (!rows.length) return null;
  const sample = app.createSimulationRandom(seeds.bootstrap);
  const width = (names.length - 1) * metrics.length;
  // Keep league-seasons represented and draw whole seven-day blocks for paired differences.
  const strata = [...groupBy(rows, row => row.league + row.season).values()].map(matches =>
    [...groupBy(matches, row => row.week).values()].map(week => {
      const deltas = new Float64Array(width);
      for (const { predictions } of week) {
        for (let model = 1; model < predictions.length; model++) {
          for (let i = 0; i < metrics.length; i++) {
            deltas[(model - 1) * metrics.length + i] += predictions[model].values[i] - predictions[0].values[i];
          }
        }
      }
      return { n: week.length, deltas };
    })
  );
  if (strata.every(blocks => blocks.length < 2)) return null;
  const draws = Array.from({ length: width }, () => new Float64Array(trials));
  const totals = new Float64Array(width);
  for (let draw = 0; draw < trials; draw++) {
    totals.fill(0);
    let n = 0;
    for (const blocks of strata) for (let j = 0; j < blocks.length; j++) {
      const block = blocks[Math.floor(sample() * blocks.length)];
      n += block.n;
      for (let i = 0; i < width; i++) totals[i] += block.deltas[i];
    }
    for (let i = 0; i < width; i++) draws[i][draw] = totals[i] / n;
  }
  const intervals = draws.map(samples => {
    samples.sort();
    return [percentile(samples, .025), percentile(samples, .975)];
  });
  return names.slice(1).map((_, model) => Object.fromEntries(metrics.map((metric, i) =>
    [metric, intervals[model * metrics.length + i]]
  )));
}

function calibration(rows, model) {
  return [0, 1, 2].map(outcome =>
    Array.from(groupBy(rows, row => Math.min(9, Math.floor(row.predictions[model].p[outcome] * 10))),
      ([bin, matches]) => ({
        bin, predicted: mean(matches.map(row => row.predictions[model].p[outcome])),
        observed: binomial(matches.filter(row => row.actual === outcome).length, matches.length)
      })).sort((a, b) => a.bin - b.bin)
  );
}

function describe(rows, details = false) {
  const intervals = bootstrap(rows);
  const summary = names.map((name, model) => {
    const values = rows.map(row => row.predictions[model].values);
    const sums = metrics.map((_, index) => values.reduce((sum, values) => sum + values[index], 0));
    return { name, n: rows.length,
      ...Object.fromEntries(metrics.map((key, index) =>
        [key, index < 3 ? mean([sums[index]], rows.length) : binomial(sums[index], rows.length)]
      ))
    };
  });
  return summary.map((entry, model) => {
    const reference = summary[0];
    const result = { ...entry, deltaVsRelease: model === 0 ? null : Object.fromEntries(metrics.map((metric, i) => [
      metric, { estimate: i < 3 ? entry[metric] - reference[metric] : entry[metric].rate - reference[metric].rate,
        ci95: intervals?.[model - 1]?.[metric] ?? null }
    ])) };
    if (!details) return result;
    const tiers = groupBy(rows, row => bucket(Math.max(...row.predictions[model].p)));
    return { ...result, calibration: calibration(rows, model),
      tiers: confidenceLabels.map((label, index) => {
        const matches = tiers.get(index) ?? [];
        return { label, coverage: binomial(matches.length, rows.length),
          accuracy: binomial(matches.filter(row => row.predictions[model].values[3]).length, matches.length) };
      }),
      monthly: Array.from(groupBy(rows, row => row.date.slice(0, 7)), ([month, matches]) =>
        ({ month, n: matches.length, logLoss: mean(matches.map(row => row.predictions[model].values[0])) }))
        .sort((a, b) => a.month.localeCompare(b.month)),
      segments: Array.from(groupBy(rows, row => row.segment), ([segment, matches]) => ({
        segment, n: matches.length, logLoss: mean(matches.map(row => row.predictions[model].values[0])),
        result: binomial(matches.filter(row => row.predictions[model].values[3]).length, matches.length)
      }))
    };
  });
}

function missingPattern(input) {
  const omitted = input.missing.filter(row => row.reason === 'score' && app.validDate(row.date));
  if (!omitted.length || !input.rows.length || input.season === '2026-27') return null;
  const dated = [...input.rows, ...omitted].map(row => row.date).sort();
  const pivot = dated[Math.floor(dated.length / 2)];
  const side = dated.map(date => Number(date >= pivot));
  const expected = side.reduce((n, value) => n + value, 0) * omitted.length / side.length;
  const observed = omitted.filter(row => row.date >= pivot).length;
  const distance = Math.abs(observed - expected);
  const rng = app.createSimulationRandom(seeds.missing);
  let asExtreme = 0;
  for (let trial = 0; trial < repetitions; trial++) {
    const shuffled = side.slice();
    let total = 0;
    for (let i = 0; i < omitted.length; i++) {
      const j = i + Math.floor(rng() * (shuffled.length - i));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      total += shuffled[i];
    }
    if (Math.abs(total - expected) >= distance - 1e-12) asExtreme++;
  }
  return { pivot, datedFixtures: dated.length, missingScores: omitted.length,
    missingOnOrAfter: observed, pTwoSided: (asExtreme + 1) / (repetitions + 1) };
}

function ledgerMetrics(bytes) {
  const { records, checked } = JSON.parse(bytes);
  assert.ok(Number.isFinite(Date.parse(checked)) && Array.isArray(records));
  const dated = records.filter(row => app.validForecastRecord(row) && row.savedAt > 0 &&
    Number.isFinite(row.kickoff) && row.savedAt < row.kickoff && row.savedAt <= Date.parse(checked));
  const valid = dated.filter(row => app.validForecastRecord(row) &&
    Math.abs(row.probabilities.reduce((sum, p) => sum + p, 0) - 1) < 1e-8 &&
    typeof row.dataSha256 === 'string' && /^[a-f0-9]{64}$/.test(row.dataSha256) &&
    typeof row.modelVersion === 'string' && Number.isSafeInteger(row.simulationCount) && row.simulationCount >= 0);
  const unique = [...groupBy(valid, row => [row.scope, row.kickoff, app.clubModelKey(row.home),
    app.clubModelKey(row.away)].join('|')).values()]
    .map(records => records.reduce((first, row) => row.savedAt < first.savedAt ? row : first));
  const settled = unique.filter(row => row.actual != null && row.kickoff <= Date.parse(checked));
  const paired = settled.flatMap(row => {
    if (row.measurementVersion !== version || !row.comparison) return [];
    const predictions = comparisonKeys.map(key => row.comparison[key]);
    const valid = predictions.every(snapshot =>
      snapshot?.probabilities?.length === 3 &&
      snapshot.probabilities.every(p => Number.isFinite(p) && p >= 0) &&
      Math.abs(snapshot.probabilities.reduce((total, p) => total + p, 0) - 1) < 1e-8 &&
      /^\d+–\d+$/.test(snapshot.consistentScore) && snapshot.scores?.length === 3 &&
      snapshot.scores.every(score => typeof score === 'string' && /^\d+–\d+$/.test(score)) &&
      app.matchOutcome(...snapshot.consistentScore.split('–').map(Number)) === app.strongestOutcome(snapshot.probabilities));
    const league = app.ARCHIVE_LEAGUES[row.scope];
    if (!valid || !league) return [];
    const year = Number(row.date.slice(0, 4)) - Number(row.date.slice(5, 7) < '07');
    const season = year + '-' + String(year + 1).slice(-2);
    return [{ league, season, date: row.date, week: Math.floor((toDay(row.date) - toDay(seasonStart(season))) / 7),
      predictions: predictions.map(snapshot => ({
        p: snapshot.probabilities,
        values: metricRow(snapshot.probabilities, {
          outcome: app.strongestOutcome(snapshot.probabilities),
          score: [snapshot.consistentScore], top: snapshot.scores.map(score => [score])
        }, row.actual)
      })) }];
  });
  const distinctSeasons = groupBy(paired, row => row.season);
  const comparison = paired.length ? describe(paired) : null;
  const promotionEvidence = names.slice(1).map((name, index) => {
    const metricIndex = index + 1;
    const interval = comparison?.[metricIndex].deltaVsRelease.logLoss.ci95 ?? null;
    const seasonsWithoutRegression = [...distinctSeasons.values()].filter(rows =>
      mean(rows.map(row => row.predictions[metricIndex].values[0] - row.predictions[0].values[0])) <= 0).length;
    return { name, interval, seasonsWithoutRegression, totalSeasons: distinctSeasons.size,
      eligible: paired.length >= minimumIndependent && interval?.[1] < 0 &&
        seasonsWithoutRegression > distinctSeasons.size / 2 };
  });
  return { sha256: sha256(bytes), checked, total: records.length, legacyPreMatch: dated.length - valid.length,
    observedPreMatch: dated.length, preMatch: unique.length, settled: settled.length,
    byScope: Object.fromEntries(Array.from(groupBy(settled, row => row.scope), ([scope, rows]) => [scope, rows.length])),
    minimum: minimumIndependent, pairedCandidateMatches: paired.length, comparison, promotionEvidence };

}

function selfTest() {
  const groups = Array.from({ length: 3 }, (_, i) => ({ date: '2024-02-1' + i, home: 'testa', away: 'testb',
    ft_home: i === 0 ? 2 : 0, ft_away: i === 2 ? 1 : 0 }));
  const training = [{ season: '2023-24', rows: groups.concat(groups.map(row => ({ ...row, date: row.date.replace('-02-', '-03-') }))) }];
  const future = { date: '2024-09-01', home: 'testa', away: 'testb', ft_home: 1, ft_away: 0 };
  const fit = fitSeason('tr.1', training, '2024-25');
  const forecasts = fit.predict(future);
  assert.deepEqual(fit.predict({ ...future, ft_home: 99, ft_away: 45 }), forecasts);
  assert.deepEqual(fitSeason('tr.1', [{ ...training[0], rows: training[0].rows.concat(future) }], '2024-25').predict(future), forecasts);
  assert.throws(() => fitSeason('tr.1', training.concat({ season: '2024-25', rows: [future] }), '2024-25'));
  assert.equal(fit.predict({ ...future, home: 'unknown' }), null);
  assert.equal(fitSeason('tr.1', [{ season: '2023-24', rows: groups }], '2024-25').predict(future), null);
  const score = key => ({ outcome: 0, score: [key], top: [[key]] });
  assert.deepEqual(metricRow([1, 0, 0], score('1–0'), [1, 0, 0].slice(0, 2)), [-0, 0, 0, 1, 1, 1]);
  assert.equal(metricRow([1, 0, 0], score('1–0'), [0, 1])[1], 1);
  assert.deepEqual([.44, .45, .55, .65].map(bucket), [0, 1, 2, 3]);
  const item = { league: 'tr.1', season: '2024-25', predictions: names.map(() => ({ values: [1, 1, 1, 1, 1, 1] })) };
  const comparisons = [{ ...item, week: 0 }, { ...item, week: 1 }];
  assert.deepEqual(bootstrap(comparisons, 20), bootstrap(comparisons, 20));
  assert.ok(bootstrap(comparisons, 20).every(x => Object.values(x).every(interval => interval.every(v => v === 0))));
  const omissions = { season: '2024-25', rows: groups, missing: [{ date: '2024-02-18', reason: 'score' }] };
  assert.deepEqual(missingPattern(omissions), missingPattern(omissions));
  const sample = { id: 'fixture', scope: 'TUR_1_super-lig', league: 'Süper Lig', home: 'A', away: 'B',
    date: '2024-09-01', savedAt: 1, kickoff: 2, model: 'test', modelVersion: 'test',
    probabilities: [.5, .3, .2], scores: ['1–0'], actual: [1, 0],
    dataSha256: 'a'.repeat(64), simulationCount: 100000 };
  const ledger = ledgerMetrics(JSON.stringify({ checked: '2024-09-01', records: [
    sample, { ...sample, id: 'duplicate' }, { ...sample, savedAt: 2 }, { ...sample, dataSha256: null }
  ] }));
  assert.equal(ledger.preMatch, 1);
  assert.equal(ledger.settled, 1);
  assert.equal(ledger.pairedCandidateMatches, 0);
  const snapshot = { probabilities: sample.probabilities, consistentScore: '1–0', scores: ['1–0', '1–1', '0–1'] };
  const comparison = Object.fromEntries(comparisonKeys.map(key => [key, snapshot]));
  const shadow = ledgerMetrics(JSON.stringify({ checked: '2024-09-02',
    records: [{ ...sample, measurementVersion: version, comparison }] }));
  assert.equal(shadow.pairedCandidateMatches, 1);
  assert.equal(shadow.comparison[0].result.hits, 1);
  assert.ok(shadow.promotionEvidence.every(item => !item.eligible));
  const badScore = ledgerMetrics(JSON.stringify({ checked: '2024-09-02',
    records: [{ ...sample, measurementVersion: version, comparison: { ...comparison, elo: { ...snapshot, consistentScore: '0–1' } } }] }));
  assert.equal(badScore.pairedCandidateMatches, 0);
  console.log('Faz 1 denetimleri geçti. Sezon sızıntısı, ortak kapsam, metrikler, eşikler, bootstrap ve ledger.');
}

async function run() {
  selfTest();
  if (process.argv.includes('--self-test')) return;
  const args = process.argv.slice(2).filter(arg => arg !== '--download');
  let tffFile;
  const tffIndex = args.indexOf('--tff');
  if (tffIndex >= 0) [, tffFile] = args.splice(tffIndex, 2);
  if (args.length !== 3) throw Error('Kullanım: node tests/phase1-backtest.cjs [--download] VERİ_DİZİNİ LEDGER_JSON ÇIKTI_DİZİNİ');
  const [dataDir, ledgerFile, outputDir] = args;
  const archiveInputs = await loadInputs(dataDir, process.argv.includes('--download'));
  const inputs = tffFile ? archiveInputs.map(input => input.league === 'tr.1' && input.season === '2025-26'
    ? auditTurkey(input, tffFile) : input) : archiveInputs;
  const { outcomes, windows } = backtest(inputs);
  const groups = new Map([['all', outcomes]]);
  for (const key of [row => row.league, row => row.season, row => row.league + '/' + row.season]) {
    for (const [name, matches] of groupBy(outcomes, key)) groups.set(name, matches);
  }
  assert.ok(outcomes.length);
  const results = Object.fromEntries(Array.from(groups, ([key, matches]) =>
    [key, describe(matches, key === 'all' || key in leagueNames)]));
  const seasons = Object.keys(results).filter(key => /^\d{4}-\d\d$/.test(key)).map(key => results[key]);
  const ledger = ledgerMetrics(fs.readFileSync(ledgerFile));
  ledger.commit = ledger.sha256 === pinnedLedgerSha256 ? ledgerCommit : null;
  const report = { version, releaseModel: app.MODEL_VERSION, releaseEngine: app.ENGINE_VERSION,
    dataSha256: sha256(JSON.stringify(inputs.flatMap(({ file, sha256, archiveFile, archiveSha256 }) => archiveFile ? [[file, sha256], [archiveFile, archiveSha256]] : [[file, sha256]]))),
    snapshotEnd, forecastTrialsPerMatch: 0, bootstrapTrials: repetitions, bootstrapSeed: seeds.bootstrap,
    missingSeed: seeds.missing, leagues: leagueNames, ledger,
    verdicts: names.slice(1).map((name, i) => {
      const model = i + 1;
      const interval = results.all[model].deltaVsRelease.logLoss.ci95;
      const seasonsWithoutRegression = seasons.filter(group => group[model].logLoss <= group[0].logLoss).length;
      const improvedOnReplay = interval?.[1] < 0 && seasonsWithoutRegression > seasons.length / 2;
      return { name, interval, seasonsWithoutRegression, totalSeasons: seasons.length,
        improvedOnReplay, eligibleForReview: improvedOnReplay && ledger.promotionEvidence[i].eligible, promoted: false };
    }),
    results
  };
  const coverage = inputs.map(input => ({
    league: input.league, season: input.season, file: input.file, sourceRows: input.sourceRows,
    usable: input.rows.length, missingPattern: missingPattern(input), missing: input.missing,
    archiveFile: input.archiveFile, archiveRecovered: input.archiveRecovered, archiveMissing: input.archiveMissing,
    archiveMissingPattern: input.archiveMissingPattern, matchedArchiveScores: input.matchedArchiveScores
  }));
  fs.mkdirSync(outputDir, { recursive: true });
  for (const [file, data] of [['phase1-results.json', report], ['phase1-coverage.json', { version, coverage, windows }]]) {
    fs.writeFileSync(path.join(outputDir, file), JSON.stringify(data) + '\n');
  }
  const compact = Object.fromEntries(Object.entries(results).filter(([key]) => key === 'all' || key in leagueNames)
    .map(([key, rows]) => [key, rows.map(({ monthly, segments, deltaVsRelease, calibration, ...row }, index) =>
      index === 0 ? { ...row, calibration, monthly, segments } : row)]));
  fs.writeFileSync(path.join(outputDir, 'phase1-summary.json'), JSON.stringify({ leagues: leagueNames, results: compact }) + '\n');
  console.log(JSON.stringify({ n: outcomes.length, ledger, verdicts: report.verdicts,
    turkey: results['tr.1']?.map(({ name, logLoss, rps, result, score, top3 }) =>
      ({ name, logLoss, rps, result, score, top3 })) }, null, 2));
}

module.exports = { loadInputs, auditTurkey, fitSeason, metricRow, binomial, groupBy, percentile, seasonStart, leagueNames, snapshotEnd };

if (require.main === module) run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
