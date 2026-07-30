/**
 * Small / sparse school support grants.
 *
 * Emits computation-tree nodes in the same shape as the rest of the engine: each node
 * carries inputs, an operation, a result, a plain-language explanation, and the
 * parameter citations applied. The UI renders these as the "show your work" walkthrough.
 *
 * Three design rules, all enforced here rather than in the UI:
 *
 *   1. Screens are candidate filters, not eligibility. The two statutory screens are
 *      computable; necessity is not. Nothing in this module can return "eligible".
 *
 *   2. Grants are gated on an explicit assumption basis. computeGrantLines() will not
 *      produce a number without one, and the suppressed path returns a reason string
 *      intended to be rendered where the number would have gone.
 *
 *   3. The five necessity criteria are disjunctive and unscored. There is deliberately
 *      no aggregate function. A composite score would be an editorial judgment wearing
 *      a computation's clothes, which README rule 3 forbids.
 *
 * TWO GATES, NEITHER SUBSTITUTING FOR THE OTHER
 *
 *   node.ts already refuses to produce a number from an unverified parameter and marks
 *   the node `unverified`. That protects against unverified LAW. The assumption gate in
 *   computeGrantLines() protects against undetermined ADMINISTRATIVE STATUS — AOE has
 *   made no necessity determinations and the rules that would govern them are unwritten.
 *   Verified parameters would not make a school eligible. Both gates must pass.
 *
 * FOUR KINDS OF BLANK
 *
 *   The engine currently distinguishes two, per README rule 1: `unverified` (our
 *   outstanding work) and `missing_input` (the district did not publish it). This layer
 *   adds two more, and they must not collapse into the existing pair:
 *
 *     `undetermined`  — the State has not made a decision that does not yet exist.
 *                       Not our outstanding work and not a missing document.
 *     `not_computable` — the question cannot be answered from public data at all:
 *                       requires_certification, requires_local_model,
 *                       requires_projection. A terminal state, not a gap.
 *
 *   Validation and the site's blank-legend both need extending. Showing `undetermined`
 *   as `missing_input` would imply someone failed to publish something, which is false
 *   and unfair to AOE.
 *
 * STRUCTURAL ASSUMPTIONS, ALL UNVERIFIED
 *
 *   Per docs/parameter-verification.md, the shape of the calculation is itself a reading
 *   of statute, and it is the failure a parameter review is least likely to catch. This
 *   module assumes all of the following, none of it read against current law:
 *
 *     - Support grants are ADDITIVE to the education opportunity payment, not inside it.
 *     - Grants are computed per SCHOOL and summed to the district, so district payment =
 *       EOP + Σ school grants + categorical aid.
 *     - The small and sparse grants may BOTH apply to one school. Whether they add or
 *       the school takes the greater is unread; until then this module emits separate
 *       lines and never a total.
 *     - The density test applies to the municipality the school BUILDING sits in.
 *     - "Per square mile of land" means Census TIGER ALAND, not total area.
 *     - Only public schools are grant eligible.
 *     - The enrollment screen is a candidate filter and not a gate, because the
 *       framework's population-trajectory criterion exists to cover schools temporarily
 *       above the threshold.
 *
 *   Correct any of these in this comment and in the parameter file's structural_note in
 *   the same commit as the reading. A wrong structure with right numbers produces
 *   confident wrong answers.
 *
 * NAMING
 *
 *   The framework's phrase "projected savings from closure" appears in this codebase
 *   only inside quoted framework text. There is no `savings` field, per README rule 3.
 *   The engine's field is a signed `closureCostDelta`, presented in both directions.
 *
 * Depends on nothing outside the engine's own node types. No filesystem, no network, so
 * the same code runs in the build pipeline and in the browser.
 */

import type { Node, ParameterRef, ParameterSet } from "./types";
import { param, node } from "./types";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export type GradeSpanClass =
  | "elementary"
  | "middle"
  | "secondary"
  | "elementary_middle"
  | "middle_secondary"
  | "combined"
  | "other";

export interface SchoolRef {
  id: string;
  name: string;
  municipality: string;
  gradeSpan: { low: number; high: number };
  gradeSpanClass: GradeSpanClass;
  schoolType: "public" | "approved_independent" | "career_technical_center" | "other";
  location: { latitude: number; longitude: number; precision: string } | null;
}

