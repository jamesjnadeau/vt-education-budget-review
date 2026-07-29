import { describe, expect, it } from 'vitest';

import type { AoeRawRecord, Snapshot } from './aoe-client.ts';
import { orgId } from './aoe-client.ts';
import { assignSlug, entityTypeFromOrgType, makeSlug, slugifyName } from './slugs.ts';
import { diffRegistry, normalizeSnapshot, relationshipsFor } from './sync.ts';
import type { RegistryEntity } from './types.ts';

describe('the API is inconsistent about its own primary key', () => {
  it('reads OrgID and OrgId as the same field', () => {
    expect(orgId({ OrgID: 'SU001' })).toBe('SU001');
    expect(orgId({ OrgId: 'T011' })).toBe('T011');
    expect(orgId({ Name: 'nameless' })).toBeNull();
  });
});

describe('ParentOrg and OperatedBy mean opposite things for towns and schools', () => {
  // This is the single most consequential quirk in the upstream data. Reading
  // ParentOrg uniformly as "the parent" files every town under a district and
  // every school under an SU -- a registry that looks plausible and is wrong
  // about who operates what, feeding every scenario the tool produces.

  it('reads a town’s OperatedBy as its supervisory union', () => {
    const town: AoeRawRecord = { OrgId: 'T011', OrgType: 'Towns/City (T)', ParentOrg: 'U097', OperatedBy: 'SU061' };
    expect(relationshipsFor('town', town)).toEqual({
      supervisory_union: 'SU061',
      operated_by: 'U097',
    });
  });

  it('reads a school’s ParentOrg as its supervisory union', () => {
    const school: AoeRawRecord = { OrgId: 'PS001', OrgType: 'Public School (PS)', ParentOrg: 'SU048', OperatedBy: 'U096' };
    expect(relationshipsFor('school', school)).toEqual({
      supervisory_union: 'SU048',
      operated_by: 'U096',
    });
  });

  it('does not record a supervisory union as its own parent', () => {
    const su: AoeRawRecord = { OrgID: 'SU001', OrgType: 'Supervisory Union (SU)', OperatedBy: 'SU001' };
    expect(relationshipsFor('su', su)).toEqual({ supervisory_union: null, operated_by: null });
  });
});

describe('slugs', () => {
  it('strips the boilerplate every district name carries', () => {
    expect(slugifyName('Addison Central Unified Union School District #55')).toBe('addison-central-55');
    expect(slugifyName('Battenkill Valley Supervisory Union')).toBe('battenkill-valley');
  });

  it('keeps the district number, which is often the only disambiguator', () => {
    expect(slugifyName('West River Valley Union Education District #72A')).toContain('72');
    expect(slugifyName('Mt. Abraham Unified School District #61')).toBe('mt-abraham-61');
  });

  it('collapses punctuation and double spaces', () => {
    expect(slugifyName('Mountain Views  School District')).toBe('mountain-views');
    expect(makeSlug('town', 'BARRE CITY')).toBe('town/barre-city');
  });

  it('reuses an existing slug for a known org ID even when the name changed', () => {
    // AOE names churn; our URLs must not. A committee packet citing
    // /su/washington-central/ has to keep resolving after a rename.
    const existingByOrgId = new Map([['SU001', 'su/mt-abraham']]);
    const result = assignSlug('su', 'Completely Different Name', 'SU001', existingByOrgId, new Set());
    expect(result).toEqual({ slug: 'su/mt-abraham', minted: false });
  });

  it('disambiguates a genuine collision with the AOE id rather than a bare counter', () => {
    const taken = new Set(['town/springfield']);
    const result = assignSlug('town', 'SPRINGFIELD', 'T999', new Map(), taken);
    expect(result.slug).toBe('town/springfield-t999');
    expect(result.minted).toBe(true);
  });

  it('maps the org types that matter for school finance', () => {
    expect(entityTypeFromOrgType('Supervisory Union (SU)')).toBe('su');
    expect(entityTypeFromOrgType('Unified District (U)')).toBe('ud');
    expect(entityTypeFromOrgType('Towns/City (T)')).toBe('town');
    expect(entityTypeFromOrgType('Vocational School (VC)')).toBe('techcenter');
    expect(entityTypeFromOrgType('Joint Contract District (J)')).toBe('sd');
    // Independent schools are tracked because tuitioning towns have entirely
    // different merger arithmetic from towns that operate their own schools.
    expect(entityTypeFromOrgType('Independent School (IS)')).toBe('independent');
    expect(entityTypeFromOrgType('Recognized School (IS)')).toBe('independent');
    expect(entityTypeFromOrgType('Head Start (HDS)')).toBeNull();
  });
});

