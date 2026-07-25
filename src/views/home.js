// @ts-check
import { esc } from '../ui/dom.js';
import { getState, venues, venueNearest, venueBestRank, venueFavored } from '../state/store.js';
import { TRACE_PATHS } from '../data/routes.js';

function miniTrace(i) {
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="${TRACE_PATHS[i % 4]}" fill="none" stroke="var(--trace)" stroke-width="2.6" stroke-linecap="round" transform="scale(.95) translate(2,2)"/></svg>`;
}

function fmtDist(d) {
  return d < 1 ? Math.round(d * 1000) + ' ม.' : d.toFixed(1) + ' กม.';
}

/** A venue card. Opening it either goes straight to its route or shows a picker. */
export function venueCard(v) {
  const d = venueNearest(v);
  const rank = venueBestRank(v);
  const fav = venueFavored(v);
  const multi = v.routes.length > 1;
  const isNew = v.routes.some((r) => r.isNew);
  const kms = v.routes.map((r) => r.distanceKm);
  const kmMin = Math.min(...kms), kmMax = Math.max(...kms);
  const kmChip = multi ? `${kmMin.toFixed(1)}–${kmMax.toFixed(1)} กม.` : `${kmMin.toFixed(2)} กม.`;
  const rankBox = rank === 1
    ? '<div class="crown-mini">👑</div><div class="l">ราชา</div>'
    : rank
      ? `<div class="n">#${rank}</div><div class="l">อันดับคุณ</div>`
      : '<div class="n" style="color:var(--dim)">—</div><div class="l">ยังไม่ลง</div>';
  return `<div class="card" role="button" tabindex="0" data-action="openVenue" data-arg="${esc(v.venue)}" aria-label="${esc(v.venueName)}">
    <div class="thumb">${miniTrace(v.routes[0].trace)}
      <button class="star ${fav ? 'on' : ''}" data-action="toggleVenueFav" data-arg="${esc(v.venue)}" aria-label="${fav ? 'เลิกติดตาม' : 'ติดตามสนาม'}">${fav ? '★' : '☆'}</button></div>
    <div style="flex:1;min-width:0">
      <div class="cname">${esc(v.venueName)}</div>
      <div class="crow">
        <span class="chip fire">⚑ ${kmChip}</span>
        <span class="chip near">${fmtDist(d)} จากคุณ</span>
        ${multi ? `<span class="chip route">🔀 ${v.routes.length} เส้นทาง</span>` : (v.city ? `<span class="chip">📍 ${esc(v.city)}</span>` : '')}
        ${isNew ? '<span class="chip new">ใหม่</span>' : ''}
      </div></div>
    <div class="myrank">${rankBox}</div>
  </div>`;
}

function partitioned() {
  const st = getState();
  const q = st.search.trim();
  const vs = venues().filter((v) =>
    !q || v.venueName.includes(q) || (v.city || '').includes(q) || (v.prov || '').includes(q) ||
    v.routes.some((r) => r.name.includes(q) || (r.label || '').includes(q)));
  vs.sort((a, b) => venueNearest(a) - venueNearest(b));
  return { fav: vs.filter(venueFavored), oth: vs.filter((v) => !venueFavored(v)) };
}

/** List section — used for live search updates without touching the map. */
export function routeListHTML() {
  const { fav, oth } = partitioned();
  return `
    ${fav.length ? `<div class="seg">★ ที่คุณติดตาม</div>${fav.map(venueCard).join('')}` : ''}
    <div class="seg">สนามใกล้คุณ</div>
    ${oth.length ? oth.map(venueCard).join('') : '<div class="hint">ไม่พบสนามที่ค้นหา</div>'}`;
}

export function homeView() {
  const st = getState();
  const kingVenues = venues().filter((v) => venueBestRank(v) === 1);
  const locTxt = st.locStatus === 'ok' ? '⌖ ใช้ตำแหน่งจริงของคุณ'
    : st.locStatus === 'loading' ? '⌖ กำลังหาตำแหน่ง…'
    : '⌖ แตะเพื่อใช้ตำแหน่งจริง';
  return `
    <div class="home-hero home-hide">
      <div class="eyebrow">สนามทั่วไทย</div><h1 class="title">สนามของคุณ</h1>
      <div class="sub">ค้นหาสนามวิ่งจริงทั่วประเทศ แล้วออกไปท้าชิงจับเวลา</div>
    </div>
    <div class="searchwrap">
      <div class="search">🔎<input id="searchInput" type="search" enterkeyhint="search" autocomplete="off"
        placeholder="ค้นหาสนาม / จังหวัด…" value="${esc(st.search)}" aria-label="ค้นหาสนามหรือจังหวัด">
        <button class="searchclear" data-action="clearSearch" aria-label="ล้างการค้นหา">✕</button></div>
      <div class="searchcount" id="searchCount"></div>
    </div>
    <div class="home-hide" id="homeExtras">
      <div class="locbar">
        <button class="nearchip ${st.locStatus === 'ok' ? 'ok' : ''}" data-action="askLocation">${locTxt}</button>
        <span class="chip">เรียงตามใกล้สุด</span>
      </div>
      <div id="map" role="application" aria-label="แผนที่สนามวิ่ง"></div>
      <div class="maptip">แผนที่จริงจาก OpenStreetMap • เส้นสีฟ้าคือ route จริง แตะเส้นเพื่อเปิดสนาม</div>
      <button class="fab" data-action="openDraw">＋ วาด route ใหม่บนแผนที่ (เปิดสนามท้าชิง)</button>
      ${kingVenues.length ? `<div class="banner gold" role="button" tabindex="0" data-action="openVenue" data-arg="${esc(kingVenues[0].venue)}"><span class="pulse g"></span>
        <div><b>👑 คุณครองบัลลังก์ ${kingVenues.length} สนาม</b><span>ป้องกันไว้ให้ได้ถึงสิ้น quarter เพื่อรับเสื้อ King of</span></div></div>` : ''}
      <div class="banner" role="button" tabindex="0" data-action="tab" data-arg="notifs"><span class="pulse"></span>
        <div><b>มีความเคลื่อนไหวในสนาม</b><span>ดูว่าใครมาท้าชิง / ใครใกล้แซงคุณแล้ว</span></div></div>
    </div>
    <div id="routeList">${routeListHTML()}</div>
  `;
}
