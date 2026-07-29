import { describe, expect, it } from 'vitest';

import {
  collectParameters,
  combineMembership,
  computeWeightedMembership,
  createContext,
  defaultAssumptions,
  input,
  parseParameterSet,
  perWeightedPupil,
  runScenario,
  toSteps,
  townRate,
  unverifiedParameters,
} from './index.ts';
import type { MembershipInput } from './membership.ts';
import type { DistrictBudget } from './scenario.ts';
import { syntheticParameters } from './testing/synthetic.ts';

/**
 * Test district chosen for hand-checkable arithmetic against the synthetic
 * weights in testing/synthetic.ts:
 *
 *   averaging window 2 years, over FY2025 and FY2026
 *     prekindergarten  (10 + 20) / 2  =  15   x weight 1  =    15
 *     elementary      (100 + 200) / 2 = 150   x weight 1  =   150
 *     secondary        (50 + 100) / 2 =  75   x weight 2  =   150
 *                                            base weighted =  315
 *     economically deprived  40 x 0.5                     =    20
 *     English learners        8 x 0.25                    =     2
 *                                   weighted membership   =   337
 */
const DISTRICT: MembershipInput = {
  entity: 'ud/test-district',
  adm_years: [
    { fiscal_year: 2025, prek: 10, elementary: 100, secondary: 50 },
    { fiscal_year: 2026, prek: 20, elementary: 200, secondary: 100 },
  ],
  economically_deprived: 40,
  english_learners: [{ category: 'level_1', count: 8 }],
  sparsity_eligible: false,
  small_school_eligible: false,
  source: 'test fixture',
};

describe('weighted membership', () => {
  it('applies the averaging rule and each weight in turn', () => {
    const ctx = createContext(syntheticParameters());
    const result = computeWeightedMembership(ctx, DISTRICT);

    expect(result.averagedByBand.elementary.value).toBe(150);
    expect(result.averagedByBand.secondary.value).toBe(75);
    expect(result.baseWeighted.value).toBe(315);
    expect(result.total.value).toBe(337);
    expect(result.total.status).toBe('ok');
  });

  it('honours the averaging window rather than averaging every year supplied', () => {
    const ctx = createContext(syntheticParameters({ overrides: { 'membership.averaging_years': 1 } }));
    const result = computeWeightedMembership(ctx, {
      ...DISTRICT,
      adm_years: [
        { fiscal_year: 2024, prek: 0, elementary: 0, secondary: 0 },
        ...DISTRICT.adm_years,
      ],
    });

    // With a one-year window only FY2026 counts: 200 elementary, not an
    // average that includes the earlier years.
    expect(result.averagedByBand.elementary.value).toBe(200);
  });

  it('adds the sparsity weight only when the district is eligible', () => {
    const ctx = createContext(syntheticParameters());
    const eligible = computeWeightedMembership(ctx, { ...DISTRICT, sparsity_eligible: true });
    // 337 + (315 x 0.1) = 368.5
    expect(eligible.total.value).toBeCloseTo(368.5, 6);
  });
});

describe('the engine refuses to compute from unverified parameters', () => {
  it('returns null and marks the node unverified rather than producing a number', () => {
    const ctx = createContext(syntheticParameters({ unverified: ['weights.grade.secondary'] }));
    const result = computeWeightedMembership(ctx, DISTRICT);

    expect(result.total.value).toBeNull();
    expect(result.total.status).toBe('unverified');
  });

  it('names the offending parameter so the gap is actionable', () => {
    const ctx = createContext(syntheticParameters({ unverified: ['weights.grade.secondary'] }));
    const result = computeWeightedMembership(ctx, DISTRICT);

    const refs = result.total.blockers.map((b) => b.ref);
    expect(refs).toContain('weights.grade.secondary');
    expect(result.total.explanation).toMatch(/verified against current statute text/);
  });

  it('propagates all the way through spending and tax rate, not just one step', () => {
    const ctx = createContext(syntheticParameters({ unverified: ['weights.grade.elementary'] }));
    const membership = computeWeightedMembership(ctx, DISTRICT);
    const spending = input(ctx, 'Education spending', 3_370_000, 'usd');
    const perPupil = perWeightedPupil(ctx, spending, membership.total);
    const rate = townRate(ctx, perPupil, { town: 'town/test', cla: 0.8, cla_source: 'test' });

    expect(perPupil.value).toBeNull();
    expect(rate.billedRate.value).toBeNull();
    expect(rate.billedRate.status).toBe('unverified');
  });

  it('an unverified averaging rule invalidates the average even though the arithmetic is trivial', () => {
    const ctx = createContext(syntheticParameters({ unverified: ['membership.averaging_years'] }));
    const result = computeWeightedMembership(ctx, DISTRICT);

    // Averaging over the wrong window is simply the wrong number, so the
    // average must not stand as a trustworthy figure.
    expect(result.averagedByBand.elementary.value).toBeNull();
    expect(result.averagedByBand.elementary.status).toBe('unverified');
  });
});

