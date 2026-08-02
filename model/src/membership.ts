/**
 * Weighted long-term membership, per 16 V.S.A. § 4010.
 *
 * The structure here was corrected against the statute text snapshotted in
 * model/statute/2026-07-29/16-vsa-4010.txt. Three things about it are easy to
 * get wrong, and getting any of them wrong produces confident nonsense:
 *
 * 1. THE WEIGHTS ARE ADDITIVE, NOT MULTIPLICATIVE. § 4010(d)(6): "A school
 *    district's weighted long-term membership shall equal long-term membership
 *    plus the cumulation of the weights assigned by the Secretary under this
 *    subsection." A weight of 0.36 for grades 6-8 adds 0.36 per pupil on top of
 *    the pupil already being counted once. Treating it as a multiplier -- ADM
 *    times 0.36 -- would shrink the count rather than enlarge it.
 *
 *    The effective count per pupil is therefore 1 + the weight:
 *
 *        prekindergarten   1 - 0.54  =  0.46
 *        K-5               1 + 0     =  1.00
 *        grades 6-8        1 + 0.36  =  1.36
 *        grades 9-12       1 + 0.39  =  1.39
 *
 *    The prekindergarten line is the one that catches people. The statute says
 *    "prekindergarten—negative 0.54", which reads as though a prek pupil counts
 *    as -0.54. It does not: the pupil is already counted once, so the effective
 *    figure is 0.46 -- a prek pupil is 0.46 of a K-5 pupil. Reading it the other
 *    way flips the sign on every prekindergarten pupil in the state.
 *
 * 2. KINDERGARTEN THROUGH GRADE FIVE HAS NO WEIGHT. § 4010(d)(1) assigns grade
 *    weights only to prekindergarten, grades 6-8 and grades 9-12. K-5 is a
 *    counting category under § 4010(b)(1)(B) but carries zero, and is the
 *    baseline the other grade weights are increments against.
 *
 * 3. LONG-TERM MEMBERSHIP IS NOT A PLAIN AVERAGE. § 4001(7) defines it as the
 *    two-year average of average daily membership EXCLUDING State-placed
 *    students, plus the State-placed FTE for the most recent of the two years.
 *    State-placed students are added at their current-year count, not averaged.
 *
 * A fourth thing is date-scoped rather than permanent, and so lives in the
 * parameter files rather than in this code: § 4010(e) hold harmless floors a
 * district's weighted membership at 96.5 percent of its previous year. The
 * subsection is marked "not in effect July 1, 2025-June 30, 2029", so it binds
 * in FY2025 and is switched off for FY2026 through FY2029. Encoding that as
 * data means a back-year is computed correctly without anyone remembering to
 * special-case it.
 *
 * The prekindergarten weight is presently unverifiable: § 4010(d)(1) has a
 * version effective July 1, 2026 if the Act 73 contingency is met, in which
 * prekindergarten is repealed. That date falls inside FY2027. The parameter is
 * therefore left unverified, and this module will decline to produce a total
 * until someone establishes which version governs. That refusal is correct --
 * the answer genuinely is not known.
 */

import { applyWeight, greaterOf, input, mean, parameterNode, quotient, sum } from './node.ts';
import type { CalcNode, EngineContext } from './types.ts';

/** Average daily membership by grade band, EXCLUDING State-placed students. */
export interface AdmYear {
  readonly fiscal_year: number;
  readonly prekindergarten: number | null;
  readonly kindergarten_through_5: number | null;
  readonly grades_6_through_8: number | null;
  readonly grades_9_through_12: number | null;
}

export interface SmallSchool {
  readonly name: string;
  /** § 4010(b)(3)(B): average enrollment of the two most recently completed school years. */
  readonly average_two_year_enrollment: number | null;
}

export interface MembershipInput {
  readonly entity: string;
  /** Ordered oldest to newest; the two most recent are averaged. */
  readonly adm_years: readonly AdmYear[];
  /** § 4001(7)(B): State-placed FTE for the most recent year, added not averaged. */
  readonly state_placed_fte: number | null;
  readonly poverty_185_fpl: number | null;
  readonly english_learners: number | null;
  /** § 4010(b)(2): persons per square mile within the district's boundaries. */
  readonly persons_per_square_mile: number | null;
  readonly small_schools: readonly SmallSchool[];
  /**
   * The district's actual weighted long-term membership in the previous year,
   * needed only where § 4010(e) hold harmless is in force. Supply null when it
   * is not known: in a year the floor applies, an unknown prior year makes the
   * result unknown rather than unfloored, because a floor that silently does
   * not bind is indistinguishable from one that does not exist.
   */
  readonly prior_year_weighted_membership?: number | null;
  readonly source: string;
}

