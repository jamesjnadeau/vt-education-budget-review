/**
 * Homestead property tax rate, per member town.
 *
 * Two systems live here side by side, deliberately:
 *
 *   `currentSystem`     -- the yield-based mechanism, where per-pupil spending
 *                          divided by the annually-set property yield gives an
 *                          equalized rate, which the town's CLA then converts
 *                          into the rate actually billed.
 *
 *   `foundationStub`    -- the parameterized structure of a foundation formula,
 *                          in foundation.ts, labelled contingent throughout
 *                          because the Legislature has not set its parameters.
 *
 * The same structural caveat as membership.ts applies: the SHAPE of the yield
 * calculation is a reading of 32 V.S.A. ch. 135 and the annual yield act, and
 * must be confirmed against current text alongside the values. Act 73 of 2025
 * moves Vermont toward a statewide rate, so the mechanism modelled here may
 * itself be superseded for later fiscal years -- which is exactly why the
 * system in force is selected per fiscal year rather than hardcoded.
 */

import { input, parameterNode, product, quotient, relabel } from './node.ts';
import type { CalcNode, EngineContext } from './types.ts';

export interface TownTaxInput {
  readonly town: string;
  /** Common level of appraisal as a ratio (0.8734), never a percentage (87.34). */
  readonly cla: number | null;
  readonly cla_source: string;
}

export interface TownRateResult {
  readonly town: string;
  readonly equalizedRate: CalcNode;
  readonly billedRate: CalcNode;
}

/**
 * Equalized homestead rate under the yield system.
 *
 * Spending per weighted pupil divided by the property dollar equivalent yield
 * gives the rate per $100 of equalized value. The yield is set annually by the
 * Legislature, so in a year where it has not yet been set this returns null
 * rather than carrying forward the prior year's figure.
 */
export function equalizedHomesteadRate(
  ctx: EngineContext,
  perWeightedPupilSpending: CalcNode,
): CalcNode {
  const yieldNode = parameterNode(ctx, 'yield.property_dollar_equivalent', 'usd_per_pupil');
  return quotient(
    ctx,
    'Equalized homestead tax rate',
    perWeightedPupilSpending,
    yieldNode,
    'rate_per_100',
  );
}

/**
 * Converts an equalized rate into the rate a town actually bills.
 *
 * Dividing by the CLA is the step most residents have never had explained to
 * them, and it is frequently the largest single driver of why their bill moved
 * when their district's spending did not. The walkthrough gives it its own
 * node for that reason.
 */
export function billedHomesteadRate(
  ctx: EngineContext,
  equalizedRate: CalcNode,
  town: TownTaxInput,
): CalcNode {
  const cla = input(ctx, `${town.town} common level of appraisal`, town.cla, 'ratio', {
    source: town.cla_source,
    notes: [
      'The CLA restates a town’s locally assessed values against fair market value. ' +
        'A town whose assessments have fallen behind the market has a CLA below 1.0, ' +
        'which raises its billed rate even when district spending is unchanged.',
    ],
  });
  return quotient(ctx, `${town.town} homestead tax rate as billed`, equalizedRate, cla, 'rate_per_100');
}

export function townRate(
  ctx: EngineContext,
  perWeightedPupilSpending: CalcNode,
  town: TownTaxInput,
): TownRateResult {
  const equalizedRate = equalizedHomesteadRate(ctx, perWeightedPupilSpending);
  return {
    town: town.town,
    equalizedRate,
    billedRate: billedHomesteadRate(ctx, equalizedRate, town),
  };
}

/**
 * Excess spending penalty.
 *
 * Where per-pupil spending exceeds the statutory threshold, the amount above it
 * is taxed a second time. Modelled explicitly rather than folded into the rate
 * because a district crossing the threshold is one of the few genuinely
 * cliff-edged effects in the system, and a merger scenario can push a district
 * across it.
 */
export function excessSpendingAdjustment(
  ctx: EngineContext,
  perWeightedPupilSpending: CalcNode,
): CalcNode {
  const threshold = parameterNode(ctx, 'tax.excess_spending_threshold', 'usd_per_pupil');
  if (threshold.value === null || perWeightedPupilSpending.value === null) {
    return relabel(ctx, 'Excess spending adjustment', threshold, 'usd_per_pupil');
  }
  const excess = Math.max(0, perWeightedPupilSpending.value - threshold.value);
  return input(ctx, 'Spending above the excess spending threshold', excess, 'usd_per_pupil', {
    source: 'computed from the threshold parameter',
    notes:
      excess === 0
        ? ['This district is below the excess spending threshold, so no second rate applies.']
        : ['Spending above the threshold is taxed a second time under the excess spending provision.'],
  });
}

/**
 * Income-based rate for households claiming an income adjustment.
 *
 * Included because for a large share of Vermont homesteads the income-based
 * calculation, not the property rate, determines the bill -- and a tool that
 * shows only the property rate would mislead exactly the households most
 * anxious about the answer.
 */
export function incomeBasedRate(ctx: EngineContext, perWeightedPupilSpending: CalcNode): CalcNode {
  const incomeYield = parameterNode(ctx, 'yield.income_dollar_equivalent', 'usd_per_pupil');
  return quotient(
    ctx,
    'Income-based homestead tax rate',
    perWeightedPupilSpending,
    incomeYield,
    'ratio',
  );
}

/** Applied to a rate to express it as a dollar amount on a given parcel value. */
export function billOnParcel(
  ctx: EngineContext,
  billedRate: CalcNode,
  parcelValue: number | null,
): CalcNode {
  const hundreds = input(
    ctx,
    'Assessed value in hundreds of dollars',
    parcelValue === null ? null : parcelValue / 100,
    'count',
    { source: 'user-supplied parcel value' },
  );
  return product(ctx, 'Homestead education tax on this parcel', billedRate, hundreds, 'usd');
}
