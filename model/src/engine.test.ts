import { describe, expect, it } from 'vitest';

import {
  collectParameters,
  combineMembership,
  computeWeightedMembership,
  createContext,
  defaultAssumptions,
  excessSpending,
  input,
  parseParameterSet,
  perPupilEducationSpending,
  runScenario,
  smallSchoolTier,
  sparsityBand,
  spendingAdjustment,
  toSteps,
  townRate,
  unverifiedParameters,
} from './index.ts';
import type { MembershipInput } from './membership.ts';
import type { DistrictBudget } from './scenario.ts';
import { syntheticParameters } from './testing/synthetic.ts';

/**
 * Hand-checkable against the synthetic weights in testing/synthetic.ts.
 *
 *   two-year averages   prek 15, K-5 150, grades 6-8 80, grades 9-12 60
 *   State-placed FTE                                                   5
 *   long-term membership   15 + 150 + 80 + 60 + 5              =     310
 *
 *   additive weights, per 16 V.S.A. § 4010(d)(6)
 *     prekindergarten     15 x -0.5                            =    -7.5
 *     K-5                150 x  0                              =       0
 *     grades 6-8          80 x  0.5                            =      40
 *     grades 9-12         60 x  1                              =      60
 *     poverty             40 x  1                              =      40
 *     English learners     8 x  2                              =      16
 *     sparsity            none at 120 persons/sq mi            =       0
 *                                              cumulation      =   148.5
 *
 *   weighted long-term membership   310 + 148.5                =   458.5
 */
const DISTRICT: MembershipInput = {
  entity: 'ud/test-district',
  adm_years: [
    { fiscal_year: 2025, prekindergarten: 10, kindergarten_through_5: 100, grades_6_through_8: 60, grades_9_through_12: 40 },
    { fiscal_year: 2026, prekindergarten: 20, kindergarten_through_5: 200, grades_6_through_8: 100, grades_9_through_12: 80 },
  ],
  state_placed_fte: 5,
  poverty_185_fpl: 40,
  english_learners: 8,
  persons_per_square_mile: 120,
  small_schools: [],
  source: 'test fixture',
};

