// @ts-check
import { $ } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { getState } from '../state/store.js';
import { renderDrawMap, dispose, hasLeaflet } from '../ui/map.js';
import { pathKm } from '../core/geo.js';
import { runNewRoute } from './run.js';

let points = [];
let handle = null;

function closeDraw() {
  dispose('draw');
  const o = $('drawOverlay');
  if (o) o.remove();
  points = []; handle = null;
}

export function openDraw() {
  points = [];
  const o = document.createElement('div');
  o.className = 'overlay'; o.id = 'drawOverlay';
  o.innerHTML = `<div class="sheet">
    <div class="eyebrow">เปิดสนามใหม่</div><h2>วาดเส้นทางบนแผนที่จริง</h2>
    <p>แตะบนแผนที่เพื่อปักจุดเส้นทางที่คุณวิ่ง ระบบจะคำนวณระยะจริงจากพิกัดให้อัตโนมัติ</p>
    <div id="drawmap" style="height:260px;margin-bottom:10px"></div>
    <div class="runmetrics">
      <div class="rm"><div class="v" id="dKm">0.00</div><div class="k">ระยะจริง (กม.)</div></div>
      <div class="rm"><div class="v" id="dPts">0</div><div class="k">จุดที่ปัก</div></div>
    </div>
    <button class="btn" id="finishDraw">▶ วิ่งเส้นทางนี้เลย</button>
    <button class="btn ghost small" id="undoDraw" style="margin-top:8px">↶ ลบจุดล่าสุด</button>
    <button class="btn ghost small" id="cancelDraw" style="margin-top:8px">ยกเลิก</button>
  </div>`;
  document.body.appendChild(o);

  if (!hasLeaflet()) { toast('แผนที่โหลดไม่ได้ ลองเชื่อมเน็ตแล้วรีเฟรช'); }
  else setTimeout(() => {
    handle = renderDrawMap($('drawmap'), getState().here, (pt) => {
      points.push(pt);
      handle.redraw(points);
      update();
    });
  }, 60);

  $('undoDraw').addEventListener('click', () => { if (!points.length) return; points.pop(); if (handle) handle.redraw(points); update(); });
  $('cancelDraw').addEventListener('click', closeDraw);
  $('finishDraw').addEventListener('click', () => {
    if (points.length < 2) { toast('ปักอย่างน้อย 2 จุดก่อนนะ'); return; }
    const km = pathKm(points);
    if (km < 0.3) { toast('เส้นทางสั้นเกินไป (ขั้นต่ำ 300 ม.)'); return; }
    const pts = points.slice();
    closeDraw();
    runNewRoute(pts, km);
  });
}

function update() {
  if ($('dKm')) $('dKm').textContent = pathKm(points).toFixed(2);
  if ($('dPts')) $('dPts').textContent = String(points.length);
}
