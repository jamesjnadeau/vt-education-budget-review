import { describe, expect, it } from 'vitest';

import { FALL_COLLECTION, latestYears, parseCsv, parseFallEnrollment } from './enrollment.ts';

const HEAD =
  'School Year,School Identifier,Organization Name,Preschool,Kindergarten Full Time,Kindergarten Part Time,First Grade,Second Grade,Third Grade,Fourth Grade,Fifth Grade,Sixth Grade,Seventh Grade,Eighth Grade,Ninth Grade,Tenth Grade,Eleventh Grade,Twelfth Grade,Adult Without Diploma,Adult With Diploma,Total,Non Preschool Total,Data Collection Name';
const row = (y: number, id: string, pre: number, kft: number, kpt: number, g1: number, adult: number, coll = FALL_COLLECTION) =>
  `${y},${id},"Name, Inc",${pre},${kft},${kpt},${g1},0,0,0,0,0,0,0,0,0,0,0,${adult},0,0,0,${coll}`;

describe('parseCsv', () => {
  it('handles quotes, embedded commas and CRLF', () => {
    expect(parseCsv('a,"b,c",d\r\n1,"x ""y""",3\r\n')).toEqual([
      ['a', 'b,c', 'd'],
      ['1', 'x "y"', '3'],
    ]);
  });
});

describe('parseFallEnrollment', () => {
  it('counts K full + K part + grades 1-12, excluding pre-school and adults', () => {
    const d = parseFallEnrollment([HEAD, row(2026, 'PS1', 16, 10, 2, 7, 5)].join('\n'));
    expect(d.get('PS1')?.get(2026)).toBe(19);
  });
  it('ignores the year-end collection', () => {
    const d = parseFallEnrollment(
      [HEAD, row(2026, 'PS1', 0, 10, 0, 0, 0), row(2026, 'PS1', 0, 99, 0, 0, 0, 'DC#04_YearEndCollection_Official')].join('\n'),
    );
    expect(d.get('PS1')?.get(2026)).toBe(10);
  });
  it('collapses identical duplicate rows and drops conflicting ones', () => {
    const same = parseFallEnrollment([HEAD, row(2017, 'PS1', 0, 5, 0, 0, 0), row(2017, 'PS1', 0, 5, 0, 0, 0)].join('\n'));
    expect(same.get('PS1')?.get(2017)).toBe(5);
    const diff = parseFallEnrollment([HEAD, row(2017, 'PS1', 0, 5, 0, 0, 0), row(2017, 'PS1', 0, 6, 0, 0, 0), row(2017, 'PS1', 0, 5, 0, 0, 0)].join('\n'));
    expect(diff.get('PS1')?.has(2017)).toBe(false);
  });
  it('names the missing column', () => {
    expect(() => parseFallEnrollment('a,b\n1,2')).toThrow(/School Year/);
  });
  it('finds the latest years', () => {
    const d = parseFallEnrollment([HEAD, row(2024, 'PS1', 0, 1, 0, 0, 0), row(2026, 'PS1', 0, 1, 0, 0, 0), row(2025, 'PS2', 0, 1, 0, 0, 0)].join('\n'));
    expect(latestYears(d)).toEqual([2025, 2026]);
  });
});
