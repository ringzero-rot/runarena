// @ts-check
/**
 * Single source of truth for the app version, shown in the UI (profile + login)
 * so you can confirm an update actually landed.
 *
 * When releasing: bump VERSION + BUILD here AND the matching `CACHE` name in
 * /sw.js (kept in sync on purpose — a changed sw.js is what triggers the update
 * prompt).
 */
export const VERSION = '1.5.0';
export const BUILD = '2026-07-25';
