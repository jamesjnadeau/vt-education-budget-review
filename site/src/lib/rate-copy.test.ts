import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { EXPLAIN, groupRateReason, showsGroupRateCard, showsTownRateNotes } from './rate-copy.ts';
import { buildJourney } from './journey.ts';

const levels = ['district', 'union', 'grouping'] as const;

describe('groupRateReason', () => {
  it.each(levels)('%s reason keeps the old wording out', (level) => {
    expect(groupRateReason(level)).not.toContain('sets ' + 'its own');
  });

  it.each(levels)('%s reason has no semicolon', (level) => {
    expect(groupRateReason(level)).not.toContain(';');
  });

  it('district reason names the voters and the CLA', () => {
    const text = groupRateReason('district');
    expect(text).toContain('Voters approve');
    expect(text).toContain('CLA');
  });
});

describe('EXPLAIN', () => {
  it('points at the two explanations sections', () => {
    expect(EXPLAIN.cla).toBe('/explanations/#cla');
    expect(EXPLAIN.credit).toBe('/explanations/#property-tax-credit');
  });
});

describe('rate furniture guards', () => {
  it('shows town rate notes only for a rate value', () => {
    expect(showsTownRateNotes({ kind: 'value' })).toBe(true);
    expect(showsTownRateNotes({ kind: 'blank' })).toBe(false);
  });
  it('shows the group rate card only when there is no range', () => {
    expect(showsGroupRateCard({ kind: 'value' })).toBe(false);
    expect(showsGroupRateCard({ kind: 'blank' })).toBe(true);
  });
});

describe('rate furniture on real towns', () => {
  const generated = new URL('../generated/', import.meta.url).pathname;
  const have = ['registry.json', 'combiner.json', 'adm-subgroups.json', 'groupings.json'].every((f) =>
    existsSync(generated + f),
  );
  it.skipIf(!have)('gives North Bennington no notes and Milton the notes', () => {
    const load = (f: string) => JSON.parse(readFileSync(generated + f, 'utf8'));
    const j = buildJourney({
      registry: load('registry.json').entities,
      combiner: load('combiner.json'),
      subgroups: load('adm-subgroups.json'),
      groupings: load('groupings.json'),
    });
    expect(j.towns['north-bennington']?.rate.kind).toBe('blank');
    expect(showsTownRateNotes(j.towns['north-bennington']!.rate)).toBe(false);
    expect(showsTownRateNotes(j.towns['milton']!.rate)).toBe(true);
  });
});
