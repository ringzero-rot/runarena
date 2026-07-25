// @ts-check
/**
 * Runtime configuration.
 *
 * Leave `url`/`anonKey` empty to run fully local (browser localStorage) — no
 * account, no network. Fill them in with your Supabase project to enable real
 * accounts, cross-device sync, and multiplayer leaderboards. See
 * SETUP_SUPABASE.md. The anon key is a public client key (safe to ship).
 *
 * You can also set window.RUNARENA_CONFIG = { supabase:{url, anonKey} } before
 * the app loads (e.g. from an env-injected inline script) instead of editing
 * this file.
 */
export const SUPABASE = {
  url: '',      // e.g. 'https://xxxxxxxx.supabase.co'
  anonKey: '',  // e.g. 'eyJhbGciOi...'
};

/** Public base URL used for shareable invite/challenge links. */
export const SHARE_BASE = 'https://ringzero-rot.github.io/runarena/';

/** True when a Supabase project is configured. */
export function cloudEnabled() {
  const w = typeof window !== 'undefined' ? (window.RUNARENA_CONFIG || {}) : {};
  const s = w.supabase || {};
  return Boolean((s.url || SUPABASE.url) && (s.anonKey || SUPABASE.anonKey));
}

/** Resolved Supabase credentials (window override wins). */
export function supabaseConfig() {
  const w = typeof window !== 'undefined' ? (window.RUNARENA_CONFIG || {}) : {};
  const s = w.supabase || {};
  return { url: s.url || SUPABASE.url, anonKey: s.anonKey || SUPABASE.anonKey };
}
