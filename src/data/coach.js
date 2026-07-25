// @ts-check
/**
 * "โค้ชแซ่บ" 🌶️ — a savage/hype Thai AI commentator. Reacts to your runs, rank,
 * streak and rivals with sassy-but-friendly lines built for screenshots + ขิง.
 * Pure rule-based: picks a contextual line from big pools and fills in names.
 *
 * @typedef {{ name?:string, rank?:number, rival?:string, streak?:number,
 *   level?:number, routeName?:string, improved?:number|null, isBest?:boolean,
 *   kings?:number }} CoachData
 */

export const COACH_NAME = 'โค้ชแซ่บ';
export const COACH_ICON = '🌶️';

const P = {
  // home greeting — general sass/hype
  daily: [
    'มายืนดูเฉย ๆ เหรอ? สนามมันไม่วิ่งเองนะจ๊ะ 🏃',
    'วันนี้อากาศดี เหมาะกับการไปล้มบัลลังก์ใครสักคน 👑',
    'สถิติไม่ขยับเองหรอกนะ ขยับขาก่อนสิ 🔥',
    'คู่ปรับกำลังซ้อมอยู่ตอนนี้เลย… แล้วเธอล่ะ? 😏',
    'เลื่อนดูอย่างเดียวไม่ได้ XP นะเธอ 😌',
    'เก่งในหัวไม่นับ ออกไปวิ่งให้เห็นกับตา 💪',
    'มีสนามให้พิชิตเต็มไปหมด รออะไรอยู่ล่ะ! 🗺️',
    'วันนี้จะเป็นราชา หรือเป็นคนดูเขาเป็นราชา? เลือกเอา 👑',
  ],
  streakHi: [
    'สตรีค {streak} วัน! สายแข็งของจริง อย่าให้หลุดล่ะ 🔥',
    '{streak} วันติด?! ขยันจนคู่แข่งเริ่มกลัวแล้วนะ 😎',
  ],
  streakLo: [
    'สตรีคแค่ {streak} วัน… แมวข้างบ้านยังตื่นเช้ากว่า 🐱',
    'สตรีคบาง ๆ แบบนี้ เดี๋ยวก็หลุด รีบไปวิ่ง! ⏰',
  ],
  // before starting a challenge
  preRun: [
    'สนาม “{route}” รอเธออยู่ ไปทำเวลาให้โลกจำ! 🔥',
    'เข้าไปเลย! วิ่งให้เหมือนมีหมาไล่ 🐕💨',
    'ราชาคนปัจจุบันน่ะเหรอ? เดี๋ยวก็ตกบัลลังก์ ไปเลย! 👑',
    'หายใจเข้าลึก ๆ… แล้วออกไปซัดให้สุด! 💥',
  ],
  // became #1
  king: [
    '#1?! ราชาตัวจริงเสียงจริง! แคปหน้าจอไปขิงเลย 👑📸',
    'บัลลังก์เป็นของเธอแล้ว! ใครไม่ยอมก็ให้มันมาแย่ง 😤👑',
    'เร็วขนาดนี้ ผีแชมป์ยังตามไม่ทัน! สุดยอดไปเลย 🔥',
    'จารึกชื่อไว้ได้เลย — ราชาแห่ง{route} 👑',
  ],
  top3: [
    'ติด Top 3! อีกนิดเดียวก็ถึงบัลลังก์แล้ว ดันต่อ! 🥈',
    'เกือบแล้ว! ราชาเริ่มเหงื่อแตกแล้วนะเนี่ย 😏',
  ],
  mid: [
    'อันดับ #{rank}… ซ้อมมาแบบนี้เหรอจ๊ะ? 😏 เอาใหม่!',
    'ยังไกลบัลลังก์อยู่นะ แต่ไม่เป็นไร ค่อย ๆ ไต่ 🧗',
    'อันดับ #{rank} — คู่ปรับหัวเราะอยู่นะ ไปเอาคืน! 😤',
    'ไม่เป็นไร ทุกตำนานเริ่มจากอันดับกลาง ๆ ทั้งนั้นแหละ 💪',
  ],
  slower: [
    'ช้ากว่าเดิมนะเนี่ย… เมื่อวานนอนดึกเล่นมือถือใช่ไหม 😴',
    'สถิติเดิมยังดีกว่า! เอาใหม่ ครั้งนี้เอาจริงนะ 😤',
  ],
  best: [
    'สถิติใหม่! นี่แหละของจริง ไปต่อเลย 🚀',
    'เร็วขึ้นอีกแล้ว! ร่างกายเริ่มโกงแล้วนะเธอ 😎',
  ],
  newArena: [
    'เปิดสนามใหม่?! เท่ระดับตำนาน คนอื่นได้มาตามรอยแน่ 🗺️👑',
    'สนามนี้เธอเป็นคนสร้าง — ก็ต้องเป็นราชาคนแรกสิ! 🔥',
  ],
  rival: [
    '{rival} เร็วกว่าเธอนิดเดียว… จะปล่อยให้มันยิ้มเหรอ? 😼',
    'คู่ปรับ {rival} กำลังไล่มา ท้าดวลเลยสิ รออะไร! ⚔️',
  ],
};

function pick(arr, seed) {
  return arr[Math.abs(seed) % arr.length];
}
function fill(s, d) {
  return s
    .replace('{name}', d.name || 'เธอ')
    .replace('{rank}', String(d.rank ?? '-'))
    .replace('{rival}', d.rival || 'คู่ปรับ')
    .replace('{streak}', String(d.streak ?? 0))
    .replace('{route}', d.routeName || 'สนามนี้');
}

/**
 * Get a coach line for a context.
 * @param {string} ctx daily|preRun|king|top3|mid|slower|best|newArena|rival
 * @param {CoachData} [data]
 * @param {number} [seed] optional seed to vary the pick
 * @returns {string}
 */
export function coachSay(ctx, data = {}, seed = Date.now()) {
  let pool = P[ctx];
  // smarter "daily": weave in streak flavour sometimes
  if (ctx === 'daily') {
    if ((data.streak ?? 0) >= 7 && seed % 3 === 0) pool = P.streakHi;
    else if ((data.streak ?? 0) <= 2 && seed % 3 === 1) pool = P.streakLo;
  }
  if (!pool || !pool.length) pool = P.daily;
  return fill(pick(pool, seed), data);
}
