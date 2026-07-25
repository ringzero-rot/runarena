// @ts-check
/**
 * Run controller. Owns the run overlay lifecycle for both arena challenges and
 * newly-drawn routes, and for both real-GPS and simulated tracking.
 */
import { $, esc } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { getState, leaderboard, recordResult, addRoute, pushNotif, openRoute, uid } from '../state/store.js';
import { renderRunMap, dispose } from '../ui/map.js';
import { GpsRunTracker, SimRunTracker } from '../core/gps.js';
import { fmt, pace } from '../core/format.js';
import { epithet, rankTitle } from '../core/epithet.js';
import { openShare } from './share.js';

let tracker = null;

function closeRun() {
  if (tracker) { try { tracker.stop(); } catch { /* ignore */ } tracker = null; }
  dispose('run');
  const o = $('runOverlay');
  if (o) o.remove();
}

/** Public entrypoints. */
export function startChallenge(routeId) {
  const route = getState().routes.find((r) => r.id === routeId);
  if (route) openRunOverlay({ route });
}
export function runNewRoute(coords, km) {
  openRunOverlay({ newRoute: { coords, km } });
}

function openRunOverlay(opts) {
  const route = opts.route || null;
  const newRoute = opts.newRoute || null;
  const coords = newRoute ? newRoute.coords : route.coords;
  const km = newRoute ? newRoute.km : route.distanceKm;
  const ghost = route ? leaderboard(route.id, 'all')[0] : null;
  const ghostSec = ghost ? ghost.sec : null;

  const o = document.createElement('div');
  o.className = 'overlay'; o.id = 'runOverlay';
  o.innerHTML = `<div class="sheet">
    <div class="eyebrow">${newRoute ? 'กำลังเปิดเส้นทางใหม่' : 'พร้อมท้าชิง'}</div>
    <h2>${esc(newRoute ? 'วิ่งเส้นทางใหม่ของคุณ' : route.name)}</h2>
    <p>เลือกวิธีวิ่ง — วิ่งจริงระบบจะจับ GPS จริงและตรวจความสมจริงของสถิติ</p>
    <div id="runmap" style="height:180px;border-radius:14px;border:1px solid var(--line);margin-bottom:12px"></div>
    <div class="runmetrics">
      <div class="rm"><div class="v">${km.toFixed(2)}</div><div class="k">ระยะสนาม (กม.)</div></div>
      <div class="rm"><div class="v">${ghostSec ? fmt(ghostSec) : '—'}</div><div class="k">เวลาแชมป์</div></div>
    </div>
    <button class="btn" id="startGps">🛰️ วิ่งจริงด้วย GPS</button>
    <button class="btn gold small" id="startSim" style="margin-top:8px">▶️ จำลองการวิ่ง (เดโม)</button>
    <button class="btn ghost small" id="cancelRun" style="margin-top:8px">ยกเลิก</button></div>`;
  document.body.appendChild(o);

  setTimeout(() => renderRunMap($('runmap'), coords, !!ghostSec), 60);

  $('cancelRun').addEventListener('click', closeRun);
  $('startSim').addEventListener('click', () => beginRun('sim', { route, newRoute, coords, km, ghostSec }));
  $('startGps').addEventListener('click', () => {
    if (!GpsRunTracker.supported) { toast('อุปกรณ์นี้ไม่รองรับ GPS — ใช้โหมดจำลองแทน'); beginRun('sim', { route, newRoute, coords, km, ghostSec }); return; }
    beginRun('gps', { route, newRoute, coords, km, ghostSec });
  });
}

