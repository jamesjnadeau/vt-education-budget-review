import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { PATHS } from '../../paths.ts';
import type { DistrictRecord, YearRecord } from '../edspend/record.ts';
import type { WorksheetRow } from './parse.ts';
import { parseWorksheet } from './parse.ts';
import { resolveRows } from './record.ts';

const WORKSHEET_TXT = join(
  PATHS.intake,
  'aoe-guidance',
  '2024-02-08-act-84-tax-rate-discount',
  'W~Nicole Lee~Y25 to FY29 Act 127 Tax Rate Discount by District~2-8-2024.txt',
);

function district(name: string, entity: string | null, aoe_org_id: string): DistrictRecord {
  return {
    entity,
    aoe_org_id,
    district_type: aoe_org_id.startsWith('T') ? 'town' : 'union',
    name_as_published: name,
    county: 'Addison',
    su: null,
    su_number: 1,
    pupils: 100,
    education_spending: 1,
    spending_per_pupil: 1,
    source_row: 10,
  };
}

function row(name: string, line = 23): WorksheetRow {
  return { line, su: '05', name, county: 'Bennington', pre_act127_ltw_adm: 166, fy2025_decrease: 0.17 };
}

describe('resolveRows', () => {
  it('joins an exact name', () => {
    const out = resolveRows([row('North Bennington ID')], [district('North Bennington ID', 'town/north-bennington', 'T141')]);
    expect(out).toEqual([
      {
        entity: 'town/north-bennington',
        aoe_org_id: 'T141',
        name_as_published: 'North Bennington ID',
        su: '05',
        county: 'Bennington',
        pre_act127_ltw_adm: 166,
        fy2025_decrease: 0.17,
        source_line: 23,
      },
    ]);
  });

  it('joins through an alias', () => {
    const out = resolveRows([row('Harwood USD')], [district('Harwood UUSD', 'ud/harwood-60', 'U060')]);
    expect(out[0]?.entity).toBe('ud/harwood-60');
    expect(out[0]?.name_as_published).toBe('Harwood USD');
  });

  it('fails on a name with no match, naming every such row', () => {
    const run = (): unknown =>
      resolveRows([row('Nowhere USD', 30), row('Elsewhere ID', 31)], [district('Harwood UUSD', 'ud/harwood-60', 'U060')]);
    expect(run).toThrow(/Nowhere USD/);
    expect(run).toThrow(/Elsewhere ID/);
  });

  it('fails on a name with two matches', () => {
    expect(() =>
      resolveRows(
        [row('Lincoln')],
        [district('Lincoln', 'town/lincoln', 'T112'), district('Lincoln', 'town/lincoln-2', 'T113')],
      ),
    ).toThrow(/two|more than one/);
  });

  it('fails when the matched row has no entity', () => {
    expect(() => resolveRows([row('Lincoln', 27)], [district('Lincoln', null, 'T112')])).toThrow(/Lincoln/);
  });

  it('resolves every row of the real worksheet', () => {
    const sheet = parseWorksheet(readFileSync(WORKSHEET_TXT, 'utf8'));
    const fy2024 = parseYaml(readFileSync(join(PATHS.warehouse, 'aoe-edspend', 'fy2024.yaml'), 'utf8')) as YearRecord;
    const out = resolveRows(sheet.rows, fy2024.districts);
    expect(out).toHaveLength(39);
    expect(out.find((d) => d.name_as_published === 'Windsor Central UUSD')).toMatchObject({
      entity: 'ud/mountain-views',
      aoe_org_id: 'U076',
      fy2025_decrease: 0.01,
    });
    expect(out.find((d) => d.name_as_published === 'Granville-Hancock USD')?.entity).toBe('ud/granville-hancock');
    expect(new Set(out.map((d) => d.entity)).size).toBe(out.length);
  });
});
