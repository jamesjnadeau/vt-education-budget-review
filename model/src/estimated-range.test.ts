import { describe, expect, it } from 'vitest';

import { createContext, input, nonhomesteadRate, parameterNode, quotient, townRate } from './index.ts';
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
