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
    expect(() => parseTaxRates([['x']])).toThrow(/Town/);
  });

  it('reads the FY2020 layout: no school code, CLA as a percent', () => {
    const rows: Cell[][] = [
      ['TOWN', 'STATUS', 'CALC', 'CLA', 'HS_TAXRATE', 'NHS_TAXRATE'],
      ['Addison', 'Calculated', null, 101.27, 1.7157, 1.574],
      ['Albany', 'Pending Reappraisal', null, 110.39, null, null],
    ];
    expect(parseTaxRates(rows)).toEqual([
      { school_code: null, town: 'Addison', cla: 1.0127, statewide_adjustment: null,
        cla_over_sa: null, district_rate: null, homestead_rate: 1.7157, nonhomestead_rate: 1.574 },
      { school_code: null, town: 'Albany', cla: 1.1039, statewide_adjustment: null,
        cla_over_sa: null, district_rate: null, homestead_rate: null, nonhomestead_rate: null },
    ]);
  });

  it('reads the FY2021 spelling of the nonhomestead column', () => {
    const rows: Cell[][] = [
      ['TOWN', 'STATUS', 'CALC', 'CLA', 'HS_TAXRATE', 'NH_TAXRATE', 'CALCDATE'],
      ['Addison', 'Calculated', null, 103.35, 1.7148, 1.5752, '2020-08-21'],
    ];
    expect(parseTaxRates(rows)[0]?.nonhomestead_rate).toBe(1.5752);
  });

  it('reads the FY2023 layout and stops at the footnotes', () => {
    const rows: Cell[][] = [
      ['SCHOOL CODE', 'TOWN', '2022 Reappraisal', 'Common Level of Appraisal', 'Homestead Tax Rate',
        'Nonhomestead Tax Rate', 'Calculation Date'],
      [1, 'Addison', null, 93.89, 1.6209, 1.5614, '06/28/22'],
      [2, 'Albany', null, 105.1, '(B)', 1.3949, '06/28/22'],
      ['Rate are per $100 of assessed value'],
    ];
    expect(parseTaxRates(rows)).toEqual([
      { school_code: '001', town: 'Addison', cla: 0.9389, statewide_adjustment: null,
        cla_over_sa: null, district_rate: null, homestead_rate: 1.6209, nonhomestead_rate: 1.5614 },
      { school_code: '002', town: 'Albany', cla: 1.051, statewide_adjustment: null,
        cla_over_sa: null, district_rate: null, homestead_rate: null, nonhomestead_rate: 1.3949 },
    ]);
  });

  it('stops at footnotes printed under TOWN when there is no school code', () => {
    const rows: Cell[][] = [
      ['TOWN', '2021 Reappraisal', 'Common Level of Appraisal', 'Homestead Tax Rate', 'Nonhomestead Tax Rate'],
      ['Addison', null, 98.91, 1.6929, 1.6298],
      ['Rate are per $100 of assessed value'],
      ['(A) Indicates pending results of reappraisal'],
    ];
    expect(parseTaxRates(rows).map((r) => r.town)).toEqual(['Addison']);
  });

  it('reads the FY2025 layout: CLA already a fraction, no SA', () => {
    const rows: Cell[][] = [
      ['School Code', 'Town', 'CLA', '2024 Reappraisal', 'District Rate', 'Homestead Rate', 'State Rate',
        'Nonhomestead Rate', 'Reappraisal Status', 'Budget Status'],
      ['001', 'Addison', 0.7235, null, 1.5096, 2.0865, 1.391, 1.9226],
    ];
    expect(parseTaxRates(rows)).toEqual([
      { school_code: '001', town: 'Addison', cla: 0.7235, statewide_adjustment: null,
        cla_over_sa: null, district_rate: 1.5096, homestead_rate: 2.0865, nonhomestead_rate: 1.9226 },
    ]);
  });

  it('throws when the sheet has no homestead rate column', () => {
    expect(() => parseTaxRates([['Town', 'CLA'], ['Addison', 0.7]])).toThrow(/homestead_rate/);
  });
});
