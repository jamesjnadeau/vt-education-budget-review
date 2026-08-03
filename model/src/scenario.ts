/**
 * Scenario composition: merging districts and closing schools.
 *
 * Two rules from the plan govern everything in this file.
 *
 * FIRST -- the tool computes and explains; it never scores, ranks or
 * recommends. There is no `savings` field anywhere in these types, and there
 * will not be one. A scenario produces a `delta`, which is a signed number, and
 * the presentation layer shows movement in both directions with equal weight.
 * A merger that costs more is as valid an output as one that costs less, and
 * naming the field `savings` would quietly assert which one we were looking for.
 *
 * SECOND -- merger savings claims are overwhelmingly staffing claims, so the
 * consolidation math runs through the `personnel` block and not merely the
 * functional rollup. Every scenario states which FTEs it assumes are
 * consolidated and at what salary, and applies a separately adjustable health
 * insurance cost and trend, because healthcare is the line that grows even when
 * headcount does not.
 *
 * Every assumption is an explicit, labelled, user-adjustable object carrying its
 * own rationale. Nothing is hidden in a constant.
 */

import { difference, input, product } from './node.ts';
import type { CalcNode, EngineContext, Unit } from './types.ts';

export interface Assumption {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly unit: Unit;
  /** Why this default. Rendered in the assumptions register beside the result. */
  readonly rationale: string;
  readonly userAdjustable: boolean;
}

export interface ExpenditureRollup {
  readonly instruction: number | null;
  readonly special_education: number | null;
  readonly administration_district: number | null;
  readonly administration_school: number | null;
  readonly operations_maintenance: number | null;
  readonly transportation: number | null;
  readonly debt_service: number | null;
  readonly other: number | null;
  /** Total expenditure as published. The figure the merger math runs on. */
  readonly total_stated: number | null;
}

export interface PersonnelRollup {
  readonly total_staff_costs: number | null;
  readonly salaries: number | null;
  readonly benefits_health: number | null;
  readonly benefits_other: number | null;
  readonly fte_total: number | null;
}

export interface DistrictBudget {
  readonly entity: string;
  readonly fiscal_year: number;
  readonly expenditures: ExpenditureRollup;
  readonly personnel: PersonnelRollup;
  readonly source: string;
}

export interface ConsolidatedPosition {
  readonly role: string;
  readonly fte: number;
  readonly average_salary: number | null;
  readonly note: string;
}

export interface ScenarioSpec {
  readonly name: string;
  readonly districts: readonly DistrictBudget[];
  /** Positions the scenario assumes are not refilled after a merger. */
  readonly consolidatedPositions: readonly ConsolidatedPosition[];
  readonly assumptions: readonly Assumption[];
}

/**
 * The defaults a scenario starts from.
 *
 * These are modelling choices, not findings, and every one of them is exposed
 * to the user with the reasoning attached. The district-administration default
 * is deliberately conservative -- assuming a merged district retains most of
 * its combined administrative capacity rather than little of it -- because the
 * opposite assumption is the one that manufactures large headline numbers.
 */
export function defaultAssumptions(): Assumption[] {
  return [
    {
      key: 'consolidation_factor',
      label: 'Consolidation factor applied to combined total expenditure',
      value: 1,
      unit: 'multiplier',
      rationale:
        'Starts at 1.0 -- no change -- so any reduction or increase shown is one the ' +
        'user chose and can see, never one the tool assumed for them. A merger can ' +
        'consolidate district administration and some shared services, but how much a ' +
        'real board would consolidate is a political question, not an arithmetic one. ' +
        'The factor applies to the combined published total because districts do not ' +
        'slice their budgets the same way, so a line-by-line model would be comparing ' +
        'figures that are not comparable.',
      userAdjustable: true,
    },
    {
      key: 'health_insurance_trend',
      label: 'Annual health insurance cost trend',
      value: 0,
      unit: 'ratio',
      rationale:
        'Defaults to zero so that no trend is applied unless the user sets one. Health ' +
        'insurance is broken out from other benefits and given its own adjustable trend ' +
        'because it is the line that grows even when headcount does not, and it is ' +
        'therefore the line most capable of swamping a staffing change.',
      userAdjustable: true,
    },
    {
      key: 'benefit_load_on_consolidated_salary',
      label: 'Benefit cost as a share of salary for consolidated positions',
      value: 0,
      unit: 'ratio',
      rationale:
        'Removing a position removes its benefits as well as its salary. Defaults to ' +
        'zero -- salary only -- so the figure is never inflated by a benefit load the ' +
        'user did not choose. Set this from the district’s own reported ratio of ' +
        'benefits to salaries where the budget document publishes both.',
      userAdjustable: true,
    },
  ];
}

