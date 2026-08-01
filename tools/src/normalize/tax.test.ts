import { describe, expect, it } from 'vitest';

import { parseTaxTable } from './tax.ts';

const KNOWN = new Set(['town/addison', 'town/bristol']);

describe('parseTaxTable', () => {
  it('parses one town per line into tax entries', () => {
    const result = parseTaxTable('town/addison, 1.5225, 0.8734\ntown/bristol, 1.61, 0.91', KNOWN);
    expect(result).toEqual({
      ok: true,
      towns: [
        { town: 'town/addison', homestead_rate_stated: 1.5225, cla: 0.8734 },
        { town: 'town/bristol', homestead_rate_stated: 1.61, cla: 0.91 },
      ],
    });
  });

  it('reads n/p in a cell as a null figure', () => {
    const result = parseTaxTable('town/addison, n/p, 0.8734', KNOWN);
    expect(result).toEqual({
      ok: true,
      towns: [{ town: 'town/addison', homestead_rate_stated: null, cla: 0.8734 }],
    });
  });

  it('reads a lone n/p as no per-town table', () => {
    expect(parseTaxTable('n/p', KNOWN)).toEqual({ ok: true, towns: [] });
  });

  it('ignores blank lines', () => {
    const result = parseTaxTable('\ntown/addison, 1.5, 0.87\n\n', KNOWN);
    expect(result).toEqual({
      ok: true,
      towns: [{ town: 'town/addison', homestead_rate_stated: 1.5, cla: 0.87 }],
    });
  });

  it('rejects an empty textarea, forcing a decision', () => {
    const result = parseTaxTable('   ', KNOWN);
    expect(result.ok).toBe(false);
  });

  it('rejects a town slug not in the registry', () => {
    const result = parseTaxTable('town/nowhere, 1.5, 0.87', KNOWN);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join('\n')).toMatch(/nowhere/);
  });

  it('rejects a row without exactly three columns', () => {
    const result = parseTaxTable('town/addison, 1.5', KNOWN);
    expect(result.ok).toBe(false);
  });

  it('rejects an unparseable rate or cla', () => {
    const result = parseTaxTable('town/addison, high, 0.87', KNOWN);
    expect(result.ok).toBe(false);
  });
});
