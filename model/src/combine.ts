/**
 * The combiner: pools taxing districts into one hypothetical district and
 * compares every member town's homestead rate today with its rate pooled.
 *
 * Both sides of each comparison come from this engine's own chain (`tax.ts`),
 * never from the published rate. The engine and the Department of Taxes do not
 * agree for every district, so comparing a published "today" with a computed
 * "pooled" would mix that disagreement into the pooling effect. Holding both
 * sides to one chain means the change shown comes from pooling and the
 * assumptions listed with it, not from that disagreement.
 *
 * The rules this file keeps:
 *
 * - Membership is pooled band by band and year by year, and the weights run on
 *   the pooled counts (see `combineMembership`). Pooling is not a sum of the
 *   members' weighted membership.
 * - Only published figures are pooled. A blank in any member makes the pool
 *   blank, and the reason names the member it came from. Nothing is guessed.
 * - There is no `savings` field, as in `scenario.ts`. A town's change is a
 *   signed number, and it moves both ways with equal weight.
 * - Every assumption is a labelled register entry with its rationale.
 */

import {
  combineMembership,
  computeWeightedMembership,
  perPupilEducationSpending,
  type AdmYear,
  type MembershipInput,
  type MembershipResult,
  type SmallSchool,
} from './membership.ts';
import { collectBlockers, createContext, input, product, relabel, sum } from './node.ts';
import { defaultAssumptions, type Assumption } from './scenario.ts';
import { townRate, type ExcessSpendingAdjustments, type TownRateResult, type TownTaxInput } from './tax.ts';
import type { Blocker, CalcNode, EngineContext, ParameterSet } from './types.ts';

export interface CombinerMember {
  /** The taxing district's slug, `ud/...` or `town/...`. Every blank is named by it. */
  readonly entity: string;
  readonly membership: MembershipInput;
  /** Published education spending (AOE EdSpend). */
  readonly education_spending: number | null;
  /** Where `education_spending` came from, for the walkthrough. */
  readonly spending_source?: string;
  /** The member's own FY2025 Act 84 decrease from the AOE worksheet; 0 when it is not listed. */
  readonly act84_decrease: number | null;
  /** The towns this member district taxes, each with its own CLA. */
  readonly towns: readonly TownTaxInput[];
}

/**
 * Pooled counts the visitor enters, for a figure some member did not publish.
 *
 * Used for the pool only, and only for a count where some member's figure is
 * null: where every member published one, their sum wins and the entry is
 * ignored. A null entry leaves the pool blocked. Each member's rate today
 * still uses its own published count.
 */
export interface CombinerPooledInputs {
  readonly state_placed_fte: number | null;
  readonly poverty_185_fpl: number | null;
  readonly english_learners: number | null;
}

export interface CombinerOptions {
  /** Applied to the members' combined published education spending; 1 is no change. */
  readonly consolidation_factor: number;
  /** The pooled district's FY2025 Act 84 decrease. No published figure exists; see the assumption. */
  readonly pooled_act84_decrease: number;
  /** Persons per square mile across the pooled district. Null leaves the sparsity weights blank. */
  readonly pooled_persons_per_square_mile: number | null;
  readonly statewide_average_per_pupil: number | null;
  /** Act 183 excess spending adjustments, applied to the pooled district only. */
  readonly adjustments?: ExcessSpendingAdjustments;
  readonly pooled_inputs?: CombinerPooledInputs;
  /**
   * Counts whose entered figure is the page's own estimate from AOE town-level
   * counts (a lower limit where counts were withheld), not a typed number. Only
   * read where a count is entered because a member did not publish one.
   */
  readonly pooled_inputs_estimated?: Partial<Record<'poverty_185_fpl' | 'english_learners', boolean>>;
  /**
   * Every district that taxes each town, keyed by town slug. A town with more
   * than one is not computed: its rate blends those districts' rates, which
   * this engine does not model yet. A town that more than one member lists in
   * its `towns` is treated the same way, even if it is missing here.
   */
  readonly town_districts: Readonly<Record<string, readonly string[]>>;
}