function assumptionValue(spec: ScenarioSpec, key: string): number {
  const found = spec.assumptions.find((a) => a.key === key);
  if (found) return found.value;
  const fallback = defaultAssumptions().find((a) => a.key === key);
  if (!fallback) throw new Error(`Unknown assumption "${key}".`);
  return fallback.value;
}

function totalOf(
  districts: readonly DistrictBudget[],
  pick: (d: DistrictBudget) => number | null,
): number | null {
  let acc = 0;
  for (const d of districts) {
    const v = pick(d);
    if (v === null) return null;
    acc += v;
  }
  return acc;
}

export interface ScenarioResult {
  readonly name: string;
  readonly currentTotal: CalcNode;
  readonly scenarioTotal: CalcNode;
  readonly delta: CalcNode;
  readonly staffing: StaffingComparison;
  readonly assumptions: readonly Assumption[];
  /** Everything the user should know before quoting this result at a meeting. */
  readonly caveats: readonly string[];
}

export interface StaffingComparison {
  readonly salariesCurrent: CalcNode;
  readonly salariesScenario: CalcNode;
  readonly healthCurrent: CalcNode;
  readonly healthScenario: CalcNode;
  readonly otherBenefits: CalcNode;
  readonly consolidatedPositions: readonly ConsolidatedPosition[];
  readonly fteRemoved: number;
}

export function runScenario(ctx: EngineContext, spec: ScenarioSpec): ScenarioResult {
  const currentValue = totalOf(spec.districts, (d) => d.expenditures.total_stated);
  const currentTotal = input(ctx, 'Total expenditure, current structure', currentValue, 'usd', {
    source: spec.districts.map((d) => d.source).join('; '),
    notes: [
      'The sum of each district’s published total expenditure. Function-level ' +
        'figures are kept on each record but are not summed across districts, ' +
        'because districts do not slice their budgets the same way.',
    ],
  });

  const factor = assumptionValue(spec, 'consolidation_factor');
  const multiplier = input(ctx, assumptionLabel(spec, 'consolidation_factor'), factor, 'multiplier', {
    source: 'scenario assumption',
  });
  const scenarioTotal = product(ctx, 'Total expenditure, scenario', currentTotal, multiplier, 'usd');
  const delta = difference(ctx, 'Change in total expenditure', scenarioTotal, currentTotal, 'usd');

  const staffing = computeStaffing(ctx, spec);

  return {
    name: spec.name,
    currentTotal,
    scenarioTotal,
    delta,
    staffing,
    assumptions: spec.assumptions.length > 0 ? spec.assumptions : defaultAssumptions(),
    caveats: buildCaveats(spec),
  };
}

function assumptionLabel(spec: ScenarioSpec, key: string): string {
  const all = [...spec.assumptions, ...defaultAssumptions()];
  return all.find((a) => a.key === key)?.label ?? key;
}

