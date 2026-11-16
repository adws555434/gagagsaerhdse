"""Extract only Süper Lig past-match data for local research."""
import hashlib
import json
from pathlib import Path
import sys
import duckdb

ROOT = Path(sys.argv[1])
HASHES = {
    'fixtures': '7ba90661dbed29eb940daf5ea385c7d76d5751d16be86bd9063293a982abc7b7',
    'match_stats': '2fb85b14b4428e1a36efe6d651de4ca8f7a6169ecfa3edb9cda49cb5e58d97e9',
    'teams': '5529282b37ad51437142dd7c6d32fb60bbbdd56953dc432e3b9247dca17a2fa5',
    'fixture_lineups': 'dcd9181f54df52193877ffd8a41b5d1097b404eb46b4890069c0e4d1c8c13abd',
}
db = duckdb.connect()
for key, digest in HASHES.items():
    path = ROOT / (key + '.parquet')
    if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
        raise ValueError(f'Invalid snapshot: {key}')
    db.read_parquet(str(path)).create_view(key)

def utc(column):
    return f"strftime({column},'%Y-%m-%dT%H:%M:%SZ')"
fields = ['shots_on_goal','shots_total','shots_inside_box','shots_outside_box','xg','red_cards','possession']
stats = ', '.join(f's.{side}_{field}' for field in fields for side in ('home','away'))
query = db.sql(f"""
    WITH lineup AS (
        SELECT fixture_id FROM fixture_lineups
        WHERE formation IS NOT NULL
        GROUP BY fixture_id HAVING count(distinct team_id)=2
    )
    SELECT f.id, {utc('f.date_utc')} kickoff, {utc('s.known_at')} known,
        home.name home, away.name away, f.goals_home h, f.goals_away a,
        CASE WHEN l.fixture_id IS NULL THEN false ELSE true END formations, {stats}
    FROM fixtures f
    JOIN teams home ON home.id=f.home_team_id
    JOIN teams away ON away.id=f.away_team_id
    JOIN match_stats s ON s.fixture_id=f.id
    LEFT JOIN lineup l ON l.fixture_id=f.id
    WHERE f.league_id=16 AND f.status_norm='FT' AND f.is_played AND f.goals_home>=0 AND f.goals_away>=0
    ORDER BY f.date_utc,f.id
""")
rows = [dict(zip(query.columns,row,strict=True)) for row in query.fetchall()]
json.dump(rows, sys.stdout, allow_nan=False, separators=(',', ':'))
