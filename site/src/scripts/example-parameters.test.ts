/**
 * The Example ("not real Vermont law") parameter set must actually compute.
 *
 * Example mode exists to show a fully-worked walkthrough with synthetic numbers.
 * That only works if exampleParameters() provides every key the engine reads:
 * a single missing key makes lookup() throw MissingParameterError inside
 * recompute(), which aborts the render after the example banner has already been
 * shown -- leaving the banner on but the previous (real) walkthrough frozen on
 * screen. These tests run the same computation the island runs, so a stale
 * example key set fails here instead of silently in the browser.
 */

import { describe, expect, it } from 'vitest';

import {
  collectParameters,
  computeWeightedMembership,
  createContext,
  input,
  perWeightedPupil,
  townRate,
} from '@vt-budget/model';

import { exampleParameters } from './model-tool.ts';

const ADM = {
  entity: 'ud/illustrative',
  adm_years: [
    { fiscal_year: 2025, prekindergarten: 10, kindergarten_through_5: 100, grades_6_through_8: 50, grades_9_through_12: 50 },
    { fiscal_year: 2026, prekindergarten: 20, kindergarten_through_5: 200, grades_6_through_8: 100, grades_9_through_12: 100 },
  ],
  state_placed_fte: 0,
  poverty_185_fpl: 40,
  english_learners: 8,
  persons_per_square_mile: 30,
  small_schools: [],
  source: 'form',
} as const;

function compute(density: number) {
  const set = exampleParameters();
  const ctx = createContext(set);
  const membership = computeWeightedMembership(ctx, { ...ADM, persons_per_square_mile: density });
  const spending = input(ctx, 'Education spending', 3_370_000, 'usd', { source: 'form' });
  const perPupil = perWeightedPupil(ctx, spending, membership.total);
  const statewide = set.inputs.get('statewide_average_per_pupil')?.value ?? null;
  const rate = townRate(ctx, perPupil, { town: 'your town', cla: 0.8, cla_source: 'form' }, statewide);
  return { membership, rate };
}

describe('exampleParameters', () => {
  it('computes a complete walkthrough without a missing-parameter throw', () => {
    const { membership, rate } = compute(30);
    expect(typeof membership.total.value).toBe('number');
    expect(rate.billedRate.status).toBe('ok');
  });

  it('still computes when density falls in a different sparsity band', () => {
    // The user can change density, which selects a different sparsity parameter.
    // Every band's key must be present or that input throws mid-walkthrough.
    const { rate } = compute(80);
    expect(rate.billedRate.status).toBe('ok');
  });

  it('cites only the synthetic fixture, never real Vermont statute', () => {
    const { rate } = compute(30);
    const params = collectParameters(rate.billedRate);
    expect(params.length).toBeGreaterThan(0);
    expect(params.every((p) => /SYNTHETIC/.test(p.citation.statute))).toBe(true);
    expect(params.some((p) => /V\.S\.A\./.test(p.citation.statute))).toBe(false);
  });
});
