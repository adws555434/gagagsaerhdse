"""Walk-forward feature evaluation with a fixed chronological model-selection split."""
import itertools
import json
import sys
from pathlib import Path

import numpy as np
from scipy.optimize import minimize

SIDE = 20
SCORE_H, SCORE_A = np.indices((SIDE, SIDE))
OUTCOME_MASK = (SCORE_H > SCORE_A, SCORE_H == SCORE_A, SCORE_H < SCORE_A)


def poisson(rate):
    p = np.empty((len(rate), SIDE))
    p[:, 0] = np.exp(-rate)
    for i in range(1, SIDE):
        p[:, i] = p[:, i-1] * rate/i
    return p


def grid(rates, rho=0., shared=0., dispersion=0.):
    if shared:
        common = np.minimum(np.min(rates, axis=1)*.5, shared)
        rates = rates-common[:, None]
    h, a = rates.T
    if dispersion:
        def negbin(rate):
            t = 1/dispersion
            p = np.empty((len(rate), SIDE))
            p[:, 0] = (1+rate/t)**(-t)
            for i in range(1, SIDE):
                p[:, i] = p[:, i-1]*(t+i-1)/i*rate/(rate+t)
            return p
        hp, ap = negbin(h), negbin(a)
    else:
        hp, ap = poisson(h), poisson(a)
    pred = hp[:, :, None]*ap[:, None, :]
    if shared:
        independent = pred.copy()
        q = poisson(common)
        pred *= q[:, 0, None, None]
        for offset in range(1, SIDE):
            pred[:, offset:, offset:] += independent[:, :-offset, :-offset]*q[:, offset, None, None]
    if rho:
        delta = hp[:, 1] * ap[:, 1] * rho
        pred[:, 0, 0] -= delta
        pred[:, 1, 1] -= delta
        pred[:, 1, 0] += delta
        pred[:, 0, 1] += delta
    if np.any(pred < 0):
        raise ValueError("Negative forecast cell")
    return pred / pred.sum((1, 2), keepdims=True)


def data(rows):
    return {
        'rows': rows,
        'y': np.array([(row['h'], row['a']) for row in rows]),
        'live': np.array([row['live'] for row in rows]),
        'past': np.array([row['past'] or row['live'] for row in rows]),
        'archive': np.array([row['past'] is not None for row in rows]),
        'balanced': np.array([row['balanced'] for row in rows]),
        'strengths': np.array([row['strengths'] for row in rows]),
        'shots': np.array([row['shots'] or row['live'] for row in rows]),
        'extra': np.array([[row['elo']/400, row['eloAll']/400, row['rest']/7, row['load']/4] for row in rows]),
    }


def metrics(pred, actual):
    h, a = actual.T
    ix = np.arange(len(actual))
    outcomes = np.stack([pred[:, mask].sum(1) for mask in OUTCOME_MASK], axis=1)
    label = np.where(h > a, 0, np.where(h == a, 1, 2))
    cells = pred.reshape(len(actual), SIDE*SIDE)
    score = h*SIDE+a
    strongest = cells.argmax(1)
    top = np.argsort(-cells, axis=1, kind='stable')[:, :3]
    correct = outcomes.argmax(1) == label
    exact = strongest == score
    top3 = (top == score[:, None]).any(1)
    log = -np.log(np.maximum(1e-12, outcomes[ix, label]))
    brier = ((outcomes-np.eye(3)[label])**2).sum(1)
    score_loss = -np.log(np.maximum(1e-12, cells[ix, score]))
    return np.stack([correct, exact, top3, log, brier, score_loss], axis=1)


def report(result):
    return dict(zip(['n', 'result', 'exact', 'top3', 'logLoss', 'brier', 'scoreLoss'],
        [len(result), *result[:, :3].sum(0).astype(int).tolist(), *result[:, 3:].mean(0).tolist()]))


def contextual(d, set_id):
    left = np.log(d['live'])
    middle = np.log(d['past'])
    right = np.log(d['strengths'][:, set_id])
    all_rows = []
    for side in range(2):
        sign = 1-2*side
        v = [np.ones(len(left)), np.full(len(left), side), left[:,side], middle[:,side], right[:,side],
            sign*d['extra'][:,0], sign*d['extra'][:,1], sign*d['extra'][:,2], sign*d['extra'][:,3]]
        all_rows.append(np.stack(v, axis=1))
    return np.stack(all_rows, axis=1)


