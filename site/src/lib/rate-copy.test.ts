import { describe, expect, it } from 'vitest';
import { EXPLAIN, groupRateReason } from './rate-copy.ts';

const levels = ['district', 'union', 'grouping'] as const;

describe('groupRateReason', () => {
  it.each(levels)('%s reason keeps the old wording out', (level) => {
    expect(groupRateReason(level)).not.toContain('sets ' + 'its own');
  });

  it.each(levels)('%s reason has no semicolon', (level) => {
    expect(groupRateReason(level)).not.toContain(';');
  });

  it('district reason names the voters and the CLA', () => {
    const text = groupRateReason('district');
    expect(text).toContain('Voters approve');
    expect(text).toContain('CLA');
  });
});

describe('EXPLAIN', () => {
  it('points at the two explanations sections', () => {
    expect(EXPLAIN.cla).toBe('/explanations/#cla');
    expect(EXPLAIN.credit).toBe('/explanations/#property-tax-credit');
  });
});
