import { describe, expect, it } from 'vitest';

import type { RegistryEntity } from '../../registry/types.ts';
import type { ParsedSheet, RawRow } from './parse.ts';
import { buildYear, discrepanciesFor } from './record.ts';

function entity(slug: string, type: RegistryEntity['type'], aoe_org_id: string): RegistryEntity {
  return { slug, type, aoe_org_id } as never;
}

const REGISTRY = new Map(
  [
    entity('town/alpha', 'town', 'T001'),
    entity('town/beta', 'town', 'T002'),
    entity('ud/union-one', 'ud', 'U001'),
    entity('su/first', 'su', 'SU001'),
  ].map((e) => [e.slug, e]),
);

const OPTS = {
  source: 'intake/aoe-edspend/fy2026/book.xlsx',
  registry: REGISTRY,
  extracted_by: 'Test Person',
  extracted_date: '2026-10-22',
};

function row(overrides: Partial<RawRow> = {}): RawRow {
  return {
    source_row: 17,
    row_type: 'town',
    gov_id: 'T001',
    gov_name: 'Alpha',
    dst_id: 'T001',
    dst_name: 'Alpha SD',
    toro: 'T001T001',
    county: 'Addison',
    su_number: 1,
    pupils: 100,
    education_spending: 1500000,
    spending_per_pupil: 15000,
    homestead_rate: 1.5,
    nonhomestead_rate: 1.6,
    ...overrides,
  };
}

const TOWN_IN_UNION = row({
  source_row: 18,
  gov_id: 'T002',
  gov_name: 'Beta',
  dst_id: 'T002',
  dst_name: 'Beta',
  toro: 'T002T002',
  pupils: 0,
  education_spending: 0,
  spending_per_pupil: 0,
  homestead_rate: 1.2,
  nonhomestead_rate: 1.3,
});
const MEMBERSHIP = row({
  source_row: 19,
  row_type: 'town_in_union',
  gov_id: 'T002',
  gov_name: 'Beta',
  dst_id: 'U001',
  dst_name: 'Union One USD',
  toro: 'U001T002',
  pupils: 0,
  education_spending: 0,
  spending_per_pupil: 0,
  homestead_rate: 0,
  nonhomestead_rate: 0,
});
const UNION = row({
  source_row: 20,
  row_type: 'union_district',
  gov_id: 'U001',
  gov_name: 'Union One USD',
  dst_id: 'U001',
  dst_name: 'Union One USD',
  toro: 'U001U001',
  pupils: 200,
  education_spending: 3000000,
  spending_per_pupil: 15000,
  homestead_rate: 0,
  nonhomestead_rate: 0,
});

function sheet(rows: ReadonlyArray<RawRow> = [row(), TOWN_IN_UNION, MEMBERSHIP, UNION]): ParsedSheet {
  return {
    sheet: 'FY26',
    fiscal_year: 2026,
    pupil_measure: 'LTWADM',
    rate_label: 'AOE Unofficial rates',
    banner: {
      this_file: 'FY26FIN v08.xlsx',
      source_file: 'FY26FIN v03.xlsx',
      last_saved_by: 'BradJames',
      last_saved_date: '2026-10-16',
    },
    rows,
    total: row({
      source_row: 21,
      row_type: 'statewide_total',
      gov_id: 'Z999',
      dst_id: null,
      dst_name: null,
      county: null,
      su_number: null,
      pupils: 300,
      education_spending: 4500000,
    }),
  };
}

describe('buildYear', () => {
  it('lists every town with its rates and unions, and every district with figures', () => {
    const record = buildYear(sheet(), OPTS);
    expect(record).toMatchObject({
      fiscal_year: 2026,
      pupil_measure: 'long_term_weighted_adm',
      pupil_measure_as_published: 'LTWADM',
      rates_status: 'unofficial',
      statewide_total: { pupils: 300, education_spending: 4500000, source_row: 21 },
      discrepancies: [],
      unresolved_rows: [],
    });
    expect(record.towns).toEqual([
      expect.objectContaining({
        entity: 'town/alpha',
        su: 'su/first',
        homestead_rate: 1.5,
        rates_as_published: null,
        union_districts: [],
      }),
      expect.objectContaining({
        entity: 'town/beta',
        union_districts: [
          { entity: 'ud/union-one', aoe_org_id: 'U001', name_as_published: 'Union One USD', source_row: 19 },
        ],
      }),
    ]);
    // Beta runs no district of its own: zero pupils and zero spending, so no district entry.
    expect(record.districts.map((d) => [d.entity, d.district_type, d.name_as_published])).toEqual([
      ['town/alpha', 'town', 'Alpha SD'],
      ['ud/union-one', 'union', 'Union One USD'],
    ]);
  });

  it('records a text rate as null and keeps the text beside it', () => {
    const na = { ...TOWN_IN_UNION, homestead_rate: 'NA', nonhomestead_rate: 'NA' } as const;
    const town = buildYear(sheet([row(), na, MEMBERSHIP, UNION]), OPTS).towns[1];
    expect(town).toMatchObject({ homestead_rate: null, nonhomestead_rate: null, rates_as_published: 'NA' });
  });

  it('keeps an ID the registry does not know, with entity null, and lists it once', () => {
    const stranger = row({ source_row: 22, gov_id: 'T999', gov_name: 'Nowhere', dst_id: 'T999', toro: 'T999T999' });
    const record = buildYear(sheet([row(), TOWN_IN_UNION, MEMBERSHIP, UNION, stranger]), OPTS);
    expect(record.towns.at(-1)?.entity).toBeNull();
    expect(record.districts.at(-1)?.entity).toBeNull();
    expect(record.unresolved_rows).toEqual([
      expect.objectContaining({ aoe_org_id: 'T999', row_type: 'town', source_row: 22 }),
    ]);
  });

  it('refuses a supervisory union the registry does not have', () => {
    expect(() => buildYear(sheet([row({ su_number: 99 })]), OPTS)).toThrow(/S\.U\. 99 matches no supervisory union/);
  });
});

describe('discrepanciesFor', () => {
  it('accepts a per-pupil figure within a cent of spending / pupils', () => {
    expect(discrepanciesFor(row({ pupils: 3, education_spending: 100, spending_per_pupil: 33.33 }), null)).toEqual([]);
    expect(discrepanciesFor(row({ pupils: 3, education_spending: 100, spending_per_pupil: 33.34 }), null)).toEqual([]);
  });

  it('records a per-pupil figure that is not spending / pupils, without correcting it', () => {
    const [d] = discrepanciesFor(
      row({ pupils: 273.6, education_spending: 3594157, spending_per_pupil: 13029.73 }),
      'town/alpha',
    );
    expect(d).toMatchObject({
      kind: 'per_pupil_not_spending_over_pupils',
      entity: 'town/alpha',
      stated: { spending_per_pupil: 13029.73 },
      recomputed_spending_per_pupil: 13136.54,
    });
  });

  it('records spending with no pupils, and pupils with no spending', () => {
    expect(discrepanciesFor(row({ pupils: 0, education_spending: 31000, spending_per_pupil: 0 }), null)[0]).toMatchObject({
      kind: 'spending_without_pupils',
      recomputed_spending_per_pupil: null,
    });
    expect(discrepanciesFor(row({ pupils: 1.54, education_spending: 0, spending_per_pupil: 0 }), null)[0]).toMatchObject({
      kind: 'pupils_without_spending',
    });
  });
});
