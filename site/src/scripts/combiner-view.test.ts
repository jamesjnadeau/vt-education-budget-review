/**
 * The combiner page's pure logic: what it runs, what it refuses, and the words
 * it shows. The island (combiner-tool.ts) is DOM glue over these functions.
 */

import { describe, expect, it } from 'vitest';

import { runCombiner, type CombinerMember, type CombinerTownRow } from '@vt-budget/model';

import type { CombinerShareState } from './combiner-share.ts';
import {
  MIN_DISTRICTS_MESSAGE,
  admScale,
  admScaleText,
  admYearsFor,
  blockerList,
  changeText,
  nameOf,
  plainText,
  planCombiner,
  resultStatus,
  type CombinerData,
  type CombinerDistrict,
} from './combiner-view.ts';
import { exampleParameters } from './model-tool.ts';

function band(value: number | null) {
  return value === null ? { value, source: 'withheld', range: { low: 0, high: 10 } } : { value, source: 'aoe' };
}

function district(entity: string, label: string, towns: string[], over: Partial<CombinerDistrict> = {}): CombinerDistrict {
  return {
    entity,
    label,
    su: 'su/test',
    towns,
    adm_years: [2025, 2026, 2027].map((year) => ({
      year,
      bands: {
        prekindergarten: band(10),
        kindergarten_through_5: band(100),
        grades_6_through_8: band(50),
        grades_9_through_12: band(40),
      },
    })),
    spending: 2_000_000,
    // As in the real build: no district publishes these three counts.
    state_placed_fte: null,
    poverty_185_fpl: null,
    english_learners: null,
    act84_decrease: 0,
    blockers: [],
    ...over,
  };
}

const DATA: CombinerData = {
  fiscal_year: 2026,
  districts: {
    'town/alpha': district('town/alpha', 'ALPHA', ['town/alpha']),
    'ud/beta-1': district('ud/beta-1', 'Beta Unified Union School District #1', ['town/beta', 'town/gamma']),
    'ud/withheld-2': district('ud/withheld-2', 'Withheld Union School District #2', ['town/delta'], {
      blockers: ['Average daily membership for prekindergarten in 2025 is withheld by the state.'],
    }),
  },
  towns: {
    'town/alpha': { label: 'Alpha', cla: 1, cla_source: 'test', published_homestead_rate: 1.5, districts: ['town/alpha'] },
    'town/beta': { label: 'Beta', cla: 0.9, cla_source: 'test', published_homestead_rate: 1.4, districts: ['ud/beta-1'] },
    'town/gamma': { label: 'Gamma', cla: 1.1, cla_source: 'test', published_homestead_rate: 1.3, districts: ['ud/beta-1'] },
    'town/delta': { label: 'Delta', cla: 1, cla_source: 'test', published_homestead_rate: null, districts: ['ud/withheld-2'] },
  },
  sus: { 'su/test': { label: 'Test Supervisory Union', districts: ['town/alpha', 'ud/beta-1', 'ud/withheld-2'] } },
  groupings: [],
};

function choices(over: Partial<CombinerShareState> = {}): CombinerShareState {
  return {
    year: 2026,
    districts: ['town/alpha', 'ud/beta-1'],
    factor: '1',
    act84: '0',
    density: '',
    statePlaced: '',
    poverty: '',
    el: '',
    school: '',
    enrollment: '',
    schoolIn: '',
    avg: '13497',
    ...over,
  };
}

