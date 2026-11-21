import { describe, expect, it } from 'vitest';

import { buildCombinerData, type CombinerInputs } from './combiner-data.ts';

const BANDS = ['prekindergarten', 'kindergarten_through_5', 'grades_6_through_8', 'grades_9_through_12'];

function published(value = 10) {
  return Object.fromEntries(BANDS.map((b) => [b, { value, source: 'aoe' }]));
}

function reg(over: Record<string, unknown>) {
  return {
    name: String(over['slug']),
    supervisory_union: null,
    operated_by: null,
    reporting_only: false,
    effective_to: null,
    member_towns: [],
    ...over,
  } as unknown as CombinerInputs['registry'][number];
}

function fixture(): CombinerInputs {
  return {
    registry: [
      reg({ slug: 'su/one', type: 'su', name: 'One Supervisory Union' }),
      reg({ slug: 'ud/alpha', type: 'ud', name: 'Alpha USD', supervisory_union: 'su/one', member_towns: ['town/aa', 'town/bb'] }),
      reg({ slug: 'ud/beta', type: 'ud', name: 'Beta USD', supervisory_union: 'su/one', member_towns: ['town/bb', 'town/cc'] }),
      reg({ slug: 'town/aa', type: 'town', name: 'AA', supervisory_union: 'su/one', operated_by: 'ud/alpha' }),
      reg({ slug: 'town/bb', type: 'town', name: 'BB', supervisory_union: 'su/one', operated_by: 'ud/alpha' }),
      reg({ slug: 'town/cc', type: 'town', name: 'Mt. CC', supervisory_union: 'su/one', operated_by: 'ud/beta' }),
      reg({ slug: 'town/solo', type: 'town', name: 'SOLO', supervisory_union: 'su/one' }),
    ],
    resolved: {
      entities: {
        'ud/alpha': { '2024': published(), '2025': published() },
        'ud/beta': {
          '2024': published(),
          '2025': { ...published(), grades_6_through_8: { value: null, source: 'withheld', range: { low: 5, low_exclusive: true, high: null } } },
        },
        'town/solo': { '2024': published(), '2025': published() },
      },
      spending: {
        'ud/alpha': { '2026': { value: 1000 } },
        'ud/beta': { '2026': { value: 2000 } },
      },
      act84: { 'ud/alpha': { value: 7 } },
      labels: {},
    },
    groupings: [{ number: 1, name: 'Group 1', members: ['ud/alpha', 'ud/beta'] }],
    taxRates: [
      { town: 'AA', cla: 0.9, homestead_rate: 1.5 },
      { town: 'Mount CC', cla: 1.1, homestead_rate: 1.6 },
    ],
    edspendTowns: [{ entity: 'town/aa', homestead_rate: 1.5, union_districts: [{ entity: 'ud/alpha' }] }],
  };
}

describe('buildCombinerData', () => {
  it('has no blockers for a district with spending and published bands', () => {
    const d = buildCombinerData(fixture());
    expect(d.fiscal_year).toBe(2026);
    expect(d.districts['ud/alpha']!.blockers).toEqual([]);
    expect(d.districts['ud/alpha']!.spending).toBe(1000);
    expect(d.districts['ud/alpha']!.act84_decrease).toBe(7);
    expect(d.districts['ud/alpha']!.towns).toEqual(['town/aa', 'town/bb']);
    expect(d.districts['ud/alpha']!.su).toBe('su/one');
  });

  it('names a withheld band and year as a blocker but keeps the bands', () => {
    const d = buildCombinerData(fixture()).districts['ud/beta']!;
    expect(d.blockers).toHaveLength(1);
    expect(d.blockers[0]).toMatch(/grades 6 through 8/i);
    expect(d.blockers[0]).toMatch(/2025/);
    expect(d.blockers[0]).toMatch(/withheld/i);
    expect(d.adm_years).not.toBeNull();
    expect(d.adm_years!.find((y) => y.year === 2025)!.bands['grades_6_through_8']!.range!.low).toBe(5);
  });

  it('blocks a district with no spending, and one with no grade counts', () => {
    const d = buildCombinerData(fixture());
    expect(d.districts['town/solo']!.blockers).toEqual(['No published education spending.']);
    expect(d.districts['town/solo']!.spending).toBeNull();
    const f = fixture();
    delete (f.resolved.entities as Record<string, unknown>)['ud/alpha'];
    const a = buildCombinerData(f).districts['ud/alpha']!;
    expect(a.adm_years).toBeNull();
    expect(a.blockers.join(' ')).toMatch(/average daily membership/i);
  });

  it('lists a town in every district that serves it', () => {
    const d = buildCombinerData(fixture());
    expect(d.towns['town/bb']!.districts).toEqual(['ud/alpha', 'ud/beta']);
    expect(d.towns['town/aa']!.districts).toEqual(['ud/alpha']);
    expect(d.towns['town/solo']!.districts).toEqual(['town/solo']);
    expect(d.sus['su/one']!.districts).toEqual(['town/solo', 'ud/alpha', 'ud/beta']);
  });

  it('matches CLA by normalised name and gives null when there is none', () => {
    const d = buildCombinerData(fixture());
    expect(d.towns['town/aa']!.cla).toBe(0.9);
    expect(d.towns['town/aa']!.published_homestead_rate).toBe(1.5);
    expect(d.towns['town/cc']!.cla).toBe(1.1);
    expect(d.towns['town/bb']!.cla).toBeNull();
    expect(d.towns['town/bb']!.cla_source).toBeNull();
    expect(d.towns['town/aa']!.cla_source).toMatch(/Tax Department/);
  });

  it('passes groupings through', () => {
    expect(buildCombinerData(fixture()).groupings).toEqual([
      { number: 1, name: 'Group 1', members: ['ud/alpha', 'ud/beta'] },
    ]);
  });

  it('ignores preliminary years after the fiscal year when finding blockers', () => {
    const f = fixture();
    (f.resolved.entities as Record<string, unknown>)['ud/alpha'] = {
      '2025': published(),
      '2026': published(),
      '2027': { ...published(), prekindergarten: { value: null, source: 'withheld' } },
    };
    expect(buildCombinerData(f).districts['ud/alpha']!.blockers).toEqual([]);
  });

  it('gives a town-run district its own town', () => {
    expect(buildCombinerData(fixture()).districts['town/solo']!.towns).toEqual(['town/solo']);
  });
});
