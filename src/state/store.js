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

export function setSearch(v) { state.search = v; /* no persist; ui-only */ notify(); }

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

/**
 * Record a run result. Keeps the best (fastest) time. Updates streak once/day.
 * @returns {{ improved:number|null, isBest:boolean, rank:number, prevRank:number|null, gained:number }}
 */
export function recordResult(routeId, sec) {
  const prevRank = myRank(routeId);
  const best = state.results[routeId];
  const isBest = best == null || sec < best;
  if (isBest) state.results[routeId] = sec;
  const rank = myRank(routeId);
  const king = rank === 1;
  const gained = king ? 120 : rank <= 3 ? 80 : 40;
  state.points += gained;
  // streak: count at most once per calendar day
  const today = new Date().toISOString().slice(0, 10);
  if (state.streakDate !== today) {
    state.streak += 1;
    state.streakDate = today;
  }
  const improved = prevRank ? prevRank - rank : null;
  persist();
  return { improved, isBest, rank, prevRank, gained };
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
