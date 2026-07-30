import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from '../../paths.ts';
import { readSheetRows } from './xlsx.ts';

// Tests read the real hashed artifacts from intake/ rather than a copied
// fixture, so what is verified is the same bytes provenance records. They skip
// rather than fail when the artifact is not present locally, because it lives in
// LFS and a fresh clone may not have fetched it.
const ADM24 = join(
  REPO_ROOT,
  'intake/aoe-adm/fy2024/edu-average-daily-membership-by-resident-district-fy24.xlsx',
);

describe.skipIf(!existsSync(ADM24))('reading a real AOE spreadsheet', () => {
  it('reads the title row, the header row and every data row', async () => {
    const rows = await readSheetRows(ADM24);

    expect(String(rows[0]?.[0])).toBe(
      'Average Daily Membership (ADM) Report for 2022-2023 (ADM-24) by Resident District',
    );
    expect(rows[1]?.map(String)).toEqual([
      'Resident Disrict',
      'District Name',
      'Elem ( K - 6)',
      'SEC ( 7 - 12)',
    ]);

    // 1 title + 1 header + 254 data rows. A trailing blank row may or may not
    // be reported, so assert the data-row count directly.
    const data = rows.slice(2).filter((r) => String(r[0] ?? '').trim() !== '');
    expect(data).toHaveLength(254);

    expect(String(data[0]?.[0])).toBe('T001');
    expect(String(data[0]?.[1])).toBe('Addison');
    expect(Number(data[0]?.[2])).toBeCloseTo(88.56, 2);
    expect(Number(data[0]?.[3])).toBeCloseTo(57.97, 2);
  });

  it('returns numeric cells as numbers, not strings', async () => {
    const rows = await readSheetRows(ADM24);
    const firstData = rows.slice(2).find((r) => String(r[0] ?? '').trim() === 'T001');
    expect(typeof firstData?.[2]).toBe('number');
  });
});
