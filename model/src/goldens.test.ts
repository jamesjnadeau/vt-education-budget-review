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
  type CalcNode,
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
    /**
     * Raw ADM by grade band, for a fixture that recomputes weighted membership
     * from AOE's membership report. Omit when `weighted_membership_published`
     * is given instead.
     */
    adm_years?: MembershipInput['adm_years'];
    state_placed_fte?: number | null;
    poverty_185_fpl?: number | null;
    english_learners?: number | null;
    /** § 4010(b)(2): drives both the sparsity band and small-school eligibility. */
    persons_per_square_mile?: number | null;
    small_schools?: MembershipInput['small_schools'];
    /**
     * AOE's own published long-term weighted ADM for the district, used as the
     * divisor directly. A fixture built this way tests the tax chain from the
     * State's pupil count onward and says nothing about the membership engine;
     * `expected.weighted_membership` is therefore not checked for it.
     */
    weighted_membership_published?: number | null;
    education_spending: number;
    /** Needed to compute excess spending under 32 V.S.A. § 5401(12). */
    statewide_average_per_pupil: number | null;
    /** Optional Act 183 adjustments to the excess spending comparison. */
    capital_reserve_five_plus_years?: number | null;
    bond_exclusion_pre_july_2024?: number | null;
    /**
     * The district's FY2025 Act 84 decrease (2024 Acts No. 84, Sec. 3), from
     * AOE's worksheet. Required for a fiscal year whose parameter file carries
     * the transition: 0, with a source, for a district the worksheet omits.
     */
    act84_transition?: { fy2025_rate_decrease: number; source: string };
    towns: Array<{ town: string; cla: number }>;
  };
  expected: {
    weighted_membership?: number;
    per_weighted_pupil?: number;
    /** The district rate before the CLA step, § 5402(a)(2). */
    equalized_homestead_rate?: number;
    town_rates?: Array<{ town: string; billed_rate: number }>;
  };
  /**
   * Absolute tolerances: a figure passes when |engine - published| is at most
   * the tolerance. Published rates carry four decimals, so 0.0001 means "agrees
   * to the last printed digit".
   */
  tolerance?: { weighted_membership?: number; rates?: number };
  /**
   * Present when the engine is KNOWN not to reproduce this fixture's rates and
   * the reason is understood. The rate assertions then run as `it.fails`: the
   * suite stays green while the gap is open, and goes red the moment the engine
   * starts reproducing the figures, which is the signal to delete this block.
   * Such a fixture does not count toward the publication gate below.
   */
  known_disagreement?: { reason: string };
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

function isKnownDisagreement(file: string): boolean {
  const golden = parseYaml(readFileSync(file, 'utf8')) as Golden;
  return golden.known_disagreement !== undefined;
}

/** District fixtures the engine is expected to reproduce today. */
const reproducingFiles = files.filter((f) => !isKnownDisagreement(f));

describe('golden tests gate publication', () => {
  it('refuses to let a parameter file claim verification while no golden fixture exists', () => {
    // Verifying every citation by eye and verifying that the engine reproduces
    // the state's published figures are different claims. This project's
    // credibility rests on the second one, so the first must not be able to
    // stand alone.
    // Only district fixtures the engine actually reproduces count. A fixture
    // recording a known disagreement documents a gap; it cannot close one.
    const fixtures = reproducingFiles;
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
    if (reproducingFiles.length === 0) {
      expect(parameterFiles().every((file) => {
        const set = parseParameterSet(parseYaml(readFileSync(file, 'utf8')));
        return set.status !== 'verified';
      })).toBe(true);
      return;
    }
    expect(reproducingFiles.length).toBeGreaterThan(0);
  });
});

/** |actual - expected| <= tolerance, with the comparison spelled out on failure. */
function expectWithin(actual: number | null, expected: number, tolerance: number, what: string): void {
  expect(actual, `${what}: engine produced no value`).not.toBeNull();
  const diff = Math.abs((actual as number) - expected);
  expect(
    diff,
    `${what}: engine ${actual} vs published ${expected} differs by ${diff.toFixed(6)}, tolerance ${tolerance}`,
  ).toBeLessThanOrEqual(tolerance + 1e-12);
}

