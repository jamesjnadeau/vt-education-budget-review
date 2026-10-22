import { describe, expect, it } from 'vitest';

import type { Cell } from '../adm/xlsx.ts';
import { parseSheet } from './parse.ts';

type Value = Cell | Date;

/** One data row, columns A-L, in the order the tab prints them. */
type DataRow = [
  gov: string,
  name: string,
  dst: string,
  dstName: string,
  toro: string,
  county: string,
  su: number | null,
  pupils: number,
  spending: number,
  perPupil: number,
  home: number | string,
  nonres: number | string,
];

const TOWN_OWN: DataRow = ['T001', 'Alpha', 'T001', 'Alpha SD', 'T001T001', 'Addison', 1, 100, 1500000, 15000, 1.5, 1.6];
const TOWN_IN_UNION: DataRow = ['T002', 'Beta', 'T002', 'Beta', 'T002T002', 'Addison', 1, 0, 0, 0, 1.2, 1.3];
const MEMBERSHIP: DataRow = ['T002', 'Beta', 'U001', 'Union One USD', 'U001T002', 'Addison', 1, 0, 0, 0, 0, 0];
const UNION: DataRow = ['U001', 'Union One USD', 'U001', 'Union One USD', 'U001U001', 'Addison', 1, 200, 3000000, 15000, 0, 0];
const TOTAL: DataRow = ['Z999', 'Statewide Total', '', '', 'Z999Z999', '', null, 300, 4500000, 15000, 0, 0];

interface Options {
  readonly measure?: string;
  readonly rateLabel?: string;
  readonly counts?: ReadonlyArray<number>;
  readonly overrides?: ReadonlyArray<readonly [row: number, col: string, value: Value]>;
}

/** A tab laid out the way AOE prints one, small enough to read. */
function grid(data: ReadonlyArray<DataRow> = [TOWN_OWN, TOWN_IN_UNION, MEMBERSHIP, UNION, TOTAL], opts: Options = {}): Cell[][] {
  const measure = opts.measure ?? 'LTWADM';
  const rows: Value[][] = [];
  const set = (row: number, col: string, value: Value): void => {
    const r = (rows[row - 1] ??= []);
    r[col.charCodeAt(0) - 65] = value;
  };
  set(5, 'C', 'FY26FIN v08.xlsx');
  set(7, 'C', 'FY26FIN v03.xlsx');
  set(11, 'C', 'BradJames');
  set(11, 'E', new Date('2026-10-16T00:00:00Z'));
  set(6, 'K', opts.rateLabel ?? 'AOE Unofficial rates');
  (opts.counts ?? [2, 2, 2, 2, 2]).forEach((n, i) => set(5, String.fromCharCode(72 + i), `N = ${n}`));
  for (const [row, col, value] of [
    [8, 'I', 'FY2026'],
    [8, 'J', 'FY2026'],
    [7, 'K', 'FY2026'],
    [7, 'L', 'FY2026'],
    [9, 'H', measure],
    [9, 'I', 'Education'],
    [10, 'I', 'Spending'],
    [9, 'J', 'Ed Spnding'],
    [10, 'J', `per ${measure}`],
    [8, 'K', 'Home'],
    [8, 'L', 'NonRes'],
    [9, 'K', 'Rates'],
    [9, 'L', 'Rates'],
    [10, 'K', 'based on'],
    [10, 'L', 'based on'],
    [11, 'K', 'DOE'],
    [11, 'L', 'DOE'],
    [12, 'K', 'calcs'],
    [12, 'L', 'calcs'],
  ] as const) {
    set(row, col, value);
  }
  rows[12] = ['GovID', 'LEAID', 'DstID', null, 'TORO', 'County', 'SU', 300, 4500000, 15000];
  rows[13] = [1, 2, 3];
  data.forEach((d, i) => {
    rows[16 + i] = [...d];
  });
  for (const [row, col, value] of opts.overrides ?? []) set(row, col, value);
  return Array.from(rows, (r) => Array.from(r ?? [], (c) => c ?? null)) as Cell[][];
}

