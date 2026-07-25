# -*- coding: utf-8 -*-
"""
Build accurate RunArena routes across Thailand.

Loop venues (parks / lakes): ONE batched Overpass request pulls the real
perimeter geometry; we pick the largest matching feature inside each venue's
bbox (robust, no fragile name matching).
Line venues (riverside / beach / old town / historical): OSRM 'foot' routing so
the path snaps to real footpaths.
"""
import urllib.request, urllib.parse, json, time, math, sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
GEN_JSON = os.path.join(HERE, 'routes.generated.json')

UA = {'User-Agent': 'RunArena/1.0 (running-route builder; cjeekhao@gmail.com)'}
OVERPASS = 'https://overpass-api.de/api/interpreter'
OSRM = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/'

def haversine(a, b):
    R = 6371.0
    dlat = math.radians(b[0]-a[0]); dlon = math.radians(b[1]-a[1])
    la1 = math.radians(a[0]); la2 = math.radians(b[0])
    h = math.sin(dlat/2)**2 + math.cos(la1)*math.cos(la2)*math.sin(dlon/2)**2
    return 2*R*math.asin(math.sqrt(h))

def path_km(cs):
    return sum(haversine(cs[i-1], cs[i]) for i in range(1, len(cs)))

def _perp(pt, a, b):
    ax, ay = a[1], a[0]; bx, by = b[1], b[0]; px, py = pt[1], pt[0]
    dx, dy = bx-ax, by-ay
    if dx == 0 and dy == 0:
        return math.hypot(px-ax, py-ay)
    t = ((px-ax)*dx + (py-ay)*dy)/(dx*dx+dy*dy)
    t = max(0, min(1, t))
    return math.hypot(px-(ax+t*dx), py-(ay+t*dy))

def rdp(points, eps):
    if len(points) < 3:
        return points[:]
    dmax, idx = 0.0, 0
    for i in range(1, len(points)-1):
        d = _perp(points[i], points[0], points[-1])
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        return rdp(points[:idx+1], eps)[:-1] + rdp(points[idx:], eps)
    return [points[0], points[-1]]

def round5(cs):
    return [[round(a, 5), round(b, 5)] for a, b in cs]

def span(cs):
    la = [p[0] for p in cs]; lo = [p[1] for p in cs]
    return haversine([min(la), min(lo)], [max(la), max(lo)])

def centroid(cs):
    return [sum(p[0] for p in cs)/len(cs), sum(p[1] for p in cs)/len(cs)]

def in_bbox(pt, bb):
    s, w, n, e = bb
    return s <= pt[0] <= n and w <= pt[1] <= e

def overpass(query, tries=4):
    for k in range(tries):
        try:
            data = urllib.parse.urlencode({'data': query}).encode()
            req = urllib.request.Request(OVERPASS, data=data, headers=UA)
            return json.load(urllib.request.urlopen(req, timeout=120))
        except Exception as e:
            print('  overpass retry', k+1, repr(e)[:50]); time.sleep(12)
    raise RuntimeError('overpass failed')

def osrm(waypoints, loop=False):
    pts = waypoints[:] + ([waypoints[0]] if loop else [])
    coordstr = ';'.join(f'{lon},{lat}' for lat, lon in pts)
    url = OSRM + coordstr + '?overview=full&geometries=geojson&continue_straight=false'
    req = urllib.request.Request(url, headers=UA)
    d = json.load(urllib.request.urlopen(req, timeout=60))
    return [[lat, lon] for lon, lat in d['routes'][0]['geometry']['coordinates']]

