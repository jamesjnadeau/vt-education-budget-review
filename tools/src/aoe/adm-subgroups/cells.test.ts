import { describe, expect, it } from 'vitest';

import { BANDS, cellsFor } from './cells.ts';
import type { RawRow } from './parse.ts';

const ON = { ell: true, nslelg: true };
const OFF = { ell: false, nslelg: false };

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

describe('cellsFor on a published row', () => {
  it('copies published counts through unchanged', () => {
    const c = cellsFor(raw(), ON);
    expect(c.row_status).toBe('published');
    expect(c.total).toBeNull();
    expect(c.bands).toEqual({
      prekindergarten: 4,
      kindergarten_through_5: 60,
      grades_6_through_8: 30,
      grades_9_through_12: 40,
    });
    expect(c.ell).toBe(12);
    expect(c.nslelg).toBe(50);
    expect(c.suppression_pairs).toEqual([]);
  });

  it('records one blank band as a primary cell bounded 1..10', () => {
    const c = cellsFor(raw({ prekindergarten: null, bands_suppressed: 1 }), ON);
    expect(c.bands.prekindergarten).toEqual({
      suppressed: {
        kind: 'primary',
        low: 0,
        high: 10,
        exclusive_low: true,
        basis: 'headcount',
        floor_confirmed: true,
      },
    });
    expect(c.suppression_pairs).toEqual([]);
  });

  it('records two blank bands as an unsolved pair, each bounded only from below', () => {
    const c = cellsFor(
      raw({
        prekindergarten: null,
        grades_6_through_8: null,
        bands_suppressed: 2,
      }),
      ON,
    );
    for (const b of ['prekindergarten', 'grades_6_through_8'] as const) {
      expect(c.bands[b]).toMatchObject({
        suppressed: {
          kind: 'pair_member',
          low: 0,
          high: null,
          exclusive_low: true,
        },
      });
    }
    expect(c.suppression_pairs).toHaveLength(1);
    expect(c.suppression_pairs[0]?.members).toEqual(['prekindergarten', 'grades_6_through_8']);
    expect(c.suppression_pairs[0]?.sum_equals).toBeNull();
  });

  it('records three or four blank bands as primary cells, since rule 4 cannot make them', () => {
    const c = cellsFor(
      raw({
        prekindergarten: null,
        grades_6_through_8: null,
        grades_9_through_12: null,
        bands_suppressed: 3,
      }),
      ON,
    );
    expect(c.bands.grades_9_through_12).toMatchObject({
      suppressed: { kind: 'primary' },
    });
    expect(c.suppression_pairs).toEqual([]);
  });

  it('gives every withheld cell its own object so the YAML writer never aliases', () => {
    const c = cellsFor(
      raw({
        prekindergarten: null,
        grades_9_through_12: null,
        bands_suppressed: 2,
      }),
      ON,
    );
    expect(c.bands.prekindergarten).not.toBe(c.bands.grades_9_through_12);
  });

  it('refuses a row whose blank count disagrees with Bands_Suppressed', () => {
    expect(() => cellsFor(raw({ prekindergarten: null, bands_suppressed: 0 }), ON)).toThrow(
      /Bands_Suppressed/,
    );
  });

  it('maps the subgroup disclosure codes and checks the value beside each', () => {
    expect(cellsFor(raw({ ell: 0, ell_disclosure: 'published_true_zero' }), ON).ell).toBe(0);
    expect(
      cellsFor(raw({ ell: null, ell_disclosure: 'primary_small_cell' }), ON).ell,
    ).toMatchObject({
      suppressed: { kind: 'primary' },
    });
    expect(
      cellsFor(raw({ nslelg: null, nslelg_disclosure: 'complement_small_cell' }), ON).nslelg,
    ).toMatchObject({
      suppressed: { kind: 'complement' },
    });
    expect(() => cellsFor(raw({ ell: 3, ell_disclosure: 'published_true_zero' }), ON)).toThrow(
      /true_zero/,
    );
    expect(() => cellsFor(raw({ ell: 3, ell_disclosure: 'primary_small_cell' }), ON)).toThrow(
      /withheld but holds/,
    );
    expect(() => cellsFor(raw({ ell: null }), ON)).toThrow(/published but blank/);
    expect(() => cellsFor(raw({ ell_disclosure: 'mystery' }), ON)).toThrow(/unknown/);
  });

  it('writes null, not a count, for a measure the year does not carry', () => {
    const c = cellsFor(raw({ ell: 0, ell_disclosure: 'not_collected' }), OFF);
    expect(c.ell).toBeNull();
    expect(c.nslelg).toBeNull();
  });

  it('refuses not_collected when the measure is wanted, so a policy mismatch is loud', () => {
    expect(() => cellsFor(raw({ ell: 0, ell_disclosure: 'not_collected' }), ON)).toThrow(
      /not_collected/,
    );
  });
});

describe('cellsFor on a row under the reporting floor', () => {
  const floor = raw({
    prekindergarten: null,
    kindergarten_through_5: null,
    grades_6_through_8: null,
    grades_9_through_12: null,
    ell: null,
    nslelg: null,
    ell_disclosure: 'below_reporting_floor',
    nslelg_disclosure: 'below_reporting_floor',
    bands_suppressed: 4,
  });

  it('bounds the whole row at 1..10 students and every cell at 0..10', () => {
    const c = cellsFor(floor, ON);
    expect(c.row_status).toBe('below_reporting_floor');
    expect(c.total).toEqual({
      low: 0,
      high: 10,
      exclusive_low: true,
      basis: 'headcount',
    });
    for (const b of BANDS) {
      expect(c.bands[b]).toEqual({
        suppressed: {
          kind: 'reporting_floor',
          low: 0,
          high: 10,
          exclusive_low: false,
          basis: 'headcount',
        },
      });
    }
    expect(c.ell).toMatchObject({ suppressed: { kind: 'reporting_floor' } });
    expect(c.bands.prekindergarten).not.toBe(c.bands.kindergarten_through_5);
  });

  it('accepts not_collected beside the floor code only for a measure that is off', () => {
    const sy24 = { ...floor, ell: 0, ell_disclosure: 'not_collected' };
    expect(cellsFor(sy24, OFF).ell).toBeNull();
    expect(() => cellsFor(sy24, ON)).toThrow(/below_reporting_floor and the other is not/);
  });

  it('refuses a value anywhere in a below-floor row', () => {
    expect(() => cellsFor({ ...floor, grades_6_through_8: 3 }, ON)).toThrow(/below-floor row/);
    expect(() => cellsFor({ ...floor, nslelg: 3 }, ON)).toThrow(/below-floor row/);
  });
});
