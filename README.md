# RunArena (Run Fun Mun)

ทุกเส้นทางคือสนาม • ทุกการวิ่งคือการท้าชิง — a competitive running web app for
Bangkok. Real OpenStreetMap maps, real GPS run tracking, leaderboards, a unique
Thai "ฉายา" (epithet) system, seasons, rewards, and shareable brag cards.

This is the **rebuilt** version: the original was a single 870-line `index.html`
prototype. It's now a modular, installable PWA with real GPS tracking, persistent
state, and a storage layer that a Supabase backend drops into cleanly.

## Run it

No build step and no Node required — it's native ES modules. It must be **served
over HTTP** (ES modules + the service worker don't run from `file://`).

```bash
python -m http.server 5173
```

Then open **http://localhost:5173/** . On your phone, real GPS tracking works over
`https://` (or `http://localhost`); most browsers block geolocation on plain
remote HTTP.

## Project layout

```
index.html              app shell (loads Leaflet + the module entry)
manifest.webmanifest    PWA manifest
sw.js                   service worker (offline app-shell + tile caching)
assets/icon.svg         maskable app icon
src/
  main.js               bootstrap: router, render loop, event delegation
  styles.css            design system (ported from the original)
  core/
    geo.js              haversine / path length / interpolation
    gps.js              GpsRunTracker (real) + SimRunTracker (demo)
    epithet.js          nickname engine (FNV-1a + avalanche)
    division.js         pace-based divisions
    format.js           time / pace formatting
  state/
    persistence.js      Store interface + LocalStore (+ Supabase blueprint)
    store.js            reactive state, selectors, actions
  data/                 seed routes, events, sponsors, competitors
  ui/
    dom.js              esc() + keyboard-accessible event delegation
    map.js              Leaflet manager (reuses instances, no rebuild churn)
    toast.js
  views/                login, home, detail, run, draw, events, rewards,
                        profile, notifs, share
scripts/
  discover_bkk.py       list every named park in Greater Bangkok (names + ids)
  build_bkk.py          fetch Bangkok parks by EXACT osm id -> bkk.generated.json
  build_routes.py       fetch provincial + non-park routes -> routes.generated.json
  gen_routes_js.py      merge both -> src/data/routes.js
  *.generated.json      intermediate build output
legacy/index.original.html   the original single-file build, for reference
```

## Cloud backend (optional, off by default)

Runs fully local (browser storage) out of the box. Drop your Supabase keys into
[`src/config.js`](src/config.js) to enable **real accounts, cross-device sync,
and multiplayer leaderboards** — see [SETUP_SUPABASE.md](SETUP_SUPABASE.md) and
[`supabase/schema.sql`](supabase/schema.sql).

- **Local-first**: `src/state/persistence.js` (`SyncManager`) always reads/writes
  localStorage instantly; the cloud (`src/state/cloud.js`, Supabase) syncs in the
  background. No config or no network → it silently stays local.
- **Accounts**: anonymous auth by default (keeps the name-only flow) with an
  optional email upgrade. **Leaderboards** show real runners when connected
  (`ensureCloudBoard` in the store), with seed competitors filling in.
- **Security**: Postgres row-level security + an anti-cheat trigger that rejects
  impossible times/paces.

## Venues & multiple routes

A place can offer several loops. Routes carry a `venue` slug, so the home screen
lists **venues** (33 of them); a venue with more than one route shows a
🔀 picker when opened, and its detail links back to the other loops. Current
multi-route venues: สวนลุมพินี (รอบสวน / ลูปใน), สวนเบญจกิติ (สวนป่า / รอบบึง),
and สวนรถไฟ–จตุจักร (รอบสวนรถไฟ / จตุจักร / สิริกิติ์ / วิ่งเชื่อม 3 สวน).
Grouping is defined in `scripts/gen_routes_js.py` (`VENUE` map).

## Route data (real geometry, nationwide)

38 seed routes across 33 venues — **21 in Bangkok** plus Bang Krachao and
provincial routes
across Chiang Mai, Khon Kaen, Nakhon Ratchasima, Phuket, Songkhla, Ayutthaya,
Sukhothai, Hua Hin, Pattaya and Phitsanulok. Geometry is **real**, from
OpenStreetMap — never hand-drawn:

- **Bangkok parks** are fetched by **exact OSM id** (`build_bkk.py`), so each
  arena gets its own correctly-named polygon. This is why adjacent parks like
  สวนวชิรเบญจทัศ (สวนรถไฟ), สวนจตุจักร and สวนสมเด็จพระนางเจ้าสิริกิติ์ฯ are now
  three distinct shapes rather than sharing the biggest one. Discover ids with
  `discover_bkk.py`.
- **Other parks / lakes** — perimeter polygons via the **Overpass API**.
- **Riverside / beach / old-town / historical loops** — snapped to real footpaths
  with **OSRM** foot routing.

Each path is simplified (Douglas–Peucker) and its distance computed from the
coordinates. To regenerate / extend (needs internet):

```bash
python scripts/build_bkk.py       # Bangkok parks by id  -> bkk.generated.json
python scripts/build_routes.py    # provincial + routes  -> routes.generated.json
python scripts/gen_routes_js.py   # merge -> src/data/routes.js (no network)
```

## What changed in the rebuild

**New capabilities**
- **Real GPS run tracking** (`watchPosition`) with noise/jump filtering, live
  distance & pace, plus a simulator fallback for desktop/testing.
- **Persistence** — points, streak, results, favorites, and custom arenas
  survive a refresh (`localStorage`), behind a swappable `Store` interface.
- **Installable PWA** — manifest, icon, and an offline service worker.
- **Anti-cheat (lite)** — a real GPS run that doesn't cover the arena distance
  isn't recorded, and the "verified" badge now reflects GPS vs. demo mode.

**Bugs fixed**
- XSS: all user-supplied text (names, custom route names, notifications) is now
  HTML-escaped before rendering.
- The "opened a new arena" badge was hardcoded to `false` — now real.
- Epithets were keyed by route *name* in the profile but route *id* everywhere
  else, so a user's signature nickname didn't match; now keyed by id everywhere.
- The map was destroyed and rebuilt on every render; it's now reused, and live
  search updates only the list.
- External links now use `rel="noopener noreferrer"`.

**Quality**
- Split one 870-line file into focused modules with JSDoc types.
- Cards, banners, and rows are keyboard-focusable with ARIA labels and visible
  focus rings.

## Roadmap (next)

1. **Supabase backend** — real auth (Apple/Google), Postgres for
   profiles/results/routes, Realtime leaderboards. See the blueprint in
   `src/state/persistence.js`; only that file changes.
2. **Server-side GPS validation** for trustworthy rankings.
3. **Teams / live events / age handicap.**
4. **Capacitor wrap** for iOS/Android: background GPS + Apple Health / Health
   Connect sync.

> To move to Vite + TypeScript later: the modules already use JSDoc types and
> single responsibilities, so it's mostly adding `package.json`, `vite`, and
> renaming `.js` → `.ts`.