# kind: 'water'|'park' (Overpass loop)  OR  'route' (OSRM waypoints)
V = [
    # ---- Bangkok & vicinity ----
    dict(id='r1', name='สวนลุมพินี', city='กรุงเทพฯ', prov='กรุงเทพฯ', kind='park', bbox=(13.725,100.535,13.736,100.548)),
    dict(id='r2', name='สวนเบญจกิติ (รอบบึง)', city='กรุงเทพฯ', prov='กรุงเทพฯ', kind='route',
         waypoints=[[13.72680,100.55780],[13.72520,100.56230],[13.71950,100.56240],[13.71850,100.55760]], loop=True),
    dict(id='r3', name='สวนวชิรเบญจทัศ (สวนรถไฟ)', city='กรุงเทพฯ', prov='กรุงเทพฯ', kind='park', bbox=(13.789,100.542,13.810,100.564)),
    dict(id='r4', name='สวนจตุจักร', city='กรุงเทพฯ', prov='กรุงเทพฯ', kind='park', bbox=(13.800,100.547,13.811,100.558)),
    dict(id='r5', name='สวนหลวง ร.๙', city='กรุงเทพฯ', prov='กรุงเทพฯ', kind='park', bbox=(13.643,100.658,13.670,100.682)),
    dict(id='r6', name='บึงหนองบอน', city='กรุงเทพฯ', prov='กรุงเทพฯ', kind='water', bbox=(13.676,100.650,13.698,100.670)),
    dict(id='bk1', name='เลียบเจ้าพระยา (พระราม 8)', city='กรุงเทพฯ', prov='กรุงเทพฯ', kind='route',
         waypoints=[[13.77177,100.49356],[13.76500,100.49882],[13.75700,100.49610],[13.74700,100.49290],[13.73700,100.49150]], loop=False),
    dict(id='bk2', name='เกาะรัตนโกสินทร์ (รอบเมืองเก่า)', city='กรุงเทพฯ', prov='กรุงเทพฯ', kind='route',
         waypoints=[[13.75640,100.49290],[13.76270,100.49500],[13.76100,100.50200],[13.75260,100.50130],[13.75190,100.49430]], loop=True),
    # ---- Chiang Mai ----
    dict(id='cm1', name='คูเมืองเชียงใหม่ (รอบคูเมือง)', city='เชียงใหม่', prov='เชียงใหม่', kind='route',
         waypoints=[[18.79636,98.98192],[18.79632,98.99098],[18.78525,98.99106],[18.78521,98.98181]], loop=True),
    dict(id='cm2', name='อ่างแก้ว มช.', city='เชียงใหม่', prov='เชียงใหม่', kind='route',
         waypoints=[[18.80620,98.95060],[18.80480,98.95560],[18.79980,98.95480],[18.80080,98.94980]], loop=True),
    dict(id='cm4', name='สวนหนองบวกหาด', city='เชียงใหม่', prov='เชียงใหม่', kind='park', bbox=(18.779,98.974,18.788,98.984)),
    # ---- Khon Kaen ----
    dict(id='kk1', name='บึงแก่นนคร', city='ขอนแก่น', prov='ขอนแก่น', kind='water', bbox=(16.413,102.826,16.442,102.857)),
    dict(id='kk2', name='บึงสีฐาน (มข.)', city='ขอนแก่น', prov='ขอนแก่น', kind='water', bbox=(16.468,102.813,16.487,102.832)),
    # ---- Udon Thani ----
    dict(id='ud1', name='หนองประจักษ์', city='อุดรธานี', prov='อุดรธานี', kind='route',
         waypoints=[[17.41530,102.78380],[17.41560,102.78720],[17.41300,102.78880],[17.40990,102.78760],[17.40970,102.78420],[17.41230,102.78300]], loop=True),
    # ---- Nakhon Ratchasima ----
    dict(id='nm1', name='บุ่งตาหลัว', city='นครราชสีมา', prov='นครราชสีมา', kind='water', bbox=(14.968,102.103,14.998,102.133)),
    # ---- Phuket ----
    dict(id='pk2', name='อ่างเก็บน้ำในหาน', city='ภูเก็ต', prov='ภูเก็ต', kind='water', bbox=(7.768,98.300,7.786,98.317)),
    # ---- Songkhla / Hat Yai ----
    dict(id='sk2', name='แหลมสมิหลา (เลียบหาด)', city='สงขลา', prov='สงขลา', kind='route',
         waypoints=[[7.19980,100.59560],[7.20860,100.59300],[7.21640,100.59120],[7.22470,100.58990]], loop=False),
    # ---- Ayutthaya ----
    dict(id='ay1', name='บึงพระราม', city='อยุธยา', prov='พระนครศรีอยุธยา', kind='water', bbox=(14.349,100.554,14.363,100.571)),
    dict(id='ay2', name='อุทยานประวัติศาสตร์อยุธยา', city='อยุธยา', prov='พระนครศรีอยุธยา', kind='route',
         waypoints=[[14.35670,100.55780],[14.35870,100.56690],[14.35100,100.56820],[14.34960,100.55900]], loop=True),
    # ---- Sukhothai ----
    dict(id='st1', name='อุทยานประวัติศาสตร์สุโขทัย', city='สุโขทัย', prov='สุโขทัย', kind='route',
         waypoints=[[17.01760,99.70360],[17.02120,99.70980],[17.01450,99.71300],[17.01180,99.70600]], loop=True),
    # ---- Hua Hin ----
    dict(id='hh1', name='เลียบหาดหัวหิน', city='หัวหิน', prov='ประจวบคีรีขันธ์', kind='route',
         waypoints=[[12.57180,99.96140],[12.56420,99.96060],[12.55480,99.95970],[12.54430,99.95870]], loop=False),
    # ---- Pattaya ----
    dict(id='pt1', name='เลียบหาดพัทยา (Beach Rd)', city='พัทยา', prov='ชลบุรี', kind='route',
         waypoints=[[12.92790,100.87447],[12.93800,100.87165],[12.94870,100.86870],[12.95740,100.86720]], loop=False),
    # ---- Phitsanulok ----
    dict(id='pl1', name='เลียบแม่น้ำน่าน พิษณุโลก', city='พิษณุโลก', prov='พิษณุโลก', kind='route',
         waypoints=[[16.81660,100.26030],[16.82260,100.26260],[16.82870,100.26380],[16.83480,100.26430]], loop=False),
]

