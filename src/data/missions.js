// @ts-check
import { hash } from '../core/epithet.js';

/**
 * Daily mission pool. Each day the app picks 3 (deterministically by date) to
 * give runners a fresh reason to come back and play.
 * type drives progress tracking: 'run' | 'top3' | 'king' | 'newArena' | 'kudos' | 'distance'
 * @typedef {{ key:string, text:string, icon:string, type:string, goal:number, xp:number, points:number }} Mission
 */

/** @type {Mission[]} */
const POOL = [
  { key: 'run1',   text: 'วิ่งให้จบ 1 สนามวันนี้',        icon: '🏃', type: 'run',      goal: 1, xp: 80,  points: 40 },
  { key: 'run2',   text: 'วิ่ง 2 สนามในวันเดียว',          icon: '🔥', type: 'run',      goal: 2, xp: 140, points: 70 },
  { key: 'top3',   text: 'ติด Top 3 สักสนาม',              icon: '🥉', type: 'top3',     goal: 1, xp: 120, points: 60 },
  { key: 'king',   text: 'ยึดบัลลังก์ราชา 1 สนาม',         icon: '👑', type: 'king',     goal: 1, xp: 150, points: 80 },
  { key: 'newmap', text: 'ลองสนามที่ยังไม่เคยวิ่ง 1 แห่ง', icon: '🗺️', type: 'newArena', goal: 1, xp: 100, points: 50 },
  { key: 'kudos',  text: 'ส่งกำลังใจให้เพื่อน 3 ครั้ง',     icon: '👊', type: 'kudos',    goal: 3, xp: 60,  points: 30 },
  { key: 'dist5',  text: 'สะสมระยะวิ่ง 5 กม. วันนี้',       icon: '📏', type: 'distance', goal: 5, xp: 120, points: 60 },
];

/** Pick today's 3 missions deterministically from the date string (YYYY-MM-DD). */
export function pickDailyMissions(dateStr) {
  const idx = [];
  let h = hash(dateStr);
  while (idx.length < 3) {
    const i = h % POOL.length;
    if (!idx.includes(i)) idx.push(i);
    h = hash(dateStr + '#' + idx.length + i);
  }
  return idx.map((i) => ({ ...POOL[i], progress: 0, claimed: false }));
}
