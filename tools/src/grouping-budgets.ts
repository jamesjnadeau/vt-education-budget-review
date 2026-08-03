/**
 * Resolves each Act 170 grouping member to at most one budget record and adapts
 * it to the model's flat DistrictBudget. Emitted as site/src/generated/
 * grouping-budgets.json and read by the /groupings/<n>/ page.
 *
 * The one rule that matters: a member resolves to exactly one record or to a
 * labelled gap. It is never attributed a budget that cannot be uniquely tied to
 * it, because a double-counted or mis-attributed member produces a wrong
 * combined total, and a wrong number here is worse than no number.
 */

import type { DistrictBudget } from '@vt-budget/model';
import type { RegistryEntity } from './registry/types.ts';

export interface GroupingInput {
  readonly number: number;
  readonly slug: string;
  readonly name: string;
  readonly members: readonly string[];
  readonly member_names_as_written?: readonly string[];
}

/** The subset of a warehouse budget record this resolver reads. */
export interface BudgetInput {
  readonly entity: string;
  readonly fiscal_year: number;
  readonly status: string;
  readonly source?: string;
  readonly expenditures?: { readonly total_stated?: number | null } | null;
}

export type Resolution = 'direct' | 'via_su' | 'missing' | 'ambiguous';

export interface GroupingBudgetMember {
  readonly slug: string;
  readonly name_as_written: string | null;
  readonly budget: DistrictBudget | null;
  readonly resolution: Resolution;
  readonly fiscal_year: number | null;
  readonly status: string | null;
}

export interface GroupingBudgets {
  readonly number: number;
  readonly slug: string;
  readonly name: string;
  readonly members: readonly GroupingBudgetMember[];
  readonly resolved_count: number;
  readonly member_count: number;
  readonly fiscal_years_present: readonly number[];
}

const STATUS_RANK: Record<string, number> = { adopted: 2, proposed: 1 };

/** A registry entity that is itself a district: a UD, or a town that runs its own school. */
function isDistrictLike(e: RegistryEntity): boolean {
  return e.type === 'ud' || (e.type === 'town' && !e.operated_by && !e.reporting_only);
}

/** Latest fiscal year wins; adopted beats proposed within a year. Null if none. */
function pickBudget(candidates: readonly BudgetInput[]): BudgetInput | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => {
    if (b.fiscal_year !== a.fiscal_year) return b.fiscal_year - a.fiscal_year;
    return (STATUS_RANK[b.status] ?? 0) - (STATUS_RANK[a.status] ?? 0);
  })[0]!;
}

function adapt(record: BudgetInput): DistrictBudget {
  return {
    entity: record.entity,
    fiscal_year: record.fiscal_year,
    total_stated: record.expenditures?.total_stated ?? null,
    source: record.source ?? '',
  };
}

export function buildGroupingBudgets(
  groupings: readonly GroupingInput[],
  registry: ReadonlyMap<string, RegistryEntity>,
  budgets: readonly BudgetInput[],
): GroupingBudgets[] {
  const byEntity = new Map<string, BudgetInput[]>();
  for (const b of budgets) {
    const list = byEntity.get(b.entity) ?? [];
    list.push(b);
    byEntity.set(b.entity, list);
  }

  // Count district-like members per SU, so an SU budget is only attributed to a
  // member when the SU has exactly one such member (an unambiguous 1:1 wrapper).
  const suDistrictCount = new Map<string, number>();
  for (const e of registry.values()) {
    if (isDistrictLike(e) && e.supervisory_union) {
      suDistrictCount.set(e.supervisory_union, (suDistrictCount.get(e.supervisory_union) ?? 0) + 1);
    }
  }

  return groupings.map((g) => {
    const members = g.members.map((slug, i): GroupingBudgetMember => {
      const name = g.member_names_as_written?.[i] ?? null;

      const direct = pickBudget(byEntity.get(slug) ?? []);
      if (direct) {
        return {
          slug,
          name_as_written: name,
          budget: adapt(direct),
          resolution: 'direct',
          fiscal_year: direct.fiscal_year,
          status: direct.status,
        };
      }

      const su = registry.get(slug)?.supervisory_union ?? null;
      if (su) {
        const suBudget = pickBudget(byEntity.get(su) ?? []);
        if (suBudget) {
          if ((suDistrictCount.get(su) ?? 0) === 1) {
            return {
              slug,
              name_as_written: name,
              budget: adapt(suBudget),
              resolution: 'via_su',
              fiscal_year: suBudget.fiscal_year,
              status: suBudget.status,
            };
          }
          // SU has budget data but more than one district member: cannot split.
          return { slug, name_as_written: name, budget: null, resolution: 'ambiguous', fiscal_year: null, status: null };
        }
      }

      return { slug, name_as_written: name, budget: null, resolution: 'missing', fiscal_year: null, status: null };
    });

    const resolved = members.filter((m) => m.budget !== null);
    const years = [
      ...new Set(resolved.map((m) => m.fiscal_year).filter((y): y is number => y !== null)),
    ].sort((a, b) => a - b);

    return {
      number: g.number,
      slug: g.slug,
      name: g.name,
      members,
      resolved_count: resolved.length,
      member_count: members.length,
      fiscal_years_present: years,
    };
  });
}
