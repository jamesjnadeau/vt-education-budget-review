/**
 * The per-year "total entered" tally shown in each grade fieldset.
 *
 * A convenience sum of the grade-band counts a user typed for one year. Blank is
 * contagious, exactly as it is for the weighted-membership figures downstream:
 * one empty band makes the year's total unknown, so this returns null and the
 * island renders an em dash rather than a partial sum that could be mistaken for
 * the real headcount.
 */

/** Sum of one year's grade-band counts, or null when any band is blank. */
export function enteredYearTotal(values: readonly (number | null)[]): number | null {
  if (values.length === 0) return null;
  let total = 0;
  for (const value of values) {
    if (value === null) return null;
    total += value;
  }
  return total;
}
