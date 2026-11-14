import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PATHS } from '../../paths.ts';
import { parseWorksheet } from './parse.ts';

const WORKSHEET_TXT = join(
  PATHS.intake,
  'aoe-guidance',
  '2024-02-08-act-84-tax-rate-discount',
  'W~Nicole Lee~Y25 to FY29 Act 127 Tax Rate Discount by District~2-8-2024.txt',
);

const HEADER = 'S.U.                      District Name                       County              2,940.24';
const ADDISON =
  ' 03    Addison Central USD      Addison   1,771.32  2.01%  2,487.15  1.74%  -13%   $  0.13  $  0.10';
const TACONIC =
  ' 06    Taconic & Green Regional USD      Bennington   1,168.92  1.96%  2,692.36  1.89%  -4%   $  0.04  $  0.03';

const sheet = (...lines: string[]): string => lines.join('\n');

describe('parseWorksheet', () => {
  it('parses a data row', () => {
    const out = parseWorksheet(sheet(HEADER, ADDISON, TACONIC, '       Total      2,940.24   50%'));
    expect(out.rows[0]).toEqual({
      line: 2,
      su: '03',
      name: 'Addison Central USD',
      county: 'Addison',
      pre_act127_ltw_adm: 1771.32,
      fy2025_decrease: 0.13,
    });
    expect(out.total).toEqual({ pre_act127_ltw_adm: 2940.24, line: 4 });
  });

  it('keeps punctuation in names', () => {
    const out = parseWorksheet(sheet(HEADER, ADDISON, TACONIC, '       Total      2,940.24   50%'));
    expect(out.rows[1]?.name).toBe('Taconic & Green Regional USD');
    expect(out.rows[1]?.county).toBe('Bennington');
  });

  it('fails when the rows do not add up to the Total line', () => {
    expect(() => parseWorksheet(sheet(HEADER, ADDISON, TACONIC, '       Total      2,940.25   50%'))).toThrow(/Total/);
  });

  it('fails on a line that starts with an S.U. number but is not a row', () => {
    expect(() =>
      parseWorksheet(sheet(HEADER, ADDISON, TACONIC, ' 07    garbled', '       Total      2,940.24   50%')),
    ).toThrow(/line 4/);
  });

  it('fails with no Total line', () => {
    expect(() => parseWorksheet(sheet(HEADER, ADDISON, TACONIC))).toThrow(/Total/);
  });

  it('reads the real worksheet', () => {
    const out = parseWorksheet(readFileSync(WORKSHEET_TXT, 'utf8'));
    expect(out.rows).toHaveLength(39);
    expect(out.total.pre_act127_ltw_adm).toBe(43781.32);
    const names = out.rows.map((r) => r.name);
    expect(names).toContain('Mt. Abraham USD');
    expect(names).toContain('Essex-Westford EC USD');
    expect(names).toContain('Taconic & Green Regional USD');
    expect(out.rows.find((r) => r.name === 'Addison NW USD')?.fy2025_decrease).toBe(0.02);
    for (const r of out.rows) expect(r.fy2025_decrease).toBeGreaterThanOrEqual(0.01);
  });
});
