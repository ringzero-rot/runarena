// @ts-check
import { $ } from './dom.js';

/** Transient bottom toast. @param {string} msg */
export function toast(msg) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg; // textContent -> safe by construction
  t.classList.add('show');
  clearTimeout(/** @type {any} */ (t)._h);
  /** @type {any} */ (t)._h = setTimeout(() => t.classList.remove('show'), 2300);
}
