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
 * Four details here are easy to miss and each changes the answer:
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
 *
 * 4. SOME DISTRICTS GET AN ACT 84 TRANSITION DECREASE, FY2025 THROUGH FY2029.
 *    2024 Acts No. 84, Sec. 3, as amended by 2024 Acts No. 183, Secs. 16-17,
 *    lowers the equalized rate of a district whose share of long-term weighted
 *    membership fell under Act 127, by a phased-out share of its FY2025
 *    decrease divided by the statewide adjustment, floored at $1.00. Snapshots:
 *    model/statute/2026-10-22/act-2024-084-secs-3-5.txt and
 *    act-2024-183-secs-16-17-25.txt. See docs/act-127-transition.md.
 */

import {
  derive,
  difference,
  formatValue,
  greaterOf,
  input,
  notComputable,
  parameterNode,
  product,
  quotient,
  sum,
} from './node.ts';
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
  /** The equalized rate after any Act 84 transition decrease -- the rate the district is taxed at. */
  readonly equalizedRate: CalcNode;
  /** The Act 84 decrease, per $100 of equalized value; null when the year has no transition. */
  readonly transitionDecrease: CalcNode | null;
  readonly billedRate: CalcNode;
}

/**
 * The district's Act 84 transition figure (2024 Acts No. 84, Sec. 3).
 *
 * The FY2025 decrease is $0.01 for every relative percent decrease in the
 * district's share of long-term weighted membership (Sec. 3(b)-(c)). That
 * percentage is a one-time Agency of Education calculation against FY2024
 * membership, not a rule, so the engine takes the resulting decrease as an
 * input. Absent (undefined/null) in a year the transition applies means
 * "not supplied" and the rate is not computable; 0 means the district gets no
 * decrease (it is not on the Agency's list of eligible districts).
 */
export interface TransitionInput {
  /** The district's FY2025 homestead rate decrease, in dollars per $100 (0.13 for 13 cents). */
  readonly fy2025RateDecrease?: number | null;
  readonly source?: string;
}

/**
 * Two district-level adjustments Act 183 of 2024 made to the spending figure
 * that is compared to the excess spending threshold. Both are optional: absent
 * (undefined/null) means the district has none, and the comparison is just its
 * per pupil education spending, unchanged. Supplying either requires
 * `weightedMembership`, because the adjustments are stated in total dollars and
 * the threshold is per pupil.
 */
export interface ExcessSpendingAdjustments {
  /**
   * Total dollars drawn from capital reserve funds more than 5 years old that
   * were previously excluded (24 V.S.A. § 2804(b)). The statute counts 150% of
   * this toward the compared spending.
   */
  readonly capitalReserveFivePlusYears?: number | null;
  /**
   * Total dollars of principal and interest on voter-approved bonds approved
   * before July 1, 2024, excluded from the comparison (16 V.S.A. § 4001(6)(B)).
   */
  readonly bondExclusionPreJuly2024?: number | null;
  /** Weighted long-term membership, to put the total-dollar adjustments per pupil. */
  readonly weightedMembership?: CalcNode;
}

/**
 * The per pupil spending figure compared to the excess spending threshold.
 *
 * Without adjustments this is just `perPupilSpending`. With them (Act 183), the
 * comparison adds 150% of old capital reserve draws and subtracts pre-July-2024
 * bond principal and interest, all converted to a per pupil basis. Only the
 * *overage* is affected: the district's base per pupil spending, used elsewhere
 * in the rate, is never reduced (32 V.S.A. § 5401(12); the exclusion "only
 * adjusts the amount over the threshold").
 */
