// @ts-check
import { esc } from '../ui/dom.js';
import { getState, venues, venueNearest, venueBestRank, venueFavored, levelOf, dailyMissions, weeklyStats } from '../state/store.js';
import { TRACE_PATHS } from '../data/routes.js';
import { routeShapeSvg } from '../ui/shape.js';

/** Personal dashboard: level + XP, streak/stats, and today's missions. */
function dashboardHTML() {
  const st = getState();
  const lv = levelOf();
  const ran = Object.keys(st.results).length;
  const kings = venues().filter((v) => venueBestRank(v) === 1).length;
  const missions = dailyMissions();
  const doneCount = missions.filter((m) => m.claimed).length;
  const wk = weeklyStats();
  const goal = st.settings.weeklyGoalKm || 20;
  return `
  <div class="dash">
    <div class="dashtop">
      <div class="lvbadge"><span class="lvic">${lv.icon}</span><span class="lvnum">Lv.${lv.level}</span></div>
      <div class="dashwho"><div class="dashname">${esc(st.user?.name || 'นักวิ่ง')}</div><div class="dashtitle">${esc(lv.title)}</div></div>
      <div class="dashpts"><b>${st.points.toLocaleString()}</b><span>พอยต์</span></div>
    </div>
    <div class="xpwrap">
      <div class="xpbar"><div class="xpfill" style="width:${(lv.pct * 100).toFixed(0)}%"></div></div>
      <div class="xptext">${lv.cur} / ${lv.next} XP · อีก ${lv.next - lv.cur} XP ถึง Lv.${lv.level + 1}</div>
    </div>
    <div class="dashstats">
      <div class="ds"><b>🔥 ${st.streak}</b><span>สตรีค</span></div>
      <div class="ds"><b>🏟️ ${ran}</b><span>สนามที่วิ่ง</span></div>
      <div class="ds"><b>👑 ${kings}</b><span>บัลลังก์</span></div>
    </div>
    <div class="weekgoal">
      <div class="wgtop">🎯 เป้าหมายสัปดาห์นี้<b>${wk.km.toFixed(1)} / ${goal} กม.</b></div>
      <div class="wgbar"><div class="wgfill" style="width:${Math.min(100, (wk.km / goal) * 100)}%"></div></div>
      <div class="wgmeta">วิ่งแล้ว ${wk.runs} ครั้ง${wk.km >= goal ? ' · ✅ ถึงเป้าแล้ว เก่งมาก!' : ` · เหลืออีก ${Math.max(0, goal - wk.km).toFixed(1)} กม.`}</div>
    </div>
  </div>
  <div class="seg">🎯 ภารกิจวันนี้ <span class="more">${doneCount}/${missions.length} สำเร็จ</span></div>
  <div class="missions">
    ${missions.map((m) => {
      const done = m.progress >= m.goal;
      const claimable = done && !m.claimed;
      return `<div class="mission ${m.claimed ? 'claimed' : ''}">
        <div class="mic">${m.icon}</div>
        <div class="minfo">
          <div class="mtext">${esc(m.text)}</div>
          <div class="mtrack"><div class="mfill" style="width:${Math.min(100, (m.progress / m.goal) * 100)}%"></div></div>
          <div class="mmeta">${m.progress}/${m.goal} · +${m.xp} XP · +${m.points} พอยต์</div>
        </div>
        ${m.claimed ? '<div class="mdone">✓</div>'
          : claimable ? `<button class="mclaim" data-action="claimMission" data-arg="${esc(m.key)}">รับ</button>`
          : '<div class="mlock">🔒</div>'}
      </div>`;
    }).join('')}
  </div>`;
}

function miniTrace(i) {
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="${TRACE_PATHS[i % 4]}" fill="none" stroke="var(--trace)" stroke-width="2.6" stroke-linecap="round" transform="scale(.95) translate(2,2)"/></svg>`;
}

function fmtDist(d) {
  return d < 1 ? Math.round(d * 1000) + ' ม.' : d.toFixed(1) + ' กม.';
}

/** Big "featured arena" hero — a visual focal point at the top of home. */
function featuredHTML() {
  const vs = venues().slice().sort((a, b) => venueNearest(a) - venueNearest(b));
  const feat = vs.find((v) => venueBestRank(v) !== 1) || vs[0];
  if (!feat) return '';
  const d = venueNearest(feat);
  const km = Math.min(...feat.routes.map((r) => r.distanceKm));
  const rank = venueBestRank(feat);
  return `<div class="featured" role="button" tabindex="0" data-action="openVenue" data-arg="${esc(feat.venue)}" aria-label="สนามแนะนำ ${esc(feat.venueName)}">
    <div class="featshape">${routeShapeSvg(feat.routes[0].coords, { w: 128, h: 128, pad: 14, stroke: 'rgba(40,224,200,.9)', sw: 3, dot: true })}</div>
    <div class="featbody">
      <div class="featlabel">🔥 สนามแนะนำวันนี้</div>
      <div class="featname">${esc(feat.venueName)}</div>
      <div class="featmeta">${feat.city ? esc(feat.city) + ' · ' : ''}${km.toFixed(2)} กม. · ${fmtDist(d)} จากคุณ</div>
      <div class="featcta">${rank ? 'ไต่อันดับ/ป้องกัน' : 'ไปพิชิตเป็นราชา'} ▶</div>
    </div>
  </div>`;
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
    <div class="thumb ${rank === 1 ? 'king' : ''}">${routeShapeSvg(v.routes[0].coords, { stroke: rank === 1 ? 'var(--gold)' : 'var(--trace)', sw: 2.6, dot: true })}
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
    <div class="home-hero home-hide">${dashboardHTML()}</div>
    <div class="home-hide">${featuredHTML()}</div>
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
