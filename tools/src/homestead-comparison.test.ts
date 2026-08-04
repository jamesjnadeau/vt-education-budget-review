import { describe, expect, it } from 'vitest';
import { buildHomesteadComparison } from './homestead-comparison.ts';
import { parseParameterSet } from '@vt-budget/model';
import type { RegistryEntity } from './registry/types.ts';

const su = { slug: 'su/x', type: 'su', name: 'X SU' } as RegistryEntity;
const budget = {
  entity: 'su/x', fiscal_year: 2027, education_spending: 3_370_000,
  tax: { towns: [{ town: 'town/a', homestead_rate_stated: 1.7, cla: 0.85 }] },
};

// Every parameter key the engine's membership/tax chain reads through `lookup`
// (which throws on an absent key, unlike a null value which blocks) must be
// present here, even in this minimal fixture. `parseParameterSet` also refuses
// an empty `parameters` block outright ("must define at least one parameter"),
// so this is the smallest set that gets through parsing AND the calculation.
// Every value is null and every citation is unverified/unchecked — the
// real-world case today for the parameters that matter to this comparison.
const unverifiedParam = (statute: string, unit: string) => ({
  value: null,
  unit,
  description: statute,
  citation: { statute, verified: false, verified_date: null },
});

const unverified = parseParameterSet({
  fiscal_year: 2027,
  status: 'draft',
  note: null,
  parameters: {
    'membership.long_term_membership_years': unverifiedParam('16 V.S.A. § 4001(7)', 'years'),
    'membership.hold_harmless_applies': unverifiedParam('16 V.S.A. § 4010(e)', 'boolean'),
    'weights.grade.prekindergarten': unverifiedParam('16 V.S.A. § 4010(d)(1)', 'multiplier'),
    'weights.grade.kindergarten_through_5': unverifiedParam('16 V.S.A. § 4010(d)(1)', 'multiplier'),
    'weights.grade.6_through_8': unverifiedParam('16 V.S.A. § 4010(d)(1)', 'multiplier'),
    'weights.grade.9_through_12': unverifiedParam('16 V.S.A. § 4010(d)(1)', 'multiplier'),
    'weights.poverty_185_fpl': unverifiedParam('16 V.S.A. § 4010(d)(2)', 'multiplier'),
    'weights.english_learner': unverifiedParam('16 V.S.A. § 4010(d)(3)', 'multiplier'),
    'weights.small_school.density_ceiling': unverifiedParam('16 V.S.A. § 4010(d)(5)', 'count'),
    'tax.excess_spending_threshold_ratio': unverifiedParam('32 V.S.A. § 5401(12)', 'ratio'),
    'yield.property_dollar_equivalent': unverifiedParam('32 V.S.A. § 5401(13)(A)', 'usd_per_pupil'),
    'tax.spending_adjustment_floor': unverifiedParam('32 V.S.A. § 5401(13)(A)', 'ratio'),
    'tax.homestead_base_rate': unverifiedParam('32 V.S.A. § 5402(a)(2)', 'rate_per_100'),
    'tax.statewide_adjustment': unverifiedParam('32 V.S.A. § 5402(b)(1)', 'ratio'),
  },
  inputs: {},
});

describe('buildHomesteadComparison', () => {
  it('reports the published rate and a blocker for the calculated rate when parameters are unverified', () => {
    const out = buildHomesteadComparison([su], [budget], {}, [unverified], 'x');
    const cell = out.sus['su/x']!['2027']![0]!;
    expect(cell.published).toBe(1.7);
    expect(cell.calculated).toBeNull();
    expect(cell.blocker).not.toBeNull();
    expect(cell.difference).toBeNull();
  });

  it('omits an SU with no budget records carrying a town table', () => {
    const out = buildHomesteadComparison([su], [], {}, [unverified], 'x');
    expect(out.sus['su/x']).toBeUndefined();
  });

  it('blocks with "no parameter file for this year" when the fiscal year has none', () => {
    const otherYearBudget = { ...budget, fiscal_year: 2099 };
    const out = buildHomesteadComparison([su], [otherYearBudget], {}, [unverified], 'x');
    const cell = out.sus['su/x']!['2099']![0]!;
    expect(cell.calculated).toBeNull();
    expect(cell.blocker).toBe('no parameter file for this year');
  });
});
