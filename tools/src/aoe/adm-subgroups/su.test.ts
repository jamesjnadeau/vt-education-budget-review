import { describe, expect, it } from 'vitest';

import type { RegistryEntity } from '../../registry/types.ts';
import { buildSuYear, parseSuCsv, SU_HEADER } from './su.ts';

const HEAD = SU_HEADER.join(',');

function su(slug: string, id: string): RegistryEntity {
  return { slug, name: slug, type: 'su', aoe_org_id: id } as unknown as RegistryEntity;
}
const registry = new Map([['su/one', su('su/one', 'SU001')]]);
const opts = {
  source: 'intake/x/fy2026/a.csv',
  method: 'intake/x/fy2026/a.sql',
  registry,
  extracted_by: 'Test',
  extracted_date: '2026-11-20',
};

describe('parseSuCsv', () => {
  it('reads null as null and strips float noise', () => {
    const rows = parseSuCsv(
      `${HEAD}\nSU001,SY25,141.15,456.54999999999995,null,379.05,14.4,null,published,complement_small_cell,1\n`,
    );
    expect(rows[0]?.kindergarten_through_5).toBe(456.55);
    expect(rows[0]?.grades_6_through_8).toBeNull();
    expect(rows[0]?.nslelg).toBeNull();
  });

  it('refuses a reordered header and duplicate rows', () => {
    expect(() => parseSuCsv('su,school_year\n')).toThrow(/header/);
    const row = 'SU001,SY25,1,1,1,1,0,0,published,published,0';
    expect(() => parseSuCsv(`${HEAD}\n${row}\n${row}\n`)).toThrow(/duplicate/);
  });
});

describe('buildSuYear', () => {
  const sy25 = parseSuCsv(`${HEAD}\nSU001,SY25,141.15,476.35,263.662,379.05,14.4,509.192,published,published,0\n`);

  it('records the basis as unconfirmed and not comparable for SY25', () => {
    const r = buildSuYear(sy25, 'SY25', opts);
    expect(r.grain).toBe('su');
    expect(r.basis.confirmed).toBe(false);
    expect(r.basis.observed_against_town_sums).toBe('differs_from_town_residence_sums');
    expect(r.suppression_rules.applicability).toBe('assumed_from_town_extract');
    expect(r.sus[0]?.entity).toBe('su/one');
  });

  it('keeps an SU missing from the registry as an unresolved row', () => {
    const rows = parseSuCsv(`${HEAD}\nSU999,SY25,1,1,1,1,0,0,published,published,0\nSU001,SY25,1,1,1,1,0,0,published,published,0\n`);
    const r = buildSuYear(rows, 'SY25', opts);
    expect(r.unresolved_rows.map((u) => u.aoe_org_id)).toEqual(['SU999']);
  });
});