describe('missing source data is distinguished from unverified law', () => {
  it('reports missing_input when the district did not publish a count', () => {
    const ctx = createContext(syntheticParameters());
    const result = computeWeightedMembership(ctx, {
      ...DISTRICT,
      economically_deprived: null,
    });

    expect(result.total.value).toBeNull();
    expect(result.total.status).toBe('missing_input');
    expect(result.total.blockers.some((b) => b.kind === 'missing_input')).toBe(true);
  });

  it('says so in plain language rather than implying a zero', () => {
    const ctx = createContext(syntheticParameters());
    const node = input(ctx, 'Health insurance', null, 'usd');

    expect(node.explanation).toMatch(/does not publish it/);
    expect(node.explanation).toMatch(/does not estimate values it was not given/);
    expect(node.value).not.toBe(0);
  });

  it('an unverified parameter outranks a missing input in the headline status', () => {
    const ctx = createContext(syntheticParameters({ unverified: ['weights.grade.secondary'] }));
    const result = computeWeightedMembership(ctx, { ...DISTRICT, economically_deprived: null });

    expect(result.total.status).toBe('unverified');
    // but both are still reported
    const kinds = new Set(result.total.blockers.map((b) => b.kind));
    expect(kinds).toContain('unverified_parameter');
    expect(kinds).toContain('missing_input');
  });
});

describe('combining districts', () => {
  it('sums membership by year before averaging, not after weighting', () => {
    const ctx = createContext(syntheticParameters());
    const other: MembershipInput = { ...DISTRICT, entity: 'ud/other' };
    const combined = combineMembership(ctx, [DISTRICT, other], {
      entity: 'ud/merged',
      sparsity_eligible: false,
      small_school_eligible: false,
    });

    expect(combined.total.value).toBe(674);
  });

  it('does not inherit sparsity eligibility from its parts', () => {
    const ctx = createContext(syntheticParameters());
    const sparse: MembershipInput = { ...DISTRICT, sparsity_eligible: true };
    const combined = combineMembership(ctx, [sparse, sparse], {
      entity: 'ud/merged',
      sparsity_eligible: false,
      small_school_eligible: false,
    });

    // Two sparse districts do not necessarily make a sparse district. The
    // combined entity's eligibility is stated by the caller, not inferred.
    expect(combined.total.value).toBe(674);
  });

  it('makes the combined count unknown when one district is missing data', () => {
    const ctx = createContext(syntheticParameters());
    const incomplete: MembershipInput = { ...DISTRICT, economically_deprived: null };
    const combined = combineMembership(ctx, [DISTRICT, incomplete], {
      entity: 'ud/merged',
      sparsity_eligible: false,
      small_school_eligible: false,
    });

    expect(combined.total.value).toBeNull();
    expect(combined.total.status).toBe('missing_input');
  });
});