export interface MembershipResult {
  readonly longTermMembership: CalcNode;
  /** Each statutory weight, expressed as the pupils it adds. */
  readonly increments: readonly CalcNode[];
  /** The four § 4010(d)(1) grade-band increments: prek, K-5, 6-8, 9-12. */
  readonly gradeWeightIncrements: readonly CalcNode[];
  /** The remaining § 4010(d) weights: poverty, English learner, sparsity, small school. */
  readonly demographicWeightIncrements: readonly CalcNode[];
  /** Sum of the grade-band increments — extra pupils from grade weights. */
  readonly gradeWeightTotal: CalcNode;
  /** Sum of the demographic/district increments — extra pupils from those weights. */
  readonly demographicWeightTotal: CalcNode;
  /** Sum of every weight increment (grade + demographic). */
  readonly allWeightsTotal: CalcNode;
  /**
   * The plain student count entered across the averaged years, before averaging
   * and before State-placed students are added. Shown on the site so a reader
   * can see the two-year average halve it; not a statutory quantity itself.
   */
  readonly enteredHeadcountBothYears: CalcNode;
  /** Before the § 4010(e) floor. Equal to `total` in years the floor is off. */
  readonly beforeHoldHarmless: CalcNode;
  /** The § 4010(e) floor, or null in years it does not apply. */
  readonly holdHarmlessFloor: CalcNode | null;
  readonly total: CalcNode;
}

type Band = 'prekindergarten' | 'kindergarten_through_5' | 'grades_6_through_8' | 'grades_9_through_12';

const BANDS: ReadonlyArray<{ readonly key: Band; readonly label: string; readonly weight: string }> = [
  { key: 'prekindergarten', label: 'prekindergarten', weight: 'weights.grade.prekindergarten' },
  {
    key: 'kindergarten_through_5',
    label: 'kindergarten through grade five',
    weight: 'weights.grade.kindergarten_through_5',
  },
  { key: 'grades_6_through_8', label: 'grades six through eight', weight: 'weights.grade.6_through_8' },
  { key: 'grades_9_through_12', label: 'grades nine through 12', weight: 'weights.grade.9_through_12' },
];

/**
 * Two-year average of a grade band's average daily membership.
 *
 * The window is a parameter rather than a literal 2, so a change to § 4001(7)
 * is a YAML edit. An unverified window blocks the average, because averaging
 * over the wrong number of years is simply the wrong number.
 */
function bandLongTermMembership(ctx: EngineContext, data: MembershipInput, band: Band, label: string): CalcNode {
  const windowParam = ctx.parameters.parameters.get('membership.long_term_membership_years');
  const declared = typeof windowParam?.value === 'number' ? windowParam.value : null;
  const rule = parameterNode(ctx, 'membership.long_term_membership_years', 'years');

  const selected = data.adm_years.slice(-Math.max(1, declared ?? data.adm_years.length));
  const years = selected.map((y) =>
    input(ctx, `FY${y.fiscal_year} average daily membership, ${label}`, y[band], 'pupils', {
      source: data.source,
    }),
  );

  if (years.length === 0) {
    return input(ctx, `Long-term membership, ${label}`, null, 'pupils', {
      notes: ['No years of average daily membership were supplied for this district.'],
    });
  }

  const averaged = mean(ctx, `Long-term membership, ${label}`, years, 'pupils');

  // Fold the rule's own verification status in without changing the arithmetic.
  return sum(
    ctx,
    `Long-term membership under the statutory averaging rule, ${label}`,
    [averaged, ruleAsZero(ctx, rule)],
    'pupils',
  );
}

/**
 * Carries a parameter's blockers into a calculation while contributing nothing.
 *
 * Keyed off the node's BLOCKERS rather than its value: a rule can be perfectly
 * well established and still have no numeric value, as a boolean switch like
 * `hold_harmless_applies` does. Testing the value instead would read `false` as
 * "unknown" and null out the whole calculation.
 */