function snapshotOf(endpoints: Record<string, AoeRawRecord[]>): Snapshot {
  return { date: '2026-07-29', endpoints };
}

const SNAPSHOT = snapshotOf({
  supervisoryUnions: [
    { ServerId: 5, Name: 'Addison Northwest Supervisory District', OrgID: 'SU002', OrgType: 'Supervisory Union (SU)', OperatedBy: 'SU002' },
  ],
  unionDistricts: [
    { ServerId: 1500, Name: 'Addison Northwest Unified Union School District #54', OrgId: 'U054', OrgType: 'Unified District (U)', ParentOrg: 'SU002' },
  ],
  towns: [
    { ServerId: 1442, Name: 'ADDISON', OrgId: 'T001', OrgType: 'Towns/City (T)', ParentOrg: 'U054', OperatedBy: 'SU002' },
    { ServerId: 1443, Name: 'VERGENNES', OrgId: 'T002', OrgType: 'Towns/City (T)', ParentOrg: 'U054', OperatedBy: 'SU002' },
  ],
  publicSchools: [
    { ServerId: 67, Name: 'Vergennes Union High School', OrgId: 'PS100', OrgType: 'Public School (PS)', ParentOrg: 'SU002', OperatedBy: 'U054', Grades: ['9', '10', '11', '12'] },
  ],
  closedOrganizations: [],
});

describe('normalizing a snapshot', () => {
  it('resolves relationships to slugs, not raw AOE ids', () => {
    const { entities } = normalizeSnapshot(SNAPSHOT, { existing: new Map(), today: '2026-07-29' });
    const bySlug = new Map(entities.map((e) => [e.slug, e]));

    expect(bySlug.get('town/addison')?.supervisory_union).toBe('su/addison-northwest');
    expect(bySlug.get('town/addison')?.operated_by).toBe('ud/addison-northwest-54');
    expect(bySlug.get('school/vergennes-union-high-school')?.supervisory_union).toBe('su/addison-northwest');
    expect(bySlug.get('school/vergennes-union-high-school')?.operated_by).toBe('ud/addison-northwest-54');
  });

  it('derives member towns by inverting the town relationships', () => {
    const { entities } = normalizeSnapshot(SNAPSHOT, { existing: new Map(), today: '2026-07-29' });
    const district = entities.find((e) => e.slug === 'ud/addison-northwest-54');
    expect(district?.member_towns).toEqual(['town/addison', 'town/vergennes']);
  });

  it('marks first-seen dates as observed, never as founding dates', () => {
    // The API publishes no opening date. Recording the snapshot date without
    // saying where it came from would invent history.
    const { entities } = normalizeSnapshot(SNAPSHOT, { existing: new Map(), today: '2026-07-29' });
    const town = entities.find((e) => e.slug === 'town/addison');
    expect(town?.effective_from).toBe('2026-07-29');
    expect(town?.effective_from_basis).toBe('first_observed');
  });

  it('does not move effective_from on a later sync', () => {
    const first = normalizeSnapshot(SNAPSHOT, { existing: new Map(), today: '2026-07-29' });
    const existing = new Map(first.entities.map((e) => [e.slug, e]));
    const second = normalizeSnapshot({ ...SNAPSHOT, date: '2027-01-01' }, { existing, today: '2027-01-01' });

    expect(second.entities.find((e) => e.slug === 'town/addison')?.effective_from).toBe('2026-07-29');
  });

  it('closes entities rather than dropping them, using the published close date', () => {
    const withClosure = snapshotOf({
      ...SNAPSHOT.endpoints,
      closedOrganizations: [
        { ServerId: 49, Name: 'Battenkill Valley Supervisory Union', OrgID: 'SU060', OrgType: 'Supervisory Union (SU)', CloseDate: '2021-06-30T07:00:00Z' },
      ],
    });
    const { entities } = normalizeSnapshot(withClosure, { existing: new Map(), today: '2026-07-29' });
    const closed = entities.find((e) => e.slug === 'su/battenkill-valley');

    expect(closed?.effective_to).toBe('2021-06-30');
    expect(closed?.effective_to_basis).toBe('aoe_published');
  });

  it('warns rather than silently dropping an unrecognized org type', () => {
    const odd = snapshotOf({
      organizations: [{ ServerId: 1, Name: 'BRATTLEBORO TOWN SCHOOL DISTRICT', OrgID: 'X001', OrgType: 'Head Start (HDS)' }],
    });
    const { entities, warnings } = normalizeSnapshot(odd, { existing: new Map(), today: '2026-07-29' });

    expect(entities).toHaveLength(0);
    expect(warnings.join(' ')).toMatch(/unrecognized OrgType "Head Start \(HDS\)"/);
  });

  it('preserves values a human set by hand', () => {
    // The API is a convenience layer, not a dependency. A deliberate human
    // correction must survive the next nightly sync.
    const existing = new Map<string, RegistryEntity>([
      [
        'town/addison',
        {
          slug: 'town/addison',
          name: 'Addison',
          type: 'town',
          aoe_org_id: 'T001',
          aoe_server_id: 1442,
          edfi_id: null,
          effective_from: '1761-06-30',
          effective_from_basis: 'manual',
          effective_to: null,
          effective_to_basis: 'unknown',
          successor: null,
          successor_basis: null,
          supervisory_union: null,
          operated_by: null,
          member_towns: [],
          grades: [],
          website: null,
          latitude: null,
          longitude: null,
          manual_overrides: [
            { field: 'name', reason: 'AOE publishes town names in all caps', set_by: 'jn', set_date: '2026-07-29' },
          ],
          notes: null,
        },
      ],
    ]);

    const { entities } = normalizeSnapshot(SNAPSHOT, { existing, today: '2026-07-29' });
    const town = entities.find((e) => e.slug === 'town/addison');

    expect(town?.name).toBe('Addison');
    expect(town?.manual_overrides).toHaveLength(1);
    // Fields not under an override still track the API.
    expect(town?.supervisory_union).toBe('su/addison-northwest');
  });
});