export interface CombinerTownRow {
  readonly town: string;
  /** The member district that taxes this town today (the first to list it, where several do). */
  readonly district: string;
  readonly cla: number | null;
  /** The member's own rate for this town through the engine; null when it cannot be worked out. */
  readonly today: TownRateResult | null;
  /** The pooled district's rate for this town; null when it cannot be worked out. */
  readonly pooled: TownRateResult | null;
  /** Pooled billed rate less today's, per $100. Signed. */
  readonly delta: number | null;
  readonly direction: 'up' | 'down' | 'none' | null;
  /** Why a side is blank, naming the member or input. Null when both sides computed. */
  readonly notComputable: string | null;
}

export interface CombinerMemberResult {
  readonly entity: string;
  readonly membership: MembershipResult;
  readonly spending: CalcNode;
  readonly perPupil: CalcNode;
  /** Why `perPupil` is blank, naming this member's missing figures. Empty when it computed. */
  readonly reasons: readonly string[];
}

export interface CombinerResult {
  readonly pooled: {
    readonly membership: MembershipResult;
    readonly spending: CalcNode;
    readonly perPupil: CalcNode;
    /** Why `perPupil` is blank, naming the member each gap comes from. Empty when it computed. */
    readonly reasons: readonly string[];
  };
  readonly members: CombinerMemberResult[];
  readonly towns: CombinerTownRow[];
  readonly assumptions: Assumption[];
  readonly caveats: string[];
}

type Band = 'prekindergarten' | 'kindergarten_through_5' | 'grades_6_through_8' | 'grades_9_through_12';

/** The § 4010(d)(1) bands, with the labels `membership.ts` uses for them. */
const BANDS: ReadonlyArray<readonly [Band, string]> = [
  ['prekindergarten', 'prekindergarten'],
  ['kindergarten_through_5', 'kindergarten through grade five'],
  ['grades_6_through_8', 'grades six through eight'],
  ['grades_9_through_12', 'grades nine through 12'],
];

type PooledCount = keyof CombinerPooledInputs;

const COUNTS: ReadonlyArray<{ readonly key: PooledCount; readonly what: string; readonly unit: 'fte' | 'pupils' }> = [
  { key: 'state_placed_fte', what: 'State-placed students (full-time equivalent)', unit: 'fte' },
  { key: 'poverty_185_fpl', what: 'pupils at or below 185 percent of the federal poverty level', unit: 'pupils' },
  { key: 'english_learners', what: 'English learner pupils', unit: 'pupils' },
];

/** Blocker kinds that withhold a value; the others only qualify one (see `node.ts`). */
const BLOCKING: ReadonlySet<Blocker['kind']> = new Set([
  'unverified_parameter',
  'missing_input',
  'undetermined_determination',
  'not_computable',
]);

/** Below this a change in a rate per $100 is float noise, not a change. */
const NO_CHANGE = 1e-9;

