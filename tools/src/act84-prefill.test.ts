import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { act84Prefill } from './act84-prefill.ts';
import type { Act84District, Act84Record } from './aoe/act84/record.ts';
import { PATHS, REPO_ROOT } from './paths.ts';

const rec = (districts: Act84District[]): Act84Record => ({
  schema_version: '1.0',
  source: 'intake/aoe-guidance/x/w.pdf',
  source_text: 'intake/aoe-guidance/x/w.txt',
  fiscal_year: 2025,
  names_from: 'warehouse/aoe-edspend/fy2024.yaml',
  unlisted_decrease: 0,
  total: { pre_act127_ltw_adm: 1, source_line: 2 },
  districts,
  extracted_by: 'test',
  extracted_date: '2026-11-14',
});

const harwood: Act84District = {
  entity: 'ud/harwood-60',
  aoe_org_id: 'U060',
  name_as_published: 'Harwood USD',
  su: '42',
  county: 'Washington',
  pre_act127_ltw_adm: 1799.32,
  fy2025_decrease: 0.09,
  source_line: 51,
};

describe('act84Prefill', () => {
  it('gives a listed district its worksheet figure and name', () => {
    const out = act84Prefill(rec([harwood]), ['ud/harwood-60'], ['ud/harwood-60']);
    expect(out['ud/harwood-60']).toEqual({ value: 0.09, listed_as: 'Harwood USD' });
  });

  it('gives an unlisted district 0', () => {
    const out = act84Prefill(rec([harwood]), ['ud/harwood-60', 'town/ferdinand'], ['town/ferdinand']);
    expect(out['town/ferdinand']).toEqual({ value: 0, listed_as: null });
  });

  it('gives a supervisory union no entry', () => {
    const out = act84Prefill(rec([harwood]), ['ud/harwood-60'], ['su/washington-central', 'ud/harwood-60']);
    expect(out).not.toHaveProperty('su/washington-central');
  });

  it('leaves out districts the picker does not offer', () => {
    const out = act84Prefill(rec([harwood]), ['ud/harwood-60', 'town/ferdinand'], ['town/ferdinand']);
    expect(Object.keys(out)).toEqual(['town/ferdinand']);
  });

  it('builds from the real record', () => {
    const record = parseYaml(readFileSync(join(PATHS.warehouse, 'aoe-act84', 'fy2025.yaml'), 'utf8')) as Act84Record;
    const names = parseYaml(readFileSync(join(REPO_ROOT, record.names_from), 'utf8')) as {
      districts: { entity: string | null }[];
    };
    const slugs = names.districts.map((d) => d.entity).filter((e): e is string => e !== null);
    const out = act84Prefill(record, slugs, slugs);
    expect(out['ud/mountain-views']).toEqual({ value: 0.01, listed_as: 'Windsor Central UUSD' });
    expect(out['ud/harwood-60']).toEqual({ value: 0.09, listed_as: 'Harwood USD' });
    expect(Object.values(out).filter((e) => e.listed_as !== null)).toHaveLength(39);
  });
});
