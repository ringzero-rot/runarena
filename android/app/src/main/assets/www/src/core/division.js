// @ts-check
/**
 * Pace-based divisions so newcomers don't compete directly with elites.
 * Input is seconds-per-kilometre.
 * @typedef {{ id: string, name: string, color: string }} Division
 */

/** @type {Division[]} thresholds are upper bounds (exclusive), fastest first */
const TABLE = [
  { id: 'elite', name: 'เอลีท',   color: 'var(--sunrise)', max: 270 },
  { id: 'strong', name: 'ขาแรง',  color: 'var(--gold)',    max: 330 },
  { id: 'grind', name: 'สายลุย',  color: 'var(--trace)',   max: 390 },
  { id: 'chill', name: 'สายชิล',  color: 'var(--mid)',     max: Infinity },
];

/**
 * @param {number} paceSecPerKm
 * @returns {Division}
 */
export function division(paceSecPerKm) {
  const row = TABLE.find((d) => paceSecPerKm < d.max) || TABLE[TABLE.length - 1];
  return { id: row.id, name: row.name, color: row.color };
}
