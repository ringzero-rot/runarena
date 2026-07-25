# -*- coding: utf-8 -*-
"""
Deep discovery: list every NAMED park/garden/recreation area in Greater Bangkok
from OpenStreetMap, with its real name, OSM id/type, bbox and approximate size.
This is what lets us match each running venue to the CORRECT element by name
(so 'สวนรถไฟ' gets Wachirabenchathat's polygon, not Chatuchak's).
"""
import urllib.request, urllib.parse, json, math, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
UA = {'User-Agent': 'RunArena/1.0 (route builder; cjeekhao@gmail.com)'}
OVERPASS = 'https://overpass-api.de/api/interpreter'

def overpass(q):
    data = urllib.parse.urlencode({'data': q}).encode()
    req = urllib.request.Request(OVERPASS, data=data, headers=UA)
    return json.load(urllib.request.urlopen(req, timeout=120))

# Greater Bangkok bbox (S,W,N,E)
S, W, N, E = 13.55, 100.33, 13.98, 100.75
sel = '["leisure"~"park|garden|nature_reserve|recreation_ground|pitch"]["name"]'
q = f'''[out:json][timeout:110];
(
  way{sel}({S},{W},{N},{E});
  relation{sel}({S},{W},{N},{E});
);
out tags bb;'''

d = overpass(q)

def size_km(bb):
    R = 6371.0
    dlat = math.radians(bb['maxlat']-bb['minlat'])
    dlon = math.radians(bb['maxlon']-bb['minlon'])
    la = math.radians((bb['maxlat']+bb['minlat'])/2)
    return R*dlat, R*dlon*math.cos(la)  # approx height,width km

rows = []
for el in d.get('elements', []):
    bb = el.get('bounds')
    if not bb:
        continue
    name = el.get('tags', {}).get('name', '')
    leisure = el.get('tags', {}).get('leisure', '')
    h, w = size_km(bb)
    diag = math.hypot(h, w)
    cy = (bb['maxlat']+bb['minlat'])/2
    cx = (bb['maxlon']+bb['minlon'])/2
    rows.append((diag, el['type'], el['id'], leisure, name, round(cy,5), round(cx,5)))

# biggest first, drop tiny (<120 m) noise
rows = [r for r in rows if r[0] > 0.12]
rows.sort(reverse=True)
print(f'named leisure areas found: {len(rows)} (sorted by size)')
for diag, typ, oid, leis, name, cy, cx in rows[:80]:
    print(f'{diag:5.2f}km {typ:8} {oid:>12} {leis:16} [{cy},{cx}] {name}')