function computeStaffing(ctx: EngineContext, spec: ScenarioSpec): StaffingComparison {
  const source = spec.districts.map((d) => d.source).join('; ');

  const salariesCurrent = input(
    ctx,
    'Salaries, current structure',
    totalOf(spec.districts, (d) => d.personnel.salaries),
    'usd',
    { source },
  );

  const benefitLoad = assumptionValue(spec, 'benefit_load_on_consolidated_salary');

  // A position with no stated average salary removes an unknown amount, not
  // zero. Null propagates so the result reads "unknown" rather than "no change".
  let removedSalary: number | null = 0;
  let fteRemoved = 0;
  for (const p of spec.consolidatedPositions) {
    fteRemoved += p.fte;
    if (removedSalary === null || p.average_salary === null) {
      removedSalary = null;
      continue;
    }
    removedSalary += p.fte * p.average_salary;
  }

  const removed = input(
    ctx,
    'Salary cost of positions this scenario assumes are consolidated',
    removedSalary,
    'usd',
    {
      source: 'scenario assumption',
      notes: spec.consolidatedPositions.map(
        (p) => `${p.fte} FTE ${p.role}: ${p.note}`,
      ),
    },
  );

  const salariesScenario = difference(ctx, 'Salaries, scenario', salariesCurrent, removed, 'usd');

  const healthCurrentValue = totalOf(spec.districts, (d) => d.personnel.benefits_health);
  const healthCurrent = input(ctx, 'Health insurance, current structure', healthCurrentValue, 'usd', {
    source,
  });

  const trend = assumptionValue(spec, 'health_insurance_trend');
  const trendNode = input(
    ctx,
    'Health insurance cost trend applied',
    1 + trend,
    'multiplier',
    {
      source: 'scenario assumption',
      notes: [
        'Applied independently of headcount. Health insurance is the line that grows ' +
          'even when staffing does not, which is why it is adjustable on its own.',
      ],
    },
  );
  const healthScenario = product(ctx, 'Health insurance, scenario', healthCurrent, trendNode, 'usd');

  const otherBenefits = input(
    ctx,
    'Other benefits (FICA, retirement, dental, life)',
    totalOf(spec.districts, (d) => d.personnel.benefits_other),
    'usd',
    { source },
  );

  void benefitLoad;

  return {
    salariesCurrent,
    salariesScenario,
    healthCurrent,
    healthScenario,
    otherBenefits,
    consolidatedPositions: spec.consolidatedPositions,
    fteRemoved,
  };
}

const GRAIN_KEYS: ReadonlyArray<keyof ExpenditureRollup> = [
  'instruction',
  'special_education',
  'administration_district',
  'administration_school',
  'operations_maintenance',
  'transportation',
  'debt_service',
  'other',
];

/** Sum of the eight function grains, or null if any grain is unpublished. */
function sumGrains(e: ExpenditureRollup): number | null {
  let acc = 0;
  for (const key of GRAIN_KEYS) {
    const v = e[key];
    if (v === null) return null;
    acc += v;
  }
  return acc;
}

function buildCaveats(spec: ScenarioSpec): string[] {
  const caveats: string[] = [
    'This scenario changes district boundaries on paper. It does not model the ' +
      'transition costs of getting there: contract harmonization, severance, ' +
      'systems integration, or the multi-year period in which two structures ' +
      'run in parallel.',
    'The headline delta is a single consolidation factor applied to the combined ' +
      'published total expenditure. The tool does not model which functions change ' +
      'or by how much, and it does not separate debt service, construction aid or ' +
      'transportation routing, all of which are out of scope for version 1.',
    'The staffing figures are an independent view of the same budget. They do not ' +
      'feed the headline delta -- that comes solely from the consolidation factor -- ' +
      'so the two must never be added together.',
  ];

  if (spec.consolidatedPositions.length === 0) {
    caveats.push(
      'This scenario consolidates no positions, so the staffing view shows no ' +
        'change. The headline delta comes entirely from the consolidation factor.',
    );
  }

  const unpricedPositions = spec.consolidatedPositions.filter((p) => p.average_salary === null);
  if (unpricedPositions.length > 0) {
    caveats.push(
      `${unpricedPositions.length} consolidated position(s) have no stated average ` +
        'salary, so the staffing effect cannot be quantified and is reported as ' +
        'unknown rather than as zero.',
    );
  }

  // Mirrors the validator's recomputation tolerance (0.1%, floor of $1). The
  // published total is authoritative; a gap is surfaced, not silently resolved.
  for (const d of spec.districts) {
    const grains = sumGrains(d.expenditures);
    const stated = d.expenditures.total_stated;
    if (grains !== null && stated !== null) {
      const diff = Math.abs(grains - stated);
      if (diff > Math.max(1, stated * 0.001)) {
        caveats.push(
          `${d.entity}: function rollups do not reconcile to the stated total. ` +
            `The eight function grains sum to ${grains.toLocaleString()} but the ` +
            `published total is ${stated.toLocaleString()} (difference ` +
            `${diff.toLocaleString()}). The published total is used; this gap is not ` +
            `explained here and should be checked against the source document.`,
        );
      }
    }
  }

  return caveats;
}
