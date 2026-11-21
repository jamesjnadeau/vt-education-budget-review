import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import {
  collectBlockers,
  parseParameterSet,
  runCombiner,
  type CombinerMember,
  type CombinerOptions,
  type CombinerResult,
  type MembershipInput,
} from './index.ts';
import { syntheticParameters } from './testing/synthetic.ts';

const here = dirname(fileURLToPath(import.meta.url));

/** The same district fixture `engine.test.ts` uses: weighted long-term membership 458.5. */
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

/** A district with only K-5 pupils, nothing that carries a weight, and no sparsity. */
function k5Only(entity: string, pupils: number | null, years: readonly number[] = [2026]): MembershipInput {
  return {
    entity,
    adm_years: years.map((fiscal_year) => ({
      fiscal_year,
      prekindergarten: 0,
      kindergarten_through_5: pupils,
      grades_6_through_8: 0,
      grades_9_through_12: 0,
    })),
    state_placed_fte: 0,
    poverty_185_fpl: 0,
    english_learners: 0,
    persons_per_square_mile: 120,
    small_schools: [],
    source: 'test fixture',
  };
}

function member(
  entity: string,
  membership: MembershipInput,
  spending: number | null,
  towns: ReadonlyArray<readonly [string, number | null]>,
  act84: number | null = 0,
): CombinerMember {
  return {
    entity,
    membership: { ...membership, entity },
    education_spending: spending,
    act84_decrease: act84,
    towns: towns.map(([town, cla]) => ({ town, cla, cla_source: 'test fixture' })),
  };
}

const OPTIONS: CombinerOptions = {
  consolidation_factor: 1,
  pooled_act84_decrease: 0,
  pooled_persons_per_square_mile: 120,
  statewide_average_per_pupil: 10_000,
  town_districts: {},
};

function row(result: CombinerResult, town: string) {
  const found = result.towns.find((r) => r.town === town);
  if (!found) throw new Error(`no row for ${town}`);
  return found;
}

/** Two round-number districts, the base for the hand-checked and null cases. */
const A = () => member('ud/a', k5Only('ud/a', 100), 1_000_000, [['town/a', 1]]);
const B = () => member('ud/b', k5Only('ud/b', 200), 2_400_000, [['town/b', 1]]);

