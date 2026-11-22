import { describe, expect, it } from 'vitest';
import { chooseWebFilename } from './filename.ts';

const base = { contentType: null, entityDir: 'su-x', fiscalYear: 2027, documentType: 'budget_book' };

describe('chooseWebFilename', () => {
  it('keeps a usable original name', () => {
    expect(chooseWebFilename({ ...base, original: 'budget-fy27.pdf' })).toEqual({
      ok: true,
      filename: 'budget-fy27.pdf',
      generated: false,
    });
  });

  it.each(['../../evil.pdf', 'Budget FY27 (final).pdf'])(
    'unusable original name %s falls back to a generated name',
    (original) => {
      expect(chooseWebFilename({ ...base, original })).toEqual({
        ok: true,
        filename: 'su-x-fy2027-budget_book.pdf',
        generated: true,
      });
    },
  );

  it('generates a name when the original has an allowed extension but is unusable', () => {
    expect(chooseWebFilename({ ...base, original: '../x/Budget.PDF' })).toEqual({
      ok: true,
      filename: 'su-x-fy2027-budget_book.pdf',
      generated: true,
    });
  });

  it('takes the extension from the content type when there is no name', () => {
    expect(chooseWebFilename({ ...base, original: null, contentType: 'application/pdf' })).toEqual({
      ok: true,
      filename: 'su-x-fy2027-budget_book.pdf',
      generated: true,
    });
    const r = chooseWebFilename({
      ...base,
      original: null,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; charset=binary',
    });
    expect(r).toMatchObject({ ok: true, filename: 'su-x-fy2027-budget_book.xlsx' });
  });

  it('fails when neither name nor content type reveals the kind', () => {
    const r = chooseWebFilename({ ...base, original: null, contentType: 'text/html' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Couldn't tell what kind of file this is");
  });
});
