import { describe, expect, it } from 'vitest';

import { readRegistry } from '../../registry/store.ts';
import { joinRows } from './join.ts';
import type { AdmRow } from './parse.ts';

function row(aoe_org_id: string, name_as_published: string): AdmRow {
  return { aoe_org_id, name_as_published, values: [1, 2] };
}

describe('joining ADM rows to the registry', () => {
  const registry = readRegistry();

  it('joins on the org ID even when the published name differs', () => {
    // 15 of 254 rows disagree cosmetically. Matching on name would drop them.
    const joined = joinRows(
      [
        row('T003', 'Alburg'), //            registry: ALBURGH
        row('T123', 'Middlebury ID #4'), //  registry: MIDDLEBURY
        row('T176', 'St. Albans City'), //   registry: ST ALBANS CITY
        row('T249', 'Winooski ID'), //       registry: WINOOSKI
      ],
      registry,
    );
    expect(joined).toHaveLength(4);
    expect(joined.map((j) => j.slug)).toEqual([
      'town/alburgh',
      'town/middlebury',
      'town/st-albans-city',
      'town/winooski',
    ]);
  });

  it('attaches the classification', () => {
    const joined = joinRows([row('T037', 'Burlington')], registry);
    expect(joined[0]?.town_class).toBe('own_district');
  });

  it('hard-fails on an unmatched code rather than skipping the row', () => {
    expect(() => joinRows([row('T001', 'Addison'), row('T777', 'Nowhere')], registry)).toThrow(
      /T777/,
    );
  });
});
