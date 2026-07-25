// @ts-check
/**
 * Reactive application store: single source of truth + pub/sub, with all state
 * mutations funneled through named actions. Persists user-owned state through
 * the swappable Store backend after every change.
 */
import { pathKm, haversine } from '../core/geo.js';
import { competitorTimes } from '../data/competitors.js';
import { RAW_ROUTES, BKK } from '../data/routes.js';
import { SyncManager } from './persistence.js';
import { cloudEnabled } from '../config.js';
import { levelInfo, leveledUp } from '../core/level.js';
import { pickDailyMissions } from '../data/missions.js';
import { esc } from '../ui/dom.js';
import { fmt } from '../core/format.js';

const backend = new SyncManager();
/** @type {import('./cloud.js').SupabaseStore|null} */
let cloud = null;

/** @typedef {import('../core/geo.js').LatLng} LatLng */

/** Build the runtime route list (seed + custom), distances derived from coords. */
function buildRoutes(customRoutes) {
  const seed = RAW_ROUTES.map((r) => ({ ...r, distanceKm: pathKm(r.coords), published: true }));
  return [...customRoutes, ...seed];
}

const DEFAULT_NOTIFS = [
  { i: '🏟️', b: 'สนามใหม่ “เกาะรัตนโกสินทร์ Night” ถูกเปิดโดย @nattapong', t: '5 นาทีที่แล้ว', unread: true },
  { i: '⚡', b: 'ธนา ว. เข้าใกล้เวลาของคุณในสนาม “สวนลุมพินี รอบใน” แค่ 3 วินาที!', t: '2 ชม.ที่แล้ว', unread: true, hot: true },
];

// Seed activity feed so the community tab feels alive from day one.
let feedSeq = 1;
const DEFAULT_FEED = [
  { icon: '👑', who: 'กฤษณะ พ.', initial: 'ก', text: 'ยึดบัลลังก์ราชาที่ <b>สวนลุมพินี</b> เวลา 11:58', t: '8 นาที', kudos: 12 },
  { icon: '🔥', who: 'อรอุมา ส.', initial: 'อ', text: 'สตรีค 15 วันติด! ไม่มีหยุด', t: '25 นาที', kudos: 9 },
  { icon: '🎯', who: 'Mark T.', initial: 'M', text: 'ทำสถิติใหม่ที่ <b>สวนเบญจกิติ</b> ขยับขึ้น 4 อันดับ', t: '1 ชม.', kudos: 5 },
  { icon: '🗺️', who: 'ปุณยวีร์ ก.', initial: 'ป', text: 'เปิดสนามใหม่ <b>เลียบคลองบางกอกน้อย</b>', t: '2 ชม.', kudos: 7 },
];

/** Live, in-memory state. Only a subset is persisted (see snapshot()). */
const state = {
  // session / ui (not persisted)
  view: 'home',
  routeId: null,
  search: '',
  season: 'all',
  myDivOnly: false,
  here: /** @type {LatLng|null} */ (null),
  locStatus: 'idle', // idle | loading | ok | denied
  cloudReady: false,
  cloudBoards: /** @type {Record<string, any[]>} */ ({}), // routeId -> real user entries
  // persisted
  user: /** @type {{id:string,name:string,initial:string}|null} */ (null),
  results: /** @type {Record<string, number>} */ ({}),
  points: 1080,
  streak: 4,
  streakDate: /** @type {string|null} */ (null),
  favorites: new Set(['r1', 'bj1']),
  customRoutes: /** @type {any[]} */ ([]),
  notifications: DEFAULT_NOTIFS.map((n) => ({ ...n })),
  // engagement
  xp: 0,
  missions: /** @type {{date:string, list:any[]}|null} */ (null),
  feed: DEFAULT_FEED.map((f) => ({ ...f, id: 'seed' + (feedSeq++) })),
  kudosGiven: new Set(),
  duels: /** @type {any[]} */ ([]),
  runs: /** @type {any[]} */ ([]),               // run history log
  settings: { voice: true, ghostMode: false, onboarded: false, weeklyGoalKm: 20, coachId: 'zaap' },
  // derived cache
  routes: buildRoutes([]),
};

