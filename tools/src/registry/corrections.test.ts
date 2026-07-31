import { describe, expect, it } from 'vitest';

import { EVIDENCE_FOR_CLASS, FIELD_CLASS, correctionsBySlug, valuesEqual } from './corrections.ts';
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
