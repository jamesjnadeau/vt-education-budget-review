/**
 * Scenario composition: merging districts.
 *
 * Two rules from the plan govern this file.
 *
 * FIRST -- the tool computes and explains; it never scores, ranks or
 * recommends. There is no `savings` field anywhere in these types, and there
 * will not be one. A scenario produces a `delta`, a signed number, and the
 * presentation layer shows movement in both directions with equal weight.
 *
 * SECOND -- the merger math runs on published totals only. Districts do not
 * slice their budgets the same way, so a line-by-line model would compare
 * figures that are not comparable. The headline delta is a single consolidation
 * factor applied to the combined published total expenditure.
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

export interface DistrictBudget {
  readonly entity: string;
  readonly fiscal_year: number;
  /** Total expenditure as published. The figure the merger math runs on. */
  readonly total_stated: number | null;
  readonly source: string;
}

export interface ScenarioSpec {
  readonly name: string;
  readonly districts: readonly DistrictBudget[];
  readonly assumptions: readonly Assumption[];
}

/**
 * The defaults a scenario starts from.
 *
 * The consolidation factor starts at 1.0 -- no change -- so any movement shown
 * is one the user chose and can see, never one the tool assumed for them.
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
  readonly assumptions: readonly Assumption[];
  /** Everything the user should know before quoting this result at a meeting. */
  readonly caveats: readonly string[];
}

export function runScenario(ctx: EngineContext, spec: ScenarioSpec): ScenarioResult {
  const currentValue = totalOf(spec.districts, (d) => d.total_stated);
  const currentTotal = input(ctx, 'Total expenditure, current structure', currentValue, 'usd', {
    source: spec.districts.map((d) => d.source).join('; '),
    notes: [
      'The sum of each district’s published total expenditure. Districts do not ' +
        'slice their budgets the same way, so only the published totals are summed.',
    ],
  });

  const factor = assumptionValue(spec, 'consolidation_factor');
  const multiplier = input(ctx, assumptionLabel(spec, 'consolidation_factor'), factor, 'multiplier', {
    source: 'scenario assumption',
  });
  const scenarioTotal = product(ctx, 'Total expenditure, scenario', currentTotal, multiplier, 'usd');
  const delta = difference(ctx, 'Change in total expenditure', scenarioTotal, currentTotal, 'usd');

  return {
    name: spec.name,
    currentTotal,
    scenarioTotal,
    delta,
    assumptions: spec.assumptions.length > 0 ? spec.assumptions : defaultAssumptions(),
    caveats: buildCaveats(),
  };
}

function assumptionLabel(spec: ScenarioSpec, key: string): string {
  const all = [...spec.assumptions, ...defaultAssumptions()];
  return all.find((a) => a.key === key)?.label ?? key;
}

function buildCaveats(): string[] {
  return [
    'This scenario changes district boundaries on paper. It does not model the ' +
      'transition costs of getting there: contract harmonization, severance, ' +
      'systems integration, or the multi-year period in which two structures ' +
      'run in parallel.',
    'The headline delta is a single consolidation factor applied to the combined ' +
      'published total expenditure. The tool does not model which functions change ' +
      'or by how much, and it does not separate debt service, construction aid or ' +
      'transportation routing, all of which are out of scope for version 1.',
  ];
}
