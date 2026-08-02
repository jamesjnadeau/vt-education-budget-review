/**
 * The grouped student/ADM figures shown under "Spending and the town".
 *
 * These are the membership engine's own nodes, arranged into the sections a
 * reader asked to see: how many students (as entered, and as the two-year
 * average the formula uses), how many extra pupils each family of weights adds,
 * and the weighted total the spending is divided among. Arranging the engine's
 * nodes rather than recomputing anything is what keeps this display from ever
 * drifting away from the "Show the work" walkthrough below it.
 */

import type { CalcNode, MembershipResult } from '@vt-budget/model';

export interface SummaryRow {
  readonly label: string;
  readonly node: CalcNode;
}

export interface SummarySection {
  readonly heading: string;
  readonly rows: readonly SummaryRow[];
}

export function studentSummarySections(m: MembershipResult): SummarySection[] {
  return [
    {
      heading: 'Students',
      rows: [
        { label: 'Both years added together', node: m.enteredHeadcountBothYears },
        { label: 'Two-year average (the count the formula uses)', node: m.longTermMembership },
      ],
    },
    {
      heading: 'Extra pupils added by weights',
      rows: [
        { label: 'Grade weights', node: m.gradeWeightTotal },
        {
          label: 'Demographic weights (poverty, English learner, sparsity, small school)',
          node: m.demographicWeightTotal,
        },
        { label: 'All weights together', node: m.allWeightsTotal },
      ],
    },
    {
      heading: 'Total',
      rows: [{ label: 'Everything added up (weighted long-term membership)', node: m.beforeHoldHarmless }],
    },
  ];
}