describe('tax rate', () => {
  it('divides per-pupil spending by the yield, then by the CLA', () => {
    const ctx = createContext(syntheticParameters());
    const membership = computeWeightedMembership(ctx, DISTRICT);
    const spending = input(ctx, 'Education spending', 3_370_000, 'usd');
    const perPupil = perWeightedPupil(ctx, spending, membership.total);

    expect(perPupil.value).toBe(10_000);

    const result = townRate(ctx, perPupil, {
      town: 'town/test',
      cla: 0.8,
      cla_source: 'Vermont Department of Taxes',
    });

    expect(result.equalizedRate.value).toBe(1);
    expect(result.billedRate.value).toBeCloseTo(1.25, 10);
  });

  it('explains the CLA step, which is the one residents have never had explained', () => {
    const ctx = createContext(syntheticParameters());
    const perPupil = input(ctx, 'Per weighted pupil', 10_000, 'usd_per_pupil');
    const result = townRate(ctx, perPupil, { town: 'town/test', cla: 0.8, cla_source: 'test' });

    const claNode = toSteps(result.billedRate).find((s) => s.node.label.includes('common level of appraisal'));
    expect(claNode?.node.notes.join(' ')).toMatch(/raises its billed rate even when district spending is unchanged/);
  });

  it('does not divide by a zero denominator', () => {
    const ctx = createContext(syntheticParameters());
    const spending = input(ctx, 'Education spending', 1_000, 'usd');
    const zeroMembership = input(ctx, 'Weighted membership', 0, 'pupils');
    const perPupil = perWeightedPupil(ctx, spending, zeroMembership);

    expect(perPupil.value).toBeNull();
    expect(perPupil.status).toBe('missing_input');
  });
});

describe('scenarios present movement in both directions', () => {
  const base: DistrictBudget = {
    entity: 'ud/a',
    fiscal_year: 2027,
    expenditures: {
      instruction: 1_000_000,
      special_education: 200_000,
      administration_district: 100_000,
      administration_school: 80_000,
      operations_maintenance: 150_000,
      transportation: 90_000,
      debt_service: 50_000,
      other: 30_000,
    },
    personnel: {
      total_staff_costs: 1_200_000,
      salaries: 900_000,
      benefits_health: 220_000,
      benefits_other: 80_000,
      fte_total: 60,
    },
    source: 'test fixture',
  };

  const two = [base, { ...base, entity: 'ud/b' }];

  it('reports a signed delta that can go either way', () => {
    const ctx = createContext(syntheticParameters());

    const reduced = runScenario(ctx, {
      name: 'consolidate half of district administration',
      districts: two,
      consolidatedPositions: [],
      assumptions: defaultAssumptions().map((a) =>
        a.key === 'district_admin_retained' ? { ...a, value: 0.5 } : a,
      ),
    });
    expect(reduced.delta.value).toBe(-100_000);

    const increased = runScenario(ctx, {
      name: 'transportation costs rise on longer routes',
      districts: two,
      consolidatedPositions: [],
      assumptions: defaultAssumptions().map((a) =>
        a.key === 'transportation_multiplier' ? { ...a, value: 1.2 } : a,
      ),
    });
    expect(increased.delta.value).toBeCloseTo(36_000, 6);
  });

  it('changes nothing at all under default assumptions', () => {
    const ctx = createContext(syntheticParameters());
    const result = runScenario(ctx, {
      name: 'merge with no assumed consolidation',
      districts: two,
      consolidatedPositions: [],
      assumptions: defaultAssumptions(),
    });

    // Redrawing a boundary is not by itself a change in spending. Any movement
    // shown must come from an assumption the user can see and change.
    expect(result.delta.value).toBe(0);
  });

  it('carries an assumptions register and caveats with the result', () => {
    const ctx = createContext(syntheticParameters());
    const result = runScenario(ctx, {
      name: 'merge',
      districts: two,
      consolidatedPositions: [],
      assumptions: defaultAssumptions(),
    });

    expect(result.assumptions.length).toBeGreaterThan(0);
    expect(result.assumptions.every((a) => a.rationale.length > 0)).toBe(true);
    expect(result.caveats.join(' ')).toMatch(/transition costs/);
  });

  it('reports an unpriced consolidated position as unknown, never as zero', () => {
    const ctx = createContext(syntheticParameters());
    const result = runScenario(ctx, {
      name: 'merge two superintendencies',
      districts: two,
      consolidatedPositions: [
        {
          role: 'superintendent',
          fte: 1,
          average_salary: null,
          note: 'the merged district needs one superintendent, not two',
        },
      ],
      assumptions: defaultAssumptions(),
    });

    expect(result.staffing.salariesScenario.value).toBeNull();
    expect(result.caveats.join(' ')).toMatch(/no stated average\s+salary/);
  });

  it('prices a consolidated position when a salary is supplied', () => {
    const ctx = createContext(syntheticParameters());
    const result = runScenario(ctx, {
      name: 'merge two superintendencies',
      districts: two,
      consolidatedPositions: [
        { role: 'superintendent', fte: 1, average_salary: 150_000, note: 'one, not two' },
      ],
      assumptions: defaultAssumptions(),
    });

    expect(result.staffing.salariesCurrent.value).toBe(1_800_000);
    expect(result.staffing.salariesScenario.value).toBe(1_650_000);
  });

  it('applies the health insurance trend independently of headcount', () => {
    const ctx = createContext(syntheticParameters());
    const result = runScenario(ctx, {
      name: 'merge with health costs still rising',
      districts: two,
      consolidatedPositions: [
        { role: 'superintendent', fte: 1, average_salary: 150_000, note: 'one, not two' },
      ],
      assumptions: defaultAssumptions().map((a) =>
        a.key === 'health_insurance_trend' ? { ...a, value: 0.1 } : a,
      ),
    });

    expect(result.staffing.healthCurrent.value).toBe(440_000);
    expect(result.staffing.healthScenario.value).toBeCloseTo(484_000, 6);
  });
});

