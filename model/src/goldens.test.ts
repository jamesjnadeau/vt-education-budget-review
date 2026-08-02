/**
 * Golden tests against figures the state has already published.
 *
 * The unit tests prove the arithmetic is right GIVEN a set of weights. They
 * cannot tell you whether the weights, or the structure they are plugged into,
 * match Vermont law -- they run against deliberately arbitrary values. A green
 * unit suite is entirely compatible with publishing confidently wrong numbers.
 *
 * These close that gap, and until they exist the project has no business
 * publishing a computed figure. The gate below enforces exactly that, rather
 * than leaving it as an intention in a document.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import {
  computeWeightedMembership,
  createContext,
  input,
  perPupilEducationSpending,
  townRate,
  type MembershipInput,
} from './index.ts';
import { parseParameterSet } from './parameters/parse.ts';

const here = dirname(fileURLToPath(import.meta.url));
const GOLDENS_DIR = join(here, '..', 'goldens');
const PARAMETERS_DIR = join(here, '..', 'parameters');

interface Golden {
  entity: string;
  fiscal_year: number;
  source: { publisher: string; document: string; url?: string; retrieved: string };
  inputs: {
    adm_years: MembershipInput['adm_years'];
    state_placed_fte: number | null;
    poverty_185_fpl: number | null;
    english_learners: number | null;
    /** § 4010(b)(2): drives both the sparsity band and small-school eligibility. */
    persons_per_square_mile: number | null;
    small_schools: MembershipInput['small_schools'];
    education_spending: number;
    /** Needed to compute excess spending under 32 V.S.A. § 5401(12). */
    statewide_average_per_pupil: number | null;
    /** Optional Act 183 adjustments to the excess spending comparison. */
    capital_reserve_five_plus_years?: number | null;
    bond_exclusion_pre_july_2024?: number | null;
    towns: Array<{ town: string; cla: number }>;
  };
  expected: {
    weighted_membership?: number;
    per_weighted_pupil?: number;
    equalized_homestead_rate?: number;
    town_rates?: Array<{ town: string; billed_rate: number }>;
  };
  tolerance?: { weighted_membership?: number; rates?: number };
}

/**
 * District fixtures only: the ones that reproduce the state's published
 * weighted membership and rates.
 *
 * Deliberately not recursive. Subdirectories hold fixtures for other layers,
 * with their own shapes and their own runners, and sweeping them in here would
 * feed a small/sparse screen fixture to the membership engine.
 */
function goldenFiles(): string[] {
  if (!existsSync(GOLDENS_DIR)) return [];
  return readdirSync(GOLDENS_DIR)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => join(GOLDENS_DIR, f));
}

/** Every fixture anywhere under model/goldens/, for the publication gate. */
function allFixtures(): string[] {
  if (!existsSync(GOLDENS_DIR)) return [];
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.yaml')) out.push(path);
    }
  };
  walk(GOLDENS_DIR);
  return out;
}

/**
 * Every shipped parameter file, including domain-scoped ones.
 *
 * The pattern is `fy\d{4}` followed by anything, not `fy\d{4}` exactly. When the
 * December JFO recommendations and the small/sparse grants each became their own
 * file rather than an edit to an existing one, a stricter pattern here would
 * have quietly exempted them from the gate below -- and a file exempt from the
 * gate is a file that can declare itself verified with nothing reproducing it.
 */
function parameterFiles(): string[] {
  if (!existsSync(PARAMETERS_DIR)) return [];
  return readdirSync(PARAMETERS_DIR)
    .filter((f) => /^fy\d{4}.*\.yaml$/.test(f))
    .map((f) => join(PARAMETERS_DIR, f));
}

const files = goldenFiles();

