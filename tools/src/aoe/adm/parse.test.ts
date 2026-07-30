import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from '../../paths.ts';
import { parseReport, parseRows } from './parse.ts';
import type { Cell } from './xlsx.ts';

const ADM24 = join(
  REPO_ROOT,
  'intake/aoe-adm/fy2024/edu-average-daily-membership-by-resident-district-fy24.xlsx',
);

function sheet(title: string, headers: string[], data: Cell[][]): Cell[][] {
  return [[title], ['Resident Disrict', 'District Name', ...headers], ...data];
}

const ADM25_TITLE =
  'Average Daily Membership (ADM) Report for 2023-2024 (ADM-25) by Resident District';
const ADM24_TITLE =
  'Average Daily Membership (ADM) Report for 2022-2023 (ADM-24) by Resident District';

describe('recognizing band regimes', () => {
  it('maps the post-Act-127 three-band shape onto statutory bands', () => {
    const parsed = parseRows(
      sheet(ADM25_TITLE, ['Elem ( K - 5)', 'Middle ( 6 - 8)', 'SEC ( 9 - 12)'], [
        ['T001', 'Addison', 79.51, 28.66, 37.71],
      ]),
      'edu-average-daily-membership-by-resident-district-fy25.xlsx',
    );
    expect(parsed.maps_to_statutory_bands).toBe(true);
    expect(parsed.bands_as_published.map((b) => b.statutory_band)).toEqual([
      'kindergarten_through_5',
      'grades_6_through_8',
      'grades_9_through_12',
    ]);
  });

  it('recognizes the pre-Act-127 two-band shape but refuses to map it', () => {
    // K-6 / 7-12 cannot be reduced to K-5 / 6-8 / 9-12: grade 6 and grades 7-8
    // fall on opposite sides, and no grade-level detail exists to split them.
    const parsed = parseRows(
      sheet(ADM24_TITLE, ['Elem ( K - 6)', 'SEC ( 7 - 12)'], [['T001', 'Addison', 88.56, 57.97]]),
      'edu-average-daily-membership-by-resident-district-fy24.xlsx',
    );
    expect(parsed.maps_to_statutory_bands).toBe(false);
    expect(parsed.bands_as_published.map((b) => b.statutory_band)).toEqual([null, null]);
    expect(parsed.bands_as_published.map((b) => b.header)).toEqual(['Elem ( K - 6)', 'SEC ( 7 - 12)']);
  });

  it('hard-fails on an unrecognized header shape, naming what it found', () => {
    expect(() =>
      parseRows(
        sheet(ADM25_TITLE, ['Elem ( K - 4)', 'Upper ( 5 - 12)'], [['T001', 'Addison', 1, 2]]),
        'edu-average-daily-membership-by-resident-district-fy25.xlsx',
      ),
    ).toThrow(/Elem \( K - 4\)/);
  });
});

describe('reading rows', () => {
  it('rounds to the two decimals the source actually publishes', () => {
    const parsed = parseRows(
      sheet(ADM24_TITLE, ['Elem ( K - 6)', 'SEC ( 7 - 12)'], [
        ['T010', 'Barnet', 101.25, 133.44999999999999],
        ['T011', 'Barre City', 645.66000000000008, 423.97],
      ]),
      'fy24.xlsx',
    );
    expect(parsed.rows[0]?.values).toEqual([101.25, 133.45]);
    expect(parsed.rows[1]?.values).toEqual([645.66, 423.97]);
  });

  it('keeps the published name for auditing but never uses it to identify a town', () => {
    const parsed = parseRows(
      sheet(ADM24_TITLE, ['Elem ( K - 6)', 'SEC ( 7 - 12)'], [['T003', 'Alburg', 1, 2]]),
      'fy24.xlsx',
    );
    expect(parsed.rows[0]?.aoe_org_id).toBe('T003');
    expect(parsed.rows[0]?.name_as_published).toBe('Alburg');
  });

  it('stops at the trailing blank row', () => {
    const parsed = parseRows(
      sheet(ADM24_TITLE, ['Elem ( K - 6)', 'SEC ( 7 - 12)'], [
        ['T001', 'Addison', 1, 2],
        ['', ''],
      ]),
      'fy24.xlsx',
    );
    expect(parsed.rows).toHaveLength(1);
  });

  it('distinguishes an empty cell from a zero', () => {
    const parsed = parseRows(
      sheet(ADM24_TITLE, ['Elem ( K - 6)', 'SEC ( 7 - 12)'], [
        ['T256', 'Averill', 0, 0],
        ['T258', 'Ferdinand', null, 2.5],
      ]),
      'fy24.xlsx',
    );
    expect(parsed.rows[0]?.values).toEqual([0, 0]);
    expect(parsed.rows[1]?.values).toEqual([null, 2.5]);
  });

  it('computes band totals and a grand total', () => {
    const parsed = parseRows(
      sheet(ADM24_TITLE, ['Elem ( K - 6)', 'SEC ( 7 - 12)'], [
        ['T001', 'Addison', 10.5, 5.25],
        ['T002', 'Albany', 1.5, 2.75],
      ]),
      'fy24.xlsx',
    );
    expect(parsed.band_totals).toEqual([12, 8]);
    expect(parsed.grand_total).toBe(20);
  });
});

describe.skipIf(!existsSync(ADM24))('against the real ADM-24 artifact', () => {
  it('reproduces the pinned golden totals', async () => {
    const parsed = await parseReport(ADM24);
    expect(parsed.labels.fiscal_year).toBe(2024);
    expect(parsed.labels.count_year).toBe('2022-2023');
    expect(parsed.rows).toHaveLength(254);
    expect(parsed.maps_to_statutory_bands).toBe(false);
    expect(parsed.band_totals[0]).toBeCloseTo(47301.13, 2);
    expect(parsed.band_totals[1]).toBeCloseTo(36686.14, 2);
    expect(parsed.grand_total).toBeCloseTo(83987.27, 2);
  });

  it('has no null cells', async () => {
    const parsed = await parseReport(ADM24);
    expect(parsed.rows.filter((r) => r.values.some((v) => v === null))).toEqual([]);
  });
});
