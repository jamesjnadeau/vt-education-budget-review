import { describe, expect, it } from 'vitest';
import { buildJourney, type JourneyInputs } from './journey.ts';
import type { Cell, TownYear } from './residents.ts';
import type { Reassignment } from './groupings.ts';

/**
 * A small hand-made world: 3 towns in one district in one union, one town
 * alone (its own district), one town with a null rate, one with a null
 * population, one with a hidden ADM band, one closed town, and two unions so
 * we can place a town with no committee. Every number is exact and asserted.
 */

const bands = (v: number): Record<string, Cell> => ({
  prekindergarten: { value: v },
  kindergarten_through_5: { value: v },
  grades_6_through_8: { value: v },
  grades_9_through_12: { value: v },
});

const sy25 = (bands_: Record<string, Cell>, row: TownYear['row'] = 'published'): TownYear =>
  ({ row, bands: bands_ }) as TownYear;

type TownRec = {
  published_homestead_rate: number | null;
  population_2020: number | null;
};

function mkRegistry(): JourneyInputs['registry'] {
  const E = (slug: string, name: string, type: string, extra: Record<string, unknown> = {}) => ({
    slug,
    name,
    type,
    effective_to: null,
    reporting_only: false,
    supervisory_union: null,
    operated_by: null,
    ...extra,
  });
  return [
    E('town/shared-a', 'Shared A', 'town', { operated_by: 'ud/big-district', supervisory_union: 'su/big-union' }),
    E('town/shared-b', 'Shared B', 'town', { operated_by: 'ud/big-district', supervisory_union: 'su/big-union' }),
    E('town/shared-c', 'Shared C', 'town', { operated_by: 'ud/big-district', supervisory_union: 'su/big-union' }),
    E('town/alone', 'Alone', 'town', { operated_by: null, supervisory_union: 'su/other' }),
    E('town/norate', 'NoRate', 'town', { operated_by: 'ud/big-district', supervisory_union: 'su/big-union' }),
    E('town/nopop', 'NoPop', 'town', { operated_by: 'ud/big-district', supervisory_union: 'su/big-union' }),
    E('town/hiddendm', 'HiddenAdm', 'town', { operated_by: 'ud/big-district', supervisory_union: 'su/big-union' }),
    E('town/closed', 'Closed', 'town', { effective_to: '2026-07-29', operated_by: 'ud/big-district', supervisory_union: 'su/big-union' }),
    E('ud/big-district', 'Big District', 'ud', { member_towns: ['town/shared-a', 'town/shared-b', 'town/shared-c', 'town/norate', 'town/nopop', 'town/hiddendm'] }),
    E('su/big-union', 'Big Union', 'su', {}),
    E('su/other', 'Other Union', 'su', {}),
  ];
}

function mkInputs(): JourneyInputs {
  const registry = mkRegistry();
  const towns: Record<string, TownRec> = {
    'town/shared-a': { published_homestead_rate: 1.0, population_2020: 100 },
    'town/shared-b': { published_homestead_rate: 2.0, population_2020: 200 },
    'town/shared-c': { published_homestead_rate: 3.0, population_2020: 300 },
    'town/alone': { published_homestead_rate: 4.0, population_2020: 400 },
    'town/norate': { published_homestead_rate: null, population_2020: 500 },
    'town/nopop': { published_homestead_rate: 5.0, population_2020: null },
    'town/hiddendm': { published_homestead_rate: 6.0, population_2020: 600 },
  };
  const subgroupsTowns: Record<string, Record<string, TownYear>> = {
    'town/shared-a': { SY25: sy25({ ...bands(40), grades_9_through_12: { value: 20 } }) },
    'town/shared-b': { SY25: sy25(bands(10)) },
    'town/shared-c': { SY25: sy25(bands(10)) },
    'town/alone': { SY25: sy25(bands(10)) },
    'town/norate': { SY25: sy25(bands(10)) },
    'town/nopop': { SY25: sy25(bands(10)) },
    'town/hiddendm': {
      SY25: sy25({
        prekindergarten: { value: 10 },
        kindergarten_through_5: { value: 10 },
        grades_6_through_8: { value: 10 },
        grades_9_through_12: { status: 'suppressed', low: 0, high: 10, exclusive_low: true },
      }),
    },
  };
  // One committee holding ud/big-district; town/alone has no district so no committee.
  const reassignment = {
    roster_published: true,
    by: 'Facilitators',
    status: 'announced_provisional',
    as_of: '2026-09-18',
    committee_count: 1,
    district_count: 6,
    requests_granted: 0,
    comment_deadline: null,
    finalize_target: null,
    roster_as_of: '2026-11-12',
    sources: [],
    known_changes: [],
    committees: [
      {
        number: 7,
        slug: 'committee-7',
        name: 'Committee Seven',
        name_as_written: 'Committee Seven',
        verified: true,
        roster: [
          { name_as_written: 'Big District', maps_to: ['ud/big-district'], kind: 'district', adm_as_published: 100 },
        ],
      },
    ],
  } as unknown as Reassignment;

  return {
    registry,
    combiner: { towns },
    subgroups: { towns: subgroupsTowns },
    groupings: {
      reassignment,
      groupings: [{ number: 7, members: ['ud/big-district'] }],
    },
  };
}

