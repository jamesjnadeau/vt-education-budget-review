import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PATHS } from '../paths.ts';
import type { AoeRawRecord, Snapshot } from './aoe-client.ts';
import { orgId } from './aoe-client.ts';
import type { Correction } from './corrections.ts';
import {
  ENTITY_REF,
  ENTITY_REF_PATTERN,
  SOURCE_REF,
  assignSlug,
  entityTypeFromOrgType,
  makeSlug,
  slugifyName,
} from './slugs.ts';
import { diffRegistry, normalizeSnapshot, relationshipsFor } from './sync.ts';

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

describe('the entity-reference pattern', () => {
  it('matches every prefix the slug table can mint, and the source prefix', () => {
    expect(ENTITY_REF.test('su/addison-central')).toBe(true);
    expect(ENTITY_REF.test('ud/addison-central-uusd-55')).toBe(true);
    expect(ENTITY_REF.test('techcenter/patricia-hannaford')).toBe(true);
    expect(ENTITY_REF.test('source/aoe-adm')).toBe(true);
    expect(ENTITY_REF.test('https://example.invalid/')).toBe(false);
    expect(ENTITY_REF.test('Addison Central Supervisory District')).toBe(false);
  });

  it('agrees, character for character, with the schema copy JSON Schema cannot import', () => {
    // The fourth copy. Three TypeScript copies were collapsed into ENTITY_REF;
    // this one cannot be, so it is pinned instead. Without this, adding an
    // entity type to TYPE_PREFIX would leave the schema rejecting slugs the
    // sync mints -- and, worse in the other direction, leave a pattern that
    // guards outgoing correspondence disagreeing with the pattern that defines
    // what a slug is.
    const common = JSON.parse(
      readFileSync(join(PATHS.schemas, 'common-1.0.schema.json'), 'utf8'),
    ) as { $defs: { entity_ref: { pattern: string } } };
    expect(common.$defs.entity_ref.pattern).toBe(ENTITY_REF_PATTERN);
  });

  it('exempts a source slug, which names a publisher with no registry record', () => {
    expect(SOURCE_REF.test('source/aoe-adm')).toBe(true);
    expect(SOURCE_REF.test('su/addison-central')).toBe(false);
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

  it('records a deliberately untracked org type as a decision, not a problem', () => {
    // A school district that is also a Head Start grantee carries a separate
    // HDS org ID. That typing is correct, and the district, its town and its
    // schools are tracked under their own records -- so skipping this is a
    // considered omission and must not be reported as an anomaly.
    const headStart = snapshotOf({
      organizations: [
        { ServerId: 1, Name: 'BRATTLEBORO TOWN SCHOOL DISTRICT', OrgID: 'HDS007', OrgType: 'Head Start (HDS)' },
      ],
    });
    const { entities, warnings, notTracked } = normalizeSnapshot(headStart, {
      existing: new Map(),
      today: '2026-07-29',
    });

    expect(entities).toHaveLength(0);
    expect(warnings).toHaveLength(0);
    expect(notTracked.join(' ')).toMatch(/Head Start grantees are early-childhood programs/);
  });

  it('warns loudly about an org type it has never seen', () => {
    const novel = snapshotOf({
      organizations: [{ ServerId: 1, Name: 'Something New', OrgID: 'ZQ001', OrgType: 'Regional Consortium (RC)' }],
    });
    const { entities, warnings, notTracked } = normalizeSnapshot(novel, {
      existing: new Map(),
      today: '2026-07-29',
    });

    expect(entities).toHaveLength(0);
    expect(notTracked).toHaveLength(0);
    expect(warnings.join(' ')).toMatch(/has not published before/);
  });

  it('drops placeholder records and says which and why', () => {
    // "Test" is a real entry in the live production API. Publishing it on a
    // public registry page invites a reader to doubt everything else here.
    const withTest = snapshotOf({
      ...SNAPSHOT.endpoints,
      independentSchools: [
        { ServerId: 9, Name: 'Test', OrgID: 'Test', OrgType: 'Distance Learning (IS)' },
      ],
    });
    const { entities, warnings } = normalizeSnapshot(withTest, {
      existing: new Map(),
      today: '2026-07-29',
    });

    expect(entities.some((e) => /test/i.test(e.name))).toBe(false);
    expect(warnings.join(' ')).toMatch(/skipped a placeholder record/);
    // The real records in the same snapshot are untouched.
    expect(entities.some((e) => e.slug === 'town/addison')).toBe(true);
  });

  it('keeps a reporting bucket but flags it and awards it no membership', () => {
    // AOE records residency for pupils whose town is not established against a
    // town named UNKNOWN. It stays, because other records reference it, but it
    // must never be counted as a town a district serves.
    const withBucket = snapshotOf({
      ...SNAPSHOT.endpoints,
      towns: [
        ...(SNAPSHOT.endpoints['towns'] ?? []),
        { ServerId: 1999, Name: 'UNKNOWN', OrgId: 'T300', OrgType: 'Towns/City (T)', ParentOrg: 'U054', OperatedBy: 'SU002' },
      ],
    });
    const { entities } = normalizeSnapshot(withBucket, { existing: new Map(), today: '2026-07-29' });

    const bucket = entities.find((e) => e.slug === 'town/unknown');
    expect(bucket).toBeDefined();
    expect(bucket?.reporting_only).toBe(true);

    const district = entities.find((e) => e.slug === 'ud/addison-northwest-54');
    expect(district?.member_towns).toEqual(['town/addison', 'town/vergennes']);
    expect(district?.member_towns).not.toContain('town/unknown');
  });

  it('does not let an entity be its own parent', () => {
    // Independent academies, tech centers and some state-run schools list
    // themselves in ParentOrg, exactly as supervisory unions do. Taken
    // literally that reads "this academy's supervisory union is itself",
    // which puts it inside its own hierarchy and would let a scenario merge an
    // entity with itself.
    const selfParented = snapshotOf({
      organizations: [
        { ServerId: 58, Name: 'BURR AND BURTON ACADEMY', OrgID: 'PA002', OrgType: 'Private Academy (PA)', ParentOrg: 'PA002' },
      ],
    });
    const { entities } = normalizeSnapshot(selfParented, { existing: new Map(), today: '2026-07-29' });
    const academy = entities.find((e) => e.slug === 'academy/burr-and-burton-academy');

    expect(academy).toBeDefined();
    expect(academy?.supervisory_union).toBeNull();
    expect(academy?.operated_by).toBeNull();
  });

  it('marks real towns as ordinary organizations', () => {
    const { entities } = normalizeSnapshot(SNAPSHOT, { existing: new Map(), today: '2026-07-29' });
    expect(entities.find((e) => e.slug === 'town/addison')?.reporting_only).toBe(false);
  });

  it('drops a placeholder arriving through the closed-organizations endpoint too', () => {
    const closedTest = snapshotOf({
      ...SNAPSHOT.endpoints,
      closedOrganizations: [
        { ServerId: 9, Name: 'Test', OrgID: 'Test', OrgType: 'Public School (PS)', CloseDate: '2020-06-30T07:00:00Z' },
      ],
    });
    const { entities } = normalizeSnapshot(closedTest, { existing: new Map(), today: '2026-07-29' });
    expect(entities.some((e) => /test/i.test(e.name))).toBe(false);
  });

  it('preserves values a human set by hand, via a correction', () => {
    // The API is a convenience layer, not a dependency. A deliberate human
    // correction, backed by evidence in the register, must survive the next
    // nightly sync -- the mechanism this test guards did not change even
    // though hand-writing `manual_overrides` on a prior entity no longer
    // does anything (that field is generated by applyCorrections now).
    const correction: Correction = {
      slug: 'town/addison',
      field: 'name',
      // What the fixture's raw record actually publishes -- see SNAPSHOT above.
      aoe_value: 'ADDISON',
      aoe_value_observed: '2026-07-29',
      our_value: 'Addison',
      evidence: {
        class: 'cited_document',
        document: 'AOE style guide, town names',
        document_url: null,
        document_path: null,
        retrieved: '2026-07-29',
        quote: 'Town names are conventionally cased, not published in all caps.',
      },
      submitted_by: 'jn',
      submitted_date: '2026-07-29',
      status: 'open',
      sent_date: null,
      recipient: null,
      note: null,
    };

    const { entities } = normalizeSnapshot(SNAPSHOT, {
      existing: new Map(),
      today: '2026-07-29',
      corrections: [correction],
    });
    const town = entities.find((e) => e.slug === 'town/addison');

    expect(town?.name).toBe('Addison');
    expect(town?.aoe_published?.['name']).toBe('ADDISON');
    expect(town?.manual_overrides).toHaveLength(1);
    // Fields not under a correction still track the API.
    expect(town?.supervisory_union).toBe('su/addison-northwest');
  });

  it('keeps a municipality correction in force across two syncs in a row', () => {
    // Regression pin: AOE publishes no municipality at all, ever -- the API
    // has no such field. `schoolFields` in sync.ts used to carry
    // `prior.municipality` forward the same way it does `geocode_precision`,
    // so on the SECOND sync the entity handed to `applyCorrections` already
    // carried OUR asserted value where AOE's silence belongs. `upstreamState`
    // then read that as AOE having agreed with a claim it never saw, and the
    // correction retired itself: `aoe_published` vanished, the override
    // count dropped to zero, and the value itself survived only as an
    // unattributed field still claiming a provenance it no longer had. Two
    // real syncs in a row, not one, is the only way to catch that -- a
    // single sync's "prior" is always empty and can't leak anything.
    const correction: Correction = {
      slug: 'school/vergennes-union-high-school',
      field: 'municipality',
      aoe_value: null,
      aoe_value_observed: '2026-07-29',
      our_value: 'town/vergennes',
      evidence: {
        class: 'derived_artifact',
        path: 'derived/school-municipality/vt-school-municipality.yaml',
        provenance_sha256: 'a'.repeat(64),
        observation: 'Point-in-polygon geocode places the building in Vergennes.',
      },
      submitted_by: 'jn',
      submitted_date: '2026-07-29',
      status: 'open',
      sent_date: null,
      recipient: null,
      note: null,
    };

    const first = normalizeSnapshot(SNAPSHOT, {
      existing: new Map(),
      today: '2026-07-29',
      corrections: [correction],
    });
    const school1 = first.entities.find((e) => e.slug === 'school/vergennes-union-high-school');
    expect(school1?.municipality).toBe('town/vergennes');
    expect(school1?.aoe_published?.['municipality']).toBeNull();
    expect(school1?.manual_overrides).toHaveLength(1);

    const existing = new Map(first.entities.map((e) => [e.slug, e]));
    const second = normalizeSnapshot(SNAPSHOT, {
      existing,
      today: '2027-01-01',
      corrections: [correction],
    });
    const school2 = second.entities.find((e) => e.slug === 'school/vergennes-union-high-school');

    expect(school2?.municipality).toBe('town/vergennes');
    expect(school2?.aoe_published?.['municipality']).toBeNull();
    expect(school2?.manual_overrides).toHaveLength(1);
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

  it('reports AOE diverging further on a corrected field, not just AOE adopting it', () => {
    // The event a correction most needs a human to see. While a correction is
    // outstanding we hold our own value throughout, so no OTHER diffed field
    // moves -- `website` here stays exactly what we asserted, both before and
    // after. Without `aoe_published` in DIFFED_FIELDS this produced "0
    // change(s)" in the changelog even though the committed file changed:
    // the one figure that says whether AOE has come around moved from one
    // published value to a different one, unseen.
    const su = before.get('su/addison-northwest');
    if (!su) throw new Error('fixture');

    const before2 = new Map(before);
    before2.set('su/addison-northwest', {
      ...su,
      website: 'https://corrected.example.invalid/',
      aoe_published: { website: 'http://old.example.invalid/' },
    });
    const after = new Map(before2);
    after.set('su/addison-northwest', {
      ...su,
      website: 'https://corrected.example.invalid/',
      aoe_published: { website: 'https://third.example.invalid/' },
    });

    const changes = diffRegistry(before2, after);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.kind).toBe('modified');
    expect(changes[0]?.fields).toContain('aoe_published');
    // The genuinely corrected field itself did not move -- only AOE's figure did.
    expect(changes[0]?.fields).not.toContain('website');
  });
});
