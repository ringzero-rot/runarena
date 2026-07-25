// @ts-check
/**
 * Leaflet map manager.
 *
 * Improvements over the legacy build, which called `map.remove()` and rebuilt
 * the map on *every* render (flicker + wasted work):
 *  - One instance per logical slot ('main' | 'detail' | 'run' | 'draw').
 *  - If the same container node is still mounted, we REUSE the map and only
 *    swap the data layers. We only tear down when the container node was
 *    actually replaced (e.g. a full view switch) or explicitly disposed.
 *
 * Leaflet is loaded globally as `L` (CDN, cached by the service worker).
 */

const TILE = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILEOPT = { maxZoom: 19, subdomains: 'abcd', attribution: '&copy; OpenStreetMap &copy; CARTO' };

/** @returns {boolean} */
export function hasLeaflet() {
  return typeof window !== 'undefined' && typeof (/** @type {any} */ (window).L) !== 'undefined';
}
const L = () => /** @type {any} */ (window).L;

function divIcon(cls, size) {
  return L().divIcon({ className: '', html: `<div class="${cls}"></div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

/** @type {Record<string, {map:any, el:HTMLElement, layers:any}>} */
const slots = {};

/** Get (reuse) or create a base map for a slot bound to `el`. */
function base(slot, el, center, zoom, opts = {}) {
  const existing = slots[slot];
  if (existing && existing.el === el && el.isConnected) {
    // reuse: drop old data layers, keep the map + tiles
    if (existing.layers) existing.map.removeLayer(existing.layers);
    existing.layers = null;
    return existing.map;
  }
  if (existing) {
    try { existing.map.remove(); } catch { /* ignore */ }
    delete slots[slot];
  }
  const map = L().map(el, { zoomControl: false, attributionControl: opts.attribution !== false, dragging: opts.dragging !== false, scrollWheelZoom: opts.scrollWheelZoom !== false }).setView(center, zoom);
  L().tileLayer(TILE, TILEOPT).addTo(map);
  if (opts.zoomControl) L().control.zoom({ position: 'bottomright' }).addTo(map);
  slots[slot] = { map, el, layers: null };
  return map;
}

/** Dispose a slot (used when leaving a view that owned it). */
export function dispose(slot) {
  const s = slots[slot];
  if (!s) return;
  try { s.map.remove(); } catch { /* ignore */ }
  delete slots[slot];
}

/**
 * Home map: all routes + the user's position. King routes drawn in gold.
 * @param {HTMLElement} el
 */
export function renderMainMap(el, { routes, here, kingOf, onRoute, center, boundsRoutes }) {
  if (!hasLeaflet()) return;
  const map = base('main', el, here || center, 12, { zoomControl: true });
  const group = L().featureGroup().addTo(map);
  // Draw ALL routes (nationwide) as pins/lines...
  routes.forEach((r) => {
    const king = kingOf(r.id);
    const line = L().polyline(r.coords, { color: king ? '#F5B83D' : '#28E0C8', weight: king ? 5 : 4, opacity: 0.9 });
    line.on('click', () => onRoute(r.id));
    line.bindTooltip(`${r.name} • ${r.distanceKm.toFixed(2)} กม.`, { direction: 'top' });
    line.addTo(group);
    L().marker(r.coords[0], { icon: divIcon('numpin', 22) })
      .addTo(group).on('click', () => onRoute(r.id)).bindTooltip(r.name, { direction: 'top' });
  });
  if (here) L().marker(here, { icon: divIcon('mepin', 16) }).addTo(group).bindTooltip('คุณอยู่ตรงนี้');
  slots.main.layers = group;
  // ...but fit the view to the NEARBY subset (+ the user) so it isn't zoomed out
  // to the whole country when routes span from Chiang Mai to Phuket.
  try {
    const fit = L().featureGroup((boundsRoutes && boundsRoutes.length ? boundsRoutes : routes)
      .map((r) => L().polyline(r.coords)));
    if (here) fit.addLayer(L().marker(here));
    map.fitBounds(fit.getBounds().pad(0.2), { maxZoom: 14 });
  } catch { /* empty */ }
  setTimeout(() => map.invalidateSize(), 0);
}

/** Route-detail map: single route with start/finish markers. */
export function renderDetailMap(el, route) {
  if (!hasLeaflet() || !route) return;
  const map = base('detail', el, route.coords[0], 14, { zoomControl: false });
  const group = L().featureGroup().addTo(map);
  const line = L().polyline(route.coords, { color: '#28E0C8', weight: 5, opacity: 0.95 }).addTo(group);
  L().circleMarker(route.coords[0], { radius: 6, color: '#28E0C8', fillColor: '#28E0C8', fillOpacity: 1 }).addTo(group).bindTooltip('จุดเริ่ม');
  L().circleMarker(route.coords[route.coords.length - 1], { radius: 6, color: '#FF5630', fillColor: '#FF5630', fillOpacity: 1 }).addTo(group).bindTooltip('เส้นชัย');
  slots.detail.layers = group;
  try { map.fitBounds(line.getBounds().pad(0.12)); } catch { /* empty */ }
  setTimeout(() => map.invalidateSize(), 0);
}

/**
 * Run map with a moving "me" pin, optional ghost pin, and a progress trace.
 * Returns a small handle the run controller drives each tick.
 */
export function renderRunMap(el, coords, withGhost) {
  if (!hasLeaflet()) return null;
  const map = base('run', el, coords[0], 14, { zoomControl: false, attribution: false, dragging: false, scrollWheelZoom: false });
  const group = L().featureGroup().addTo(map);
  const full = L().polyline(coords, { color: '#2A2F3A', weight: 6 }).addTo(group);
  const prog = L().polyline([coords[0]], { color: '#28E0C8', weight: 6 }).addTo(group);
  const me = L().marker(coords[0], { icon: divIcon('runpin', 14) }).addTo(group);
  const ghost = withGhost ? L().marker(coords[0], { icon: divIcon('ghostpin', 12) }).addTo(group) : null;
  slots.run.layers = group;
  try { map.fitBounds(full.getBounds().pad(0.12)); } catch { /* empty */ }
  setTimeout(() => map.invalidateSize(), 0);
  return {
    setMe(pos) { me.setLatLng(pos); },
    setGhost(pos) { if (ghost) ghost.setLatLng(pos); },
    setProgress(latlngs) { prog.setLatLngs(latlngs); },
  };
}

/**
 * Draw map: taps add points; returns a handle to add/reset points.
 * @param {HTMLElement} el
 */
export function renderDrawMap(el, here, onTap) {
  if (!hasLeaflet()) return null;
  const map = base('draw', el, here || [13.7455, 100.533], 15, { zoomControl: true });
  if (here) L().marker(here, { icon: divIcon('mepin', 16) }).addTo(map);
  let line = null;
  const dots = L().featureGroup().addTo(map);
  map.on('click', (e) => onTap([e.latlng.lat, e.latlng.lng]));
  setTimeout(() => map.invalidateSize(), 0);
  return {
    redraw(points) {
      if (line) map.removeLayer(line);
      dots.clearLayers();
      if (points.length) line = L().polyline(points, { color: '#FF5630', weight: 5 }).addTo(map);
      points.forEach((p) => L().circleMarker(p, { radius: 4, color: '#FF5630', fillOpacity: 1 }).addTo(dots));
    },
  };
}
