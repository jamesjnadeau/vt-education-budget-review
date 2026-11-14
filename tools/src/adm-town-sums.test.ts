import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { buildHomesteadAdm } from './adm-lookup.ts';
import { buildPrefillAdm, townBandSums, townsFor } from './adm-town-sums.ts';
import { buildSubgroupPublication, type SubgroupPublication } from './aoe/adm-subgroups/publish.ts';
import type { YearRecord } from './aoe/adm-subgroups/record.ts';
import { PATHS } from './paths.ts';
import { readRegistry } from './registry/store.ts';
import type { RegistryEntity } from './registry/types.ts';

function reg(entries: Array<Record<string, unknown>>): Map<string, RegistryEntity> {
  return new Map(
    entries.map((e) => [
      e.slug as string,
      { supervisory_union: null, operated_by: null, reporting_only: false, member_towns: [], ...e } as unknown as RegistryEntity,
    ]),
  );
}

const v = (value: number) => ({ value });
const hidden = { status: 'suppressed' as const, low: 1, high: 10 };
const bands = (p: unknown, k: unknown, m: unknown, h: unknown) => ({
  prekindergarten: p, kindergarten_through_5: k, grades_6_through_8: m, grades_9_through_12: h,
});
const published = (b: ReturnType<typeof bands>) => ({ row: 'published', bands: b, ell: v(0), nslelg: v(0) });

function pub(towns: Record<string, Record<string, unknown>>, preliminary = false): SubgroupPublication {
  return {
    generated: 'x',
    years: [
      { school_year: 'SY24', count_year: '2023-24', fiscal_year: 2025, preliminary: false, preliminary_note: null, not_published: [] },
      { school_year: 'SY26', count_year: '2025-26', fiscal_year: 2027, preliminary, preliminary_note: null, not_published: [] },
    ],
    towns,
  } as unknown as SubgroupPublication;
}

const registry = reg([
  { slug: 'su/x', type: 'su' },
  { slug: 'ud/one', type: 'ud', supervisory_union: 'su/x', member_towns: ['town/a', 'town/b'] },
  { slug: 'town/a', name: 'A', type: 'town', supervisory_union: 'su/x', operated_by: 'ud/one' },
  { slug: 'town/b', type: 'town', supervisory_union: 'su/x', operated_by: 'ud/one' },
  { slug: 'town/c', type: 'town', supervisory_union: 'su/x' },
  { slug: 'town/unknown', type: 'town', supervisory_union: 'su/x', reporting_only: true },
]);

describe('townsFor', () => {
  it('maps an SU to its towns, a UD to its member towns, a district-like town to itself', () => {
    expect(townsFor('su/x', registry)).toEqual(['town/a', 'town/b', 'town/c']);
    expect(townsFor('ud/one', registry)).toEqual(['town/a', 'town/b']);
    expect(townsFor('town/c', registry)).toEqual(['town/c']);
    expect(townsFor('town/a', registry)).toEqual([]);
  });
});

