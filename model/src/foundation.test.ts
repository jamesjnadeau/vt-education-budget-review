import { describe, expect, it } from 'vitest';

import { createContext, foundationRate, input, rateEnvelope } from './index.ts';
import type { ParameterSet } from './types.ts';
import { syntheticParameters } from './testing/synthetic.ts';

/**
 * Returns a synthetic set in which the statewide homestead rate carries a
 * declared range, the way a contingent-but-bracketed parameter file does.
 */
function withRateRange(range: { low: number; high: number; central: number | null; basis: string }): ParameterSet {
  const params = syntheticParameters();
  const rate = params.parameters.get('foundation.statewide_homestead_rate');
  if (!rate) throw new Error('fixture missing foundation.statewide_homestead_rate');
  const parameters = new Map(params.parameters);
  parameters.set('foundation.statewide_homestead_rate', { ...rate, range });
  return { ...params, parameters };
}

describe('rate envelope', () => {
  it('surfaces the declared range on the statewide homestead rate as a low/high band', () => {
    // The rate parameter is itself a rate_per_100, so the band is the declared
    // range verbatim -- unlike the payment envelope, nothing is multiplied.
    const ctx = createContext(
      withRateRange({ low: 0.9, high: 1.1, central: 1, basis: 'plausible band pending the Legislature' }),
    );

    expect(rateEnvelope(ctx)).toEqual({
      low: 0.9,
      high: 1.1,
      basis: ['plausible band pending the Legislature'],
    });
  });

  it('returns null when the rate carries no range, rather than inventing a band', () => {
    // The default synthetic rate is contingent with a null value and no range.
    const ctx = createContext(syntheticParameters());

    expect(rateEnvelope(ctx)).toBeNull();
  });
});

describe('foundation rate result', () => {
  it('carries the rate envelope alongside the computed rate', () => {
    // Mirrors foundationPayment: the point rate is null while parameters are
    // unset, but the declared band still travels with it so the UI can present
    // a band rather than nothing.
    const ctx = createContext(
      withRateRange({ low: 0.9, high: 1.1, central: 1, basis: 'plausible band pending the Legislature' }),
    );
    const totalPayments = input(ctx, 'Total foundation payments', null, 'usd');

    const result = foundationRate(ctx, totalPayments, 1_000_000);

    expect(result.rate.value).toBeNull();
    expect(result.envelope).toEqual({ low: 0.9, high: 1.1 });
    expect(result.basis).toEqual(['plausible band pending the Legislature']);
    expect(result.contingent).toBe(true);
  });

  it('reports no envelope when the rate carries no range', () => {
    const ctx = createContext(syntheticParameters());
    const totalPayments = input(ctx, 'Total foundation payments', null, 'usd');

    const result = foundationRate(ctx, totalPayments, 1_000_000);

    expect(result.envelope).toBeNull();
    expect(result.basis).toEqual([]);
  });
});
