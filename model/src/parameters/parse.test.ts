/**
 * Parsing of the published-inputs block.
 *
 * A parameter file states statutory *rules* in `parameters:`. Some figures the
 * formula needs are not rules but *published inputs* -- the Secretary of
 * Education's statewide average, for one -- determined anew each year and
 * distinct from the law. Those live in an optional `inputs:` block so a
 * published figure is never rendered as if it were a statute.
 */

import { describe, expect, it } from 'vitest';

import { parseParameterSet } from './parse.ts';

// A minimal, valid parameter document. The file rules require at least one real
// parameter, so every case here carries one; the `inputs` block is what varies.
const doc = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  fiscal_year: 2026,
  status: 'draft',
  parameters: {
    'weights.grade.9_through_12': {
      value: null,
      unit: 'multiplier',
      description: 'the grades 9-12 weight',
      citation: { statute: '16 V.S.A. § 4010', verified: false, verified_date: null },
    },
  },
  ...over,
});

describe('parseParameterSet inputs block', () => {
  it('parses a published input into the inputs map, keyed by its key', () => {
    const set = parseParameterSet(
      doc({
        inputs: {
          statewide_average_per_pupil: {
            value: 15000,
            unit: 'usd_per_pupil',
            description: 'statewide average district per pupil education spending',
            citation: {
              statute: '32 V.S.A. § 5401(12)',
              verified: true,
              verified_date: '2025-11-14',
            },
          },
        },
      }),
    );

    const input = set.inputs.get('statewide_average_per_pupil');
    expect(input).toBeDefined();
    expect(input?.value).toBe(15000);
    expect(input?.unit).toBe('usd_per_pupil');
    expect(input?.description).toBe('statewide average district per pupil education spending');
    expect(input?.citation.statute).toBe('32 V.S.A. § 5401(12)');
    expect(input?.citation.verified).toBe(true);
  });

  it('keeps a not-yet-published input as an explicit null value', () => {
    const set = parseParameterSet(
      doc({
        inputs: {
          statewide_average_per_pupil: {
            value: null,
            unit: 'usd_per_pupil',
            description: 'statewide average district per pupil education spending',
            citation: { statute: '32 V.S.A. § 5401(12)', verified: false, verified_date: null },
          },
        },
      }),
    );

    expect(set.inputs.has('statewide_average_per_pupil')).toBe(true);
    expect(set.inputs.get('statewide_average_per_pupil')?.value).toBeNull();
  });

  it('leaves the inputs map empty when a file has no inputs block', () => {
    const set = parseParameterSet(doc());
    expect(set.inputs.size).toBe(0);
  });
});
