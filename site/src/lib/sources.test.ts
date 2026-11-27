import { describe, expect, it } from 'vitest';
import { TAX_RATES_FY2026, sourceText } from './sources.ts';

describe('TAX_RATES_FY2026', () => {
  it('links to the Vermont Department of Taxes document page', () => {
    expect(TAX_RATES_FY2026.url.startsWith('https://tax.vermont.gov/')).toBe(true);
  });

  it('can label the line as the tax rate source', () => {
    expect(sourceText(TAX_RATES_FY2026, 'Tax rate source:').startsWith('Tax rate source: Vermont')).toBe(true);
  });

  it('names the publisher and the year in the source text', () => {
    const text = sourceText(TAX_RATES_FY2026);
    expect(text).toContain('Vermont Department of Taxes');
    expect(text).toContain('2025');
    expect(text).not.toContain(';');
  });
});
