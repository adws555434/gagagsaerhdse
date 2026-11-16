"""Extract validated exposure and goal counts to a local scratch file."""
import collections
import hashlib
import json
import sqlite3
import sys

GOALS = {"Goal", "Penalty Goal", "Own Goal"}
REDS = {"Red Card", "Second Yellow Card"}


def observed(match, events):
    if not events or any(e[0] is None or not 0 <= e[0] <= 90 for e in events):
        return None
    first = max([2, *(e[1] or 0 for e in events if e[0] == 45)])
    second = max([5, *(e[1] or 0 for e in events if e[0] == 90)])
    exposure = collections.defaultdict(lambda: [0.0, 0])
    score = [0, 0]
    red = [False, False]
    last = 0.0

    def key(side, segment):
        diff = score[side] - score[1 - side]
        return (side, segment, (diff > 0) - (diff < 0), int(red[side]), int(red[1 - side]))

    def add_time(end):
        nonlocal last
        for segment in range(6):
            left = max(last, segment / 6)
            right = min(end, (segment + 1) / 6)
            if right > left:
                for side in range(2):
                    exposure[key(side, segment)][0] += right - left
        last = end

    first_reds = 0
    for base, extra, side, kind, before_h, before_a, after_h, after_a in events:
        if kind not in GOALS and kind not in REDS:
            continue
        minute = base + (extra or 0) - 0.5
        if base <= 45:
            when = max(0, min(0.5, minute / (2 * (45 + first))))
        else:
            when = 0.5 + min(0.5, (minute - 45) / (2 * (45 + second)))
        add_time(when)
        if kind in GOALS:
            if score != [before_h, before_a] or after_h is None or after_a is None:
                return None
            delta = [after_h - before_h, after_a - before_a]
            if delta not in ([1, 0], [0, 1]):
                return None
            scorer = delta.index(1)
            exposure[key(scorer, min(5, int(when * 6)))][1] += 1
            score[:] = [after_h, after_a]
        else:
            if side not in ("Home", "Away"):
                return None
            team = int(side == "Away")
            if not red[team]:
                first_reds += 1
            red[team] = True
    add_time(1)
    if score != list(match[4:]):
        return None
    eligible = sum(minutes for key, (minutes, _) in exposure.items() if not key[3])
    return [*match[1:], first_reds, eligible, [[*key, duration, n] for key, (duration, n) in exposure.items()]]


def main(path, output):
    with sqlite3.connect(f"file:{path}?mode=ro", uri=True) as db:
        matches = db.execute("""SELECT id,date,home_team,away_team,home_score,away_score
                                 FROM matches ORDER BY date,id""").fetchall()
        events = collections.defaultdict(list)
        for match, *event in db.execute("""
            SELECT match_id,minute_base,minute_extra,team,event_type,home_score_before,
                   away_score_before,home_score_after,away_score_after
            FROM events ORDER BY match_id,minute_base,minute_extra,event_order
        """):
            events[match].append(event)
    records = [row for m in matches if (row := observed(m, events[m[0]])) is not None]
    with open(path, "rb") as source:
        sha = hashlib.file_digest(source, "sha256").hexdigest()
    with open(output, "w", encoding="utf-8") as target:
        json.dump({"sha": sha, "sourceMatches": len(matches), "matches": records}, target)
    print(json.dumps({"sourceMatches": len(matches), "completeMatches": len(records), "sha": sha}))


if __name__ == "__main__":
    main(*sys.argv[1:])
