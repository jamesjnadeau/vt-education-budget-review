import { describe, expect, it } from 'vitest';

import type { Correction } from '../registry/corrections.ts';
import type { RegistryEntity } from '../registry/types.ts';
import { checkCorrections } from './rules.ts';

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

const FILE = 'registry/corrections.yaml';

function run(cs: readonly Correction[], e = entity()) {
  return checkCorrections(cs, FILE, new Map([[e.slug, e]]));
}

describe('checkCorrections', () => {
  it('passes a correction that is applied and still outstanding', () => {
    expect(run([correction()])).toEqual([]);
  });

  it('rejects a correction against an entity that does not exist', () => {
    const findings = run([correction({ slug: 'su/nowhere' })]);
    expect(findings.map((f) => f.rule)).toContain('correction-unknown-entity');
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
});
