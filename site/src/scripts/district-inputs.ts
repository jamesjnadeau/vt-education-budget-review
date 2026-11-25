/**
 * What the what-if form may suggest for a district's four inputs: the
 * economic disadvantage count, English learners, density and the common level
 * of appraisal (CLA). Each input is a suggestion with a note, a choice the
 * reader must make, or a plain refusal. A demo number is never a plan.
 *
 * This is pure. The form decides what to do with a plan.
 */

import {
  combinedDensity,
  combinedDensityText,
  combinedSubgroupEstimate,
  nameOf,
  subgroupEstimateText,
  type CombinerData,
} from './combiner-view.ts';

export type InputField = 'econ' | 'el' | 'density' | 'cla';

export type InputPlan =
  | { kind: 'suggest'; value: number; note: string; tickByDefault: boolean }
  | { kind: 'choose'; choices: { town: string; label: string; cla: number }[]; note: string } // cla only
  | { kind: 'refuse'; reason: string };

const CLA_SOURCE = 'Vermont Department of Taxes, August 18, 2025';

const CLA_CHOOSE_NOTE =
  'Each town in this district has its own common level of appraisal. Pick your town.';

function refuse(reason: string): InputPlan {
  return { kind: 'refuse', reason };
}

function planCla(entity: string, data: CombinerData): InputPlan {
  const towns = data.districts[entity]?.towns ?? [];
  const held = towns.flatMap((slug) => {
    const cla = data.towns[slug]?.cla ?? null;
    return cla === null ? [] : [{ town: slug, label: nameOf(slug, data), cla }];
  });
  if (held.length === 0) return refuse('The common level of appraisal for this district is not published.');
  if (towns.length === 1) {
    const only = held[0] as (typeof held)[number];
    return {
      kind: 'suggest',
      value: only.cla,
      note: `Common level of appraisal for ${only.label}, ${CLA_SOURCE}.`,
      tickByDefault: true,
    };
  }
  return { kind: 'choose', choices: held, note: CLA_CHOOSE_NOTE };
}

export function planDistrictInputs(entity: string, data: CombinerData): Record<InputField, InputPlan> {
  const slugs = [entity];

  const frl = combinedSubgroupEstimate(slugs, data, 'frl');
  const econ: InputPlan =
    frl === null
      ? refuse('The free or reduced-price lunch count for this district is not published.')
      : {
          kind: 'suggest',
          value: frl.sum,
          note: subgroupEstimateText(frl, 'frl'),
          // Lunch counts are not the 185 percent poverty count the law uses.
          tickByDefault: false,
        };

  const ell = combinedSubgroupEstimate(slugs, data, 'ell');
  const el: InputPlan =
    ell === null
      ? refuse('The English learner count for this district is not published.')
      : {
          kind: 'suggest',
          value: ell.sum,
          note: subgroupEstimateText(ell, 'ell'),
          tickByDefault: ell.withheld.length === 0 && ell.missing.length === 0,
        };

  const d = combinedDensity(slugs, data);
  const density: InputPlan =
    d === null
      ? refuse('The population density for this district is not published.')
      : d.density2020 === null
        ? refuse(combinedDensityText(d))
        : { kind: 'suggest', value: d.density2020, note: combinedDensityText(d), tickByDefault: true };

  return { econ, el, density, cla: planCla(entity, data) };
}

/**
 * What the engine is told about the four district inputs: which of them hold a
 * ticked suggestion (an estimate) rather than the reader's own figure. The ids
 * are the form's; the keys are the engine's.
 */
export function districtInputEstimates(estimates: ReadonlyMap<string, { how: string; lowerLimit?: boolean }>): {
  membership: Partial<Record<'poverty_185_fpl' | 'english_learners' | 'persons_per_square_mile', string>>;
  cla: string | undefined;
} {
  const membership: Partial<Record<'poverty_185_fpl' | 'english_learners' | 'persons_per_square_mile', string>> = {};
  const econ = estimates.get('econ')?.how;
  if (econ !== undefined) membership.poverty_185_fpl = econ;
  const el = estimates.get('el')?.how;
  if (el !== undefined) membership.english_learners = el;
  const density = estimates.get('density')?.how;
  if (density !== undefined) membership.persons_per_square_mile = density;
  return { membership, cla: estimates.get('cla')?.how };
}

export interface SelectOption {
  readonly value: string;
  readonly text: string;
}

/** The town picker for a district with more than one common level of appraisal. Nothing is chosen. */
export function claSelectOptions(plan: InputPlan): SelectOption[] {
  if (plan.kind !== 'choose') return [];
  return [
    { value: '', text: 'Pick your town' },
    ...plan.choices.map((c) => ({ value: String(c.cla), text: `${c.label} — ${c.cla}` })),
  ];
}

export type FieldAction =
  | { kind: 'keep' }
  | { kind: 'suggest'; value: number; note: string; tick: boolean }
  | { kind: 'choose'; note: string }
  | { kind: 'refuse'; reason: string };

/** What the form does to one input on a district load. A number the reader typed is never touched. */
export function fieldAction(plan: InputPlan, edited: boolean): FieldAction {
  if (edited) return { kind: 'keep' };
  if (plan.kind === 'suggest') return { kind: 'suggest', value: plan.value, note: plan.note, tick: plan.tickByDefault };
  if (plan.kind === 'choose') return { kind: 'choose', note: plan.note };
  return { kind: 'refuse', reason: plan.reason };
}