describe('weighted long-term membership', () => {
  it('adds the weights to membership rather than multiplying by them', () => {
    // § 4010(d)(6): weighted long-term membership equals long-term membership
    // PLUS the cumulation of the weights. A multiplicative reading would shrink
    // the count instead of enlarging it.
    const ctx = createContext(syntheticParameters());
    const result = computeWeightedMembership(ctx, DISTRICT);

    expect(result.longTermMembership.value).toBe(310);
    expect(result.total.value).toBeCloseTo(458.5, 10);
    expect(result.total.value!).toBeGreaterThan(result.longTermMembership.value!);
  });

  it('gives kindergarten through grade five no weight at all', () => {
    // § 4010(d)(1) assigns grade weights only to prek, 6-8 and 9-12.
    const ctx = createContext(syntheticParameters());
    const withMoreK5 = computeWeightedMembership(ctx, {
      ...DISTRICT,
      adm_years: DISTRICT.adm_years.map((y) => ({ ...y, kindergarten_through_5: y.kindergarten_through_5! * 2 })),
    });
    // Membership rises by the extra pupils (150) and by nothing else.
    expect(withMoreK5.longTermMembership.value).toBe(460);
    expect(withMoreK5.total.value).toBeCloseTo(608.5, 10);
  });

  it('adds State-placed students at their current count rather than averaging them', () => {
    // § 4001(7)(B).
    const ctx = createContext(syntheticParameters());
    const more = computeWeightedMembership(ctx, { ...DISTRICT, state_placed_fte: 15 });
    expect(more.longTermMembership.value).toBe(320);
  });

  it('averages over the statutory two years, not every year supplied', () => {
    const ctx = createContext(syntheticParameters());
    const result = computeWeightedMembership(ctx, {
      ...DISTRICT,
      adm_years: [
        { fiscal_year: 2024, prekindergarten: 0, kindergarten_through_5: 0, grades_6_through_8: 0, grades_9_through_12: 0 },
        ...DISTRICT.adm_years,
      ],
    });
    expect(result.longTermMembership.value).toBe(310);
  });

  it('makes a prekindergarten pupil 0.46 of a K-5 pupil, not negative 0.54', () => {
    // The statute's phrasing at § 4010(d)(1)(A) -- "prekindergarten—negative
    // 0.54" -- invites reading a prek pupil as counting -0.54. It does not.
    // The pupil is already counted once in long-term membership and the weight
    // is an increment on top, so the effective count is 1 - 0.54 = 0.46. The
    // wrong reading flips the sign of every prekindergarten pupil in the state.
    //
    // Real statutory values from § 4010(d)(1)-(3), applied here to the
    // synthetic set so the structural claim is pinned to the actual numbers.
    const ctx = createContext(
      syntheticParameters({
        overrides: {
          'weights.grade.prekindergarten': -0.54,
          'weights.grade.kindergarten_through_5': 0,
          'weights.grade.6_through_8': 0.36,
          'weights.grade.9_through_12': 0.39,
        },
      }),
    );

    const onePupilIn = (band: keyof Omit<(typeof DISTRICT)['adm_years'][number], 'fiscal_year'>) => {
      const years = [2025, 2026].map((fiscal_year) => ({
        fiscal_year,
        prekindergarten: 0,
        kindergarten_through_5: 0,
        grades_6_through_8: 0,
        grades_9_through_12: 0,
        [band]: 1,
      })) as unknown as (typeof DISTRICT)['adm_years'];

      return computeWeightedMembership(ctx, {
        entity: 'ud/one-pupil',
        adm_years: years,
        state_placed_fte: 0,
        poverty_185_fpl: 0,
        english_learners: 0,
        persons_per_square_mile: 200,
        small_schools: [],
        source: 'test fixture',
      }).total.value;
    };

    expect(onePupilIn('prekindergarten')).toBeCloseTo(0.46, 10);
    expect(onePupilIn('kindergarten_through_5')).toBeCloseTo(1, 10);
    expect(onePupilIn('grades_6_through_8')).toBeCloseTo(1.36, 10);
    expect(onePupilIn('grades_9_through_12')).toBeCloseTo(1.39, 10);
  });

  it('applies a negative prekindergarten weight as a reduction', () => {
    const ctx = createContext(syntheticParameters());
    const none = computeWeightedMembership(ctx, {
      ...DISTRICT,
      adm_years: DISTRICT.adm_years.map((y) => ({ ...y, prekindergarten: 0 })),
    });
    // Removing 15 prek pupils removes 15 from membership but ADDS back the
    // 7.5 their negative weight had subtracted.
    expect(none.longTermMembership.value).toBe(295);
    expect(none.total.value).toBeCloseTo(451, 10);
  });
});

describe('membership breakdown for display', () => {
  it('splits grade weights from demographic weights and totals each', () => {
    const ctx = createContext(syntheticParameters());
    const r = computeWeightedMembership(ctx, DISTRICT);

    // Grade increments: prek 15×-0.5=-7.5, K-5 150×0=0, 6-8 80×0.5=40, 9-12 60×1=60.
    expect(r.gradeWeightIncrements).toHaveLength(4);
    expect(r.gradeWeightTotal.value).toBeCloseTo(92.5, 10);

    // Demographic increments: poverty 40×1=40, EL 8×2=16, sparsity 0 (density 120, no band).
    expect(r.demographicWeightTotal.value).toBeCloseTo(56, 10);

    // Grade + demographic equals the existing cumulation of all weights.
    expect(r.allWeightsTotal.value).toBeCloseTo(148.5, 10);
    expect(r.increments).toHaveLength(r.gradeWeightIncrements.length + r.demographicWeightIncrements.length);
  });

  it('sums entered headcount across the averaged years without averaging', () => {
    const ctx = createContext(syntheticParameters());
    const r = computeWeightedMembership(ctx, DISTRICT);
    // (10+100+60+40) + (20+200+100+80) = 210 + 400 = 610; the two-year average
    // (long-term membership, which also adds State-placed) is 310.
    expect(r.enteredHeadcountBothYears.value).toBe(610);
    expect(r.longTermMembership.value).toBe(310);
  });

  it("leaves the entered headcount blank when a year's band is missing", () => {
    const ctx = createContext(syntheticParameters());
    const r = computeWeightedMembership(ctx, {
      ...DISTRICT,
      adm_years: DISTRICT.adm_years.map((y, i) =>
        i === 0 ? { ...y, grades_9_through_12: null } : y,
      ),
    });
    expect(r.enteredHeadcountBothYears.value).toBeNull();
    expect(r.enteredHeadcountBothYears.status).toBe('missing_input');
  });
});

