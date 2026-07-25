// @ts-check
import { $ } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { getSettings, setSetting } from '../state/store.js';
import { VERSION, BUILD } from '../version.js';
import { openOnboarding } from './onboarding.js';
import { COACHES, getCoach } from '../data/coach.js';

export function openSettings() {
  const st = getSettings();
  const o = document.createElement('div');
  o.className = 'overlay';
  o.id = 'settingsOverlay';
  o.innerHTML = `<div class="sheet">
    <div class="eyebrow">ตั้งค่า</div><h2>ตั้งค่า</h2>
    <div class="seg" style="margin-top:2px">🎭 เลือกโค้ชของคุณ</div>
    <div class="coachpick">
      ${Object.values(COACHES).map((c) => `<button class="coachopt ${st.coachId === c.id ? 'on' : ''} ${c.pro ? 'locked' : ''}" data-coach="${c.id}">
        <div class="coi">${c.icon}</div><div class="con">${c.name}</div>${c.pro ? '<div class="colock">✦ PRO</div>' : ''}</button>`).join('')}
    </div>
    <div class="setrow">
      <div class="setinfo"><b>โค้ชเสียงตอนวิ่ง</b><span>ประกาศระยะ + เพซทุกกิโลเมตร</span></div>
      <button class="toggle ${st.voice ? 'on' : ''}" data-set="voice" aria-label="สลับโค้ชเสียง"><i></i></button>
    </div>
    <div class="setrow">
      <div class="setinfo"><b>โหมดส่วนตัว</b><span>ซ่อนตำแหน่งเริ่มต้นไม่ให้คนอื่นเห็น</span></div>
      <button class="toggle ${st.ghostMode ? 'on' : ''}" data-set="ghostMode" aria-label="สลับโหมดส่วนตัว"><i></i></button>
    </div>
    <div class="setrow">
      <div class="setinfo"><b>เป้าหมายต่อสัปดาห์</b><span>ตั้งเป้าระยะวิ่ง (กม./สัปดาห์)</span></div>
      <div class="stepper"><button id="goalDown" aria-label="ลด">−</button><span id="goalVal">${st.weeklyGoalKm || 20}</span><button id="goalUp" aria-label="เพิ่ม">+</button></div>
    </div>
    <button class="btn ghost small" id="replayOnboard" style="margin-top:10px">▶ ดูวิธีใช้อีกครั้ง</button>
    <button class="btn ghost small" id="resetData" style="margin-top:8px;color:var(--sunrise);border-color:rgba(255,86,48,.35)">🗑 ล้างข้อมูลทั้งหมด</button>
    <button class="btn ghost small" id="closeSet" style="margin-top:8px">ปิด</button>
    <div class="verline">RunArena v${VERSION} · build ${BUILD}</div>
  </div>`;
  document.body.appendChild(o);

  o.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', () => {
    const k = b.getAttribute('data-set');
    const next = !getSettings()[k];
    setSetting(k, next);
    b.classList.toggle('on', next);
  }));
  o.querySelectorAll('[data-coach]').forEach((b) => b.addEventListener('click', () => {
    const id = b.getAttribute('data-coach');
    const c = getCoach(id);
    if (c.pro) { toast('โค้ช “' + c.name + '” เฉพาะ RunArena Pro — เร็ว ๆ นี้! ✦'); return; }
    setSetting('coachId', id);
    o.querySelectorAll('.coachopt').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    toast('เปลี่ยนเป็น ' + c.name + ' แล้ว ' + c.icon);
  }));
  const setGoal = (delta) => {
    const cur = getSettings().weeklyGoalKm || 20;
    const next = Math.max(5, Math.min(100, cur + delta));
    setSetting('weeklyGoalKm', next);
    $('goalVal').textContent = String(next);
  };
  $('goalDown').addEventListener('click', () => setGoal(-5));
  $('goalUp').addEventListener('click', () => setGoal(5));
  $('replayOnboard').addEventListener('click', () => { o.remove(); openOnboarding(); });
  $('resetData').addEventListener('click', () => {
    if (confirm('ล้างข้อมูลทั้งหมดและเริ่มใหม่?')) { localStorage.removeItem('runarena:v2'); location.reload(); }
  });
  $('closeSet').addEventListener('click', () => o.remove());
  o.addEventListener('click', (e) => { if (e.target === o) o.remove(); });
}