/** @type {Set<() => void>} */
const subscribers = new Set();

/** Subscribe to any state change. Returns an unsubscribe fn. */
export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function notify() {
  subscribers.forEach((fn) => fn());
}

/** Serializable slice for persistence. */
function snapshot() {
  return {
    user: state.user,
    results: state.results,
    points: state.points,
    streak: state.streak,
    streakDate: state.streakDate,
    favorites: [...state.favorites],
    customRoutes: state.customRoutes,
    notifications: state.notifications,
    xp: state.xp,
    missions: state.missions,
    feed: state.feed.slice(0, 40),
    kudosGiven: [...state.kudosGiven],
    duels: state.duels,
    runs: state.runs.slice(0, 100),
    settings: state.settings,
  };
}

function persist() {
  backend.save(snapshot());
}

/** Load persisted state (call once at boot, before first render). */
export function hydrate() {
  const s = backend.load();
  if (!s) return;
  state.user = s.user ?? null;
  state.results = s.results ?? {};
  state.points = s.points ?? state.points;
  state.streak = s.streak ?? state.streak;
  state.streakDate = s.streakDate ?? null;
  state.favorites = new Set(s.favorites ?? ['r1', 'bj1']);
  state.customRoutes = s.customRoutes ?? [];
  state.notifications = s.notifications ?? DEFAULT_NOTIFS.map((n) => ({ ...n }));
  state.xp = s.xp ?? 0;
  state.missions = s.missions ?? null;
  state.feed = s.feed ?? DEFAULT_FEED.map((f) => ({ ...f, id: 'seed' + (feedSeq++) }));
  state.kudosGiven = new Set(s.kudosGiven ?? []);
  state.duels = s.duels ?? [];
  state.runs = s.runs ?? [];
  state.settings = { voice: true, ghostMode: false, onboarded: false, weeklyGoalKm: 20, coachId: 'zaap', ...(s.settings ?? {}) };
  state.routes = buildRoutes(state.customRoutes);
}

export function getState() {
  return state;
}

/* ------------------------------------------------------------------- cloud */

/** Merge a cloud snapshot (source of truth for the user's own data). */
function applyCloudSnapshot(s) {
  if (s.user) state.user = s.user;
  if (s.results) state.results = s.results;
  if (typeof s.points === 'number') state.points = s.points;
  if (typeof s.streak === 'number') state.streak = s.streak;
  state.streakDate = s.streakDate ?? state.streakDate;
  if (s.favorites) state.favorites = new Set(s.favorites);
  if (s.customRoutes) { state.customRoutes = s.customRoutes; state.routes = buildRoutes(state.customRoutes); }
  backend.local.save(snapshot()); // cache the merged result locally
}

/**
 * Connect to Supabase if configured. Local-first: the app is already usable;
 * this attaches real accounts + cross-device sync in the background. No-op (and
 * never throws) when there's no config or the network fails.
 */
export async function connectCloud() {
  if (!cloudEnabled()) return;
  try {
    const { SupabaseStore } = await import('./cloud.js');
    const store = new SupabaseStore();
    await store.init();
    cloud = store;
    backend.cloud = store;
    const snap = await store.load();
    if (snap) applyCloudSnapshot(snap);          // returning user (skips login)
    else if (state.user) store.save(snapshot()); // have a local identity: push it up
    state.cloudReady = true;
    notify();
  } catch (e) {
    console.warn('cloud connect failed; staying local-only', e);
  }
}

export function isCloudReady() {
  return state.cloudReady;
}

/* --------------------------------------------------------------- selectors */

