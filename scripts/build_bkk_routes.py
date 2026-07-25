# -*- coding: utf-8 -*-
"""
Extra Bangkok route *variants* (OSRM foot) so some venues offer several loops to
choose from. Appended to scripts/bkk.generated.json (id-fetched parks stay).
"""
import urllib.request, json, math, sys, io, os, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'bkk.generated.json')
UA = {'User-Agent': 'RunArena/1.0 (route builder; cjeekhao@gmail.com)'}
OSRM = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/'

def haversine(a, b):
    R=6371.0; dlat=math.radians(b[0]-a[0]); dlon=math.radians(b[1]-a[1])
    la1=math.radians(a[0]); la2=math.radians(b[0])
    h=math.sin(dlat/2)**2+math.cos(la1)*math.cos(la2)*math.sin(dlon/2)**2
    return 2*R*math.asin(math.sqrt(h))
def path_km(cs): return sum(haversine(cs[i-1],cs[i]) for i in range(1,len(cs)))
def _perp(pt,a,b):
    ax,ay=a[1],a[0]; bx,by=b[1],b[0]; px,py=pt[1],pt[0]; dx,dy=bx-ax,by-ay
    if dx==0 and dy==0: return math.hypot(px-ax,py-ay)
    t=max(0,min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy)))
    return math.hypot(px-(ax+t*dx),py-(ay+t*dy))
def rdp(p,eps):
    if len(p)<3: return p[:]
    dm,idx=0.0,0
    for i in range(1,len(p)-1):
        d=_perp(p[i],p[0],p[-1])
        if d>dm: dm,idx=d,i
    if dm>eps: return rdp(p[:idx+1],eps)[:-1]+rdp(p[idx:],eps)
    return [p[0],p[-1]]
def r5(cs): return [[round(a,5),round(b,5)] for a,b in cs]

def osrm(waypoints, loop=True):
    pts = waypoints[:] + ([waypoints[0]] if loop else [])
    coordstr = ';'.join(f'{lon},{lat}' for lat, lon in pts)
    url = OSRM + coordstr + '?overview=full&geometries=geojson&continue_straight=false'
    req = urllib.request.Request(url, headers=UA)
    d = json.load(urllib.request.urlopen(req, timeout=60))
    return [[lat, lon] for lon, lat in d['routes'][0]['geometry']['coordinates']]

# id, name, city, prov, waypoints, loop
EXTRA = [
    dict(id='lum_in', name='สวนลุมพินี (ลูปใน)', city='กรุงเทพฯ', prov='กรุงเทพฯ',
         waypoints=[[13.73230,100.54160],[13.73180,100.54430],[13.72930,100.54470],
                    [13.72860,100.54160],[13.73020,100.53990]], loop=True),
    dict(id='park3', name='วิ่งเชื่อม 3 สวน (รถไฟ–จตุจักร–สิริกิติ์)', city='กรุงเทพฯ', prov='กรุงเทพฯ',
         waypoints=[[13.81470,100.55340],[13.81300,100.55840],[13.80560,100.55960],
                    [13.80130,100.55520],[13.80230,100.54930],[13.80800,100.54930],
                    [13.81250,100.54980]], loop=True),
]

def main():
    existing = json.load(open(OUT, encoding='utf-8'))
    existing = [r for r in existing if r['id'] not in {e['id'] for e in EXTRA}]  # idempotent
    report = []
    for e in EXTRA:
        try:
            cs = r5(rdp(osrm(e['waypoints'], e['loop']), 0.00003))
            km = path_km(cs)
            existing.append(dict(id=e['id'], name=e['name'], city=e['city'], prov=e['prov'],
                                 kind='route', coords=cs, km=round(km, 2)))
            report.append((e['id'], 'OK', len(cs), km, e['name']))
            time.sleep(0.6)
        except Exception as ex:
            report.append((e['id'], 'ERR ' + repr(ex)[:40], 0, 0, e['name']))
    print('==== EXTRA BKK ROUTES ====')
    for r in report:
        print(f'{r[0]:8} {r[1]:12} pts={r[2]:4} km={r[3]:5.2f}  {r[4]}')
    json.dump(existing, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'bkk.generated.json now has {len(existing)} entries')

if __name__ == '__main__':
    main()
