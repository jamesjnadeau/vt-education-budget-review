/**
 * Foundation formula stub, with honest error bars.
 *
 * Act 73 of 2025 sets Vermont on a course toward a base-amount-times-weighted-
 * need formula with a statewide rate, contingently effective for the
 * 2028-29 reorganization. The Legislature has not set its parameters.
 *
 * The response to that is NOT to omit the foundation formula -- residents are
 * being asked to vote on mergers whose consequences run through it -- and NOT
 * to invent a base amount. It is to model the STRUCTURE, carry ranges instead
 * of point values, and label every figure downstream as contingent.
 *
 * "Under these plausible parameter sets your town's rate lands between X and Y"
 * is both more honest and more useful than a single confident wrong number,
 * and it is the analysis the official process is least likely to supply.
 */

import { input, parameterNode, product, quotient } from './node.ts';
import type { CalcNode, EngineContext, Parameter } from './types.ts';
import { lookup } from './node.ts';

export interface FoundationResult {
  /** The point calculation, which is null while the parameters are unset. */
  readonly payment: CalcNode;
  /** Low/high envelope from the parameters' declared ranges. */
  readonly envelope: { readonly low: number; readonly high: number } | null;
  readonly contingent: true;
  readonly basis: readonly string[];
}

/**
 * Educational opportunity payment: base amount x weighted long-term membership.
 */
export function educationalOpportunityPayment(
  ctx: EngineContext,
  weightedMembership: CalcNode,
): CalcNode {
  const base = parameterNode(ctx, 'foundation.base_amount', 'usd_per_pupil');
  return product(ctx, 'Educational opportunity payment', base, weightedMembership, 'usd');
}

/**
 * Statewide homestead rate needed to raise a given amount.
 *
 * Under a statewide rate the causal direction reverses from the yield system:
 * a district's own spending no longer sets its own rate. That reversal is the
 * single most consequential thing for a resident to understand about the
 * transition, so it gets an explicit note rather than being left implicit in
 * the arithmetic.
 */
export function statewideRate(
  ctx: EngineContext,
  totalPayments: CalcNode,
  statewideGrandList: number | null,
): CalcNode {
  const grandList = input(
    ctx,
    'Statewide equalized grand list, in hundreds of dollars',
    statewideGrandList === null ? null : statewideGrandList / 100,
    'count',
    { source: 'Vermont Department of Taxes' },
  );
  const rate = quotient(ctx, 'Statewide homestead tax rate', totalPayments, grandList, 'rate_per_100');
  return {
    ...rate,
    notes: [
      ...rate.notes,
      'Under a statewide rate a district’s own budget no longer determines its own ' +
        'rate. Local spending decisions move the statewide total, and every town’s ' +
        'rate with it. This is a different causal structure from the yield system, ' +
        'not merely different arithmetic.',
    ],
  };
}

/**
 * Computes the low/high envelope implied by the ranges on contingent
 * parameters, so the UI can present a band rather than a false point.
 *
 * Returns null when no contingent parameter carries a range, because an
 * envelope invented in the absence of a stated basis would be exactly the
 * false precision this module exists to avoid.
 */
export function foundationEnvelope(
  ctx: EngineContext,
  weightedMembership: number | null,
): { low: number; high: number; basis: string[] } | null {
  if (weightedMembership === null) return null;

  let base: Parameter;
  try {
    base = lookup(ctx, 'foundation.base_amount');
  } catch {
    return null;
  }
  if (!base.range) return null;

  return {
    low: base.range.low * weightedMembership,
    high: base.range.high * weightedMembership,
    basis: [base.range.basis],
  };
}

export function foundationPayment(
  ctx: EngineContext,
  weightedMembership: CalcNode,
): FoundationResult {
  const payment = educationalOpportunityPayment(ctx, weightedMembership);
  const envelope = foundationEnvelope(ctx, weightedMembership.value);
  return {
    payment,
    envelope: envelope ? { low: envelope.low, high: envelope.high } : null,
    contingent: true,
    basis: envelope?.basis ?? [],
  };
}
