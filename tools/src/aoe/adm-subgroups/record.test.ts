import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PATHS } from '../../paths.ts';
import type { RegistryEntity } from '../../registry/types.ts';
import { parseExtract, type ParsedExtract, type RawRow } from './parse.ts';
import { RULE_TEXT, buildYear, policyFor, schoolYears } from './record.ts';

function town(
  slug: string,
  aoe_org_id: string,
  extra: Partial<RegistryEntity> = {},
): RegistryEntity {
  return {
    slug,
    name: slug.replace('town/', ''),
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

const REGISTRY = new Map<string, RegistryEntity>([
  ['town/addison', town('town/addison', 'T001')],
  [
    'town/unknown',
    town('town/unknown', 'T000', {
      name: 'UNKNOWN',
      reporting_only: true,
      operated_by: null,
    }),
  ],
]);

function raw(overrides: Partial<RawRow> = {}): RawRow {
  return {
    aoe_org_id: 'T001',
    school_year: 'SY25',
    prekindergarten: 4,
    kindergarten_through_5: 60,
    grades_6_through_8: 30,
    grades_9_through_12: 40,
    ell: 12,
    nslelg: 50,
    ell_disclosure: 'published',
    nslelg_disclosure: 'published',
    bands_suppressed: 0,
    ...overrides,
  };
}

const INFORMATION = Object.values(RULE_TEXT);
const OPTS = {
  source: 'intake/aoe-adm-subgroups/fy2026/extract.xlsx',
  method: 'intake/aoe-adm-subgroups/fy2026/method.sql',
  registry: REGISTRY,
  extracted_by: 'Test Person',
  extracted_date: '2026-10-15',
};

function extract(rows: RawRow[], information: string[] = INFORMATION): ParsedExtract {
  return { information, rows };
}

describe('policyFor', () => {
  it('turns SY24 subgroups off, with a recorded reason for each, when ELL was never collected', () => {
    const p = policyFor('SY24', [
      raw({ school_year: 'SY24', ell: 0, ell_disclosure: 'not_collected' }),
    ]);
    expect(p.measures).toEqual({ ell: false, nslelg: false });
    expect(p.not_published.map((n) => n.path)).toEqual(['ell', 'nslelg']);
    expect(p.preliminary).toBe(false);
  });

  it('refuses an SY24 whose ELL codes contradict the recorded policy', () => {
    expect(() => policyFor('SY24', [raw({ school_year: 'SY24' })])).toThrow(/SY24 policy/);
  });

  it('refuses a later year that turns out not collected, rather than importing zeros', () => {
    expect(() => policyFor('SY25', [raw({ ell: 0, ell_disclosure: 'not_collected' })])).toThrow(
      /no policy/,
    );
  });

  it('marks SY26 preliminary and says why', () => {
    const p = policyFor('SY26', [raw({ school_year: 'SY26' })]);
    expect(p.preliminary).toBe(true);
    expect(p.preliminary_note).toMatch(/220/);
    expect(p.measures).toEqual({ ell: true, nslelg: true });
  });
});

describe('buildYear', () => {
  it('joins rows to the registry on the AOE ID and keeps unmatched rows unpublished', () => {
    const rec = buildYear(
      extract([raw(), raw({ aoe_org_id: 'T000' }), raw({ aoe_org_id: 'S' })]),
      'SY25',
      OPTS,
    );
    expect(rec.towns.map((t) => t.entity)).toEqual(['town/addison', 'town/unknown']);
    expect(rec.towns[0]?.town_class).toBe('union_district_member');
    expect(rec.towns[1]?.town_class).toBe('residency_bucket');
    expect(rec.unresolved_rows).toEqual([
      {
        aoe_org_id: 'S',
        entity: null,
        row_status: 'published',
        note: expect.stringMatching(/matches no town/),
      },
    ]);
  });

  it('dates the record and cites the method for every rule', () => {
    const rec = buildYear(extract([raw()]), 'SY25', OPTS);
    expect(rec).toMatchObject({
      schema_version: '1.0',
      school_year: 'SY25',
      count_year: '2024-2025',
      fiscal_year: 2026,
      grain: 'town',
      min_n: 11,
      preliminary: false,
      extracted_by: 'Test Person',
    });
    for (const rule of Object.values(rec.suppression_rules)) {
      expect(rule.source).toContain(OPTS.method);
      expect(rule.source).toMatch(/min_n = 11/);
    }
  });

  it('keeps the disclosure codes as delivered, beside the interpreted cells', () => {
    const rec = buildYear(
      extract([raw({ ell: null, ell_disclosure: 'primary_small_cell' })]),
      'SY25',
      OPTS,
    );
    expect(rec.towns[0]?.as_published).toEqual({
      ell_disclosure: 'primary_small_cell',
      nslelg_disclosure: 'published',
      bands_suppressed: 0,
    });
  });

  it('only builds the year asked for', () => {
    const rec = buildYear(extract([raw(), raw({ school_year: 'SY26' })]), 'SY26', OPTS);
    expect(rec.towns).toHaveLength(1);
    expect(rec.preliminary).toBe(true);
  });

  it('refuses to build if the Information Sheet no longer states a rule verbatim', () => {
    const missing = INFORMATION.filter((s) => !s.startsWith('4.'));
    expect(() => buildYear(extract([raw()], missing), 'SY25', OPTS)).toThrow(/rule "pair_member"/);
  });

  it('refuses a year with no matched rows', () => {
    expect(() => buildYear(extract([raw({ aoe_org_id: 'S' })]), 'SY25', OPTS)).toThrow(
      /no SY25 rows/,
    );
  });

  it('refuses a registry where two towns carry one AOE ID', () => {
    const doubled = new Map(REGISTRY);
    doubled.set('town/other', town('town/other', 'T001'));
    expect(() => buildYear(extract([raw()]), 'SY25', { ...OPTS, registry: doubled })).toThrow(
      /two town records/,
    );
  });

  it('lists the school years in the extract in order', () => {
    expect(
      schoolYears(extract([raw({ school_year: 'SY26' }), raw(), raw({ school_year: 'SY24' })])),
    ).toEqual(['SY24', 'SY25', 'SY26']);
  });
});

const EXTRACT = join(
  PATHS.intake,
  'aoe-adm-subgroups',
  'fy2026',
  'ADM_Sums_by_ADMTDIST_Across_Years.xlsx',
);

describe.skipIf(!existsSync(EXTRACT))('reading the real records-request extract', () => {
  it('carries the four suppression rules verbatim and the three delivered years', async () => {
    const parsed = await parseExtract(EXTRACT);
    expect(schoolYears(parsed)).toEqual(['SY24', 'SY25', 'SY26']);
    for (const text of Object.values(RULE_TEXT)) {
      expect(parsed.information.map((s) => s.replace(/\s+/g, ' '))).toContain(text);
    }
    expect(parsed.rows.length).toBe(771);
  });
});
