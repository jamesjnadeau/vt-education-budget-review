import { describe, expect, it } from 'vitest';

import type { Cell } from '../aoe/adm/xlsx.ts';
import { parseTaxRates } from './parse.ts';

const HEADER: Cell[] = [
  'School Code', 'Town', 'CLA', 'SA', 'CLA ÷ SA', '2025 Reappraisal',
  'District Rate', 'Homestead Rate', 'State Rate', 'Nonhomestead Rate',
];

describe('parseTaxRates', () => {
  it('reads typed rows in the published column order', () => {
    const rows: Cell[][] = [
      ['Title row'],
      HEADER,
      ['001', 'Addison', 0.6659, 0.7236, 0.9203, null, 1.7408, 1.8916, 1.703, 1.8505],
      [251, 'Worcester', 1.0298, 0.7236, 1.4232, 'Yes', 1.7766, 1.2483, 1.703, 1.1966],
      ['002', 'Albany', 0.791, 0.7236, 1.0931, null, null, null, 1.703, null],
      [null, 'Rate are per $100 of assessed value'],
    ];
    expect(parseTaxRates(rows)).toEqual([
      { school_code: '001', town: 'Addison', cla: 0.6659, statewide_adjustment: 0.7236,
        cla_over_sa: 0.9203, district_rate: 1.7408, homestead_rate: 1.8916,
        nonhomestead_rate: 1.8505 },
      { school_code: '251', town: 'Worcester', cla: 1.0298, statewide_adjustment: 0.7236,
        cla_over_sa: 1.4232, district_rate: 1.7766, homestead_rate: 1.2483,
        nonhomestead_rate: 1.1966 },
      { school_code: '002', town: 'Albany', cla: 0.791, statewide_adjustment: 0.7236,
        cla_over_sa: 1.0931, district_rate: null, homestead_rate: null,
        nonhomestead_rate: null },
    ]);
  });

  it('returns [] for a header-only sheet', () => {
    expect(parseTaxRates([HEADER])).toEqual([]);
  });

  it('throws naming the town when CLA is not numeric', () => {
    const rows: Cell[][] = [
      HEADER,
      ['001', 'Addison', 'n/a', 0.7236, 0.9203, null, 1.7, 1.8, 1.703, 1.8],
    ];
    expect(() => parseTaxRates(rows)).toThrow(/Addison/);
  });

  it('throws when there is no header row', () => {
    expect(() => parseTaxRates([['x']])).toThrow(/School Code/);
  });
});