function ruleAsZero(ctx: EngineContext, node: CalcNode): CalcNode {
  const blocked = node.blockers.some((b) => b.kind !== 'contingent_parameter');
  return {
    ...node,
    id: ctx.nextId(),
    label: `${node.label} (applied as a rule, contributing no pupils)`,
    value: blocked ? null : 0,
    unit: 'pupils',
    inputs: [],
  };
}

/** § 4010(d)(4): the density band a district falls in, or null if none applies. */
export function sparsityBand(personsPerSquareMile: number | null): string | null {
  if (personsPerSquareMile === null) return null;
  if (personsPerSquareMile < 36) return 'weights.sparsity.density_under_36';
  if (personsPerSquareMile < 55) return 'weights.sparsity.density_36_to_55';
  if (personsPerSquareMile < 100) return 'weights.sparsity.density_55_to_100';
  return null;
}

/** § 4010(d)(5): the small-school tier a school falls in, or null if none applies. */
export function smallSchoolTier(averageTwoYearEnrollment: number | null): string | null {
  if (averageTwoYearEnrollment === null) return null;
  if (averageTwoYearEnrollment < 100) return 'weights.small_school.enrollment_under_100';
  if (averageTwoYearEnrollment < 250) return 'weights.small_school.enrollment_100_to_250';
  return null;
}

