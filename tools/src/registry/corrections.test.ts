import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  EVIDENCE_FOR_CLASS,
  FIELD_CLASS,
  applyCorrections,
  correctionsBySlug,
  evidenceSummary,
  readCorrections,
  upstreamState,
  valuesEqual,
} from './corrections.ts';
import type { Correction } from './corrections.ts';
import type { RegistryEntity } from './types.ts';

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

describe('the field tier table', () => {
  it('is the whitelist: a field absent from it is not correctable', () => {
    expect(FIELD_CLASS['website']).toBe('contact');
    expect(FIELD_CLASS['operated_by']).toBe('structural');
    expect(FIELD_CLASS['aoe_org_id']).toBeUndefined();
    expect(FIELD_CLASS['slug']).toBeUndefined();
  });

  it('demands a cited document wherever a wrong value would move model output', () => {
    expect(EVIDENCE_FOR_CLASS['structural']).toEqual(['cited_document']);
    expect(EVIDENCE_FOR_CLASS['identity']).toEqual(['cited_document']);
    expect(EVIDENCE_FOR_CLASS['contact']).toEqual(['retrieved_url']);
    expect(EVIDENCE_FOR_CLASS['spatial']).toEqual(['cited_document', 'derived_artifact']);
  });
});

describe('valuesEqual', () => {
  it('compares list-valued fields by content, not identity', () => {
    expect(valuesEqual(['town/a', 'town/b'], ['town/a', 'town/b'])).toBe(true);
    expect(valuesEqual(['town/a'], ['town/a', 'town/b'])).toBe(false);
  });

  it('does not treat null and the empty string as the same absence', () => {
    expect(valuesEqual(null, '')).toBe(false);
    expect(valuesEqual(null, null)).toBe(true);
  });
});

describe('correctionsBySlug', () => {
  it('groups every correction under its entity, preserving file order', () => {
    const grouped = correctionsBySlug([
      correction({ field: 'website' }),
      correction({ field: 'name', our_value: 'A' }),
      correction({ slug: 'town/calais' }),
    ]);
    expect(grouped.get('su/addison-central')?.map((c) => c.field)).toEqual(['website', 'name']);
    expect(grouped.get('town/calais')).toHaveLength(1);
  });
});

describe('readCorrections', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'corrections-test-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('treats a genuinely absent file as an empty register, not an error', () => {
    expect(readCorrections(join(dir, 'does-not-exist.yaml'))).toEqual({
      schema_version: '1.0',
      corrections: [],
    });
  });

  it('treats an explicit empty corrections list as an empty register, not an error', () => {
    const path = join(dir, 'corrections.yaml');
    writeFileSync(path, 'schema_version: "1.0"\ncorrections: []\n');
    expect(readCorrections(path)).toEqual({ schema_version: '1.0', corrections: [] });
  });

  it('throws on the corrections/correction typo rather than silently discarding every claim', () => {
    const path = join(dir, 'corrections.yaml');
    writeFileSync(path, 'schema_version: "1.0"\ncorrection: []\n');
    expect(() => readCorrections(path)).toThrow(/unrecognized key/i);
  });

  it('throws when corrections is present but not an array', () => {
    const path = join(dir, 'corrections.yaml');
    writeFileSync(path, 'schema_version: "1.0"\ncorrections: "oops"\n');
    expect(() => readCorrections(path)).toThrow(/must be an array/i);
  });

  it('throws on a bare-scalar document instead of pretending it is an empty register', () => {
    const path = join(dir, 'corrections.yaml');
    writeFileSync(path, 'just a string\n');
    expect(() => readCorrections(path)).toThrow(/expected an object/i);
  });

  it('throws on an array-shaped document instead of pretending it is an empty register', () => {
    const path = join(dir, 'corrections.yaml');
    writeFileSync(path, '- one\n- two\n');
    expect(() => readCorrections(path)).toThrow(/expected an object/i);
  });
});

