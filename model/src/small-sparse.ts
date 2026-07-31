/**
 * Small / sparse school support grants under Act 73 of 2025, Sec. 37.
 *
 * Emits computation-tree nodes in the same shape as the rest of the engine, so
 * the walkthrough renders these steps exactly as it renders weighted membership.
 * Three design rules, all enforced here rather than in the UI:
 *
 *   1. Screens are candidate filters, not eligibility. The two statutory screens
 *      are arithmetic; necessity is a determination. Nothing in this module can
 *      return "eligible".
 *
 *   2. Grants are gated on an explicit assumption basis. computeGrantLines()
 *      will not produce a number without one, and the suppressed path returns a
 *      reason intended to be rendered where the number would have gone.
 *
 *   3. The five necessity criteria are disjunctive and unscored. There is
 *      deliberately no aggregate function. A composite score would be an
 *      editorial judgment wearing a computation's clothes, which README rule 3
 *      forbids.
 *
 * TWO GATES, NEITHER SUBSTITUTING FOR THE OTHER
 *
 *   node.ts already refuses to produce a number from an unverified parameter and
 *   marks the node `unverified`. That protects against unverified LAW. The
 *   assumption gate in computeGrantLines() protects against undetermined
 *   ADMINISTRATIVE STATUS -- AOE has made no necessity determinations, and the
 *   rules that would govern them are unwritten. Verified parameters would not
 *   make a school eligible. Both gates must pass, and the two suppression
 *   reasons stay distinct all the way to the screen: one is the State's
 *   outstanding decision, the other is ours.
 *
 * STRUCTURAL ASSUMPTIONS, ALL UNVERIFIED
 *
 *   Per docs/parameter-verification.md, the shape of the calculation is itself a
 *   reading of statute, and it is the failure a parameter review is least likely
 *   to catch. This module assumes all of the following, none of it read against
 *   current law:
 *
 *     - Support grants are ADDITIVE to the education opportunity payment, not
 *       inside it.
 *     - Grants are computed per SCHOOL and summed to the district, so district
 *       payment = EOP + the sum of school grants + categorical aid.
 *     - The small and sparse grants may BOTH apply to one school. Whether they
 *       add or the school takes the greater is unread; until then this module
 *       emits separate lines and never a total.
 *     - The density test applies to the municipality the school BUILDING sits
 *       in.
 *     - "Per square mile of land" means Census TIGER ALAND, not total area.
 *     - Only public schools are grant eligible.
 *     - The enrollment screen is a candidate filter and not a gate, because the
 *       framework's population-trajectory criterion exists to cover schools
 *       temporarily above the threshold.
 *
 *   Correct any of these here and in the parameter file's structural_note in the
 *   same commit as the reading. A wrong structure with right numbers produces
 *   confident wrong answers, and does it in a form that looks checked.
 *
 * NAMING
 *
 *   The framework's phrase "projected savings from closure" appears in this
 *   codebase only inside quoted framework text. There is no `savings` field, per
 *   README rule 3. The engine's field is a signed closure cost delta, presented
 *   in both directions.
 *
 * Depends on nothing outside the engine's own node types. No filesystem, no
 * network, so the same code runs in the build pipeline and in the browser.
 */

import {
  derive,
  input,
  mean,
  notComputable,
  parameterNode,
  quotient,
  relabel,
  undetermined,
} from './node.ts';
import type { CalcNode, EngineContext, Parameter } from './types.ts';

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export type GradeSpanClass =
  | 'elementary'
  | 'middle'
  | 'secondary'
  | 'elementary_middle'
  | 'middle_secondary'
  | 'combined'
  | 'other';

export type MunicipalityBasis =
  | 'census_geocoder_point_in_polygon'
  | 'aoe_mailing_city'
  | 'manual'
  | 'unknown';

export interface SchoolRef {
  readonly id: string;
  readonly name: string;
  /** Registry slug of the town the BUILDING stands in, or null if unestablished. */
  readonly municipality: string | null;
  readonly municipalityBasis: MunicipalityBasis;
  readonly gradeSpan: { readonly low: number; readonly high: number } | null;
  readonly gradeSpanClass: GradeSpanClass | null;
  readonly schoolType: 'public' | 'approved_independent' | 'career_technical_center' | 'other';
  readonly location: {
    readonly latitude: number;
    readonly longitude: number;
    readonly precision: 'rooftop' | 'parcel' | 'street' | 'municipality_centroid' | 'unknown';
  } | null;
}