export function computeWeightedMembership(ctx: EngineContext, data: MembershipInput): MembershipResult {
  // --- Long-term membership, § 4001(7) -------------------------------------
  const bandMemberships = new Map<Band, CalcNode>();
  for (const band of BANDS) {
    bandMemberships.set(band.key, bandLongTermMembership(ctx, data, band.key, band.label));
  }

  const statePlaced = input(
    ctx,
    'State-placed students, full-time equivalent, most recent year',
    data.state_placed_fte,
    'pupils',
    {
      source: data.source,
      notes: [
        'State-placed students are excluded from the two-year average and added at ' +
          'their most recent year’s count, per 16 V.S.A. § 4001(7)(B).',
      ],
    },
  );

  const longTermMembership = sum(
    ctx,
    'Long-term membership',
    [...bandMemberships.values(), statePlaced],
    'pupils',
  );

  // --- Weights, § 4010(d). Every one is an ADDITIONAL amount. --------------
  // Grade-band weights, § 4010(d)(1), kept as their own group so the site can
  // show grade weighting apart from the demographic and district weights.
  const gradeWeightIncrements: CalcNode[] = [];
  for (const band of BANDS) {
    const membership = bandMemberships.get(band.key);
    if (!membership) continue;
    gradeWeightIncrements.push(
      applyWeight(ctx, `Additional weighting for ${band.label}`, membership, band.weight, 'pupils'),
    );
  }

  // Everything else § 4010(d) adds: poverty, English learner, sparsity, small school.
  const demographicWeightIncrements: CalcNode[] = [];

  demographicWeightIncrements.push(
    applyWeight(
      ctx,
      'Additional weighting for pupils at or below 185 percent of the federal poverty level',
      input(
        ctx,
        'Pupils whose family is at or below 185 percent of FPL',
        data.poverty_185_fpl,
        'pupils',
        { source: data.source },
      ),
      'weights.poverty_185_fpl',
      'pupils',
    ),
  );

  demographicWeightIncrements.push(
    applyWeight(
      ctx,
      'Additional weighting for English learner pupils',
      input(ctx, 'English learner pupils', data.english_learners, 'pupils', { source: data.source }),
      'weights.english_learner',
      'pupils',
    ),
  );

  // Sparsity applies to every pupil in a qualifying district, not a subset.
  const density = input(
    ctx,
    'Persons per square mile in the district',
    data.persons_per_square_mile,
    'count',
    { source: data.source },
  );
  const band = sparsityBand(data.persons_per_square_mile);
  if (band) {
    demographicWeightIncrements.push(
      applyWeight(ctx, 'Additional weighting for low population density', longTermMembership, band, 'pupils'),
    );
  } else {
    demographicWeightIncrements.push(
      input(
        ctx,
        'Additional weighting for low population density',
        data.persons_per_square_mile === null ? null : 0,
        'pupils',
        {
          source: 'computed from district population density',
          notes:
            data.persons_per_square_mile === null
              ? ['District population density was not supplied, so the sparsity weight cannot be determined.']
              : ['This district is at or above 100 persons per square mile, so no sparsity weight applies.'],
        },
      ),
    );
  }

  // Small schools, gated on the district's density, § 4010(d)(5).
  const ceiling = parameterNode(ctx, 'weights.small_school.density_ceiling', 'count');
  const eligibleForSmallSchool =
    ceiling.value !== null && data.persons_per_square_mile !== null
      ? data.persons_per_square_mile <= ceiling.value
      : null;

  if (eligibleForSmallSchool === true) {
    for (const school of data.small_schools) {
      const tier = smallSchoolTier(school.average_two_year_enrollment);
      if (!tier) continue;
      demographicWeightIncrements.push(
        applyWeight(
          ctx,
          `Additional weighting for the small school ${school.name}`,
          input(
            ctx,
            `${school.name} average two-year enrollment`,
            school.average_two_year_enrollment,
            'pupils',
            { source: data.source },
          ),
          tier,
          'pupils',
        ),
      );
    }
  } else if (eligibleForSmallSchool === null) {
    demographicWeightIncrements.push(
      input(ctx, 'Additional weighting for small schools', null, 'pupils', {
        notes: [
          'District population density was not supplied, so small school eligibility ' +
            'cannot be determined. The weight applies only where the district has 55 or ' +
            'fewer persons per square mile.',
        ],
      }),
    );
  }

  const increments = [...gradeWeightIncrements, ...demographicWeightIncrements];

  // The plain count entered across the averaged years, before averaging. Uses
  // the same averaging window the bands do, so the site can show the two-year
  // average halving it. Built from input nodes so a missing band blanks it.
  const windowParam = ctx.parameters.parameters.get('membership.long_term_membership_years');
  const declaredWindow = typeof windowParam?.value === 'number' ? windowParam.value : null;
  const windowYears = data.adm_years.slice(-Math.max(1, declaredWindow ?? data.adm_years.length));
  const enteredHeadcountBothYears = sum(
    ctx,
    'Students entered across the averaged years',
    windowYears.flatMap((y) =>
      BANDS.map((b) => input(ctx, `FY${y.fiscal_year} ${b.label}`, y[b.key], 'pupils', { source: data.source })),
    ),
    'pupils',
  );

  // --- § 4010(d)(6) --------------------------------------------------------
  const beforeHoldHarmless = sum(
    ctx,
    'Weighted long-term membership before the hold harmless floor',
    [longTermMembership, ...increments],
    'pupils',
  );

  // --- § 4010(e) hold harmless ---------------------------------------------
  const { floor, total } = applyHoldHarmless(ctx, beforeHoldHarmless, data);

  const gradeWeightTotal = sum(ctx, 'Extra pupils from grade weights', gradeWeightIncrements, 'pupils');
  const demographicWeightTotal = sum(ctx, 'Extra pupils from demographic weights', demographicWeightIncrements, 'pupils');
  const allWeightsTotal = sum(ctx, 'Extra pupils from all weights', increments, 'pupils');

  return {
    longTermMembership,
    increments,
    gradeWeightIncrements,
    demographicWeightIncrements,
    gradeWeightTotal,
    demographicWeightTotal,
    allWeightsTotal,
    enteredHeadcountBothYears,
    beforeHoldHarmless,
    holdHarmlessFloor: floor,
    total,
  };
}

/**
 * § 4010(e): weighted long-term membership may not fall below 96.5 percent of
 * the district's actual weighted long-term membership the previous year.
 *
 * Whether the floor is in force is itself a parameter, because it is date
 * scoped rather than permanent -- the subsection is marked "not in effect
 * July 1, 2025-June 30, 2029", so it binds in FY2025 and is switched off for
 * FY2026 through FY2029. Encoding that as data means the engine does the right
 * thing for a back-year without anyone remembering to special-case it.
 *
 * A district that is growing is unaffected: the floor only ever raises a
 * result, never lowers one. Where it binds, it is shown as its own step so the
 * walkthrough can say plainly that the figure is a statutory minimum rather
 * than the district's computed membership.
 */