describe('the walkthrough', () => {
  it('flattens to an ordered step list with every parameter cited', () => {
    const ctx = createContext(syntheticParameters());
    const result = computeWeightedMembership(ctx, DISTRICT);

    const steps = toSteps(result.total);
    expect(steps.length).toBeGreaterThan(10);
    expect(steps[0]?.depth).toBe(0);
    expect(steps.every((s) => s.node.explanation.length > 0)).toBe(true);

    const cited = collectParameters(result.total).map((p) => p.key);
    expect(cited).toContain('weights.grade.secondary');
    expect(cited).toContain('weights.economically_deprived');
  });

  it('gives every node a unique id so the UI can key on it', () => {
    const ctx = createContext(syntheticParameters());
    const result = computeWeightedMembership(ctx, DISTRICT);
    const ids = toSteps(result.total).map((s) => s.node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('parameter file parsing', () => {
  const minimal = (over: Record<string, unknown> = {}) => ({
    schema_version: '1.0',
    fiscal_year: 2027,
    status: 'draft',
    parameters: {
      'weights.grade.secondary': {
        value: null,
        unit: 'multiplier',
        description: 'the secondary weight',
        citation: { statute: '16 V.S.A. § 4010', verified: false, verified_date: null },
        ...over,
      },
    },
  });

  it('accepts a draft file whose parameters are unverified', () => {
    const set = parseParameterSet(minimal());
    expect(set.status).toBe('draft');
    expect(unverifiedParameters(set)).toHaveLength(1);
  });

  it('refuses a file that claims to be verified while an entry is not', () => {
    expect(() => parseParameterSet({ ...minimal(), status: 'verified' })).toThrow(
      /declares status: verified/,
    );
  });

  it('refuses a verified citation with no verified_date', () => {
    expect(() =>
      parseParameterSet(
        minimal({ citation: { statute: '16 V.S.A. § 4010', verified: true, verified_date: null } }),
      ),
    ).toThrow(/no verified_date/);
  });

  it('refuses an unstated verification status rather than defaulting it', () => {
    expect(() =>
      parseParameterSet(minimal({ citation: { statute: '16 V.S.A. § 4010' } })),
    ).toThrow(/explicit true or false/);
  });

  it('allows a contingent parameter to hold nothing at all', () => {
    const set = parseParameterSet(
      minimal({ contingent: true, value: null, unit: 'usd_per_pupil' }),
    );
    expect([...set.parameters.values()][0]?.contingent).toBe(true);
  });

  it('refuses a contingent point value with no range', () => {
    expect(() => parseParameterSet(minimal({ contingent: true, value: 15000 }))).toThrow(
      /false precision/,
    );
  });

  it('refuses a range with no stated basis', () => {
    expect(() =>
      parseParameterSet(minimal({ contingent: true, value: 15000, range: { low: 1, high: 2 } })),
    ).toThrow(/basis is required/);
  });
});
