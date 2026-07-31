/**
 * Assembles the small / sparse candidate table the site publishes.
 *
 * Joins four things that live apart on purpose:
 *
 *   registry/entities/school.json                who the schools are, and their grade spans
 *   derived/school-municipality/                 which town each building stands in
 *   warehouse/census/                            land area, and population where it was retrieved
 *   model/parameters/fy2030-small-sparse.yaml    the thresholds, all null and unverified
 *
 * As of writing the fourth of those makes every screen return `unverified`, so
 * this produces a table of schools with no verdicts in it. That is the correct
 * output and the page says so: the screens exist, the geography is real, and the
 * only thing missing is somebody reading the enacted acts.
 *
 * School-level enrollment is the other gap, and a different kind. AOE publishes
 * average daily membership by RESIDENT DISTRICT -- that is, by town -- and no
 * per-school enrollment series is available through the Public Data API. So the
 * enrollment screen has no input to work with either, and the record says
 * `missing_input` rather than pretending a town's ADM is a school's roll.
 */

import { readFileSync } from 'node:fs';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { parse as parseYaml } from 'yaml';

import {
  createContext,
  evaluateSmallSparse,
  type EnrollmentBasis,
  type GradeSpanClass,
  type MunicipalityBasis,
  type MunicipalityDemographics,
  type ParameterSet,
  type PopulationSeries,
  type SchoolRef,
  type SmallSparseResult,
} from '@vt-budget/model';

import { PATHS, rel } from '../paths.ts';
import type { RegistryEntity } from '../registry/types.ts';

export interface SmallSparsePublication {
  readonly generated: string;
  readonly parameter_set_ref: string;
  readonly fiscal_year: number;
  /**
   * Stated up front, so a consumer of this file cannot mistake a table of nulls
   * for a table of negatives.
   */
  readonly nothing_is_computable: boolean;
  readonly why: readonly string[];
  readonly counts: {
    readonly schools: number;
    readonly with_municipality: number;
    readonly with_land_area: number;
    readonly with_population: number;
    readonly with_enrollment: number;
    readonly screens_resolved: number;
  };
  readonly population_series_held: readonly string[];
  readonly enrollment_bases: readonly EnrollmentBasis[];
  readonly schools: readonly SchoolRow[];
}

export interface SchoolRow {
  readonly school: string;
  readonly name: string;
  readonly supervisory_union: string | null;
  readonly operated_by: string | null;
  readonly grade_span_class: string | null;
  readonly grades_as_stated: string | null;
  readonly municipality: string | null;
  readonly municipality_basis: MunicipalityBasis;
  readonly land_area_sq_mi: number | null;
  readonly population: number | null;
  readonly population_series: PopulationSeries;
  readonly density: number | null;
  readonly enrollment: number | null;
  readonly small_screen_met: boolean | null;
  readonly sparse_screen_met: boolean | null;
  readonly enrollment_status: string;
  readonly density_status: string;
  readonly determination_status: string;
  readonly grant_suppressed_reason: string | null;
}

interface DerivedMunicipality {
  schools: Array<{ school: string; municipality: string | null; note: string | null }>;
}

interface CensusRecord {
  population_series_held: PopulationSeries[];
  towns: Array<{
    entity: string | null;
    land_area_sq_mi: number | null;
    population: Record<string, number | null>;
  }>;
}

function readYaml<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return parseYaml(readFileSync(path, 'utf8')) as T;
}

