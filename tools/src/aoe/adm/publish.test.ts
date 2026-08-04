import { describe, expect, it } from 'vitest';

import { readRegistry } from '../../registry/store.ts';
import { buildAdmPublication } from './publish.ts';

const RECORD = {
  schema_version: '1.0',
  source: 'intake/aoe-adm/fy2024/x.xlsx',
  count_year: '2022-2023',
  adm_label: 24,
  fiscal_year: 2024,
  source_title: 'ADM Report for 2022-2023 (ADM-24)',
  bands_as_published: [
    { header: 'Elem ( K - 6)', statutory_band: null },
    { header: 'SEC ( 7 - 12)', statutory_band: null },
  ],
  maps_to_statutory_bands: false,
  towns: [
    { entity: 'town/addison', aoe_org_id: 'T001', name_as_published: 'Addison', town_class: 'union_district_member', values: [10, 5] },
    { entity: 'town/burlington', aoe_org_id: 'T037', name_as_published: 'Burlington', town_class: 'own_district', values: [100, 50] },
  ],
  band_totals: [110, 55],
  grand_total: 165,
  not_published: [],
  extracted_by: 'tester',
  extracted_date: '2026-07-29',
};

function nonMappingRecord() {
  return { ...RECORD };
}

function mappingRecord() {
  return {
    ...RECORD,
    fiscal_year: 2030,
    count_year: '2028-2029',
    bands_as_published: [
      { header: 'PK', statutory_band: 'prekindergarten' },
      { header: 'K-5', statutory_band: 'kindergarten_through_5' },
      { header: '6-8', statutory_band: 'grades_6_through_8' },
      { header: '9-12', statutory_band: 'grades_9_through_12' },
    ],
    maps_to_statutory_bands: true,
    towns: [
      {
        entity: 'town/burlington',
        aoe_org_id: 'T037',
        name_as_published: 'Burlington',
        town_class: 'own_district',
        values: [5, 100, 50, 60],
      },
    ],
    band_totals: [5, 100, 50, 60],
    grand_total: 215,
  };
}

describe('publishing the ADM series', () => {
  const pub = buildAdmPublication([RECORD], readRegistry(), '2026-07-29T00:00:00.000Z');

  it('carries one entry per year, with its bands and totals', () => {
    expect(pub.years).toHaveLength(1);
    expect(pub.years[0]?.fiscal_year).toBe(2024);
    expect(pub.years[0]?.bands).toEqual(['Elem ( K - 6)', 'SEC ( 7 - 12)']);
    expect(pub.years[0]?.grand_total).toBe(165);
    expect(pub.years[0]?.maps_to_statutory_bands).toBe(false);
  });

  it('rolls districts up, keeping a town that is its own district', () => {
    const districts = pub.years[0]?.districts.map((d) => d.district) ?? [];
    expect(districts).toContain('town/burlington');
  });

  it('includes the gap register so a null can explain itself', () => {
    expect(pub.gaps.entries.length).toBeGreaterThan(0);
    expect(pub.gaps.engine_eligible_years).toEqual([]);
  });

  it('refuses a record naming a town the registry does not have', () => {
    // Publishing is the last point before a figure reaches a public page. A slug
    // that no longer resolves means the registry moved under a committed
    // transcription, and quietly dropping the town would publish a district
    // total missing its pupils.
    expect(() =>
      buildAdmPublication(
        [{ ...RECORD, towns: [{ ...RECORD.towns[0], entity: 'town/nowhere' }] }],
        readRegistry(),
        '2026-07-29T00:00:00.000Z',
      ),
    ).toThrow(/town\/nowhere/);
  });

  it('orders years oldest first regardless of the order records arrive in', () => {
    const later = { ...RECORD, fiscal_year: 2025, count_year: '2023-2024' };
    const pubs = buildAdmPublication([later, RECORD], readRegistry(), 'now');
    expect(pubs.years.map((y) => y.fiscal_year)).toEqual([2024, 2025]);
  });

  it('reports the same conserved grand total the warehouse record states', () => {
    // districts + exclusions must still reconcile after the rollup is recomputed
    // at build time, or the page and the transcription disagree.
    const year = pub.years[0];
    const districts = (year?.districts ?? []).reduce(
      (acc, d) => acc + d.values.reduce<number>((a, v) => a + (v ?? 0), 0),
      0,
    );
    const excluded = (year?.exclusions ?? []).reduce((acc, e) => acc + e.total, 0);
    expect(Number((districts + excluded).toFixed(2))).toBe(year?.grand_total);
  });
});

describe('statutory-band rollup', () => {
  it('is empty for a year whose bands do not map to the statutory bands', () => {
    // adm24 publishes K-6 / 7-12, which have no statutory-band counterpart.
    const pub = buildAdmPublication([nonMappingRecord()], readRegistry(), '2026-08-04T00:00:00Z');
    expect(pub.years[0]?.statutory_bands).toEqual({});
  });

  it('keys each district by statutory band for a mapping year', () => {
    const pub = buildAdmPublication([mappingRecord()], readRegistry(), '2026-08-04T00:00:00Z');
    const bands = pub.years[0]?.statutory_bands['town/burlington'];
    expect(bands).toEqual({
      prekindergarten: 5,
      kindergarten_through_5: 100,
      grades_6_through_8: 50,
      grades_9_through_12: 60,
    });
  });
});
