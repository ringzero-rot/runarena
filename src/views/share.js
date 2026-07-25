// @ts-check
import { $ } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { SHARE_BASE } from '../config.js';

/** Native share of an arena invite link (falls back to clipboard). */
export async function shareArena(routeId, routeName) {
  const url = SHARE_BASE + '#/r/' + encodeURIComponent(routeId);
  const text = `มาท้าชิงเวลาที่ “${routeName}” ใน RunArena กัน! 🏃‍♂️👑`;
  try {
    if (navigator.share) { await navigator.share({ title: 'RunArena', text, url }); return 'shared'; }
  } catch { return 'cancel'; }
  try { await navigator.clipboard.writeText(text + ' ' + url); return 'copied'; } catch { return 'fail'; }
}

function closeOverlay(id) {
  const o = $(id);
  if (o) o.remove();
}

/** Draw the brag card onto the canvas. Canvas text is not HTML — safe. */
function drawCard(title, ep, routeName, time, rank) {
  const c = /** @type {HTMLCanvasElement} */ ($('sharecanvas'));
  if (!c) return;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 800, 1000);
  g.addColorStop(0, '#231d10'); g.addColorStop(0.55, '#15140d'); g.addColorStop(1, '#0E1014');
  x.fillStyle = g; x.fillRect(0, 0, 800, 1000);
  x.strokeStyle = 'rgba(245,184,61,.5)'; x.lineWidth = 6; x.strokeRect(20, 20, 760, 960);
  x.textAlign = 'center';
  x.fillStyle = '#F5B83D'; x.font = '700 130px sans-serif'; x.fillText('👑', 400, 190);
  x.font = '800 44px sans-serif'; x.fillStyle = '#F5B83D';
  wrap(x, title, 400, 290, 700, 54);
  x.font = '600 34px sans-serif'; x.fillStyle = '#f7e6b8'; x.fillText(ep, 400, 430);
  x.strokeStyle = 'rgba(245,184,61,.35)'; x.lineWidth = 2; x.beginPath(); x.moveTo(120, 480); x.lineTo(680, 480); x.stroke();
  x.fillStyle = '#9AA3B2'; x.font = '500 26px sans-serif'; x.fillText(routeName, 400, 540);
  x.fillStyle = '#F2F4F7'; x.font = '800 120px sans-serif'; x.fillText(time, 400, 680);
  x.fillStyle = '#9AA3B2'; x.font = '500 24px sans-serif'; x.fillText('อันดับ #' + rank + ' ของสนาม', 400, 730);
  x.fillStyle = '#FF5630'; x.font = '800 34px sans-serif'; x.fillText('RUNARENA', 400, 900);
  x.fillStyle = '#5D6675'; x.font = '500 22px sans-serif'; x.fillText('มาท้าชิงกันไหม?', 400, 940);
}

/** A shareable quote card for the coach's line. */
export function openCoachCard(coach, quote) {
  const o = document.createElement('div');
  o.className = 'overlay'; o.id = 'coachCardOverlay';
  o.innerHTML = `<div class="sheet"><div class="eyebrow">คำคมโค้ช</div><h2>การ์ดคำคม ${coach.name}</h2>
    <canvas id="coachcanvas" width="800" height="800"></canvas>
    <button class="btn gold" id="ccShare">📤 แชร์ไป LINE / IG</button>
    <button class="btn ghost small" id="ccDl" style="margin-top:8px">⬇ บันทึกรูป</button>
    <button class="btn ghost small" id="ccClose" style="margin-top:8px">ปิด</button></div>`;
  document.body.appendChild(o);
  const text = `${coach.name}: “${quote}”`;
  $('ccShare').addEventListener('click', () => {
    const c = /** @type {HTMLCanvasElement} */ ($('coachcanvas'));
    c.toBlob(async (blob) => {
      const file = blob ? new File([blob], 'coach.png', { type: 'image/png' }) : null;
      try {
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ title: 'RunArena', text, files: [file] });
        else if (navigator.share) await navigator.share({ title: 'RunArena', text, url: SHARE_BASE });
        else { if (navigator.clipboard) navigator.clipboard.writeText(text + ' ' + SHARE_BASE).catch(() => {}); toast('คัดลอกคำคมแล้ว 📤'); }
      } catch { /* cancelled */ }
    }, 'image/png');
  });
  $('ccDl').addEventListener('click', () => {
    const c = /** @type {HTMLCanvasElement} */ ($('coachcanvas'));
    const a = document.createElement('a'); a.download = 'coach-quote.png'; a.href = c.toDataURL('image/png'); a.click();
    toast('บันทึกการ์ดแล้ว 📸');
  });
  $('ccClose').addEventListener('click', () => closeOverlay('coachCardOverlay'));
  o.addEventListener('click', (e) => { if (e.target === o) closeOverlay('coachCardOverlay'); });
  setTimeout(() => drawCoachCard(coach, quote), 50);
}

