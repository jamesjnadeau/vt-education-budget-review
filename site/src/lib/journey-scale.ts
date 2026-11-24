/**
 * Scale maths for the "My journey" pages. All pure; no imports.
 *
 * The site never ranks towns ("good/bad") — it shows where one sits among
 * others in neutral words ("higher than N of M towns" / "lower than N of M
 * towns"), always reporting the direction with the larger count so the
 * sentence is the more informative one either way. Ties read "higher than".
 */

export interface Percentile {
  /** Count of values strictly below `value`. */
  lower: number;
  /** Count of all values compared, including `value` itself. */
  of: number;
  /** True when every compared value equals `value` (nothing to rank against). */
  allEqual?: boolean;
}

/** Where `value` sits among `all`: the count strictly below and the total. */
export function percentileOf(value: number, all: ReadonlyArray<number>): Percentile {
  if (all.length === 0) return { lower: 0, of: 0, allEqual: false };
  let lower = 0;
  for (const v of all) if (v < value) lower += 1;
  return { lower, of: all.length, allEqual: all.every((v) => v === value) };
}

/** Neutral words for a percentile: the larger direction, ties read "higher". */
export function percentileWords(p: Percentile, noun: string): string {
  if (p.allEqual) return `the same as every other ${singular(noun)}`;
  if (p.of === 0) return `no other ${noun} to compare against`;
  const below = p.lower;
  const above = Math.max(0, p.of - 1 - below);
  if (above > below) return `lower than ${above} of ${p.of} ${noun}`;
  return `higher than ${below} of ${p.of} ${noun}`;
}

/** The plan passes the noun already plural ("towns"); drop the s for the singular phrase. */
function singular(noun: string): string {
  return noun.endsWith('s') ? noun.slice(0, -1) : noun;
}

/** `part` as a fraction of `whole` (0–1), or null when `whole` is not positive. */
export function shareOf(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return part / whole;
}

/** A whole-percent string; a tiny but nonzero fraction reads "less than 1%". */
export function percentText(f: number): string {
  if (f > 0 && f < 0.005) return 'less than 1%';
  return `${Math.round(f * 100)}%`;
}

/** The median of a set of values, or null when the set is empty. */
export function median(values: ReadonlyArray<number>): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] as number;
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/** The arithmetic mean of a set of values, or null when the set is empty. */
export function mean(values: ReadonlyArray<number>): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