/**
 * Full leaderboard for a route (competitors + the current user if they've run).
 * @param {string} routeId
 * @param {string} [season]
 * @returns {Array<import('../data/competitors.js').Entry & {rank:number, isMe?:boolean}>}
 */
export function leaderboard(routeId, season) {
  const s = season || state.season;
  const r = state.routes.find((x) => x.id === routeId);
  const km = r ? r.distanceKm : 5;
  // Prefer REAL competitors from the cloud when we have them (all-time board);
  // otherwise fall back to the deterministic seed competitors.
  const board = state.cloudBoards[routeId];
  let arr;
  if (s !== 'week' && board && board.length) {
    arr = board.filter((e) => !state.user || e.userId !== state.user.id).map((x) => ({ ...x }));
  } else {
    arr = competitorTimes(routeId, km, s).map((x) => ({ ...x }));
  }
  const mine = state.results[routeId];
  if (mine != null && state.user) {
    arr.push({ userId: state.user.id, name: state.user.name, initial: state.user.initial, sec: mine, isMe: true });
  }
  arr.sort((a, b) => a.sec - b.sec);
  arr.forEach((e, i) => (e.rank = i + 1));
  return arr;
}

/** Lazily fetch the real leaderboard for a route (no-op when local-only). */
export function ensureCloudBoard(routeId) {
  if (!cloud || state.cloudBoards[routeId]) return;
  state.cloudBoards[routeId] = []; // mark in-flight (falls back to seed meanwhile)
  cloud.fetchLeaderboard(routeId)
    .then((rows) => { state.cloudBoards[routeId] = rows; notify(); })
    .catch(() => { delete state.cloudBoards[routeId]; });
}

/** @param {string} routeId @returns {number|null} */
export function myRank(routeId) {
  const me = leaderboard(routeId, 'all').find((e) => e.isMe);
  return me ? me.rank : null;
}

/** Average seconds-per-km across the routes the user has run (default 330). */
export function myPace() {
  const ids = Object.keys(state.results);
  if (!ids.length) return 330;
  let tot = 0, n = 0;
  ids.forEach((id) => {
    const r = state.routes.find((x) => x.id === id);
    if (r) { tot += state.results[id] / r.distanceKm; n++; }
  });
  return n ? tot / n : 330;
}

/** Straight-line distance (km) from the user's location to a route's start. */
export function distFromMe(route) {
  const from = state.here || BKK;
  return haversine(from, route.coords[0]);
}

/* ------- venues: a place that groups one or more routes to choose from ------ */

/**
 * Group routes by venue.
 * @returns {Array<{venue:string, venueName:string, city:string, prov:string, routes:any[]}>}
 */
export function venues() {
  /** @type {Map<string, any>} */
  const map = new Map();
  state.routes.forEach((r) => {
    const key = r.venue || r.id;
    if (!map.has(key)) map.set(key, { venue: key, venueName: r.venueName || r.name, city: r.city, prov: r.prov, routes: [] });
    map.get(key).routes.push(r);
  });
  return [...map.values()];
}

export function venueById(slug) {
  return venues().find((v) => v.venue === slug);
}

/** Nearest of a venue's routes to the user. */
export function venueNearest(v) {
  return Math.min(...v.routes.map(distFromMe));
}

/** Best (lowest) rank the user holds across a venue's routes, or null. */
export function venueBestRank(v) {
  const ranks = v.routes.map((r) => myRank(r.id)).filter((x) => x != null);
  return ranks.length ? Math.min(...ranks) : null;
}

/** A venue counts as followed if any of its routes is a favorite. */
export function venueFavored(v) {
  return v.routes.some((r) => state.favorites.has(r.id));
}

export function toggleVenueFav(v) {
  if (venueFavored(v)) v.routes.forEach((r) => state.favorites.delete(r.id));
  else state.favorites.add(v.routes[0].id);
  persist();
  notify();
}

