import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { edspendEntities, prefillSpending, type EdspendRecord } from './edspend-prefill.ts';
import { PATHS } from './paths.ts';

const rec = (fiscal_year: number, districts: EdspendRecord['districts']): EdspendRecord => ({
  fiscal_year,
  pupil_measure: 'long_term_weighted_adm',
  districts,
});

describe('prefillSpending', () => {
  it('keys spending by district and year, keeping the pupil measure', () => {
    const out = prefillSpending([rec(2026, [{ entity: 'ud/a', pupils: 100.5, education_spending: 1_500_000 }])]);
    expect(out).toEqual({
      'ud/a': { '2026': { value: 1_500_000, pupils: 100.5, pupil_measure: 'long_term_weighted_adm' } },
    });
  });

  it('leaves out a stated $0 and an unresolved row', () => {
    const out = prefillSpending([
      rec(2026, [
        { entity: 'town/ferdinand', pupils: 2, education_spending: 0 },
        { entity: null, pupils: 5, education_spending: 10 },
      ]),
    ]);
    expect(out).toEqual({});
  });
});

describe('edspendEntities', () => {
  it('lists districts present in the wanted years only', () => {
    const records = [
      rec(2024, [{ entity: 'ud/closed', pupils: 1, education_spending: 1 }]),
      rec(2026, [
        { entity: 'ud/b', pupils: 1, education_spending: 1 },
        { entity: 'town/a', pupils: 1, education_spending: 0 },
      ]),
    ];
    expect(edspendEntities(records, [2025, 2026, 2027])).toEqual(['town/a', 'ud/b']);
  });
});

describe('the warehouse records', () => {
  const load = (fy: number): EdspendRecord =>
    parseYaml(readFileSync(join(PATHS.warehouse, 'aoe-edspend', `fy${fy}.yaml`), 'utf8')) as EdspendRecord;

  it('gives Addison Central USD its FY2026 spending', () => {
    const out = prefillSpending([load(2026)]);
    expect(out['ud/addison-central-55']?.['2026']?.value).toBeGreaterThan(0);
    expect(out['ud/addison-central-55']?.['2026']?.pupil_measure).toBe('long_term_weighted_adm');
  });

  it('lists every FY2025–FY2026 district', () => {
    expect(edspendEntities([load(2025), load(2026)], [2025, 2026]).length).toBeGreaterThanOrEqual(120);
  });
});
