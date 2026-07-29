/**
 * Weighted long-term membership (LTWADM).
 *
 * This is the calculation the walkthrough expands step by step: raw ADM by
 * grade band, the multi-year averaging rule, each statutory weight applied in
 * turn, and the total.
 *
 * STRUCTURAL CAVEAT, and it is not a small one: the shape of this calculation
 * -- which weights exist, whether they multiply or add, what they apply to --
 * is itself a reading of statute, not just the numbers plugged into it. The
 * structure here follows the categories the plan names (grade level,
 * economically deprived, English learner, sparsity, with special education
 * funded separately alongside). Both the structure AND the values must be
 * confirmed against current text of 16 V.S.A. ch. 133 before anything computed
 * here is published. See docs/parameter-verification.md.
 *
 * Until that confirmation happens every parameter carries verified: false, and
 * node.ts refuses to produce a number from an unverified parameter. The engine
 * will return a complete, correctly-shaped tree full of nulls -- which is the
 * honest output for this state, and a much better failure mode than a
 * plausible wrong number.
 */

import { applyWeight, input, mean, parameterNode, quotient, relabel, sum } from './node.ts';
import type { CalcNode, EngineContext } from './types.ts';

export interface AdmYear {
  readonly fiscal_year: number;
  readonly prek: number | null;
  readonly elementary: number | null;
  readonly secondary: number | null;
}

export interface EnglishLearnerCount {
  /** Proficiency level as the statute bands them, or 'newcomer_slife'. */
  readonly category: string;
  readonly count: number | null;
}

export interface MembershipInput {
  readonly entity: string;
  /** Ordered oldest to newest. The averaging rule takes the most recent N. */
  readonly adm_years: readonly AdmYear[];
  readonly economically_deprived: number | null;
  readonly english_learners: readonly EnglishLearnerCount[];
  readonly sparsity_eligible: boolean;
  readonly small_school_eligible: boolean;
  /** Where these counts came from, shown in the walkthrough. */
  readonly source: string;
}

export interface MembershipResult {
  readonly averagedByBand: Readonly<Record<'prek' | 'elementary' | 'secondary', CalcNode>>;
  readonly baseWeighted: CalcNode;
  readonly additions: readonly CalcNode[];
  readonly total: CalcNode;
}

type Band = 'prek' | 'elementary' | 'secondary';

const BAND_LABELS: Readonly<Record<Band, string>> = {
  prek: 'prekindergarten average daily membership',
  elementary: 'elementary average daily membership',
  secondary: 'secondary average daily membership',
};

const BAND_WEIGHT_KEYS: Readonly<Record<Band, string>> = {
  prek: 'weights.grade.prek',
  elementary: 'weights.grade.elementary',
  secondary: 'weights.grade.secondary',
};

/**
 * Averages a grade band's ADM across the statutory number of years.
 *
 * The averaging window is itself a parameter, so a change to the rule is a
 * YAML edit rather than a code change.
 */
function averageBand(ctx: EngineContext, data: MembershipInput, band: Band): CalcNode {
  const yearsParam = ctx.parameters.parameters.get('membership.averaging_years');
  const declaredYears = typeof yearsParam?.value === 'number' ? yearsParam.value : null;

  // Surface the rule itself as a node so the walkthrough can cite it, even
  // when its value is not yet known.
  const ruleNode = parameterNode(ctx, 'membership.averaging_years', 'years');

  const window = declaredYears ?? data.adm_years.length;
  const selected = data.adm_years.slice(-Math.max(1, window));

  const yearNodes = selected.map((y) =>
    input(ctx, `FY${y.fiscal_year} ${BAND_LABELS[band]}`, y[band], 'pupils', {
      source: data.source,
    }),
  );

  if (yearNodes.length === 0) {
    return input(ctx, `Averaged ${BAND_LABELS[band]}`, null, 'pupils', {
      notes: ['No years of membership data were supplied for this district.'],
    });
  }

  const averaged = mean(ctx, `Averaged ${BAND_LABELS[band]}`, yearNodes, 'pupils');

  // If the averaging rule is unverified the average must not stand as a
  // trustworthy figure, even though the arithmetic itself is trivial: an
  // average over the wrong window is simply the wrong number.
  return sum(ctx, `Averaged ${BAND_LABELS[band]} under the statutory rule`, [averaged, zeroOf(ctx, ruleNode)], 'pupils');
}

/**
 * Folds a parameter node's status into a calculation without altering its
 * arithmetic, by contributing a zero that carries the parameter's blockers.
 */
function zeroOf(ctx: EngineContext, node: CalcNode): CalcNode {
  return {
    ...node,
    id: ctx.nextId(),
    label: `${node.label} (applied as a rule, contributing no quantity)`,
    value: node.value === null ? null : 0,
    unit: 'pupils',
    inputs: [],
  };
}

