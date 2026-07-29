/**
 * Homestead property tax rate, per 32 V.S.A. chapter 135.
 *
 * Corrected against the statute text snapshotted in
 * model/statute/2026-07-29/32-vsa-5401.txt and 32-vsa-5402.txt. The chain is:
 *
 *   § 5401(13)(A)  spending adjustment = GREATER OF ONE or
 *                    (per pupil education spending + excess spending) / property yield
 *   § 5402(a)(2)   homestead rate = $1.00 x spending adjustment,
 *                    per $100 of EQUALIZED education property value
 *   § 5402(b)(1)   billed rate = that rate, divided by
 *                    (the municipality's CLA / the statewide adjustment)
 *
 * Three details here are easy to miss and each changes the answer:
 *
 * 1. THE ADJUSTMENT HAS A FLOOR OF ONE. A district spending below the yield does
 *    not get a rate below $1.00; it gets $1.00. Modelling this as a plain
 *    division would under-state the rate for every such district.
 *
 * 2. EXCESS SPENDING IS ADDED TO THE NUMERATOR, not applied as a separate
 *    surcharge afterwards. § 5401(12) defines it as per pupil spending above
 *    118 percent of the statewide average, and § 5401(13)(A) folds it straight
 *    into the fraction.
 *
 * 3. THE BILLED RATE DIVIDES BY CLA OVER THE STATEWIDE ADJUSTMENT, not by the
 *    CLA alone. Dividing by CLA by itself is the common shorthand and it is
 *    wrong by exactly the statewide adjustment factor.
 */

import { greaterOf, input, parameterNode, product, quotient, sum } from './node.ts';
import type { CalcNode, EngineContext } from './types.ts';

export interface TownTaxInput {
  readonly town: string;
  /** Common level of appraisal as a ratio (0.8734), never a percentage (87.34). */
  readonly cla: number | null;
  readonly cla_source: string;
}

export interface TownRateResult {
  readonly town: string;
  readonly spendingAdjustment: CalcNode;
  readonly equalizedRate: CalcNode;
  readonly billedRate: CalcNode;
}

/**
 * § 5401(12): per pupil education spending above 118 percent of the statewide
 * average, increased by inflation.
 *
 * The statewide average is determined by the Secretary of Education each
 * November from passed budgets, so it is an input rather than a parameter --
 * it is a published figure for a given year, not a rule.
 */
export function excessSpending(
  ctx: EngineContext,
  perPupilSpending: CalcNode,
  statewideAveragePerPupil: number | null,
): CalcNode {
  const threshold = parameterNode(ctx, 'tax.excess_spending_threshold_ratio', 'ratio');
  const average = input(
    ctx,
    'Statewide average district per pupil education spending, increased by inflation',
    statewideAveragePerPupil,
    'usd_per_pupil',
    { source: 'Secretary of Education, determined on or before November 15' },
  );

  const thresholdAmount = product(
    ctx,
    'Excess spending threshold',
    average,
    threshold,
    'usd_per_pupil',
  );

  if (perPupilSpending.value === null || thresholdAmount.value === null) {
    // Preserve the blockers rather than asserting a zero we cannot justify.
    return {
      ...thresholdAmount,
      id: ctx.nextId(),
      label: 'Excess spending',
      value: null,
    };
  }

  const over = Math.max(0, perPupilSpending.value - thresholdAmount.value);
  return input(ctx, 'Excess spending', over, 'usd_per_pupil', {
    source: 'computed from the statutory threshold',
    notes:
      over === 0
        ? ['This district is at or below the excess spending threshold, so nothing is added.']
        : [
            'Spending above the threshold is added to the numerator of the spending ' +
              'adjustment, which is what makes crossing the threshold a cliff edge.',
          ],
  });
}

/**
 * § 5401(13)(A): the education property tax spending adjustment.
 */
