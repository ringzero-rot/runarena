# -*- coding: utf-8 -*-
"""
Merge the precise Bangkok set (bkk.generated.json, id-anchored parks) with the
provincial + BKK-non-park routes (routes.generated.json) into src/data/routes.js.
No network.
"""
import json, io, sys, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
GEN_JSON = os.path.join(HERE, 'routes.generated.json')
BKK_JSON = os.path.join(HERE, 'bkk.generated.json')
ROUTES_JS = os.path.join(HERE, '..', 'src', 'data', 'routes.js')

# From routes.generated.json keep only: everything outside Bangkok, plus the
# Bangkok routes that are NOT parks (riverside + old-town loops + Nong Bon lake).
# All Bangkok PARKS come from the correctly-named bkk.generated.json instead.
KEEP_BKK_NONPARK = {'r6', 'bk1', 'bk2'}
DROP = {'ud1'}  # Nong Prajak: OSRM foot detoured to a wrong 7.35 km loop
NEW = {'bj1', 'nv1', 'r9u', 's60', 'ay2', 'st1', 'pl1', 'nm1'}  # "ใหม่" chip

def rng(seed):  # small deterministic PRNG for runner counts
    h = 2166136261
    for ch in seed:
        h ^= ord(ch); h = (h * 16777619) & 0xFFFFFFFF
    return h

prev = json.load(open(GEN_JSON, encoding='utf-8'))
bkk = json.load(open(BKK_JSON, encoding='utf-8'))
for r in bkk:
    r.setdefault('kind', 'park')

provincial = [x for x in prev if x.get('prov') != 'กรุงเทพฯ']
bkk_nonpark = [x for x in prev if x['id'] in KEEP_BKK_NONPARK]

merged = bkk + bkk_nonpark + provincial
seen, routes = set(), []
for r in merged:                    # dedupe by id (Bangkok parks win)
    if r['id'] in seen or r['id'] in DROP:
        continue
    seen.add(r['id'])
    routes.append(r)

# Group routes that belong to the same physical place into one "venue" so the UI
# can offer a choice of loops. id -> (venue slug, venue name, short route label).
VENUE = {
    'r1':     ('lumpini',    'สวนลุมพินี',        'รอบสวน'),
    'lum_in': ('lumpini',    'สวนลุมพินี',        'ลูปใน'),
    'rf1':    ('jj',         'สวนรถไฟ–จตุจักร',   'รอบสวนรถไฟ'),
    'ck1':    ('jj',         'สวนรถไฟ–จตุจักร',   'รอบสวนจตุจักร'),
    'qs1':    ('jj',         'สวนรถไฟ–จตุจักร',   'สวนสมเด็จฯ สิริกิติ์'),
    'park3':  ('jj',         'สวนรถไฟ–จตุจักร',   'วิ่งเชื่อม 3 สวน'),
    'bj1':    ('benjakitti', 'สวนเบญจกิติ',       'สวนป่าเบญจกิติ'),
    'bj2':    ('benjakitti', 'สวนเบญจกิติ',       'รอบบึงเบญจกิติ'),
}

out = []
for i, r in enumerate(routes):
    runners = 45 + rng(r['id']) % 320
    venue, venueName, label = VENUE.get(r['id'], (r['id'], r['name'], 'เส้นทางหลัก'))
    obj = {
        'id': r['id'], 'name': r['name'], 'city': r['city'], 'prov': r['prov'],
        'kind': r['kind'], 'trace': i % 4, 'runners': runners,
        'venue': venue, 'venueName': venueName, 'label': label,
        'coords': r['coords'],
    }
    if r['id'] in NEW:
        obj['isNew'] = True
    out.append(obj)

def coords_js(cs):
    return '[' + ','.join(f'[{a},{b}]' for a, b in cs) + ']'

lines = []
lines.append('// @ts-check')
lines.append('/**')
lines.append(' * Seed arenas across Thailand. Geometry is REAL, generated from OpenStreetMap:')
lines.append(' *  - parks: Overpass perimeter polygons  - lakes/routes: OSRM foot routing.')
lines.append(' * Regenerate: python scripts/build_routes.py && python scripts/gen_routes_js.py')
lines.append(' * Distances are derived from coords at load time (store), never hand-typed.')
lines.append(' * @typedef {import(\'../core/geo.js\').LatLng} LatLng')
lines.append(' * @typedef {{ id:string, name:string, city:string, prov:string, kind:string, trace:number, runners:number, venue:string, venueName:string, label:string, isNew?:boolean, coords:LatLng[] }} RawRoute')
lines.append(' */')
lines.append('')
lines.append('/** @type {RawRoute[]} */')
lines.append('export const RAW_ROUTES = [')
for o in out:
    new = ' isNew:true,' if o.get('isNew') else ''
    lines.append(
        f"  {{ id:'{o['id']}', name:'{o['name']}', city:'{o['city']}', prov:'{o['prov']}',"
        f" kind:'{o['kind']}', trace:{o['trace']}, runners:{o['runners']},"
        f" venue:'{o['venue']}', venueName:'{o['venueName']}', label:'{o['label']}',{new} coords:{coords_js(o['coords'])} }},"
    )
lines.append('];')
lines.append('')
lines.append('// Decorative mini "trace" SVG paths used on route thumbnails.')
lines.append("export const TRACE_PATHS = [")
lines.append("  'M8 50 C25 30 30 45 45 25 S60 12 58 8',")
lines.append("  'M10 10 C20 30 40 25 45 45 S25 55 50 58',")
lines.append("  'M8 30 C30 10 35 50 55 30 S40 8 56 50',")
lines.append("  'M12 55 C18 30 40 40 30 20 S55 18 56 8',")
lines.append("];")
lines.append('')
lines.append('/** Default map centre — central Bangkok. @type {LatLng} */')
lines.append('export const BKK = [13.7455, 100.5330];')
lines.append('')

open(ROUTES_JS, 'w', encoding='utf-8').write('\n'.join(lines))

# summary
from collections import Counter
provs = Counter(o['prov'] for o in out)
print('wrote src/data/routes.js with %d routes' % len(out))
print('provinces:', dict(provs))
tot_pts = sum(len(o['coords']) for o in out)
print('total coordinate points:', tot_pts)