describe('townBandSums', () => {
  const towns = {
    'town/a': { SY24: published(bands(v(1), v(10.5), v(5), v(4))), SY26: published(bands(hidden, v(10), v(5), v(4))) },
    'town/b': { SY24: { row: 'not_applicable', reason: 'no_resident_students' }, SY26: published(bands(v(2), v(20.25), v(6), v(3))) },
  };

  it('adds published cells exactly and counts a not_applicable town as 0', () => {
    const sums = townBandSums('ud/one', pub(towns), registry);
    expect(sums.get(2025)).toEqual({
      preliminary: false,
      values: bands(1, 10.5, 5, 4),
      withheld: [],
      ranges: {},
      pairs: {},
    });
  });

  it('withholds a band when any contributing cell is withheld, with no value, and ranges it from the cell bound', () => {
    const y = townBandSums('ud/one', pub(towns, true), registry).get(2027);
    expect(y).toEqual({
      preliminary: true,
      values: bands(null, 30.25, 11, 7),
      withheld: ['prekindergarten'],
      ranges: { prekindergarten: { low: 3, low_exclusive: false, high: 12 } },
      pairs: {},
    });
  });

  it('opens the range above for a cell with no top, and gives no range for a cell with no bound at all', () => {
    const pairMember = { status: 'suppressed' as const, low: 0, high: null, exclusive_low: true };
    const complement = { status: 'suppressed' as const };
    const t = {
      'town/a': { ...towns['town/a'], SY26: published(bands(pairMember, complement, v(5), v(4))) },
      'town/b': towns['town/b'],
    };
    const y = townBandSums('ud/one', pub(t), registry).get(2027);
    expect(y?.ranges.prekindergarten).toEqual({ low: 2, low_exclusive: true, high: null });
    expect(y?.ranges.kindergarten_through_5).toEqual({ low: 20.25, low_exclusive: false, high: null });
  });

  it('records a hidden pair (two cells open above in one published row) against both bands', () => {
    const pairMember = { status: 'suppressed' as const, low: 0, high: null, exclusive_low: true };
    const t = {
      'town/a': { ...towns['town/a'], SY26: published(bands(pairMember, v(10), pairMember, v(4))) },
      'town/b': towns['town/b'],
    };
    const y = townBandSums('ud/one', pub(t), registry).get(2027);
    expect(y?.pairs).toEqual({
      prekindergarten: [{ town: 'A', with: 'grades_6_through_8' }],
      grades_6_through_8: [{ town: 'A', with: 'prekindergarten' }],
    });
  });

  it('records no pair for a lone open-above cell or for primary cells', () => {
    const t = { ...towns, 'town/a': { ...towns['town/a'], SY26: published(bands(hidden, v(10), hidden, v(4))) } };
    expect(townBandSums('ud/one', pub(t), registry).get(2027)?.pairs).toEqual({});
  });

  it('gives no range when another contributing cell was not published for the year', () => {
    const t = {
      'town/a': towns['town/a'],
      'town/b': { ...towns['town/b'], SY26: published(bands({ status: 'not_published' }, v(1), v(1), v(1))) },
    };
    const y = townBandSums('ud/one', pub(t), registry).get(2027);
    expect(y?.withheld).toEqual(['prekindergarten']);
    expect(y?.ranges).toEqual({});
  });

  it('withholds every band of a below_reporting_floor row', () => {
    const t = {
      ...towns,
      'town/b': { ...towns['town/b'], SY24: { row: 'below_reporting_floor', bands: bands(hidden, hidden, hidden, hidden), ell: hidden, nslelg: hidden } },
    };
    const y = townBandSums('ud/one', pub(t), registry).get(2025);
    expect(y?.withheld).toEqual(['prekindergarten', 'kindergarten_through_5', 'grades_6_through_8', 'grades_9_through_12']);
    expect(y?.values).toEqual(bands(null, null, null, null));
  });

  it('leaves a band unknown (not withheld) when a cell was not published for the year', () => {
    const t = { ...towns, 'town/b': { ...towns['town/b'], SY24: published(bands(v(1), { status: 'not_published' }, v(1), v(1))) } };
    const y = townBandSums('ud/one', pub(t), registry).get(2025);
    expect(y?.values.kindergarten_through_5).toBeNull();
    expect(y?.withheld).toEqual([]);
  });

  it('fails when a contributing town has no row for a year', () => {
    const t = { 'town/a': towns['town/a'], 'town/b': { SY26: towns['town/b'].SY26 } };
    expect(() => townBandSums('ud/one', pub(t), registry)).toThrow(/town\/b.*SY24/);
  });

  it('returns nothing for an entity with no towns', () => {
    expect(townBandSums('town/a', pub(towns), registry).size).toBe(0);
  });
});

describe('townBandSums against the warehouse: Addison Central', () => {
  const realRegistry = readRegistry();
  const records = ['town-sy24.yaml', 'town-sy25.yaml', 'town-sy26.yaml'].map(
    (f) => parseYaml(readFileSync(join(PATHS.warehouse, 'aoe-adm-subgroups', f), 'utf8')) as YearRecord,
  );
  const realPub = buildSubgroupPublication(records, realRegistry, 'x');
  const sums = townBandSums('su/addison-central', realPub, realRegistry);

  // Names are kept as the registry has them (AOE's capitals); the form cases them.
  it('pairs Ripton preschool with grades 6–8 in FY2025 and FY2026', () => {
    for (const fy of [2025, 2026]) {
      expect(sums.get(fy)?.pairs.prekindergarten).toEqual([{ town: 'RIPTON', with: 'grades_6_through_8' }]);
      expect(sums.get(fy)?.pairs.grades_6_through_8).toEqual([{ town: 'RIPTON', with: 'prekindergarten' }]);
    }
  });

  it('withholds preschool and 6–8 and sums K–5 and 9–12 for FY2025 and FY2026', () => {
    for (const fy of [2025, 2026]) {
      expect(sums.get(fy)?.withheld).toEqual(['prekindergarten', 'grades_6_through_8']);
    }
    expect(sums.get(2025)?.values.kindergarten_through_5).toBe(708);
    expect(sums.get(2025)?.values.grades_9_through_12).toBe(451.31);
    expect(sums.get(2026)?.values.kindergarten_through_5).toBe(677.27);
    expect(sums.get(2026)?.values.grades_9_through_12).toBe(482.63);
    expect(sums.get(2027)?.preliminary).toBe(true);
  });
});

