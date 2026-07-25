// @ts-check
/**
 * App bootstrap: hydrate persisted state, wire a single delegated event layer,
 * and render on every state change. Maps are mounted per-view after render.
 */
import { $, esc, delegate } from './ui/dom.js';
import { toast } from './ui/toast.js';
import {
  hydrate, connectCloud, subscribe, getState, unreadCount,
  login, logout, setView, openRoute, setSeason, setDiv, toggleFavorite,
  setSearch, setLocStatus, setLocation, redeem, markNotificationsRead, myRank, distFromMe,
  venueById, toggleVenueFav, levelOf, claimMission, giveKudos, challengeRival, pendingDuels,
} from './state/store.js';
import { openVenue } from './views/venue.js';
import { BKK } from './data/routes.js';
import { SPONSORS } from './data/sponsors.js';
import { renderMainMap, renderDetailMap, dispose } from './ui/map.js';
import { loginView } from './views/login.js';
import { homeView, routeListHTML } from './views/home.js';
import { detailView } from './views/detail.js';
import { eventsView } from './views/events.js';
import { rewardsView } from './views/rewards.js';
import { profileView, rerollEpithet } from './views/profile.js';
import { notifsView } from './views/notifs.js';
import { feedView } from './views/feed.js';
import { startChallenge } from './views/run.js';
import { openDraw } from './views/draw.js';
import { openOnboarding } from './views/onboarding.js';
import { openSettings } from './views/settings.js';
import { shareArena } from './views/share.js';

/* --------------------------------------------------------------- chrome */
function topbar() {
  const st = getState();
  const n = unreadCount();
  const lv = levelOf();
  return `<div class="topbar"><div class="logo">RUN<b>ARENA</b></div>
    <div class="topright">
      <button class="lvchip" data-action="tab" data-arg="profile" aria-label="โปรไฟล์">${lv.icon} Lv.${lv.level}</button>
      <span class="streak">🔥 ${st.streak}</span>
      <button class="bell" data-action="tab" data-arg="notifs" aria-label="การแจ้งเตือน">🔔${n ? `<span class="badge">${n}</span>` : ''}</button></div></div>`;
}
function navbar() {
  const view = getState().view;
  const duels = pendingDuels().length;
  const items = [['home', '🏟️', 'สนาม'], ['feed', '🔥', 'ฟีด'], ['rewards', '🏆', 'รางวัล'], ['events', '📅', 'งานวิ่ง'], ['profile', '👤', 'โปรไฟล์']];
  return `<div class="nav">${items.map(([v, i, l]) =>
    `<button class="${view === v ? 'on' : ''}" data-action="tab" data-arg="${v}" aria-current="${view === v}"><span class="ic">${i}${v === 'feed' && duels ? `<span class="navdot"></span>` : ''}</span>${l}</button>`).join('')}</div>`;
}

function viewContent() {
  switch (getState().view) {
    case 'home': return homeView();
    case 'feed': return feedView();
    case 'events': return eventsView();
    case 'rewards': return rewardsView();
    case 'profile': return profileView();
    case 'detail': return detailView();
    case 'notifs': return notifsView();
    default: return homeView();
  }
}

/* --------------------------------------------------------------- render */
function render() {
  const app = $('app');
  const st = getState();
  if (!st.user) {
    dispose('main'); dispose('detail');
    app.innerHTML = loginView();
    const input = /** @type {HTMLInputElement} */ ($('loginName'));
    if (input) {
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
      input.focus();
    }
    return;
  }
  app.innerHTML = `${topbar()}<div class="content" id="content">${viewContent()}</div>${navbar()}`;
  mountMaps();
  wireSearch();
  // first-run teaching (once)
  if (!st.settings.onboarded && !onboardingShown) { onboardingShown = true; openOnboarding(); }
  applyDeepLink();
}
let onboardingShown = false;

