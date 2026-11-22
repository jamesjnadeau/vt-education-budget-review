import { describe, it, expect } from 'vitest';
import {
  changesTouching,
  unseenChangeCount,
  unseenIsFloor,
  settleDatePassedUnconfirmed,
  longDate,
  committeeAdmSum,
  committeeMoves,
  committeeOf,
  dissolvedGroups,
  publishedCommittees,
  unlistedActMembers,
  whereMembersWent,
  type Committee,
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

describe('unseenIsFloor', () => {
  // The facilitators moved districts nobody asked to move, and did not say how
  // many. When that is on the record, "12 moves we cannot see" would be a
  // confident undercount; pages have to say "at least 12".
  it('is true when the facilitators made moves beyond the granted requests', () => {
    expect(unseenIsFloor(reassignment({ additional_adjustments: true }))).toBe(true);
  });

  it('is false when no source reports extra moves', () => {
    expect(unseenIsFloor(reassignment({ additional_adjustments: false }))).toBe(false);
    expect(unseenIsFloor(reassignment({ additional_adjustments: null }))).toBe(false);
    expect(unseenIsFloor(reassignment())).toBe(false);
  });

  it('is false with no reassignment at all', () => {
    expect(unseenIsFloor(null)).toBe(false);
  });
});

describe('settleDatePassedUnconfirmed', () => {
  // "They aimed to settle the groups on September 25" reads as done once the
  // date is past. Until a source says they did, pages have to say we have not
  // seen it happen.
  it('is true once the target date is past and the groups are still provisional', () => {
    expect(settleDatePassedUnconfirmed(reassignment(), '2026-09-27')).toBe(true);
  });

  it('is false on or before the target date', () => {
    expect(settleDatePassedUnconfirmed(reassignment(), '2026-09-25')).toBe(false);
    expect(settleDatePassedUnconfirmed(reassignment(), '2026-09-20')).toBe(false);
  });

  it('is false once the groups are recorded as final', () => {
    expect(settleDatePassedUnconfirmed(reassignment({ status: 'final' }), '2026-09-27')).toBe(false);
  });

  it('is false with no target date or no reassignment', () => {
    expect(settleDatePassedUnconfirmed(reassignment({ finalize_target: null }), '2026-09-27')).toBe(false);
    expect(settleDatePassedUnconfirmed(null, '2026-09-27')).toBe(false);
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

const committee = (number: number, roster: Committee['roster'], adm: number | null = null): Committee => ({
  number,
  slug: `committee-${number}`,
  name: `Group ${number}`,
  name_as_written: `Group ${number}`,
  adm_total_as_published: adm,
  roster,
  verified: false,
});
const d = (name: string, maps_to: string[], adm: number | null = null) => ({
  name_as_written: name,
  maps_to,
  kind: 'district' as const,
  adm_as_published: adm,
});

// Act: 5 = {a}, 6 = {b, wr-a, wr-b}, 11 = {c, su/x}. Committees: 5 = {a, wr-a/b}, 3 = {b}, 11 = {c}.
const acts = [
  { number: 5, members: ['town/a'] },
  { number: 6, members: ['town/b', 'ud/wr-a', 'ud/wr-b'] },
  { number: 11, members: ['town/c', 'su/x'], member_names_as_written: ['C SD', 'X Supervisory Union'] },
];
const committees = [
  committee(3, [d('B SD', ['town/b'])]),
  committee(5, [d('A SD', ['town/a'], 10), d('West River', ['ud/wr-a', 'ud/wr-b'], 20), { name_as_written: 'Tech', maps_to: ['techcenter/t'], kind: 'career_technical_center' }], 31),
  committee(11, [d('C SD', ['town/c'])]),
];

describe('committee helpers', () => {
  it('reads moves off the committees, one per written name', () => {
    expect(committeeMoves(acts, committees)).toEqual([
      { districts: ['town/b'], name: 'B SD', from_grouping: 6, to_grouping: 3 },
      { districts: ['ud/wr-a', 'ud/wr-b'], name: 'West River', from_grouping: 6, to_grouping: 5 },
    ]);
  });
  it('finds dissolved act groups', () => {
    expect(dissolvedGroups(acts, committees)).toEqual([6]);
  });
  it('lists act members on no committee, by the act name', () => {
    expect(unlistedActMembers(acts, committees)).toEqual([{ slug: 'su/x', name: 'X Supervisory Union', from_grouping: 11 }]);
  });
  it('sums district ADM and ignores tech centers', () => {
    expect(committeeAdmSum(committees[1]!)).toBe(30);
    expect(committeeAdmSum(committees[0]!)).toBeNull();
  });
  it('finds a district\'s committee', () => {
    expect(committeeOf(committees, 'ud/wr-b')?.number).toBe(5);
    expect(committeeOf(committees, 'techcenter/t')).toBeNull();
  });
  it('uses committees only once the roster is published', () => {
    expect(publishedCommittees(reassignment({ committees }))).toEqual([]);
    expect(publishedCommittees(reassignment({ roster_published: true, committees })).map((c) => c.number)).toEqual([3, 5, 11]);
    expect(committeeMoves(acts, [])).toEqual([]);
  });
});

describe('whereMembersWent', () => {
  it('names each district from the committee roster, once per written name', () => {
    // Act names deliberately short by one, as in act group 6: index pairing would drift.
    const g6 = { number: 6, members: ['town/b', 'ud/wr-a', 'ud/wr-b'], member_names_as_written: ['B', 'West River'] };
    expect(whereMembersWent(g6, committees).map((w) => [w.name, w.committee?.number])).toEqual([
      ['B SD', 3],
      ['West River', 5],
    ]);
  });
});
