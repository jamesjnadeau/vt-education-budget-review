/**
 * The load-a-district prefill: source notes per band, and keeping the budget
 * year and the parameter-mode selector in step.
 */

import { describe, expect, it } from 'vitest';

import { bandFill, planAdmPrefill, SOURCE_NOTE, type PrefillRow } from './adm-prefill.ts';

describe('bandFill', () => {
  it('fills a district figure', () => {
    expect(bandFill({ value: 120, source: 'district' })).toEqual({ value: '120', note: SOURCE_NOTE.district });
  });

  it('fills a state AOE figure, marking a preliminary year', () => {
    expect(bandFill({ value: 708, source: 'aoe' })).toEqual({ value: '708', note: SOURCE_NOTE.aoe });
    expect(bandFill({ value: 634.66, source: 'aoe', preliminary: true })).toEqual({
      value: '634.66',
      note: 'from the state AOE count (preliminary)',
    });
  });

  it('leaves a withheld band blank with the privacy note', () => {
    expect(bandFill({ value: null, source: 'withheld' })).toEqual({
      value: '',
      note: 'hidden to protect student privacy; field left blank',
    });
  });

  it('reads an unknown or missing band as not available', () => {
    expect(bandFill({ value: null, source: 'unknown' })).toEqual({ value: '', note: 'not available' });
    expect(bandFill(undefined)).toEqual({ value: '', note: 'not available' });
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
