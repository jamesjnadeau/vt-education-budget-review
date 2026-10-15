import { describe, expect, it } from 'vitest';

import { labelsFor } from './year.ts';

describe('school-year labels', () => {
  it('dates SY25 as the 2024-2025 count year feeding FY2026', () => {
    expect(labelsFor('SY25')).toEqual({
      school_year: 'SY25',
      count_year: '2024-2025',
      fiscal_year: 2026,
    });
  });

  it('keeps the three delivered years one fiscal year apart', () => {
    expect(labelsFor('SY24').fiscal_year).toBe(2025);
    expect(labelsFor('SY26').fiscal_year).toBe(2027);
  });

  it('refuses a label it cannot date', () => {
    expect(() => labelsFor('SY05')).toThrow(/not a school-year label/);
    expect(() => labelsFor('SYxx' as never)).toThrow(/not a school-year label/);
  });
});
