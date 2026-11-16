import { describe, expect, it } from 'vitest';

import { computeWeightedMembership, createContext, input, sum } from './index.ts';
import { syntheticParameters } from './testing/synthetic.ts';

describe('estimated input', () => {
  it('keeps its value, is tagged estimated, and says how it was worked out', () => {
    const ctx = createContext(syntheticParameters());
    const node = input(ctx, 'Education spending', 1_000_000, 'usd', { estimate: 'the FY2026 AOE amount' });

    expect(node.value).toBe(1_000_000);
    expect(node.status).toBe('estimated');
    expect(node.blockers).toEqual([
      { kind: 'estimated_input', ref: 'Education spending', detail: 'Education spending is an estimate: the FY2026 AOE amount.' },
    ]);
    expect(node.explanation).toContain('This is an estimate, not a reported figure: the FY2026 AOE amount.');
  });

  it('carries the estimate label upward without blocking the arithmetic', () => {
    const ctx = createContext(syntheticParameters());
    const total = sum(
      ctx,
      'Total',
      [input(ctx, 'A', 2, 'pupils', { estimate: 'a guess' }), input(ctx, 'B', 3, 'pupils')],
      'pupils',
    );
    expect(total.value).toBe(5);
    expect(total.status).toBe('estimated');
  });

  it('ignores the estimate on a blank value, which stays missing', () => {
    const ctx = createContext(syntheticParameters());
    const node = input(ctx, 'Education spending', null, 'usd', { estimate: 'unused' });
    expect(node.status).toBe('missing_input');
    expect(node.blockers.map((b) => b.kind)).toEqual(['missing_input']);
  });

  it('flags a grade band marked as an estimate in the membership input', () => {
    const ctx = createContext(syntheticParameters());
    const result = computeWeightedMembership(ctx, {
      entity: 'ud/test',
      adm_years: [
        { fiscal_year: 2025, prekindergarten: 0, kindergarten_through_5: 100, grades_6_through_8: 50, grades_9_through_12: 50 },
        {
          fiscal_year: 2026,
          prekindergarten: 0,
          kindergarten_through_5: 100,
          grades_6_through_8: 22,
          grades_9_through_12: 50,
          estimates: { grades_6_through_8: 'the middle of the published range' },
        },
      ],
      state_placed_fte: 0,
      poverty_185_fpl: 0,
      english_learners: 0,
      persons_per_square_mile: 100,
      small_schools: [],
      source: 'test',
    });
    const refs = result.longTermMembership.blockers.filter((b) => b.kind === 'estimated_input').map((b) => b.ref);
    expect(refs).toEqual(['FY2026 average daily membership, grades six through eight']);
  });

  it('marks a lower-limit input with its own blocker, still estimated and still computing', () => {
    const ctx = createContext(syntheticParameters());
    const node = input(ctx, 'Grades 9-12', 1203.6, 'pupils', {
      estimate: { how: 'the bottom of the published range', lowerLimit: true },
    });
    expect(node.value).toBe(1203.6);
    expect(node.status).toBe('estimated');
    expect(node.blockers).toEqual([
      {
        kind: 'lower_limit_input',
        ref: 'Grades 9-12',
        detail: 'Grades 9-12 is a lower limit, so the real number may be higher: the bottom of the published range.',
      },
    ]);
    const total = sum(ctx, 'Total', [node, input(ctx, 'B', 3, 'pupils')], 'pupils');
    expect(total.value).toBeCloseTo(1206.6);
    expect(total.blockers.map((b) => b.kind)).toEqual(['lower_limit_input']);
  });
});