function comparedSpending(
  ctx: EngineContext,
  perPupilSpending: CalcNode,
  adjustments: ExcessSpendingAdjustments,
): CalcNode {
  const { capitalReserveFivePlusYears: capRes, bondExclusionPreJuly2024: bond } = adjustments;
  const hasCapRes = capRes !== undefined && capRes !== null;
  const hasBond = bond !== undefined && bond !== null;
  if (!hasCapRes && !hasBond) return perPupilSpending;

  const membership =
    adjustments.weightedMembership ??
    input(ctx, 'Weighted long-term membership', null, 'pupils', {
      source: 'required to put the excess spending adjustments per pupil',
    });

  // Capital reserve add-on: 150% of >5yr draws. The multiplier parameter is read
  // only when there is a capital reserve amount, so a year without the parameter
  // (or a district with no such draw) never trips a missing-parameter error.
  const capResAmount = input(
    ctx,
    'Capital reserve fund draws more than five years old',
    hasCapRes ? capRes : 0,
    'usd',
    { source: 'figures entered by you in this form' },
  );
  const capResAddon = hasCapRes
    ? product(
        ctx,
        'Capital reserve amount counted toward excess spending (150%)',
        capResAmount,
        parameterNode(ctx, 'tax.excess_spending_capital_reserve_multiplier', 'multiplier'),
        'usd',
      )
    : capResAmount;

  const bondExclusion = input(
    ctx,
    'Principal and interest on bonds approved before July 1, 2024',
    hasBond ? bond : 0,
    'usd',
    { source: 'figures entered by you in this form' },
  );

  const netAdjustment = difference(
    ctx,
    'Net adjustment to education spending for the excess spending test',
    capResAddon,
    bondExclusion,
    'usd',
  );
  const perPupilAdjustment = quotient(
    ctx,
    'Per pupil adjustment for the excess spending test',
    netAdjustment,
    membership,
    'usd_per_pupil',
  );
  return sum(
    ctx,
    'Per pupil spending compared to the excess spending threshold',
    [perPupilSpending, perPupilAdjustment],
    'usd_per_pupil',
  );
}

/**
 * § 5401(12): per pupil education spending above 118 percent of the statewide
 * average, increased by inflation.
 *
 * The statewide average is determined by the Secretary of Education each
 * November from passed budgets, so it is an input rather than a parameter --
 * it is a published figure for a given year, not a rule.
 *
 * Act 183 of 2024 also adjusts the *spending* side of the comparison (see
 * `comparedSpending`): 150% of old capital reserve draws is added and
 * pre-July-2024 bond principal and interest is excluded.
 */
