"""Compare additional Süper Lig pre-match signals on a fixed chronological split."""
from itertools import product
import json
from pathlib import Path
import sys

import numpy as np
from scipy.optimize import minimize

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'accuracy-research'))
from scan import grid, metrics, report, meets, block_gain

SIGNALS = ['isabetli_sut', 'ceza_sahasi_ici_sut', 'bolge_gol_tahmini']
WINDOWS = [90,180,360]
KEYS = ['result','exact','top3','logLoss','brier']


def key(row):
    return tuple(row[x] for x in ('date','home','away'))


def setup(rows, augmented):
    # Keep a fixed array of 2-rate input pairs; NaN means an unavailable signal.
    actual = np.array([[r['h'],r['a']] for r in rows])
    base = np.array([r['live'] for r in rows])
    signals = np.full((len(rows),3,3,2),np.nan)
    for i,row in enumerate(rows):
        for j,values in enumerate(augmented.get(key(row),{}).get('signals') or [None]*3):
            if values is not None:
                signals[i,j] = values
    return actual,base,signals


def features(data, channels, window):
    actual,base,extra = data
    columns = [np.ones(base.shape),np.broadcast_to(np.array([0,1]),base.shape),np.log(base)]
    available = np.ones(len(base),dtype=bool)
    for channel in channels:
        signal = extra[:,channel,window,:]
        covered = np.isfinite(signal).all(axis=1)
        available &= covered
        columns.append(np.log(np.where(covered[:,None],signal,base)))
    return np.stack(columns,axis=2),available


def fit(data, channels, window, penalty):
    observed,_,_ = data
    x, covered = features(data,channels,window)
    x=x[covered].reshape(-1,x.shape[2])
    y=observed[covered].ravel()
    assert len(y)>200
    prior=np.array([0.,0.,.6]+[.4/len(channels)]*len(channels))
    def loss(b):
        log_rates=x@b
        rates=np.exp(log_rates)
        drift=b-prior
        return (rates-y*log_rates).mean()+penalty*(drift@drift)/2, x.T@(rates-y)/len(y)+penalty*drift
    result=minimize(loss,prior,jac=True,method='L-BFGS-B')
    if not result.success:
        raise ValueError(result.message)
    return result.x.tolist()


def predict(data,cfg):
    y,base,extra=data
    if cfg['kind']=='ana':
        return metrics(grid(base),y)
    channels=cfg['channels']
    window=cfg['window']
    x,covered=features(data,channels,window)
    if cfg['kind']=='karisim':
        added=extra[:,channels[0],window,:]
        rates=base*(1-cfg['weight'])+added*cfg['weight']
    else:
        rates=np.exp(x@cfg['coeff'])
    rates=np.clip(np.where(covered[:,None],rates,base),.08,6.)
    forecasts=grid(rates,cfg['rho'])
    forecasts[~covered]=grid(base[~covered])
    return metrics(forecasts,y)


def space(train):
    for channel,window,weight,rho in product(range(3),range(3),[.15,.30,.50,.75,1.],[-.04,0.]):
        yield dict(kind='karisim', channels=[channel],window=window,weight=weight,rho=rho)
    for channels,window,penalty in product([[0],[1],[2],[0,1],[0,1,2]],range(3),[.02,.10]):
        coeff=fit(train,channels,window,penalty)
        for rho in [-.04,0.]:
            yield dict(kind='uyarlanmis',channels=channels,window=window,penalty=penalty,rho=rho,coeff=coeff)


def main():
    research=json.loads(Path(sys.argv[1]).read_text())
    augmented={key(row):row for row in research['features']}
    rows=json.loads(Path(sys.argv[2]).read_text())['features']
    train=[r for r in rows if 2016<=r['year']<=2021]
    valid=[r for r in rows if 2022<=r['year']<=2023]
    test=[r for r in rows if r['year']>=2024]
    assert max(r['date'] for r in train)<min(r['date'] for r in valid)
    assert max(r['date'] for r in valid)<min(r['date'] for r in test)
    assert len(test)==606
    control={'kind':'ana'}
    v=setup(valid,augmented)
    base=predict(v,control).mean(0)
    trials=list(space(setup(train,augmented)))
    settings=[(c,predict(v,c).mean(0)) for c in trials]
    accepted=[entry for entry in settings if meets(entry[1],base)]
    options={'ana':control, 'secili':min(accepted or settings,key=lambda x:x[1][3])[0]}
    for i,signal in enumerate(SIGNALS):
        subset=[entry for entry in settings if entry[0]['channels']==[i]]
        options[signal]=min(subset,key=lambda x:x[1][3])[0]
    results={}
    groups={'validation':valid,'final':test}
    for year in (2024,2025,2026):
        groups[str(year)]=[r for r in test if r['year']==year]
    for name,group in groups.items():
        d=setup(group,augmented)
        results[name]={label:report(predict(d,cfg)) for label,cfg in options.items()}
    g=setup(test,augmented)
    labels=results['final']['ana']
    selected=options['secili']
    targets=[int(np.ceil(labels[k]*1.3)) for k in KEYS[:3]]
    audit=0
    for cfg in trials:
        reached=(predict(g,cfg)[:,:3].sum(0)>=targets).all()
        audit+=int(reached)
    decision={label:all(meets(
        np.array([block[label][k] for k in KEYS]),np.array([block['ana'][k] for k in KEYS])
        ) for name,block in results.items() if name!='validation') for label in options if label!='ana'}
    output={'snapshot_coverage':research['coverage'],'train':len(train),'validation':len(valid),'test':len(test),
            'test_matches_with_signal':sum(key(r) in augmented for r in test),'trials':len(trials),'validation_passes':len(accepted),'parameters':options,
            'holdout_30_percent_passes':audit,'holdout_no_regression_by_season':decision,
            'results':results,'paired_95_delta':block_gain(predict(g,control),predict(g,selected),[r['date'] for r in test])}
    print(json.dumps(output,indent=2))


if __name__ == '__main__':
    main()
