import { describe, expect, it } from 'vitest';

import type { Correction } from './corrections.ts';
import type { RegistryEntity } from './types.ts';
import { buildCsv, buildReport, csvField, formatValue, reportRows } from './corrections-report.ts';

function entity(over: Partial<RegistryEntity> = {}): RegistryEntity {
  return {
    slug: 'su/addison-central',
    name: 'Addison Central Supervisory District',
    type: 'su',
    aoe_org_id: 'SU003',
    aoe_server_id: 6,
    edfi_id: 9003,
    effective_from: '2026-07-29',
    effective_from_basis: 'first_observed',
    effective_to: null,
    effective_to_basis: 'unknown',
    successor: null,
    successor_basis: null,
    supervisory_union: null,
    operated_by: null,
    reporting_only: false,
    member_towns: [],
    grades: [],
    website: 'https://new.example.invalid/',
    aoe_published: { website: 'http://old.example.invalid/' },
    latitude: null,
    longitude: null,
    manual_overrides: [],
    notes: null,
    ...over,
  };
}

function correction(over: Partial<Correction> = {}): Correction {
  return {
    slug: 'su/addison-central',
    field: 'website',
    aoe_value: 'http://old.example.invalid/',
    aoe_value_observed: '2026-07-29',
    our_value: 'https://new.example.invalid/',
    evidence: {
      class: 'retrieved_url',
      url: 'https://new.example.invalid/',
      retrieved: '2026-07-31',
      observation: 'Serves the district site.',
    },
    submitted_by: 'Tester',
    submitted_date: '2026-07-31',
    status: 'open',
    sent_date: null,
    note: null,
    ...over,
  };
}

const REGISTRY = new Map([[entity().slug, entity()]]);

const TOWN_A = entity({ slug: 'town/alpha', name: 'Alpha', type: 'town', aoe_org_id: 'T001' });
const TOWN_B = entity({ slug: 'town/beta', name: 'Beta', type: 'town', aoe_org_id: 'T002' });
const TOWN_REGISTRY = new Map([
  [TOWN_A.slug, TOWN_A],
  [TOWN_B.slug, TOWN_B],
]);

describe('formatValue', () => {
  it('renders a list of entity references as the AOE identifiers they name, not the slugs', () => {
    expect(formatValue(['town/alpha', 'town/beta'], TOWN_REGISTRY)).toBe('T001 — Alpha; T002 — Beta');
  });

  it('renders a scalar entity reference as its AOE identifier', () => {
    expect(formatValue('town/alpha', TOWN_REGISTRY)).toBe('T001 — Alpha');
  });

  it('renders a non-reference value verbatim', () => {
    expect(formatValue('https://new.example.invalid/', TOWN_REGISTRY)).toBe(
      'https://new.example.invalid/',
    );
  });

  it('flags a reference the registry cannot resolve rather than leaking the slug', () => {
    expect(formatValue('town/nowhere', TOWN_REGISTRY)).toBe('(organization not in the registry)');
  });

  it('says AOE published nothing rather than printing an empty cell', () => {
    expect(formatValue(null, TOWN_REGISTRY)).toBe('(none published)');
  });
});

describe('reportRows', () => {
  it('reports what AOE currently publishes as the old value', () => {
    const [row] = reportRows([correction()], REGISTRY);
    expect(row?.org_id).toBe('SU003');
    expect(row?.org_name).toBe('Addison Central Supervisory District');
    expect(row?.field_name).toBe('website');
    expect(row?.old_value).toBe('http://old.example.invalid/');
    expect(row?.new_value).toBe('https://new.example.invalid/');
  });

  it('omits withdrawn corrections', () => {
    expect(reportRows([correction({ status: 'withdrawn' })], REGISTRY)).toEqual([]);
  });

  it('omits corrections AOE has already adopted', () => {
    const adopted = entity({ website: 'https://new.example.invalid/', aoe_published: {} });
    expect(reportRows([correction()], new Map([[adopted.slug, adopted]]))).toEqual([]);
  });

  it('omits a correction whose our_value was edited to match the stale published snapshot', () => {
    // Simulates editing the register between syncs: aoe_published still carries
    // an old figure, but our_value has since been changed to agree with it.
    // upstreamState() must catch this as adopted even though the map entry is
    // still present -- without that guard this would present a no-op edit to
    // AOE as an outstanding ask.
    const e = entity({ aoe_published: { website: 'https://weird-edit.example.invalid/' } });
    const c = correction({ our_value: 'https://weird-edit.example.invalid/' });
    expect(reportRows([c], new Map([[e.slug, e]]))).toEqual([]);
  });

  it('dates a derived_artifact correction by submission, since that evidence class has no retrieval date', () => {
    const e = entity({
      municipality: 'town/alpha',
      aoe_published: { municipality: null },
    });
    const c = correction({
      field: 'municipality',
      aoe_value: null,
      our_value: 'town/alpha',
      submitted_date: '2026-07-30',
      evidence: {
        class: 'derived_artifact',
        path: 'derived/school-municipality/addison-central.json',
        provenance_sha256: 'abcdef0123456789',
        observation: 'Point-in-polygon match against the town boundary.',
      },
    });
    const registry = new Map([[e.slug, e], [TOWN_A.slug, TOWN_A]]);
    const [row] = reportRows([c], registry);
    expect(row?.checked_date).toBe('2026-07-30');
  });
});