export function excessSpending(
  ctx: EngineContext,
  perPupilSpending: CalcNode,
  statewideAveragePerPupil: number | null,
  adjustments: ExcessSpendingAdjustments = {},
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

  const compared = comparedSpending(ctx, perPupilSpending, adjustments);

  // Build the result through the node machinery rather than by hand, so that a
  // blocker on either side -- a missing statewide average, or the unverified
  // capital-reserve multiplier -- propagates and the walkthrough says which one,
  // instead of a bare em dash with no reason.
  return derive(ctx, {
    op: 'difference',
    label: 'Excess spending',
    unit: 'usd_per_pupil',
    inputs: [compared, thresholdAmount],
    compute: (ops) => Math.max(0, (ops[0] as number) - (ops[1] as number)),
    explain: (value) =>
      value === 0
        ? 'This district is at or below the excess spending threshold, so nothing is added.'
        : `Excess spending is ${formatValue(value, 'usd_per_pupil')} -- the amount by which the ` +
          `compared per pupil spending exceeds the threshold. It is added to the numerator of the ` +
          `spending adjustment, which is what makes crossing the threshold a cliff edge.`,
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

/**
 * 2024 Acts No. 84, Sec. 3(c)-(d), as amended by 2024 Acts No. 183, Sec. 16:
 * the transition decrease, and the equalized rate after it.
 *
 * Applied to the equalized rate -- after excess spending and after the floor of
 * one on the spending adjustment -- because Sec. 3(c) decreases the district's
 * "homestead property tax rate", which § 5402(a)(2) defines as $1.00 times the
 * spending adjustment. The $1.00 floor is Sec. 3(d).
 *
 * Returns null when the parameter set has no transition (FY2030 onward, or a
 * synthetic set without it), so those years run the chain unchanged.
 */
export function transitionRate(
  ctx: EngineContext,
  equalizedRate: CalcNode,
  transition: TransitionInput,
): { decrease: CalcNode; rate: CalcNode } | null {
  if (!ctx.parameters.parameters.has('tax.transition.phase_out_share')) return null;

  const supplied = transition.fy2025RateDecrease;
  const fy2025 =
    supplied === undefined || supplied === null
      ? notComputable(
          ctx,
          'Fiscal year 2025 Act 84 homestead rate decrease',
          'rate_per_100',
          'requires_certification',
          'The district’s fiscal year 2025 Act 84 decrease was not supplied. It comes from the ' +
            'Agency of Education’s Act 84 tax rate discount worksheet; a district not listed there ' +
            'receives none, which is entered as 0.',
        )
      : input(ctx, 'Fiscal year 2025 Act 84 homestead rate decrease', supplied, 'rate_per_100', {
          source: transition.source ?? 'figures entered by you in this form',
        });

  const phased = product(
    ctx,
    'Act 84 decrease phased in for this year',
    fy2025,
    parameterNode(ctx, 'tax.transition.phase_out_share', 'ratio'),
    'rate_per_100',
  );
  const statewide = parameterNode(ctx, 'tax.statewide_adjustment', 'ratio');
  const decrease = derive(ctx, {
    op: 'quotient',
    label: 'Act 84 transition decrease to the equalized homestead rate',
    unit: 'rate_per_100',
    inputs: [phased, statewide],
    // Rounded to three decimal places. This is NOT in the statute: it is the
    // convention the Department of Taxes' FY2026 rate table follows, observed by
    // reproducing that table. Sec. 3(c) rounds only the FY2025 decrease.
    compute: ([a, b]) => Math.round(((a as number) / (b as number)) * 1000) / 1000,
    explain: (value) =>
      value === 0
        ? 'This district receives no Act 84 transition decrease.'
        : `The phased-in decrease divided by the statewide adjustment is ` +
          `${formatValue(value, 'rate_per_100')}, which is subtracted from the equalized rate.`,
    notes: [
      'Sec. 3(c) as amended by Act 183 divides the decrease by the statewide adjustment from ' +
        'fiscal year 2026 on. The result is rounded to three decimal places, matching the ' +
        'Department of Taxes’ published rates; that rounding is an observed convention, not statute.',
    ],
  });
  const reduced = difference(
    ctx,
    'Equalized homestead rate less the Act 84 decrease',
    equalizedRate,
    decrease,
    'rate_per_100',
  );
  const rate = greaterOf(
    ctx,
    'Equalized homestead education tax rate after the Act 84 transition',
    reduced,
    parameterNode(ctx, 'tax.transition.rate_floor', 'rate_per_100'),
    'rate_per_100',
  );
  return { decrease, rate };
}

export function townRate(
  ctx: EngineContext,
  perPupilSpending: CalcNode,
  town: TownTaxInput,
  statewideAveragePerPupil: number | null,
  adjustments: ExcessSpendingAdjustments = {},
  transition: TransitionInput = {},
): TownRateResult {
  const excess = excessSpending(ctx, perPupilSpending, statewideAveragePerPupil, adjustments);
  const adjustment = spendingAdjustment(ctx, perPupilSpending, excess);
  const beforeTransition = equalizedHomesteadRate(ctx, adjustment);
  const transitioned = transitionRate(ctx, beforeTransition, transition);
  const equalizedRate = transitioned?.rate ?? beforeTransition;
  return {
    town: town.town,
    spendingAdjustment: adjustment,
    equalizedRate,
    transitionDecrease: transitioned?.decrease ?? null,
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
