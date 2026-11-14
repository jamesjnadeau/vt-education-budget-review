/**
 * The load-a-district prefill: source notes per band, and keeping the budget
 * year and the parameter-mode selector in step.
 */

import { describe, expect, it } from 'vitest';

import { bandFill, pairText, planAdmPrefill, rangeText, SOURCE_NOTE, type PrefillRow } from './adm-prefill.ts';

describe('bandFill', () => {
  it('fills a district figure', () => {
    expect(bandFill({ value: 120, source: 'district' })).toEqual({ value: '120', note: SOURCE_NOTE.district, range: null, pair: null });
  });

  it('fills a state AOE figure, marking a preliminary year', () => {
    expect(bandFill({ value: 708, source: 'aoe' })).toEqual({ value: '708', note: SOURCE_NOTE.aoe, range: null, pair: null });
    expect(bandFill({ value: 634.66, source: 'aoe', preliminary: true })).toEqual({
      value: '634.66',
      note: 'from the state AOE count (preliminary)',
      range: null,
      pair: null,
    });
  });

  it('leaves a withheld band blank with the privacy note', () => {
    expect(bandFill({ value: null, source: 'withheld' })).toEqual({
      value: '',
      note: 'hidden to protect student privacy; field left blank',
      range: null,
      pair: null,
    });
  });

  it('adds a range line under a withheld band that carries one, and still leaves it blank', () => {
    const fill = bandFill({ value: null, source: 'withheld', range: { low: 12.5, low_exclusive: true, high: 32.5 } });
    expect(fill.value).toBe('');
    expect(fill.range).toBe('Estimated range: more than 12.5, up to 32.5 ADM');
  });

  it('reads an unknown or missing band as not available', () => {
    expect(bandFill({ value: null, source: 'unknown' })).toEqual({ value: '', note: 'not available', range: null, pair: null });
    expect(bandFill(undefined)).toEqual({ value: '', note: 'not available', range: null, pair: null });
  });
});

describe('rangeText', () => {
  it('says "at least" for an inclusive floor and names a missing top', () => {
    expect(rangeText({ low: 4, low_exclusive: false, high: 14 })).toBe('Estimated range: at least 4, up to 14 ADM');
    expect(rangeText({ low: 1203.6, low_exclusive: true, high: null })).toBe(
      'Estimated range: more than 1,203.6 ADM (no upper limit is published for a hidden town)',
    );
  });
});

describe('pairText', () => {
  it('names the town and the paired band, one sentence per town', () => {
    const fill = bandFill({
      value: null,
      source: 'withheld',
      pairs: [{ town: 'RIPTON', with: 'grades_6_through_8' }],
    });
    expect(fill.pair).toBe(
      'In Ripton this band is hidden together with grades 6 through 8: at least one of the two has 1 to 10 students, and the other may be larger.',
    );
    expect(
      pairText([
        { town: 'Ripton', with: 'prekindergarten' },
        { town: 'Weybridge', with: 'grades_9_through_12' },
      ]),
    ).toMatch(/^In Ripton .* In Weybridge this band is hidden together with grades 9 through 12: /);
  });
});

describe('planAdmPrefill', () => {
  const row = (k5: number): PrefillRow => ({ kindergarten_through_5: { value: k5, source: 'aoe' } });
  const rows = { '2025': row(708), '2026': row(677.27), '2027': row(634.66) };

  it('moves the mode to the picked year and fills both slots when a parameter set exists', () => {
    expect(planAdmPrefill('su/addison-central', '2026', rows, [2027, 2026])).toEqual({
      kind: 'fill',
      mode: '2026',
      earlier: rows['2025'],
      later: rows['2026'],
    });
  });

  it('fills nothing and says so when the picked year has no parameter set', () => {
    const plan = planAdmPrefill('su/addison-central', '2025', rows, [2027, 2026]);
    expect(plan.kind).toBe('no-parameters');
    expect(plan.kind === 'no-parameters' && plan.message).toContain('FY2025');
  });

  it('does nothing with no pick or no row for the pick', () => {
    expect(planAdmPrefill('', '2026', rows, [2026])).toEqual({ kind: 'none' });
    expect(planAdmPrefill('su/addison-central', '', rows, [2026])).toEqual({ kind: 'none' });
    expect(planAdmPrefill('su/addison-central', '2030', rows, [2030])).toEqual({ kind: 'none' });
  });

  it('leaves the earlier slot undefined when the year before has no row', () => {
    const plan = planAdmPrefill('su/addison-central', '2025', rows, [2025]);
    expect(plan).toEqual({ kind: 'fill', mode: '2025', earlier: undefined, later: rows['2025'] });
  });
});
