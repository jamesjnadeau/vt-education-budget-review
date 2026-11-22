import { describe, expect, it } from 'vitest';
import { committeeAsGrouping, operativeGroupings, type CommitteeInput } from './committees.ts';

const c5: CommitteeInput = {
  number: 5,
  slug: 'committee-5',
  name: 'Group 5',
  roster: [
    { name_as_written: 'Halifax School District', maps_to: ['town/halifax'], kind: 'district' },
    {
      name_as_written: 'West River Modified Union Education District',
      maps_to: ['ud/wr-a', 'ud/wr-b'],
      kind: 'district',
    },
    { name_as_written: 'River Valley Technical Center', maps_to: ['techcenter/rvtc'], kind: 'career_technical_center' },
  ],
};
const act = [{ number: 6, slug: 'group-6', name: 'Group 6', members: ['town/windham'] }];

describe('committeeAsGrouping', () => {
  it('flattens A/B districts, keeps names aligned by index, drops tech centers', () => {
    const g = committeeAsGrouping(c5);
    expect(g.members).toEqual(['town/halifax', 'ud/wr-a', 'ud/wr-b']);
    expect(g.member_names_as_written).toEqual([
      'Halifax School District',
      'West River Modified Union Education District',
      'West River Modified Union Education District',
    ]);
  });
});

describe('operativeGroupings', () => {
  it('uses the committees once the roster is published', () => {
    const out = operativeGroupings({ groupings: act, reassignment: { roster_published: true, committees: [c5] } });
    expect(out.map((g) => g.number)).toEqual([5]);
  });
  it('falls back to the act groupings while the roster is not published', () => {
    expect(operativeGroupings({ groupings: act, reassignment: { roster_published: false, committees: [c5] } })).toEqual(act);
    expect(operativeGroupings({ groupings: act, reassignment: null })).toEqual(act);
    expect(operativeGroupings({ groupings: act, reassignment: { roster_published: true, committees: [] } })).toEqual(act);
  });
});
