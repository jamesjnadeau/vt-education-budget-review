import { describe, expect, it } from 'vitest';

import { detectPlaceholder, isReportingBucket } from './placeholder.ts';

describe('placeholder detection', () => {
  it('catches the record that is actually in the production API', () => {
    // {"ServerId":...,"Name":"Test","OrgID":"Test","OrgType":"Distance Learning (IS)"}
    const verdict = detectPlaceholder({ id: 'Test', name: 'Test' });
    expect(verdict.isPlaceholder).toBe(true);
    expect(verdict.reason).toMatch(/scratch-record prefix/);
  });

  it('catches a placeholder name even when the org ID looks legitimate', () => {
    const verdict = detectPlaceholder({ id: 'PS999', name: 'TEST' });
    expect(verdict.isPlaceholder).toBe(true);
    expect(verdict.reason).toMatch(/placeholder rather than an organization name/);
  });

  it('catches a placeholder ID even when the name looks legitimate', () => {
    expect(detectPlaceholder({ id: 'TEST001', name: 'Maple Street School' }).isPlaceholder).toBe(true);
  });

  it('sees through a generic suffix', () => {
    for (const name of ['Test School', 'Test District', 'SAMPLE ORGANIZATION', 'dummy record']) {
      expect(detectPlaceholder({ id: 'PS999', name }).isPlaceholder, name).toBe(true);
    }
  });

  it('strips repeated generic suffixes', () => {
    expect(detectPlaceholder({ id: 'PS999', name: 'Test School District' }).isPlaceholder).toBe(true);
  });

  it('catches an empty or whitespace-only name', () => {
    expect(detectPlaceholder({ id: 'PS999', name: '' }).isPlaceholder).toBe(true);
    expect(detectPlaceholder({ id: 'PS999', name: '   ' }).isPlaceholder).toBe(true);
    expect(detectPlaceholder({ id: 'PS999', name: null }).isPlaceholder).toBe(true);
  });

  it('catches repeated-character filler', () => {
    expect(detectPlaceholder({ id: 'XXX', name: 'Something' }).isPlaceholder).toBe(true);
    expect(detectPlaceholder({ id: 'PS999', name: 'zzzz' }).isPlaceholder).toBe(true);
  });

  it('catches the other common scratch tokens', () => {
    for (const name of ['TBD', 'todo', 'do not use', 'DELETE ME', 'placeholder']) {
      expect(detectPlaceholder({ id: 'PS999', name }).isPlaceholder, name).toBe(true);
    }
  });
});

describe('reporting buckets are kept, not filtered', () => {
  // A town record named UNKNOWN is how AOE records residency for pupils whose
  // town is not established. It looks like a placeholder and is not one: other
  // records legitimately reference it, so dropping it would break those
  // references and lose real reporting structure. It is kept and flagged
  // instead, because what it must never do is receive ADM.

  it('does not treat a reporting bucket as a placeholder', () => {
    for (const name of ['UNKNOWN', 'Unassigned', 'None', 'N/A', 'Out of State']) {
      expect(detectPlaceholder({ id: 'T300', name }).isPlaceholder, name).toBe(false);
    }
  });

  it('identifies them as buckets so no membership is awarded to them', () => {
    for (const name of ['UNKNOWN', 'unassigned', 'none', 'N/A', 'out of state', 'Other']) {
      expect(isReportingBucket({ id: 'T300', name }), name).toBe(true);
    }
  });

  it('does not mistake a real organization for a bucket', () => {
    for (const name of ['BRATTLEBORO', 'Academy School', 'Northeast Kingdom Choice School District']) {
      expect(isReportingBucket({ id: 'T300', name }), name).toBe(false);
    }
  });
});

