// @ts-check
import { esc } from '../ui/dom.js';
import { getState } from '../state/store.js';

export function notifsView() {
  const st = getState();
  return `<button class="back" data-action="tab" data-arg="home">← กลับ</button>
    <h1 class="title">การแจ้งเตือน</h1><div class="sub">สนามใหม่ การถูกไล่แซง และผลท้าชิง</div>
    ${st.notifications.map((n) => `<div class="notif ${n.hot ? 'hot' : ''}"><div class="ni">${n.i}</div>
      <div><div class="nb">${esc(n.b)}</div><div class="nt">${esc(n.t)}</div></div></div>`).join('')}`;
}