describe('sparsity, which applies to every pupil in a qualifying district', () => {
  it('bands density exactly as § 4010(d)(4) does', () => {
    expect(sparsityBand(35.9)).toBe('weights.sparsity.density_under_36');
    expect(sparsityBand(36)).toBe('weights.sparsity.density_36_to_55');
    expect(sparsityBand(54.9)).toBe('weights.sparsity.density_36_to_55');
    expect(sparsityBand(55)).toBe('weights.sparsity.density_55_to_100');
    expect(sparsityBand(99.9)).toBe('weights.sparsity.density_55_to_100');
    expect(sparsityBand(100)).toBeNull();
    expect(sparsityBand(null)).toBeNull();
  });

  it('weights the whole district, not a subset of its pupils', () => {
    const ctx = createContext(syntheticParameters());
    const sparse = computeWeightedMembership(ctx, { ...DISTRICT, persons_per_square_mile: 20 });
    // 458.5 + (310 x 0.1) = 489.5
    expect(sparse.total.value).toBeCloseTo(489.5, 10);
  });

  it('cannot determine the weight when density is unknown', () => {
    const ctx = createContext(syntheticParameters());
    const unknown = computeWeightedMembership(ctx, { ...DISTRICT, persons_per_square_mile: null });
    expect(unknown.total.value).toBeNull();
    expect(unknown.total.status).toBe('missing_input');
  });
});

describe('small schools', () => {
  it('bands enrollment exactly as § 4010(d)(5) does', () => {
    expect(smallSchoolTier(99)).toBe('weights.small_school.enrollment_under_100');
    expect(smallSchoolTier(100)).toBe('weights.small_school.enrollment_100_to_250');
    expect(smallSchoolTier(249)).toBe('weights.small_school.enrollment_100_to_250');
    expect(smallSchoolTier(250)).toBeNull();
  });

  it('applies only where the district is at or below the density ceiling', () => {
    const ctx = createContext(syntheticParameters());
    const schools = [{ name: 'Test School', average_two_year_enrollment: 80 }];

    // 120 persons/sq mi is above the ceiling of 55: no small school weight.
    const dense = computeWeightedMembership(ctx, { ...DISTRICT, small_schools: schools });
    expect(dense.total.value).toBeCloseTo(458.5, 10);

    // At 20 persons/sq mi it qualifies: sparsity 31, plus 80 x 0.2 = 16.
    const sparse = computeWeightedMembership(ctx, {
      ...DISTRICT,
      persons_per_square_mile: 20,
      small_schools: schools,
    });
    expect(sparse.total.value).toBeCloseTo(505.5, 10);
  });
});

