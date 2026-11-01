/**
 * `part` as a whole percentage of `whole`, rounded half up — or `null` when
 * there is no whole to take a share of. The one rounding rule of every PM
 * percentage (adherence, completion, coverage).
 */
export function wholePercent(part: number, whole: number): number | null {
  return whole === 0 ? null : Math.round((100 * part) / whole);
}