describe('the combiner', () => {
  it('identity: pooling one district reproduces its own rate in every town', () => {
    const params = syntheticParameters({ transition: true });
    const only = member('ud/solo', DISTRICT, 5_000_000, [['town/x', 0.8], ['town/y', 1.1]], 0.05);
    const result = runCombiner(params, [only], { ...OPTIONS, pooled_act84_decrease: 0.05 });

    expect(result.pooled.perPupil.value).toBe(result.members[0]?.perPupil.value);
    expect(result.towns).toHaveLength(2);
    for (const r of result.towns) {
      expect(r.today?.billedRate.value).not.toBeNull();
      expect(r.pooled?.billedRate.value).toBe(r.today?.billedRate.value);
      expect(r.delta).toBe(0);
      expect(r.direction).toBe('none');
      expect(r.notComputable).toBeNull();
    }
  });

  it('hand-checkable: pools membership and spending, then reprices every town', () => {
    // Synthetic parameters: K-5 weight 0, yield 10,000, floor 1, threshold
    // ratio 1.18, statewide adjustment 1, no Act 84 transition.
    //
    //   ud/a: 100 K-5 pupils, one year (FY2026). Long-term membership is the
    //         mean of the one year supplied = 100. No poverty, EL or
    //         State-placed pupils, 120 persons/sq mi (no sparsity), so
    //         weighted = 100.
    //   ud/b: 200 K-5 pupils the same way, weighted = 200.
    //   pool: 100 + 200 = 300 K-5 pupils; weights run on the pooled counts,
    //         all zero here, so weighted = 300.
    //
    //   spending   1,000,000 + 2,400,000 = 3,400,000, x factor 1 = 3,400,000
    //   per pupil  ud/a 1,000,000 / 100 = 10,000
    //              ud/b 2,400,000 / 200 = 12,000
    //              pool 3,400,000 / 300 = 11,333.33...
    //
    //   excess threshold 1.18 x 10,000 = 11,800: ud/b is 200 over, the
    //   others are not.
    //
    //   spending adjustment = max(1, (per pupil + excess) / 10,000)
    //              ud/a today  max(1, 10,000 / 10,000)          = 1.00
    //              ud/b today  max(1, (12,000 + 200) / 10,000)  = 1.22
    //              pooled      max(1, 11,333.33 / 10,000)       = 1.1333...
    //
    //   billed = $1.00 x adjustment / (CLA 1 / statewide adjustment 1)
    //              town/a  1.00 -> 1.1333, change +0.1333, up
    //              town/b  1.22 -> 1.1333, change -0.0867, down
    const result = runCombiner(syntheticParameters(), [A(), B()], OPTIONS);

    expect(result.pooled.membership.longTermMembership.value).toBe(300);
    expect(result.pooled.membership.total.value).toBe(300);
    expect(result.pooled.spending.value).toBe(3_400_000);
    expect(result.pooled.perPupil.value).toBeCloseTo(11_333.333333, 5);
    expect(result.members.map((m) => [m.entity, m.perPupil.value])).toEqual([
      ['ud/a', 10_000],
      ['ud/b', 12_000],
    ]);

    const a = row(result, 'town/a');
    expect(a.district).toBe('ud/a');
    expect(a.today?.billedRate.value).toBeCloseTo(1, 10);
    expect(a.pooled?.billedRate.value).toBeCloseTo(1.133333, 5);
    expect(a.delta).toBeCloseTo(0.133333, 5);
    expect(a.direction).toBe('up');

    const b = row(result, 'town/b');
    expect(b.today?.billedRate.value).toBeCloseTo(1.22, 10);
    expect(b.pooled?.billedRate.value).toBeCloseTo(1.133333, 5);
    expect(b.delta).toBeCloseTo(-0.086667, 5);
    expect(b.direction).toBe('down');
  });

  it('equal districts: per pupil is unchanged and no town moves', () => {
    const params = syntheticParameters({ transition: true });
    const result = runCombiner(
      params,
      [
        member('ud/a', DISTRICT, 5_000_000, [['town/a', 0.8]], 0.03),
        member('ud/b', DISTRICT, 5_000_000, [['town/b', 1.1]], 0.03),
      ],
      { ...OPTIONS, pooled_act84_decrease: 0.03 },
    );

    // 2 x 458.5 = 917 weighted pupils, 2 x 5,000,000 spending.
    expect(result.pooled.membership.total.value).toBe(917);
    for (const m of result.members) expect(result.pooled.perPupil.value).toBe(m.perPupil.value);
    for (const r of result.towns) {
      expect(r.delta).toBe(0);
      expect(r.direction).toBe('none');
    }
  });

  it('floor: districts below the yield stay at $1.00, so the change is 0, never negative', () => {
    // Per pupil: ud/a 500,000 / 100 = 5,000; ud/b 1,600,000 / 200 = 8,000;
    // pool 2,100,000 / 300 = 7,000. All below the 10,000 yield, so every
    // spending adjustment is the floor of 1. ud/a also has an Act 84 decrease
    // of 0.20 today (0.20 x 0.8 = 0.16 off), which the $1.00 transition floor
    // cancels, so losing it in the pool moves nothing either.
    const params = syntheticParameters({ transition: true });
    const result = runCombiner(
      params,
      [
        member('ud/a', k5Only('ud/a', 100), 500_000, [['town/a', 0.9]], 0.2),
        member('ud/b', k5Only('ud/b', 200), 1_600_000, [['town/b', 1.05]], 0),
      ],
      OPTIONS,
    );

    expect(result.pooled.perPupil.value).toBeCloseTo(7_000, 6);
    for (const r of result.towns) {
      expect(r.today?.equalizedRate.value).toBe(1);
      expect(r.pooled?.equalizedRate.value).toBe(1);
      expect(r.delta).toBe(0);
      expect(r.direction).toBe('none');
    }
  });

  describe('null propagation names the member', () => {
    const expectPooledBlockedNaming = (result: CombinerResult, entity: string) => {
      expect(result.pooled.perPupil.value).toBeNull();
      for (const r of result.towns) {
        expect(r.pooled).toBeNull();
        expect(r.delta).toBeNull();
        expect(r.direction).toBeNull();
        expect(r.notComputable).toContain(entity);
      }
    };

    it('a withheld grade band', () => {
      const withheld = B();
      const b = member(
        'ud/b',
        { ...withheld.membership, adm_years: [{ ...withheld.membership.adm_years[0]!, kindergarten_through_5: null }] },
        2_400_000,
        [['town/b', 1]],
      );
      const result = runCombiner(syntheticParameters(), [A(), b], OPTIONS);

      expectPooledBlockedNaming(result, 'ud/b');
      expect(row(result, 'town/b').notComputable).toMatch(/kindergarten through grade five/);
      // ud/a's own rate today is unaffected; only ud/b's is blocked.
      expect(row(result, 'town/a').today?.billedRate.value).toBeCloseTo(1, 10);
      expect(row(result, 'town/b').today).toBeNull();
    });

    it('a missing education spending figure', () => {
      const result = runCombiner(
        syntheticParameters(),
        [A(), member('ud/b', k5Only('ud/b', 200), null, [['town/b', 1]])],
        OPTIONS,
      );

      expect(result.pooled.spending.value).toBeNull();
      expectPooledBlockedNaming(result, 'ud/b');
      expect(row(result, 'town/a').notComputable).toMatch(/education spending/);
    });

    it('a missing poverty count', () => {
      const result = runCombiner(
        syntheticParameters(),
        [A(), member('ud/b', { ...k5Only('ud/b', 200), poverty_185_fpl: null }, 2_400_000, [['town/b', 1]])],
        OPTIONS,
      );

      expect(result.pooled.membership.total.value).toBeNull();
      expectPooledBlockedNaming(result, 'ud/b');
      expect(row(result, 'town/a').notComputable).toMatch(/poverty/);
    });

    it('a year of membership one member does not have', () => {
      // ud/a reports FY2025 and FY2026; ud/b only FY2026. Summing FY2025 would
      // silently count ud/a alone, so the pool is blocked instead.
      const result = runCombiner(
        syntheticParameters(),
        [member('ud/a', k5Only('ud/a', 100, [2025, 2026]), 1_000_000, [['town/a', 1]]), B()],
        OPTIONS,
      );

      expectPooledBlockedNaming(result, 'ud/b');
      expect(row(result, 'town/a').notComputable).toMatch(/FY2025/);
    });

    it('a missing Act 84 decrease blocks that member’s rate today', () => {
      const result = runCombiner(
        syntheticParameters({ transition: true }),
        [A(), member('ud/b', k5Only('ud/b', 200), 2_400_000, [['town/b', 1]], null)],
        OPTIONS,
      );

      const b = row(result, 'town/b');
      expect(b.today).toBeNull();
      expect(b.pooled?.billedRate.value).not.toBeNull();
      expect(b.notComputable).toContain('ud/b');
      expect(b.notComputable).toMatch(/Act 84/);
      expect(row(result, 'town/a').notComputable).toBeNull();
    });
  });

  describe('pooled demographic inputs entered by the visitor', () => {
    it('fill a figure no member published, labelled as an assumption', () => {
      // Pool: 300 K-5 pupils + 30 poverty pupils x weight 1 = 330.
      const result = runCombiner(
        syntheticParameters(),
        [A(), member('ud/b', { ...k5Only('ud/b', 200), poverty_185_fpl: null }, 2_400_000, [['town/b', 1]])],
        { ...OPTIONS, pooled_inputs: { state_placed_fte: null, poverty_185_fpl: 30, english_learners: null } },
      );

      expect(result.pooled.membership.total.value).toBe(330);
      const assumption = result.assumptions.find((a) => a.key === 'pooled_inputs.poverty_185_fpl');
      expect(assumption?.value).toBe(30);
      expect(assumption?.rationale).toContain('ud/b');
      // ud/b's own rate today still needs its own published count.
      const b = row(result, 'town/b');
      expect(b.today).toBeNull();
      expect(b.pooled).not.toBeNull();
      expect(b.notComputable).toContain('ud/b');
      expect(b.notComputable).toMatch(/poverty/);
    });

    it('give way to the members’ published figures when every member has one', () => {
      // 10 + 20 = 30 published poverty pupils; the entered 999 is not used.
      const result = runCombiner(
        syntheticParameters(),
        [
          member('ud/a', { ...k5Only('ud/a', 100), poverty_185_fpl: 10 }, 1_000_000, [['town/a', 1]]),
          member('ud/b', { ...k5Only('ud/b', 200), poverty_185_fpl: 20 }, 2_400_000, [['town/b', 1]]),
        ],
        { ...OPTIONS, pooled_inputs: { state_placed_fte: 999, poverty_185_fpl: 999, english_learners: 999 } },
      );

      expect(result.pooled.membership.total.value).toBe(330);
      expect(result.assumptions.some((a) => a.key.startsWith('pooled_inputs.'))).toBe(false);
    });

    it('still block when left blank, naming the missing input', () => {
      const result = runCombiner(
        syntheticParameters(),
        [A(), member('ud/b', { ...k5Only('ud/b', 200), english_learners: null }, 2_400_000, [['town/b', 1]])],
        { ...OPTIONS, pooled_inputs: { state_placed_fte: null, poverty_185_fpl: null, english_learners: null } },
      );

      expect(result.pooled.membership.total.value).toBeNull();
      const refs = collectBlockers(result.pooled.membership.total).map((b) => b.ref);
      expect(refs).toContain('English learner pupils');
      expect(row(result, 'town/a').notComputable).toMatch(/ud\/b.*English learner/);
    });
  });

  it('hold harmless: the pooled prior year is the sum of the members’, else blocked', () => {
    // Floor = 0.965 x (110 + 220) = 318.45, above the computed 300, so it binds.
    const params = syntheticParameters({ overrides: { 'membership.hold_harmless_applies': true } });
    const withPrior = (m: CombinerMember, prior: number | null): CombinerMember => ({
      ...m,
      membership: { ...m.membership, prior_year_weighted_membership: prior },
    });

    const known = runCombiner(params, [withPrior(A(), 110), withPrior(B(), 220)], OPTIONS);
    expect(known.pooled.membership.total.value).toBeCloseTo(318.45, 10);

    const unknown = runCombiner(params, [withPrior(A(), 110), withPrior(B(), null)], OPTIONS);
    expect(unknown.pooled.membership.total.value).toBeNull();
    expect(row(unknown, 'town/a').notComputable).toContain('ud/b');
  });

  it('multi-district town: a rate that blends districts is not computed', () => {
    const a = member('ud/a', k5Only('ud/a', 100), 1_000_000, [['town/a', 1], ['town/shared', 0.9]]);
    const result = runCombiner(syntheticParameters(), [a, B()], {
      ...OPTIONS,
      town_districts: { 'town/shared': ['ud/a', 'ud/other-union'], 'town/a': ['ud/a'] },
    });

    const shared = row(result, 'town/shared');
    expect(shared.notComputable).toContain('blends more than one district');
    expect(shared.today).toBeNull();
    expect(shared.pooled).toBeNull();
    expect(shared.delta).toBeNull();
    expect(shared.direction).toBeNull();
    expect(row(result, 'town/a').notComputable).toBeNull();
  });

  it('blank sparsity: a blank pooled density blocks the pool and is named', () => {
    const result = runCombiner(syntheticParameters(), [A(), B()], {
      ...OPTIONS,
      pooled_persons_per_square_mile: null,
    });

    expect(result.pooled.membership.total.value).toBeNull();
    expect(result.pooled.perPupil.value).toBeNull();
    const refs = collectBlockers(result.pooled.perPupil).map((b) => b.ref);
    expect(refs).toContain('Additional weighting for low population density');
    for (const r of result.towns) {
      expect(r.pooled).toBeNull();
      expect(r.delta).toBeNull();
      expect(r.notComputable).toMatch(/population density/);
      // Each member's own density was supplied, so today still computes.
      expect(r.today).not.toBeNull();
    }
  });

  it('no savings: nothing in the result is keyed as a saving', () => {
    const result = runCombiner(syntheticParameters(), [A(), B()], { ...OPTIONS, consolidation_factor: 0.95 });
    const keys: string[] = [];
    JSON.stringify(result, (key, value) => {
      keys.push(key);
      return value;
    });
    expect(keys.filter((k) => /saving/i.test(k))).toEqual([]);
  });

  it('labels its assumptions and says the engine can differ from published rates', () => {
    const result = runCombiner(syntheticParameters({ transition: true }), [A(), B()], {
      ...OPTIONS,
      consolidation_factor: 0.9,
      pooled_act84_decrease: 0.02,
    });

    const byKey = new Map(result.assumptions.map((a) => [a.key, a]));
    expect(byKey.get('consolidation_factor')?.value).toBe(0.9);
    expect(byKey.get('pooled_act84_decrease')?.value).toBe(0.02);
    for (const a of result.assumptions) expect(a.rationale.length).toBeGreaterThan(40);
    expect(result.caveats.some((c) => /differ/.test(c) && /published/.test(c))).toBe(true);
    // 3,400,000 x 0.9 = 3,060,000.
    expect(result.pooled.spending.value).toBeCloseTo(3_060_000, 6);
  });

  it('golden: two artificial Slate Valley members pool to the published FY2026 rates', () => {
    // What overlaps with model/goldens/ud-slate-valley-62-fy2026.yaml, read
    // from the fixture itself: total education spending (27,080,580), the
    // published weighted long-term membership (2,341.66), the statewide
    // average (13,497), the Act 84 decrease (0), every town's CLA, and the
    // expected per pupil spending, equalized rate and six billed rates.
    //
    // What does NOT overlap, and is made up here: the fixture has no grade
    // bands and Slate Valley has no member districts in the build data. So
    // the 2,341.66 weighted pupils are split into two members as K-5 pupils
    // (weight 0, no poverty, EL or State-placed pupils, 120 persons/sq mi so
    // no sparsity or small-school weight), the same in FY2025 and FY2026,
    // with spending split unevenly. The pool then has exactly Slate Valley's
    // weighted membership and spending, and must reproduce its rates.
    const golden = parseYaml(
      readFileSync(join(here, '..', 'goldens', 'ud-slate-valley-62-fy2026.yaml'), 'utf8'),
    ) as {
      inputs: {
        weighted_membership_published: number;
        education_spending: number;
        statewide_average_per_pupil: number;
        act84_transition: { fy2025_rate_decrease: number };
        towns: Array<{ town: string; cla: number }>;
      };
      expected: {
        per_weighted_pupil: number;
        equalized_homestead_rate: number;
        town_rates: Array<{ town: string; billed_rate: number }>;
      };
      tolerance: { rates: number };
    };
    const params = parseParameterSet(
      parseYaml(readFileSync(join(here, '..', 'parameters', 'fy2026.yaml'), 'utf8')),
    );

    const totalPupils = golden.inputs.weighted_membership_published;
    const aPupils = 1_000;
    const aSpending = 10_000_000;
    const decrease = golden.inputs.act84_transition.fy2025_rate_decrease;
    const towns = golden.inputs.towns.map((t) => [t.town, t.cla] as const);
    const members = [
      member('ud/slate-valley-part-a', k5Only('a', aPupils, [2025, 2026]), aSpending, towns.slice(0, 3), decrease),
      member(
        'ud/slate-valley-part-b',
        k5Only('b', totalPupils - aPupils, [2025, 2026]),
        golden.inputs.education_spending - aSpending,
        towns.slice(3),
        decrease,
      ),
    ];

    const result = runCombiner(params, members, {
      consolidation_factor: 1,
      pooled_act84_decrease: decrease,
      pooled_persons_per_square_mile: 120,
      statewide_average_per_pupil: golden.inputs.statewide_average_per_pupil,
      town_districts: {},
    });

    expect(result.pooled.membership.total.value).toBeCloseTo(totalPupils, 6);
    expect(Math.abs((result.pooled.perPupil.value as number) - golden.expected.per_weighted_pupil)).toBeLessThanOrEqual(0.005);
    expect(result.towns).toHaveLength(6);
    for (const expected of golden.expected.town_rates) {
      const r = row(result, expected.town);
      expect(
        Math.abs((r.pooled?.equalizedRate.value as number) - golden.expected.equalized_homestead_rate),
      ).toBeLessThanOrEqual(golden.tolerance.rates + 1e-12);
      expect(
        Math.abs((r.pooled?.billedRate.value as number) - expected.billed_rate),
        `${expected.town} pooled billed rate`,
      ).toBeLessThanOrEqual(golden.tolerance.rates + 1e-12);
    }
  });
});