describe('buildPrefillAdm', () => {
  const towns = {
    'town/a': { SY24: published(bands(v(1), v(10), v(5), v(4))), SY26: published(bands(hidden, v(10), v(5), v(4))) },
    'town/b': { SY24: published(bands(v(1), v(10), v(5), v(4))), SY26: published(bands(v(2), v(20), v(6), v(3))) },
  };

  it('writes a row for a publication year with no budget, and lets the district win per band', () => {
    const out = buildPrefillAdm(
      [{ entity: 'ud/one', fiscal_year: 2027, adm: { prekindergarten: 9, kindergarten_through_5: null, grades_6_through_8: null, grades_9_through_12: null } }],
      pub(towns, true),
      registry,
    );
    expect(Object.keys(out['ud/one']!)).toEqual(['2025', '2027']);
    expect(out['ud/one']!['2025']!.kindergarten_through_5).toEqual({ value: 20, source: 'aoe' });
    expect(out['ud/one']!['2027']!.prekindergarten).toEqual({ value: 9, source: 'district' });
    expect(out['ud/one']!['2027']!.kindergarten_through_5).toEqual({ value: 30, source: 'aoe', preliminary: true });
  });

  it('gives an extra entity with no budget record rows from the town sums alone', () => {
    const out = buildPrefillAdm([], pub(towns, true), registry, ['ud/one']);
    expect(Object.keys(out['ud/one']!)).toEqual(['2025', '2027']);
    expect(out['ud/one']!['2025']!.kindergarten_through_5).toEqual({ value: 20, source: 'aoe' });
  });

  it('marks a withheld band withheld when the district is silent', () => {
    const out = buildPrefillAdm([{ entity: 'ud/one', fiscal_year: 2027 }], pub(towns), registry);
    expect(out['ud/one']!['2027']!.prekindergarten).toEqual({
      value: null,
      source: 'withheld',
      range: { low: 3, low_exclusive: false, high: 12 },
    });
  });

  it('drops the range when the district states the band', () => {
    const adm = { prekindergarten: 9, kindergarten_through_5: null, grades_6_through_8: null, grades_9_through_12: null };
    const out = buildPrefillAdm([{ entity: 'ud/one', fiscal_year: 2027, adm }], pub(towns), registry);
    expect(out['ud/one']!['2027']!.prekindergarten).toEqual({ value: 9, source: 'district' });
  });

  it('keeps entities without a budget out', () => {
    expect(buildPrefillAdm([], pub(towns), registry)).toEqual({});
  });
});

describe('homestead comparison input stays off the town sums', () => {
  const towns = {
    'town/a': { SY24: published(bands(v(1), v(10), v(5), v(4))), SY26: published(bands(hidden, v(10), v(5), v(4))) },
    'town/b': { SY24: published(bands(v(1), v(10), v(5), v(4))), SY26: published(bands(v(2), v(20), v(6), v(3))) },
  };
  const budgets = [{ entity: 'ud/one', fiscal_year: 2027 }];

  it('sees only budget years and no withheld or preliminary band, while the prefill gets both', () => {
    const homestead = buildHomesteadAdm(budgets, { years: [] }, registry);
    expect(homestead).toEqual({});
    const prefill = buildPrefillAdm(budgets, pub(towns, true), registry);
    expect(Object.keys(prefill['ud/one']!)).toEqual(['2025', '2027']);
  });

  it('resolves the budget year from the district figure and the aoe-adm rollup only', () => {
    const adm = { prekindergarten: 9, kindergarten_through_5: null, grades_6_through_8: null, grades_9_through_12: null };
    const homestead = buildHomesteadAdm([{ entity: 'ud/one', fiscal_year: 2027, adm }], { years: [] }, registry);
    expect(Object.keys(homestead['ud/one']!)).toEqual(['2027']);
    const sources = Object.values(homestead['ud/one']!['2027']!).map((b) => b.source);
    expect(sources).toEqual(['district', 'unknown', 'unknown', 'unknown']);
    expect(JSON.stringify(homestead)).not.toContain('preliminary');
  });

  it('is empty without an aoe-adm publication, as before', () => {
    expect(buildHomesteadAdm(budgets, null, registry)).toEqual({});
  });
});