describe('planCombiner', () => {
  it('asks for two districts, and builds nothing to show, when fewer are picked', () => {
    for (const districts of [[], ['town/alpha']]) {
      const plan = planCombiner(choices({ districts }), DATA);
      expect(plan).toEqual({ kind: 'too_few', message: 'Pick at least two districts.' });
    }
    expect(MIN_DISTRICTS_MESSAGE).toBe('Pick at least two districts.');
  });

  it('names a district that cannot be combined, and its reason, instead of running', () => {
    const plan = planCombiner(choices({ districts: ['town/alpha', 'ud/withheld-2'] }), DATA);
    expect(plan.kind).toBe('blocked');
    if (plan.kind !== 'blocked') return;
    expect(plan.items).toEqual([
      'Withheld Union School District #2: Average daily membership for prekindergarten in 2025 is withheld by the state.',
    ]);
  });

  it('names a slug the build does not know instead of throwing', () => {
    const plan = planCombiner(choices({ districts: ['town/alpha', 'ud/nope'] }), DATA);
    expect(plan.kind).toBe('blocked');
    if (plan.kind !== 'blocked') return;
    expect(plan.items[0]).toContain('ud/nope');
  });

  it('names a blank spending factor or Act 84 decrease rather than assuming one', () => {
    const plan = planCombiner(choices({ factor: '', act84: ' ' }), DATA);
    expect(plan.kind).toBe('input');
    if (plan.kind !== 'input') return;
    expect(plan.items.some((i) => i.includes('spending factor is blank'))).toBe(true);
    expect(plan.items.some((i) => i.includes('Act 84 decrease is blank'))).toBe(true);
  });

  it('refuses a small school with no district to belong to', () => {
    const plan = planCombiner(choices({ school: 'Hill School', enrollment: '40' }), DATA);
    expect(plan.kind).toBe('input');
  });

  it('builds members from the data, using only the fiscal year and the one before', () => {
    const plan = planCombiner(choices({ school: 'Hill School', enrollment: '40', schoolIn: 'ud/beta-1' }), DATA);
    expect(plan.kind).toBe('ready');
    if (plan.kind !== 'ready') return;
    const [alpha, beta] = plan.members as [CombinerMember, CombinerMember];
    expect(alpha.membership.adm_years.map((y) => y.fiscal_year)).toEqual([2025, 2026]);
    expect(alpha.membership.small_schools).toEqual([]);
    expect(beta.membership.small_schools).toEqual([{ name: 'Hill School', average_two_year_enrollment: 40 }]);
    expect(beta.towns.map((t) => [t.town, t.cla])).toEqual([
      ['town/beta', 0.9],
      ['town/gamma', 1.1],
    ]);
    expect(plan.options.consolidation_factor).toBe(1);
    expect(plan.options.pooled_persons_per_square_mile).toBeNull();
    expect(plan.options.statewide_average_per_pupil).toBe(13497);
    expect(plan.options.town_districts['town/gamma']).toEqual(['ud/beta-1']);
  });
});

describe('admYearsFor', () => {
  it('turns a withheld band into a blank, never its range', () => {
    const d = district('ud/x', 'X', ['town/x']);
    const withheld = { ...d, adm_years: [{ year: 2026, bands: { ...d.adm_years![0]!.bands, prekindergarten: band(null) } }] };
    expect(admYearsFor(withheld, 2026)[0]?.prekindergarten).toBeNull();
  });
});

describe('blank inputs name what blocks them', () => {
  it('a blank density and the unpublished counts each come back as a named reason', () => {
    const plan = planCombiner(choices(), DATA);
    expect(plan.kind).toBe('ready');
    if (plan.kind !== 'ready') return;
    const result = runCombiner(exampleParameters(), plan.members, plan.options);
    const reasons = blockerList(result, DATA);
    expect(reasons.some((r) => r.includes('population density') && r.includes('is blank'))).toBe(true);
    expect(reasons).toContain(
      'Alpha: the count of pupils at or below 185 percent of the federal poverty level was not published, and no pooled figure was entered.',
    );
    // Slugs are turned into names a reader knows.
    expect(reasons.every((r) => !r.includes('town/alpha'))).toBe(true);
    for (const row of result.towns) {
      expect(row.direction).toBeNull();
      expect(changeText(row)).toBe('not worked out');
      expect(row.notComputable).toMatch(/population density/);
    }
  });
});