function liveHTML(ctx, mode) {
  const { km, ghostSec, newRoute, route } = ctx;
  return `<div class="sheet">
    <div class="eyebrow">${mode === 'gps' ? '🛰️ กำลังวิ่งจริง (GPS)' : 'กำลังจำลองการวิ่ง'}</div>
    <h2>${esc(newRoute ? 'เส้นทางใหม่ของคุณ' : route.name)}</h2>
    <p>${mode === 'gps' ? 'ออกวิ่งได้เลย — ระบบกำลังจับระยะและเพซจากตำแหน่งจริง' : '📡 นาฬิกากำลังจับ track — ดึงผลเข้าแอปอัตโนมัติเมื่อจบ'}</p>
    <div id="runmap" style="height:180px;border-radius:14px;border:1px solid var(--line);margin-bottom:12px"></div>
    ${ghostSec ? `<div class="ghostbar" id="ghostbar">🏃 กำลังไล่ผีของแชมป์…</div>` : ''}
    <div class="runbig"><div class="num" id="rKm">0.00</div><div class="unit">กิโลเมตร</div></div>
    <div class="ptrack"><div class="pfill" id="pfill"></div>${ghostSec ? '<div class="gmark" id="gmark"></div>' : ''}</div>
    <div class="runmetrics">
      <div class="rm"><div class="v" id="rTime">0:00</div><div class="k">เวลา</div></div>
      <div class="rm"><div class="v" style="color:var(--trace)" id="rPace">--:--</div><div class="k">เพซ /กม.</div></div>
      <div class="rm"><div class="v" style="color:var(--gold)" id="rLeft">${km.toFixed(2)}</div><div class="k">เหลือ (กม.)</div></div>
    </div>
    ${mode === 'gps' ? '<button class="btn" id="stopRun">⏹ จบการวิ่ง & บันทึกผล</button>' : ''}
    <button class="btn ghost small" id="cancelRun" style="margin-top:8px">ยกเลิก</button></div>`;
}

function beginRun(mode, ctx) {
  const { coords, km, ghostSec, route, newRoute } = ctx;
  const o = $('runOverlay');
  o.innerHTML = liveHTML(ctx, mode);
  const mapH = renderRunMap($('runmap'), coords, !!ghostSec);
  const progressPath = [coords[0]];

  const onTick = (t) => {
    const d = t.km;
    const prog = km > 0 ? Math.min(1, d / km) : 0;
    if ($('rKm')) $('rKm').textContent = d.toFixed(2);
    if ($('rTime')) $('rTime').textContent = fmt(t.sec);
    if ($('rPace')) $('rPace').textContent = t.paceSec ? fmt(t.paceSec) : '--:--';
    if ($('rLeft')) $('rLeft').textContent = Math.max(0, km - d).toFixed(2);
    if ($('pfill')) $('pfill').style.width = prog * 100 + '%';
    if (ghostSec) {
      const gp = Math.min(1, t.sec / ghostSec);
      const gm = $('gmark'); if (gm) gm.style.left = gp * 100 + '%';
      const gapSec = Math.round((prog - gp) * (ghostSec)); // +ve => leading
      const gb = $('ghostbar');
      if (gb) gb.innerHTML = gapSec >= 0
        ? `🏃 <span class="lead">นำผีแชมป์ ${Math.abs(gapSec)} วิ</span>`
        : `👻 <span class="behind">ตามหลังแชมป์ ${Math.abs(gapSec)} วิ</span>`;
      if (mapH) mapH.setGhost(pointAtFrac(coords, gp));
    }
    if (mapH) {
      mapH.setMe(t.pos);
      if (mode === 'gps') { progressPath.push(t.pos); mapH.setProgress(progressPath); }
      else mapH.setProgress(sliceTo(coords, t.frac, t.pos));
    }
  };

  const done = (summary) => finishRun({ route, newRoute, mode }, summary);

  if (mode === 'gps') {
    tracker = new GpsRunTracker(coords);
    tracker.start(onTick, (err) => {
      toast(err && err.code === 1 ? 'ไม่ได้รับสิทธิ์ GPS — ลองโหมดจำลอง' : 'จับ GPS ไม่ได้ ลองโหมดจำลอง');
    });
    const stopBtn = $('stopRun');
    if (stopBtn) stopBtn.addEventListener('click', () => { const s = tracker.stop(); tracker = null; done(s); });
  } else {
    tracker = new SimRunTracker(coords, km);
    tracker.start(onTick, (summary) => { tracker = null; done(summary); });
  }
  const cancel = $('cancelRun');
  if (cancel) cancel.addEventListener('click', closeRun);
}