describe('hold harmless, § 4010(e)', () => {
  // The subsection is marked "not in effect July 1, 2025-June 30, 2029", so it
  // binds in FY2025 and is switched off for FY2026 through FY2029. Whether it
  // applies is therefore data, not a constant.
  const on = (over: Record<string, number | boolean> = {}) =>
    createContext(syntheticParameters({ overrides: { 'membership.hold_harmless_applies': true, ...over } }));

  it('does nothing in a year the floor is switched off', () => {
    const ctx = createContext(syntheticParameters());
    const result = computeWeightedMembership(ctx, {
      ...DISTRICT,
      prior_year_weighted_membership: 10_000,
    });

    expect(result.holdHarmlessFloor).toBeNull();
    // A colossal prior year cannot drag the figure up when the floor is off.
    expect(result.total.value).toBeCloseTo(458.5, 10);
  });

  it('raises a shrinking district to 96.5 percent of its prior year', () => {
    // Prior year 1,000 gives a floor of 965, well above the computed 458.5.
    const result = computeWeightedMembership(on(), {
      ...DISTRICT,
      prior_year_weighted_membership: 1_000,
    });

    expect(result.beforeHoldHarmless.value).toBeCloseTo(458.5, 10);
    expect(result.holdHarmlessFloor?.value).toBeCloseTo(965, 10);
    expect(result.total.value).toBeCloseTo(965, 10);
  });

  it('leaves a growing district untouched', () => {
    // The floor only ever raises a result; it never trims one.
    const result = computeWeightedMembership(on(), {
      ...DISTRICT,
      prior_year_weighted_membership: 100,
    });

    expect(result.holdHarmlessFloor?.value).toBeCloseTo(96.5, 10);
    expect(result.total.value).toBeCloseTo(458.5, 10);
  });

  it('does not bind on a fall of less than 3.5 percent', () => {
    // Prior 460 -> floor 443.9, below the computed 458.5.
    const result = computeWeightedMembership(on(), {
      ...DISTRICT,
      prior_year_weighted_membership: 460,
    });
    expect(result.total.value).toBeCloseTo(458.5, 10);
  });

  it('refuses to answer when the floor applies and the prior year is unknown', () => {
    // An unapplied floor and an absent one are indistinguishable in the output,
    // so the engine declines rather than quietly reporting the unfloored figure.
    const result = computeWeightedMembership(on(), {
      ...DISTRICT,
      prior_year_weighted_membership: null,
    });

    expect(result.total.value).toBeNull();
    expect(result.total.status).toBe('missing_input');
  });

  it('says in the walkthrough that the figure is a statutory minimum', () => {
    const result = computeWeightedMembership(on(), {
      ...DISTRICT,
      prior_year_weighted_membership: 1_000,
    });
    const step = toSteps(result.total).find((s) => s.node.label === 'Hold harmless floor');
    expect(step).toBeDefined();
    expect(result.total.explanation).toMatch(/greater of/i);
  });
});

describe('the engine refuses to compute from unverified parameters', () => {
  it('returns null and marks the node unverified rather than producing a number', () => {
    const ctx = createContext(syntheticParameters({ unverified: ['weights.grade.9_through_12'] }));
    const result = computeWeightedMembership(ctx, DISTRICT);

    expect(result.total.value).toBeNull();
    expect(result.total.status).toBe('unverified');
    expect(result.total.blockers.map((b) => b.ref)).toContain('weights.grade.9_through_12');
  });

  it('blocks on the prekindergarten weight, which is the real FY2027 situation', () => {
    // § 4010(d)(1) has a version effective July 1 2026 if the Act 73
    // contingency is met, in which prekindergarten is repealed. That date is
    // inside FY2027 and the contingency status is not determinable from the
    // codified section, so the shipped parameter file leaves it unverified.
    const ctx = createContext(syntheticParameters({ unverified: ['weights.grade.prekindergarten'] }));
    const result = computeWeightedMembership(ctx, DISTRICT);

    expect(result.total.value).toBeNull();
    expect(result.total.status).toBe('unverified');
  });

  it('propagates all the way through spending and tax rate, not just one step', () => {
    const ctx = createContext(syntheticParameters({ unverified: ['weights.grade.6_through_8'] }));
    const membership = computeWeightedMembership(ctx, DISTRICT);
    const spending = input(ctx, 'Education spending', 4_585_000, 'usd');
    const perPupil = perPupilEducationSpending(ctx, spending, membership.total);
    const rate = townRate(ctx, perPupil, { town: 'town/test', cla: 0.8, cla_source: 'test' }, 10_000);

    expect(perPupil.value).toBeNull();
    expect(rate.billedRate.value).toBeNull();
    expect(rate.billedRate.status).toBe('unverified');
  });

  it('an unverified averaging rule invalidates the average even though the arithmetic is trivial', () => {
    const ctx = createContext(syntheticParameters({ unverified: ['membership.long_term_membership_years'] }));
    const result = computeWeightedMembership(ctx, DISTRICT);
    expect(result.longTermMembership.value).toBeNull();
    expect(result.longTermMembership.status).toBe('unverified');
  });
});

