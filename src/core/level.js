// @ts-check
/**
 * XP → level progression. Gives runners a long-term "just one more run" hook.
 * XP to advance from level L to L+1 grows linearly: 200 + (L-1)*150.
 */

const TITLES = [
  [1, 'มือใหม่หัดวิ่ง', '🌱'],
  [3, 'นักวิ่งสมัครเล่น', '🏃'],
  [5, 'ขาแรงประจำสนาม', '💪'],
  [8, 'นักล่าสถิติ', '🎯'],
  [11, 'จ้าวความเร็ว', '⚡'],
  [15, 'เทพแห่งสนาม', '👑'],
  [20, 'ตำนานนักวิ่ง', '🔥'],
];

function needFor(level) {
  return 200 + (level - 1) * 150;
}

function titleFor(level) {
  let t = TITLES[0];
  for (const row of TITLES) if (level >= row[0]) t = row;
  return { name: t[1], icon: t[2] };
}

/**
 * @param {number} xp total accumulated XP
 * @returns {{ level:number, cur:number, next:number, pct:number, title:string, icon:string, total:number }}
 */
export function levelInfo(xp) {
  xp = Math.max(0, xp | 0);
  let level = 1, cum = 0;
  while (xp >= cum + needFor(level)) { cum += needFor(level); level++; }
  const cur = xp - cum;
  const next = needFor(level);
  const t = titleFor(level);
  return { level, cur, next, pct: Math.max(0, Math.min(1, cur / next)), title: t.name, icon: t.icon, total: xp };
}

/** Does adding `gain` XP cross a level boundary? Returns the new level or null. */
export function leveledUp(xpBefore, gain) {
  const a = levelInfo(xpBefore).level;
  const b = levelInfo(xpBefore + gain).level;
  return b > a ? b : null;
}