describe('changeText', () => {
  const base: Omit<CombinerTownRow, 'delta' | 'direction'> = {
    town: 'town/alpha',
    district: 'town/alpha',
    cla: 1,
    today: null,
    pooled: null,
    notComputable: null,
  };

  it('says which way a rate moves, in words, with its sign', () => {
    expect(changeText({ ...base, delta: 0.0123, direction: 'up' })).toBe('+$0.0123 (goes up)');
    expect(changeText({ ...base, delta: -0.0123, direction: 'down' })).toBe('−$0.0123 (goes down)');
    expect(changeText({ ...base, delta: 0, direction: 'none' })).toBe('no change');
    expect(changeText({ ...base, delta: null, direction: null })).toBe('not worked out');
  });

  it('shows "no change" when a 1.00 floor holds both sides at the base rate', () => {
    // Two complete districts, each spending well under the example yield of
    // $10,000 per weighted pupil, so the spending adjustment is held at the
    // 1.00 floor both alone and pooled: the rate cannot move.
    const complete = (entity: string, pupils: number, spending: number, town: string): CombinerMember => ({
      entity,
      membership: {
        entity,
        adm_years: [2025, 2026].map((fiscal_year) => ({
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
      },
      education_spending: spending,
      act84_decrease: 0,
      towns: [{ town, cla: 1, cla_source: 'test fixture' }],
    });
    const result = runCombiner(
      exampleParameters(),
      [complete('town/alpha', 100, 500_000, 'town/alpha'), complete('town/omega', 300, 2_400_000, 'town/omega')],
      {
        consolidation_factor: 1,
        pooled_act84_decrease: 0,
        pooled_persons_per_square_mile: 120,
        statewide_average_per_pupil: 20_000,
        town_districts: {},
      },
    );
    expect(result.towns).toHaveLength(2);
    for (const row of result.towns) {
      expect(row.direction).toBe('none');
      expect(changeText(row)).toBe('no change');
    }
  });
});

describe('resultStatus', () => {
  // One short line for the role="status" region. The result itself is rebuilt on
  // every keystroke and is not live, so this line is all a screen reader hears.
  it('says what is missing when nothing is worked out', () => {
    expect(resultStatus(planCombiner(choices({ districts: ['town/alpha'] }), DATA), null)).toBe(MIN_DISTRICTS_MESSAGE);
    expect(resultStatus(planCombiner(choices({ districts: ['town/alpha', 'ud/withheld-2'] }), DATA), null)).toBe(
      'Not worked out. Some districts you picked can’t be combined yet.',
    );
    expect(resultStatus(planCombiner(choices({ factor: '' }), DATA), null)).toBe(
      'Not worked out. Some boxes need fixing first.',
    );
  });

  it('counts districts, towns, and the towns whose combined rate was worked out', () => {
    const plan = planCombiner(choices(), DATA);
    if (plan.kind !== 'ready') throw new Error('expected a ready plan');
    const result = runCombiner(exampleParameters(), plan.members, plan.options);
    expect(resultStatus(plan, result)).toBe('2 districts, 3 towns. Rate if combined worked out for 0 of 3 towns.');
  });

  it('stays the same while a number is typed, so it is not read out on every keystroke', () => {
    const run = (factor: string) => {
      const plan = planCombiner(choices({ factor }), DATA);
      if (plan.kind !== 'ready') throw new Error('expected a ready plan');
      return resultStatus(plan, runCombiner(exampleParameters(), plan.members, plan.options));
    };
    expect(run('1')).toBe(run('1.05'));
  });
});

describe('names', () => {
  it('uses a town name for a town district, and the registry name for a union district', () => {
    expect(nameOf('town/alpha', DATA)).toBe('Alpha');
    expect(nameOf('ud/beta-1', DATA)).toBe('Beta Unified Union School District #1');
    expect(nameOf('ud/nope', DATA)).toBe('ud/nope');
  });

  it('title-cases a town label the State wrote in capitals, keeping a state code', () => {
    const shouting: CombinerData = {
      ...DATA,
      towns: {
        ...DATA.towns,
        'town/underhill-town': { label: 'UNDERHILL TOWN', cla: 1, cla_source: 'test', published_homestead_rate: null, districts: [] },
        'town/orford-nh': { label: 'ORFORD NH', cla: null, cla_source: null, published_homestead_rate: null, districts: [] },
      },
    };
    expect(nameOf('town/underhill-town', shouting)).toBe('Underhill Town');
    expect(nameOf('town/orford-nh', shouting)).toBe('Orford NH');
    expect(plainText('town/underhill-town: the common level of appraisal is not on file.', shouting)).toBe(
      'Underhill Town: the common level of appraisal is not on file.',
    );
  });

  it('rewrites slugs inside a sentence', () => {
    expect(plainText('not computable yet: rate blends more than one district (town/alpha, ud/beta-1)', DATA)).toBe(
      'not computable yet: rate blends more than one district (Alpha, Beta Unified Union School District #1)',
    );
  });
});

describe('the published student count, for scale', () => {
  it('sums every band for the page year, with no state-placed students and no averaging', () => {
    // Each fixture district has 10 + 100 + 50 + 40 = 200 pupils in FY2026.
    const scale = admScale(['town/alpha', 'ud/beta-1'], DATA);
    expect(scale).toEqual({ students: 400, year: 2026, complete: true });
    expect(admScaleText(scale)).toBe(
      'For scale: the districts you picked have about 400 students in all (average daily membership, FY2026, as published).',
    );
  });

  it('says "at least" when a band is withheld, and asks for districts when none are picked', () => {
    const data: CombinerData = {
      ...DATA,
      districts: {
        ...DATA.districts,
        'ud/beta-1': district('ud/beta-1', 'Beta', ['town/beta'], {
          adm_years: [{ year: 2026, bands: { prekindergarten: band(null), kindergarten_through_5: band(1200) } }],
        }),
      },
    };
    const scale = admScale(['town/alpha', 'ud/beta-1'], data);
    expect(scale).toEqual({ students: 1400, year: 2026, complete: false });
    expect(admScaleText(scale)).toMatch(/at least 1,400 students/);
    expect(admScaleText(scale)).toMatch(/not published/);
    expect(admScale([], DATA)).toBeNull();
    expect(admScale(['ud/nope'], DATA)).toBeNull();
    expect(admScaleText(null)).toMatch(/^Pick districts/);
  });
});