function drawCoachCard(coach, quote) {
  const c = /** @type {HTMLCanvasElement} */ ($('coachcanvas'));
  if (!c) return;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 800, 800);
  g.addColorStop(0, '#241a2e'); g.addColorStop(0.6, '#171319'); g.addColorStop(1, '#0E1014');
  x.fillStyle = g; x.fillRect(0, 0, 800, 800);
  x.strokeStyle = 'rgba(255,86,48,.5)'; x.lineWidth = 6; x.strokeRect(20, 20, 760, 760);
  x.textAlign = 'center';
  x.font = '150px sans-serif'; x.fillText(coach.icon, 400, 220);
  x.fillStyle = '#FF5630'; x.font = '800 42px sans-serif'; x.fillText(coach.name, 400, 300);
  x.fillStyle = '#F2F4F7'; x.font = '600 44px sans-serif';
  wrap(x, '“' + quote + '”', 400, 410, 680, 60);
  x.fillStyle = '#FF5630'; x.font = '800 34px sans-serif'; x.fillText('RUNARENA', 400, 715);
  x.fillStyle = '#5D6675'; x.font = '500 22px sans-serif'; x.fillText('มาโดนแซวกันไหม?', 400, 752);
}

function wrap(x, txt, cx, cy, max, lh) {
  const chars = [...String(txt)];
  let line = ''; const lines = [];
  chars.forEach((ch) => {
    const t = line + ch;
    if (x.measureText(t).width > max) { lines.push(line); line = ch; }
    else line = t;
  });
  lines.push(line);
  lines.forEach((l, i) => x.fillText(l, cx, cy + i * lh));
}

/** Open the share sheet and render the card. */
export function openShare(title, ep, routeName, time, rank, routeId) {
  const o = document.createElement('div');
  o.className = 'overlay'; o.id = 'shareOverlay';
  o.innerHTML = `<div class="sheet"><div class="eyebrow">ขิงเพื่อน</div><h2>การ์ดฉายาของคุณ</h2>
    <canvas id="sharecanvas" width="800" height="1000"></canvas>
    <button class="btn gold" id="shareCard">📤 แชร์ไป LINE / IG</button>
    <button class="btn ghost small" id="dlCard" style="margin-top:8px">⬇ บันทึกรูป</button>
    <button class="btn ghost small" id="copyBrag" style="margin-top:8px">📋 คัดลอกข้อความ + ลิงก์</button>
    <button class="btn ghost small" id="closeShare" style="margin-top:8px">ปิด</button></div>`;
  document.body.appendChild(o);
  const link = SHARE_BASE + (routeId ? '#/r/' + encodeURIComponent(routeId) : '');
  const brag = `ข้าคือ ${title} • ${ep} ⚡ มาท้าชิงกันไหม! #RunArena`;
  $('shareCard').addEventListener('click', async () => {
    const c = /** @type {HTMLCanvasElement} */ ($('sharecanvas'));
    c.toBlob(async (blob) => {
      const file = blob ? new File([blob], 'runarena.png', { type: 'image/png' }) : null;
      try {
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ title: 'RunArena', text: brag, files: [file] });
        } else if (navigator.share) {
          await navigator.share({ title: 'RunArena', text: brag, url: link });
        } else {
          if (navigator.clipboard) navigator.clipboard.writeText(brag + ' ' + link).catch(() => {});
          toast('อุปกรณ์นี้แชร์ตรงไม่ได้ — คัดลอกข้อความให้แล้ว');
        }
      } catch { /* user cancelled */ }
    }, 'image/png');
  });
  $('dlCard').addEventListener('click', () => {
    const c = /** @type {HTMLCanvasElement} */ ($('sharecanvas'));
    const a = document.createElement('a');
    a.download = 'runarena-card.png'; a.href = c.toDataURL('image/png'); a.click();
    toast('บันทึกการ์ดแล้ว 🎴');
  });
  $('copyBrag').addEventListener('click', () => {
    if (navigator.clipboard) navigator.clipboard.writeText(brag + ' ' + link).catch(() => {});
    toast('คัดลอกข้อความ + ลิงก์แล้ว 📋');
  });
  $('closeShare').addEventListener('click', () => closeOverlay('shareOverlay'));
  setTimeout(() => drawCard(title, ep, routeName, time, rank), 50);
}
