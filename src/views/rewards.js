// @ts-check
import { esc } from '../ui/dom.js';
import { getState, myRank } from '../state/store.js';
import { SPONSORS } from '../data/sponsors.js';

export function rewardsView() {
  const st = getState();
  const kings = st.routes.filter((r) => myRank(r.id) === 1);
  const elig = kings.filter((r) => [10, 21, 42].some((d) => Math.abs(r.distanceKm - d) < 2));
  const shirtP = elig.length ? 0.62 : 0.2;
  return `<div class="eyebrow">แรงจูงใจให้วิ่งต่อ</div><h1 class="title">รางวัล & สิทธิประโยชน์</h1>
    <div class="sub">ทั้งของเราเองและจากสปอนเซอร์ — ให้สิทธิ์คนตั้งใจวิ่งจริง</div>
    <div class="procard">
      <div class="protop"><span class="probadge">✦ PRO</span><b>RunArena Pro</b></div>
      <ul class="prolist">
        <li>📊 วิเคราะห์การวิ่งเชิงลึก — กราฟเพซ/สปลิต/ความชัน</li>
        <li>⚔️ ท้าดวลไม่จำกัด + ดวลเดิมพันแต้ม</li>
        <li>👑 ฉายา & การ์ดขิงลายพิเศษเฉพาะ Pro</li>
        <li>🚫 ไม่มีโฆษณา + แผนซ้อมส่วนตัว</li>
      </ul>
      <button class="btn gold" data-action="proWaitlist">✦ สนใจ RunArena Pro</button>
      <div class="hint" style="margin-top:8px">เร็ว ๆ นี้ • กดเพื่อรับสิทธิ์ก่อนใครตอนเปิดตัว</div>
    </div>
    <div class="pointbox"><div class="k">พอยต์สะสมของคุณ</div><div class="v">${st.points.toLocaleString()}</div>
      <div class="k" style="margin-top:6px">🔥 วิ่งต่อเนื่อง ${st.streak} วัน • ครองบัลลังก์ ${kings.length} สนาม</div></div>
    <div class="seg">🏅 รางวัลของเราเอง</div>
    <div class="rcard"><div class="rhead"><div class="ricon">👕</div><div class="rtitle">เสื้อ King of (ลายเฉพาะสนาม)</div></div>
      <div class="rdetail">ครองอันดับ 1 ครบ 1 quarter ที่ระยะ 10 / 21 / 42 กม. ${elig.length ? `<span style="color:var(--gold)">— คุณเป็น King ของ ${elig.length} สนามที่เข้าเงื่อนไข!</span>` : ''}</div>
      <div class="track"><div class="fill" style="width:${shirtP * 100}%"></div></div><div class="pct">คืบหน้า ${Math.round(shirtP * 100)}% ของ quarter นี้</div></div>
    <div class="rcard"><div class="rhead"><div class="ricon">📈</div><div class="rtitle">Comeback Reward</div></div>
      <div class="rdetail">ขยับอันดับขึ้น 5–10 ใน 3 เดือน รับของสมนาคุณให้กำลังใจ (ไม่ทิ้งคนอันดับอื่น)</div>
      <div class="track"><div class="fill" style="width:80%"></div></div><div class="pct">คืบหน้า 80%</div></div>
    <div class="seg">🎁 แลกของจากสปอนเซอร์</div>
    ${SPONSORS.map((s, i) => `<div class="rcard"><div class="rhead"><div class="ricon">🛍️</div><div class="rtitle">${esc(s.name)}</div></div>
      <div class="rdetail">โดย ${esc(s.by)} • ใช้ ${s.cost.toLocaleString()} พอยต์ (สิทธิ์เฉพาะคนติดอันดับ + วิ่งจริง)</div>
      <button class="redeem" data-action="redeem" data-arg="${i}">แลก ${s.cost.toLocaleString()} พอยต์</button></div>`).join('')}
    <div class="hint">เดโม: ของจริงผูกกับอันดับจริง + ระบบสปอนเซอร์ + การตรวจว่าวิ่งจริง</div>`;
}