export interface EnrollmentSeries {
  /** Keyed by school year. Null means AOE published no figure -- never coerce to zero. */
  byYear: Record<number, number | null>;
}

export interface MunicipalityDemographics {
  municipality: string;
  population: number | null;
  populationSeries: "decennial_2020" | "acs_5yr" | "state_estimate" | "unknown";
  /** Census TIGER ALAND converted to square miles. Land only, never total area. */
  landAreaSqMi: number | null;
}

/** Output of the build-time routing precompute. Never computed in the browser. */
export interface NearestSameSpanResult {
  targetSchool: string | null;
  roadMiles: number | null;
  estimatedOneWayMinutes: number | null;
  /** Population-weighted from census blocks. Never derived from student residences. */
  travelTimeMethod: "block_weighted_estimate" | "school_to_school_only" | "unavailable";
  routingRunRef: string | null;
}

export type EnrollmentBasis = "two_year_average" | "single_year";

export interface ScreenOptions {
  fiscalYear: number;
  enrollmentBasis: EnrollmentBasis;
  populationSeries: MunicipalityDemographics["populationSeries"];
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export type ScreenOutcome = boolean | null;

export interface ScreenResult {
  value: number | null;
  threshold: number | null;
  comparator: "lt" | "lte" | null;
  meets: ScreenOutcome;
  nodes: Node[];
}

export type CriterionStatus =
  | "not_evaluated"
  | "screen_met"
  | "screen_not_met"
  | "indeterminate"
  | "requires_certification"
  | "requires_local_model"
  | "requires_projection";

export interface CriterionResult {
  id: string;
  status: CriterionStatus;
  computability:
    | "partly_computable"
    | "requires_certification"
    | "requires_local_model"
    | "requires_projection";
  evidence: Record<string, unknown> | null;
  explanation: string;
  citations: ParameterRef[];
}

export type AssumptionBasis = "none" | "agency_determination" | "explicit_user_assumption";

export interface GrantLine {
  amount: number | null;
  perPupilRate: number | null;
  pupilCount: number | null;
  pupilCountBasis: EnrollmentBasis | null;
  suppressedReason: string | null;
}

export interface SmallSparseResult {
  school: string;
  fiscalYear: number;
  statutory: {
    enrollment: ScreenResult;
    density: ScreenResult;
    smallScreenMet: ScreenOutcome;
    sparseScreenMet: ScreenOutcome;
  };
  necessity: {
    determinationStatus:
      | "undetermined"
      | "agency_determined_eligible"
      | "agency_determined_ineligible"
      | "not_applicable";
    criteria: CriterionResult[];
  };
  grant: {
    assumptionBasis: AssumptionBasis;
    assumptionNote: string | null;
    small: GrantLine;
    sparse: GrantLine;
    /** Intentionally absent while grant_stacking is unresolved. See parameter file. */
    total: null;
  };
  nodes: Node[];
}

const compare = (value: number, threshold: number, comparator: "lt" | "lte") =>
  comparator === "lt" ? value < threshold : value <= threshold;

/**
 * Every statutory threshold in this layer is null and unverified as of drafting. A screen
 * must not fall back to a remembered value, so this returns an unverified result whose
 * status propagates upward the way node.ts already does for weights.
 *
 * NOTE: `status` here must match the field name node.ts actually uses for this. If it
 * differs, fix it — do not silently drop the flag.
 */
function unverifiedScreen(id: string, label: string, keys: string[]): ScreenResult {
  return {
    value: null,
    threshold: null,
    comparator: null,
    meets: null,
    nodes: [
      node({
        id,
        operation: "screen.unverified",
        inputs: { parameters: keys },
        result: null,
        status: "unverified",
        explanation:
          `${label} cannot be screened: the statutory threshold has not been verified against ` +
          `current law. The parameter is null by design rather than filled in from an agency ` +
          `summary. See docs/parameter-verification.md.`,
        citations: keys,
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Statutory screen 1 -- enrollment
// ---------------------------------------------------------------------------

export function enrollmentScreen(
  school: SchoolRef,
  enrollment: EnrollmentSeries,
  opts: ScreenOptions,
  params: ParameterSet
): ScreenResult {
  const thresholdKey = "statutory.screens.small_enrollment.threshold";
  const comparatorKey = "statutory.screens.small_enrollment.comparator";
  const threshold = param<number | null>(params, thresholdKey);
  const comparator = param<"lt" | "lte" | null>(params, comparatorKey);

  if (threshold === null || comparator === null) {
    return unverifiedScreen(`${school.id}/enrollment-screen`, `Enrollment for ${school.name}`, [
      thresholdKey,
      comparatorKey,
    ]);
  }

  const years =
    opts.enrollmentBasis === "two_year_average"
      ? [opts.fiscalYear - 2, opts.fiscalYear - 1]
      : [opts.fiscalYear - 1];

  const values = years.map((y) => enrollment.byYear[y] ?? null);
  const present = values.filter((v): v is number => v !== null);

  // A missing year is not a zero and not a pass. Partial data yields no screen result.
  if (present.length !== years.length) {
    return {
      value: null,
      threshold,
      comparator,
      meets: null,
      nodes: [
        node({
          id: `${school.id}/enrollment-screen`,
          operation: "screen.enrollment",
          inputs: { years, values },
          result: null,
          explanation:
            `Enrollment for ${school.name} could not be screened: AOE published no figure for ` +
            `${years.filter((y, i) => values[i] === null).join(", ")}. ` +
            `A missing year is recorded as missing, not as zero.`,
          citations: ["statutory.screens.small_enrollment"],
        }),
      ],
    };
  }

  const value = present.reduce((a, b) => a + b, 0) / present.length;
  const meets = compare(value, threshold, comparator);

  return {
    value,
    threshold,
    comparator,
    meets,
    nodes: [
      node({
        id: `${school.id}/enrollment-screen`,
        operation: "screen.enrollment",
        inputs: { basis: opts.enrollmentBasis, years, values, threshold, comparator },
        result: { value, meets },
        explanation:
          `${school.name} enrolled ${values.join(" and ")} students in ${years.join(" and ")}, ` +
          `${opts.enrollmentBasis === "two_year_average" ? `a two-year average of ${value.toFixed(1)}` : `${value.toFixed(1)}`}. ` +
          `Act 73 defines a small school as one with fewer than ${threshold} students, so this school ` +
          `${meets ? "meets" : "does not meet"} the enrollment screen. ` +
          `Whether the statutory test uses a single year or a two-year average is unsettled; this figure uses ` +
          `${opts.enrollmentBasis.replace(/_/g, " ")}. ` +
          `Meeting the screen does not mean the school qualifies for a grant.`,
        citations: ["statutory.screens.small_enrollment"],
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Statutory screen 2 -- municipal population density
// ---------------------------------------------------------------------------

export function densityScreen(
  school: SchoolRef,
  demographics: MunicipalityDemographics,
  params: ParameterSet
): ScreenResult {
  const thresholdKey = "statutory.screens.sparse_density.threshold";
  const comparatorKey = "statutory.screens.sparse_density.comparator";
  const threshold = param<number | null>(params, thresholdKey);
  const comparator = param<"lt" | "lte" | null>(params, comparatorKey);

  if (threshold === null || comparator === null) {
    return unverifiedScreen(
      `${school.id}/density-screen`,
      `Density for ${demographics.municipality}`,
      [thresholdKey, comparatorKey]
    );
  }

  if (demographics.population === null || demographics.landAreaSqMi === null) {
    return {
      value: null,
      threshold,
      comparator,
      meets: null,
      nodes: [
        node({
          id: `${school.id}/density-screen`,
          operation: "screen.density",
          inputs: { ...demographics },
          result: null,
          explanation: `Density for ${demographics.municipality} could not be computed: population or land area is unavailable.`,
          citations: ["statutory.screens.sparse_density"],
        }),
      ],
    };
  }

  const value = demographics.population / demographics.landAreaSqMi;
  const meets = compare(value, threshold, comparator);

  return {
    value,
    threshold,
    comparator,
    meets,
    nodes: [
      node({
        id: `${school.id}/density-screen`,
        operation: "screen.density",
        inputs: { ...demographics, threshold, comparator },
        result: { value, meets },
        explanation:
          `${school.name} sits in ${demographics.municipality}, which has ${demographics.population} residents ` +
          `(${demographics.populationSeries.replace(/_/g, " ")}) across ${demographics.landAreaSqMi.toFixed(1)} square miles of land, ` +
          `a density of ${value.toFixed(1)} persons per square mile. Act 73 defines a sparsely populated area as one ` +
          `below ${threshold} persons per square mile of land, so this school ${meets ? "meets" : "does not meet"} the sparsity screen. ` +
          `Land area is used, not total area, per the statutory wording. ` +
          `The test looks at the town the school building is in, not every town in the district.`,
        citations: ["statutory.screens.sparse_density"],
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Necessity criteria
// ---------------------------------------------------------------------------

/**
 * Criterion 1 is the only partly computable one. Road distance to the nearest school of
 * the same grade span comes from the build-time routing precompute; travel time is a
 * block-weighted estimate. Both are reported against the framework's thresholds, and
 * the result is a SCREEN, not a determination.
 */
export function travelCriterion(
  school: SchoolRef,
  nearest: NearestSameSpanResult,
  params: ParameterSet
): CriterionResult {
  const milesLow = param<number>(
    params,
    "framework.criteria.travel_time_or_distance.road_miles_to_nearest_same_grade_span.range.low"
  );
  const milesHigh = param<number>(
    params,
    "framework.criteria.travel_time_or_distance.road_miles_to_nearest_same_grade_span.range.high"
  );

  const minutesThreshold = selectTravelTimeThreshold(school.gradeSpanClass, params);

  if (school.location === null || nearest.roadMiles === null) {
    return {
      id: "travel_time_or_distance",
      status: "not_evaluated",
      computability: "partly_computable",
      evidence: null,
      explanation:
        `Distance to the nearest school of the same grade span could not be computed for ${school.name} ` +
        `because its location or the routing result is unavailable.`,
      citations: ["framework.criteria.travel_time_or_distance"],
    };
  }

  if (school.location.precision === "municipality_centroid") {
    return {
      id: "travel_time_or_distance",
      status: "indeterminate",
      computability: "partly_computable",
      evidence: { ...nearest, precision: school.location.precision },
      explanation:
        `${school.name} is geocoded only to the centre of its municipality, which is not precise enough ` +
        `to screen a 10 to 15 mile threshold. Reported as indeterminate rather than estimated.`,
      citations: ["framework.criteria.travel_time_or_distance"],
    };
  }

  const clearsHigh = nearest.roadMiles > milesHigh;
  const clearsLow = nearest.roadMiles > milesLow;
  const minutesClear =
    nearest.estimatedOneWayMinutes !== null && minutesThreshold !== null
      ? nearest.estimatedOneWayMinutes > minutesThreshold
      : null;

  // The 10-15 mile range turns on terrain, which the framework leaves undefined.
  // Only an unambiguous result above the high end or below the low end is a screen result.
  const status: CriterionStatus =
    clearsHigh || minutesClear === true
      ? "screen_met"
      : !clearsLow && minutesClear !== true
        ? "screen_not_met"
        : "indeterminate";

  const rangeSentence = clearsHigh
    ? `above the top of the ${milesLow} to ${milesHigh} mile range`
    : clearsLow
      ? `inside the ${milesLow} to ${milesHigh} mile range, where the framework makes the threshold depend on terrain and does not define how`
      : `below the bottom of the ${milesLow} to ${milesHigh} mile range`;

  return {
    id: "travel_time_or_distance",
    status,
    computability: "partly_computable",
    evidence: { ...nearest, minutesThreshold, milesLow, milesHigh },
    explanation:
      `The nearest school serving the same grades as ${school.name} is ${nearest.roadMiles.toFixed(1)} road miles away, ` +
      `${rangeSentence}. ` +
      (nearest.estimatedOneWayMinutes !== null && minutesThreshold !== null
        ? `Estimated one-way travel time is about ${Math.round(nearest.estimatedOneWayMinutes)} minutes against a proposed threshold of ${minutesThreshold}. ` +
          `That estimate weights census block population and does not use any student address data. `
        : `No travel time estimate is available. `) +
      `This is one of five independent paths to a necessity finding, and it is a screen against a proposed ` +
      `standard, not a determination. Only AOE can determine necessity, under rules that do not yet exist.`,
    citations: ["framework.criteria.travel_time_or_distance"],
  };
}

function selectTravelTimeThreshold(cls: GradeSpanClass, params: ParameterSet): number | null {
  const elementary = param<number>(
    params,
    "framework.criteria.travel_time_or_distance.travel_time_one_way_minutes.elementary.value"
  );
  const secondary = param<number>(
    params,
    "framework.criteria.travel_time_or_distance.travel_time_one_way_minutes.grades_7_12.value"
  );

  switch (cls) {
    case "elementary":
      return elementary;
    case "middle":
    case "secondary":
    case "middle_secondary":
      return secondary;
    // K-8 and K-12 straddle the grade 7 split. The framework does not say which
    // threshold applies. Use the stricter elementary threshold and flag it; do not
    // quietly pick the one that produces a more convenient answer.
    case "elementary_middle":
    case "combined":
      return elementary;
    default:
      return null;
  }
}

/** The four criteria that cannot be computed from public data. Terminal by design. */
export function nonComputableCriteria(params: ParameterSet): CriterionResult[] {
  return [
    {
      id: "safe_transportation",
      status: "requires_certification",
      computability: "requires_certification",
      evidence: null,
      explanation:
        "Whether terrain, winter road conditions, unpaved routes, or mountain gaps make transportation unsafe or " +
        "unreliable must be certified by the supervisory union or AOE. It is not something this model can determine.",
      citations: ["framework.criteria.safe_transportation"],
    },
    {
      id: "feasible_consolidation",
      status: "requires_local_model",
      computability: "requires_local_model",
      evidence: null,
      explanation:
        "Whether nearby schools could absorb these students while still meeting Educational Quality Standards, " +
        "and whether renovation costs at those schools would exceed the savings from closing this one, depends on " +
        "building capacity and project estimates that are local and not published statewide. Note that the answer " +
        "also depends on whether renovation cost is measured before or after school construction aid, which the " +
        "framework does not specify.",
      citations: ["framework.criteria.feasible_consolidation", "open_questions.capital_cost_basis"],
    },
    {
      id: "population_trajectory",
      status: "requires_projection",
      computability: "requires_projection",
      evidence: null,
      explanation:
        "Whether the area is projected to stay below the enrollment that would support a viable larger school " +
        "requires a demographic projection and a definition of viable, neither of which the framework supplies. " +
        "This criterion is why a school above 100 students today is not automatically excluded.",
      citations: ["framework.criteria.population_trajectory"],
    },
    {
      id: "closure_cost_increase",
      status: "requires_local_model",
      computability: "requires_local_model",
      evidence: null,
      explanation:
        "Whether closure would substantially raise the district's per-student cost through tuition, " +
        "transportation, capital work at receiving schools, or new construction requires a closure model built " +
        "for this district. The same capital cost ambiguity applies.",
      citations: ["framework.criteria.closure_cost_increase", "open_questions.capital_cost_basis"],
    },
  ];
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

/** Blank kind: `undetermined`. The State has not made a decision that does not yet exist. */
const UNDETERMINED =
  "Eligibility is undetermined. AOE has not published small or sparse by necessity " +
  "determinations, and the rules that would govern them are not yet written.";

/** Blank kind: `unverified`. Our outstanding work, not the State's. Never show these as one. */
const UNVERIFIED_RATE =
  "The grant rate has not been verified against current statute text, so no figure is computed. " +
  "See docs/parameter-verification.md.";

/**
 * Produces grant lines only when an eligibility basis is explicitly supplied. There is
 * no code path from "meets both screens" to a dollar figure.
 */
export function computeGrantLines(
  screens: { smallScreenMet: ScreenOutcome; sparseScreenMet: ScreenOutcome },
  pupilCount: number | null,
  pupilCountBasis: EnrollmentBasis | null,
  assumption: { basis: AssumptionBasis; note: string | null },
  params: ParameterSet
): { small: GrantLine; sparse: GrantLine } {
  const suppress = (reason: string): GrantLine => ({
    amount: null,
    perPupilRate: null,
    pupilCount: null,
    pupilCountBasis: null,
    suppressedReason: reason,
  });

  if (assumption.basis === "none")
    return { small: suppress(UNDETERMINED), sparse: suppress(UNDETERMINED) };

  if (assumption.basis === "explicit_user_assumption" && !assumption.note?.trim()) {
    throw new Error(
      "An explicit_user_assumption requires a note. Any figure derived from an assumption must " +
        "carry the assumption's text wherever it is displayed."
    );
  }

  const line = (screenMet: ScreenOutcome, rateKey: string): GrantLine => {
    if (screenMet !== true || pupilCount === null) return suppress(UNDETERMINED);
    // The second gate. An eligibility assumption does not license computing from an
    // unverified statutory rate, and the two suppression reasons must stay distinct:
    // one is the State's outstanding decision, the other is ours.
    const rate = param<number | null>(params, rateKey);
    if (rate === null) return suppress(UNVERIFIED_RATE);
    return {
      amount: rate * pupilCount,
      perPupilRate: rate,
      pupilCount,
      pupilCountBasis,
      suppressedReason: null,
    };
  };

  return {
    small: line(screens.smallScreenMet, "statutory.grants.small_school.per_pupil"),
    sparse: line(screens.sparseScreenMet, "statutory.grants.sparse_school.per_pupil"),
  };
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

export function evaluateSmallSparse(args: {
  school: SchoolRef;
  enrollment: EnrollmentSeries;
  demographics: MunicipalityDemographics;
  nearest: NearestSameSpanResult;
  options: ScreenOptions;
  assumption: { basis: AssumptionBasis; note: string | null };
  determinationStatus: SmallSparseResult["necessity"]["determinationStatus"];
  params: ParameterSet;
}): SmallSparseResult {
  const { school, enrollment, demographics, nearest, options, assumption, params } = args;

  // Only public schools are grant eligible. Independents are in the registry as
  // receiving schools in consolidation scenarios, not as grant candidates.
  const applicable = school.schoolType === "public";

  const enrollmentResult = enrollmentScreen(school, enrollment, options, params);
  const densityResult = densityScreen(school, demographics, params);

  const criteria = applicable
    ? [travelCriterion(school, nearest, params), ...nonComputableCriteria(params)]
    : [];

  const determinationStatus = applicable ? args.determinationStatus : "not_applicable";

  const grants = computeGrantLines(
    { smallScreenMet: enrollmentResult.meets, sparseScreenMet: densityResult.meets },
    enrollmentResult.value,
    options.enrollmentBasis,
    applicable ? assumption : { basis: "none", note: null },
    params
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
    necessity: { determinationStatus, criteria },
    grant: {
      assumptionBasis: applicable ? assumption.basis : "none",
      assumptionNote: applicable ? assumption.note : null,
      small: grants.small,
      sparse: grants.sparse,
      total: null,
    },
    nodes: [...enrollmentResult.nodes, ...densityResult.nodes],
  };
}

/**
 * Rolls school-level grant lines up to a district total for the funding calculation.
 *
 * Order matters and is easy to get wrong: the education opportunity payment is
 * base x weighted long-term membership at the DISTRICT level, and the support grants are
 * additive on top, computed per SCHOOL and then summed. Under a merger scenario the
 * schools do not move, so this sum is invariant to governance changes -- unless the
 * scenario also closes a school, in which case that school's lines drop out entirely.
 * That interaction is the point of the whole layer.
 */
export function rollUpToDistrict(results: SmallSparseResult[]): {
  amount: number | null;
  suppressedCount: number;
  contributingSchools: string[];
  note: string | null;
} {
  const contributing = results.filter(
    (r) => r.grant.small.amount !== null || r.grant.sparse.amount !== null
  );
  const suppressedCount = results.length - contributing.length;

  if (contributing.length === 0) {
    return {
      amount: null,
      suppressedCount,
      contributingSchools: [],
      note: UNDETERMINED,
    };
  }

  const amount = contributing.reduce(
    (sum, r) => sum + (r.grant.small.amount ?? 0) + (r.grant.sparse.amount ?? 0),
    0
  );

  return {
    amount,
    suppressedCount,
    contributingSchools: contributing.map((r) => r.school),
    note:
      suppressedCount > 0
        ? `${suppressedCount} of ${results.length} schools are excluded from this total because their eligibility is undetermined. ` +
          `The figure is a floor under the stated assumptions, not a projection.`
        : null,
  };
}
