// @ts-check
import { esc } from '../ui/dom.js';
import { getState, leaderboard, myRank } from '../state/store.js';
import { epithet, rankTitle } from '../core/epithet.js';
import { division } from '../core/division.js';
import { fmt, pace } from '../core/format.js';

export function detailView() {
  const st = getState();
  const r = st.routes.find((x) => x.id === st.routeId);
  if (!r) return '<div class="hint">ไม่พบสนาม</div>';
  const lb = leaderboard(r.id);
  const king = lb[0];
  const kt = rankTitle(1, r.name, king.userId);
  const myBest = st.results[r.id];
  const myP = myBest ? myBest / r.distanceKm : null;
  const shown = st.myDivOnly && myP
    ? lb.filter((e) => division(e.sec / r.distanceKm).id === division(myP).id)
    : lb;
  const me = lb.find((e) => e.isMe);
  const rivalIdx = me ? lb.findIndex((e) => e.rank === me.rank - 1) : -1;
  const rival = rivalIdx >= 0 ? lb[rivalIdx] : null;
  const siblings = st.routes.filter((x) => (x.venue || x.id) === (r.venue || r.id)).length;

  const rows = shown.map((e) => {
    const dv = division(e.sec / r.distanceKm);
    const cls = `${e.isMe ? 'me' : ''} ${rival && e.userId === rival.userId ? 'rival' : ''}`.trim();
    return `<div class="row ${cls}">
      <div class="rk" style="${e.rank <= 3 ? 'color:var(--gold)' : ''}">${e.rank}</div>
      <div class="av">${esc(e.initial)}</div>
      <div class="who"><div class="nm">${esc(e.name)}${e.isMe ? ' (คุณ)' : ''} <span style="color:${dv.color};font-size:10px">• ${dv.name}</span></div>
        <div class="ep">${esc(epithet(e.userId, r.id))}</div></div>
      <div class="tm">${fmt(e.sec)}<small>${pace(e.sec, r.distanceKm)}/กม.</small></div>
    </div>`;
  }).join('');

  return `
    <button class="back" data-action="tab" data-arg="home">← กลับไปที่สนาม</button>
    <h1 class="title" style="font-size:21px">${esc(r.name)}</h1>
    ${r.city ? `<div class="sub" style="margin-bottom:${siblings > 1 ? '8' : '10'}px">📍 ${esc(r.city)} • ${esc(r.prov)}${r.label && siblings > 1 ? ` • เส้นทาง: ${esc(r.label)}` : ''}</div>` : ''}
    ${siblings > 1 ? `<button class="btn ghost small" data-action="openVenue" data-arg="${esc(r.venue)}" style="margin-bottom:11px">🔀 เลือกเส้นทางอื่นใน${esc(r.venueName)} (${siblings})</button>` : ''}
    <div id="detailmap" role="application" aria-label="แผนที่เส้นทาง"></div>
    <div class="hstats">
      <div class="hs"><div class="v acc">${r.distanceKm.toFixed(2)}</div><div class="k">ระยะจริง (กม.)</div></div>
      <div class="hs"><div class="v">${r.runners}</div><div class="k">นักวิ่งในสนาม</div></div>
      <div class="hs"><div class="v">${myBest ? fmt(myBest) : '—'}</div><div class="k">สถิติของคุณ</div></div>
      <div class="hs"><div class="v">${myBest ? pace(myBest, r.distanceKm) : '—'}</div><div class="k">เพซ /กม.</div></div>
    </div>
    <div class="plate">
      <div style="font-size:20px">👑</div>
      <div class="ptitle">${esc(kt)}</div>
      <div class="pep">${esc(epithet(king.userId, r.id))}</div>
      <div class="pwho"><div class="pav">${esc(king.initial)}</div>
        <div class="pname">${esc(king.name)}${king.isMe ? ' (คุณ)' : ''}</div>
        <div class="ptime">${fmt(king.sec)}</div></div>
    </div>
    ${rival ? `<div class="banner" role="button" tabindex="0" data-action="startChallenge" data-arg="${esc(r.id)}"><span class="pulse"></span>
      <div><b>คู่ปรับของคุณ: ${esc(rival.name)}</b><span>เร็วกว่าคุณแค่ ${Math.max(1, Math.round(me.sec - rival.sec))} วินาที — แซงได้ในรอบหน้า!</span></div></div>` : ''}
    <div class="tabs" role="tablist">
      <button class="tab ${st.season === 'all' ? 'on' : ''}" data-action="setSeason" data-arg="all" role="tab" aria-selected="${st.season === 'all'}">🏆 ตลอดกาล</button>
      <button class="tab ${st.season === 'week' ? 'on' : ''}" data-action="setSeason" data-arg="week" role="tab" aria-selected="${st.season === 'week'}">📅 ซีซั่นสัปดาห์นี้</button>
    </div>
    <div class="tabs" role="tablist">
      <button class="tab ${!st.myDivOnly ? 'on' : ''}" data-action="setDiv" data-arg="0" role="tab" aria-selected="${!st.myDivOnly}">ทุกคน</button>
      <button class="tab ${st.myDivOnly ? 'on' : ''}" data-action="setDiv" data-arg="1" role="tab" aria-selected="${st.myDivOnly}">ดิวิชั่นของฉัน</button>
    </div>
    <div class="lbhead"><div class="t">อันดับในสนามนี้</div><div class="d">${r.distanceKm.toFixed(2)} กม. • ${st.season === 'week' ? 'สัปดาห์นี้' : 'ตลอดกาล'}</div></div>
    ${rows}
    <button class="btn" style="margin-top:13px" data-action="startChallenge" data-arg="${esc(r.id)}">▶ เริ่มท้าชิงสนามนี้</button>
    <div class="hint">วิ่งจริงด้วย GPS หรือจะจำลองก็ได้ • วิ่งแข่งกับ “ผี” ของแชมป์แบบเรียลไทม์</div>`;
}
