# -*- coding: utf-8 -*-
"""
Precise Bangkok park geometry — fetched by EXACT OpenStreetMap id (from
discover_bkk.py), so each arena gets its own correctly-named polygon. This fixes
the earlier bug where 'largest park in bbox' gave สวนรถไฟ the สวนจตุจักร shape.

Writes scripts/bkk.generated.json ; merged into routes.js by gen_routes_js.py.
"""
import urllib.request, urllib.parse, json, math, sys, io, os, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'bkk.generated.json')
UA = {'User-Agent': 'RunArena/1.0 (route builder; cjeekhao@gmail.com)'}
OVERPASS = 'https://overpass-api.de/api/interpreter'

# (osm_type, osm_id, id, display name, city, prov)
PARKS = [
    ('way', 23483299,  'r1',  'สวนลุมพินี',                    'กรุงเทพฯ', 'กรุงเทพฯ'),
    ('way', 864170465, 'bj1', 'สวนป่าเบญจกิติ',                'กรุงเทพฯ', 'กรุงเทพฯ'),
    ('way', 1306732424,'bj2', 'สวนเบญจกิติ (บึงน้ำ)',          'กรุงเทพฯ', 'กรุงเทพฯ'),
    ('way', 23487550,  'rf1', 'สวนวชิรเบญจทัศ (สวนรถไฟ)',      'กรุงเทพฯ', 'กรุงเทพฯ'),
    ('way', 23487332,  'qs1', 'สวนสมเด็จพระนางเจ้าสิริกิติ์ฯ', 'กรุงเทพฯ', 'กรุงเทพฯ'),
    ('way', 23486417,  'ck1', 'สวนจตุจักร',                    'กรุงเทพฯ', 'กรุงเทพฯ'),
    ('way', 33042465,  'r9',  'สวนหลวง ร.๙',                   'กรุงเทพฯ', 'กรุงเทพฯ'),
    ('way', 207441272, 'nv1', 'สวนนวมินทร์ภิรมย์ (บึงลาดพร้าว)','กรุงเทพฯ', 'กรุงเทพฯ'),
    ('way', 56297939,  'sr1', 'สวนเสรีไทย (บึงกุ่ม)',          'กรุงเทพฯ', 'กรุงเทพฯ'),
    ('way', 26576748,  'tb1', 'สวนธนบุรีรมย์',                 'กรุงเทพฯ', 'กรุงเทพฯ'),
    ('way', 23630232,  'sl1', 'สนามหลวง',                      'กรุงเทพฯ', 'กรุงเทพฯ'),
    ('way', 23487144,  'bs1', 'อุทยานเบญจสิริ',                'กรุงเทพฯ', 'กรุงเทพฯ'),
    ('way', 203011799, 'r8p', 'สวนหลวงพระราม 8',               'กรุงเทพฯ', 'กรุงเทพฯ'),
    ('way', 443471833, 'cu1', 'อุทยาน 100 ปี จุฬาฯ',           'กรุงเทพฯ', 'กรุงเทพฯ'),
    ('way', 99029135,  'sp1', 'สวนสันติภาพ',                   'กรุงเทพฯ', 'กรุงเทพฯ'),
    ('way', 93061578,  's60', 'สวน 60 พรรษาฯ',                 'กรุงเทพฯ', 'กรุงเทพฯ'),
    ('way', 164588367, 'kj1', 'อุทยานเฉลิมกาญจนาภิเษก',        'กรุงเทพฯ', 'กรุงเทพฯ'),
    ('way', 37906413,  'r9u', 'อุทยานเฉลิมพระเกียรติ ร.๙',     'กรุงเทพฯ', 'กรุงเทพฯ'),
    ('relation', 8271107,  'ri1', 'สวนกีฬารามอินทรา',          'กรุงเทพฯ', 'กรุงเทพฯ'),
    ('relation', 10904051, 'rmn', 'สวนรมณีนาถ',               'กรุงเทพฯ', 'กรุงเทพฯ'),
    ('way', 40348145,  'bkc', 'สวนศรีนครเขื่อนขันธ์ (บางกะเจ้า)','บางกะเจ้า','สมุทรปราการ'),
]

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

def overpass(q, tries=4):
    for k in range(tries):
        try:
            data=urllib.parse.urlencode({'data':q}).encode()
            req=urllib.request.Request(OVERPASS,data=data,headers=UA)
            return json.load(urllib.request.urlopen(req,timeout=120))
        except Exception as e:
            print('  retry',k+1,repr(e)[:50]); time.sleep(12)
    raise RuntimeError('overpass failed')

def main():
    stmts=[]
    for typ,oid,*_ in PARKS:
        stmts.append(f'{typ}({oid});')
    q='[out:json][timeout:120];('+''.join(stmts)+');out geom tags;'
    d=overpass(q)
    by_key={}  # (type,id) -> element
    for el in d.get('elements',[]):
        by_key[(el['type'],el['id'])]=el

    routes=[]; report=[]
    for typ,oid,rid,name,city,prov in PARKS:
        el=by_key.get((typ,oid))
        if not el:
            report.append((rid,'MISSING',0,0,name,'')); continue
        osm_name=el.get('tags',{}).get('name','')
        if typ=='way':
            g=el.get('geometry',[])
            cs=[[p['lat'],p['lon']] for p in g]
        else:
            outer=[m for m in el.get('members',[]) if m.get('role')=='outer' and m.get('geometry')]
            if not outer:
                report.append((rid,'NO_OUTER',0,0,name,osm_name)); continue
            big=max(outer,key=lambda m:len(m['geometry']))
            cs=[[p['lat'],p['lon']] for p in big['geometry']]
        if len(cs)<4:
            report.append((rid,'SHORT',len(cs),0,name,osm_name)); continue
        if cs[0]!=cs[-1]: cs.append(cs[0])
        cs=r5(rdp(cs,0.00004))
        km=path_km(cs)
        routes.append(dict(id=rid,name=name,city=city,prov=prov,kind='park',coords=cs,km=round(km,2)))
        report.append((rid,'OK',len(cs),km,name,osm_name))

    print('\n==== BKK BUILD REPORT (verify name matches) ====')
    for rid,st,pts,km,name,osm in report:
        flag='' if (st!='OK' or name.split(' ')[0][:6] in osm or osm[:6] in name) else '  <-- NAME?'
        print(f'{rid:5} {st:8} pts={pts:4} km={km:5.2f}  want="{name}"  osm="{osm}"{flag}')
    json.dump(routes, open(OUT,'w',encoding='utf-8'), ensure_ascii=False)
    print(f'\nwrote {len(routes)} BKK parks -> bkk.generated.json')

if __name__=='__main__':
    main()
