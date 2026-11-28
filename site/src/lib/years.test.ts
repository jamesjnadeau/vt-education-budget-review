import { describe, expect, it } from 'vitest';
import { DEFAULT_YEAR, YEARS, fiscalYearDates, fiscalYearHelp, fiscalYearSentence, isYear, myHref } from './years.ts';

describe('years', () => {
  it('offers FY2020 to FY2027 and defaults to FY2026', () => {
    expect([...YEARS]).toEqual([2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027]);
    expect(DEFAULT_YEAR).toBe(2026);
    expect(YEARS).toContain(DEFAULT_YEAR);
  });

  it('writes a fiscal year as July 1 of the year before to June 30', () => {
    expect(fiscalYearDates(2026)).toEqual({
      start: 'July 1, 2025',
      end: 'June 30, 2026',
      short: 'July 2025 to June 2026',
      schoolYear: '2025-2026',
    });
    expect(fiscalYearSentence(2020)).toBe(
      'Fiscal year (FY) 2020 is the school budget year from July 1, 2019 to June 30, 2020.',
    );
    expect(fiscalYearHelp(2027)).toContain('July 1, 2026 to June 30, 2027');
    expect(fiscalYearHelp(2027)).toContain('summer 2026');
  });

  it('builds addresses with the year in them', () => {
    expect(myHref(2026, 'town', 'addison')).toBe('/my/2026/town/addison/');
    expect(myHref(2020, 'grouping', 7)).toBe('/my/2020/grouping/7/');
  });

  it('knows which years exist', () => {
    expect(isYear(2026)).toBe(true);
    expect(isYear(2019)).toBe(false);
    expect(isYear('2026')).toBe(false);
  });
});
