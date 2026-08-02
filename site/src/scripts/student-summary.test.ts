/**
 * The grouping is a display decision, so it is a tested one: the reader asked
 * for the entered and averaged student counts, then grade weights, demographic
 * weights, their total, and the everything-added-up total, in that order.
 */

import { describe, expect, it } from 'vitest';

import type { CalcNode, MembershipResult } from '@vt-budget/model';

import { studentSummarySections } from './student-summary.ts';

// A stub node is enough: the helper only reads and re-exposes nodes by identity,
// it does no arithmetic. The distinct values make each row identifiable.
const node = (value: number): CalcNode => ({ value, unit: 'pupils', status: 'ok' }) as unknown as CalcNode;

const membership = {
  enteredHeadcountBothYears: node(610),
  longTermMembership: node(310),
  gradeWeightTotal: node(92.5),
  demographicWeightTotal: node(56),
  allWeightsTotal: node(148.5),
  beforeHoldHarmless: node(458.5),
} as unknown as MembershipResult;

describe('studentSummarySections', () => {
  it('groups the figures into students, weights, and total', () => {
    const sections = studentSummarySections(membership);
    expect(sections.map((s) => s.heading)).toEqual([
      'Students',
      'Extra pupils added by weights',
      'Total',
    ]);
  });

  it('places each figure in the right row, in order', () => {
    const rows = studentSummarySections(membership).flatMap((s) => s.rows);
    expect(rows.map((r) => r.node.value)).toEqual([610, 310, 92.5, 56, 148.5, 458.5]);
  });

  it('shows both the entered and the averaged student counts', () => {
    const [students] = studentSummarySections(membership);
    expect(students!.rows).toHaveLength(2);
    expect(students!.rows[0]!.node.value).toBe(610);
    expect(students!.rows[1]!.node.value).toBe(310);
  });
});
