import { describe, expect, it } from 'vitest';

import type { RegistryEntity } from '../../registry/types.ts';
import { cellsFor } from './cells.ts';
import type { RawRow } from './parse.ts';
import { buildYear, RULE_TEXT } from './record.ts';
import { buildSubgroupPublication } from './publish.ts';

function town(
  slug: string,
  aoe_org_id: string,
  extra: Partial<RegistryEntity> = {},
): RegistryEntity {
  return {
    slug,
    name: slug.replace('town/', '').toUpperCase(),
    type: 'town',
    aoe_org_id,
    aoe_server_id: null,
    edfi_id: null,
    effective_from: null,
    effective_from_basis: 'unknown',
    effective_to: null,
    effective_to_basis: 'unknown',
    successor: null,
    successor_basis: null,
    supervisory_union: 'su/one',
    operated_by: 'sd/one',
    reporting_only: false,
    member_towns: [],
    grades: [],
    website: null,
    latitude: null,
    longitude: null,
    manual_overrides: [],
    notes: null,
    ...extra,
  };
}

const REGISTRY = new Map<string, RegistryEntity>(
  [
    town('town/addison', 'T001'),
    town('town/averill', 'T256'),
    town('town/underhill-id', 'T211', { effective_to: '2015-07-01' }),
    town('town/unknown', 'T000', { reporting_only: true }),
  ].map((e) => [e.slug, e]),
);

function raw(overrides: Partial<RawRow> = {}): RawRow {
  return {
    aoe_org_id: 'T001',
    school_year: 'SY25',
    prekindergarten: null,
    kindergarten_through_5: 60,
    grades_6_through_8: 30,
    grades_9_through_12: null,
    ell: null,
    nslelg: null,
    ell_disclosure: 'primary_small_cell',
    nslelg_disclosure: 'complement_small_cell',
    bands_suppressed: 2,
    ...overrides,
  };
}

const OPTS = {
  source: 'intake/x.xlsx',
  method: 'intake/x.sql',
  registry: REGISTRY,
  extracted_by: 'Test Person',
  extracted_date: '2026-10-15',
};
const info = Object.values(RULE_TEXT);

describe('buildSubgroupPublication', () => {
  const sy25 = buildYear({ information: info, rows: [raw()] }, 'SY25', OPTS);
  const sy24 = buildYear(
    {
      information: info,
      rows: [
        raw({
          school_year: 'SY24',
          ell: 0,
          ell_disclosure: 'not_collected',
          nslelg: null,
          nslelg_disclosure: 'complement_small_cell',
        }),
      ],
    },
    'SY24',
    OPTS,
  );
  const pub = buildSubgroupPublication([sy25, sy24], REGISTRY, '2026-10-15T00:00:00Z');

  it('lists the years in order with their preliminary and not-published findings', () => {
    expect(pub.years.map((y) => y.school_year)).toEqual(['SY24', 'SY25']);
    expect(pub.years[0]?.not_published.map((n) => n.path)).toEqual(['ell', 'nslelg']);
    expect(pub.years[1]).toMatchObject({
      count_year: '2024-2025',
      fiscal_year: 2026,
      preliminary: false,
    });
  });

  it('reduces withheld cells to bounds and publishes no disclosure code or kind', () => {
    const t = pub.towns['town/addison']?.SY25;
    expect(t).toMatchObject({
      row: 'published',
      bands: {
        prekindergarten: {
          status: 'suppressed',
          low: 0,
          high: null,
          exclusive_low: true,
        },
        kindergarten_through_5: { value: 60 },
        grades_9_through_12: {
          status: 'suppressed',
          low: 0,
          high: null,
          exclusive_low: true,
        },
      },
      ell: { status: 'suppressed', low: 0, high: 10, exclusive_low: true },
      nslelg: { status: 'suppressed' },
    });
    // The year notes may name the codes while explaining a finding; the cells never do.
    expect(JSON.stringify(pub.towns)).not.toMatch(
      /"kind"|disclosure|complement|primary_small|pair_member/,
    );
  });

  it('publishes a measure the year does not carry as not_published, never as zero', () => {
    expect(pub.towns['town/addison']?.SY24).toMatchObject({
      ell: { status: 'not_published' },
      nslelg: { status: 'not_published' },
    });
  });

  it('derives not_applicable for a registry town the extract has no row for', () => {
    expect(pub.towns['town/averill']?.SY25).toEqual({
      row: 'not_applicable',
      reason: 'no_resident_students',
    });
    expect(pub.towns['town/underhill-id']?.SY25).toEqual({
      row: 'not_applicable',
      reason: 'entity_closed',
    });
    expect(pub.towns['town/unknown']).toBeUndefined();
  });

  it('publishes a below-floor row with every cell bounded 0..10', () => {
    const floor = cellsFor(
      raw({
        kindergarten_through_5: null,
        grades_6_through_8: null,
        ell_disclosure: 'below_reporting_floor',
        nslelg_disclosure: 'below_reporting_floor',
        bands_suppressed: 4,
      }),
      { ell: true, nslelg: true },
    );
    const rec = { ...sy25, towns: [{ ...sy25.towns[0]!, ...floor }] };
    const t = buildSubgroupPublication([rec], REGISTRY, 'now').towns['town/addison']?.SY25;
    expect(t).toMatchObject({
      row: 'below_reporting_floor',
      bands: {
        kindergarten_through_5: {
          status: 'suppressed',
          low: 0,
          high: 10,
          exclusive_low: false,
        },
      },
      ell: { status: 'suppressed', low: 0, high: 10, exclusive_low: false },
    });
  });

  it('refuses two records for one year and a warehouse town the registry lacks', () => {
    expect(() => buildSubgroupPublication([sy25, sy25], REGISTRY, 'now')).toThrow(
      /two subgroup records/,
    );
    const stranger = {
      ...sy25,
      towns: [{ ...sy25.towns[0]!, entity: 'town/nowhere' }],
    };
    expect(() => buildSubgroupPublication([stranger], REGISTRY, 'now')).toThrow(/not the registry/);
  });
});