def league_context(d, idx):
    features = contextual(d, idx)
    labels = ('tr.1', 'en.1', 'es.1', 'de.1', 'it.1', 'fr.1')
    league = np.array([[row['code'] == label for label in labels] for row in d['rows']])
    home = np.stack([league, league], axis=1)
    away = np.stack([np.zeros_like(league), league], axis=1)
    return np.concatenate([features, home, away], axis=2)


def fit_context(d, idx, ridge, by_league=False):
    raw = league_context(d, idx) if by_league else contextual(d, idx)
    x = raw.reshape(-1, raw.shape[2])
    y = d['y'].ravel()
    prior = np.zeros(x.shape[1])
    prior[2:5] = [.4, .3, .3]
    def loss(p):
        z = x@p
        mu = np.exp(z)
        diff = p-prior
        return (mu-y*z).mean()+ridge*(diff@diff)/2, x.T@(mu-y)/len(y)+ridge*diff
    fit = minimize(loss, prior, jac=True, method='L-BFGS-B')
    if not fit.success:
        raise ValueError(str(fit.message))
    return fit.x.tolist()


def candidates(train):
    settings = []
    for window, weight, rho, scale in itertools.product(range(5), [.25,.50,.75,1], [-.08,-.03,.02], [.95,1,1.07]):
        settings.append(dict(kind='decay', window=window, weight=weight, rho=rho, scale=scale))
    for weight, shared, scale in itertools.product([0,.4,.7,1], [.05,.12,.25], [.97,1.03,1.08]):
        settings.append(dict(kind='correlated', weight=weight, shared=shared, scale=scale))
    for weight, disp, scale in itertools.product([0,.4,.7,1], [.025,.06,.12], [1,1.06]):
        settings.append(dict(kind='overdispersion', weight=weight, dispersion=disp, scale=scale))
    for weight, scale, tilt, rho in itertools.product([.2,.5,.8], [1,1.06,1.12], [-.04,0,.04], [-.06,0,.04]):
        settings.append(dict(kind='pooled-rates', weight=weight, scale=scale, tilt=tilt, rho=rho))
    for window, penalty in itertools.product([0,2,4], [.002,.015,.06]):
        coeff = fit_context(train, window, penalty)
        for mix, rho in itertools.product([.35,.7,1], [-.06,0,.035]):
            settings.append(dict(kind='context',window=window,penalty=penalty,coeff=coeff,mix=mix,rho=rho))
    return settings


def predict(d, cfg):
    kind = cfg['kind']
    if kind == 'live':
        return grid(d['live'])
    if kind == 'past':
        return np.where(d['archive'][:,None,None],grid(d['past'], rho=-.04),grid(d['live']))
    if kind == 'balanced':
        pred=grid(d['live'])
        pred[:,:10,:10] = d['balanced'].reshape(-1,10,10)
        return pred/pred.sum((1,2),keepdims=True)
    if kind in ('context','league-context'):
        features = league_context(d,cfg['window']) if kind == 'league-context' else contextual(d,cfg['window'])
        mean = np.clip(np.exp(features@cfg['coeff']),.08,6)
        rates = d['live']*(1-cfg['mix'])+mean*cfg['mix']
    elif kind == 'shots':
        rates = (1-cfg['weight'])*d['live']+cfg['weight']*d['shots']
    else:
        other = d['strengths'][:,cfg['window']] if kind == 'decay' else d['past']
        weight = cfg['weight']
        rates = (1-weight)*d['live']+weight*other
    scale,tilt = cfg.get('scale',1),cfg.get('tilt',0)
    rates = np.clip(rates*scale*np.exp(np.array([tilt,-tilt])), .08, 6)
    return grid(rates,rho=cfg.get('rho',0),shared=cfg.get('shared',0),dispersion=cfg.get('dispersion',0))


def value(result):
    rates = result.mean(0)
    return rates[0]*.45+rates[1]*.2+rates[2]*.2-rates[3]*.10-rates[4]*.05


def meets(new, old):
    return bool((new[:3] >= old[:3]).all() and (new[3:5] <= old[3:5]+1e-12).all())


