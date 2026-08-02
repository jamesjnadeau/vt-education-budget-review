import { describe, expect, it } from 'vitest';

import {
  createContext,
  formatRange,
  input,
  nonhomesteadRate,
  parameterNode,
  quotient,
  townRate,
} from './index.ts';
import type { ParameterSet } from './types.ts';
import { syntheticParameters } from './testing/synthetic.ts';

/**
 * A synthetic set whose statewide adjustment is unverified, value-less, and
 * carried only as a range with a central estimate -- the shape this feature
 * teaches the engine to compute from. Shared by every test below.
 */
function withEstimatedStatewide(): ParameterSet {
  const base = syntheticParameters();
  const params = new Map(base.parameters);
  const existing = params.get('tax.statewide_adjustment');
  if (!existing) throw new Error('fixture missing tax.statewide_adjustment');
  params.set('tax.statewide_adjustment', {
    ...existing,
    value: null,
    contingent: false,
    range: { low: 0.7, high: 0.8, central: 0.75, basis: 'test estimate range' },
    citation: { ...existing.citation, verified: false, verified_date: null, verified_by: null },
  });
  return { ...base, parameters: params };
}

describe('estimated parameter leaf', () => {
  it('computes from the range central value, is tagged estimated, and does not block', () => {
    const ctx = createContext(withEstimatedStatewide());
    const node = parameterNode(ctx, 'tax.statewide_adjustment', 'ratio');

    expect(node.value).toBe(0.75);
    expect(node.status).toBe('estimated');
    expect(node.range).toEqual({ low: 0.7, high: 0.8 });
    expect(node.blockers.map((b) => b.kind)).toEqual(['estimated_parameter']);
  });
});

describe('range propagation through make()', () => {
  it('evaluates the formula at the range endpoints (division inverts the interval)', () => {
    const ctx = createContext(withEstimatedStatewide());
    const statewide = parameterNode(ctx, 'tax.statewide_adjustment', 'ratio'); // 0.75, range 0.7-0.8
    const base = input(ctx, 'base rate', 1.59, 'rate_per_100');
    const rate = quotient(ctx, 'rate', base, statewide, 'rate_per_100'); // 1.59 / statewide

    expect(rate.value).toBeCloseTo(1.59 / 0.75, 10);
    // Dividing by a larger denominator yields a smaller number, so low uses 0.8.
    expect(rate.range?.low).toBeCloseTo(1.59 / 0.8, 10);
    expect(rate.range?.high).toBeCloseTo(1.59 / 0.7, 10);
  });

  it('leaves range null when no input carries a range', () => {
    const ctx = createContext(syntheticParameters());
    const a = input(ctx, 'a', 2, 'ratio');
    const b = input(ctx, 'b', 4, 'ratio');
    expect(quotient(ctx, 'q', a, b, 'ratio').range).toBeNull();
  });
});

describe('estimated band reaches the billed rates', () => {
  it('carries the band and estimated status through townRate and nonhomesteadRate', () => {
    const ctx = createContext(withEstimatedStatewide());
    const perPupil = input(ctx, 'spending per pupil', 15000, 'usd_per_pupil');
    const result = townRate(ctx, perPupil, { town: 'test', cla: 1, cla_source: 'test' }, 12000);

    expect(result.billedRate.value).not.toBeNull();
    expect(result.billedRate.status).toBe('estimated');
    expect(result.billedRate.range).not.toBeNull();
    expect(result.billedRate.range!.low).toBeLessThan(result.billedRate.range!.high);

    const nonhs = nonhomesteadRate(ctx);
    expect(nonhs.status).toBe('estimated');
    expect(nonhs.range).not.toBeNull();
  });
});

describe('formatRange', () => {
  it('formats low and high with the unit, joined by an en-dash', () => {
    expect(formatRange({ low: 0.7, high: 0.8 }, 'ratio')).toBe('0.7–0.8');
  });

  it('returns null when there is no range', () => {
    expect(formatRange(null, 'rate_per_100')).toBeNull();
  });
});
