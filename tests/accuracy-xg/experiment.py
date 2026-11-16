"""Chronological xG and historical starting-lineup ablation study."""
import itertools
import json
from pathlib import Path
import sys

import numpy as np
from scipy.optimize import minimize

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'accuracy-research'))
from scan import OUTCOME_MASK, grid as poisson_grid, metrics, report, meets, block_gain

REFERENCES = {'ana': {'kind': 'live'}, 'arsiv': {'kind': 'archive'}, 'dengeli': {'kind': 'balanced'}}
LEAGUES = ('eng', 'esp', 'fra', 'ger', 'ita')


def sample(rows):
    return {
        'rows': rows,
        'y': np.array([r['y'] for r in rows]),
        'base': np.array([r['baseline'] for r in rows]),
        'archive': np.array([r['older'] or r['baseline'] for r in rows]),
        'archive_available': np.array([r['older'] is not None for r in rows]),
        'balanced': np.array([r['balanced'] for r in rows]),
        'xg': np.array([r['xg'] or [r['baseline']]*3 for r in rows]),
        'xi': np.array([r['xi'] or [[0, .7], [0, .7]] for r in rows]),
    }


def design(d, window, use_xg, use_xi):
    n = len(d['y'])
    base = np.log(d['base'])
    old = np.log(d['archive'])
    columns = [np.ones((n, 2)), np.tile([0, 1], (n, 1)), base, old]
    prior = [0, 0, .6, .4]
    if use_xg:
        prior[2:4] = [.4, .2]
        columns.append(np.log(d['xg'][:, window]))
        prior.append(.4)
    if use_xi:
        a, b = d['xi'].transpose(2, 0, 1)
        columns.extend([a, a[:, ::-1], b-.7, b[:, ::-1]-.7])
        prior.extend([0., 0., 0., 0.])
    return np.stack(columns, axis=-1), np.array(prior)


def fit(d, window, alpha, use_xg, use_xi):
    tensor, prior = design(d, window, use_xg, use_xi)
    x = tensor.reshape(-1, len(prior))
    y = d['y'].ravel()

    def objective(p):
        eta = x@p
        pred = np.exp(eta)
        change = p-prior
        return (pred-y*eta).mean()+alpha*(change@change)/2, x.T@(pred-y)/len(y)+alpha*change

    result = minimize(objective, prior, method='L-BFGS-B', jac=True)
    if not result.success:
        raise ValueError(result.message)
    return result.x.tolist()


def predict(d, c):
    kind = c['kind']
    if kind == 'league_validation_route':
        grid = np.zeros((len(d['y']),) + OUTCOME_MASK[0].shape)
        for league, cfg in c['leagues'].items():
            mask = np.array([row['league']==league for row in d['rows']])
            if mask.any():
                grid[mask] = predict(sample([row for row in d['rows'] if row['league']==league]), cfg)
        return grid
    if kind == 'live':
        return poisson_grid(d['base'])
    if kind == 'archive':
        return np.where(d['archive_available'][:, None, None], poisson_grid(d['archive'], rho=-.04), poisson_grid(d['base']))
    if kind == 'balanced':
        grid = poisson_grid(d['base'])
        grid[:, :9, :9] = d['balanced'].reshape(-1, 9, 9)
        return grid/grid.sum((1, 2), keepdims=True)
    if kind == 'weighted':
        ref = (1-c['archive'])*d['base']+c['archive']*d['archive']
        rates = ref*(1-c['xg'])+c['xg']*d['xg'][:, c['window']]
    elif kind == 'fitted':
        x, _ = design(d, c['window'], c['use_xg'], c['use_xi'])
        rates = np.exp(x@c['coef'])
    else:
        raise ValueError(kind)
    return poisson_grid(np.clip(rates, .08, 6), rho=c['rho'])


def candidates(d):
    groups = {}
    groups['xg_weighted'] = [
        dict(kind='weighted', window=window, xg=xg, archive=archive, rho=rho)
        for window, xg, archive, rho in itertools.product(range(3), [.15,.30,.45,.60,.80,1], [0.,.5], [-.08,-.04,0,.04])
    ]
    for label, (xg, squad) in {
        'goals_fitted': (False, False), 'xg_fitted': (True, False),
        'xi_fitted': (False, True), 'xg_xi_fitted': (True, True)
    }.items():
        group = []
        for window, alpha in itertools.product(range(3) if xg else [0], [.002,.015,.06]):
            coeff = fit(d, window, alpha, xg, squad)
            for rho in [-.08,-.04,0,.04]:
                group.append(dict(kind='fitted', window=window, alpha=alpha, use_xg=xg, use_xi=squad, rho=rho, coef=coeff))
        groups[label] = group
    return groups


