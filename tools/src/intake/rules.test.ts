import { describe, expect, it } from 'vitest';

import { checkFields, isIsoDate, type RawFields } from './rules.ts';

const slugs = new Set(['su/addison-central']);
const valid: RawFields = {
  entity: 'su/addison-central',
  fiscalYear: '2026',
  sourceUrl: 'https://example.org/budget.pdf',
  retrievedDate: '2026-02-01',
  retrievalMethod: 'http-fetch',
  documentType: 'budget_book',
  note: null,
};

describe('checkFields', () => {
  it('accepts valid fields and derives entityDir', () => {
    const r = checkFields(valid, slugs);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fields.entityDir).toBe('su-addison-central');
  });

  it('requires a note when there is no source URL', () => {
    const r = checkFields(
      { ...valid, retrievalMethod: 'email', sourceUrl: null, note: null },
      slugs,
    );
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors.join('\n')).toMatch(
        /needs a note explaining where it came from/,
      );
  });

  it('rejects out-of-range fiscal years', () => {
    for (const fy of ['2014', '2101']) {
      expect(checkFields({ ...valid, fiscalYear: fy }, slugs).ok).toBe(false);
    }
  });

  it('accepts the fiscal-year boundaries 2015 and 2100', () => {
    for (const fy of ['2015', '2100']) {
      const r = checkFields({ ...valid, fiscalYear: fy }, slugs);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.fields.fiscalYear).toBe(Number(fy));
    }
  });

  it('collects every problem rather than stopping at the first', () => {
    const r = checkFields(
      { ...valid, entity: 'su/nope', fiscalYear: 'abc', retrievalMethod: 'carrier-pigeon', documentType: 'novel' },
      slugs,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(4);
  });

  it('requires a source URL for foia, unlike email and in_person', () => {
    expect(checkFields({ ...valid, retrievalMethod: 'foia', sourceUrl: null }, slugs).ok).toBe(false);
    expect(checkFields({ ...valid, retrievalMethod: 'in_person', sourceUrl: null, note: 'handed over' }, slugs).ok).toBe(true);
  });

  it('rejects an unparseable source URL', () => {
    const r = checkFields({ ...valid, sourceUrl: 'not a url' }, slugs);
    expect(r.ok).toBe(false);
  });
});

describe('isIsoDate', () => {
  it('rejects impossible dates', () => {
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-02-28')).toBe(true);
  });
});
