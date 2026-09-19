import { describe, it, expect } from 'vitest';
import {
  changesTouching,
  unseenChangeCount,
  longDate,
  type Reassignment,
  type KnownChange,
} from './groupings.ts';

const change = (from: number | null, to: number | null): KnownChange => ({
  district: 'ud/harwood-60',
  district_name_as_written: 'Harwood Unified Union School District',
  from_grouping: from,
  to_grouping: to,
  to_grouping_as_reported: null,
  to_grouping_basis: 'inferred',
  verified: false,
});

const reassignment = (overrides: Partial<Reassignment> = {}): Reassignment => ({
  by: 'Vermont Learning Collaborative',
  status: 'announced_provisional',
  as_of: '2026-09-18',
  committee_count: 18,
  district_count: 119,
  requests_granted: 13,
  comment_deadline: '2026-09-23',
  finalize_target: '2026-09-25',
  first_meeting_deadline: '2026-10-15',
  roster_published: false,
  sources: [],
  known_changes: [change(20, 13)],
  ...overrides,
});

describe('changesTouching', () => {
  it('finds the group a district left', () => {
    expect(changesTouching(reassignment(), 20)).toHaveLength(1);
  });

  it('finds the group a district joined', () => {
    expect(changesTouching(reassignment(), 13)).toHaveLength(1);
  });

  it('returns nothing for a group no recorded move touches', () => {
    expect(changesTouching(reassignment(), 7)).toEqual([]);
  });

  it('treats a missing reassignment as no changes rather than throwing', () => {
    expect(changesTouching(null, 20)).toEqual([]);
  });
});

describe('unseenChangeCount', () => {
  // The number that keeps a quiet group page honest: twelve districts moved
  // and we cannot say which. Silence on a group page must never read as "no
  // change here".
  it('counts the granted moves we hold no source for', () => {
    expect(unseenChangeCount(reassignment())).toBe(12);
  });

  it('is null when the source did not say how many moves were granted', () => {
    expect(unseenChangeCount(reassignment({ requests_granted: null }))).toBeNull();
  });

  it('never goes negative if we somehow hold more moves than were reported', () => {
    expect(
      unseenChangeCount(
        reassignment({ requests_granted: 1, known_changes: [change(20, 13), change(5, 6)] }),
      ),
    ).toBe(0);
  });
});

describe('longDate', () => {
  it('spells out an ISO date', () => {
    expect(longDate('2026-09-18')).toBe('September 18, 2026');
  });

  it('passes through anything that is not a plain ISO date', () => {
    expect(longDate('sometime in the fall')).toBe('sometime in the fall');
  });

  it('is empty for a missing date', () => {
    expect(longDate(null)).toBe('');
  });
});
