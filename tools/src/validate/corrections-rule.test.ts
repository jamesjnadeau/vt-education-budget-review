import { describe, expect, it } from 'vitest';

import type { Snapshot } from '../registry/aoe-client.ts';
import type { Correction } from '../registry/corrections.ts';
import type { RegistryEntity } from '../registry/types.ts';
import { checkCorrections, type SnapshotReader } from './rules.ts';

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
    recipient: null,
    note: null,
    ...over,
  };
}

const FILE = 'registry/corrections.yaml';

/**
 * A stand-in for registry/raw/2026-07-29/. SU003's website sits on the
 * `organizations` endpoint and NOT on `supervisoryUnions`, which is how the
 * live API publishes it -- so a premise check that read only the first endpoint
 * carrying the record would report a website AOE does publish as absent, and
 * fail every true website claim in the register.
 */
const SNAPSHOT: Snapshot = {
  date: '2026-07-29',
  endpoints: {
    supervisoryUnions: [
      {
        ServerId: 6,
        Name: 'Addison Central Supervisory District',
        OrgID: 'SU003',
        OrgType: 'Supervisory Union (SU)',
        OperatedBy: 'SU003',
      },
    ],
    organizations: [
      {
        ServerId: 6,
        Name: 'Addison Central Supervisory District',
        OrgID: 'SU003',
        OrgType: 'Supervisory Union (SU)',
        OperatedBy: 'SU003',
        Website: 'http://old.example.invalid/',
        MailingCity: 'Middlebury',
        Latitude: '44.0153',
        Longitude: null,
      },
    ],
  },
};

/** Only 2026-07-29 exists, so any other date is a claim citing a missing record. */
const SNAPSHOTS: SnapshotReader = (date) => (date === SNAPSHOT.date ? SNAPSHOT : null);

function run(cs: readonly Correction[], e = entity(), snapshots: SnapshotReader = SNAPSHOTS) {
  return checkCorrections(cs, FILE, new Map([[e.slug, e]]), snapshots);
}