def select_by_league(rows, trials):
    configs = {}
    for league in LEAGUES:
        d = sample([row for row in rows if row['league'] == league])
        control = metrics(predict(d, REFERENCES['ana']), d['y']).mean(0)
        selected = REFERENCES['ana']
        best_loss = control[3]
        for cfg in trials:
            scores = metrics(predict(d,cfg),d['y']).mean(0)
            if meets(scores,control) and scores[3]<best_loss:
                selected = cfg
                best_loss = scores[3]
        configs[league] = selected
    return dict(kind='league_validation_route',leagues=configs)


def compare(d, settings):
    return {name: metrics(predict(d,c), d['y']) for name,c in settings.items()}


def main():
    records = json.loads(Path(sys.argv[1]).read_text())
    # Any candidate using the starting eleven sees the same eligible fixtures as the models without it.
    eligible = [r for r in records if r['xg'] is not None and r['xi'] is not None]
    train = [r for r in eligible if r['year'] <= 2020]
    valid = [r for r in eligible if 2021 <= r['year'] <= 2022]
    test = [r for r in eligible if r['year'] >= 2023]
    assert len({row['id'] for row in eligible}) == len(eligible)
    assert max(r['date'] for r in train) < min(r['date'] for r in valid)
    assert max(r['date'] for r in valid) < min(r['date'] for r in test)
    v = sample(valid)
    fixed = compare(v, REFERENCES)
    base = fixed['ana'].mean(0)
    labels = {'ana': REFERENCES['ana'], 'arsiv': REFERENCES['arsiv'], 'dengeli': REFERENCES['dengeli']}
    by_family = candidates(sample(train))
    ranked = {}
    guarded = []
    for key, choices in by_family.items():
        scores = [(cfg, metrics(predict(v,cfg),v['y']).mean(0)) for cfg in choices]
        front = [entry for entry in scores if meets(entry[1],base)]
        if front:
            guarded.extend((key,cfg,result) for cfg,result in front)
        best = min(front or scores, key=lambda entry: entry[1][3])
        labels[key] = best[0]
        ranked[key] = {'trials':len(choices),'validation_pass':len(front)}
    if guarded:
        name, champion, _ = min(guarded,key=lambda entry:entry[2][3])
        labels['secili_aday'] = champion
    else:
        name = None
        labels['secili_aday'] = REFERENCES['ana']
    labels['lig_dogrulamali'] = select_by_league(valid, [cfg for group in by_family.values() for cfg in group])
    masks = {
        'validation': valid, 'final': test,
        **{str(year): [r for r in test if r['year']==year] for year in range(2023,2026)},
        **{league: [r for r in test if r['league']==league] for league in LEAGUES},
        **{f'{league}_{year}': [r for r in test if r['league']==league and r['year']==year]
           for league in LEAGUES for year in range(2023,2026)}
    }
    totals = {}
    for key, group in masks.items():
        d = sample(group)
        totals[key] = {name:report(scores) for name,scores in compare(d,labels).items()}
    testing = sample(test)
    pairs = compare(testing, {'ana':labels['ana'],'secili_aday':labels['secili_aday']})
    base_metrics=pairs['ana']; upgraded=pairs['secili_aday']
    # Two release gates. A 30% relative increase is stricter than non-regression.
    checked = []
    after = {}
    for label, setting in labels.items():
        if label in REFERENCES:
            continue
        allgroups = [values for key,values in totals.items() if key!='validation']
        gate = all(meets(
            np.array([results[label][k] for k in ('result','exact','top3','logLoss','brier')]),
            np.array([results['ana'][k] for k in ('result','exact','top3','logLoss','brier')]))
            for results in allgroups)
        goal = all(totals['final'][label][k]>=1.3*totals['final']['ana'][k] for k in ('result','exact','top3'))
        after[label] = {'no_regression_by_season_or_league':gate,'relative_plus_30':goal}
        if gate and goal:
            checked.append(label)
    # Audit the whole grid for the target after selection. No configuration is selected from these counts.
    control = report(base_metrics)
    thresholds = {k: int(np.ceil(control[k]*1.3)) for k in ('result','exact','top3')}
    grid_target_passes = 0
    for choices in by_family.values():
        for candidate in choices:
            measured = report(metrics(predict(testing,candidate),testing['y']))
            grid_target_passes += int(all(measured[k]>=value for k,value in thresholds.items()))
    print(json.dumps({
        'grid_target_passes':grid_target_passes,'target_count_thresholds':thresholds,
        'coverage': {'eligible':len(eligible),'engine_rows':len(records),'fit':len(train),'validation':len(valid),'test':len(test)},
        'family':ranked,'config':labels,'selected_family':name,'results':totals,'checks':after,'target_candidates':checked,
        'test_gain_interval_95':block_gain(base_metrics,upgraded,[r['date'] for r in test]),
        'source':'openplay (Noah Bair), data-v0.1.0, CC BY 4.0. Starting XI timestamp is unavailable.'
    }, indent=2))


if __name__=='__main__':
    main()
