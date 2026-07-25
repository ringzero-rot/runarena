// @ts-check
/**
 * Seed competitors and the deterministic leaderboard they produce.
 *
 * These stand in for other real users until a backend is connected. Times are
 * derived deterministically from a hash of (routeId | season) so a given board
 * is stable across renders but differs per route and per weekly season.
 * @typedef {{ userId:string, name:string, initial:string, sec:number }} Entry
 */
import { hash } from '../core/epithet.js';

/** @type {[string,string][]} name, initial */
const NPC = [
  ['กฤษณะ พ.','ก'],['อรอุมา ส.','อ'],['ธนา ว.','ธ'],['ปุณยวีร์ ก.','ป'],
  ['Mark T.','M'],['สุชาดา ม.','ส'],['เจษฎา ร.','จ'],['Yuki H.','Y'],
];

/** @type {Record<string, Entry[]>} */
const cache = {};

/**
 * Deterministic competitor times for a route+season.
 * @param {string} routeId
 * @param {number} km
 * @param {string} season 'all' | 'week'
 * @returns {Entry[]}
 */
export function competitorTimes(routeId, km, season = 'all') {
  const key = routeId + '|' + season;
  if (cache[key]) return cache[key];
  const h = hash(key);
  const arr = NPC.map((n, i) => {
    const paceBase = 245 + ((h >> (i % 8)) % 40) + i * 11; // ~4:05 – ~6:00 /km
    const weekWobble = season === 'week' ? 1 + ((h >> i) % 9) / 100 : 1;
    return { userId: 'u' + i, name: n[0], initial: n[1], sec: Math.round(km * paceBase * weekWobble) };
  });
  cache[key] = arr;
  return arr;
}