describe('checkCorrections', () => {
  it('passes a correction that is applied and still outstanding', () => {
    expect(run([correction()])).toEqual([]);
  });

  it('rejects a correction against an entity that does not exist', () => {
    const findings = run([correction({ slug: 'su/nowhere' })]);
    expect(findings.map((f) => f.rule)).toContain('correction-unknown-entity');
  });

  it('flags a sent correction that records no recipient', () => {
    const findings = run([
      correction({ status: 'sent', sent_date: '2026-07-31', recipient: null }),
    ]);
    expect(findings.map((f) => f.rule)).toContain('correction-sent-incomplete');
  });

  it('flags a sent correction that records no sent_date', () => {
    const findings = run([
      correction({ status: 'sent', sent_date: null, recipient: 'data@vermont.gov' }),
    ]);
    expect(findings.map((f) => f.rule)).toContain('correction-sent-incomplete');
  });

  it('accepts a sent correction that records both recipient and date', () => {
    const findings = run([
      correction({ status: 'sent', sent_date: '2026-07-31', recipient: 'data@vermont.gov' }),
    ]);
    expect(findings.map((f) => f.rule)).not.toContain('correction-sent-incomplete');
  });

  it('refuses to correct the field that identifies the record', () => {
    const findings = run([correction({ field: 'aoe_org_id', our_value: 'SU999' })]);
    expect(findings[0]?.rule).toBe('correction-uncorrectable-field');
    expect(findings[0]?.severity).toBe('error');
  });

  it('refuses a structural claim carrying only a retrieved URL', () => {
    // operated_by moves model output. A URL is not the standard for that.
    const findings = run([
      correction({ field: 'operated_by', aoe_value: null, our_value: 'ud/somewhere' }),
    ]);
    expect(findings.map((f) => f.rule)).toContain('correction-evidence-tier');
  });

  it('accepts a structural claim carrying a cited document', () => {
    const e = entity({
      operated_by: 'ud/somewhere',
      aoe_published: { operated_by: null },
    });
    const findings = run(
      [
        correction({
          field: 'operated_by',
          aoe_value: null,
          our_value: 'ud/somewhere',
          evidence: {
            class: 'cited_document',
            document: 'Act 170 merger order',
            document_url: 'https://example.invalid/order.pdf',
            document_path: null,
            retrieved: '2026-07-31',
            quote: 'The district shall be operated by the union district effective July 1, 2026.',
          },
        }),
      ],
      e,
    );
    expect(findings).toEqual([]);
  });

  it('errors when AOE has moved to a third value', () => {
    const e = entity({ aoe_published: { website: 'https://third.example.invalid/' } });
    const findings = run([correction()], e);
    expect(findings[0]?.rule).toBe('correction-diverged');
    expect(findings[0]?.severity).toBe('error');
  });

  it('warns, rather than errors, when the sync has simply not been run yet', () => {
    const e = entity({ website: 'http://old.example.invalid/', aoe_published: {} });
    const findings = run([correction()], e);
    expect(findings[0]?.rule).toBe('correction-unapplied');
    expect(findings[0]?.severity).toBe('warning');
  });

  it('says nothing about a correction AOE has adopted', () => {
    const e = entity({ website: 'https://new.example.invalid/', aoe_published: {} });
    expect(run([correction()], e)).toEqual([]);
  });

  it('rejects a claim the snapshot it names never supported', () => {
    // The premise check. Without it this reads only as correction-diverged
    // against today's value, whose message blames AOE for moving on when in
    // fact the claim was never true.
    const findings = run([correction({ aoe_value: 'http://never-published.invalid/' })]);
    expect(findings[0]?.rule).toBe('correction-false-premise');
    expect(findings[0]?.severity).toBe('error');
    // Both figures, so the author can see which one to fix.
    expect(findings[0]?.message).toContain('http://never-published.invalid/');
    expect(findings[0]?.message).toContain('http://old.example.invalid/');
  });

  it('reads the premise from whichever endpoint publishes the field', () => {
    // SU003's Website is on `organizations` only; the type-specific endpoint
    // carries the same org with no website at all.
    expect(run([correction()])).toEqual([]);
  });

  it('rejects a claim citing a snapshot that is not in the repository', () => {
    // A premise whose provenance record does not exist cannot be checked by
    // anyone, now or later, which is a failure of the same kind as a false one.
    const findings = run([correction({ aoe_value_observed: '2019-01-01' })]);
    expect(findings[0]?.rule).toBe('correction-snapshot-missing');
    expect(findings[0]?.severity).toBe('error');
    expect(findings[0]?.message).toContain('registry/raw/2019-01-01/');
  });

  it('rejects a claim about an organization the named snapshot does not list', () => {
    const e = entity({ aoe_org_id: 'SU999' });
    const findings = run([correction()], e);
    expect(findings[0]?.rule).toBe('correction-false-premise');
    expect(findings[0]?.message).toContain('no record for SU999');
  });

  it('compares a coordinate numerically, since the API publishes it as a string', () => {
    // The snapshot holds Latitude: "44.0153"; the correction holds 44.0153.
    // Compared as strings, every true coordinate claim would read as false.
    const surveyed = (over: Partial<Correction>) =>
      correction({
        field: 'latitude',
        our_value: 44.5,
        evidence: {
          class: 'cited_document',
          document: 'Town survey plat',
          document_url: 'https://example.invalid/plat.pdf',
          document_path: null,
          retrieved: '2026-07-31',
          quote: 'The building corner is set at latitude 44.5000 N.',
        },
        ...over,
      });
    const e = entity({ latitude: 44.5, aoe_published: { latitude: 44.0153 } });
    expect(run([surveyed({ aoe_value: 44.0153 })], e)).toEqual([]);
    expect(run([surveyed({ aoe_value: 44.9 })], e).map((f) => f.rule)).toContain(
      'correction-false-premise',
    );
  });

  it('does not attempt a premise it cannot read: the relationship fields are skipped', () => {
    // operated_by comes out of the type-dependent ParentOrg/OperatedBy decoding
    // sync.ts warns against re-implementing, so it is deliberately absent from
    // RAW_KEY_FOR_FIELD. This claim contradicts the snapshot's raw OperatedBy
    // outright and must still pass: an unchecked premise is the decision here,
    // not a check that quietly reads the wrong field.
    const e = entity({
      operated_by: 'ud/somewhere',
      aoe_published: { operated_by: null },
    });
    const findings = run(
      [
        correction({
          field: 'operated_by',
          aoe_value: null,
          our_value: 'ud/somewhere',
          evidence: {
            class: 'cited_document',
            document: 'Act 170 merger order',
            document_url: 'https://example.invalid/order.pdf',
            document_path: null,
            retrieved: '2026-07-31',
            quote: 'The district shall be operated by the union district effective July 1, 2026.',
          },
        }),
      ],
      e,
    );
    expect(findings).toEqual([]);
  });

  it('blames AOE for divergence only where the premise was actually confirmed', () => {
    const e = entity({ aoe_published: { website: 'https://third.example.invalid/' } });
    const [checkable] = run([correction()], e);
    expect(checkable?.rule).toBe('correction-diverged');
    expect(checkable?.message).toContain('has moved on');

    // member_towns has no readable premise, so the message must offer both
    // explanations rather than asserting the one it cannot distinguish.
    const su = entity({
      member_towns: ['town/a', 'town/b'],
      aoe_published: { member_towns: ['town/c'] },
    });
    const [unreadable] = run(
      [
        correction({
          field: 'member_towns',
          aoe_value: ['town/a'],
          our_value: ['town/a', 'town/b'],
          evidence: {
            class: 'cited_document',
            document: 'Act 170 merger order',
            document_url: 'https://example.invalid/order.pdf',
            document_path: null,
            retrieved: '2026-07-31',
            quote: 'The towns of A and B shall constitute the district.',
          },
        }),
      ],
      su,
    );
    expect(unreadable?.rule).toBe('correction-diverged');
    expect(unreadable?.message).toContain('never true');
  });

  it('says so when the entity carries no AOE id to look the snapshot record up by', () => {
    // Never produced by the sync -- every entity it writes is keyed on the org
    // ID -- so this is a hand-edited record. It must not pass silently: a
    // premise nobody can examine is not a premise that held.
    // The key is REMOVED rather than set to undefined: `aoe_org_id` is an
    // optional property, so absence is its only spelling for "no AOE ID" and
    // there is no second one that could mean something subtly different.
    const { aoe_org_id: _absent, ...withoutOrgId } = entity();
    const findings = run([correction()], withoutOrgId);
    expect(findings[0]?.rule).toBe('correction-premise-uncheckable');
    expect(findings[0]?.severity).toBe('error');
  });

  it('catches two corrections claiming the same field', () => {
    const findings = run([correction(), correction({ our_value: 'https://other.invalid/' })]);
    expect(findings.map((f) => f.rule)).toContain('correction-duplicate');
  });

  it('ignores a withdrawn correction entirely', () => {
    const e = entity({ website: 'http://old.example.invalid/', aoe_published: {} });
    expect(run([correction({ status: 'withdrawn' })], e)).toEqual([]);
  });

  it('refuses a correction naming a field the entity type does not carry', () => {
    const e = entity({ type: 'town' });
    const findings = run(
      [
        correction({
          field: 'municipality',
          aoe_value: null,
          our_value: 'town/addison',
          evidence: {
            class: 'cited_document',
            document: 'Town clerk letter',
            document_url: null,
            document_path: '/tmp/letter.pdf',
            retrieved: '2026-07-31',
            quote: 'This parcel lies within the town of Addison.',
          },
        }),
      ],
      e,
    );
    expect(findings[0]?.rule).toBe('correction-field-not-on-entity');
    expect(findings[0]?.severity).toBe('error');
  });

  it('does not mistake a field that exists but is null for a field the entity lacks', () => {
    const e = entity({
      type: 'school',
      operated_by: null,
      aoe_published: { operated_by: null },
    });
    const findings = run(
      [
        correction({
          field: 'operated_by',
          aoe_value: null,
          our_value: 'ud/somewhere',
          evidence: {
            class: 'cited_document',
            document: 'Act 170 merger order',
            document_url: 'https://example.invalid/order.pdf',
            document_path: null,
            retrieved: '2026-07-31',
            quote: 'The district shall be operated by the union district effective July 1, 2026.',
          },
        }),
      ],
      e,
    );
    expect(findings.map((f) => f.rule)).not.toContain('correction-field-not-on-entity');
  });

  it('skips a correction missing evidence rather than crashing on it', () => {
    // Schema validation and this rule run over the SAME data, and this rule
    // cannot assume the schema passed -- schemaFindings already reports a
    // missing `evidence` precisely, so this must neither crash reading
    // `c.evidence.class` nor add a second, less useful finding of its own.
    const { evidence: _evidence, ...withoutEvidence } = correction();
    const bad = withoutEvidence as unknown as Correction;
    expect(() => run([bad])).not.toThrow();
    expect(run([bad])).toEqual([]);
  });

  it('skips a correction missing slug, field, or status rather than crashing on it', () => {
    const { slug: _slug, ...withoutSlug } = correction();
    const { field: _field, ...withoutField } = correction();
    const { status: _status, ...withoutStatus } = correction();
    const bad = [withoutSlug, withoutField, withoutStatus].map(
      (c) => c as unknown as Correction,
    );
    expect(() => run(bad)).not.toThrow();
    expect(run(bad)).toEqual([]);
  });
});
