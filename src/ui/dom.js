// @ts-check
/**
 * Tiny DOM helpers. The app renders via template strings + innerHTML for speed,
 * so EVERY value that originates from a user (display name, custom route name,
 * search text, and anything derived from them such as notifications) MUST pass
 * through `esc()` before interpolation. This closes the XSS hole in the legacy
 * build where names went straight into innerHTML.
 */

/** @param {string} id */
export const $ = (id) => document.getElementById(id);

/**
 * Escape a string for safe interpolation into HTML text/attribute context.
 * @param {unknown} v
 * @returns {string}
 */
export function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Delegate a click/keyboard-activation handler by matching a data attribute.
 * Elements opt in with `data-action="name"` and optional `data-arg="..."`.
 * Handles Enter/Space for non-native-button elements so cards are keyboard
 * accessible.
 * @param {HTMLElement} root
 * @param {Record<string, (arg:string, ev:Event, el:HTMLElement)=>void>} handlers
 */
export function delegate(root, handlers) {
  const run = (ev) => {
    const el = /** @type {HTMLElement} */ (ev.target)?.closest?.('[data-action]');
    if (!el || !root.contains(el)) return;
    const name = el.getAttribute('data-action');
    if (!name || !handlers[name]) return;
    if (ev.type === 'keydown') {
      const key = /** @type {KeyboardEvent} */ (ev).key;
      if (key !== 'Enter' && key !== ' ') return;
      ev.preventDefault();
    }
    handlers[name](el.getAttribute('data-arg') || '', ev, el);
  };
  root.addEventListener('click', run);
  root.addEventListener('keydown', run);
}