/* small local helpers to avoid importing all of geo just for two ops */
import { pointAt } from '../core/geo.js';
function pointAtFrac(coords, frac) { return pointAt(coords, frac); }
function sliceTo(coords, frac, pos) {
  const n = Math.max(2, Math.ceil(coords.length * frac));
  return coords.slice(0, n).concat([pos]);
}

function finishRun(ctx, summary) {
  const { route, newRoute, mode } = ctx;
  const o = $('runOverlay');
  dispose('run');

  // Anti-cheat lite: a real GPS arena run that covered far less than the route
  // distance is treated as incomplete and not recorded.
  if (route && mode === 'gps' && summary.km < route.distanceKm * 0.6) {
    o.innerHTML = `<div class="sheet"><div class="eyebrow">ยังไม่ครบระยะ</div>
      <h2>วิ่งได้ ${summary.km.toFixed(2)} / ${route.distanceKm.toFixed(2)} กม.</h2>
      <p>ระยะที่จับได้ยังไม่ถึงเกณฑ์ของสนามนี้ ระบบจึงยังไม่บันทึกเป็นสถิติ (กันการนับไม่ครบรอบ) ลองวิ่งให้ครบเส้นทางแล้วค่อยจบนะ</p>
      <button class="btn ghost" id="closeIncomplete">ปิด</button></div>`;
    $('closeIncomplete').addEventListener('click', closeRun);
    return;
  }

  if (newRoute) {
    o.innerHTML = `<div class="sheet">
      <div class="eyebrow">ตรวจพบเส้นทางใหม่</div><h2>🆕 route นี้ยังไม่มีในระบบ</h2>
      <p>คุณเพิ่งวิ่ง ${summary.km.toFixed(2)} กม. บนเส้นทางที่ยังไม่เคยมีใครเปิด — ประกาศเป็น “สนาม Challenge” ให้คนอื่นมาท้าชิงไหม? ถ้าอนุมัติ ระบบจะ publish และแจ้งเตือนผู้ใช้ทุกคน</p>
      <input class="input" id="newName" placeholder="ตั้งชื่อสนาม เช่น เลียบคลองวิ่งยามเช้า" maxlength="60">
      <button class="btn gold" id="announceBtn">📢 ประกาศ & เปิดสนาม</button>
      <button class="btn ghost small" id="keepPrivate" style="margin-top:8px">ไว้ก่อน เก็บเป็นส่วนตัว</button></div>`;
    $('announceBtn').addEventListener('click', () => {
      const name = ($('newName').value || '').trim() || ('สนามใหม่ ' + summary.km.toFixed(1) + 'K');
      const coords = summary.coords.length >= 2 ? summary.coords : newRoute.coords;
      const id = addRoute(name, coords, summary.km, summary.sec);
      pushNotif('🏟️', `สนามใหม่ “${name}” ถูกเปิดแล้ว! (โดยคุณ) — ท้าชิงเลย`, true);
      closeRun();
      toast('ประกาศสนามสำเร็จ! แจ้งเตือนผู้ใช้ทุกคนแล้ว 📣');
      openRoute(id);
    });
    $('keepPrivate').addEventListener('click', closeRun);
    return;
  }

  // Arena result
  const res = recordResult(route.id, summary.sec, route.distanceKm);
  const king = res.rank === 1;
  const kt = king ? rankTitle(1, route.name, uid()) : null;
  const ep = epithet(uid(), route.id);
  if (king) {
    pushNotif('👑', `คุณคือ ${kt} คนใหม่! เวลา ${fmt(summary.sec)}`);
    setTimeout(() => { pushNotif('⚔️', 'มีคนกำลังไล่บัลลังก์คุณในสนามนี้ — รีบไปป้องกัน!', false, true); if (getState().view !== 'notifs') toast('⚔️ มีคนไล่บัลลังก์คุณแล้ว!'); }, 14000);
  } else {
    pushNotif('🏁', `จบ challenge ${route.name} — อันดับ #${res.rank}`);
  }

  const verifiedLine = mode === 'gps'
    ? '<div class="verified">✓ ตรวจสอบแล้ว: GPS จริง ระยะครบ เพซสมจริง</div>'
    : '<div class="verified" style="color:var(--mid);border-color:var(--line)">โหมดจำลอง (เดโม) — ไม่นับเป็นสถิติจริง</div>';

  const wonDuel = res.duelResults.find((d) => d.status === 'won');
  const lostDuel = res.duelResults.find((d) => d.status === 'lost');

  o.innerHTML = `<div class="sheet">
    <div class="resultBadge">
      <div class="eyebrow">ผลถูกดึงเข้าแอปแล้ว</div>
      <div class="rkbig">#${res.rank}</div>
      <div class="lab">จาก ${route.runners} คน • ${fmt(summary.sec)} • ${pace(summary.sec, route.distanceKm)}/กม.</div>
      <div class="rewardrow"><span class="rw pt">+${res.gained} พอยต์</span><span class="rw xp">+${res.xpGain} XP</span>${wonDuel ? '<span class="rw duel">⚔️ ชนะดวล +150</span>' : ''}</div>
      ${verifiedLine}
      ${king ? `<div class="kingTag">👑 ${esc(kt)}</div>` : ''}
      <div style="font-family:var(--disp);font-weight:600;color:#f7e6b8;margin-top:6px">${esc(ep)}</div>
    </div>
    ${res.levelUp ? `<div class="levelup">⭐ เลเวลอัพ! คุณคือเลเวล ${res.levelUp} แล้ว</div>` : ''}
    ${wonDuel ? `<div class="comeback">🏆 ชนะดวล ${esc(wonDuel.opponentName)}! เก็บ +150 XP</div>` : ''}
    ${lostDuel ? `<div class="hint">⚔️ ยังแพ้ดวล ${esc(lostDuel.opponentName)} อยู่ — ซ้อมแล้วท้าใหม่ได้</div>` : ''}
    ${res.improved && res.improved >= 5 ? `<div class="comeback">🔥 พุ่งขึ้น ${res.improved} อันดับ! เข้าเงื่อนไข Comeback Reward</div>` : ''}
    ${!res.isBest ? `<div class="hint">ครั้งนี้ช้ากว่าสถิติเดิม — อันดับยึดเวลาที่ดีที่สุด</div>` : ''}
    <button class="btn gold" id="shareBtn" style="margin-top:10px">🎴 สร้างการ์ดขิงเพื่อน</button>
    <button class="btn" id="seeBoard" style="margin-top:8px">ดูอันดับในสนาม</button></div>`;

  if (king || res.levelUp || wonDuel) confetti();

  $('shareBtn').addEventListener('click', () => {
    openShare(kt || ('อันดับ #' + res.rank + ' แห่ง' + route.name), ep, route.name, fmt(summary.sec), res.rank);
  });
  $('seeBoard').addEventListener('click', () => { closeRun(); openRoute(route.id); });
}

/** Lightweight confetti burst for celebratory moments. */
function confetti() {
  const colors = ['#FF5630', '#F5B83D', '#28E0C8', '#4defd8', '#f7cb6b'];
  const wrap = document.createElement('div');
  wrap.className = 'confetti';
  for (let i = 0; i < 70; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + '%';
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = (Math.random() * 0.5) + 's';
    p.style.animationDuration = (1.6 + Math.random() * 1.2) + 's';
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    wrap.appendChild(p);
  }
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 3200);
}