export interface EnrollmentSeries {
  /** Keyed by school year. Null means AOE published no figure -- never coerce to zero. */
  readonly byYear: Readonly<Record<number, number | null>>;
}

export type PopulationSeries = 'decennial_2020' | 'acs_5yr' | 'state_estimate' | 'unknown';

export interface MunicipalityDemographics {
  readonly municipality: string;
  readonly population: number | null;
  readonly populationSeries: PopulationSeries;
  /** Census TIGER ALAND converted to square miles. Land only, never total area. */
  readonly landAreaSqMi: number | null;
}

/** Output of the build-time routing precompute. Never computed in the browser. */
export interface NearestSameSpanResult {
  readonly targetSchool: string | null;
  readonly roadMiles: number | null;
  readonly estimatedOneWayMinutes: number | null;
  /** Population-weighted from census blocks. Never derived from student residences. */
  readonly travelTimeMethod: 'block_weighted_estimate' | 'school_to_school_only' | 'unavailable';
  readonly routingRunRef: string | null;
}

export type EnrollmentBasis = 'two_year_average' | 'single_year';

export interface ScreenOptions {
  readonly fiscalYear: number;
  /**
   * No default, because the statute's basis is unread and the two readings
   * disagree for borderline schools. The caller states which frame it is using
   * and the record carries it.
   */
  readonly enrollmentBasis: EnrollmentBasis;
  readonly populationSeries: PopulationSeries;
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

/** Null is not false. A school we have no figure for is not a school that failed. */
export type ScreenOutcome = boolean | null;

export interface ScreenResult {
  /** The measured quantity: average enrollment, or persons per square mile. */
  readonly value: number | null;
  readonly threshold: number | null;
  readonly comparator: 'lt' | 'lte' | null;
  readonly meets: ScreenOutcome;
  readonly node: CalcNode;
}

export type CriterionStatus =
  | 'not_evaluated'
  | 'screen_met'
  | 'screen_not_met'
  | 'indeterminate'
  | 'requires_certification'
  | 'requires_local_model'
  | 'requires_projection';

export type Computability =
  | 'partly_computable'
  | 'requires_certification'
  | 'requires_local_model'
  | 'requires_projection';

export interface CriterionResult {
  readonly id: string;
  readonly status: CriterionStatus;
  readonly computability: Computability;
  readonly evidence: Readonly<Record<string, unknown>> | null;
  readonly explanation: string;
  readonly citations: readonly string[];
  readonly node: CalcNode;
}

export type AssumptionBasis = 'none' | 'agency_determination' | 'explicit_user_assumption';

export type SuppressionKind = 'ok' | 'unverified' | 'missing_input' | 'undetermined' | 'not_computable';

export interface GrantLine {
  readonly amount: number | null;
  readonly perPupilRate: number | null;
  readonly pupilCount: number | null;
  readonly pupilCountBasis: EnrollmentBasis | null;
  readonly suppressedReason: string | null;
  readonly suppressedKind: SuppressionKind;
  readonly node: CalcNode;
}

export type DeterminationStatus =
  | 'undetermined'
  | 'agency_determined_eligible'
  | 'agency_determined_ineligible'
  | 'not_applicable';

export interface SmallSparseResult {
  readonly school: string;
  readonly fiscalYear: number;
  readonly statutory: {
    readonly enrollment: ScreenResult;
    readonly density: ScreenResult;
    readonly smallScreenMet: ScreenOutcome;
    readonly sparseScreenMet: ScreenOutcome;
  };
  readonly necessity: {
    readonly determinationStatus: DeterminationStatus;
    readonly criteria: readonly CriterionResult[];
  };
  readonly grant: {
    readonly assumptionBasis: AssumptionBasis;
    readonly assumptionNote: string | null;
    readonly small: GrantLine;
    readonly sparse: GrantLine;
    /**
     * Intentionally typed as null rather than merely left empty. Whether the two
     * grants add or a school takes the greater is unread; see the parameter
     * file's structural_note on statutory.grants.stacking_rule.
     */
    readonly total: null;
  };
  readonly nodes: readonly CalcNode[];
}

// ---------------------------------------------------------------------------
// The two suppression reasons. They must never collapse into one blank.
// ---------------------------------------------------------------------------

/** Blank kind: `undetermined`. A decision the State has not made. */
export const UNDETERMINED_REASON =
  'Eligibility is undetermined. AOE has published no small or sparse by necessity ' +
  'determinations, and the rules that would govern them are not yet written.';

/** Blank kind: `unverified`. Our outstanding work, not the State's. */
export const UNVERIFIED_RATE_REASON =
  'The grant rate has not been verified against current statute text, so no figure is ' +
  'computed. See docs/parameter-verification.md.';

// ---------------------------------------------------------------------------
// Screen plumbing
// ---------------------------------------------------------------------------

function comparatorOf(p: Parameter): 'lt' | 'lte' | null {
  return p.value === 'lt' || p.value === 'lte' ? p.value : null;
}

function numberOf(p: Parameter): number | null {
  return typeof p.value === 'number' ? p.value : null;
}

/**
 * Tests a measured quantity against a statutory threshold.
 *
 * The node's value is the QUANTITY, not the verdict, so a reader sees how close
 * a school sits to the line -- which for a school at 99 against a threshold of
 * 100 is the entire story. `meets` rides alongside, and is null whenever the
 * node declined to carry a value, because a screen that cannot be evaluated has
 * not been failed.
 *
 * Both the threshold and the comparator are parameters. The comparator is not a
 * detail: Vermont has schools at exactly 100 pupils, and `lt` against `lte`
 * decides them.
 */
function screenAgainstThreshold(
  ctx: EngineContext,
  args: {
    readonly label: string;
    readonly quantity: CalcNode;
    readonly thresholdKey: string;
    readonly comparatorKey: string;
    readonly sentence: (parts: {
      readonly value: number | null;
      readonly threshold: number | null;
      readonly comparator: 'lt' | 'lte' | null;
      readonly meets: ScreenOutcome;
    }) => string;
  },
): ScreenResult {
  const thresholdNode = parameterNode(ctx, args.thresholdKey, 'count');
  const comparatorParam = ctx.parameters.parameters.get(args.comparatorKey);
  if (!comparatorParam) {
    throw new Error(
      `Parameter "${args.comparatorKey}" is not defined in the FY${ctx.parameters.fiscal_year} ` +
        `parameter set. A threshold without a comparator is not a test.`,
    );
  }

  const threshold = numberOf(thresholdNode.parameters[0] as Parameter);
  const comparator = comparatorOf(comparatorParam);

  // Both parameters go in, so an unverified comparator blocks the screen just as
  // an unverified threshold does. It is the same class of unread statute.
  const node = derive(ctx, {
    op: 'screen',
    label: args.label,
    unit: args.quantity.unit,
    inputs: [args.quantity, thresholdNode],
    parameters: [comparatorParam],
    compute: ([quantity]) => quantity as number,
    explain: (value) =>
      args.sentence({
        value,
        threshold,
        comparator,
        meets:
          value !== null && threshold !== null && comparator !== null
            ? compare(value, threshold, comparator)
            : null,
      }),
  });

  const value = node.value;
  const meets =
    value !== null && threshold !== null && comparator !== null
      ? compare(value, threshold, comparator)
      : null;

  return { value, threshold, comparator, meets, node };
}

const compare = (value: number, threshold: number, comparator: 'lt' | 'lte'): boolean =>
  comparator === 'lt' ? value < threshold : value <= threshold;

// ---------------------------------------------------------------------------
// Statutory screen 1 -- enrollment
// ---------------------------------------------------------------------------

/** The school years the basis draws on. Exported so a record can state them. */
export function enrollmentYears(opts: ScreenOptions): number[] {
  return opts.enrollmentBasis === 'two_year_average'
    ? [opts.fiscalYear - 2, opts.fiscalYear - 1]
    : [opts.fiscalYear - 1];
}

export function enrollmentScreen(
  ctx: EngineContext,
  school: SchoolRef,
  enrollment: EnrollmentSeries,
  opts: ScreenOptions,
): ScreenResult {
  const years = enrollmentYears(opts);

  // A year AOE published no figure for enters as a missing input, which blocks
  // the mean and therefore the screen. Averaging over the years that happen to
  // be present would quietly answer a different question -- and for a school
  // with one published year, a convenient one.
  const yearNodes = years.map((year) =>
    input(ctx, `${school.name} enrollment, ${year}`, enrollment.byYear[year] ?? null, 'pupils', {
      source: `AOE published enrollment, ${year}`,
    }),
  );

  const quantity =
    yearNodes.length === 1
      ? relabel(ctx, `${school.name} enrollment`, yearNodes[0] as CalcNode, 'pupils')
      : mean(ctx, `${school.name} average enrollment`, yearNodes, 'pupils');

  return screenAgainstThreshold(ctx, {
    label: `${school.name}: small school enrollment screen`,
    quantity,
    thresholdKey: 'statutory.screens.small_enrollment.threshold',
    comparatorKey: 'statutory.screens.small_enrollment.comparator',
    sentence: ({ value, threshold, meets }) =>
      `${school.name} enrolled ${yearNodes.map((n) => (n.value === null ? 'no published figure' : n.value)).join(' and ')} ` +
      `in ${years.join(' and ')}, ${
        opts.enrollmentBasis === 'two_year_average'
          ? `a two-year average of ${value?.toFixed(1)}`
          : `${value?.toFixed(1)}`
      }. Act 73 defines a small school as one below ${threshold} students, so this school ` +
      `${meets ? 'meets' : 'does not meet'} the enrollment screen. Whether the statutory test uses a ` +
      `single year or a two-year average is unsettled; this figure uses ` +
      `${opts.enrollmentBasis.replace(/_/g, ' ')}. Meeting the screen does not mean the school ` +
      `qualifies for a grant.`,
  });
}

// ---------------------------------------------------------------------------
// Statutory screen 2 -- municipal population density
// ---------------------------------------------------------------------------

export function densityScreen(
  ctx: EngineContext,
  school: SchoolRef,
  demographics: MunicipalityDemographics | null,
): ScreenResult {
  // A postal city is not a municipality: Vermont post office names routinely
  // cover parts of several towns, so a school's mailing address cannot decide
  // which town's density governs it.
  const established =
    school.municipality !== null &&
    (school.municipalityBasis === 'census_geocoder_point_in_polygon' ||
      school.municipalityBasis === 'manual');

  const population = input(
    ctx,
    established && demographics
      ? `${demographics.municipality} population`
      : `Municipality of ${school.name}`,
    established && demographics ? demographics.population : null,
    'count',
    {
      ...(established && demographics
        ? { source: demographics.populationSeries.replace(/_/g, ' ') }
        : {}),
      notes: established
        ? []
        : [
            `The municipality ${school.name} stands in has not been established` +
              `${school.municipalityBasis === 'aoe_mailing_city' ? ' -- only its AOE mailing city is known, and a postal city is not a municipality' : ''}. ` +
              `The density screen tests the town the building is in, so it does not resolve.`,
          ],
    },
  );

  const landArea = input(
    ctx,
    established && demographics
      ? `${demographics.municipality} land area`
      : `Land area of the municipality ${school.name} stands in`,
    established && demographics ? demographics.landAreaSqMi : null,
    'count',
    {
      ...(established && demographics ? { source: 'Census TIGER ALAND' } : {}),
      notes: ['Land area, never total area. Total area understates density and would pull lakeside and pond-heavy towns into eligibility.'],
    },
  );

  const quantity = quotient(
    ctx,
    `${established && demographics ? demographics.municipality : 'Municipality'} population density`,
    population,
    landArea,
    'persons_per_square_mile',
  );

  return screenAgainstThreshold(ctx, {
    label: `${school.name}: sparse area density screen`,
    quantity,
    thresholdKey: 'statutory.screens.sparse_density.threshold',
    comparatorKey: 'statutory.screens.sparse_density.comparator',
    sentence: ({ value, threshold, meets }) =>
      `${school.name} sits in ${demographics?.municipality ?? 'its municipality'}, which has ` +
      `${population.value} residents (${demographics?.populationSeries.replace(/_/g, ' ') ?? 'series unstated'}) ` +
      `across ${landArea.value?.toFixed(1)} square miles of land, a density of ${value?.toFixed(1)} persons ` +
      `per square mile. Act 73 defines a sparsely populated area as one below ${threshold} persons per ` +
      `square mile of land, so this school ${meets ? 'meets' : 'does not meet'} the sparsity screen. ` +
      `Land area is used, not total area, per the statutory wording. The test looks at the town the ` +
      `school building is in, not at every town in the district.`,
  });
}

// ---------------------------------------------------------------------------
// Necessity criteria
// ---------------------------------------------------------------------------

/**
 * Criterion 1, the only partly computable one.
 *
 * Road distance to the nearest school of the same grade span comes from the
 * build-time routing precompute; travel time is a block-weighted estimate. Both
 * are reported against the framework's PROPOSED thresholds, and the result is a
 * screen, not a determination.
 */
export function travelCriterion(
  ctx: EngineContext,
  school: SchoolRef,
  nearest: NearestSameSpanResult,
): CriterionResult {
  const citations = [
    'framework.criteria.travel_time_or_distance.road_miles_to_nearest_same_grade_span',
  ];

  const rangeParam = ctx.parameters.parameters.get(citations[0] as string);
  const milesLow = rangeParam?.range?.low ?? null;
  const milesHigh = rangeParam?.range?.high ?? null;

  const thresholdKey = travelTimeKeyFor(school.gradeSpanClass);
  const minutesParam = thresholdKey ? ctx.parameters.parameters.get(thresholdKey) : undefined;
  const minutesThreshold = minutesParam ? numberOf(minutesParam) : null;

  const distance = input(
    ctx,
    `Road miles from ${school.name} to the nearest school of the same grade span`,
    nearest.roadMiles,
    'miles',
    {
      ...(nearest.routingRunRef ? { source: nearest.routingRunRef } : {}),
      notes: nearest.routingRunRef
        ? []
        : ['No routing run is recorded, so this distance cannot be reproduced.'],
    },
  );

  const unevaluated = (explanation: string, status: CriterionStatus): CriterionResult => ({
    id: 'travel_time_or_distance',
    status,
    computability: 'partly_computable',
    evidence: status === 'not_evaluated' ? null : { ...nearest, precision: school.location?.precision ?? null },
    explanation,
    citations,
    node: input(ctx, `${school.name}: travel and distance criterion`, null, 'miles', {
      notes: [explanation],
    }),
  });

  if (school.location === null || nearest.roadMiles === null) {
    return unevaluated(
      `Distance to the nearest school of the same grade span could not be computed for ` +
        `${school.name}, because its location or the routing result is unavailable.`,
      'not_evaluated',
    );
  }

  if (school.location.precision === 'municipality_centroid' || school.location.precision === 'unknown') {
    return unevaluated(
      `${school.name} is geocoded only to ${
        school.location.precision === 'unknown' ? 'an unstated precision' : 'the centre of its municipality'
      }, which is not precise enough to screen a ${milesLow ?? '?'} to ${milesHigh ?? '?'} mile threshold. ` +
        `Reported as indeterminate rather than estimated.`,
      'indeterminate',
    );
  }

  // The 10-15 mile range turns on terrain, which the framework leaves undefined.
  // Only an unambiguous result above the high end or below the low end is a
  // screen result; picking the midpoint would invent the rule the committee
  // declined to write.
  const clearsHigh = milesHigh !== null && nearest.roadMiles > milesHigh;
  const clearsLow = milesLow !== null && nearest.roadMiles > milesLow;
  const minutesClear =
    nearest.estimatedOneWayMinutes !== null && minutesThreshold !== null
      ? nearest.estimatedOneWayMinutes > minutesThreshold
      : null;

  const status: CriterionStatus =
    milesLow === null || milesHigh === null
      ? 'indeterminate'
      : clearsHigh || minutesClear === true
        ? 'screen_met'
        : clearsLow
          ? // Inside the range, where the framework makes the threshold depend on
            // terrain and never says how. Indeterminate is the honest answer;
            // splitting the difference at 12.5 would invent the missing rule.
            'indeterminate'
          : 'screen_not_met';

  const rangeSentence = clearsHigh
    ? `above the top of the ${milesLow} to ${milesHigh} mile range`
    : clearsLow
      ? `inside the ${milesLow} to ${milesHigh} mile range, where the framework makes the threshold depend on terrain and does not define how`
      : `below the bottom of the ${milesLow} to ${milesHigh} mile range`;

  const straddles =
    school.gradeSpanClass === 'elementary_middle' || school.gradeSpanClass === 'combined';

  const explanation =
    `The nearest school serving the same grades as ${school.name} is ` +
    `${nearest.roadMiles.toFixed(1)} road miles away, ${rangeSentence}. ` +
    (nearest.estimatedOneWayMinutes !== null && minutesThreshold !== null
      ? `Estimated one-way travel time is about ${Math.round(nearest.estimatedOneWayMinutes)} minutes ` +
        `against a proposed threshold of ${minutesThreshold}. That estimate weights census block ` +
        `population and uses no student address data. `
      : `No travel time estimate is available. `) +
    (straddles
      ? `This school spans the framework's grade 7 split, which the framework does not address; the ` +
        `stricter elementary threshold is applied and flagged rather than the more convenient one. `
      : '') +
    `This is one of five independent paths to a necessity finding, and it is a screen against a ` +
    `PROPOSED standard, not a determination. Only AOE can determine necessity, under rules that do ` +
    `not yet exist.`;

  return {
    id: 'travel_time_or_distance',
    status,
    computability: 'partly_computable',
    evidence: { ...nearest, minutesThreshold, milesLow, milesHigh, straddlingGradeSpan: straddles },
    explanation,
    citations: thresholdKey ? [...citations, thresholdKey] : citations,
    node: derive(ctx, {
      op: 'screen',
      label: `${school.name}: travel and distance criterion`,
      unit: 'miles',
      inputs: [distance],
      parameters: rangeParam ? [rangeParam] : [],
      compute: ([miles]) => miles as number,
      explain: () => explanation,
      notes: ['Measured against a proposed standard, not a legal requirement.'],
    }),
  };
}

function travelTimeKeyFor(cls: GradeSpanClass | null): string | null {
  const elementary =
    'framework.criteria.travel_time_or_distance.travel_time_one_way_minutes.elementary';
  const secondary =
    'framework.criteria.travel_time_or_distance.travel_time_one_way_minutes.grades_7_12';
  switch (cls) {
    case 'elementary':
      return elementary;
    case 'middle':
    case 'secondary':
    case 'middle_secondary':
      return secondary;
    // K-8 and K-12 straddle the grade 7 split and the framework does not say
    // which threshold applies. Use the stricter elementary threshold and flag
    // it; do not quietly pick the one producing a more convenient answer.
    case 'elementary_middle':
    case 'combined':
      return elementary;
    default:
      return null;
  }
}

/**
 * The four criteria that cannot be answered from public data.
 *
 * Terminal by design. These are correct final answers, not gaps in our coverage,
 * and anything that counts them as outstanding work is misdescribing what
 * finished looks like for this layer.
 */
export function nonComputableCriteria(ctx: EngineContext, school: SchoolRef): CriterionResult[] {
  const build = (
    id: string,
    computability: Exclude<Computability, 'partly_computable'>,
    explanation: string,
    citations: readonly string[],
  ): CriterionResult => ({
    id,
    status: computability,
    computability,
    evidence: null,
    explanation,
    citations,
    node: notComputable(
      ctx,
      `${school.name}: ${id.replace(/_/g, ' ')} criterion`,
      'none',
      computability,
      explanation,
    ),
  });

  return [
    build(
      'safe_transportation',
      'requires_certification',
      'Whether terrain, winter road conditions, unpaved routes, or mountain gaps make transportation ' +
        'unsafe or unreliable must be certified by the supervisory union or AOE. It is not something ' +
        'this model can determine, and detecting a candidate is not certifying a condition.',
      ['framework.criteria.safe_transportation'],
    ),
    build(
      'feasible_consolidation',
      'requires_local_model',
      'Whether nearby schools could absorb these students while still meeting Educational Quality ' +
        'Standards, and whether renovation costs at those schools would exceed the savings projected ' +
        'from closing this one, depends on building capacity and project estimates that are local and ' +
        'not published statewide. The answer also depends on whether renovation cost is measured ' +
        'before or after school construction aid, which the framework does not specify.',
      ['framework.criteria.feasible_consolidation', 'framework.open_questions.capital_cost_basis'],
    ),
    build(
      'population_trajectory',
      'requires_projection',
      'Whether the area is projected to stay below the enrollment that would support a viable larger ' +
        'school requires a demographic projection and a definition of viable, neither of which the ' +
        'framework supplies. This criterion is why a school above the enrollment threshold today is ' +
        'not automatically excluded.',
      ['framework.criteria.population_trajectory'],
    ),
    build(
      'closure_cost_increase',
      'requires_local_model',
      'Whether closure would substantially raise the district’s per-student cost through tuition, ' +
        'transportation, capital work at receiving schools, or new construction requires a closure ' +
        'model built for this district. The same capital cost ambiguity applies.',
      ['framework.criteria.closure_cost_increase', 'framework.open_questions.capital_cost_basis'],
    ),
  ];
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

export interface EligibilityAssumption {
  readonly basis: AssumptionBasis;
  readonly note: string | null;
}

/**
 * Produces grant lines only when an eligibility basis is explicitly supplied.
 *
 * There is no code path from "meets both screens" to a dollar figure. The
 * property test in small-sparse.test.ts asserts exactly that across the input
 * space, and it should fail loudly if someone later "fixes" this suppression as
 * though it were a bug.
 */
export function computeGrantLines(
  ctx: EngineContext,
  school: SchoolRef,
  screens: { readonly smallScreenMet: ScreenOutcome; readonly sparseScreenMet: ScreenOutcome },
  pupilCount: number | null,
  pupilCountBasis: EnrollmentBasis | null,
  assumption: EligibilityAssumption,
): { small: GrantLine; sparse: GrantLine } {
  if (assumption.basis === 'explicit_user_assumption' && !assumption.note?.trim()) {
    throw new Error(
      'An explicit_user_assumption requires a note. Any figure derived from an assumption must ' +
        'carry the assumption’s text wherever it is displayed, including into a shared URL.',
    );
  }

  const suppress = (label: string, reason: string, kind: SuppressionKind): GrantLine => ({
    amount: null,
    perPupilRate: null,
    pupilCount: null,
    pupilCountBasis: null,
    suppressedReason: reason,
    suppressedKind: kind,
    node:
      kind === 'undetermined'
        ? undetermined(ctx, label, 'usd', reason)
        : input(ctx, label, null, 'usd', { notes: [reason] }),
  });

  const line = (which: 'small' | 'sparse', screenMet: ScreenOutcome, rateKey: string): GrantLine => {
    const label = `${school.name}: ${which} school support grant`;

    if (assumption.basis === 'none' || screenMet !== true || pupilCount === null) {
      return suppress(label, UNDETERMINED_REASON, 'undetermined');
    }

    // The second gate. An eligibility assumption does not license computing from
    // an unverified statutory rate, and the two suppression reasons must stay
    // distinct: one is the State's outstanding decision, the other is ours.
    const rateNode = parameterNode(ctx, rateKey, 'usd_per_pupil');
    if (rateNode.value === null) {
      return { ...suppress(label, UNVERIFIED_RATE_REASON, 'unverified'), node: rateNode };
    }

    const pupils = input(ctx, `${school.name} grant-eligible pupils`, pupilCount, 'pupils', {
      ...(pupilCountBasis ? { source: pupilCountBasis.replace(/_/g, ' ') } : {}),
    });

    const node = derive(ctx, {
      op: 'product',
      label,
      unit: 'usd',
      inputs: [pupils, rateNode],
      compute: ([count, rate]) => (count as number) * (rate as number),
      explain: (value) =>
        `${label} is ${value === null ? '—' : value} on an assumed eligibility basis of ` +
        `${assumption.basis.replace(/_/g, ' ')}. ${assumption.note ?? ''} This figure exists only ` +
        `because an eligibility assumption was supplied; AOE has determined nothing.`,
      notes: [
        `Computed under an assumption, not a determination: ${assumption.note ?? assumption.basis}`,
      ],
    });

    return {
      amount: node.value,
      perPupilRate: rateNode.value,
      pupilCount,
      pupilCountBasis,
      suppressedReason: null,
      suppressedKind: 'ok',
      node,
    };
  };

  return {
    small: line('small', screens.smallScreenMet, 'statutory.grants.small_school.per_pupil'),
    sparse: line('sparse', screens.sparseScreenMet, 'statutory.grants.sparse_school.per_pupil'),
  };
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

export interface SmallSparseInput {
  readonly school: SchoolRef;
  readonly enrollment: EnrollmentSeries;
  readonly demographics: MunicipalityDemographics | null;
  readonly nearest: NearestSameSpanResult;
  readonly options: ScreenOptions;
  readonly assumption: EligibilityAssumption;
  readonly determinationStatus: DeterminationStatus;
}

export function evaluateSmallSparse(ctx: EngineContext, args: SmallSparseInput): SmallSparseResult {
  const { school, enrollment, demographics, nearest, options, assumption } = args;

  // Only public schools are grant eligible. Independents stay in the registry as
  // receiving schools in consolidation scenarios, not as grant candidates.
  const applicable = school.schoolType === 'public';

  const enrollmentResult = enrollmentScreen(ctx, school, enrollment, options);
  const densityResult = densityScreen(ctx, school, demographics);

  const criteria = applicable
    ? [travelCriterion(ctx, school, nearest), ...nonComputableCriteria(ctx, school)]
    : [];

  const grants = computeGrantLines(
    ctx,
    school,
    { smallScreenMet: enrollmentResult.meets, sparseScreenMet: densityResult.meets },
    enrollmentResult.value,
    options.enrollmentBasis,
    applicable ? assumption : { basis: 'none', note: null },
  );

  return {
    school: school.id,
    fiscalYear: options.fiscalYear,
    statutory: {
      enrollment: enrollmentResult,
      density: densityResult,
      smallScreenMet: enrollmentResult.meets,
      sparseScreenMet: densityResult.meets,
    },
    necessity: {
      determinationStatus: applicable ? args.determinationStatus : 'not_applicable',
      criteria,
    },
    grant: {
      assumptionBasis: applicable ? assumption.basis : 'none',
      assumptionNote: applicable ? assumption.note : null,
      small: grants.small,
      sparse: grants.sparse,
      total: null,
    },
    nodes: [
      enrollmentResult.node,
      densityResult.node,
      ...criteria.map((c) => c.node),
      grants.small.node,
      grants.sparse.node,
    ],
  };
}

/**
 * Rolls school-level grant lines up to a district total.
 *
 * Order matters and is easy to get wrong: the education opportunity payment is
 * the base amount times weighted long-term membership at the DISTRICT level, and
 * the support grants are additive on top, computed per SCHOOL and then summed.
 * Under a merger scenario the schools do not move, so this sum is invariant to
 * governance change -- unless the scenario also closes a school, in which case
 * that school's lines drop out entirely. That interaction is the point of the
 * whole layer, and it is what separates consolidating governance from closing
 * buildings.
 */
export function rollUpToDistrict(results: readonly SmallSparseResult[]): {
  amount: number | null;
  suppressedCount: number;
  contributingSchools: string[];
  note: string | null;
} {
  const contributing = results.filter(
    (r) => r.grant.small.amount !== null || r.grant.sparse.amount !== null,
  );
  const suppressedCount = results.length - contributing.length;

  if (contributing.length === 0) {
    return { amount: null, suppressedCount, contributingSchools: [], note: UNDETERMINED_REASON };
  }

  const amount = contributing.reduce(
    (total, r) => total + (r.grant.small.amount ?? 0) + (r.grant.sparse.amount ?? 0),
    0,
  );

  return {
    amount,
    suppressedCount,
    contributingSchools: contributing.map((r) => r.school),
    note:
      suppressedCount > 0
        ? `${suppressedCount} of ${results.length} schools are excluded from this total because ` +
          `their eligibility is undetermined. The figure is a floor under the stated assumptions, ` +
          `not a projection.`
        : null,
  };
}

// ---------------------------------------------------------------------------
// Grade spans
// ---------------------------------------------------------------------------

/**
 * Normalizes AOE's grade list to an integer span. PK and EE are -1, K is 0,
 * grades 1-12 are themselves.
 *
 * The integer form exists so "the nearest school of the same grade span" is a
 * comparison rather than a string match. The stated list is kept beside it.
 */
export function normalizeGradeSpan(
  grades: readonly string[],
): { low: number; high: number; as_stated: string } | null {
  const numbers = grades
    .map((g) => {
      const upper = g.trim().toUpperCase();
      if (upper === 'PK' || upper === 'EE' || upper === 'PREK') return -1;
      if (upper === 'K' || upper === 'KG') return 0;
      const n = Number.parseInt(upper, 10);
      return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null;
    })
    .filter((n): n is number => n !== null);

  if (numbers.length === 0) return null;
  return {
    low: Math.min(...numbers),
    high: Math.max(...numbers),
    as_stated: grades.join(','),
  };
}

/**
 * Classifies a span for the framework's travel-time thresholds, which split at
 * grade 7.
 *
 * A span crossing that split is genuinely ambiguous under the framework as
 * drafted, and Vermont has many such schools. The ambiguity is preserved in the
 * class name rather than resolved here.
 */
export function gradeSpanClassOf(span: { low: number; high: number } | null): GradeSpanClass | null {
  if (!span) return null;
  const { low, high } = span;
  if (high <= 6) return 'elementary';
  if (low >= 9) return 'secondary';
  if (low >= 7 && high <= 8) return 'middle';
  if (low >= 7) return 'middle_secondary';
  if (high <= 8) return 'elementary_middle';
  return 'combined';
}