export function spendingAdjustment(
  ctx: EngineContext,
  perPupilSpending: CalcNode,
  excess: CalcNode,
): CalcNode {
  const numerator = sum(
    ctx,
    'Per pupil education spending plus excess spending',
    [perPupilSpending, excess],
    'usd_per_pupil',
  );
  const propertyYield = parameterNode(ctx, 'yield.property_dollar_equivalent', 'usd_per_pupil');
  const ratio = quotient(
    ctx,
    'Spending relative to the property dollar equivalent yield',
    numerator,
    propertyYield,
    'ratio',
  );
  const floor = parameterNode(ctx, 'tax.spending_adjustment_floor', 'ratio');

  return greaterOf(ctx, 'Education property tax spending adjustment', ratio, floor, 'ratio');
}

/**
 * § 5402(a)(2): the homestead rate per $100 of equalized education property value.
 */
export function equalizedHomesteadRate(ctx: EngineContext, adjustment: CalcNode): CalcNode {
  const base = parameterNode(ctx, 'tax.homestead_base_rate', 'rate_per_100');
  return product(ctx, 'Equalized homestead education tax rate', base, adjustment, 'rate_per_100');
}

/**
 * § 5402(b)(1): converts the equalized rate into the rate a town actually bills.
 *
 * The divisor is the municipality's CLA divided by the statewide adjustment --
 * not the CLA on its own. This is the step most residents have never had
 * explained to them, and it is frequently the largest single reason a bill moved
 * when district spending did not, so it gets its own nodes in the walkthrough.
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
  const statewide = parameterNode(ctx, 'tax.statewide_adjustment', 'ratio');
  const divisor = quotient(
    ctx,
    `${town.town} common level of appraisal over the statewide adjustment`,
    cla,
    statewide,
    'ratio',
  );
  return quotient(
    ctx,
    `${town.town} homestead education tax rate as billed`,
    equalizedRate,
    divisor,
    'rate_per_100',
  );
}

export function townRate(
  ctx: EngineContext,
  perPupilSpending: CalcNode,
  town: TownTaxInput,
  statewideAveragePerPupil: number | null,
): TownRateResult {
  const excess = excessSpending(ctx, perPupilSpending, statewideAveragePerPupil);
  const adjustment = spendingAdjustment(ctx, perPupilSpending, excess);
  const equalizedRate = equalizedHomesteadRate(ctx, adjustment);
  return {
    town: town.town,
    spendingAdjustment: adjustment,
    equalizedRate,
    billedRate: billedHomesteadRate(ctx, equalizedRate, town),
  };
}

/**
 * § 5402(a)(1): the nonhomestead rate, $1.59 divided by the statewide adjustment.
 *
 * Included because a merger changes a town's homestead rate without changing
 * this one, and showing only the homestead side invites the assumption that the
 * whole bill moves together.
 */
export function nonhomesteadRate(ctx: EngineContext): CalcNode {
  const base = parameterNode(ctx, 'tax.nonhomestead_base_rate', 'rate_per_100');
  const statewide = parameterNode(ctx, 'tax.statewide_adjustment', 'ratio');
  return quotient(ctx, 'Nonhomestead education tax rate', base, statewide, 'rate_per_100');
}

/**
 * Income-based rate for households claiming an income adjustment.
 *
 * For a large share of Vermont homesteads the income calculation, not the
 * property rate, determines the bill. A tool showing only the property rate
 * would mislead exactly the households most anxious about the answer.
 */
export function incomeBasedRate(ctx: EngineContext, perPupilSpending: CalcNode): CalcNode {
  const incomeYield = parameterNode(ctx, 'yield.income_dollar_equivalent', 'usd_per_pupil');
  const target = parameterNode(ctx, 'tax.income_percentage_target', 'ratio');
  const ratio = quotient(
    ctx,
    'Spending relative to the income dollar equivalent yield',
    perPupilSpending,
    incomeYield,
    'ratio',
  );
  return product(ctx, 'Income-based homestead tax rate', ratio, target, 'ratio');
}

/** Expresses a billed rate as a dollar amount on a given parcel value. */
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
