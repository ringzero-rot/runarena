// @ts-check
import { esc } from '../ui/dom.js';
import { getState, myRank, myPace, uid, personalRecords, runHistory } from '../state/store.js';
import { epithet, rankTitle } from '../core/epithet.js';
import { division } from '../core/division.js';
import { fmt, pace } from '../core/format.js';
import { VERSION, BUILD } from '../version.js';

// Local, view-only seed to reroll the demo epithet.
let profSeed = 0;
export function rerollEpithet() { profSeed++; }

function timeAgo(iso) {
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1) return 'วันนี้';
  if (d < 2) return 'เมื่อวาน';
  return Math.floor(d) + ' วันก่อน';
}

function runRow(r) {
  return `<div class="histrow">
    <div class="histic">${r.king ? '👑' : r.rank <= 3 ? '🎯' : '🏁'}</div>
    <div class="histinfo"><div class="histname">${esc(r.routeName)}</div>
      <div class="histmeta">${timeAgo(r.date)} · อันดับ #${r.rank}${r.mode === 'gps' ? ' · GPS' : ''}</div></div>
    <div class="histtime">${fmt(r.sec)}<small>${pace(r.sec, r.km)}/กม.</small></div>
  </div>`;
}

export function profileView() {
  const st = getState();
  const ran = Object.keys(st.results).length;
  const kings = st.routes.filter((r) => myRank(r.id) === 1).length;
  const dv = division(myPace());
  const demoR = st.routes[profSeed % st.routes.length];
  const seededUid = uid() + ':' + profSeed;
  const pr = personalRecords();
  const history = runHistory();

  const BADGES = [
    ['🌅', 'นักวิ่งรุ่งอรุณ', true],
    ['👑', 'ราชาสนามแรก', kings > 0],
    ['🔥', 'สตรีค 7 วัน', st.streak >= 7],
    ['⚡', 'เพซต่ำกว่า 5:00', myPace() < 300],
    ['🗺️', 'เปิดสนามใหม่', st.customRoutes.length > 0], // fixed: legacy hardcoded false
    ['🏃', 'วิ่งครบ 5 สนาม', ran >= 5],
    ['💯', 'พอยต์ครบ 1000', st.points >= 1000],
    ['🥇', 'ติด Top 3', st.routes.some((r) => { const k = myRank(r.id); return k != null && k <= 3; })],
  ];
  const SRC = [
    ['จับเวลาในแอป (GPS)', 'เชื่อมต่อแล้ว', 'var(--trace)'],
    ['Apple Health (iOS)', 'พร้อมต่อ', 'var(--mid)'],
    ['Health Connect (Android)', 'พร้อมต่อ', 'var(--mid)'],
    ['Garmin Connect', 'ต่อเพิ่มได้', 'var(--gold)'],
    ['Strava', 'ตัดออกตามนโยบาย', 'var(--sunrise)'],
  ];

  return `<div class="phead"><div class="bigav">${esc(st.user.initial)}</div>
      <div class="uname">${esc(st.user.name)}</div>
      <div class="umeta">ติดตาม ${st.favorites.size} สนาม • วิ่งแล้ว ${ran} สนาม • 🔥 ${st.streak} วัน</div>
      <div class="divchip" style="color:${dv.color};border-color:${dv.color}66">ดิวิชั่น ${dv.name} • เพซเฉลี่ย ${fmt(myPace())}/กม.</div></div>
    <div class="seg">📊 สถิติส่วนตัว</div>
    <div class="prgrid">
      <div class="pr"><b>${pr.totalRuns}</b><span>วิ่งทั้งหมด</span></div>
      <div class="pr"><b>${pr.totalKm.toFixed(1)}</b><span>กม. รวม</span></div>
      <div class="pr"><b>${pr.bestPace ? fmt(pr.bestPace) : '—'}</b><span>เพซดีสุด/กม.</span></div>
      <div class="pr"><b>${pr.longest.toFixed(1)}</b><span>ไกลสุด (กม.)</span></div>
    </div>
    <div class="seg">🗒️ ประวัติการวิ่ง</div>
    ${history.length ? history.slice(0, 8).map(runRow).join('') : '<div class="hint">ยังไม่มีประวัติ — ออกไปวิ่งสนามแรกกันเลย!</div>'}
    <div class="seg">🎖️ เหรียญตรา</div>
    <div class="badges">${BADGES.map(([i, n, on]) => `<div class="bg ${on ? '' : 'off'}"><div class="i">${i}</div><div class="n">${esc(n)}</div></div>`).join('')}</div>
    <div class="seg">ฉายาของคุณ (ถ้าขึ้นอันดับ 1)</div>
    <div class="gencard"><div style="font-size:28px">🏅</div>
      <div class="gentitle">${esc(rankTitle(1, demoR.name, seededUid))}</div>
      <div class="genep">${esc(epithet(seededUid, demoR.id))}</div>
      <button class="btn" style="margin-top:13px" data-action="rerollEpithet">🎲 สุ่มฉายาใหม่</button>
      <div class="hint">ฉายา = ตำแหน่งตามอันดับ + คำนำหน้า + พลัง + คุณสมบัติ • lock ตาม user ให้ไม่ซ้ำกัน</div></div>
    <div class="seg">แหล่งข้อมูลวิ่ง</div>
    <div style="background:var(--surface);border:1px solid var(--line);border-radius:15px;padding:13px 15px;margin-bottom:13px">
      ${SRC.map(([n, b, c]) => `<div class="srcrow"><span style="${c === 'var(--sunrise)' ? 'color:var(--mid);text-decoration:line-through' : 'color:var(--hi)'}">${esc(n)}</span>
        <span class="sbadge" style="color:${c};border:1px solid ${c}55">${esc(b)}</span></div>`).join('')}
      <div class="hint" style="text-align:left;margin-top:10px">ตัด Strava ออกเพราะนโยบายห้ามโชว์ข้อมูลคนอื่น/ทำ leaderboard ข้ามคน — ใช้ GPS เราเอง + Apple Health/Health Connect ที่นาฬิกาส่วนใหญ่ sync เข้าอยู่แล้วแทน</div></div>
    <div class="linkrow" role="button" tabindex="0" data-action="openSettings"><span>⚙️</span><span class="t">ตั้งค่า</span><span style="color:var(--dim)">›</span></div>
    <div class="linkrow" role="button" tabindex="0" data-action="logout"><span style="color:var(--sunrise)">⎋</span><span class="t" style="color:var(--sunrise)">ออกจากระบบ</span></div>
    <div class="verline">RunArena v${esc(VERSION)} · build ${esc(BUILD)}</div>`;
}
