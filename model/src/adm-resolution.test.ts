import { describe, expect, it } from 'vitest';
import { resolveAdm, STATUTORY_BANDS } from './adm-resolution.ts';

const full = { prekindergarten: 5, kindergarten_through_5: 100, grades_6_through_8: 50, grades_9_through_12: 60 };

describe('resolveAdm', () => {
  it('prefers the district figure for every band it published', () => {
    const r = resolveAdm(full, { prekindergarten: 4, kindergarten_through_5: 99, grades_6_through_8: 51, grades_9_through_12: 61 });
    for (const b of STATUTORY_BANDS) expect(r[b]).toEqual({ value: full[b], source: 'district' });
  });

  it('falls back to the state figure per band, only where the district left a gap', () => {
    const district = { ...full, prekindergarten: null };
    const r = resolveAdm(district, { prekindergarten: 7, kindergarten_through_5: 99, grades_6_through_8: 51, grades_9_through_12: 61 });
    expect(r.prekindergarten).toEqual({ value: 7, source: 'aoe' });
    expect(r.kindergarten_through_5).toEqual({ value: 100, source: 'district' });
  });

  it('reports unknown when neither source has the band', () => {
    const r = resolveAdm({ ...full, prekindergarten: null }, null);
    expect(r.prekindergarten).toEqual({ value: null, source: 'unknown' });
    expect(r.grades_9_through_12).toEqual({ value: 60, source: 'district' });
  });

  it('reports unknown for a band the AOE row is missing', () => {
    const r = resolveAdm({ ...full, prekindergarten: null }, { prekindergarten: null, kindergarten_through_5: 99, grades_6_through_8: 51, grades_9_through_12: 61 });
    expect(r.prekindergarten).toEqual({ value: null, source: 'unknown' });
  });
});
