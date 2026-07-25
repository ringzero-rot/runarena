// @ts-check
import { $ } from '../ui/dom.js';
import { toast } from '../ui/toast.js';

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
export function openShare(title, ep, routeName, time, rank) {
  const o = document.createElement('div');
  o.className = 'overlay'; o.id = 'shareOverlay';
  o.innerHTML = `<div class="sheet"><div class="eyebrow">ขิงเพื่อน</div><h2>การ์ดฉายาของคุณ</h2>
    <canvas id="sharecanvas" width="800" height="1000"></canvas>
    <button class="btn gold" id="dlCard">⬇ บันทึกรูปไปโพสต์</button>
    <button class="btn ghost small" id="copyBrag" style="margin-top:8px">📋 คัดลอกข้อความขิง</button>
    <button class="btn ghost small" id="closeShare" style="margin-top:8px">ปิด</button></div>`;
  document.body.appendChild(o);
  $('dlCard').addEventListener('click', () => {
    const c = /** @type {HTMLCanvasElement} */ ($('sharecanvas'));
    const a = document.createElement('a');
    a.download = 'runarena-card.png'; a.href = c.toDataURL('image/png'); a.click();
    toast('บันทึกการ์ดแล้ว 🎴');
  });
  $('copyBrag').addEventListener('click', () => {
    const s = `ข้าคือ ${title} • ${ep} ⚡ มาท้าชิงกันไหม! #RunArena`;
    if (navigator.clipboard) navigator.clipboard.writeText(s).catch(() => {});
    toast('คัดลอกข้อความขิงแล้ว 📋');
  });
  $('closeShare').addEventListener('click', () => closeOverlay('shareOverlay'));
  setTimeout(() => drawCard(title, ep, routeName, time, rank), 50);
}