describe('buildJourney', () => {
  const j = buildJourney(mkInputs());
  const town = (k: string) => {
    const t = j.towns[k];
    if (!t) throw new Error(`fixture town ${k} missing`);
    return t;
  };

  it('excludes closed towns from towns and townList', () => {
    expect(j.towns['closed']).toBeUndefined();
    expect(j.townList.map((t) => t.slug)).not.toContain('closed');
  });

  it('builds the correct step chains', () => {
    // alone has no district, so town->union->grouping (but no committee for alone)
    expect(town('alone').steps.map((s) => s.id)).toEqual(['town', 'union']);
    expect(town('shared-a').steps.map((s) => s.id)).toEqual(['town', 'district', 'union', 'grouping']);
    expect(town('shared-a').next?.id).toBe('district');
  });

  it('marks a null rate as a missing-input blank and excludes it from scale', () => {
    const t = town('norate');
    expect(t.rate).toEqual({ kind: 'blank', why: 'missing_input', reason: expect.any(String) });
    expect(t.rateScale.kind).toBe('blank');
    // the others' rateScale.of counts only towns with a rate (7 total - norate - closed)
    const a = town('shared-a').rateScale;
    expect(a.kind).toBe('value');
    if (a.kind === 'value') expect(a.value.of).toBe(6);
  });

  it('turns a hidden ADM band into a range and blanks the student scale; excludes it from others', () => {
    const t = town('hiddendm');
    expect(t.students.kind).toBe('sum');
    if (t.students.kind === 'sum') expect(t.students.sum.kind).toBe('range');
    expect(t.studentsScale.kind).toBe('blank');
    const a = town('shared-a').studentsScale;
    expect(a.kind).toBe('value');
    if (a.kind === 'value') expect(a.value.of).toBe(6); // 6 exact towns, hidden excluded
  });

  it('marks a null population as a missing-input blank', () => {
    expect(town('nopop').people.kind).toBe('blank');
    expect(town('shared-a').peopleScale.kind).toBe('value');
  });

  it('builds district rate ranges from member towns', () => {
    const d = j.districts['big-district'];
    expect(d?.members.map((m) => m.town).sort()).toEqual([
      'hiddendm',
      'nopop',
      'norate',
      'shared-a',
      'shared-b',
      'shared-c',
    ]);
    expect(d?.rateRange).toEqual({
      kind: 'value',
      value: { low: 1, high: 6, covers: 5, of: 6 },
    });
  });

  it('gives a town with no committee no grouping step', () => {
    const t = town('alone');
    expect(t.committeeNumber).toBeNull();
    expect(t.steps.map((s) => s.id)).toEqual(['town', 'union']);
    // the union for alone has no grouping to point on to
    expect(j.unions['other']?.next).toBeNull();
  });

  it('places a town with its own district on the committee holding that district', () => {
    // shared-a's district ud/big-district is on committee 7
    expect(town('shared-a').committeeNumber).toBe(7);
    expect(town('shared-a').steps.map((s) => s.id)).toContain('grouping');
  });

  it('builds a union page for the union the town belongs to', () => {
    const u = j.unions['big-union'];
    expect(u?.members).toHaveLength(6);
    // union rateRange min/max across member rates (norate excluded)
    expect(u?.rateRange).toEqual({ kind: 'value', value: { low: 1, high: 6, covers: 5, of: 6 } });
  });

  it('exposes a town list of every non-closed town', () => {
    expect(j.townList.map((t) => t.slug)).toEqual(
      expect.arrayContaining(['shared-a', 'shared-b', 'shared-c', 'alone', 'norate', 'nopop', 'hiddendm']),
    );
  });

  it('lists a union split across two committees and follows each town to its own', () => {
    const two = {
      registry: [
        { slug: 'town/x', name: 'Town X', type: 'town', effective_to: null, reporting_only: false, supervisory_union: 'su/split', operated_by: 'ud/d1' },
        { slug: 'town/y', name: 'Town Y', type: 'town', effective_to: null, reporting_only: false, supervisory_union: 'su/split', operated_by: 'ud/d2' },
        { slug: 'ud/d1', name: 'District One', type: 'ud', effective_to: null, reporting_only: false, supervisory_union: null, operated_by: null },
        { slug: 'ud/d2', name: 'District Two', type: 'ud', effective_to: null, reporting_only: false, supervisory_union: null, operated_by: null },
        { slug: 'su/split', name: 'Split Union', type: 'su', effective_to: null, reporting_only: false, supervisory_union: null, operated_by: null },
      ],
      combiner: {
        towns: {
          'town/x': { published_homestead_rate: 1, population_2020: 10 },
          'town/y': { published_homestead_rate: 2, population_2020: 20 },
        },
      },
      subgroups: {
        towns: {
          'town/x': { SY25: sy25(bands(5)) },
          'town/y': { SY25: sy25(bands(5)) },
        },
      },
      groupings: {
        reassignment: {
          roster_published: true,
          committees: [
            { number: 7, slug: 'c7', name: 'Seven', name_as_written: 'Seven', verified: true, roster: [{ name_as_written: 'District One', maps_to: ['ud/d1'], kind: 'district', adm_as_published: 5 }] },
            { number: 9, slug: 'c9', name: 'Nine', name_as_written: 'Nine', verified: true, roster: [{ name_as_written: 'District Two', maps_to: ['ud/d2'], kind: 'district', adm_as_published: 5 }] },
          ],
        } as unknown as Reassignment,
        groupings: [
          { number: 7, members: ['ud/d1'] },
          { number: 9, members: ['ud/d2'] },
        ],
      },
    } as JourneyInputs;

    const j2 = buildJourney(two);
    expect(j2.unions['split']?.split?.map((s) => s.number).sort()).toEqual([7, 9]);
    expect(j2.towns['x']?.committeeNumber).toBe(7);
    expect(j2.towns['y']?.committeeNumber).toBe(9);
    // one town per district -> no district step, straight to union then grouping
    expect(j2.towns['x']?.steps.map((s) => s.id)).toEqual(['town', 'union', 'grouping']);
    expect(j2.towns['x']?.steps[2]?.href).toBe('/my/grouping/7/');
  });

  it('does not route a union to a single grouping when a member district is unassigned', () => {
    // C1 regression: a union where one town's district is on committee 7 but
    // another's is on no committee must not offer "your group" as the next step —
    // that would send the unassigned town's resident somewhere their district is not.
    const mixed = {
      registry: [
        { slug: 'town/p', name: 'Town P', type: 'town', effective_to: null, reporting_only: false, supervisory_union: 'su/mix', operated_by: 'ud/z1' },
        { slug: 'town/q', name: 'Town Q', type: 'town', effective_to: null, reporting_only: false, supervisory_union: 'su/mix', operated_by: null },
        { slug: 'ud/z1', name: 'District Z1', type: 'ud', effective_to: null, reporting_only: false, supervisory_union: null, operated_by: null },
        { slug: 'su/mix', name: 'Mixed Union', type: 'su', effective_to: null, reporting_only: false, supervisory_union: null, operated_by: null },
      ],
      combiner: {
        towns: {
          'town/p': { published_homestead_rate: 1, population_2020: 10 },
          'town/q': { published_homestead_rate: 2, population_2020: 20 },
        },
      },
      subgroups: {
        towns: { 'town/p': { SY25: sy25(bands(5)) }, 'town/q': { SY25: sy25(bands(5)) } },
      },
      groupings: {
        reassignment: {
          roster_published: true,
          committees: [
            { number: 7, slug: 'c7', name: 'Seven', name_as_written: 'Seven', verified: true, roster: [{ name_as_written: 'District Z1', maps_to: ['ud/z1'], kind: 'district', adm_as_published: 5 }] },
          ],
        } as unknown as Reassignment,
        groupings: [{ number: 7, members: ['ud/z1'] }],
      },
    } as JourneyInputs;

    const j3 = buildJourney(mixed);
    const u = j3.unions['mix'];
    expect(u?.next).toBeNull();
    expect(u?.steps.map((s) => s.id)).toEqual(['union']);
    expect(u?.unassignedTowns?.map((t) => t.town)).toEqual(['q']);
    // the assigned town still gets its own grouping step; the unassigned one does not
    expect(j3.towns['p']?.committeeNumber).toBe(7);
    expect(j3.towns['q']?.committeeNumber).toBeNull();
    expect(j3.towns['q']?.steps.map((s) => s.id)).toEqual(['town', 'union']);
  });
});
