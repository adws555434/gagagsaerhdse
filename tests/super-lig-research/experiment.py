"""Süper Lig point-in-time model selection and later-season comparison."""
import itertools
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'accuracy-research'))
from scan import data, predict, fit_context, metrics, report, meets, block_gain


CONTROL = {'kind': 'live'}
REFERENCES = {'ana': CONTROL, 'arsiv': {'kind': 'past'}, 'dengeli': {'kind': 'balanced'}}
MEASURES = ('result', 'exact', 'top3')


def search_space(train):
    for window, weight, rho, scale in itertools.product(
        range(5), [.25,.50,.75,1], [-.10,-.06,-.025,.02], [.96,1,1.05,1.10]
    ):
        yield dict(kind='decay', window=window, weight=weight, rho=rho, scale=scale)
    for weight, rho, scale, tilt in itertools.product(
        [.2,.5,.8,1], [-.08,-.035,0,.04], [.96,1,1.06,1.12], [-.04,0,.04]
    ):
        yield dict(kind='pooled-rates', weight=weight, scale=scale, tilt=tilt, rho=rho)
    for weight, shared, scale in itertools.product([0,.4,.7,1], [.05,.12,.25], [.97,1.03,1.08]):
        yield dict(kind='correlated', weight=weight, shared=shared, scale=scale)
    for weight, disp, scale in itertools.product([0,.4,.7,1], [.025,.06,.12], [1,1.06]):
        yield dict(kind='overdispersion', weight=weight, dispersion=disp, scale=scale)
    for window, penalty in itertools.product(range(5), [.003,.025,.10]):
        coeff = fit_context(train, window, penalty)
        for mix, rho in itertools.product([.50,.75,1], [-.075,-.04,0,.04]):
            yield dict(kind='context', window=window, penalty=penalty, coeff=coeff, mix=mix, rho=rho)


def run(ds, cfg):
    forecast = predict(ds, cfg)
    assert np.allclose(forecast.sum((1,2)), 1)
    return metrics(forecast, ds['y'])


def validation_candidate(validation, control, trials):
    results = [(cfg, run(validation, cfg).mean(0)) for cfg in trials]
    passing = [(cfg, score) for cfg, score in results if meets(score, control)]
    best_loss, _ = min(results, key=lambda item: item[1][3])
    best_all = min(passing, key=lambda item: item[1][3])[0] if passing else CONTROL
    return best_loss, best_all, len(passing)


def compare(sample, configurations):
    d = data(sample)
    return {name: report(run(d, cfg)) for name, cfg in configurations.items()}


def bootstrap_ci(rows, active):
    ds = data(rows)
    return block_gain(run(ds, CONTROL), run(ds, active), [row['date'] for row in rows])


def main():
    source = json.loads(Path(sys.argv[1]).read_text())
    rows = source['features']
    train = [row for row in rows if row['year']<=2021]
    validate = [row for row in rows if 2022<=row['year']<=2023]
    test = [row for row in rows if row['year']>=2024]
    assert max(row['date'] for row in train)<min(row['date'] for row in validate)
    assert max(row['date'] for row in validate)<min(row['date'] for row in test)
    assert len({(row['date'],row['home'],row['away']) for row in rows})==len(rows)
    trials = list(search_space(data(train)))
    validation = data(validate)
    lowest, selected, passes = validation_candidate(validation, run(validation, CONTROL).mean(0), trials)
    configs = {**REFERENCES, 'secili_aday': selected, 'en_dusuk_log_loss': lowest}
    groups = {'validation':validate,'final':test,**{str(year):[row for row in test if row['year']==year] for year in (2024,2025,2026)}}
    results = {key:compare(group,configs) for key, group in groups.items()}
    reference = results['final']['ana']
    targets = {key:int(np.ceil(1.30*reference[key])) for key in MEASURES}
    test_data = data(test)
    deltas = {'result':0,'exact':0,'top3':0}
    all_targets = 0
    for cfg in trials:
        counts = report(run(test_data,cfg))
        for measure in MEASURES:
            deltas[measure] += int(counts[measure]>=targets[measure])
        all_targets += int(all(counts[key]>=value for key,value in targets.items()))
    checks = {
        name:{
            'overall_plus30':all(results['final'][name][key]>=value for key,value in targets.items()),
            'no_regression_by_season':all(meets(
                np.array([group[name][key] for key in (*MEASURES,'logLoss','brier')]),
                np.array([group['ana'][key] for key in (*MEASURES,'logLoss','brier')]))
                for key,group in results.items() if key not in ('validation',)),
        }
        for name in ('secili_aday','en_dusuk_log_loss')
    }
    print(json.dumps({
        'source_matches_per_season':source['coverage'], 'source_overlap':source['audit'],
        'fit_matches':len(train),'validation_matches':len(validate),'test_matches':len(test),
        'configurations_tried':len(trials),'validation_no_regression_count':passes,
        'target_count_thresholds':targets,'individual_target_passes':deltas,'all_target_passes':all_targets,
        'configuration':configs,'results':results,'checks':checks,
        'selected_gain_interval_95':bootstrap_ci(test, selected),
    },indent=2))


if __name__=='__main__':
    main()