export function uid() {
  return state.user ? state.user.id : 'me';
}

export function unreadCount() {
  return state.notifications.filter((n) => n.unread).length;
}

/* ------------------------------------------------------------------ actions */

export function login(name) {
  const v = (name || '').trim() || 'นักวิ่ง';
  // Keep the real cloud user id if we're already signed in; else a local id.
  const id = state.user && state.user.id ? state.user.id : 'me';
  state.user = { id, name: v, initial: [...v][0] };
  if (cloud) cloud.setName(v); // persist display name to the profile
  // seed a couple of prior results so leaderboards aren't empty on first login
  if (!Object.keys(state.results).length) {
    ['r1', 'bj1'].forEach((rid) => {
      const r = state.routes.find((x) => x.id === rid);
      if (!r) return;
      const t = competitorTimes(rid, r.distanceKm, 'all');
      state.results[rid] = t[3].sec - 2; // just ahead of the 4th competitor
    });
  }
  persist();
  notify();
}

export function logout() {
  state.user = null;
  state.view = 'home';
  persist();
  notify();
}

export function setView(v) { state.view = v; notify(); }
export function openRoute(id) { state.routeId = id; state.view = 'detail'; ensureCloudBoard(id); notify(); }
export function setSeason(s) { state.season = s; notify(); }
export function setDiv(v) { state.myDivOnly = v; notify(); }

// UI-only: does NOT notify. The search handler updates just the #routeList so the
// input keeps focus/caret while typing (a full re-render would recreate it).
export function setSearch(v) { state.search = v; }

export function toggleFavorite(id) {
  if (state.favorites.has(id)) state.favorites.delete(id);
  else state.favorites.add(id);
  persist();
  notify();
}

export function setLocation(here, status) {
  state.here = here;
  state.locStatus = status;
  notify();
}
export function setLocStatus(status) { state.locStatus = status; notify(); }

/* ----------------------------------------------- engagement: XP / missions /
   activity feed / kudos / duels ------------------------------------------- */

function todayStr() { return new Date().toISOString().slice(0, 10); }
export function levelOf() { return levelInfo(state.xp); }
function addXpInternal(n) { state.xp += n; }
export function addXp(n) { addXpInternal(n); persist(); notify(); }

export function ensureDailyMissions() {
  const today = todayStr();
  if (!state.missions || state.missions.date !== today) {
    state.missions = { date: today, list: pickDailyMissions(today) };
    persist();
  }
  return state.missions.list;
}
export function dailyMissions() { return ensureDailyMissions(); }

function missionProgress(type, amount = 1) {
  ensureDailyMissions();
  let changed = false;
  state.missions.list.forEach((m) => {
    if (m.type === type && !m.claimed && m.progress < m.goal) {
      m.progress = Math.min(m.goal, m.progress + amount);
      changed = true;
    }
  });
  if (changed) persist();
}

export function claimMission(key) {
  ensureDailyMissions();
  const m = state.missions.list.find((x) => x.key === key);
  if (!m || m.claimed || m.progress < m.goal) return false;
  m.claimed = true;
  state.points += m.points;
  addXpInternal(m.xp);
  persist();
  notify();
  return { xp: m.xp, points: m.points };
}

function pushFeedInternal(item) {
  state.feed.unshift({ id: 'f' + Date.now() + Math.random().toString(36).slice(2, 6), kudos: 0, ...item });
  if (state.feed.length > 60) state.feed.length = 60;
}
export function feedItems() { return state.feed; }
export function hasKudos(id) { return state.kudosGiven.has(id); }
export function giveKudos(id) {
  if (state.kudosGiven.has(id)) return false;
  const item = state.feed.find((f) => f.id === id);
  if (!item) return false;
  item.kudos = (item.kudos || 0) + 1;
  state.kudosGiven.add(id);
  missionProgress('kudos', 1);
  persist();
  notify();
  return true;
}