export function runCombiner(
  params: ParameterSet,
  members: readonly CombinerMember[],
  opts: CombinerOptions,
): CombinerResult {
  const ctx = createContext(params);
  const transitionYear = params.parameters.has('tax.transition.phase_out_share');
  const holdHarmless = params.parameters.get('membership.hold_harmless_applies')?.value === true;
  const assumptions: Assumption[] = [consolidationAssumption(opts.consolidation_factor), act84Assumption(opts)];
  const enteredCounts: string[] = [];
  const estimatedCounts: string[] = [];

  // --- Pooled membership ---------------------------------------------------
  // Every member is given every fiscal year any member reports, so a member
  // missing a year blanks that year rather than letting the sum quietly count
  // the others alone.
  const allYears = [...new Set(members.flatMap((m) => m.membership.adm_years.map((y) => y.fiscal_year)))].sort(
    (a, b) => a - b,
  );
  const poolWindow = averagingWindow(params, allYears);
  const poolReasons: string[] = [];

  for (const y of poolWindow) {
    for (const m of members) {
      const year = m.membership.adm_years.find((a) => a.fiscal_year === y);
      if (!year) poolReasons.push(`${m.entity} has no average daily membership for FY${y}.`);
      else poolReasons.push(...withheldBands(m.entity, year));
    }
  }

  const counts: Partial<Record<PooledCount, number | null>> = {};
  for (const { key, what, unit } of COUNTS) {
    const missing = members.filter((m) => m.membership[key] === null).map((m) => m.entity);
    if (missing.length === 0) continue; // every member published one: their sum wins
    const entered = opts.pooled_inputs?.[key] ?? null;
    counts[key] = entered;
    if (entered === null) {
      for (const entity of missing) {
        poolReasons.push(`${entity}: the count of ${what} was not published, and no pooled figure was entered.`);
      }
    } else {
      const estimated = key !== 'state_placed_fte' && opts.pooled_inputs_estimated?.[key] === true;
      (estimated ? estimatedCounts : enteredCounts).push(what);
      assumptions.push({
        key: `pooled_inputs.${key}`,
        label: estimated
          ? `Pooled ${what}, estimated from AOE town-level counts, not published`
          : `Pooled ${what}, entered on this page, not published`,
        value: entered,
        unit,
        rationale:
          `${listed(missing)} did not publish a count of ${what}, so the pooled count cannot be ` +
          (estimated
            ? `summed from the members. This figure was estimated from AOE town-level counts (a lower limit where counts were withheld), not a published district figure, and is used for the pooled `
            : `summed from the members. This figure was entered on this page, not published, and is used for the pooled `) +
          `district only. Each member’s rate today still needs its own published count, so it is ` +
          `not worked out for ${listed(missing)}. Where every member publishes a count, their sum is ` +
          `used and an entry here is ignored.`,
        userAdjustable: true,
      });
    }
  }

  const priors = members.map((m) => m.membership.prior_year_weighted_membership ?? null);
  const pooledPrior = priors.every((p): p is number => p !== null) ? priors.reduce((a, b) => a + b, 0) : null;
  if (holdHarmless) {
    members.forEach((m, i) => {
      if (priors[i] === null) poolReasons.push(priorYearReason(m.entity));
    });
  }

  if (opts.pooled_persons_per_square_mile === null) {
    poolReasons.push(
      'The pooled district’s population density (persons per square mile) is blank, so the ' +
        'sparsity and small school weights cannot be worked out.',
    );
  }

  // Every member's named schools stay schools of the pooled district.
  const pooledSchools = members.flatMap((m) =>
    namedSchools(m.membership.small_schools).map((school) => ({ entity: m.entity, school, source: m.membership.source })),
  );
  const pooledBlankSchools = smallSchoolWeightMayApply(params, opts.pooled_persons_per_square_mile)
    ? pooledSchools.filter(({ school }) => school.average_two_year_enrollment === null)
    : [];
  for (const { entity, school } of pooledBlankSchools) poolReasons.push(blankSchoolReason(entity, school));

  const pooledMembership = blockBlankSmallSchools(
    ctx,
    combineMembership(
      ctx,
      members.map((m) => ({
        ...m.membership,
        entity: m.entity,
        adm_years: allYears.map((y) => m.membership.adm_years.find((a) => a.fiscal_year === y) ?? blankYear(y)),
      })),
      {
        entity: 'pool',
        persons_per_square_mile: opts.pooled_persons_per_square_mile,
        small_schools: pooledSchools.map(({ school }) => school),
        ...counts,
        prior_year_weighted_membership: pooledPrior,
      },
    ),
    pooledBlankSchools,
  );

  // --- Spending --------------------------------------------------------------
  const spendingNodes = members.map((m) =>
    input(ctx, `${m.entity} education spending`, m.education_spending, 'usd', {
      source: m.spending_source ?? 'published education spending',
    }),
  );
  for (const m of members) {
    if (m.education_spending === null) poolReasons.push(spendingReason(m.entity));
  }
  const pooledSpending = product(
    ctx,
    'Pooled education spending',
    sum(ctx, 'Combined published education spending', spendingNodes, 'usd'),
    input(ctx, 'Consolidation factor', opts.consolidation_factor, 'multiplier', {
      source: 'an assumption set on this page; 1.0 is no change',
    }),
    'usd',
  );
  const pooledPerPupil = perPupilEducationSpending(ctx, pooledSpending, pooledMembership.total);
  const pooledBlank = blankReasons(poolReasons, pooledPerPupil);

  // --- Each member alone, today ---------------------------------------------
  const memberResults: CombinerMemberResult[] = members.map((m, i) => {
    const ownSchools = namedSchools(m.membership.small_schools);
    const membership = blockBlankSmallSchools(
      ctx,
      computeWeightedMembership(ctx, { ...m.membership, entity: m.entity, small_schools: ownSchools }),
      ownBlankSchools(params, m).map((school) => ({ school, source: m.membership.source })),
    );
    const spending = spendingNodes[i] as CalcNode;
    const perPupil = perPupilEducationSpending(ctx, spending, membership.total);
    const named = [...memberMembershipReasons(params, m, holdHarmless)];
    if (m.education_spending === null) named.push(spendingReason(m.entity));
    return { entity: m.entity, membership, spending, perPupil, reasons: blankReasons(named, perPupil) };
  });

  // --- Town by town ----------------------------------------------------------
  const pooledAdjustments: ExcessSpendingAdjustments = opts.adjustments
    ? { ...opts.adjustments, weightedMembership: opts.adjustments.weightedMembership ?? pooledMembership.total }
    : {};
  const averageReason =
    opts.statewide_average_per_pupil === null
      ? ['The statewide average per pupil education spending has not been published for this year.']
      : [];

  const rows: CombinerTownRow[] = [];
  const multiDistrictTowns: string[] = [];
  const seen = new Set<string>();
  // Which members list each town. Two members listing one town means it is
  // taxed by both today, so its rate blends them, whatever town_districts says.
  const listedBy = new Map<string, string[]>();
  for (const m of members) {
    for (const t of m.towns) {
      const by = listedBy.get(t.town) ?? [];
      if (!by.includes(m.entity)) by.push(m.entity);
      listedBy.set(t.town, by);
    }
  }

  members.forEach((m, i) => {
    const member = memberResults[i] as CombinerMemberResult;
    for (const town of m.towns) {
      if (seen.has(town.town)) continue; // one row per town
      seen.add(town.town);

      const servedBy = [...new Set([...(opts.town_districts[town.town] ?? []), ...(listedBy.get(town.town) ?? [])])];
      if (servedBy.length > 1) {
        multiDistrictTowns.push(town.town);
        rows.push({
          town: town.town,
          district: m.entity,
          cla: town.cla,
          today: null,
          pooled: null,
          delta: null,
          direction: null,
          notComputable: `not computable yet: rate blends more than one district (${servedBy.join(', ')})`,
        });
        continue;
      }

      const today = townRate(
        ctx,
        member.perPupil,
        town,
        opts.statewide_average_per_pupil,
        {},
        { fy2025RateDecrease: m.act84_decrease, source: `${m.entity}, AOE Act 84 tax rate discount worksheet` },
      );
      const pooled = townRate(ctx, pooledPerPupil, town, opts.statewide_average_per_pupil, pooledAdjustments, {
        fy2025RateDecrease: opts.pooled_act84_decrease,
        source: 'an assumption set on this page for the pooled district',
      });

      const townReasons = [...averageReason];
      if (town.cla === null) townReasons.push(`${town.town}: the common level of appraisal is not on file.`);
      const todayNamed = [...member.reasons, ...townReasons];
      if (transitionYear && m.act84_decrease === null) {
        todayNamed.push(`${m.entity}: the FY2025 Act 84 homestead rate decrease was not supplied.`);
      }
      const pooledNamed = [...pooledBlank, ...townReasons];

      const todayRate = today.billedRate.value;
      const pooledRate = pooled.billedRate.value;
      const why: string[] = [];
      if (todayRate === null) {
        why.push(`Today’s rate cannot be worked out: ${blankReasons(todayNamed, today.billedRate).join(' ')}`);
      }
      if (pooledRate === null) {
        why.push(`The pooled rate cannot be worked out: ${blankReasons(pooledNamed, pooled.billedRate).join(' ')}`);
      }

      let delta: number | null = null;
      let direction: CombinerTownRow['direction'] = null;
      if (todayRate !== null && pooledRate !== null) {
        const change = pooledRate - todayRate;
        delta = Math.abs(change) < NO_CHANGE ? 0 : change;
        direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'none';
      }

      rows.push({
        town: town.town,
        district: m.entity,
        cla: town.cla,
        today: todayRate === null ? null : today,
        pooled: pooledRate === null ? null : pooled,
        delta,
        direction,
        notComputable: why.length > 0 ? why.join(' ') : null,
      });
    }
  });

  return {
    pooled: {
      membership: pooledMembership,
      spending: pooledSpending,
      perPupil: pooledPerPupil,
      reasons: pooledBlank,
    },
    members: memberResults,
    towns: rows,
    assumptions,
    caveats: caveats({
      transitionYear,
      enteredCounts,
      estimatedCounts,
      multiDistrictTowns,
      adjustments: opts.adjustments,
      anyToday: rows.some((r) => r.today !== null),
    }),
  };
}