describe('missing source data is distinguished from unverified law', () => {
  it('reports missing_input when the district did not publish a count', () => {
    const ctx = createContext(syntheticParameters());
    const result = computeWeightedMembership(ctx, { ...DISTRICT, poverty_185_fpl: null });

    expect(result.total.value).toBeNull();
    expect(result.total.status).toBe('missing_input');
  });

  it('says so in plain language rather than implying a zero', () => {
    const ctx = createContext(syntheticParameters());
    const node = input(ctx, 'Health insurance', null, 'usd');
    expect(node.explanation).toMatch(/does not publish it/);
    expect(node.value).not.toBe(0);
  });

  it('an unverified parameter outranks a missing input in the headline status', () => {
    const ctx = createContext(syntheticParameters({ unverified: ['weights.grade.9_through_12'] }));
    const result = computeWeightedMembership(ctx, { ...DISTRICT, poverty_185_fpl: null });

    expect(result.total.status).toBe('unverified');
    const kinds = new Set(result.total.blockers.map((b) => b.kind));
    expect(kinds).toContain('unverified_parameter');
    expect(kinds).toContain('missing_input');
  });
});

describe('combining districts', () => {
  it('sums membership by year before averaging', () => {
    const ctx = createContext(syntheticParameters());
    const combined = combineMembership(ctx, [DISTRICT, { ...DISTRICT, entity: 'ud/other' }], {
      entity: 'ud/merged',
      persons_per_square_mile: 120,
      small_schools: [],
    });
    expect(combined.longTermMembership.value).toBe(620);
    expect(combined.total.value).toBeCloseTo(917, 10);
  });

  it('recomputes density for the combined entity rather than inheriting it', () => {
    // Two sparse districts do not necessarily make a sparse district; the
    // merged density is supplied by the caller and can lose the weight.
    const ctx = createContext(syntheticParameters());
    const sparse = { ...DISTRICT, persons_per_square_mile: 20 };
    const combined = combineMembership(ctx, [sparse, { ...sparse, entity: 'ud/other' }], {
      entity: 'ud/merged',
      persons_per_square_mile: 120,
      small_schools: [],
    });
    expect(combined.total.value).toBeCloseTo(917, 10);
  });

  it('makes the combined count unknown when one district is missing data', () => {
    const ctx = createContext(syntheticParameters());
    const combined = combineMembership(ctx, [DISTRICT, { ...DISTRICT, poverty_185_fpl: null }], {
      entity: 'ud/merged',
      persons_per_square_mile: 120,
      small_schools: [],
    });
    expect(combined.total.value).toBeNull();
    expect(combined.total.status).toBe('missing_input');
  });
});