/** Challenge the rival just above you on a route to a head-to-head duel. */
export function challengeRival(routeId) {
  const lb = leaderboard(routeId, 'all');
  const me = lb.find((e) => e.isMe);
  if (!me || me.rank <= 1) return null;
  const rival = lb.find((e) => e.rank === me.rank - 1);
  if (!rival) return null;
  if (state.duels.some((d) => d.status === 'pending' && d.routeId === routeId && d.opponentName === rival.name)) return null;
  const route = state.routes.find((r) => r.id === routeId);
  state.duels.unshift({ id: 'd' + Date.now(), routeId, routeName: route ? route.name : '', opponentName: rival.name, opponentInitial: rival.initial, opponentSec: rival.sec, status: 'pending', t: Date.now() });
  pushNotif('⚔️', `คุณท้าดวล ${rival.name} ที่ ${route ? route.name : ''} — วิ่งให้ชนะเวลา ${fmt(rival.sec)}!`);
  pushFeedInternal({ icon: '⚔️', who: state.user?.name || 'คุณ', initial: state.user?.initial || '?', text: `ท้าดวล <b>${esc(rival.name)}</b> ที่ ${esc(route ? route.name : '')}`, t: 'เมื่อสักครู่', me: true });
  persist();
  notify();
  return rival.name;
}
export function pendingDuels() { return state.duels.filter((d) => d.status === 'pending'); }

function resolveDuelsForRoute(routeId, mySec) {
  const results = [];
  state.duels.forEach((d) => {
    if (d.status !== 'pending' || d.routeId !== routeId) return;
    const win = mySec <= d.opponentSec;
    d.status = win ? 'won' : 'lost';
    d.mySec = mySec;
    results.push({ ...d });
    if (win) { state.points += 100; addXpInternal(150); }
    pushFeedInternal({ icon: win ? '🏆' : '💤', who: state.user?.name || 'คุณ', initial: state.user?.initial || '?',
      text: win ? `ชนะดวล <b>${esc(d.opponentName)}</b> ที่ ${esc(d.routeName)}!` : `แพ้ดวล ${esc(d.opponentName)} ที่ ${esc(d.routeName)}`, t: 'เมื่อสักครู่', me: true });
  });
  return results;
}

/* ------- run history / personal records / weekly recap / settings -------- */

function pushRun(r) {
  state.runs.unshift({ id: 'run' + Date.now(), date: new Date().toISOString(), ...r });
  if (state.runs.length > 100) state.runs.length = 100;
}
export function runHistory() { return state.runs; }

export function personalRecords() {
  const runs = state.runs;
  let bestPace = null, longest = 0, totalKm = 0;
  runs.forEach((r) => {
    totalKm += r.km || 0;
    if (r.km > 0) {
      const p = r.sec / r.km;
      if (bestPace == null || p < bestPace) bestPace = p;
      if (r.km > longest) longest = r.km;
    }
  });
  const kings = state.routes.filter((x) => myRank(x.id) === 1).length;
  return { totalRuns: runs.length, totalKm, bestPace, longest, kings };
}

export function weeklyStats() {
  const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
  const recent = state.runs.filter((r) => new Date(r.date).getTime() >= cutoff);
  return { runs: recent.length, km: recent.reduce((a, r) => a + (r.km || 0), 0) };
}

/** Days since the most recent run (large number if never). */
export function daysSinceLastRun() {
  return state.runs.length ? (Date.now() - new Date(state.runs[0].date).getTime()) / 86400000 : 99;
}

export function getSettings() { return state.settings; }
export function setSetting(key, val) { state.settings = { ...state.settings, [key]: val }; persist(); notify(); }
export function completeOnboarding() { state.settings.onboarded = true; persist(); notify(); }