/** The years § 4001(7) averages: the last N, selected as `membership.ts` selects them. */
function averagingWindow<T>(params: ParameterSet, years: readonly T[]): readonly T[] {
  const declared = params.parameters.get('membership.long_term_membership_years')?.value;
  return years.slice(-Math.max(1, typeof declared === 'number' ? declared : years.length));
}

function blankYear(fiscal_year: number): AdmYear {
  return {
    fiscal_year,
    prekindergarten: null,
    kindergarten_through_5: null,
    grades_6_through_8: null,
    grades_9_through_12: null,
  };
}

function withheldBands(entity: string, year: AdmYear): string[] {
  return BANDS.filter(([band]) => year[band] === null).map(
    ([, label]) =>
      `${entity}: FY${year.fiscal_year} average daily membership for ${label} is withheld or was not published.`,
  );
}

/** Named reasons a member's own weighted membership is blank. */
function memberMembershipReasons(params: ParameterSet, m: CombinerMember, holdHarmless: boolean): string[] {
  const out: string[] = [];
  const window = averagingWindow(params, m.membership.adm_years);
  if (window.length === 0) out.push(`${m.entity} has no average daily membership.`);
  for (const year of window) out.push(...withheldBands(m.entity, year));
  for (const { key, what } of COUNTS) {
    if (m.membership[key] === null) out.push(`${m.entity}: the count of ${what} was not published.`);
  }
  if (m.membership.persons_per_square_mile === null) {
    out.push(
      `${m.entity}: population density (persons per square mile) is blank, so the sparsity and ` +
        `small school weights cannot be worked out.`,
    );
  }
  for (const school of ownBlankSchools(params, m)) out.push(blankSchoolReason(m.entity, school));
  if (holdHarmless && (m.membership.prior_year_weighted_membership ?? null) === null) {
    out.push(priorYearReason(m.entity));
  }
  return out;
}

