import { describe, expect, it } from 'vitest';

import { decodeCombiner, encodeCombiner, shareCombinerUrl, type CombinerShareState } from './combiner-share.ts';

const KNOWN = new Set(['town/burlington', 'town/winooski', 'town/south-burlington', 'ud/maple-run-57']);

const BLANK_EXTRAS = {
  statePlaced: '',
  poverty: '',
  el: '',
  school: '',
  enrollment: '',
  schoolIn: '',
  avg: '',
} as const;

const BASE: CombinerShareState = {
  year: 2026,
  districts: ['town/burlington', 'town/winooski'],
  factor: '1',
  act84: '0',
  density: '',
  ...BLANK_EXTRAS,
};

describe('combiner share link', () => {
  it('round-trips every field', () => {
    const state: CombinerShareState = {
      year: 2026,
      districts: ['town/burlington', 'town/winooski', 'ud/maple-run-57'],
      factor: '0.95',
      act84: '0.05',
      density: '42.5',
      statePlaced: '3',
      poverty: '410',
      el: '96',
      school: 'Fletcher Elementary',
      enrollment: '80',
      schoolIn: 'ud/maple-run-57',
      avg: '13500',
    };
    const decoded = decodeCombiner(encodeCombiner(state), KNOWN);
    expect(decoded.state).toEqual(state);
    expect(decoded.unknown).toEqual([]);
    expect(decoded.ignoredYear).toBeNull();
  });

  it('accepts the five fields the brief names, without the optional ones', () => {
    const query = encodeCombiner({ year: 2026, districts: ['town/burlington'], factor: '1', act84: '0', density: '30' });
    expect(decodeCombiner(query, KNOWN).state).toEqual({
      ...BASE,
      districts: ['town/burlington'],
      density: '30',
    });
  });

  it('leaves a blank factor (and every other blank) out of the URL', () => {
    const params = new URLSearchParams(encodeCombiner({ ...BASE, factor: '', act84: '  ' }));
    expect(params.has('factor')).toBe(false);
    expect(params.has('act84')).toBe(false);
    expect(params.has('density')).toBe(false);
    expect(params.has('poverty')).toBe(false);
    expect([...params.keys()]).toEqual(['y', 'd']);
  });

  it('puts an unknown district slug in `unknown`, not in `districts`, and does not throw', () => {
    const decoded = decodeCombiner('y=2026&d=town/burlington,ud/nope,town/winooski', KNOWN);
    expect(decoded.state.districts).toEqual(['town/burlington', 'town/winooski']);
    expect(decoded.unknown).toEqual(['ud/nope']);
  });

  it('ignores an unsupported year, and flags it instead of throwing', () => {
    const decoded = decodeCombiner('y=2027&d=town/burlington', KNOWN);
    expect(decoded.state.year).toBe(2026);
    expect(decoded.ignoredYear).toBe('2027');

    const garbled = decodeCombiner('y=next-year', KNOWN);
    expect(garbled.state.year).toBe(2026);
    expect(garbled.ignoredYear).toBe('next-year');
  });

  it('ignores unrelated params such as utm_source', () => {
    const decoded = decodeCombiner('utm_source=newsletter&d=town/burlington,town/winooski&factor=1&act84=0', KNOWN);
    expect(decoded.state).toEqual(BASE);
    expect(decoded.unknown).toEqual([]);
  });

  it('drops repeated and empty slugs and tolerates a mangled query', () => {
    const decoded = decodeCombiner('?d=town/burlington,,town/burlington, town/winooski&%%%=1', KNOWN);
    expect(decoded.state.districts).toEqual(['town/burlington', 'town/winooski']);
    expect(() => decodeCombiner('%E0%A4%A', KNOWN)).not.toThrow();
  });

  it('builds a URL that is just the base when nothing is set', () => {
    const empty: CombinerShareState = { ...BASE, districts: [], factor: '', act84: '' };
    expect(shareCombinerUrl('https://example.org/combiner/', empty)).toBe(
      'https://example.org/combiner/?y=2026',
    );
    expect(shareCombinerUrl('https://example.org/combiner/', BASE)).toMatch(/^https:\/\/example\.org\/combiner\/\?y=2026&d=/);
  });
});