// Open a shared arena link, e.g. .../#/r/<id> or .../#/v/<slug>, once after login.
let deepLinkApplied = false;
function applyDeepLink() {
  if (deepLinkApplied || !getState().user) return;
  const m = (location.hash || '').match(/^#\/(v|r)\/(.+)$/);
  if (!m) { deepLinkApplied = true; return; }
  deepLinkApplied = true;
  const kind = m[1], id = decodeURIComponent(m[2]);
  if (kind === 'v') openVenue(id); else openRoute(id);
}
// Also react to hash changes while the app is already open (e.g. tapping a link).
window.addEventListener('hashchange', () => { deepLinkApplied = false; applyDeepLink(); });

function mountMaps() {
  const st = getState();
  if (st.view === 'home' && $('map')) {
    const nearby = [...st.routes].sort((a, b) => distFromMe(a) - distFromMe(b)).slice(0, 6);
    renderMainMap($('map'), {
      routes: st.routes, here: st.here, center: BKK, boundsRoutes: nearby,
      kingOf: (id) => myRank(id) === 1,
      onRoute: (id) => openRoute(id),
    });
  } else {
    dispose('main');
  }
  if (st.view === 'detail' && $('detailmap')) {
    const r = st.routes.find((x) => x.id === st.routeId);
    renderDetailMap($('detailmap'), r);
  } else {
    dispose('detail');
  }
}

/**
 * Live search updates only the list (input keeps focus). While a query is
 * present we switch the home into "search mode": the hero, map and banners are
 * hidden and the sticky search bar + results rise to the top, so on mobile the
 * filtered results sit right under the search box — above the keyboard.
 */
function applySearch() {
  const input = /** @type {HTMLInputElement} */ ($('searchInput'));
  if (!input) return;
  setSearch(input.value);
  const list = $('routeList');
  if (list) list.innerHTML = routeListHTML();
  const searching = input.value.trim().length > 0;
  const content = $('content');
  if (content) content.classList.toggle('searching', searching);
  const count = $('searchCount');
  if (count) count.textContent = searching && list ? `${list.querySelectorAll('.card').length} สนามที่พบ` : '';
  if (searching) { if (content) content.scrollTop = 0; }
  else mountMaps(); // query cleared: home extras shown again — resize the map
}

function wireSearch() {
  const input = /** @type {HTMLInputElement} */ ($('searchInput'));
  if (!input) return;
  input.addEventListener('input', applySearch);
  // reflect an already-active query when re-entering the home view
  if (input.value.trim().length > 0) applySearch();
}

/* --------------------------------------------------------------- actions */
function doLogin() {
  const input = /** @type {HTMLInputElement} */ ($('loginName'));
  const v = input ? input.value : '';
  login(v);
  askLocation(true);
  toast('ยินดีต้อนรับสู่สนาม ' + (getState().user?.name || '') + '!');
}

function askLocation(silent) {
  if (!navigator.geolocation) { setLocStatus('denied'); return; }
  setLocStatus('loading');
  navigator.geolocation.getCurrentPosition(
    (p) => { setLocation([p.coords.latitude, p.coords.longitude], 'ok'); toast('พบตำแหน่งคุณแล้ว — เรียงสนามตามระยะใกล้'); },
    () => { setLocStatus('denied'); if (!silent) toast('ไม่ได้รับสิทธิ์ตำแหน่ง — ใช้กรุงเทพฯ เป็นค่าเริ่มต้น'); },
    { timeout: 8000, enableHighAccuracy: true }
  );
}

const handlers = {
  login: () => doLogin(),
  logout: () => logout(),
  tab: (v) => { if (v === 'notifs') markNotificationsRead(); setView(v); },
  openRoute: (id) => openRoute(id),
  openVenue: (slug) => openVenue(slug),
  clearSearch: () => { const i = /** @type {HTMLInputElement} */ ($('searchInput')); if (i) { i.value = ''; applySearch(); i.focus(); } },
  toggleFav: (id) => { toggleFavorite(id); toast('อัปเดตรายการติดตาม'); },
  toggleVenueFav: (slug) => { const v = venueById(slug); if (v) { toggleVenueFav(v); toast('อัปเดตรายการติดตาม'); } },
  askLocation: () => askLocation(false),
  setSeason: (s) => setSeason(s),
  setDiv: (v) => setDiv(v === '1'),
  startChallenge: (id) => startChallenge(id),
  openDraw: () => openDraw(),
  rerollEpithet: () => { rerollEpithet(); const c = $('content'); if (c) c.innerHTML = profileView(); },
  redeem: (i) => { if (!redeem(Number(i), SPONSORS)) toast('พอยต์ไม่พอ — วิ่ง challenge เพิ่มเพื่อสะสม!'); else toast('แลกของสำเร็จ! 🎉'); },
  openEvent: (url) => window.open(url, '_blank', 'noopener,noreferrer'),
  claimMission: (key) => { const r = claimMission(key); if (r) toast(`รับรางวัล +${r.xp} XP · +${r.points} พอยต์ 🎉`); },
  kudos: (id) => { if (giveKudos(id)) toast('ส่งกำลังใจแล้ว 👊'); },
  duel: (routeId) => { const name = challengeRival(routeId); toast(name ? `⚔️ ท้าดวล ${name} แล้ว! วิ่งให้ชนะเวลาเขา` : 'ยังไม่มีคู่ปรับให้ท้า — คุณอาจเป็นราชาอยู่แล้ว 👑'); },
  openSettings: () => openSettings(),
  proWaitlist: () => toast('บันทึกความสนใจแล้ว! เราจะแจ้งคุณก่อนใครตอนเปิดตัว Pro ✦'),
  inviteArena: (id) => {
    const r = getState().routes.find((x) => x.id === id);
    shareArena(id, r ? r.name : '').then((res) => {
      if (res === 'copied') toast('คัดลอกลิงก์ชวนแล้ว 🔗 เอาไปแปะ LINE ได้เลย');
      else if (res === 'shared') toast('ส่งคำท้าแล้ว 🎉');
    });
  },
};

/* --------------------------------------------------------------- boot */
hydrate();
subscribe(render);
delegate(/** @type {HTMLElement} */ ($('app')), handlers);
render();
connectCloud(); // local-first: attaches Supabase in the background if configured

// PWA: register the service worker and prompt when a new version is ready.
let updateAccepted = false; // reload only when the user accepted an update...
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // ...not on the first-load claim (null -> active), which also fires this.
    if (updateAccepted) location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      // if a new worker is already waiting (installed before this load), prompt now
      if (reg.waiting && navigator.serviceWorker.controller) showUpdatePrompt(reg);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          // new version installed while an old one controls the page → offer refresh
          if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdatePrompt(reg);
        });
      });
    }).catch(() => {});
  });
}

/** Small non-blocking "update available" bar with a refresh button. */
function showUpdatePrompt(reg) {
  if ($('updatebar')) return; // already shown
  const bar = document.createElement('div');
  bar.className = 'updatebar';
  bar.id = 'updatebar';
  bar.innerHTML = `<span>มีเวอร์ชันใหม่ของ RunArena</span><button id="updateBtn">รีเฟรช</button>`;
  document.body.appendChild(bar); // CSS animation reveals it (reliable even in bg tabs)
  $('updateBtn').addEventListener('click', () => {
    updateAccepted = true;
    $('updateBtn').textContent = 'กำลังอัปเดต…';
    (reg.waiting || reg.installing)?.postMessage('SKIP_WAITING'); // -> controllerchange -> reload
  });
}