/** A school with no name is no school, as on `/model`: it is dropped, not weighted. */
function namedSchools(schools: readonly SmallSchool[]): SmallSchool[] {
  return schools.filter((s) => s.name.trim() !== '');
}

/**
 * Whether a district's density is at or under the § 4010(d)(5) ceiling, so a
 * small school weight could apply. False where the density or the ceiling is
 * unknown: `membership.ts` already blocks the total on that blank.
 */
function smallSchoolWeightMayApply(params: ParameterSet, density: number | null): boolean {
  const ceiling = params.parameters.get('weights.small_school.density_ceiling')?.value;
  return typeof ceiling === 'number' && density !== null && density <= ceiling;
}

function ownBlankSchools(params: ParameterSet, m: CombinerMember): SmallSchool[] {
  if (!smallSchoolWeightMayApply(params, m.membership.persons_per_square_mile)) return [];
  return namedSchools(m.membership.small_schools).filter((s) => s.average_two_year_enrollment === null);
}

/**
 * Closes a silent zero. `membership.ts` skips a small school whose average
 * two-year enrollment is blank: it adds no weight and no blocker, so the school
 * quietly counts for nothing. Where the weight could apply, each such school is
 * added to the total here as a blank weight instead, which blocks the total and
 * names the school. `/model` and `combineMembership` keep their own behaviour.
 */
