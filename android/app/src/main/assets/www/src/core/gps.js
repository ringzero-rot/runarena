// @ts-check
/**
 * Run tracking.
 *
 * The legacy build only ever *simulated* a run. This module adds REAL tracking
 * via the Geolocation API and keeps a simulator for desktop/testing, both
 * behind one interface:
 *
 *   tracker.start(onTick)  -> begins emitting { km, sec, paceSec, pos, frac }
 *   tracker.stop()         -> { km, sec, coords }
 *
 * Real tracking rejects noisy fixes (poor accuracy, teleport-speed jumps) so a
 * bad GPS sample can't inflate distance — the foundation for trustworthy,
 * anti-cheat-able results.
 *
 * @typedef {import('./geo.js').LatLng} LatLng
 * @typedef {{ km:number, sec:number, paceSec:number, pos:LatLng, frac:number }} Tick
 */
import { haversine, cumDist, pointAt } from './geo.js';

/** Fraction (0..1) along `route` closest to `pt`, by projecting onto vertices. */
export function fractionAlong(route, pt) {
  const cum = cumDist(route);
  const total = cum[cum.length - 1] || 1;
  let bestI = 0, bestD = Infinity;
  for (let i = 0; i < route.length; i++) {
    const d = haversine(route[i], pt);
    if (d < bestD) { bestD = d; bestI = i; }
  }
  return Math.max(0, Math.min(1, cum[bestI] / total));
}

/** Real GPS tracker. */
export class GpsRunTracker {
  /** @param {LatLng[]} [route] the arena route (for map projection); optional for free runs */
  constructor(route) {
    this.route = route || null;
    /** @type {LatLng[]} */ this.coords = [];
    this.km = 0;
    this.startAt = 0;
    this.watchId = null;
    this.last = /** @type {LatLng|null} */ (null);
    this.lastT = 0;
  }

  static get supported() {
    return typeof navigator !== 'undefined' && 'geolocation' in navigator;
  }

  /** @param {(t:Tick)=>void} onTick */
  start(onTick, onError) {
    if (!GpsRunTracker.supported) { onError && onError(new Error('no-geolocation')); return; }
    this.startAt = Date.now();
    this.watchId = navigator.geolocation.watchPosition(
      (p) => {
        const now = Date.now();
        const pos = /** @type {LatLng} */ ([p.coords.latitude, p.coords.longitude]);
        const acc = p.coords.accuracy ?? 999;
        if (acc > 40) return; // too imprecise to trust
        if (this.last) {
          const step = haversine(this.last, pos);           // km
          const dt = (now - this.lastT) / 1000;             // s
          const speed = dt > 0 ? (step * 1000) / dt : 0;    // m/s
          if (step * 1000 < 2) { /* jitter, ignore distance */ }
          else if (speed > 12) { /* > 43 km/h: GPS jump, reject */ this.last = pos; this.lastT = now; return; }
          else { this.km += step; this.coords.push(pos); }
        } else {
          this.coords.push(pos);
        }
        this.last = pos;
        this.lastT = now;
        const sec = (now - this.startAt) / 1000;
        const paceSec = this.km > 0.02 ? sec / this.km : 0;
        const frac = this.route ? fractionAlong(this.route, pos) : 0;
        onTick({ km: this.km, sec, paceSec, pos, frac });
      },
      (err) => onError && onError(err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );
  }

  stop() {
    if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
    return { km: this.km, sec: (Date.now() - this.startAt) / 1000, coords: this.coords.slice() };
  }
}

/** Simulated tracker — walks along a known route at a random-ish pace. */
export class SimRunTracker {
  /** @param {LatLng[]} coords @param {number} km */
  constructor(coords, km) {
    this.coords = coords;
    this.km = km;
    this.paceSec = 250 + Math.floor(Math.random() * 110); // 4:10 – ~6:00 /km
    this.finalSec = Math.round(km * this.paceSec);
    this.timer = null;
    this.t = 0;
    this.ticks = 90;
  }

  static get supported() { return true; }

  /** @param {(t:Tick)=>void} onTick @param {(s:{km:number,sec:number,coords:LatLng[]})=>void} [onDone] */
  start(onTick, onDone) {
    this.timer = setInterval(() => {
      this.t++;
      const frac = this.t / this.ticks;
      const sec = this.finalSec * frac;
      const km = this.km * frac;
      onTick({ km, sec, paceSec: this.paceSec, pos: pointAt(this.coords, frac), frac });
      if (this.t >= this.ticks) {
        this.stopTimer();
        if (onDone) onDone({ km: this.km, sec: this.finalSec, coords: this.coords.slice() });
      }
    }, 40);
  }

  stopTimer() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }

  stop() {
    this.stopTimer();
    return { km: this.km, sec: this.finalSec, coords: this.coords.slice() };
  }
}