describe('buildReport', () => {
  it('identifies each organization the way AOE does, never by our slug', () => {
    const md = buildReport([correction()], REGISTRY, '2026-07-31');
    expect(md).toContain('SU003');
    expect(md).toContain('Addison Central Supervisory District');
    // The recipient works in AOE's systems. "su/addison-central" means nothing there.
    expect(md).not.toContain('su/addison-central');
  });

  it('carries the evidence, so the claim is checkable without replying', () => {
    const md = buildReport([correction()], REGISTRY, '2026-07-31');
    expect(md).toContain('Retrieved https://new.example.invalid/ on 2026-07-31');
  });

  it('renders a member_towns correction by the towns\' AOE identifiers, not their slugs', () => {
    const su = entity({
      member_towns: ['town/alpha', 'town/beta'],
      aoe_published: { member_towns: ['town/alpha'] },
    });
    const c = correction({
      field: 'member_towns',
      aoe_value: ['town/alpha'],
      our_value: ['town/alpha', 'town/beta'],
    });
    const registry = new Map([[su.slug, su], [TOWN_A.slug, TOWN_A], [TOWN_B.slug, TOWN_B]]);
    const md = buildReport([c], registry, '2026-07-31');
    expect(md).toContain('T001');
    expect(md).toContain('T002');
    expect(md).not.toContain('town/');
  });

  it('renders an operated_by correction by the district\'s AOE identifier, not its slug', () => {
    const oldUd = entity({ slug: 'ud/old-district', name: 'Old Union District', type: 'ud', aoe_org_id: 'U001' });
    const newUd = entity({
      slug: 'ud/washington-central',
      name: 'Washington Central USD',
      type: 'ud',
      aoe_org_id: 'U045',
    });
    const town = entity({
      slug: 'town/gamma',
      name: 'Gamma',
      type: 'town',
      aoe_org_id: 'T003',
      operated_by: 'ud/washington-central',
      aoe_published: { operated_by: 'ud/old-district' },
    });
    const c = correction({
      slug: 'town/gamma',
      field: 'operated_by',
      aoe_value: 'ud/old-district',
      our_value: 'ud/washington-central',
    });
    const registry = new Map([
      [town.slug, town],
      [oldUd.slug, oldUd],
      [newUd.slug, newUd],
    ]);
    const md = buildReport([c], registry, '2026-07-31');
    expect(md).toContain('U001');
    expect(md).toContain('U045');
    expect(md).not.toContain('ud/');
  });

  it('thanks AOE for what they have already adopted', () => {
    const adopted = entity({ website: 'https://new.example.invalid/', aoe_published: {} });
    const md = buildReport([correction({ status: 'sent' })], new Map([[adopted.slug, adopted]]), '2026-07-31');
    expect(md).toContain('Adopted since the last report');
    expect(md).toContain('SU003');
  });

  it('says so plainly when there is nothing to report', () => {
    expect(buildReport([], REGISTRY, '2026-07-31')).toContain('No open corrections');
  });
});

describe('csvField', () => {
  it('leaves an ordinary value alone', () => {
    expect(csvField('website')).toBe('website');
  });

  it('quotes a value containing a comma', () => {
    expect(csvField('Barre, Vermont')).toBe('"Barre, Vermont"');
  });

  it('doubles an embedded quote, per RFC 4180', () => {
    // Board-document titles will hit this; a naive escape corrupts the file.
    expect(csvField('The Board voted "aye"')).toBe('"The Board voted ""aye"""');
  });

  it('quotes a value containing a newline', () => {
    expect(csvField('line one\nline two')).toBe('"line one\nline two"');
  });
});

describe('buildCsv', () => {
  it('leads with AOE’s identifiers, then the three requested columns', () => {
    const csv = buildCsv([correction()], REGISTRY);
    const [header] = csv.split('\r\n');
    expect(header).toBe(
      'org_id,org_name,field_name,old_value,new_value,evidence,checked_date,status',
    );
  });

  it('writes one row per open correction, keyed on the OrgID', () => {
    const csv = buildCsv([correction()], REGISTRY);
    const rows = csv.trim().split('\r\n');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toContain('SU003');
    expect(rows[1]).toContain('http://old.example.invalid/');
    expect(rows[1]).toContain('https://new.example.invalid/');
    expect(csv).not.toContain('su/addison-central');
  });

  it('emits a header and nothing else when there is nothing to report', () => {
    expect(buildCsv([], REGISTRY).trim().split('\r\n')).toHaveLength(1);
  });
});
