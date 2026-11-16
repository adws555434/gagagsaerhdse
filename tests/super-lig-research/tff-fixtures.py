"""Read completed fixture rows from the federation's 34 saved matchweek pages."""
from collections import Counter
from datetime import datetime
import hashlib
from html import unescape
import json
from pathlib import Path
import re
import sys

CLUBS = {
    '3672': 'Gaziantep', '3604': 'Galatasaray', '52': 'Antalyaspor', '39': 'Kasimpasa',
    '3597': 'Samsunspor', '3606': 'Genclerbirligi', '3610': 'Eyupspor', '3600': 'Konyaspor',
    '3631': 'Caykur Rizespor', '3688': 'Goztepe', '3590': 'Besiktas', '51': 'Alanyaspor',
    '3592': 'Fenerbahce', '3611': 'Fatih Karagumruk', '132': 'Kocaelispor',
    '3596': 'Trabzonspor', '3665': 'Basaksehir', '72': 'Kayserispor',
}
def field(pattern, text):
    result = re.search(pattern,text,re.I)
    if result is None:
        raise ValueError(pattern)
    return unescape(result.group(1).strip())

def parse(root):
    expected = {}
    all_matches = []
    for week in range(1,35):
        source = root/f'{week}.html'
        raw = source.read_bytes()
        h = raw.decode('cp1254',errors='replace')
        hashes = dict(week=week, sha256='')
        expected[week] = hashes
        entries = re.findall(r'<tr class="haftaninMaclariTr"[^>]*>(.*?)</tr>',h,re.S|re.I)
        if len(entries)!=9:
            raise ValueError(f'Week {week}: {len(entries)}')
        extracted = []
        match_ids = {int(m) for m in re.findall(r'macId=(\d+)',h[h.index('fiksturListesiTable'):])}
        for row in entries:
            date = datetime.strptime(field(r'_lblTarih">([^<]+)',row),'%d.%m.%Y').date().isoformat()
            if not '2025-08-08'<=date<='2026-05-18':
                raise ValueError(date)
            home, away = re.findall(r'kulupID=(\d+)',row,re.I)
            match = int(field(r'macId=(\d+)',row))
            score = [int(field(r'_Label5">([^<]+)',row)),int(field(r'_Label6">([^<]+)',row))]
            if match not in match_ids:
                raise ValueError(f'Match {match} is missing from the season grid')
            extracted.append({'week':week,'date':date,'match':match,'home':CLUBS[home],'away':CLUBS[away],'score':score})
        hashes['sha256'] = hashlib.sha256(json.dumps(extracted,sort_keys=True,separators=(',',':')).encode()).hexdigest()
        all_matches.extend(extracted)
    assert len(set(row['match'] for row in all_matches))==306
    assert set(Counter(row['home'] for row in all_matches).values())=={17}
    assert set(Counter(row['away'] for row in all_matches).values())=={17}
    return all_matches, list(expected.values())

if __name__=='__main__':
    records, manifest = parse(Path(sys.argv[1]))
    json.dump({'matches':records, 'sources':manifest},sys.stdout,indent=2)
    print()