describe('diffing, which is the body of the nightly sync PR', () => {
  const base = normalizeSnapshot(SNAPSHOT, { existing: new Map(), today: '2026-07-29' });
  const before = new Map(base.entities.map((e) => [e.slug, e]));

  it('reports nothing when nothing changed', () => {
    expect(diffRegistry(before, before)).toHaveLength(0);
  });

  it('reports an addition', () => {
    const after = new Map(before);
    const town = before.get('town/addison');
    if (!town) throw new Error('fixture');
    after.set('town/panton', { ...town, slug: 'town/panton', name: 'PANTON', aoe_org_id: 'T003' });

    const changes = diffRegistry(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.kind).toBe('added');
  });

  it('reports a closure distinctly from a modification', () => {
    const after = new Map(before);
    const su = before.get('su/addison-northwest');
    if (!su) throw new Error('fixture');
    after.set('su/addison-northwest', { ...su, effective_to: '2029-06-30', effective_to_basis: 'aoe_published' });

    const kinds = diffRegistry(before, after).map((c) => c.kind);
    expect(kinds).toContain('closed');
  });

  it('flags a record that vanished without a close date for human review', () => {
    const after = new Map(before);
    after.delete('town/vergennes');

    const changes = diffRegistry(before, after);
    expect(changes[0]?.kind).toBe('removed');
    expect(changes[0]?.detail).toMatch(/entities are closed, never deleted/);
  });

  it('names the fields that moved so a reviewer can scan the PR', () => {
    const after = new Map(before);
    const school = before.get('school/vergennes-union-high-school');
    if (!school) throw new Error('fixture');
    after.set('school/vergennes-union-high-school', { ...school, grades: ['7', '8', '9', '10', '11', '12'] });

    const change = diffRegistry(before, after)[0];
    expect(change?.kind).toBe('modified');
    expect(change?.fields).toContain('grades');
  });
});
