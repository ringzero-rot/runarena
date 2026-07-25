// @ts-check
/** Format seconds as m:ss. @param {number} sec */
export function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

/** Pace string (m:ss per km). @param {number} sec @param {number} km */
export function pace(sec, km) {
  return km > 0 ? fmt(sec / km) : '--:--';
}
