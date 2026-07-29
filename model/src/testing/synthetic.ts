/**
 * Synthetic parameter set for testing arithmetic.
 *
 * THESE ARE NOT VERMONT'S PUPIL WEIGHTS. They are arbitrary round numbers
 * chosen to make hand-checkable test arithmetic, and every citation in here
 * says so in the statute field itself, so that a value copied out of this file
 * by accident announces what it is wherever it lands.
 *
 * This file exists because there are two separate things to test and only one
 * of them can be tested today:
 *
 *   - that the arithmetic is right, given weights. Testable now, with these.
 *   - that the weights are right. Testable only against published state
 *     figures, in the golden tests, once real parameters are verified.
 *
 * Conflating the two -- putting plausible-looking real-ish weights in a test
 * fixture -- would produce a suite that passes while the published numbers are
 * wrong, which is worse than no suite at all.
 */

import type { Citation, Parameter, ParameterSet } from '../types.ts';

const SYNTHETIC_CITATION: Citation = {
  statute: 'SYNTHETIC TEST FIXTURE — not a statutory value and not Vermont law',
  session_law: null,
  source_url: null,
  quote: null,
  verified: true,
  verified_date: '2000-01-01',
  verified_by: 'test fixture',
};

function p(
  key: string,
  value: number | null,
  unit: string,
  description: string,
  extra: Partial<Parameter> = {},
): [string, Parameter] {
  return [
    key,
    {
      key,
      value,
      unit,
      description,
      citation: SYNTHETIC_CITATION,
      applies_to: null,
      range: null,
      contingent: false,
      ...extra,
    },
  ];
}

export interface SyntheticOptions {
  /** Keys to force unverified, for testing that the engine refuses to compute. */
  readonly unverified?: readonly string[];
  /** Keys to force to a null value. */
  readonly nulled?: readonly string[];
  readonly overrides?: Readonly<Record<string, number>>;
}

export function syntheticParameters(options: SyntheticOptions = {}): ParameterSet {
  const entries: Array<[string, Parameter]> = [
    p('membership.averaging_years', 2, 'years', 'the averaging window'),
    p('weights.grade.prek', 1, 'multiplier', 'the prekindergarten weight'),
    p('weights.grade.elementary', 1, 'multiplier', 'the elementary weight'),
    p('weights.grade.secondary', 2, 'multiplier', 'the secondary weight'),
    p('weights.economically_deprived', 0.5, 'multiplier', 'the economic deprivation weight'),
    p('weights.english_learner', 0.25, 'multiplier', 'the English learner weight'),
    p('weights.english_learner_newcomer_slife', 0.5, 'multiplier', 'the Newcomer/SLIFE weight'),
    p('weights.sparsity', 0.1, 'multiplier', 'the sparsity weight'),
    p('weights.small_school', 0.2, 'multiplier', 'the small school weight'),
    p('yield.property_dollar_equivalent', 10_000, 'usd_per_pupil', 'the property yield'),
    p('yield.income_dollar_equivalent', 20_000, 'usd_per_pupil', 'the income yield'),
    p('tax.excess_spending_threshold', 25_000, 'usd_per_pupil', 'the excess spending threshold'),
    p('foundation.base_amount', null, 'usd_per_pupil', 'the foundation base amount', {
      contingent: true,
    }),
    p('foundation.statewide_homestead_rate', null, 'rate_per_100', 'the statewide rate', {
      contingent: true,
    }),
  ];

  const parameters = new Map<string, Parameter>();
  for (const [key, param] of entries) {
    let next = param;
    if (options.overrides && key in options.overrides) {
      next = { ...next, value: options.overrides[key] ?? null };
    }
    if (options.nulled?.includes(key)) {
      next = { ...next, value: null };
    }
    if (options.unverified?.includes(key)) {
      next = { ...next, citation: { ...next.citation, verified: false, verified_date: null } };
    }
    parameters.set(key, next);
  }

  return {
    fiscal_year: 2027,
    status: 'draft',
    note: 'SYNTHETIC TEST FIXTURE. Not Vermont law.',
    parameters,
  };
}
