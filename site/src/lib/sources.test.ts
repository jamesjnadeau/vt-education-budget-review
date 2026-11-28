import { describe, expect, it } from 'vitest';
import { TAX_RATES_FY2026, sourceFromRecord, sourceText } from './sources.ts';

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

describe('sourceFromRecord', () => {
  it('writes the date out and keeps the document page as the link', () => {
    const s = sourceFromRecord({
      publisher: 'Vermont Department of Taxes',
      title: 'FY2020 Education Property Tax Rates',
      published_date: '2019-09-30',
      document_page: 'https://tax.vermont.gov/content/fy2020-education-property-tax-rates',
    });
    expect(sourceText(s, 'Tax rate source:')).toBe(
      'Tax rate source: Vermont Department of Taxes, “FY2020 Education Property Tax Rates”, September 30, 2019.',
    );
    expect(s.url).toBe('https://tax.vermont.gov/content/fy2020-education-property-tax-rates');
  });
});
