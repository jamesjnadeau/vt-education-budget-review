/** Why a district, union or grouping page shows no single tax rate. */
export function groupRateReason(level: 'district' | 'union' | 'grouping'): string {
  switch (level) {
    case 'district':
      return "Voters approve the district budget. The State turns that budget into a tax rate. Each town in the district gets a different final rate because of its common level of appraisal (CLA), which adjusts for how close the town's listed values are to market prices.";
    case 'union':
      return "A supervisory union is a group of districts. It does not have its own tax rate. Each district's budget sets its rate.";
    case 'grouping':
      return 'A group is a plan for districts that may join. It does not have a tax rate yet.';
  }
}

/** Paths into the explanations page. Prefix with `base` at the call site. */
export const EXPLAIN = {
  cla: '/explanations/#cla',
  credit: '/explanations/#property-tax-credit',
};

/**
 * The source line and the residual note talk about a rate the page shows. They
 * belong on a town page only when that page shows one rate value.
 */
export function showsTownRateNotes(rate: { kind: string }): boolean {
  return rate.kind === 'value';
}

/**
 * A district or union page shows a range of town rates when it has one. A
 * "cannot be told" rate card next to that range would contradict it, so the
 * card is shown only when there is no range.
 */
export function showsGroupRateCard(rateRange: { kind: string }): boolean {
  return rateRange.kind !== 'value';
}
