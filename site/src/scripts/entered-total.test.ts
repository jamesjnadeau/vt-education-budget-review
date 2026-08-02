/**
 * The per-year "total entered" tally shown in each grade fieldset.
 *
 * Blank is contagious, matching the rest of the tool: a year total is the sum
 * of the four grade bands only when every one is present. One empty field makes
 * the year's total genuinely unknown, so the helper returns null and the island
 * shows an em dash rather than a partial sum that reads as a real headcount.
 */

import { describe, expect, it } from 'vitest';

import { enteredYearTotal } from './entered-total.ts';

describe('enteredYearTotal', () => {
  it('sums the grade-band counts when every one is present', () => {
    expect(enteredYearTotal([10, 100, 50, 50])).toBe(210);
  });

  it('adds fractional average daily membership without rounding', () => {
    expect(enteredYearTotal([10.5, 100.25, 50, 49.25])).toBe(210);
  });

  it('returns null when any band is blank', () => {
    expect(enteredYearTotal([10, null, 50, 50])).toBeNull();
  });

  it('returns null for no bands at all', () => {
    expect(enteredYearTotal([])).toBeNull();
  });

  it('treats a single zero-filled year as a real zero, not a blank', () => {
    expect(enteredYearTotal([0, 0, 0, 0])).toBe(0);
  });
});
