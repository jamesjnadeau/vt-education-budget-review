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

  it('names a source slug as the publisher it is, rather than printing it or hunting for it', () => {
    // `source/` is the one prefix in the shared pattern with no registry record
    // behind it, so the resolution path would report it as a missing
    // organization -- a wrong answer, not just an unhelpful one. It is excluded
    // explicitly here rather than by importing a pattern that omits it, and it
    // is still never printed: no repo-internal identifier gets past formatValue.
    expect(formatValue('source/aoe-adm', TOWN_REGISTRY)).toBe('(a data source, not an organization)');
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

/**
 * Anything that names a file or a record inside THIS repository: a path into a
 * committed directory, or a registry slug of any entity type (including
 * `source/`, which the report never resolves). Returns the offending text so a
 * failure says what leaked, not merely that something did.
 */
function repoInternalIn(rendered: string): string | null {
  const pattern = new RegExp(
    `\\b(?:derived|intake|warehouse|registry|collectors|schemas|model|tools)/` +
      `|\\b(?:${['su', 'sd', 'ud', 'school', 'town', 'academy', 'techcenter', 'independent', 'state', 'source'].join('|')})/[a-z0-9]+(?:-[a-z0-9]+)*`,
  );
  return pattern.exec(rendered)?.[0] ?? null;
}

const OPERATED_BY_OLD = entity({
  slug: 'ud/old-district',
  name: 'Old Union District',
  type: 'ud',
  aoe_org_id: 'U001',
});
const OPERATED_BY_NEW = entity({
  slug: 'ud/washington-central',
  name: 'Washington Central USD',
  type: 'ud',
  aoe_org_id: 'U045',
});
const OPERATED_BY_TOWN = entity({
  slug: 'town/gamma',
  name: 'Gamma',
  type: 'town',
  aoe_org_id: 'T003',
  operated_by: 'ud/washington-central',
  aoe_published: { operated_by: 'ud/old-district' },
});
const OPERATED_BY_CORRECTION = correction({
  slug: 'town/gamma',
  field: 'operated_by',
  aoe_value: 'ud/old-district',
  our_value: 'ud/washington-central',
  evidence: {
    class: 'cited_document',
    document: 'Act 170 merger order',
    document_url: 'https://example.invalid/order.pdf',
    document_path: null,
    retrieved: '2026-07-31',
    quote: 'The town shall be served by Washington Central USD effective July 1, 2026.',
  },
});
const OPERATED_BY_REGISTRY = new Map([
  [OPERATED_BY_TOWN.slug, OPERATED_BY_TOWN],
  [OPERATED_BY_OLD.slug, OPERATED_BY_OLD],
  [OPERATED_BY_NEW.slug, OPERATED_BY_NEW],
]);

/** The spatial case: the sanctioned evidence for it is a path into derived/. */
const DERIVED_SCHOOL = entity({
  slug: 'school/alpha-elementary',
  name: 'Alpha Elementary School',
  type: 'school',
  aoe_org_id: 'PS100',
  municipality: 'town/alpha',
  aoe_published: { municipality: null },
});
const DERIVED_CORRECTION = correction({
  slug: 'school/alpha-elementary',
  field: 'municipality',
  aoe_value: null,
  our_value: 'town/alpha',
  evidence: {
    class: 'derived_artifact',
    path: 'derived/school-municipality/vt.yaml',
    provenance_sha256: 'a'.repeat(64),
    observation: 'Point-in-polygon match against the town boundary.',
  },
});
const DERIVED_REGISTRY = new Map([
  [DERIVED_SCHOOL.slug, DERIVED_SCHOOL],
  [TOWN_A.slug, TOWN_A],
]);

/** A correction of every shape that has ever leaked, or could. */
const RENAMED = entity({
  name: 'Addison Central School District',
  aoe_published: {
    name: 'Addison Central Supervisory District',
    member_towns: ['town/alpha'],
  },
  member_towns: ['town/alpha', 'town/beta'],
});
const EVERY_KIND_OF_CORRECTION: readonly Correction[] = [
  correction({
    field: 'name',
    aoe_value: 'Addison Central Supervisory District',
    our_value: 'Addison Central School District',
    evidence: {
      class: 'cited_document',
      document: 'ACSD Board minutes, 12 May 2026',
      document_url: null,
      document_path: 'intake/acsd/2026-05-minutes.pdf',
      retrieved: '2026-07-31',
      quote: 'The Board voted to adopt the name Addison Central School District.',
    },
  }),
  correction({
    field: 'member_towns',
    aoe_value: ['town/alpha'],
    our_value: ['town/alpha', 'town/beta'],
    evidence: {
      class: 'cited_document',
      document: 'Act 170 merger order',
      document_url: 'https://example.invalid/order.pdf',
      document_path: null,
      retrieved: '2026-07-31',
      quote: 'Alpha and Beta shall constitute the district.',
    },
  }),
  OPERATED_BY_CORRECTION,
  DERIVED_CORRECTION,
];
const EVERY_KIND_OF_REGISTRY = new Map([
  [RENAMED.slug, RENAMED],
  [TOWN_A.slug, TOWN_A],
  [TOWN_B.slug, TOWN_B],
  [DERIVED_SCHOOL.slug, DERIVED_SCHOOL],
  [OPERATED_BY_TOWN.slug, OPERATED_BY_TOWN],
  [OPERATED_BY_OLD.slug, OPERATED_BY_OLD],
  [OPERATED_BY_NEW.slug, OPERATED_BY_NEW],
]);

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
  });

  it('renders an operated_by correction by the district\'s AOE identifier, not its slug', () => {
    const md = buildReport([OPERATED_BY_CORRECTION], OPERATED_BY_REGISTRY, '2026-07-31');
    expect(md).toContain('U001');
    expect(md).toContain('U045');
  });

  it('heads a name correction with the name AOE publishes, not the one we propose', () => {
    // The sync has ALREADY patched entity.name to our_value by the time the
    // report runs -- that is what applying a correction means. Heading the item
    // with it would identify the organization to the steward by a name their
    // system has never held, above a body reading "Currently published: <the
    // name they do hold>", and they could not find the record.
    const renamed = entity({
      name: 'Addison Central School District',
      aoe_published: { name: 'Addison Central Supervisory District' },
    });
    const c = correction({
      field: 'name',
      aoe_value: 'Addison Central Supervisory District',
      our_value: 'Addison Central School District',
      evidence: {
        class: 'cited_document',
        document: 'ACSD Board minutes, 12 May 2026',
        document_url: 'https://example.invalid/minutes.pdf',
        document_path: null,
        retrieved: '2026-07-31',
        quote: 'The Board voted to adopt the name Addison Central School District.',
      },
    });
    const md = buildReport([c], new Map([[renamed.slug, renamed]]), '2026-07-31');

    expect(md).toContain('**SU003 — Addison Central Supervisory District**');
    // The body still carries both figures: that is the entire ask.
    expect(md).toContain('- Currently published: Addison Central Supervisory District');
    expect(md).toContain('- Suggested: Addison Central School District');
  });

  it('cites an internal document by title and offers the record, rather than by its path', () => {
    const e = entity({
      name: 'Addison Central School District',
      aoe_published: { name: 'Addison Central Supervisory District' },
    });
    const c = correction({
      field: 'name',
      aoe_value: 'Addison Central Supervisory District',
      our_value: 'Addison Central School District',
      evidence: {
        class: 'cited_document',
        document: 'ACSD Board minutes, 12 May 2026',
        document_url: null,
        document_path: 'intake/acsd/2026-05-minutes.pdf',
        retrieved: '2026-07-31',
        quote: 'The Board voted to adopt the name Addison Central School District.',
      },
    });
    const md = buildReport([c], new Map([[e.slug, e]]), '2026-07-31');
    expect(md).toContain('ACSD Board minutes, 12 May 2026');
    expect(md).toContain('"The Board voted to adopt the name Addison Central School District."');
    expect(md).toContain('on request');
  });

  it('describes a derived artifact instead of naming its path and provenance hash', () => {
    const md = buildReport([DERIVED_CORRECTION], DERIVED_REGISTRY, '2026-07-31');
    expect(md).toContain('Point-in-polygon match against the town boundary.');
    expect(md).toContain('Computed by us');
    expect(md).not.toContain('a'.repeat(12));
  });

  it('leaks nothing repo-internal, anywhere in the document', () => {
    // ONE assertion over the whole rendered report, replacing four
    // field-by-field negatives. The invariant is a single sentence -- nothing
    // that identifies a file or a record in THIS repository reaches AOE -- and
    // the specific negatives kept passing while new routes to the same leak
    // opened: first a corrected slug-valued field, then an evidence locator.
    // Anything that carries the leak reaches this assertion by construction.
    const md = buildReport(EVERY_KIND_OF_CORRECTION, EVERY_KIND_OF_REGISTRY, '2026-07-31');
    expect(repoInternalIn(md)).toBeNull();
  });

  it('leaks nothing repo-internal into the CSV either', () => {
    // Same invariant, same rows, the other output. The CSV is a file someone
    // forwards; if anything, it travels further than the email body.
    expect(repoInternalIn(buildCsv(EVERY_KIND_OF_CORRECTION, EVERY_KIND_OF_REGISTRY))).toBeNull();
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
