// @ts-check
/**
 * Geodesy helpers. All coordinates are [lat, lng] tuples in decimal degrees.
 * Distances are in kilometres.
 * @typedef {[number, number]} LatLng
 */

const R = 6371; // Earth radius, km

/**
 * Great-circle distance between two points (haversine).
 * @param {LatLng} a
 * @param {LatLng} b
 * @returns {number} kilometres
 */
export function haversine(a, b) {
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Total length of a polyline.
 * @param {LatLng[]} coords
 * @returns {number} kilometres
 */
export function pathKm(coords) {
  let d = 0;
  for (let i = 1; i < coords.length; i++) d += haversine(coords[i - 1], coords[i]);
  return d;
}

/**
 * Cumulative distance at each vertex of a polyline.
 * @param {LatLng[]} coords
 * @returns {number[]}
 */
export function cumDist(coords) {
  const out = [0];
  for (let i = 1; i < coords.length; i++) out.push(out[i - 1] + haversine(coords[i - 1], coords[i]));
  return out;
}

/**
 * Interpolate the point at a fraction (0..1) of the true distance along a path.
 * @param {LatLng[]} coords
 * @param {number} frac
 * @returns {LatLng}
 */
export function pointAt(coords, frac) {
  const cum = cumDist(coords);
  const total = cum[cum.length - 1];
  const target = total * Math.max(0, Math.min(1, frac));
  for (let i = 1; i < cum.length; i++) {
    if (cum[i] >= target) {
      const seg = cum[i] - cum[i - 1];
      const t = seg ? (target - cum[i - 1]) / seg : 0;
      return [
        coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t,
        coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t,
      ];
    }
  }
  return coords[coords.length - 1];
}