/**
 * Record a run result. Keeps the best (fastest) time; awards points + XP;
 * advances daily missions; resolves duels; posts to the activity feed; and logs
 * the run to history.
 * @returns {{ improved:number|null, isBest:boolean, rank:number, prevRank:number|null, gained:number, xpGain:number, levelUp:number|null, duelResults:any[] }}
 */
export function recordResult(routeId, sec, km, mode) {
  const prevRank = myRank(routeId);
  const best = state.results[routeId];
  const firstTime = best == null;
  const isBest = best == null || sec < best;
  if (isBest) state.results[routeId] = sec;
  const rank = myRank(routeId);
  const king = rank === 1;
  const gained = king ? 120 : rank <= 3 ? 80 : 40;
  state.points += gained;
  const today = todayStr();
  if (state.streakDate !== today) { state.streak += 1; state.streakDate = today; }
  const improved = prevRank ? prevRank - rank : null;

  const xpGain = (king ? 200 : rank <= 3 ? 120 : 70) + (isBest ? 20 : 0);
  const levelUp = leveledUp(state.xp, xpGain);
  addXpInternal(xpGain);

  ensureDailyMissions();
  missionProgress('run', 1);
  if (km) missionProgress('distance', km);
  if (rank <= 3) missionProgress('top3', 1);
  if (king) missionProgress('king', 1);
  if (firstTime) missionProgress('newArena', 1);

  const duelResults = resolveDuelsForRoute(routeId, sec);

  const route = state.routes.find((r) => r.id === routeId);
  const rname = esc(route ? route.name : '');
  pushFeedInternal({ icon: king ? '👑' : rank <= 3 ? '🎯' : '🏁', who: state.user?.name || 'คุณ', initial: state.user?.initial || '?',
    text: king ? `ยึดบัลลังก์ราชาที่ <b>${rname}</b>` : `จบ challenge <b>${rname}</b> อันดับ #${rank}`, t: 'เมื่อสักครู่', me: true });

  pushRun({ routeId, routeName: route ? route.name : '', sec, km: km || (route ? route.distanceKm : 0), rank, king, mode: mode || 'sim' });

  persist();
  return { improved, isBest, rank, prevRank, gained, xpGain, levelUp, duelResults };
}

/** Publish a user-drawn route as a new arena. @returns {string} new id */
export function addRoute(name, coords, km, sec) {
  const id = 'r' + Date.now();
  const route = { id, name, distanceKm: km, coords, runners: 1, trace: Math.floor(Math.random() * 4), published: true, isNew: true, custom: true };
  state.customRoutes.unshift(route);
  state.routes = buildRoutes(state.customRoutes);
  state.results[id] = sec;
  state.favorites.add(id);
  state.points += 150;
  addXpInternal(120);
  ensureDailyMissions();
  missionProgress('newArena', 1);
  missionProgress('run', 1);
  if (km) missionProgress('distance', km);
  pushFeedInternal({ icon: '🗺️', who: state.user?.name || 'คุณ', initial: state.user?.initial || '?', text: `เปิดสนามใหม่ <b>${esc(name)}</b>`, t: 'เมื่อสักครู่', me: true });
  pushRun({ routeId: id, routeName: name, sec, km, rank: 1, king: true, mode: 'new' });
  persist();
  return id;
}

export function redeem(index, sponsors) {
  const s = sponsors[index];
  if (state.points < s.cost) return false;
  state.points -= s.cost;
  pushNotif('🎁', `แลก “${s.name}” สำเร็จ ใช้ ${s.cost} พอยต์`);
  persist();
  notify();
  return true;
}

export function pushNotif(i, b, broadcast = false, hot = false) {
  state.notifications.unshift({
    i,
    b: (broadcast ? '📣 [ส่งถึงผู้ใช้ทุกคน] ' : '') + b,
    t: 'เมื่อสักครู่',
    unread: true,
    hot,
  });
  persist();
}

export function markNotificationsRead() {
  state.notifications.forEach((n) => (n.unread = false));
  persist();
}