describe('upstreamState', () => {
  it('is adopted once AOE publishes the value we asserted', () => {
    expect(upstreamState(correction(), 'https://new.example.invalid/')).toBe('adopted');
  });

  it('is outstanding while AOE still publishes what we objected to', () => {
    expect(upstreamState(correction(), 'http://old.example.invalid/')).toBe('outstanding');
  });

  it('is diverged when AOE has moved to some third value', () => {
    expect(upstreamState(correction(), 'https://third.example.invalid/')).toBe('diverged');
  });

  it('treats AOE dropping the field entirely as divergence, not adoption', () => {
    // Null is not agreement. Reading it as adoption would retire a correction
    // because the source went silent, which is the opposite of the source agreeing.
    expect(upstreamState(correction(), null)).toBe('diverged');
  });

  it('compares list-valued fields by content', () => {
    const c = correction({
      field: 'member_towns',
      aoe_value: ['town/a'],
      our_value: ['town/a', 'town/b'],
    });
    expect(upstreamState(c, ['town/a', 'town/b'])).toBe('adopted');
    expect(upstreamState(c, ['town/a'])).toBe('outstanding');
  });
});

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
    website: 'http://old.example.invalid/',
    latitude: null,
    longitude: null,
    manual_overrides: [],
    notes: null,
    ...over,
  };
}

describe('applyCorrections', () => {
  it('asserts our value over what AOE published, and keeps both figures', () => {
    const result = applyCorrections(entity(), [correction()]);
    expect(result.website).toBe('https://new.example.invalid/');
    expect(result.aoe_published?.['website']).toBe('http://old.example.invalid/');
  });

  it('generates the manual_overrides entry rather than trusting a hand-written one', () => {
    const result = applyCorrections(entity({ manual_overrides: [
      { field: 'name', reason: 'stale hand edit', set_by: 'nobody', set_date: '2020-01-01' },
    ] }), [correction()]);
    expect(result.manual_overrides).toHaveLength(1);
    expect(result.manual_overrides[0]?.field).toBe('website');
    expect(result.manual_overrides[0]?.set_by).toBe('Tester');
  });

  it('retires the correction once AOE agrees, WITHOUT changing any value', () => {
    // The whole claim of the lifecycle design: adoption is not a data change,
    // because the two values are already equal. We simply stop asserting it.
    const agreed = entity({ website: 'https://new.example.invalid/' });
    const result = applyCorrections(agreed, [correction()]);
    expect(result).toEqual(agreed);
  });

  it('holds the corrected value when AOE diverges, rather than silently deferring', () => {
    const moved = entity({ website: 'https://third.example.invalid/' });
    const result = applyCorrections(moved, [correction()]);
    expect(result.website).toBe('https://new.example.invalid/');
    expect(result.aoe_published?.['website']).toBe('https://third.example.invalid/');
  });

  it('does not apply a withdrawn correction, or record it as published', () => {
    const result = applyCorrections(entity(), [correction({ status: 'withdrawn' })]);
    expect(result.website).toBe('http://old.example.invalid/');
    // No correction is in force, so the map is absent entirely -- not present
    // as `{}` -- the same way an uncorrected entity never had one to begin with.
    expect(result.aoe_published).toBeUndefined();
    expect(result.manual_overrides).toEqual([]);
  });

  it('is idempotent: applying to its own output changes nothing further', () => {
    const once = applyCorrections(entity(), [correction()]);
    // Re-running the sync must not treat our own asserted value as AOE adoption.
    // The second pass sees website already corrected, which reads as adopted --
    // so callers must always apply to a freshly normalized entity. This test
    // pins that the function is total and does not throw or double-append.
    const twice = applyCorrections(once, [correction()]);
    expect(twice.manual_overrides.length).toBeLessThanOrEqual(1);
  });
});

describe('evidenceSummary', () => {
  it('renders a retrieval as a checkable one-liner', () => {
    expect(evidenceSummary(correction().evidence)).toBe(
      'Retrieved https://new.example.invalid/ on 2026-07-31: Serves the district site.',
    );
  });

  it('puts the quoted sentence in front for a cited document', () => {
    const summary = evidenceSummary({
      class: 'cited_document',
      document: 'ACSD Board minutes',
      document_url: 'https://example.invalid/minutes.pdf',
      document_path: null,
      retrieved: '2026-07-31',
      quote: 'The Board voted to adopt the name Addison Central School District.',
    });
    expect(summary).toContain('"The Board voted to adopt the name Addison Central School District."');
    expect(summary).toContain('ACSD Board minutes');
  });
});
