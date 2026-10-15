import { describe, expect, it } from 'vitest';

import { HEADER, parseRows } from './parse.ts';

const header = [...HEADER];

function row(overrides: Partial<Record<(typeof HEADER)[number], unknown>> = {}): unknown[] {
  const base: Record<(typeof HEADER)[number], unknown> = {
    ADMTDIST: 'T001',
    SchoolYear: 'SY25',
    PreKindergarten: 4,
    Grades_K_Through_5: 60,
    Grades_6_Through_8: 30,
    Grades_9_Through_12: 40,
    ELL: 'null',
    NSLELG: 50,
    ELL_Disclosure: 'primary_small_cell',
    NSLELG_Disclosure: 'published',
    Bands_Suppressed: 0,
  };
  return HEADER.map((h) => (h in overrides ? overrides[h] : base[h]));
}

describe('parseRows', () => {
  it('reads a delivered row and turns the literal string "null" into null', () => {
    const [r] = parseRows([header, row()] as never);
    expect(r).toEqual({
      aoe_org_id: 'T001',
      school_year: 'SY25',
      prekindergarten: 4,
      kindergarten_through_5: 60,
      grades_6_through_8: 30,
      grades_9_through_12: 40,
      ell: null,
      nslelg: 50,
      ell_disclosure: 'primary_small_cell',
      nslelg_disclosure: 'published',
      bands_suppressed: 0,
    });
  });

  it('refuses a reordered header rather than guessing which column is which', () => {
    const swapped: string[] = [...header];
    [swapped[6], swapped[7]] = [swapped[7]!, swapped[6]!];
    expect(() => parseRows([swapped, row()] as never)).toThrow(/Unexpected header row/);
  });

  it('tolerates a blank trailing row but not a blank ID beside data', () => {
    expect(parseRows([header, row(), header.map(() => null)] as never)).toHaveLength(1);
    expect(() => parseRows([header, row({ ADMTDIST: '' })] as never)).toThrow(/blank ADMTDIST/);
  });

  it('refuses a duplicate town-year', () => {
    expect(() => parseRows([header, row(), row()] as never)).toThrow(
      /duplicate row for T001\/SY25/,
    );
  });

  it('refuses a count that is not a count', () => {
    expect(() => parseRows([header, row({ ELL: -1 })] as never)).toThrow(/not a count/);
    expect(() => parseRows([header, row({ NSLELG: 'lots' })] as never)).toThrow(
      /neither a count nor null/,
    );
    expect(() => parseRows([header, row({ Bands_Suppressed: 5 })] as never)).toThrow(
      /Bands_Suppressed/,
    );
    expect(() => parseRows([header, row({ SchoolYear: '2025' })] as never)).toThrow(/not SYnn/);
  });
});
