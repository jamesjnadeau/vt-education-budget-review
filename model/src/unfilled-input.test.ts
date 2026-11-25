import { describe, expect, it } from 'vitest';

import { createContext, input, isUnfilledInput, type Blocker } from './index.ts';
import { syntheticParameters } from './testing/synthetic.ts';

describe('isUnfilledInput', () => {
  it('is true for a blank input, which in the what-if tool is an empty box', () => {
    const ctx = createContext(syntheticParameters());
    const [blocker] = input(ctx, 'Education spending', null, 'usd').blockers;
    expect(blocker).toBeDefined();
    expect(isUnfilledInput(blocker!)).toBe(true);
  });

  it('is false for a parameter with no value for the year, which has no box', () => {
    const b: Blocker = {
      kind: 'missing_input',
      ref: 'tax.statewide_adjustment',
      detail: 'the statewide adjustment has no value set for this fiscal year.',
    };
    expect(isUnfilledInput(b)).toBe(false);
  });

  it('is false for a non-finite result, which has no box', () => {
    const b: Blocker = {
      kind: 'missing_input',
      ref: 'Spending per weighted pupil',
      detail: 'The calculation produced a non-finite result, usually a division by zero.',
    };
    expect(isUnfilledInput(b)).toBe(false);
  });

  it('is false for any other blocker kind', () => {
    const ctx = createContext(syntheticParameters());
    const [blocker] = input(ctx, 'Education spending', 5, 'usd', { estimate: 'a guess' }).blockers;
    expect(isUnfilledInput(blocker!)).toBe(false);
  });
});
