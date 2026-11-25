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
