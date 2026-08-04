import { describe, expect, it } from 'vitest';
import { aoeBandsFor } from './adm-lookup.ts';
import type { RegistryEntity } from './registry/types.ts';

function reg(entries: Array<Partial<RegistryEntity> & { slug: string; type: string }>): Map<string, RegistryEntity> {
  return new Map(entries.map((e) => [e.slug, e as RegistryEntity]));
}

const BANDS = { prekindergarten: 5, kindergarten_through_5: 100, grades_6_through_8: 50, grades_9_through_12: 60 };

const publication = {
  generated: 'x',
  years: [
    {
      fiscal_year: 2027,
      maps_to_statutory_bands: true,
      statutory_bands: { 'ud/one': BANDS, 'ud/two': { prekindergarten: 1, kindergarten_through_5: 2, grades_6_through_8: 3, grades_9_through_12: 4 } },
    },
  ],
} as any;

describe('aoeBandsFor', () => {
  it('returns a district-like entity’s own row directly', () => {
    const registry = reg([{ slug: 'ud/one', type: 'ud', supervisory_union: 'su/x' } as any]);
    expect(aoeBandsFor('ud/one', 2027, publication, registry)).toEqual(BANDS);
  });

  it('sums an SU’s member district-like entities', () => {
    const registry = reg([
      { slug: 'su/x', type: 'su' } as any,
      { slug: 'ud/one', type: 'ud', supervisory_union: 'su/x' } as any,
      { slug: 'ud/two', type: 'ud', supervisory_union: 'su/x' } as any,
    ]);
    expect(aoeBandsFor('su/x', 2027, publication, registry)).toEqual({
      prekindergarten: 6, kindergarten_through_5: 102, grades_6_through_8: 53, grades_9_through_12: 64,
    });
  });

  it('returns null when the year does not map / has no data', () => {
    const registry = reg([{ slug: 'ud/one', type: 'ud' } as any]);
    expect(aoeBandsFor('ud/one', 2099, publication, registry)).toBeNull();
  });
});
