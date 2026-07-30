/**
 * Synthetic parameter set for testing arithmetic.
 *
 * THESE ARE NOT VERMONT'S PUPIL WEIGHTS. They are arbitrary round numbers
 * chosen to make hand-checkable test arithmetic, and every citation says so in
 * the statute field itself, so a value copied out of this file by accident
 * announces what it is wherever it lands.
 *
 * This file exists because there are two separate things to test and only one
 * can be tested without published state figures:
 *
 *   - that the arithmetic and the STRUCTURE are right, given weights. Here.
 *   - that the weights are right. In the golden tests, against AOE's published
 *     weighted membership.
 *
 * Real-looking fixture weights would produce a suite that passes while the
 * published numbers are wrong, which is worse than no suite at all.
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
  value: Parameter['value'],
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
  readonly nulled?: readonly string[];
  readonly overrides?: Readonly<Record<string, number | boolean>>;
}

export function syntheticParameters(options: SyntheticOptions = {}): ParameterSet {
  const entries: Array<[string, Parameter]> = [
    p('membership.long_term_membership_years', 2, 'years', 'the averaging window'),

    // § 4010(e) is date-scoped, so its applicability is data. Off by default,
    // matching FY2026 onward; the hold harmless tests switch it on.
    p('membership.hold_harmless_applies', false, 'boolean', 'the hold harmless floor'),
    p('membership.hold_harmless_floor', 0.965, 'ratio', 'the hold harmless floor share'),

    // Additive grade increments. K-5 is zero, as in statute.
    p('weights.grade.prekindergarten', -0.5, 'multiplier', 'the prekindergarten weight'),
    p('weights.grade.kindergarten_through_5', 0, 'multiplier', 'the K-5 weight'),
    p('weights.grade.6_through_8', 0.5, 'multiplier', 'the grades 6-8 weight'),
    p('weights.grade.9_through_12', 1, 'multiplier', 'the grades 9-12 weight'),

    p('weights.poverty_185_fpl', 1, 'multiplier', 'the poverty weight'),
    p('weights.english_learner', 2, 'multiplier', 'the English learner weight'),

    p('weights.sparsity.density_under_36', 0.1, 'multiplier', 'the sparsity weight below 36/sq mi'),
    p('weights.sparsity.density_36_to_55', 0.05, 'multiplier', 'the sparsity weight 36-55/sq mi'),
    p('weights.sparsity.density_55_to_100', 0.02, 'multiplier', 'the sparsity weight 55-100/sq mi'),

    p('weights.small_school.density_ceiling', 55, 'count', 'the small school density ceiling'),
    p('weights.small_school.enrollment_under_100', 0.2, 'multiplier', 'the small school weight under 100'),
    p('weights.small_school.enrollment_100_to_250', 0.1, 'multiplier', 'the small school weight 100-250'),

    p('tax.homestead_base_rate', 1, 'rate_per_100', 'the homestead base rate'),
    p('tax.nonhomestead_base_rate', 1.59, 'rate_per_100', 'the nonhomestead base rate'),
    p('tax.spending_adjustment_floor', 1, 'ratio', 'the spending adjustment floor'),
    p('tax.excess_spending_threshold_ratio', 1.18, 'ratio', 'the excess spending threshold'),
    p('tax.income_percentage_target', 0.02, 'ratio', 'the income percentage target'),
    p('tax.statewide_adjustment', 1, 'ratio', 'the statewide adjustment'),

    p('yield.property_dollar_equivalent', 10_000, 'usd_per_pupil', 'the property yield'),
    p('yield.income_dollar_equivalent', 20_000, 'usd_per_pupil', 'the income yield'),

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
