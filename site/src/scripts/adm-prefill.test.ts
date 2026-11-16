/**
 * The load-a-district prefill: source notes per band, and keeping the budget
 * year and the parameter-mode selector in step.
 */

import { describe, expect, it } from 'vitest';

import {
  act84Fill,
  bandFill,
  pairText,
  pickerGroups,
  planAdmPrefill,
  rangeText,
  SOURCE_NOTE,
  spendingFill,
  spendingSuggestion,
  type PrefillRow,
} from './adm-prefill.ts';

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

  it('offers the middle of a range with both ends as a suggestion', () => {
    const fill = bandFill({ value: null, source: 'withheld', range: { low: 12.5, low_exclusive: true, high: 32.5 } });
    expect(fill.use).toEqual({
      value: 22.5,
      label: 'Use the middle of the range (22.5 ADM)',
      estimate:
        'the middle of the published range (more than 12.5, up to 32.5), because the real count is hidden to protect student privacy',
    });
  });

  it('offers the lower limit for a range with no published top, marked as one', () => {
    expect(bandFill({ value: null, source: 'withheld', range: { low: 1203.6, low_exclusive: true, high: null } }).use).toEqual({
      value: 1203.6,
      label: 'Use the lower limit (1,203.6 ADM)',
      estimate:
        'the bottom of the published range (more than 1,203.6, with no top published), because the real count is hidden to protect student privacy',
      lowerLimit: true,
    });
  });

  it('offers no suggestion for a withheld band with no range', () => {
    expect(bandFill({ value: null, source: 'withheld' }).use).toBeUndefined();
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
      spending: undefined,
      spendingHistory: undefined,
    });
  });

  it('fills spending for the picked year, even for a district with no grade-count rows', () => {
    const spending = { '2026': { value: 3_037_800, pupils: 252.42, pupil_measure: 'long_term_weighted_adm' } };
    expect(planAdmPrefill('town/brighton', '2026', undefined, [2027, 2026], spending)).toEqual({
      kind: 'fill',
      mode: '2026',
      earlier: undefined,
      later: undefined,
      spending: spending['2026'],
      spendingHistory: spending,
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
    expect(plan).toEqual({ kind: 'fill', mode: '2025', earlier: undefined, later: rows['2025'], spending: undefined, spendingHistory: undefined });
  });
});

describe('spendingFill', () => {
  it('fills the AOE figure and names the pupil measure', () => {
    expect(spendingFill({ value: 41_372_610, pupils: 2743.2, pupil_measure: 'long_term_weighted_adm' })).toEqual({
      value: '41372610',
      note: 'from the state AOE figure (2,743.2 long-term weighted pupils)',
      suggestion: null,
    });
  });

  it('blanks the field and says so when the year has no figure', () => {
    expect(spendingFill(undefined)).toEqual({
      value: '',
      note: 'not available from AOE for this year; field left blank',
      suggestion: null,
    });
  });

  const fig = (value: number) => ({ value, pupils: 100, pupil_measure: 'long_term_weighted_adm' });

  it('suggests at least last year and the growth estimate when the year has no figure, without filling the field', () => {
    const history = { '2025': fig(28_351_015), '2026': fig(28_534_233) };
    expect(spendingFill(undefined, history, 2027)).toEqual({
      value: '',
      note: 'not available from AOE for this year; field left blank',
      suggestion:
        'Suggestion: at least $28,534,233, the FY2026 amount. If it grows like it did from FY2025 to FY2026, about $28,719,000.',
      use: {
        value: 28_719_000,
        label: 'Use the suggestion ($28,719,000)',
        estimate:
          'the FY2026 AOE amount, grown at the same rate as from FY2025 to FY2026, because AOE has no figure for FY2027 yet',
      },
    });
  });

  it('suggests only the floor, as a lower limit, when there is one earlier year or spending fell', () => {
    expect(spendingSuggestion({ '2026': fig(3_037_800) }, 2027)).toEqual({
      line: 'Suggestion: at least $3,037,800, the FY2026 amount.',
      use: {
        value: 3_037_800,
        label: 'Use the lower limit ($3,037,800)',
        estimate: 'the FY2026 AOE amount, because AOE has no figure for FY2027 yet',
        lowerLimit: true,
      },
    });
    expect(spendingSuggestion({ '2025': fig(5_000_000), '2026': fig(4_800_000) }, 2027)?.line).toBe(
      'Suggestion: at least $4,800,000, the FY2026 amount.',
    );
    expect(spendingSuggestion({ '2025': fig(5_000_000), '2026': fig(4_800_000) }, 2027)?.use).toMatchObject({
      value: 4_800_000,
      lowerLimit: true,
    });
  });

  it('uses the most recent earlier year when the year before is missing, and ignores later years', () => {
    const history = { '2024': fig(1_000_000), '2025': fig(1_100_000), '2029': fig(9_000_000) };
    expect(spendingSuggestion(history, 2027)?.line).toBe(
      'Suggestion: at least $1,100,000, the FY2025 amount. If it grows like it did from FY2024 to FY2025, about $1,331,000.',
    );
    expect(spendingSuggestion(history, 2027)?.use.value).toBe(1_331_000);
  });

  it('gives no suggestion with no earlier year', () => {
    expect(spendingSuggestion(undefined, 2027)).toBeNull();
    expect(spendingSuggestion({ '2028': fig(1) }, 2027)).toBeNull();
  });
});

describe('pickerGroups', () => {
  it('groups by kind in a fixed order, with title-cased names sorted within each', () => {
    const groups = pickerGroups(['town/stowe', 'su/addison-central', 'ud/b', 'town/alburgh'], {
      'town/stowe': { name: 'STOWE', type: 'town' },
      'town/alburgh': { name: 'ALBURGH', type: 'town' },
      'ud/b': { name: 'Mt. Abraham Unified School District #61', type: 'ud' },
      'su/addison-central': { name: 'Addison Central Supervisory District', type: 'su' },
    });
    expect(groups.map((g) => g.label)).toEqual([
      'Union school districts',
      'Town school districts',
      'Supervisory unions with a budget on file',
    ]);
    expect(groups[1]!.options).toEqual([
      { value: 'town/alburgh', text: 'Alburgh' },
      { value: 'town/stowe', text: 'Stowe' },
    ]);
  });
});

describe('act84Fill', () => {
  it('fills a listed district with its figure', () => {
    expect(act84Fill({ value: 0.09, listed_as: 'Harwood USD' }, true, 2026)).toEqual({
      value: '0.09',
      note: 'from the state AOE worksheet (listed as Harwood USD)',
    });
  });

  it('fills an unlisted district with 0', () => {
    expect(act84Fill({ value: 0, listed_as: null }, true, 2026)).toEqual({
      value: '0',
      note: 'not on the state AOE worksheet, so 0',
    });
  });

  it('clears the field for a pick with no figure', () => {
    expect(act84Fill(undefined, true, 2026)).toEqual({
      value: '',
      note: 'no AOE figure for this pick; field left blank',
    });
  });

  it('clears the field when the year has no transition', () => {
    expect(act84Fill({ value: 0.09, listed_as: 'Harwood USD' }, false, 2030)).toEqual({
      value: '',
      note: 'does not apply in FY2030',
    });
  });
});