describe('the homestead tax rate', () => {
  const ctx = () => createContext(syntheticParameters());

  it('divides spending by the yield, then floors the adjustment at one', () => {
    const c = ctx();
    const perPupil = input(c, 'Per pupil education spending', 10_000, 'usd_per_pupil');
    const result = townRate(c, perPupil, { town: 'town/test', cla: 0.8, cla_source: 'test' }, 10_000);

    expect(result.spendingAdjustment.value).toBeCloseTo(1, 10);
    expect(result.equalizedRate.value).toBeCloseTo(1, 10);
    // § 5402(b)(1): divided by CLA over the statewide adjustment (1 here).
    expect(result.billedRate.value).toBeCloseTo(1.25, 10);
  });

  it('does not let a low-spending district fall below the floor', () => {
    // § 5401(13)(A) takes the GREATER of one or the fraction. A plain division
    // would give 0.50 here, understating the rate by half.
    const c = ctx();
    const perPupil = input(c, 'Per pupil education spending', 5_000, 'usd_per_pupil');
    const result = townRate(c, perPupil, { town: 'town/test', cla: 1, cla_source: 'test' }, 10_000);

    expect(result.spendingAdjustment.value).toBe(1);
    expect(result.equalizedRate.value).toBe(1);
  });

  it('adds excess spending into the numerator rather than charging it separately', () => {
    // Threshold = 1.18 x 10,000 = 11,800. Spending 15,000 gives excess 3,200,
    // so the numerator is 18,200 and the adjustment 1.82.
    const c = ctx();
    const perPupil = input(c, 'Per pupil education spending', 15_000, 'usd_per_pupil');
    const excess = excessSpending(c, perPupil, 10_000);
    expect(excess.value).toBeCloseTo(3_200, 10);

    const adjustment = spendingAdjustment(c, perPupil, excess);
    expect(adjustment.value).toBeCloseTo(1.82, 10);
  });

  it('charges no excess spending below the threshold', () => {
    const c = ctx();
    const perPupil = input(c, 'Per pupil education spending', 11_000, 'usd_per_pupil');
    expect(excessSpending(c, perPupil, 10_000).value).toBe(0);
  });

  it('divides by CLA over the statewide adjustment, not by CLA alone', () => {
    // With a statewide adjustment of 1.03 and a CLA of 0.8 the divisor is
    // 0.7767, not 0.8 -- a difference of about 3% on every bill.
    const c = createContext(syntheticParameters({ overrides: { 'tax.statewide_adjustment': 1.03 } }));
    const perPupil = input(c, 'Per pupil education spending', 10_000, 'usd_per_pupil');
    const result = townRate(c, perPupil, { town: 'town/test', cla: 0.8, cla_source: 'test' }, 10_000);

    expect(result.billedRate.value).toBeCloseTo(1 / (0.8 / 1.03), 10);
    expect(result.billedRate.value).not.toBeCloseTo(1.25, 4);
  });

  it('cannot produce a rate while the yield is unset', () => {
    // The yield is set annually by the yield act. A year the Legislature has
    // not acted on genuinely has no rate, and must not borrow last year's.
    const c = createContext(syntheticParameters({ nulled: ['yield.property_dollar_equivalent'] }));
    const perPupil = input(c, 'Per pupil education spending', 10_000, 'usd_per_pupil');
    const result = townRate(c, perPupil, { town: 'town/test', cla: 0.8, cla_source: 'test' }, 10_000);

    // The floor still applies, so the adjustment is 1 -- but that is a floor,
    // not a computed value, and the walkthrough says so.
    expect(result.billedRate.status).not.toBe('ok');
  });

  it('explains the CLA step, which is the one residents have never had explained', () => {
    const c = ctx();
    const perPupil = input(c, 'Per pupil education spending', 10_000, 'usd_per_pupil');
    const result = townRate(c, perPupil, { town: 'town/test', cla: 0.8, cla_source: 'test' }, 10_000);

    const cla = toSteps(result.billedRate).find((s) => s.node.op === 'input' && s.node.label.endsWith('common level of appraisal'));
    expect(cla?.node.notes.join(' ')).toMatch(/raises its billed rate even when district spending is unchanged/);
  });

  it('does not divide by a zero denominator', () => {
    const c = ctx();
    const spending = input(c, 'Education spending', 1_000, 'usd');
    const zero = input(c, 'Weighted membership', 0, 'pupils');
    const perPupil = perPupilEducationSpending(c, spending, zero);

    expect(perPupil.value).toBeNull();
    expect(perPupil.status).toBe('missing_input');
  });
});