describe('golden tests gate publication', () => {
  it('refuses to let a parameter file claim verification while no golden fixture exists', () => {
    // Verifying every citation by eye and verifying that the engine reproduces
    // the state's published figures are different claims. This project's
    // credibility rests on the second one, so the first must not be able to
    // stand alone.
    const fixtures = allFixtures();
    const verifiedSets = parameterFiles().filter((file) => {
      const set = parseParameterSet(parseYaml(readFileSync(file, 'utf8')));
      return set.status === 'verified';
    });

    if (verifiedSets.length > 0 && fixtures.length === 0) {
      throw new Error(
        `${verifiedSets.length} parameter file(s) declare status: verified, but ` +
          `model/goldens/ contains no fixtures. Citations checked by eye are not the same ` +
          `claim as "the engine reproduces the state's published figures". Add golden ` +
          `fixtures before marking a parameter set verified -- see model/goldens/README.md.`,
      );
    }

    expect(verifiedSets.length === 0 || fixtures.length > 0).toBe(true);
  });

  it('records honestly that no fixture yet reproduces a state figure', () => {
    // Deliberately asserted rather than skipped. A skipped test is invisible in
    // a summary line; this one keeps the gap in the count where it can be seen,
    // and turns into a real failure the moment someone adds a fixture that the
    // engine cannot reproduce.
    //
    // Note it counts the DISTRICT fixtures, not every fixture under goldens/.
    // The small/sparse fixtures are hand-computed arithmetic, not reproductions
    // of anything the state has published -- there are no published necessity
    // determinations to reproduce -- so letting them satisfy this assertion
    // would let the project's strongest claim be made by fixtures that cannot
    // support it.
    if (files.length === 0) {
      expect(parameterFiles().every((file) => {
        const set = parseParameterSet(parseYaml(readFileSync(file, 'utf8')));
        return set.status !== 'verified';
      })).toBe(true);
      return;
    }
    expect(files.length).toBeGreaterThan(0);
  });
});

describe.runIf(files.length > 0)('engine reproduces published state figures', () => {
  for (const file of files) {
    const golden = parseYaml(readFileSync(file, 'utf8')) as Golden;

    describe(`${golden.entity} FY${golden.fiscal_year}`, () => {
      const parameterFile = join(PARAMETERS_DIR, `fy${golden.fiscal_year}.yaml`);
      const set = parseParameterSet(parseYaml(readFileSync(parameterFile, 'utf8')));
      const membershipTolerance = golden.tolerance?.weighted_membership ?? 0.01;
      const rateTolerance = golden.tolerance?.rates ?? 0.0001;

      it('cites where the state published these figures', () => {
        // A golden fixture whose expected values have no provenance is just a
        // second copy of our own arithmetic wearing a costume.
        expect(golden.source?.publisher).toBeTruthy();
        expect(golden.source?.document).toBeTruthy();
        expect(golden.source?.retrieved).toBeTruthy();
      });

      const build = () => {
        const ctx = createContext(set);
        const membership = computeWeightedMembership(ctx, {
          entity: golden.entity,
          adm_years: golden.inputs.adm_years,
          state_placed_fte: golden.inputs.state_placed_fte,
          poverty_185_fpl: golden.inputs.poverty_185_fpl,
          english_learners: golden.inputs.english_learners,
          persons_per_square_mile: golden.inputs.persons_per_square_mile,
          small_schools: golden.inputs.small_schools ?? [],
          source: `${golden.source.publisher}, ${golden.source.document}`,
        });
        const spending = input(ctx, 'Education spending', golden.inputs.education_spending, 'usd', {
          source: golden.source.document,
        });
        const perPupil = perPupilEducationSpending(ctx, spending, membership.total);
        return { ctx, membership, perPupil };
      };

      if (golden.expected.weighted_membership !== undefined) {
        it('reproduces weighted long-term membership', () => {
          const { membership } = build();
          expect(membership.total.value).not.toBeNull();
          expect(membership.total.value as number).toBeCloseTo(
            golden.expected.weighted_membership as number,
            -Math.log10(membershipTolerance),
          );
        });
      }

      if (golden.expected.per_weighted_pupil !== undefined) {
        it('reproduces education spending per weighted pupil', () => {
          const { perPupil } = build();
          expect(perPupil.value).not.toBeNull();
          expect(perPupil.value as number).toBeCloseTo(golden.expected.per_weighted_pupil as number, 0);
        });
      }

      for (const expectedTown of golden.expected.town_rates ?? []) {
        it(`reproduces the billed homestead rate for ${expectedTown.town}`, () => {
          const { ctx, membership, perPupil } = build();
          const townInput = golden.inputs.towns.find((t) => t.town === expectedTown.town);
          expect(townInput, `fixture has no CLA for ${expectedTown.town}`).toBeTruthy();

          const result = townRate(
            ctx,
            perPupil,
            {
              town: expectedTown.town,
              cla: townInput?.cla ?? null,
              cla_source: golden.source.document,
            },
            golden.inputs.statewide_average_per_pupil,
            {
              capitalReserveFivePlusYears: golden.inputs.capital_reserve_five_plus_years ?? null,
              bondExclusionPreJuly2024: golden.inputs.bond_exclusion_pre_july_2024 ?? null,
              weightedMembership: membership.total,
            },
          );

          expect(result.billedRate.value).not.toBeNull();
          expect(result.billedRate.value as number).toBeCloseTo(
            expectedTown.billed_rate,
            -Math.log10(rateTolerance),
          );
        });
      }
    });
  }
});
