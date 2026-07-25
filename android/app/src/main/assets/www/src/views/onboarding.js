// @ts-check
import { $ } from '../ui/dom.js';
import { completeOnboarding } from '../state/store.js';

const SLIDES = [
  { icon: '🏟️', title: 'ทุกเส้นทางคือสนามประลอง', text: 'เลือกสนามวิ่งจริงใกล้ตัวจากแผนที่ แล้วออกไปวิ่งจับเวลา — ระบบจัดอันดับให้อัตโนมัติ' },
  { icon: '👑', title: 'ทำเวลาดีสุด = ขึ้นเป็นราชา', text: 'ครองอันดับ 1 ของสนาม รับ“ฉายา”ไม่ซ้ำใคร แล้วป้องกันบัลลังก์ไว้ให้ได้' },
  { icon: '⚔️', title: 'ท้าดวล เก็บเลเวล ขิงกัน', text: 'ท้าดวลเพื่อน ทำภารกิจรายวัน สะสม XP เลื่อนเลเวล แล้วแชร์การ์ดขิงให้เพื่อน!' },
];

/** First-run teaching flow (also replayable from settings). */
export function openOnboarding() {
  let i = 0;
  const o = document.createElement('div');
  o.className = 'overlay';
  o.id = 'onboardOverlay';
  document.body.appendChild(o);

  const finish = () => { o.remove(); completeOnboarding(); };

  const render = () => {
    const s = SLIDES[i];
    const last = i === SLIDES.length - 1;
    o.innerHTML = `<div class="sheet onboard">
      <div class="obicon">${s.icon}</div>
      <h2>${s.title}</h2>
      <p>${s.text}</p>
      <div class="obdots">${SLIDES.map((_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('')}</div>
      <button class="btn" id="obNext">${last ? 'เริ่มเลย ⚡' : 'ถัดไป'}</button>
      ${last ? '' : '<button class="btn ghost small" id="obSkip" style="margin-top:8px">ข้าม</button>'}
    </div>`;
    $('obNext').addEventListener('click', () => { if (last) finish(); else { i++; render(); } });
    const skip = $('obSkip');
    if (skip) skip.addEventListener('click', finish);
  };
  render();
}