describe('placeholder detection does not eat real organizations', () => {
  // A filter that removes a real district is far worse than one that leaves a
  // stray test record in, so matching is on the whole name rather than a
  // substring or a prefix. These are the cases that would break if that ever
  // loosened.

  it('leaves every real record in the live snapshot alone', () => {
    const realNames = [
      'Addison Central Unified Union School District #55',
      'Mt. Abraham Unified School District #61',
      'Battenkill Valley Supervisory Union',
      'BARRE CITY',
      'BRATTLEBORO',
      'BRATTLEBORO TOWN SCHOOL DISTRICT',
      'Brattleboro Union High School',
      'Academy School',
      'Albany Community School',
      'Albert Bridge School (West Windsor)',
      'Vergennes Union High School',
      'West River Valley Union Education District #72A',
      'Echo Valley Community Union School District #67',
      'Rivendell Interstate School District',
    ];
    for (const name of realNames) {
      expect(detectPlaceholder({ id: 'PS123', name }).isPlaceholder, name).toBe(false);
    }
  });

  it('does not match a name that merely begins with a placeholder word', () => {
    // Hypothetical, but this is exactly the failure mode a prefix match would
    // introduce, and it would delete a real school silently.
    expect(detectPlaceholder({ id: 'PS123', name: 'Test Valley Union School' }).isPlaceholder).toBe(false);
    expect(detectPlaceholder({ id: 'PS123', name: 'Sampleton Elementary' }).isPlaceholder).toBe(false);
    expect(detectPlaceholder({ id: 'PS123', name: 'Noneshire Academy' }).isPlaceholder).toBe(false);
  });

  it('does not match a name that merely contains a placeholder word', () => {
    expect(detectPlaceholder({ id: 'PS123', name: 'Greatest Hits Charter School' }).isPlaceholder).toBe(false);
    expect(detectPlaceholder({ id: 'PS123', name: 'Contest Memorial School' }).isPlaceholder).toBe(false);
  });

  it('does not match real IDs that happen to start with a matching letter run', () => {
    expect(detectPlaceholder({ id: 'T027', name: 'BRATTLEBORO' }).isPlaceholder).toBe(false);
    expect(detectPlaceholder({ id: 'TE001', name: 'River Valley Technical Center' }).isPlaceholder).toBe(false);
    expect(detectPlaceholder({ id: 'SU001', name: 'Mt. Abraham Unified School District' }).isPlaceholder).toBe(false);
  });
});

describe('residency reporting buckets are identified structurally', () => {
  // AOE records out-of-state and out-of-country residency as bare-numeric town
  // codes in the 900 range. They are not places and are awarded no ADM. Name
  // matching misses them because their names are compounds.
  const RESIDENCY_BUCKETS: ReadonlyArray<readonly [string, string]> = [
    ['901', 'Other State -Massachusetts'],
    ['902', 'Other State -New Hampshire'],
    ['903', 'Other State -New York'],
    ['904', 'Other Country -Quebec, Canada'],
    ['905', 'Other Out of State'],
    ['906', 'Other Out of Country'],
  ];

  it('flags every bare-numeric 900-range record', () => {
    for (const [id, name] of RESIDENCY_BUCKETS) {
      expect(isReportingBucket({ id, name }), `${id} ${name}`).toBe(true);
    }
  });

  it('does not flag Orford NH, which is a real interstate member town', () => {
    // T999 is a real New Hampshire town and a member of the Rivendell
    // Interstate district. It earns no Vermont ADM because it has no Vermont
    // operating district -- not because it is a bucket. Flagging it would
    // corrupt the interstate district's structure.
    expect(isReportingBucket({ id: 'T999', name: 'ORFORD NH' })).toBe(false);
  });

  it('does not flag T-prefixed towns whose digits fall in the 900 range', () => {
    expect(isReportingBucket({ id: 'T900', name: 'SOMEWHERE' })).toBe(false);
    expect(isReportingBucket({ id: 'T901', name: 'SOMEWHERE ELSE' })).toBe(false);
  });

  it('does not flag other bare-numeric codes outside the 900 range', () => {
    expect(isReportingBucket({ id: '101', name: 'A Real Place' })).toBe(false);
    expect(isReportingBucket({ id: '9001', name: 'Four Digits' })).toBe(false);
  });

  it('still flags name-based buckets, with or without an id', () => {
    expect(isReportingBucket({ id: 'T000', name: 'UNKNOWN' })).toBe(true);
    expect(isReportingBucket({ id: null, name: 'Unassigned' })).toBe(true);
  });

  it('still does not flag real towns', () => {
    expect(isReportingBucket({ id: 'T027', name: 'BRATTLEBORO' })).toBe(false);
    expect(isReportingBucket({ id: 'T037', name: 'BURLINGTON' })).toBe(false);
  });
});