describe.runIf(files.length > 0)('engine reproduces published state figures', () => {
  for (const file of files) {
    const golden = parseYaml(readFileSync(file, 'utf8')) as Golden;
    const disagreement = golden.known_disagreement;
    // Rate assertions on a known disagreement are expected to fail; a pass
    // there means the engine changed and the fixture's block is now stale.
    const rateIt = disagreement ? it.fails : it;
    const rateSuffix = disagreement ? ' [known disagreement -- expected to fail]' : '';

    describe(`${golden.entity} FY${golden.fiscal_year}`, () => {
      const parameterFile = join(PARAMETERS_DIR, `fy${golden.fiscal_year}.yaml`);
      const set = parseParameterSet(parseYaml(readFileSync(parameterFile, 'utf8')));
      const membershipTolerance = golden.tolerance?.weighted_membership ?? 0.01;
      const rateTolerance = golden.tolerance?.rates ?? 0.0001;
      const usesPublishedMembership =
        golden.inputs.weighted_membership_published !== undefined &&
        golden.inputs.weighted_membership_published !== null;

      it('cites where the state published these figures', () => {
        // A golden fixture whose expected values have no provenance is just a
        // second copy of our own arithmetic wearing a costume.
        expect(golden.source?.publisher).toBeTruthy();
        expect(golden.source?.document).toBeTruthy();
        expect(golden.source?.retrieved).toBeTruthy();
      });

      if (disagreement) {
        it('states why the engine does not reproduce these figures', () => {
          expect(disagreement.reason.trim().length).toBeGreaterThan(0);
        });
      }

      const build = () => {
        const ctx = createContext(set);
        let membershipTotal: CalcNode;
        if (usesPublishedMembership) {
          membershipTotal = input(
            ctx,
            'Weighted long-term membership as published',
            golden.inputs.weighted_membership_published as number,
            'pupils',
            { source: `${golden.source.publisher}, ${golden.source.document}` },
          );
        } else {
          if (!golden.inputs.adm_years) {
            throw new Error(
              `${file}: give either inputs.adm_years or inputs.weighted_membership_published`,
            );
          }
          membershipTotal = computeWeightedMembership(ctx, {
            entity: golden.entity,
            adm_years: golden.inputs.adm_years,
            state_placed_fte: golden.inputs.state_placed_fte ?? null,
            poverty_185_fpl: golden.inputs.poverty_185_fpl ?? null,
            english_learners: golden.inputs.english_learners ?? null,
            persons_per_square_mile: golden.inputs.persons_per_square_mile ?? null,
            small_schools: golden.inputs.small_schools ?? [],
            source: `${golden.source.publisher}, ${golden.source.document}`,
          }).total;
        }
        const spending = input(ctx, 'Education spending', golden.inputs.education_spending, 'usd', {
          source: golden.source.document,
        });
        const perPupil = perPupilEducationSpending(ctx, spending, membershipTotal);
        const rateFor = (town: { town: string; cla: number }) =>
          townRate(
            ctx,
            perPupil,
            { town: town.town, cla: town.cla, cla_source: golden.source.document },
            golden.inputs.statewide_average_per_pupil,
            {
              capitalReserveFivePlusYears: golden.inputs.capital_reserve_five_plus_years ?? null,
              bondExclusionPreJuly2024: golden.inputs.bond_exclusion_pre_july_2024 ?? null,
              weightedMembership: membershipTotal,
            },
            golden.inputs.act84_transition
              ? {
                  fy2025RateDecrease: golden.inputs.act84_transition.fy2025_rate_decrease,
                  source: golden.inputs.act84_transition.source,
                }
              : {},
          );
        return { ctx, membershipTotal, perPupil, rateFor };
      };

      if (golden.expected.weighted_membership !== undefined && !usesPublishedMembership) {
        it('reproduces weighted long-term membership', () => {
          const { membershipTotal } = build();
          expectWithin(
            membershipTotal.value,
            golden.expected.weighted_membership as number,
            membershipTolerance,
            'weighted long-term membership',
          );
        });
      }

      if (golden.expected.per_weighted_pupil !== undefined) {
        it('reproduces education spending per weighted pupil', () => {
          const { perPupil } = build();
          // Published to the cent; allow half a cent for the State's own rounding.
          expectWithin(
            perPupil.value,
            golden.expected.per_weighted_pupil as number,
            0.005,
            'education spending per weighted pupil',
          );
        });
      }

      if (golden.expected.equalized_homestead_rate !== undefined) {
        rateIt(`reproduces the equalized homestead rate${rateSuffix}`, () => {
          const { rateFor } = build();
          const first = golden.inputs.towns[0];
          expect(first, 'fixture lists no towns').toBeTruthy();
          const result = rateFor(first as { town: string; cla: number });
          expectWithin(
            result.equalizedRate.value,
            golden.expected.equalized_homestead_rate as number,
            rateTolerance,
            'equalized homestead rate',
          );
        });
      }

      for (const expectedTown of golden.expected.town_rates ?? []) {
        rateIt(`reproduces the billed homestead rate for ${expectedTown.town}${rateSuffix}`, () => {
          const { rateFor } = build();
          const townInput = golden.inputs.towns.find((t) => t.town === expectedTown.town);
          expect(townInput, `fixture has no CLA for ${expectedTown.town}`).toBeTruthy();
          const result = rateFor(townInput as { town: string; cla: number });
          expectWithin(
            result.billedRate.value,
            expectedTown.billed_rate,
            rateTolerance,
            `${expectedTown.town} billed homestead rate`,
          );
        });
      }
    });
  }
});