def batched_overpass_loops(loops):
    stmts = []
    for v in loops:
        s, w, n, e = v['bbox']
        if v['kind'] == 'water':
            # Thai lakes/reservoirs use several tag schemes — cover them all.
            tags = ['"natural"="water"', '"landuse"="reservoir"', '"water"']
        else:
            tags = ['"leisure"="park"']
        for t in tags:
            stmts.append(f'way[{t}]({s},{w},{n},{e});')
            stmts.append(f'relation[{t}]({s},{w},{n},{e});')  # big lakes/parks are multipolygons
    q = '[out:json][timeout:120];(' + ''.join(stmts) + ');out geom tags;'
    d = overpass(q)
    feats = []
    for el in d.get('elements', []):
        if el['type'] == 'way' and el.get('geometry'):
            cs = [[p['lat'], p['lon']] for p in el['geometry']]
        elif el['type'] == 'relation':
            outer = [m for m in el.get('members', []) if m.get('role') == 'outer' and m.get('geometry')]
            if not outer:
                continue
            biggest = max(outer, key=lambda m: len(m['geometry']))
            cs = [[p['lat'], p['lon']] for p in biggest['geometry']]
        else:
            continue
        if len(cs) >= 4:
            feats.append(cs)
    # assign each venue the largest feature whose centroid sits in its bbox.
    # Cap span at 6 km so a coastal bbox can't accidentally grab the sea polygon
    # or a giant reservoir — no running LOOP venue is bigger than that here.
    out = {}
    for v in loops:
        cands = [cs for cs in feats if in_bbox(centroid(cs), v['bbox']) and span(cs) <= 6.0]
        if cands:
            out[v['id']] = max(cands, key=span)
    return out

def main():
    loops = [v for v in V if v['kind'] in ('water', 'park')]
    print('Batched Overpass for', len(loops), 'loop venues...')
    geoms = batched_overpass_loops(loops)

    routes, report = [], []
    for i, v in enumerate(V):
        try:
            if v['kind'] in ('water', 'park'):
                cs = geoms.get(v['id'])
                if not cs:
                    report.append((v['id'], 'EMPTY', 0, 0, v['name'])); continue
                cs = rdp(cs, 0.00004)
                if cs[0] != cs[-1]:
                    cs.append(cs[0])
            else:
                cs = rdp(osrm(v['waypoints'], v.get('loop', False)), 0.00003)
                time.sleep(0.6)
            cs = round5(cs)
            km = path_km(cs)
            if len(cs) < 4 or km < 0.4 or km > 45:
                report.append((v['id'], f'SKIP km={km:.2f}', len(cs), km, v['name'])); continue
            routes.append(dict(id=v['id'], name=v['name'], city=v['city'], prov=v['prov'],
                               kind=v['kind'], trace=i % 4, coords=cs, km=round(km, 2)))
            report.append((v['id'], 'OK', len(cs), km, v['name']))
        except Exception as e:
            report.append((v['id'], 'ERR ' + repr(e)[:50], 0, 0, v['name']))

    print('\n==== BUILD REPORT ====')
    for r in report:
        print(f'{r[0]:5} {r[1]:16} pts={r[2]:4} km={r[3]:5.2f}  {r[4]}')
    print(f'\nBuilt {len(routes)}/{len(V)} routes')
    with open(GEN_JSON, 'w', encoding='utf-8') as f:
        json.dump(routes, f, ensure_ascii=False)
    print('wrote routes.generated.json')

if __name__ == '__main__':
    main()
