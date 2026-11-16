"""Reconstruct post-2017/18 xG using a shot model frozen before the test seasons."""
import hashlib
import json
from pathlib import Path
import sys

import duckdb
import numpy as np
from scipy.optimize import minimize
from scipy.special import expit

from export import export

SHOT_HASH = '1b8f5750af5fcce93a1c4dc6b14026b5df6c038463fb792f2764e9b27478e4c5'
CUTOFF = '2018-07-01'


def strict_rows(directory):
    matches = export(directory)
    filename = directory / 'shots.parquet'
    if hashlib.sha256(filename.read_bytes()).hexdigest() != SHOT_HASH:
        raise ValueError('Wrong snapshot: shots.parquet')
    conn = duckdb.connect()
    conn.read_parquet(str(filename)).create_view('shots')
    s = conn.sql("""
        SELECT match_id,team_id,is_goal,is_penalty,is_header,is_set_piece,
               distance_m,visible_angle
        FROM shots
        WHERE comp IN ('eng','esp','fra','ger','ita')
          AND NOT is_own_goal AND NOT is_shootout AND NOT is_disallowed
          AND distance_m IS NOT NULL AND visible_angle IS NOT NULL
    """).fetchnumpy()
    dates = {r['id']:r['date'] for r in matches}
    valid = {r['id'] for r in matches if r['ok']}
    years = np.array([int(dates.get(int(match),'0000')[:4]) for match in s['match_id']])
    train_pool = {key for key in valid if dates[key]<CUTOFF}
    fit_mask = (np.isin(s['match_id'],list(train_pool))) & ~s['is_penalty']
    x = np.stack([np.ones(len(years)),np.log1p(s['distance_m']),s['visible_angle'],
                  s['is_header'].astype(float),s['is_set_piece'].astype(float)],axis=1)
    y = s['is_goal'].astype(float)
    fit_x, fit_y = x[fit_mask],y[fit_mask]
    pen_mask = np.isin(s['match_id'],list(train_pool)) & s['is_penalty']
    penalty_prob = float(y[pen_mask].mean())

    def objective(beta):
        z = fit_x@beta
        return (np.logaddexp(0,z)-fit_y*z).mean()+.0005*(beta@beta), (
            fit_x.T@(expit(z)-fit_y)/len(z)+.001*beta
        )

    fitted = minimize(objective,np.zeros(x.shape[1]),method='L-BFGS-B',jac=True)
    if not fitted.success:
        raise ValueError(fitted.message)
    probs = np.where(s['is_penalty'],penalty_prob,expit(x@fitted.x))
    totals = {}
    for match,team,p in zip(s['match_id'],s['team_id'],probs,strict=True):
        key = (int(match),int(team))
        totals[key] = totals.get(key,0.)+float(p)
    for row in matches:
        if row['date']<CUTOFF:
            row['xh'] = row['xa'] = None
        else:
            row['xh'] = totals.get((row['id'],row['h']),0.)
            row['xa'] = totals.get((row['id'],row['a']),0.)
    meta = {'trained_before':CUTOFF,'shots_without_penalty':int(fit_mask.sum()),
            'penalties':int(pen_mask.sum()),'penalty_probability':penalty_prob,'coefficients':fitted.x.tolist()}
    return matches,meta


if __name__=='__main__':
    records,meta = strict_rows(Path(sys.argv[1]))
    json.dump(records,sys.stdout,allow_nan=False,separators=(',',':'))
    print(json.dumps(meta),file=sys.stderr)
