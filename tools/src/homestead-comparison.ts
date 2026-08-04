/**
 * Build-time comparison of each member town's published homestead rate against
 * the engine's billed rate, run from the district's education spending, the
 * resolved ADM, the town's CLA, and the live fiscal-year parameter set.
 *
 * The engine refuses to compute from an unverified parameter, so today the
 * calculated side is a blocker for every real year rather than a number. That
 * is the point: the published side is shown now, the calculated side declares
 * exactly what it is waiting on, and the column lights up when parameters are
 * verified.
 */

import {
  createContext,
  computeWeightedMembership,
  input,
  parseParameterSet,
  perWeightedPupil,
  townRate,
  type ResolvedAdm,
} from '@vt-budget/model';
import type { RegistryEntity } from './registry/types.ts';

export interface HomesteadCell {
  readonly town: string;
  readonly published: number | null;
  readonly calculated: number | null;
  readonly blocker: string | null;
  readonly difference: number | null;
}
export interface HomesteadComparison {
  readonly generated: string;
  readonly sus: Record<string, Record<string, HomesteadCell[]>>;
}

interface BudgetLike {
  readonly entity: string;
  readonly fiscal_year: number;
  readonly education_spending?: number | null;
  readonly tax?: { readonly towns?: Array<{ town: string; homestead_rate_stated?: number | null; cla?: number | null }> };
}

function admYear(resolved: ResolvedAdm | undefined, fiscal_year: number) {
  const band = (k: keyof ResolvedAdm) => resolved?.[k]?.value ?? null;
  return {
    fiscal_year,
    prekindergarten: band('prekindergarten'),
    kindergarten_through_5: band('kindergarten_through_5'),
    grades_6_through_8: band('grades_6_through_8'),
    grades_9_through_12: band('grades_9_through_12'),
  };
}

export function buildHomesteadComparison(
  sus: readonly RegistryEntity[],
  budgets: readonly BudgetLike[],
  resolvedAdm: Record<string, Record<string, ResolvedAdm>>,
  parameterSets: ReadonlyArray<ReturnType<typeof parseParameterSet>>,
  generated: string,
): HomesteadComparison {
  const paramByYear = new Map(parameterSets.map((p) => [p.fiscal_year, p]));
  const out: Record<string, Record<string, HomesteadCell[]>> = {};

  for (const su of sus) {
    const suBudgets = budgets.filter((b) => b.entity === su.slug && b.tax?.towns?.length);
    if (suBudgets.length === 0) continue;
    const years: Record<string, HomesteadCell[]> = {};

    for (const budget of suBudgets) {
      const fy = budget.fiscal_year;
      const params = paramByYear.get(fy);
      // No parameter file for the year: every town is blocked identically.
      const ctx = params ? createContext(params) : null;

      const resolved = resolvedAdm[su.slug];
      const membership = ctx
        ? computeWeightedMembership(ctx, {
            entity: su.slug,
            adm_years: [admYear(resolved?.[String(fy - 1)], fy - 1), admYear(resolved?.[String(fy)], fy)],
            state_placed_fte: null,
            poverty_185_fpl: null,
            english_learners: null,
            persons_per_square_mile: null,
            prior_year_weighted_membership: null,
            small_schools: [],
            source: 'resolved ADM (district-first, AOE fallback)',
          })
        : null;

      const spendingNode = ctx
        ? input(ctx, 'Education spending', budget.education_spending ?? null, 'usd', { source: 'district budget record' })
        : null;
      const perPupil = ctx && membership && spendingNode ? perWeightedPupil(ctx, spendingNode, membership.total) : null;

      years[String(fy)] = (budget.tax?.towns ?? []).map((t): HomesteadCell => {
        const published = t.homestead_rate_stated ?? null;
        if (!ctx || !perPupil) {
          return { town: t.town, published, calculated: null, blocker: 'no parameter file for this year', difference: null };
        }
        const rate = townRate(
          ctx,
          perPupil,
          { town: t.town, cla: t.cla ?? null, cla_source: 'district budget record' },
          null, // statewide average determination — not supplied here
          { capitalReserveFivePlusYears: null, bondExclusionPreJuly2024: null, weightedMembership: membership!.total },
        );
        const node = rate.billedRate;
        const calculated = node.value;
        const blocker = calculated === null && node.blockers[0] ? `${node.blockers[0].ref}: ${node.blockers[0].detail}` : null;
        const difference = calculated !== null && published !== null ? Number((published - calculated).toFixed(4)) : null;
        return { town: t.town, published, calculated, blocker, difference };
      });
    }
    out[su.slug] = years;
  }

  return { generated, sus: out };
}
