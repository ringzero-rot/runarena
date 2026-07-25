// @ts-check
import { esc } from '../ui/dom.js';
import { feedItems, hasKudos, pendingDuels } from '../state/store.js';
import { fmt } from '../core/format.js';

function feedRow(it) {
  const kud = hasKudos(it.id);
  return `<div class="feedrow ${it.me ? 'me' : ''}">
    <div class="av">${esc(it.initial || '?')}</div>
    <div class="feedbody">
      <div class="feedtext"><span class="fic">${it.icon || ''}</span> <b>${esc(it.who)}</b> ${it.text}</div>
      <div class="feedmeta">${esc(it.t || '')}</div>
    </div>
    <button class="kudosbtn ${kud ? 'on' : ''}" data-action="kudos" data-arg="${esc(it.id)}" aria-label="ส่งกำลังใจ">👊 ${it.kudos || 0}</button>
  </div>`;
}

export function feedView() {
  const items = feedItems();
  const duels = pendingDuels();
  return `<div class="eyebrow">ชุมชนนักวิ่ง</div><h1 class="title">ฟีดความเคลื่อนไหว</h1>
    <div class="sub">ดูว่าใครทำอะไรเจ๋ง ๆ แล้วส่งกำลังใจ (👊) ให้กัน</div>
    ${duels.length ? `<div class="seg">⚔️ ดวลที่ค้างอยู่</div>
      ${duels.map((d) => `<div class="duelcard">
        <div class="duelinfo">⚔️ ท้าดวล <b>${esc(d.opponentName)}</b><span>${esc(d.routeName)} • ต้องชนะเวลา ${fmt(d.opponentSec)}</span></div>
        <button class="btn small" style="width:auto;padding:9px 14px" data-action="startChallenge" data-arg="${esc(d.routeId)}">วิ่งเลย ▶</button>
      </div>`).join('')}` : ''}
    <div class="seg">🔥 ล่าสุด</div>
    ${items.map(feedRow).join('')}`;
}