describe('parseSheet', () => {
  it('reads the banner and sorts rows by type', () => {
    const sheet = parseSheet('FY26', grid());
    expect(sheet.fiscal_year).toBe(2026);
    expect(sheet.pupil_measure).toBe('LTWADM');
    expect(sheet.rate_label).toBe('AOE Unofficial rates');
    expect(sheet.banner).toEqual({
      this_file: 'FY26FIN v08.xlsx',
      source_file: 'FY26FIN v03.xlsx',
      last_saved_by: 'BradJames',
      last_saved_date: '2026-10-16',
    });
    expect(sheet.rows.map((r) => r.row_type)).toEqual([
      'town',
      'town',
      'town_in_union',
      'union_district',
    ]);
    expect(sheet.rows[0]).toMatchObject({
      source_row: 17,
      gov_id: 'T001',
      gov_name: 'Alpha',
      dst_name: 'Alpha SD',
      su_number: 1,
      pupils: 100,
      homestead_rate: 1.5,
    });
    expect(sheet.total).toMatchObject({ gov_id: 'Z999', dst_id: null, su_number: null, pupils: 300 });
  });

  it('rounds float noise off a cached sum but refuses a real extra decimal', () => {
    const noisy: DataRow = [...TOWN_OWN];
    noisy[7] = 100.00000000001;
    expect(parseSheet('FY26', grid([noisy, TOWN_IN_UNION, MEMBERSHIP, UNION, TOTAL])).rows[0]?.pupils).toBe(100);
    noisy[7] = 100.004;
    expect(() => parseSheet('FY26', grid([noisy, TOWN_IN_UNION, MEMBERSHIP, UNION, TOTAL]))).toThrow(
      /more than 2 decimal places/,
    );
  });

  it('keeps the "NA" AOE prints for a rate, and counts it as non-zero', () => {
    const na: DataRow = [...TOWN_IN_UNION];
    na[10] = 'NA';
    na[11] = 'NA';
    const sheet = parseSheet('FY26', grid([TOWN_OWN, na, MEMBERSHIP, UNION, TOTAL]));
    expect(sheet.rows[1]).toMatchObject({ homestead_rate: 'NA', nonhomestead_rate: 'NA' });
  });

  it('refuses a tab that is not one fiscal year', () => {
    expect(() => parseSheet('Notes', grid())).toThrow(/not named FYnn/);
  });

  it('refuses a banner that has moved or changed', () => {
    expect(() => parseSheet('FY25', grid())).toThrow(/I8 reads "FY2026", expected "FY2025"/);
    expect(() => parseSheet('FY26', grid(undefined, { measure: 'ADM' }))).toThrow(/pupil measure "ADM"/);
    expect(() => parseSheet('FY26', grid(undefined, { rateLabel: 'Draft rates' }))).toThrow(
      /K6 labels the rates "Draft rates"/,
    );
    expect(() => parseSheet('FY26', grid(undefined, { overrides: [[13, 'C', 'LEAID']] }))).toThrow(
      /refusing to guess which column/,
    );
  });

  it('refuses rows that disagree with the "N =" counts or the statewide total', () => {
    expect(() => parseSheet('FY26', grid(undefined, { counts: [3, 2, 2, 2, 2] }))).toThrow(
      /H5 says N = 3 but 2 row/,
    );
    const short: DataRow = [...UNION];
    short[8] = 2999999;
    expect(() => parseSheet('FY26', grid([TOWN_OWN, TOWN_IN_UNION, MEMBERSHIP, short, TOTAL]))).toThrow(
      /district spending sums to 4499999/,
    );
    expect(() => parseSheet('FY26', grid(undefined, { overrides: [[13, 'H', 301]] }))).toThrow(
      /totals in row 13 differ/,
    );
  });

  it('refuses a membership row that carries figures of its own', () => {
    const carrying: DataRow = [...MEMBERSHIP];
    carrying[7] = 5;
    expect(() => parseSheet('FY26', grid([TOWN_OWN, TOWN_IN_UNION, carrying, UNION, TOTAL]))).toThrow(
      /town-in-union row carries pupils/,
    );
  });

  it('refuses a membership row whose union has no row', () => {
    expect(() => parseSheet('FY26', grid([TOWN_OWN, TOWN_IN_UNION, MEMBERSHIP, TOTAL], {
      counts: [1, 1, 1, 2, 2],
      overrides: [[13, 'H', 100], [13, 'I', 1500000], [20, 'H', 100], [20, 'I', 1500000]],
    }))).toThrow(/names a town or union with no row of its own/);
  });

  it('refuses a TORO that is not DstID + GovID, a duplicate, and rows after the total', () => {
    const bad: DataRow = [...TOWN_OWN];
    bad[4] = 'T001T002';
    expect(() => parseSheet('FY26', grid([bad, TOWN_IN_UNION, MEMBERSHIP, UNION, TOTAL]))).toThrow(
      /TORO T001T002 is not DstID \+ GovID/,
    );
    expect(() => parseSheet('FY26', grid([TOWN_OWN, TOWN_OWN, TOWN_IN_UNION, MEMBERSHIP, UNION, TOTAL]))).toThrow(
      /duplicate TORO T001T001/,
    );
    expect(() => parseSheet('FY26', grid([TOWN_OWN, TOWN_IN_UNION, MEMBERSHIP, UNION, TOTAL, TOWN_OWN]))).toThrow(
      /follows the Statewide Total row/,
    );
  });
});