/** Every school-shaped entity still open, in slug order. */
export function schoolsOf(registry: ReadonlyMap<string, RegistryEntity>): RegistryEntity[] {
  return [...registry.values()]
    .filter((e) => ['school', 'academy', 'techcenter', 'independent'].includes(e.type))
    .filter((e) => !e.effective_to)
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export function buildSmallSparse(
  registry: ReadonlyMap<string, RegistryEntity>,
  parameters: ParameterSet,
  options: {
    readonly parameterSetRef: string;
    readonly generated: string;
    readonly enrollmentBasis: EnrollmentBasis;
    readonly populationSeries: PopulationSeries;
  },
): SmallSparsePublication {
  const derived = readYaml<DerivedMunicipality>(
    join(PATHS.derived, 'school-municipality', 'vt-school-municipality.yaml'),
  );
  const municipalityBySchool = new Map(
    (derived?.schools ?? []).map((s) => [s.school, s.municipality]),
  );

  const censusDir = join(PATHS.warehouse, 'census');
  const census = existsSync(censusDir)
    ? readdirSync(censusDir)
        .filter((f) => f.endsWith('.yaml'))
        .map((f) => readYaml<CensusRecord>(join(censusDir, f)))
        .find((r): r is CensusRecord => r !== null) ?? null
    : null;

  const townData = new Map(
    (census?.towns ?? [])
      .filter((t) => t.entity)
      .map((t) => [t.entity as string, t]),
  );

  const rows: SchoolRow[] = [];
  let withMunicipality = 0;
  let withLandArea = 0;
  let withPopulation = 0;
  let screensResolved = 0;

  for (const entity of schoolsOf(registry)) {
    const municipality = municipalityBySchool.get(entity.slug) ?? entity.municipality ?? null;

    // The basis travels with the value. A municipality resolved by point in
    // polygon is good enough for the density screen; one taken from a mailing
    // address is not, and the screen has to be able to tell.
    const basis: MunicipalityBasis = municipality
      ? municipalityBySchool.get(entity.slug)
        ? 'census_geocoder_point_in_polygon'
        : (entity.municipality_basis ?? 'unknown')
      : 'unknown';

    const town = municipality ? townData.get(municipality) : undefined;
    const population = town?.population?.[options.populationSeries] ?? null;

    const school: SchoolRef = {
      id: entity.slug,
      name: entity.name,
      municipality,
      municipalityBasis: basis,
      gradeSpan: entity.grade_span ?? null,
      gradeSpanClass: (entity.grade_span_class as GradeSpanClass | null) ?? null,
      schoolType: entity.school_type ?? 'other',
      location:
        entity.latitude !== null && entity.longitude !== null
          ? {
              latitude: entity.latitude,
              longitude: entity.longitude,
              precision: entity.geocode_precision ?? 'unknown',
            }
          : null,
    };

    const demographics: MunicipalityDemographics | null = municipality
      ? {
          municipality,
          population,
          populationSeries: options.populationSeries,
          landAreaSqMi: town?.land_area_sq_mi ?? null,
        }
      : null;

    const ctx = createContext(parameters);
    const result: SmallSparseResult = evaluateSmallSparse(ctx, {
      school,
      // No per-school enrollment series exists. An empty series produces a
      // missing_input, which is the truth; a town's ADM stood in for a school's
      // roll would be a fabrication that looked like data.
      enrollment: { byYear: {} },
      demographics,
      nearest: {
        targetSchool: null,
        roadMiles: null,
        estimatedOneWayMinutes: null,
        travelTimeMethod: 'unavailable',
        routingRunRef: null,
      },
      options: {
        fiscalYear: parameters.fiscal_year,
        enrollmentBasis: options.enrollmentBasis,
        populationSeries: options.populationSeries,
      },
      assumption: { basis: 'none', note: null },
      determinationStatus: 'undetermined',
    });

    if (municipality) withMunicipality++;
    if (demographics?.landAreaSqMi !== null && demographics?.landAreaSqMi !== undefined) withLandArea++;
    if (population !== null) withPopulation++;
    if (result.statutory.smallScreenMet !== null || result.statutory.sparseScreenMet !== null) {
      screensResolved++;
    }

    rows.push({
      school: entity.slug,
      name: entity.name,
      supervisory_union: entity.supervisory_union,
      operated_by: entity.operated_by,
      grade_span_class: entity.grade_span_class ?? null,
      grades_as_stated: entity.grade_span?.as_stated ?? null,
      municipality,
      municipality_basis: basis,
      land_area_sq_mi: demographics?.landAreaSqMi ?? null,
      population,
      population_series: options.populationSeries,
      density: result.statutory.density.value,
      enrollment: result.statutory.enrollment.value,
      small_screen_met: result.statutory.smallScreenMet,
      sparse_screen_met: result.statutory.sparseScreenMet,
      enrollment_status: result.statutory.enrollment.node.status,
      density_status: result.statutory.density.node.status,
      determination_status: result.necessity.determinationStatus,
      grant_suppressed_reason: result.grant.small.suppressedReason,
    });
  }

  return {
    generated: options.generated,
    parameter_set_ref: options.parameterSetRef,
    fiscal_year: parameters.fiscal_year,
    nothing_is_computable: screensResolved === 0,
    why: [
      'Every statutory threshold in the parameter file is null and unverified. The engine ' +
        'refuses to compute from an unverified parameter, so no school in Vermont screens to ' +
        'either a yes or a no. Reading the enacted acts is what changes this.',
      'No per-school enrollment series is published through the AOE Public Data API. Average ' +
        'daily membership is published by resident district, which is a town, not a school.',
      'AOE has published no small or sparse by necessity determinations, and the rules that ' +
        'would govern them are not yet written. Eligibility is undetermined for every school ' +
        'in Vermont, which is a fact about the State’s timetable and not a gap in this data.',
    ],
    counts: {
      schools: rows.length,
      with_municipality: withMunicipality,
      with_land_area: withLandArea,
      with_population: withPopulation,
      with_enrollment: rows.filter((r) => r.enrollment !== null).length,
      screens_resolved: screensResolved,
    },
    population_series_held: census?.population_series_held ?? [],
    enrollment_bases: ['two_year_average', 'single_year'],
    schools: rows,
  };
}

export const SMALL_SPARSE_PARAMETER_FILE = join(PATHS.parameters, 'fy2030-small-sparse.yaml');
export const SMALL_SPARSE_PARAMETER_REF = rel(SMALL_SPARSE_PARAMETER_FILE);
