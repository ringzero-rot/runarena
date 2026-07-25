// @ts-check
/**
 * Persistence abstraction.
 *
 * The app talks to a `Store` interface only, so the storage backend is
 * swappable. Today: `LocalStore` (browser localStorage). Tomorrow: drop in a
 * `SupabaseStore` with the same three methods and nothing else changes.
 *
 * @typedef {Object} PersistedState
 * @property {{id:string,name:string,initial:string}|null} user
 * @property {Record<string, number>} results       routeId -> best time (sec)
 * @property {number} points
 * @property {number} streak
 * @property {string|null} streakDate               ISO date of last counted run
 * @property {string[]} favorites
 * @property {any[]} customRoutes                    user-created arenas
 * @property {any[]} notifications
 *
 * @typedef {Object} Store
 * @property {() => PersistedState|null} load
 * @property {(s: PersistedState) => void} save
 * @property {() => void} clear
 */

const KEY = 'runarena:v2';

/** @implements {Store} */
export class LocalStore {
  /** @returns {PersistedState|null} */
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /** @param {PersistedState} s */
  save(s) {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* quota or privacy mode — run in-memory only */
    }
  }

  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Local-first sync manager.
 *
 * The app always reads/writes localStorage synchronously (instant, offline).
 * When a cloud store is attached (Supabase), every save also fans out to the
 * cloud in the background, and a returning user's cloud snapshot is merged in
 * on connect. This keeps the whole app synchronous while gaining real accounts
 * and cross-device sync. See src/state/cloud.js + SETUP_SUPABASE.md.
 *
 * @implements {Store}
 */
export class SyncManager {
  constructor() {
    this.local = new LocalStore();
    /** @type {import('./cloud.js').SupabaseStore|null} */
    this.cloud = null;
  }

  /** @returns {PersistedState|null} */
  load() {
    return this.local.load(); // instant local; cloud merges later via connectCloud()
  }

  /** @param {PersistedState} s */
  save(s) {
    this.local.save(s);
    if (this.cloud) this.cloud.save(s); // debounced, fire-and-forget
  }

  clear() {
    this.local.clear();
    if (this.cloud) this.cloud.clear();
  }
}