function blockBlankSmallSchools(
  ctx: EngineContext,
  membership: MembershipResult,
  blank: ReadonlyArray<{ readonly school: SmallSchool; readonly source: string }>,
): MembershipResult {
  if (blank.length === 0) return membership;
  const weights = blank.map(({ school, source }) =>
    relabel(
      ctx,
      `Additional weighting for the small school ${school.name}`,
      input(ctx, `${school.name} average two-year enrollment`, null, 'pupils', { source }),
      'pupils',
    ),
  );
  const demographic = [...membership.demographicWeightIncrements, ...weights];
  const increments = [...membership.increments, ...weights];
  return {
    ...membership,
    increments,
    demographicWeightIncrements: demographic,
    demographicWeightTotal: sum(ctx, membership.demographicWeightTotal.label, demographic, 'pupils'),
    allWeightsTotal: sum(ctx, membership.allWeightsTotal.label, increments, 'pupils'),
    beforeHoldHarmless: sum(ctx, membership.beforeHoldHarmless.label, [membership.beforeHoldHarmless, ...weights], 'pupils'),
    total: sum(ctx, membership.total.label, [membership.total, ...weights], 'pupils'),
  };
}

function blankSchoolReason(entity: string, school: SmallSchool): string {
  return (
    `${entity}: the small school ${school.name} has no average two-year enrollment, so its ` +
    `small school weight cannot be worked out.`
  );
}

function priorYearReason(entity: string): string {
  return (
    `${entity}: the previous year’s weighted long-term membership was not supplied, and the ` +
    `hold harmless floor is in force this year.`
  );
}

function spendingReason(entity: string): string {
  return `${entity}: education spending was not published.`;
}

/**
 * Why a blank node is blank: the named reasons first, then anything they do not
 * cover. A named reason only ever describes a missing figure, so when there
 * are some, only the blockers of other kinds (an unverified parameter, an
 * undetermined decision) are added; when there are none, every blocking
 * blocker's own detail is used, so a blank is never left unexplained.
 */
function blankReasons(named: readonly string[], node: CalcNode): string[] {
  if (node.value !== null) return [];
  const blocking = collectBlockers(node).filter((b) => BLOCKING.has(b.kind));
  const extra =
    named.length > 0
      ? blocking.filter((b) => b.kind === 'unverified_parameter' || b.kind === 'undetermined_determination')
      : blocking;
  const out = [...new Set([...named, ...extra.map((b) => b.detail)])];
  return out.length > 0 ? out : [`${node.label} could not be worked out.`];
}

function listed(entities: readonly string[]): string {
  if (entities.length <= 1) return entities.join('');
  return `${entities.slice(0, -1).join(', ')} and ${entities[entities.length - 1]}`;
}

