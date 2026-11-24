import { describe, expect, it } from 'vitest';
import { percentileOf, percentileWords, shareOf, percentText } from './journey-scale.ts';

describe('percentileOf', () => {
  it('counts values strictly below and the total', () => {
    expect(percentileOf(5, [1, 5, 9, 5])).toEqual({ lower: 1, of: 4, allEqual: false });
  });
  it('reports zero below when the value is the smallest', () => {
    expect(percentileOf(0, [1, 5, 9])).toEqual({ lower: 0, of: 3, allEqual: false });
  });
  it('reports all below when the value is the largest', () => {
    expect(percentileOf(10, [1, 5, 9])).toEqual({ lower: 3, of: 3, allEqual: false });
  });
  it('flags an all-equal list', () => {
    expect(percentileOf(5, [5, 5, 5])).toEqual({ lower: 0, of: 3, allEqual: true });
  });
  it('handles an empty comparison list', () => {
    expect(percentileOf(5, [])).toEqual({ lower: 0, of: 0, allEqual: false });
  });
});

describe('percentileWords', () => {
  it('says higher than the count when that direction is the larger one', () => {
    expect(percentileWords({ lower: 62, of: 100 }, 'towns')).toBe('higher than 62 of 100 towns');
  });
  it('says lower than the other count when that direction is larger', () => {
    expect(percentileWords({ lower: 38, of: 100 }, 'towns')).toBe('lower than 61 of 100 towns');
  });
  it('says lower than N when the value is the smallest', () => {
    expect(percentileWords({ lower: 0, of: 100 }, 'towns')).toBe('lower than 99 of 100 towns');
  });
  it('ties use higher than', () => {
    expect(percentileWords({ lower: 50, of: 101 }, 'towns')).toBe('higher than 50 of 101 towns');
  });
  it('says same as every other when all equal', () => {
    expect(percentileWords({ lower: 0, of: 100, allEqual: true }, 'towns')).toBe(
      'the same as every other town',
    );
  });
  it('declines to speak when there is nothing to compare against', () => {
    expect(percentileWords({ lower: 0, of: 0 }, 'towns')).toBe('no other towns to compare against');
  });
});

describe('shareOf', () => {
  it('returns the fraction', () => {
    expect(shareOf(2, 4)).toBe(0.5);
  });
  it('is null when the whole is not positive', () => {
    expect(shareOf(1, 0)).toBeNull();
    expect(shareOf(1, -2)).toBeNull();
  });
});

describe('percentText', () => {
  it('renders whole percents', () => {
    expect(percentText(0.084)).toBe('8%');
    expect(percentText(0.5)).toBe('50%');
    expect(percentText(0.999)).toBe('100%');
  });
  it('says less than 1% for a tiny positive fraction', () => {
    expect(percentText(0.001)).toBe('less than 1%');
  });
  it('renders zero plainly', () => {
    expect(percentText(0)).toBe('0%');
  });
});
