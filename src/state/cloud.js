// @ts-check
/**
 * Supabase-backed cloud store. Loaded only when a project is configured
 * (see src/config.js). Talks to the same PersistedState shape LocalStore uses,
 * plus multiplayer reads (real leaderboards) and auth.
 *
 * supabase-js is imported from a CDN on demand so there is no dependency and no
 * network cost when running local-only.
 */
import { supabaseConfig } from '../config.js';

const SUPABASE_JS = 'https://esm.sh/@supabase/supabase-js@2.45.4';

export class SupabaseStore {
  constructor() {
    this.client = null;
    this.userId = null;
    this._saveTimer = null;
  }

  /** Create the client and ensure a signed-in user (anonymous by default). */
  async init() {
    const { url, anonKey } = supabaseConfig();
    const { createClient } = await import(/* @vite-ignore */ SUPABASE_JS);
    this.client = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });

    let { data: { session } } = await this.client.auth.getSession();
    if (!session) {
      const { data, error } = await this.client.auth.signInAnonymously();
      if (error) throw error;
      session = data.session;
    }
    this.userId = session.user.id;
    return this.userId;
  }

  /** Is this a returning, named account (so we can skip the login screen)? */
  async loadProfile() {
    const { data } = await this.client.from('profiles').select('*').eq('id', this.userId).maybeSingle();
    return data || null;
  }

  /** Full snapshot for the signed-in user (or null if brand new). */
  async load() {
    const profile = await this.loadProfile();
    if (!profile) return null;
    const [{ data: results }, { data: favs }, { data: routes }] = await Promise.all([
      this.client.from('results').select('route_id, sec').eq('user_id', this.userId),
      this.client.from('favorites').select('route_id').eq('user_id', this.userId),
      this.client.from('routes').select('*').eq('created_by', this.userId),
    ]);
    /** @type {Record<string, number>} */
    const resultMap = {};
    (results || []).forEach((r) => { resultMap[r.route_id] = r.sec; });
    return {
      user: { id: this.userId, name: profile.name, initial: [...(profile.name || '?')][0] },
      results: resultMap,
      points: profile.points ?? 1080,
      streak: profile.streak ?? 0,
      streakDate: profile.streak_date ?? null,
      favorites: (favs || []).map((f) => f.route_id),
      customRoutes: (routes || []).map((r) => ({
        id: r.id, name: r.name, coords: r.coords, distanceKm: Number(r.distance_km),
        runners: 1, trace: 0, published: true, custom: true,
      })),
      notifications: null, // notifications stay local
    };
  }

  /** Debounced upsert of the user's own data. Never throws to the caller. */
  save(snapshot) {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._flush(snapshot).catch((e) => console.warn('cloud save failed', e)), 800);
  }

  async _flush(s) {
    if (!this.client || !this.userId || !s.user) return; // wait until the user has a name
    const id = this.userId;
    await this.client.from('profiles').upsert({
      id, name: s.user?.name || 'นักวิ่ง', points: s.points, streak: s.streak, streak_date: s.streakDate,
    });
    const resultRows = Object.entries(s.results || {}).map(([route_id, sec]) => ({ user_id: id, route_id, sec }));
    if (resultRows.length) await this.client.from('results').upsert(resultRows, { onConflict: 'user_id,route_id' });
    // favorites: replace the set
    await this.client.from('favorites').delete().eq('user_id', id);
    const favRows = (s.favorites || []).map((route_id) => ({ user_id: id, route_id }));
    if (favRows.length) await this.client.from('favorites').insert(favRows);
    // custom routes
    const routeRows = (s.customRoutes || []).map((r) => ({
      id: r.id, name: r.name, coords: r.coords, distance_km: r.distanceKm, created_by: id, published: true,
    }));
    if (routeRows.length) await this.client.from('routes').upsert(routeRows);
  }

  /** Set/replace the display name on the profile (also creates the row). */
  async setName(name) {
    if (!this.client || !this.userId) return;
    await this.client.from('profiles').upsert({ id: this.userId, name });
  }

  /**
   * Real leaderboard for a route: everyone's best time + their name.
   * @returns {Promise<Array<{userId:string,name:string,initial:string,sec:number}>>}
   */
  async fetchLeaderboard(routeId) {
    const { data, error } = await this.client
      .from('results')
      .select('user_id, sec, profiles(name)')
      .eq('route_id', routeId)
      .order('sec', { ascending: true })
      .limit(50);
    if (error || !data) return [];
    return data.map((r) => ({
      userId: r.user_id,
      name: r.profiles?.name || 'นักวิ่ง',
      initial: [...(r.profiles?.name || '?')][0],
      sec: r.sec,
    }));
  }

  /** Optional: upgrade an anonymous account to email (magic link). */
  async signInWithEmail(email) {
    if (!this.client) return { error: 'no-client' };
    return this.client.auth.signInWithOtp({ email });
  }

  async clear() {
    if (this.client) await this.client.auth.signOut();
  }
}
