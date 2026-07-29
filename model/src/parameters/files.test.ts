/**
 * Checks the shipped parameter files against each other.
 *
 * FY2025, FY2026 and FY2027 share their statutory weights, so each file
 * restates the same numbers and quotes. That duplication is deliberate -- a
 * fiscal year has to be independently auditable, and a reader should be able to
 * open one file and see the whole basis for that year without chasing an
 * include. The cost is that a transcription slip in one year would be invisible.
 * These tests are what makes the duplication safe.
 */

import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadParameterFile } from './load-node.ts';
import type { ParameterSet } from '../types.ts';

const PARAMETERS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'parameters');

const files = readdirSync(PARAMETERS_DIR)
  .filter((f) => /^fy\d{4}\.yaml$/.test(f))
  .sort();

const sets = new Map<number, ParameterSet>(
  files.map((f) => {
    const set = loadParameterFile(join(PARAMETERS_DIR, f));
    return [set.fiscal_year, set];
  }),
);

/**
 * Weights governed by 16 V.S.A. § 4010(d), amended by Act 127 § 4 effective
 * July 1, 2024 and untouched since. They must agree across every fiscal year
 * from FY2025 on.
 */
const SHARED_WEIGHTS = [
  'membership.long_term_membership_years',
  'weights.grade.kindergarten_through_5',
  'weights.grade.6_through_8',
  'weights.grade.9_through_12',
  'weights.poverty_185_fpl',
  'weights.english_learner',
  'weights.sparsity.density_under_36',
  'weights.sparsity.density_36_to_55',
  'weights.sparsity.density_55_to_100',
  'weights.small_school.density_ceiling',
  'weights.small_school.enrollment_under_100',
  'weights.small_school.enrollment_100_to_250',
  'tax.homestead_base_rate',
  'tax.spending_adjustment_floor',
  'tax.excess_spending_threshold_ratio',
  'tax.income_percentage_target',
] as const;

describe('the shipped parameter files', () => {
  it('all parse', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(sets.size).toBe(files.length);
  });

  it('are named for the fiscal year they declare', () => {
    for (const f of files) {
      const declared = loadParameterFile(join(PARAMETERS_DIR, f)).fiscal_year;
      expect(`fy${declared}.yaml`, `${f} declares FY${declared}`).toBe(f);
    }
  });
});

describe('years that share a statutory basis agree', () => {
  for (const key of SHARED_WEIGHTS) {
    it(`${key} is identical across every fiscal year`, () => {
      const seen = new Map<number, unknown>();
      for (const [fy, set] of sets) {
        const p = set.parameters.get(key);
        expect(p, `FY${fy} is missing ${key}`).toBeDefined();
        seen.set(fy, p?.value ?? null);
      }
      const distinct = new Set([...seen.values()].map((v) => JSON.stringify(v)));
      expect(
        distinct.size,
        `${key} differs across years: ${JSON.stringify([...seen])}. Act 127 § 4 has ` +
          `governed these since July 1, 2024, so a difference is a transcription slip ` +
          `unless an amendment says otherwise.`,
      ).toBe(1);
    });
  }

  it('quotes the same statutory language for a shared weight', () => {
    // A value can be right while the quote beside it drifts, and the quote is
    // what a reader checks the value against.
    const drifted: string[] = [];
    for (const key of SHARED_WEIGHTS) {
      const quotes = new Set(
        [...sets.values()].map((s) => (s.parameters.get(key)?.citation.quote ?? '').replace(/\s+/g, ' ').trim()),
      );
      if (quotes.size !== 1) drifted.push(key);
    }
    expect(drifted, `these parameters carry different quotes across years: ${drifted.join(', ')}`).toEqual([]);
  });
});

describe('year-specific provisions are not copied blindly', () => {
  it('applies hold harmless in FY2025 and not afterwards', () => {
    // § 4010(e) is "not in effect July 1, 2025-June 30, 2029". FY2025 ends the
    // day before that window opens.
    expect(sets.get(2025)?.parameters.get('membership.hold_harmless_applies')?.value).toBe(true);
    expect(sets.get(2026)?.parameters.get('membership.hold_harmless_applies')?.value).toBe(false);
  });

  it('leaves the prekindergarten weight determinate before FY2027 and open in FY2027', () => {
    // The contingent repeal is effective July 1, 2026 -- the first day of FY2027.
    expect(sets.get(2025)?.parameters.get('weights.grade.prekindergarten')?.value).toBe(-0.54);
    expect(sets.get(2025)?.parameters.get('weights.grade.prekindergarten')?.citation.verified).toBe(true);

    expect(sets.get(2026)?.parameters.get('weights.grade.prekindergarten')?.value).toBe(-0.54);
    expect(sets.get(2026)?.parameters.get('weights.grade.prekindergarten')?.citation.verified).toBe(true);

    expect(sets.get(2027)?.parameters.get('weights.grade.prekindergarten')?.value).toBeNull();
    expect(sets.get(2027)?.parameters.get('weights.grade.prekindergarten')?.citation.verified).toBe(false);
  });

  it('never carries an annually set amount across years', () => {
    // The yields and the statewide adjustment are set each year. Copying one
    // forward would be indistinguishable from having looked it up.
    for (const key of ['yield.property_dollar_equivalent', 'yield.income_dollar_equivalent', 'tax.statewide_adjustment']) {
      for (const [fy, set] of sets) {
        const p = set.parameters.get(key);
        expect(p?.citation.verified, `FY${fy} ${key} must not be marked verified until looked up`).toBe(false);
      }
    }
  });
});