describe('scenarios present movement in both directions', () => {
  const base: DistrictBudget = {
    entity: 'ud/a',
    fiscal_year: 2027,
    education_spending: 1_700_000,
    source: 'test fixture',
  };
  const two = [base, { ...base, entity: 'ud/b' }];

  it('reports a signed delta that can go either way', () => {
    const ctx = createContext(syntheticParameters());
    const reduced = runScenario(ctx, {
      name: 'assume a 5% consolidation efficiency',
      districts: two,
      assumptions: defaultAssumptions().map((a) =>
        a.key === 'consolidation_factor' ? { ...a, value: 0.95 } : a,
      ),
    });
    expect(reduced.currentTotal.value).toBe(3_400_000);
    expect(reduced.delta.value).toBeCloseTo(-170_000, 6);

    const increased = runScenario(ctx, {
      name: 'assume costs rise 5% during the transition',
      districts: two,
      assumptions: defaultAssumptions().map((a) =>
        a.key === 'consolidation_factor' ? { ...a, value: 1.05 } : a,
      ),
    });
    expect(increased.delta.value).toBeCloseTo(170_000, 6);
  });

  it('reports the current total as unknown when a district did not publish it', () => {
    const ctx = createContext(syntheticParameters());
    const missing: DistrictBudget = { ...base, entity: 'ud/c', education_spending: null };
    const result = runScenario(ctx, {
      name: 'one district published no total',
      districts: [base, missing],
      assumptions: defaultAssumptions(),
    });
    expect(result.currentTotal.value).toBeNull();
    expect(result.delta.value).toBeNull();
  });

  it('changes nothing at all under default assumptions', () => {
    const ctx = createContext(syntheticParameters());
    const result = runScenario(ctx, {
      name: 'merge with no assumed consolidation',
      districts: two,
      assumptions: defaultAssumptions(),
    });
    expect(result.delta.value).toBe(0);
  });
});

describe('the walkthrough', () => {
  it('flattens to an ordered step list with every parameter cited', () => {
    const ctx = createContext(syntheticParameters());
    const result = computeWeightedMembership(ctx, DISTRICT);

    const steps = toSteps(result.total);
    expect(steps.length).toBeGreaterThan(10);
    expect(steps.every((s) => s.node.explanation.length > 0)).toBe(true);

    const cited = collectParameters(result.total).map((p) => p.key);
    expect(cited).toContain('weights.grade.9_through_12');
    expect(cited).toContain('weights.poverty_185_fpl');
  });

  it('expands each node once and back-references the rest', () => {
    // The graph is a DAG: long-term membership is both a term of weighted
    // membership and the base the sparsity weight applies to. Shared nodes are
    // reported once in full and thereafter as repeats, so the UI has unique
    // keys and the walkthrough does not restate the same working twice.
    const ctx = createContext(syntheticParameters({ overrides: { 'weights.sparsity.density_under_36': 0.1 } }));
    const steps = toSteps(computeWeightedMembership(ctx, { ...DISTRICT, persons_per_square_mile: 20 }).total);

    const expanded = steps.filter((s) => !s.repeated).map((s) => s.node.id);
    expect(new Set(expanded).size).toBe(expanded.length);
    expect(steps.some((s) => s.repeated)).toBe(true);
  });
});

describe('parameter file parsing', () => {
  const minimal = (over: Record<string, unknown> = {}) => ({
    schema_version: '1.0',
    fiscal_year: 2027,
    status: 'draft',
    parameters: {
      'weights.grade.9_through_12': {
        value: null,
        unit: 'multiplier',
        description: 'the grades 9-12 weight',
        citation: { statute: '16 V.S.A. § 4010', verified: false, verified_date: null },
        ...over,
      },
    },
  });

  it('accepts a draft file whose parameters are unverified', () => {
    const set = parseParameterSet(minimal());
    expect(unverifiedParameters(set)).toHaveLength(1);
  });

  it('refuses a file that claims to be verified while an entry is not', () => {
    expect(() => parseParameterSet({ ...minimal(), status: 'verified' })).toThrow(/declares status: verified/);
  });

  it('refuses a verified citation with no verified_date', () => {
    expect(() =>
      parseParameterSet(minimal({ citation: { statute: '16 V.S.A. § 4010', verified: true, verified_date: null } })),
    ).toThrow(/no verified_date/);
  });

  it('refuses an unstated verification status rather than defaulting it', () => {
    expect(() => parseParameterSet(minimal({ citation: { statute: '16 V.S.A. § 4010' } }))).toThrow(
      /explicit true or false/,
    );
  });

  it('allows a contingent parameter to hold nothing at all', () => {
    const set = parseParameterSet(minimal({ contingent: true, value: null, unit: 'usd_per_pupil' }));
    expect([...set.parameters.values()][0]?.contingent).toBe(true);
  });

  it('refuses a contingent point value with no range', () => {
    expect(() => parseParameterSet(minimal({ contingent: true, value: 15000 }))).toThrow(/false precision/);
  });
});