function applyHoldHarmless(
  ctx: EngineContext,
  computed: CalcNode,
  data: MembershipInput,
): { floor: CalcNode | null; total: CalcNode } {
  const applies = parameterNode(ctx, 'membership.hold_harmless_applies', 'none');
  const appliesValue = ctx.parameters.parameters.get('membership.hold_harmless_applies')?.value;

  if (appliesValue !== true) {
    // Not in force. Relabel so the caller always has a node named for the
    // final figure, and carry the parameter's own verification status.
    return {
      floor: null,
      total: sum(ctx, 'Weighted long-term membership', [computed, ruleAsZero(ctx, applies)], 'pupils'),
    };
  }

  const prior = input(
    ctx,
    'Weighted long-term membership in the previous year',
    data.prior_year_weighted_membership ?? null,
    'pupils',
    {
      source: data.source,
      notes: [
        'The hold harmless floor is in force this year, so the previous year’s ' +
          'figure is required. Without it the floor cannot be tested, and a floor ' +
          'that silently fails to bind is indistinguishable from one that does not exist.',
      ],
    },
  );

  const floor = applyWeight(
    ctx,
    'Hold harmless floor',
    prior,
    'membership.hold_harmless_floor',
    'pupils',
  );

  return {
    floor,
    total: greaterOf(ctx, 'Weighted long-term membership', computed, floor, 'pupils'),
  };
}

/**
 * Weighted membership for a hypothetical combined district.
 *
 * Merging is not addition. Sparsity and small-school eligibility are properties
 * of the combined entity: density is recomputed across the merged land area,
 * and a merged district above 55 persons per square mile loses the small-school
 * weight its components may each have qualified for. The caller supplies the
 * combined density explicitly rather than having it guessed, and the assumption
 * is surfaced in the scenario's assumptions register.
 */
export function combineMembership(
  ctx: EngineContext,
  parts: readonly MembershipInput[],
  combined: {
    readonly entity: string;
    readonly persons_per_square_mile: number | null;
    /** Schools survive a merger unless a closure scenario removes them. */
    readonly small_schools: readonly SmallSchool[];
  },
): MembershipResult {
  const years = new Map<number, AdmYear>();
  for (const part of parts) {
    for (const y of part.adm_years) {
      const acc = years.get(y.fiscal_year) ?? {
        fiscal_year: y.fiscal_year,
        prekindergarten: 0,
        kindergarten_through_5: 0,
        grades_6_through_8: 0,
        grades_9_through_12: 0,
      };
      years.set(y.fiscal_year, {
        fiscal_year: y.fiscal_year,
        prekindergarten: addNullable(acc.prekindergarten, y.prekindergarten),
        kindergarten_through_5: addNullable(acc.kindergarten_through_5, y.kindergarten_through_5),
        grades_6_through_8: addNullable(acc.grades_6_through_8, y.grades_6_through_8),
        grades_9_through_12: addNullable(acc.grades_9_through_12, y.grades_9_through_12),
      });
    }
  }

  return computeWeightedMembership(ctx, {
    entity: combined.entity,
    adm_years: [...years.values()].sort((a, b) => a.fiscal_year - b.fiscal_year),
    state_placed_fte: parts.reduce<number | null>((acc, p) => addNullable(acc, p.state_placed_fte), 0),
    poverty_185_fpl: parts.reduce<number | null>((acc, p) => addNullable(acc, p.poverty_185_fpl), 0),
    english_learners: parts.reduce<number | null>((acc, p) => addNullable(acc, p.english_learners), 0),
    persons_per_square_mile: combined.persons_per_square_mile,
    small_schools: combined.small_schools,
    source: `combined from ${parts.map((p) => p.entity).join(', ')}`,
  });
}

/** Null is contagious: one district's missing count makes the combined count unknown. */
function addNullable(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  return a + b;
}

/** § 4010(f): per pupil education spending = education spending / weighted long-term membership. */
export function perPupilEducationSpending(
  ctx: EngineContext,
  educationSpending: CalcNode,
  weightedMembership: CalcNode,
): CalcNode {
  return quotient(
    ctx,
    'Per pupil education spending',
    educationSpending,
    weightedMembership,
    'usd_per_pupil',
  );
}

/** Retained for callers using the previous name. */
export const perWeightedPupil = perPupilEducationSpending;
