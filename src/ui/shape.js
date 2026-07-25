// @ts-check
/**
 * Render a route's REAL outline (from its coordinates) as an inline SVG — used
 * for card thumbnails and detail headers so every arena looks unique and real
 * instead of a generic decorative squiggle. Longitude is scaled by cos(lat) so
 * the shape isn't distorted; north is up.
 * @typedef {import('../core/geo.js').LatLng} LatLng
 */

/**
 * @param {LatLng[]} coords
 * @param {{ w?:number, h?:number, pad?:number, stroke?:string, sw?:number, dot?:boolean }} [opts]
 * @returns {string} SVG markup
 */
export function routeShapeSvg(coords, opts = {}) {
  const w = opts.w || 64, h = opts.h || 64, pad = opts.pad ?? 9;
  const stroke = opts.stroke || 'var(--trace)';
  const sw = opts.sw ?? 2.4;
  if (!coords || coords.length < 2) return '';

  let minLa = Infinity, maxLa = -Infinity, minLo = Infinity, maxLo = -Infinity;
  for (const [la, lo] of coords) {
    if (la < minLa) minLa = la; if (la > maxLa) maxLa = la;
    if (lo < minLo) minLo = lo; if (lo > maxLo) maxLo = lo;
  }
  const cosLat = Math.cos(((minLa + maxLa) / 2) * Math.PI / 180) || 1;
  const spanLo = Math.max(1e-9, (maxLo - minLo) * cosLat);
  const spanLa = Math.max(1e-9, maxLa - minLa);
  const scale = Math.min((w - 2 * pad) / spanLo, (h - 2 * pad) / spanLa);
  const offX = (w - spanLo * scale) / 2;
  const offY = (h - spanLa * scale) / 2;

  const pts = coords.map(([la, lo]) => {
    const x = offX + (lo - minLo) * cosLat * scale;
    const y = h - (offY + (la - minLa) * scale); // invert so north is up
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const start = pts[0].split(',');
  const dot = opts.dot ? `<circle cx="${start[0]}" cy="${start[1]}" r="${sw * 1.1}" fill="${stroke}"/>` : '';
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <polyline points="${pts.join(' ')}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>${dot}</svg>`;
}