function consolidationAssumption(value: number): Assumption {
  const base = defaultAssumptions().find((a) => a.key === 'consolidation_factor');
  if (!base) throw new Error('The consolidation_factor assumption is missing from defaultAssumptions().');
  return { ...base, value };
}

function act84Assumption(opts: CombinerOptions): Assumption {
  return {
    key: 'pooled_act84_decrease',
    label: 'FY2025 Act 84 homestead rate decrease for the pooled district',
    value: opts.pooled_act84_decrease,
    unit: 'rate_per_100',
    rationale:
      'The Act 84 transition decrease is a figure the Agency of Education worked out once, ' +
      'district by district, from the drop in each district’s share of long-term weighted ' +
      'membership (2024 Acts No. 84, Sec. 3(b)). A pooled district does not exist, so ' +
      'it is not on the Agency’s FY2025 worksheet, and the statute text this project has ' +
      'snapshotted does not say what a newly formed district would get. It starts at 0, the ' +
      'figure for a district not on the worksheet, and you can change it. Each member’s rate ' +
      'today uses its own published decrease. In a year without the transition it has no effect.',
    userAdjustable: true,
  };
}

function caveats(args: {
  readonly transitionYear: boolean;
  readonly enteredCounts: readonly string[];
  readonly estimatedCounts: readonly string[];
  readonly multiDistrictTowns: readonly string[];
  readonly adjustments: ExcessSpendingAdjustments | undefined;
  /** True when at least one town row has a rate today; only then is there a change to explain. */
  readonly anyToday: boolean;
}): string[] {
  const out = [
    args.anyToday
      ? 'This engine’s rates can differ from the rates the Department of Taxes published for some ' +
        'districts. Where a town has both a rate today and a pooled rate here, both come from this ' +
        'engine, so the change shown comes from pooling and the assumptions listed. The published ' +
        'rate is not the starting point.'
      : 'No rate today was worked out for any town here, so no change is shown. The pooled rates ' +
        'rest on figures entered on this page, and they can differ a lot from the rates the ' +
        'Department of Taxes published. They cannot be compared with the published rates.',
    'Spending is held at the members’ combined published education spending times the ' +
      'consolidation factor. It is not a forecast of what a pooled board would budget.',
    'Sparsity and small school weights belong to the pooled district, not its members, so ' +
      'the pooled district’s population density is an input. Pooling can gain or lose those ' +
      'weights.',
  ];
  if (args.transitionYear) {
    out.push(
      'This year the Act 84 transition lowers some districts’ rates. Each member keeps its own ' +
        'decrease today. The pooled district uses the decrease set on this page, which starts at 0 ' +
        'because no published figure exists for a district that has not been formed.',
    );
  }
  if (args.enteredCounts.length > 0) {
    out.push(
      `Some pooled counts were entered on this page, not published: ${listed(args.enteredCounts)}. ` +
        'They are labelled in the assumptions.',
    );
  }
  if (args.estimatedCounts.length > 0) {
    out.push(
      `Some pooled counts were estimated from AOE town-level counts, not published for the districts: ${listed(args.estimatedCounts)}. ` +
        'They are labelled in the assumptions.',
    );
  }
  if (args.multiDistrictTowns.length > 0) {
    out.push(
      `Some towns are taxed by more than one district, and their rate blends those districts’ ` +
        `rates: ${listed(args.multiDistrictTowns)}. The engine does not model that blend yet, so ` +
        `they are shown as not computable rather than given a number.`,
    );
  }
  const adj = args.adjustments;
  if (
    adj &&
    ((adj.capitalReserveFivePlusYears !== undefined && adj.capitalReserveFivePlusYears !== null) ||
      (adj.bondExclusionPreJuly2024 !== undefined && adj.bondExclusionPreJuly2024 !== null))
  ) {
    out.push(
      'The excess spending adjustments you entered (capital reserve draws, bonds approved before ' +
        'July 1, 2024) are applied to the pooled district only. Each member’s rate today is ' +
        'worked out without them.',
    );
  }
  return out;
}
