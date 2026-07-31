import { describe, expect, it } from 'vitest';

import type { Correction } from './corrections.ts';
import type { RegistryEntity } from './types.ts';
import { buildReport, formatValue, reportRows } from './corrections-report.ts';

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

describe('formatValue', () => {
  it('renders a list-valued field as a readable list', () => {
    expect(formatValue(['town/a', 'town/b'])).toBe('town/a; town/b');
  });

  it('says AOE published nothing rather than printing an empty cell', () => {
    expect(formatValue(null)).toBe('(none published)');
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