export function computeWeightedMembership(ctx: EngineContext, data: MembershipInput): MembershipResult {
  const bands: Band[] = ['prek', 'elementary', 'secondary'];

  const averagedByBand = {} as Record<Band, CalcNode>;
  const weightedBands: CalcNode[] = [];

  for (const band of bands) {
    const averaged = averageBand(ctx, data, band);
    averagedByBand[band] = averaged;
    weightedBands.push(
      applyWeight(ctx, `Weighted ${BAND_LABELS[band]}`, averaged, BAND_WEIGHT_KEYS[band], 'pupils'),
    );
  }

  const baseWeighted = sum(ctx, 'Weighted membership before category weights', weightedBands, 'pupils');

  const additions: CalcNode[] = [];

  additions.push(
    applyWeight(
      ctx,
      'Additional weighting for economically deprived pupils',
      input(ctx, 'Pupils at or below 185% of the federal poverty level', data.economically_deprived, 'pupils', {
        source: data.source,
      }),
      'weights.economically_deprived',
      'pupils',
    ),
  );

  for (const el of data.english_learners) {
    const key =
      el.category === 'newcomer_slife'
        ? 'weights.english_learner_newcomer_slife'
        : 'weights.english_learner';
    additions.push(
      applyWeight(
        ctx,
        `Additional weighting for English learners (${el.category})`,
        input(ctx, `English learner pupils (${el.category})`, el.count, 'pupils', { source: data.source }),
        key,
        'pupils',
      ),
    );
  }

  if (data.sparsity_eligible) {
    additions.push(
      applyWeight(
        ctx,
        'Additional weighting for sparsity',
        relabel(ctx, 'Weighted membership subject to the sparsity weight', baseWeighted, 'pupils'),
        'weights.sparsity',
        'pupils',
      ),
    );
  }

  if (data.small_school_eligible) {
    additions.push(
      applyWeight(
        ctx,
        'Additional weighting for small school size',
        relabel(ctx, 'Weighted membership subject to the small school weight', baseWeighted, 'pupils'),
        'weights.small_school',
        'pupils',
      ),
    );
  }

  const total = sum(ctx, 'Weighted long-term membership', [baseWeighted, ...additions], 'pupils');

  return { averagedByBand, baseWeighted, additions, total };
}

/**
 * Weighted membership for a hypothetical combined entity.
 *
 * Merging districts is not the same as adding their weighted memberships:
 * sparsity and small-school eligibility are properties of the combined
 * entity, not of its parts, and a merged district may qualify for neither
 * where its components did. The caller supplies the combined eligibility
 * explicitly rather than having it inferred, and the assumption is surfaced in
 * the scenario's assumptions register.
 */
export function combineMembership(
  ctx: EngineContext,
  parts: readonly MembershipInput[],
  combined: { readonly sparsity_eligible: boolean; readonly small_school_eligible: boolean; readonly entity: string },
): MembershipResult {
  const years = new Map<number, { prek: number | null; elementary: number | null; secondary: number | null }>();

  for (const part of parts) {
    for (const y of part.adm_years) {
      const acc = years.get(y.fiscal_year) ?? { prek: 0, elementary: 0, secondary: 0 };
      years.set(y.fiscal_year, {
        prek: addNullable(acc.prek, y.prek),
        elementary: addNullable(acc.elementary, y.elementary),
        secondary: addNullable(acc.secondary, y.secondary),
      });
    }
  }

  const elByCategory = new Map<string, number | null>();
  for (const part of parts) {
    for (const el of part.english_learners) {
      elByCategory.set(el.category, addNullable(elByCategory.get(el.category) ?? 0, el.count));
    }
  }

  const merged: MembershipInput = {
    entity: combined.entity,
    adm_years: [...years.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([fiscal_year, v]) => ({ fiscal_year, ...v })),
    economically_deprived: parts.reduce<number | null>(
      (acc, p) => addNullable(acc, p.economically_deprived),
      0,
    ),
    english_learners: [...elByCategory.entries()].map(([category, count]) => ({ category, count })),
    sparsity_eligible: combined.sparsity_eligible,
    small_school_eligible: combined.small_school_eligible,
    source: `combined from ${parts.map((p) => p.entity).join(', ')}`,
  };

  return computeWeightedMembership(ctx, merged);
}

/** Null is contagious: one district's missing count makes the combined count unknown. */
function addNullable(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  return a + b;
}

/** Education spending per weighted pupil -- the figure the tax rate keys off. */
export function perWeightedPupil(
  ctx: EngineContext,
  educationSpending: CalcNode,
  weightedMembership: CalcNode,
): CalcNode {
  return quotient(
    ctx,
    'Education spending per weighted pupil',
    educationSpending,
    weightedMembership,
    'usd_per_pupil',
  );
}
