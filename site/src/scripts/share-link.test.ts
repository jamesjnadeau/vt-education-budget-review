/**
 * The scenario <-> URL translation for the what-if tool's shareable links.
 *
 * The what-if form is entirely made of values a reader is supposing about a
 * district, so a link that reproduces those values must round-trip exactly and
 * must never assert a value the sharer left blank. This logic is pure so it can
 * be tested without a DOM; the island is thin glue over it (cf. statewide-average).
 */

import { describe, expect, it } from 'vitest';

import {
  SHARE_FIELDS,
  decodeScenario,
  encodeScenario,
  shareUrl,
  type Scenario,
} from './share-link.ts';

describe('SHARE_FIELDS', () => {
  it('leads with the parameter-mode selector', () => {
    expect(SHARE_FIELDS[0]).toEqual({ id: 'parameter-mode', param: 'mode' });
  });

  it('has unique ids and unique params', () => {
    const ids = SHARE_FIELDS.map((f) => f.id);
    const params = SHARE_FIELDS.map((f) => f.param);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(params).size).toBe(params.length);
  });
});

describe('encodeScenario', () => {
  it('emits one param per non-empty field, in registry order, using param names', () => {
    const scenario: Scenario = { spending: '3370000', 'parameter-mode': '2027', cla: '0.8' };
    // parameter-mode is first in SHARE_FIELDS, so mode leads regardless of insertion order.
    expect(encodeScenario(scenario)).toBe('mode=2027&spending=3370000&cla=0.8');
  });

  it('omits empty and whitespace-only values', () => {
    const scenario: Scenario = { spending: '3370000', cla: '', density: '   ' };
    expect(encodeScenario(scenario)).toBe('spending=3370000');
  });

  it('url-encodes text field values', () => {
    expect(encodeScenario({ 'small-school-name': 'Maple & Oak' })).toBe('school=Maple+%26+Oak');
  });

  it('returns an empty string for an empty scenario', () => {
    expect(encodeScenario({})).toBe('');
  });
});

describe('decodeScenario', () => {
  it('maps recognized params back to their DOM ids', () => {
    expect(decodeScenario('mode=2027&spending=3370000&cla=0.8')).toEqual({
      'parameter-mode': '2027',
      spending: '3370000',
      cla: '0.8',
    });
  });

  it('accepts a leading question mark', () => {
    expect(decodeScenario('?spending=3370000')).toEqual({ spending: '3370000' });
  });

  it('ignores unknown params', () => {
    expect(decodeScenario('spending=3370000&utm_source=twitter&junk=1')).toEqual({
      spending: '3370000',
    });
  });

  it('ignores empty param values', () => {
    expect(decodeScenario('spending=&cla=0.8')).toEqual({ cla: '0.8' });
  });

  it('decodes url-encoded text back to its original value', () => {
    expect(decodeScenario('school=Maple+%26+Oak')).toEqual({ 'small-school-name': 'Maple & Oak' });
  });

  it('returns an empty scenario for an empty query', () => {
    expect(decodeScenario('')).toEqual({});
  });
});

describe('round trip', () => {
  it('encode then decode yields the original non-empty values', () => {
    const scenario: Scenario = {
      'parameter-mode': 'example',
      'prek-1': '10',
      'small-school-name': 'A & B School',
      spending: '3370000',
      cla: '0.8',
      'capital-reserve': '50000',
      'bond-exclusion': '25000',
    };
    expect(decodeScenario(encodeScenario(scenario))).toEqual(scenario);
  });

  it('encodes Act 183 excess-spending fields with correct param names', () => {
    const scenario: Scenario = {
      'capital-reserve': '50000',
      'bond-exclusion': '25000',
    };
    expect(encodeScenario(scenario)).toBe('capital_reserve=50000&bond_exclusion=25000');
  });
});

describe('shareUrl', () => {
  it('appends the query to the base url', () => {
    expect(shareUrl('https://example.org/model', { spending: '3370000' })).toBe(
      'https://example.org/model?spending=3370000',
    );
  });

  it('returns the bare base url when the scenario is empty', () => {
    expect(shareUrl('https://example.org/model', {})).toBe('https://example.org/model');
  });
});
