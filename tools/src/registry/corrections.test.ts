import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EVIDENCE_FOR_CLASS, FIELD_CLASS, correctionsBySlug, readCorrections, valuesEqual } from './corrections.ts';
import type { Correction } from './corrections.ts';

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
