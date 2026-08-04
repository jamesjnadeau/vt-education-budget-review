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
  it('is exactly education spending and the four statutory ADM bands, all accountable', () => {
    expect(FIGURE_FIELDS.map((f) => f.path)).toEqual([
      'education_spending',
      'adm.prekindergarten',
      'adm.kindergarten_through_5',
      'adm.grades_6_through_8',
      'adm.grades_9_through_12',
    ]);
    expect(FIGURE_FIELDS.every((f) => f.accountable)).toBe(true);
    expect(FIGURE_FIELDS[0]?.kind).toBe('money');
    expect(FIGURE_FIELDS.slice(1).every((f) => f.kind === 'adm')).toBe(true);
  });
});

describe('STATUSES', () => {
  it('is the budget schema status enum verbatim', () => {
    expect(STATUSES).toEqual(['proposed', 'warned', 'approved', 'actual']);
  });
});
