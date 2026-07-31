/**
 * Runner for the small / sparse fixtures.
 *
 * Read model/goldens/small-sparse/README.md before adding to this. These
 * fixtures are NOT reproductions of state-published figures the way the district
 * goldens will be -- there are no published necessity determinations to
 * reproduce. They are hand arithmetic against hypothesis thresholds, and a green
 * run here means the arithmetic is right given a guess.
 *
 * The thresholds come in through `syntheticParameters`, whose citation reads
 * "SYNTHETIC TEST FIXTURE — not a statutory value and not Vermont law", so a
 * value copied out of a fixture announces what it is wherever it lands.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { createContext } from './node.ts';
import {
  densityScreen,
  enrollmentScreen,
  evaluateSmallSparse,
  type EnrollmentBasis,
  type MunicipalityBasis,
  type PopulationSeries,
  type SchoolRef,
} from './small-sparse.ts';
import { syntheticParameters } from './testing/synthetic.ts';

const FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'goldens',
  'small-sparse',
);

interface Fixture {
  name: string;
  why: string;
  thresholds: {
    enrollment: { threshold: number; comparator: 'lt' | 'lte' };
    density: { threshold: number; comparator: 'lt' | 'lte' };
  };
  school: {
    grade_span: { low: number; high: number };
    school_type: SchoolRef['schoolType'];
    municipality_basis: MunicipalityBasis;
  };
  inputs: {
    enrollment_by_year: Record<string, number | null>;
    municipality: {
      population: number | null;
      land_area_sq_mi: number | null;
      water_area_sq_mi: number | null;
      series: PopulationSeries;
    };
  };
  options: { fiscal_year: number; enrollment_basis: EnrollmentBasis };
  expected: {
    enrollment_value: number | null;
    small_screen_met: boolean | null;
    density_value: number | null;
    sparse_screen_met: boolean | null;
    density_if_total_area_used?: number;
    grant_amount: null;
    under_single_year_basis?: { enrollment_value: number | null; small_screen_met: boolean | null };
  };
}

function fixtures(): Array<{ file: string; fixture: Fixture }> {
  if (!existsSync(FIXTURES_DIR)) return [];
  return readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith('.yaml'))
    .sort()
    .map((f) => ({
      file: f,
      fixture: parseYaml(readFileSync(join(FIXTURES_DIR, f), 'utf8')) as Fixture,
    }));
}

const all = fixtures();

function contextFor(fixture: Fixture) {
  return createContext(
    syntheticParameters({
      overrides: {
        'statutory.screens.small_enrollment.threshold': fixture.thresholds.enrollment.threshold,
        'statutory.screens.small_enrollment.comparator': fixture.thresholds.enrollment.comparator,
        'statutory.screens.sparse_density.threshold': fixture.thresholds.density.threshold,
        'statutory.screens.sparse_density.comparator': fixture.thresholds.density.comparator,
      },
    }),
  );
}

function schoolOf(fixture: Fixture): SchoolRef {
  return {
    id: 'school/fixture',
    name: fixture.name,
    municipality: 'town/fixture',
    municipalityBasis: fixture.school.municipality_basis,
    gradeSpan: fixture.school.grade_span,
    gradeSpanClass: 'elementary',
    schoolType: fixture.school.school_type,
    location: { latitude: 44, longitude: -72.5, precision: 'rooftop' },
  };
}

function enrollmentOf(fixture: Fixture) {
  const byYear: Record<number, number | null> = {};
  for (const [year, value] of Object.entries(fixture.inputs.enrollment_by_year)) {
    byYear[Number(year)] = value;
  }
  return { byYear };
}

function demographicsOf(fixture: Fixture) {
  return {
    municipality: 'town/fixture',
    population: fixture.inputs.municipality.population,
    populationSeries: fixture.inputs.municipality.series,
    landAreaSqMi: fixture.inputs.municipality.land_area_sq_mi,
  };
}

describe('small/sparse fixtures', () => {
  it('has fixtures, and each says what it would catch', () => {
    // A fixture nobody can explain is a fixture nobody dares delete, and a
    // directory of those is how a suite stops meaning anything.
    expect(all.length).toBeGreaterThan(0);
    for (const { file, fixture } of all) {
      expect(fixture.name, file).toBeTruthy();
      expect(fixture.why?.trim().length ?? 0, file).toBeGreaterThan(20);
    }
  });

  it('contains no fixture that expects a dollar figure', () => {
    // No fixture in this directory may be the thing that teaches the suite a
    // grant amount is acceptable output.
    for (const { file, fixture } of all) {
      expect(fixture.expected.grant_amount, file).toBeNull();
    }
  });
});

describe.each(all)('$file', ({ fixture }) => {
  const options = {
    fiscalYear: fixture.options.fiscal_year,
    enrollmentBasis: fixture.options.enrollment_basis,
    populationSeries: fixture.inputs.municipality.series,
  };

  it('screens enrollment as hand-computed', () => {
    const result = enrollmentScreen(
      contextFor(fixture),
      schoolOf(fixture),
      enrollmentOf(fixture),
      options,
    );
    expect(result.value).toBe(fixture.expected.enrollment_value);
    expect(result.meets).toBe(fixture.expected.small_screen_met);
  });

  it('screens density against land area as hand-computed', () => {
    const result = densityScreen(contextFor(fixture), schoolOf(fixture), demographicsOf(fixture));
    expect(result.value).toBe(fixture.expected.density_value);
    expect(result.meets).toBe(fixture.expected.sparse_screen_met);
  });

  it.runIf(fixture.expected.density_if_total_area_used !== undefined)(
    'does not divide by total area',
    () => {
      const land = fixture.inputs.municipality.land_area_sq_mi as number;
      const water = fixture.inputs.municipality.water_area_sq_mi as number;
      const population = fixture.inputs.municipality.population as number;

      // The fixture states what the wrong measure would have produced. Asserting
      // it here means the fixture fails loudly if someone swaps the measure,
      // rather than quietly returning a different town's answer.
      expect(population / (land + water)).toBe(fixture.expected.density_if_total_area_used);

      const result = densityScreen(contextFor(fixture), schoolOf(fixture), demographicsOf(fixture));
      expect(result.value).not.toBe(fixture.expected.density_if_total_area_used);
      expect(result.value).toBe(population / land);
    },
  );

  it.runIf(fixture.expected.under_single_year_basis !== undefined)(
    'gives a different answer under the other reading of the enrollment basis',
    () => {
      const other = fixture.expected.under_single_year_basis as NonNullable<
        Fixture['expected']['under_single_year_basis']
      >;
      const result = enrollmentScreen(contextFor(fixture), schoolOf(fixture), enrollmentOf(fixture), {
        ...options,
        enrollmentBasis: 'single_year',
      });
      expect(result.value).toBe(other.enrollment_value);
      expect(result.meets).toBe(other.small_screen_met);
    },
  );

  it('produces no grant figure', () => {
    const result = evaluateSmallSparse(contextFor(fixture), {
      school: schoolOf(fixture),
      enrollment: enrollmentOf(fixture),
      demographics: demographicsOf(fixture),
      nearest: {
        targetSchool: null,
        roadMiles: null,
        estimatedOneWayMinutes: null,
        travelTimeMethod: 'unavailable',
        routingRunRef: null,
      },
      options,
      assumption: { basis: 'none', note: null },
      determinationStatus: 'undetermined',
    });

    expect(result.grant.small.amount).toBeNull();
    expect(result.grant.sparse.amount).toBeNull();
    expect(result.grant.total).toBeNull();
  });
});
