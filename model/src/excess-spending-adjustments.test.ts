/**
 * The two Act 183 adjustments to the excess spending comparison.
 *
 * Per the Agency of Education's "Excess Spending Threshold Summary and Tax Rate
 * Impact" (32 V.S.A. § 5401(12); 16 V.S.A. § 4001(6)(B); 24 V.S.A. § 2804(b)),
 * the spending figure compared to the threshold is:
 *
 *   education spending
 *     + 150% of capital reserve fund draws more than 5 years old
 *     - principal & interest on voter-approved bonds approved before 2024-07-01
 *
 * The overage above the threshold (if any) is what gets added back and double
 * counted. These tests pin the arithmetic; docs/excess-spending-threshold.md is
 * the narrative.
 */

import { describe, expect, it } from 'vitest';

import { createContext, excessSpending, input } from './index.ts';
import type { Parameter, ParameterSet } from './types.ts';

const CITATION = {
  statute: 'SYNTHETIC TEST FIXTURE',
  session_law: null,
  source_url: null,
  quote: null,
  verified: true,
  verified_date: '2000-01-01',
  verified_by: 'test',
} as const;

function param(key: string, value: number, unit: string): Parameter {
  return {
    key,
    value,
    unit,
    description: key,
    citation: CITATION,
    applies_to: null,
    range: null,
    contingent: false,
    is_law: true,
    structural_note: null,
  };
}

// excessSpending reads the threshold ratio always, and the capital-reserve
// multiplier only when a capital reserve amount is supplied.
function ctx(ratio = 1.18, multiplier = 1.5) {
  const parameters = new Map<string, Parameter>([
    ['tax.excess_spending_threshold_ratio', param('tax.excess_spending_threshold_ratio', ratio, 'ratio')],
    [
      'tax.excess_spending_capital_reserve_multiplier',
      param('tax.excess_spending_capital_reserve_multiplier', multiplier, 'multiplier'),
    ],
  ]);
  const set: ParameterSet = { fiscal_year: 2027, status: 'draft', note: null, parameters, inputs: new Map() };
  return createContext(set);
}

const pp = (c: ReturnType<typeof ctx>, v: number) =>
  input(c, 'Per pupil education spending', v, 'usd_per_pupil', { source: 'test' });
const members = (c: ReturnType<typeof ctx>, v: number) =>
  input(c, 'Weighted membership', v, 'pupils', { source: 'test' });

// Threshold throughout is 10000 * 1.18 = 11800.
describe('excessSpending Act 183 adjustments', () => {
  it('is zero below the threshold with no adjustments (unchanged behavior)', () => {
    const c = ctx();
    expect(excessSpending(c, pp(c, 11000), 10000).value).toBe(0);
  });

  it('is the plain overage above the threshold with no adjustments', () => {
    const c = ctx();
    expect(excessSpending(c, pp(c, 12000), 10000).value).toBe(200);
  });

  it('adds 150% of >5yr capital reserve draws to the compared spending', () => {
    // capRes 10000 total -> 1.5 * 10000 = 15000; / 10 pupils = 1500 per pupil.
    // comparison 11000 + 1500 = 12500; over threshold 11800 = 700.
    const c = ctx();
    const e = excessSpending(c, pp(c, 11000), 10000, {
      capitalReserveFivePlusYears: 10000,
      bondExclusionPreJuly2024: null,
      weightedMembership: members(c, 10),
    });
    expect(e.value).toBe(700);
  });

  it('excludes pre-2024 bond principal and interest from the compared spending', () => {
    // base per pupil 12000 (plain excess would be 200); bond 5000 / 10 = 500 per pupil.
    // comparison 12000 - 500 = 11500 < 11800 -> excess 0.
    const c = ctx();
    const e = excessSpending(c, pp(c, 12000), 10000, {
      capitalReserveFivePlusYears: null,
      bondExclusionPreJuly2024: 5000,
      weightedMembership: members(c, 10),
    });
    expect(e.value).toBe(0);
  });

  it('applies both adjustments together', () => {
    // +1500 (capRes) - 300 (bond 3000/10) = +1200 net; 11000 + 1200 = 12200; - 11800 = 400.
    const c = ctx();
    const e = excessSpending(c, pp(c, 11000), 10000, {
      capitalReserveFivePlusYears: 10000,
      bondExclusionPreJuly2024: 3000,
      weightedMembership: members(c, 10),
    });
    expect(e.value).toBe(400);
  });
});
