import { describe, expect, it } from 'vitest';

import { FIGURE_FIELDS, STATUSES, parseFigure, setPath } from './fields.ts';

describe('parseFigure', () => {
  it('parses a plain number', () => {
    expect(parseFigure('1234')).toEqual({ value: 1234 });
  });

  it('accepts commas and a dollar sign, the way budgets print money', () => {
    expect(parseFigure('$1,234,567')).toEqual({ value: 1234567 });
    expect(parseFigure('12,345.67')).toEqual({ value: 12345.67 });
  });

  it('reads the not-published sentinel, case-insensitively', () => {
    expect(parseFigure('n/p')).toEqual({ notPublished: true });
    expect(parseFigure('N/P')).toEqual({ notPublished: true });
  });

  it('rejects an empty value, so a blank is never guessed at', () => {
    expect('error' in parseFigure('')).toBe(true);
    expect('error' in parseFigure('   ')).toBe(true);
  });

  it('rejects a value that is neither a number nor the sentinel', () => {
    expect('error' in parseFigure('about a million')).toBe(true);
    expect('error' in parseFigure('tbd')).toBe(true);
  });
});

describe('setPath', () => {
  it('builds nested objects from a dotted path', () => {
    const obj: Record<string, unknown> = {};
    setPath(obj, 'revenues.education_fund', 1000);
    setPath(obj, 'revenues.local', 200);
    setPath(obj, 'personnel.fte.teachers', 20);
    expect(obj).toEqual({
      revenues: { education_fund: 1000, local: 200 },
      personnel: { fte: { teachers: 20 } },
    });
  });
});

describe('FIGURE_FIELDS', () => {
  it('is exactly the five essential money figures, all accountable', () => {
    expect(FIGURE_FIELDS.map((f) => f.path)).toEqual([
      'revenues.education_fund',
      'revenues.education_fund_previous_year_actual',
      'revenues.total_stated',
      'expenditures.total_stated',
      'expenditures.previous_year_actual',
    ]);
    expect(FIGURE_FIELDS.every((f) => f.accountable && f.kind === 'money')).toBe(true);
  });
});

describe('STATUSES', () => {
  it('is the budget schema status enum verbatim', () => {
    expect(STATUSES).toEqual(['proposed', 'warned', 'approved', 'actual']);
  });
});
