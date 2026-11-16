"""Verify the openplay release files, then export five leagues for model research."""
import csv
import hashlib
import json
from pathlib import Path
import sys

import duckdb

HASHES = {
    "matches.parquet": "99017d55a38c1c03eda15ffc500e23be7c6e5a380839809732f48e531f8526ac",
    "team_match_stats.parquet": "7529b1c4890819ed868978cd54d40f66aca913481850211e96e074b432919803",
    "lineups.parquet": "696dbf1cae092803894c5f2298c60bca6fb9eaaa6cb1c0e843b115121c39db76",
    "data_issues.csv": "d2e61f67a60547b1fd47d35f1bac9282a591fa63d4a189b6f8b81e388b2dced3",
}


def export(directory):
    for name, expected in HASHES.items():
        actual = hashlib.sha256((directory / name).read_bytes()).hexdigest()
        if actual != expected:
            raise ValueError(f"Wrong snapshot: {name}")
    with (directory / 'data_issues.csv').open(newline='', encoding='utf-8') as source:
        flagged = {int(row['match_id']) for row in csv.DictReader(source)}
    conn = duckdb.connect()
    for name in ['matches', 'team_match_stats', 'lineups']:
        conn.read_parquet(str(directory / (name + '.parquet'))).create_view(name)
    rows = conn.sql("""
        WITH squads AS (
            SELECT match_id, team_id, list(player_id ORDER BY player_id)
                FILTER (WHERE is_starter) AS starters
            FROM lineups
            WHERE comp IN ('eng', 'esp', 'fra', 'ger', 'ita')
            GROUP BY match_id, team_id
        )
        SELECT m.comp, m.season, strftime(m.date, '%Y-%m-%d') date, m.match_id,
            m.home_team_id h, m.away_team_id a, m.home_score_90 gh, m.away_score_90 ga,
            ht.xg xh, away_stats.xg xa, hs.starters sh, ast.starters sa
        FROM matches m
        LEFT JOIN team_match_stats ht ON m.match_id=ht.match_id AND ht.team_id=m.home_team_id
        LEFT JOIN team_match_stats away_stats ON m.match_id=away_stats.match_id AND away_stats.team_id=m.away_team_id
        LEFT JOIN squads hs ON m.match_id=hs.match_id AND hs.team_id=m.home_team_id
        LEFT JOIN squads ast ON m.match_id=ast.match_id AND ast.team_id=m.away_team_id
        WHERE m.comp IN ('eng', 'esp', 'fra', 'ger', 'ita')
            AND m.status_code=6 AND NOT m.extra_time AND NOT m.penalty_shootout
        ORDER BY m.date, m.comp, m.match_id
    """).fetchall()
    keys = 'league season date id h a gh ga xh xa sh sa'.split()
    records = [dict(zip(keys, row, strict=True)) for row in rows]
    assert len({record['id'] for record in records}) == len(records)
    for record in records:
        record['ok'] = record['id'] not in flagged
    return records


if __name__ == '__main__':
    json.dump(export(Path(sys.argv[1])), sys.stdout, allow_nan=False, separators=(',', ':'))