def block_gain(base, best, dates):
    rng=np.random.default_rng(20261116)
    weeks=np.array([np.datetime64(date,'D').astype(int)//7 for date in dates])
    bins=np.unique(weeks,return_inverse=True)[1]
    blocks=np.zeros((bins.max()+1,3))
    totals=np.bincount(bins)
    np.add.at(blocks,bins,best[:,:3]-base[:,:3])
    sample=rng.integers(len(totals),size=(1500,len(totals)))
    diff=blocks[sample].sum(1)/totals[sample].sum(1)[:,None]
    return np.quantile(diff,[.025,.975],axis=0).T.tolist()


def main():
    source=Path(sys.argv[1])
    rows=json.loads(source.read_text())
    train=[row for row in rows if 2016<=row['year']<=2022]
    tune=[row for row in rows if row['year']==2023]
    test=[row for row in rows if row['year']>=2024]
    assert train and tune and test
    assert max(r['date'] for r in train)<min(r['date'] for r in tune)
    assert max(r['date'] for r in tune)<min(r['date'] for r in test)
    trial=candidates(data(train))
    dev=data(tune)
    base=metrics(predict(dev,{'kind':'live'}),dev['y'])
    evaluations=[]
    for cfg in trial:
        scores=metrics(predict(dev,cfg),dev['y'])
        evaluations.append((cfg,scores))
    eligible=[(cfg,scores) for cfg,scores in evaluations if meets(scores.mean(0),base.mean(0))]
    winner=max(eligible or evaluations,key=lambda c:value(c[1]))
    ll=min(evaluations,key=lambda c:c[1][:,3].mean())
    shots={'kind':'shots','weight':.15}
    league_trials=[]
    training=data(train)
    for window, penalty in itertools.product([0,2,4],[.015,.06]):
        coeff=fit_context(training,window,penalty,by_league=True)
        for rho in [-.06,0]:
            cfg=dict(kind='league-context',window=window,penalty=penalty,coeff=coeff,mix=1,rho=rho)
            league_trials.append((cfg,metrics(predict(dev,cfg),dev['y'])))
    league_best=min(league_trials,key=lambda c:c[1][:,3].mean())
    selected={'live':{'kind':'live'},'archive':{'kind':'past'},'balanced':{'kind':'balanced'},
              'best_compromise':winner[0],'lowest_validation_log_loss':ll[0],'league_context':league_best[0],'shots_15':shots}
    groups={'validation_2023':tune,'locked_test':test}
    for year in range(2024,2027):
        groups[str(year)]=[r for r in test if r['year']==year]
    groups['turkey_locked']=[r for r in test if r['code']=='tr.1']
    groups['turkey_2026']=[r for r in test if r['code']=='tr.1' and r['year']==2026]
    results={}
    for group,fixtures in groups.items():
        d=data(fixtures)
        results[group]={name:report(metrics(predict(d,cfg),d['y'])) for name,cfg in selected.items()}
    d=data(test)
    interval={}
    for name in ['best_compromise','lowest_validation_log_loss']:
        interval[name]=block_gain(metrics(predict(d,selected['live']),d['y']),
            metrics(predict(d,selected[name]),d['y']),[r['date'] for r in test])
    confidence=[]
    pred=predict(d,selected['lowest_validation_log_loss'])
    outcomes=np.stack([pred[:,mask].sum(1) for mask in OUTCOME_MASK],axis=1)
    scored=metrics(pred,d['y'])
    for cutoff in [.50,.55,.60,.65,.70]:
        keep=outcomes.max(1)>=cutoff
        if keep.any():
            confidence.append({'cutoff':cutoff,'coverage':float(keep.mean()),**report(scored[keep])})
    coverage={}
    for name,cfg in selected.items():
        if name in ['live','archive','balanced','shots_15']:
            continue
        rows_t=[r for r in test if r['code']=='tr.1']
        base_t=data(rows_t)
        coverage[name]=meets(metrics(predict(base_t,cfg),base_t['y']).mean(0),metrics(predict(base_t,selected['live']),base_t['y']).mean(0))
    print(json.dumps({'counts':{'train':len(train),'validation':len(tune),'locked':len(test),'candidates':len(trial),'league_candidates':len(league_trials),'eligible_validation':len(eligible)},
        'selected':selected,'results':results,'turkey_all_metrics_pass':coverage,'locked_gain_interval_95':interval,'confidence_subsets':confidence},indent=2))


if __name__=='__main__':
    main()
