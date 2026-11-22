import { describe, expect, it } from 'vitest';
import { coverageHref } from './coverage-link.ts';

const cell = {
  warehouseFile: null,
  normalizeUrl: 'https://example.org/normalize',
  formUrl: '/contribute/?entity=su%2Fx&fiscal_year=2027',
};

describe('coverageHref', () => {
  it('has no link once a warehouse file exists, even with other urls set', () => {
    expect(coverageHref({ ...cell, warehouseFile: 'warehouse/x.yaml' })).toBeNull();
  });

  it('prefers the normalize link over the web form', () => {
    expect(coverageHref(cell)).toBe('https://example.org/normalize');
  });

  it('falls back to the web form', () => {
    expect(coverageHref({ ...cell, normalizeUrl: null })).toBe(cell.formUrl);
  });

  it('is null when neither link exists', () => {
    expect(coverageHref({ ...cell, normalizeUrl: null, formUrl: null })).toBeNull();
  });
});
