/**
 * How the what-if form applies a district's input plan, kept to pure helpers
 * (the tests run in node, with no DOM).
 */

import { describe, expect, it } from 'vitest';

import { claSelectOptions, fieldAction, type InputPlan } from './district-inputs.ts';

const CVSD: InputPlan = {
  kind: 'choose',
  note: 'Pick your town.',
  choices: [
    { town: 'town/hinesburg', label: 'Hinesburg', cla: 1.148 },
    { town: 'town/shelburne', label: 'Shelburne', cla: 0.624 },
  ],
};
const MILTON_ECON: InputPlan = { kind: 'suggest', value: 211, note: 'Lunch count.', tickByDefault: false };

describe('claSelectOptions', () => {
  it('starts with an empty "Pick your town" and one option per town', () => {
    const options = claSelectOptions(CVSD);
    expect(options[0]).toEqual({ value: '', text: 'Pick your town' });
    expect(options.slice(1)).toEqual([
      { value: '1.148', text: 'Hinesburg — 1.148' },
      { value: '0.624', text: 'Shelburne — 0.624' },
    ]);
  });
  it('marks no option as chosen', () => {
    expect(claSelectOptions(CVSD).some((o) => 'selected' in o)).toBe(false);
  });
  it('has no options for a plan that is not a choice', () => {
    expect(claSelectOptions(MILTON_ECON)).toEqual([]);
  });
});

describe('fieldAction', () => {
  it('keeps a number the reader typed, even for a district with a suggestion', () => {
    expect(fieldAction(MILTON_ECON, true)).toEqual({ kind: 'keep' });
    expect(fieldAction(CVSD, true)).toEqual({ kind: 'keep' });
    expect(fieldAction({ kind: 'refuse', reason: 'x' }, true)).toEqual({ kind: 'keep' });
  });
  it('clears and applies the plan when the reader has not typed', () => {
    expect(fieldAction(MILTON_ECON, false)).toEqual({ kind: 'suggest', value: 211, note: 'Lunch count.', tick: false });
    expect(fieldAction({ kind: 'refuse', reason: 'Not published.' }, false)).toEqual({
      kind: 'refuse',
      reason: 'Not published.',
    });
    expect(fieldAction(CVSD, false).kind).toBe('choose');
  });
});
