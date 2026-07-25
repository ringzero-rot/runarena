// @ts-check
/**
 * Nickname ("ฉายา") engine.
 *
 * Design notes carried over from the original and hardened:
 *  - FNV-1a's low bits are weak, so we mix (avalanche) before taking a modulo.
 *  - Every structure uses all 3 components -> larger, better-distributed space.
 *  - The epithet is keyed by (userId | routeId). IMPORTANT: always pass the
 *    route *id* (not its name) so a user's signature nickname is identical on
 *    every screen. (The legacy profile view keyed by name, which desynced it.)
 *
 *  Space ≈ 16 × 14 × 10 × 3 = 6,720 combinations, ~5,981 unique after the
 *  duplicate-"แห่ง" guard.
 */

const PREFIX = ['ปีศาจ','สายฟ้า','มังกร','พายุ','เงา','นักล่า','จอมพลัง','อสูร','เทพ','ลมกรด','ไอ้เสือ','อัสนี','ราชสีห์','นินจา','พญายม','จอมโจร'];
const POWER  = ['ความเร็ว','สายลม','รุ่งอรุณ','ขาแรง','ทะยาน','สายฟ้า','ความอึด','บิดเวลา','เหนือเสียง','ไร้ปราณี','สุดขอบฟ้า','ไม่รู้จบ','พลังจักรวาล','ไฟลุก'];
const TRAIT  = ['ไร้เงา','ไม่เคยพ่าย','แห่งราตรี','สะท้านปฐพี','ผู้ไม่หลับใหล','ขาลุย','สายโหด','พันธุ์อึด','หัวใจเหล็ก','ตีนผี'];
const RANKTITLE = {
  1: ['ราชาแห่ง','เจ้าสนาม','จ้าวแห่ง','ผู้พิชิต'],
  2: ['รองราชาแห่ง','มือขวาแห่ง'],
  3: ['ขุนพลแห่ง','นักรบแห่ง'],
};

/**
 * FNV-1a hash with an avalanche finalizer (mix low bits up).
 * @param {string} s
 * @returns {number} unsigned 32-bit
 */
export function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return h >>> 0;
}

/** @param {string[]} a @param {number} s */
function pick(a, s) {
  return a[s % a.length];
}

/**
 * Deterministic unique-ish nickname for a user on a given route.
 * @param {string} userId
 * @param {string} routeId
 * @returns {string}
 */
export function epithet(userId, routeId) {
  const k = userId + '|' + routeId;
  const a = pick(PREFIX, hash(k + '#p'));
  const b = pick(POWER, hash(k + '#w'));
  const c = pick(TRAIT, hash(k + '#t'));
  const s = hash(k + '#s') % 3;
  const cStartsWithHaeng = c.indexOf('แห่ง') === 0; // avoid "แห่ง" appearing twice
  if (s === 0 || cStartsWithHaeng) return a + b + c;       // ปีศาจความเร็วไร้เงา
  if (s === 1) return a + 'แห่ง' + b + c;                   // ปีศาจแห่งความเร็วไร้เงา
  return a + c + 'แห่ง' + b;                                // ปีศาจไร้เงาแห่งความเร็ว
}

/**
 * Rank title (only for podium places), e.g. "ราชาแห่งสวนลุมพินี".
 * @param {number} rank
 * @param {string} routeName
 * @param {string} userId
 * @returns {string|null}
 */
export function rankTitle(rank, routeName, userId) {
  const p = RANKTITLE[rank];
  if (!p) return null;
  return pick(p, hash(userId + routeName + rank)) + routeName;
}
