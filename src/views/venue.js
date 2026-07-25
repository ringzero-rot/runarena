// @ts-check
/** Route picker: shown when a venue has more than one route to choose from. */
import { $, esc } from '../ui/dom.js';
import { venueById, openRoute, myRank } from '../state/store.js';

export function openVenue(slug) {
  const v = venueById(slug);
  if (!v) return;
  // Single route: skip the picker and go straight to it.
  if (v.routes.length === 1) { openRoute(v.routes[0].id); return; }

  const o = document.createElement('div');
  o.className = 'overlay'; o.id = 'venueOverlay';
  o.innerHTML = `<div class="sheet">
    <div class="eyebrow">เลือกเส้นทาง</div><h2>${esc(v.venueName)}</h2>
    <p>สวนนี้มี ${v.routes.length} เส้นทางให้ท้าชิง — เลือกที่อยากวิ่ง</p>
    ${v.routes.map((r) => {
      const rank = myRank(r.id);
      const rankTxt = rank === 1 ? '👑 ราชา' : rank ? `อันดับ #${rank}` : 'ยังไม่ลง';
      return `<button class="pickrow" data-pick="${esc(r.id)}">
        <div class="pickinfo">
          <div class="picklabel">${esc(r.label)}${r.isNew ? ' <span class="chip new" style="margin-left:4px">ใหม่</span>' : ''}</div>
          <div class="picksub">${r.distanceKm.toFixed(2)} กม. • ${rankTxt}</div>
        </div>
        <div class="pickgo">▶</div></button>`;
    }).join('')}
    <button class="btn ghost small" id="closeVenue" style="margin-top:10px">ปิด</button>
  </div>`;
  document.body.appendChild(o);
  o.querySelectorAll('[data-pick]').forEach((b) =>
    b.addEventListener('click', () => { const id = b.getAttribute('data-pick'); o.remove(); openRoute(id); }));
  $('closeVenue').addEventListener('click', () => o.remove());
  o.addEventListener('click', (e) => { if (e.target === o) o.remove(); });
}
