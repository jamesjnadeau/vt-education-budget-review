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
  readonly education_spending?: number | null;
}

export type Resolution = 'direct' | 'via_su' | 'missing' | 'ambiguous';

/**
 * Where a member's education spending came from. `budget`: a collected budget
 * document. `aoe_edspend`: the member has no usable budget figure, so the
 * figure is the education spending AOE states for the district (Data Request
 * #853). Null: none.
 */
export type SpendingBasis = 'budget' | 'aoe_edspend' | null;

/** AOE's stated education spending per entity and fiscal year (edspend-prefill.ts). */
export type AoeSpending = Readonly<
  Record<string, Readonly<Record<string, { readonly value: number; readonly pupils?: number; readonly pupil_measure?: string }>>>
>;

/**
 * A member's pupil count as AOE's EdSpend record states it. From FY2025 the
 * measure is long-term weighted ADM, a weighted count and not a head count;
 * before that it is equalized pupils. `measure` always says which.
 */
export interface MemberPupils {
  readonly value: number;
  readonly measure: string;
  readonly fiscal_year: number;
}

export interface GroupingBudgetMember {
  readonly slug: string;
  readonly name_as_written: string | null;
  readonly budget: DistrictBudget | null;
  readonly resolution: Resolution;
  readonly fiscal_year: number | null;
  readonly status: string | null;
  readonly spending_basis: SpendingBasis;
  /** AOE's pupil count for the member, in the year of its figure where AOE lists it. Null when none. */
  readonly pupils: MemberPupils | null;
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

// The warehouse budget `status` vocabulary is proposed | warned | approved |
// actual (schemas/budget-1.0.schema.json). `actual` is year-end realized spend,
// not a proposed/adopted budget, so it is NOT ranked here: it is used only as a
// last resort, when a member has no budget-status record at all.
const BUDGET_STATUS_RANK: Record<string, number> = { approved: 3, warned: 2, proposed: 1 };
const BUDGET_STATUSES = new Set(Object.keys(BUDGET_STATUS_RANK));

/** A registry entity that is itself a district: a UD, or a town that runs its own school. */
function isDistrictLike(e: RegistryEntity): boolean {
  return e.type === 'ud' || (e.type === 'town' && !e.operated_by && !e.reporting_only);
}

/**
 * Pick one record. Prefer a real budget (approved > warned > proposed, latest
 * fiscal year first) over an `actual`; fall back to the latest `actual` only
 * when the member has no budget-status record. Null when there are no candidates.
 */
function pickBudget(candidates: readonly BudgetInput[]): BudgetInput | null {
  if (candidates.length === 0) return null;
  const budgets = candidates.filter((c) => BUDGET_STATUSES.has(c.status));
  const pool = budgets.length > 0 ? budgets : candidates;
  return [...pool].sort((a, b) => {
    if (b.fiscal_year !== a.fiscal_year) return b.fiscal_year - a.fiscal_year;
    return (BUDGET_STATUS_RANK[b.status] ?? 0) - (BUDGET_STATUS_RANK[a.status] ?? 0);
  })[0]!;
}

function adapt(record: BudgetInput): DistrictBudget {
  return {
    entity: record.entity,
    fiscal_year: record.fiscal_year,
    education_spending: record.education_spending ?? null,
    source: record.source ?? '',
  };
}

export function buildGroupingBudgets(
  groupings: readonly GroupingInput[],
  registry: ReadonlyMap<string, RegistryEntity>,
  budgets: readonly BudgetInput[],
  aoeSpending: AoeSpending = {},
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

  /**
   * A member with no usable budget figure takes the education spending AOE
   * states for that same district, from the latest year AOE lists. It is a
   * labelled substitute, not a budget: the member keeps its resolution and
   * `spending_basis` says where the number came from. An SU-level budget is
   * never split to stand in for a member, but AOE states spending per district.
   */
  /** AOE's pupils for the member in `fiscalYear` when it lists that year, else its latest year. */
  function pupilsFor(slug: string, fiscalYear: number | null): MemberPupils | null {
    const years = aoeSpending[slug];
    if (!years) return null;
    const usable = Object.keys(years)
      .map(Number)
      .filter((y) => (years[String(y)]?.pupils ?? 0) > 0)
      .sort((a, b) => b - a);
    const year = fiscalYear !== null && usable.includes(fiscalYear) ? fiscalYear : usable[0];
    if (year === undefined) return null;
    const row = years[String(year)]!;
    return { value: row.pupils!, measure: row.pupil_measure ?? 'unknown', fiscal_year: year };
  }

  function withAoeSpending(slug: string, m: GroupingBudgetMember): GroupingBudgetMember {
    const years = aoeSpending[slug];
    const latest = years ? Object.keys(years).map(Number).sort((a, b) => b - a)[0] : undefined;
    if (latest === undefined) return { ...m, spending_basis: null, pupils: null };
    return {
      ...m,
      budget: {
        entity: slug,
        fiscal_year: latest,
        education_spending: years![String(latest)]!.value,
        source: `AOE education spending, FY${latest} (Data Request #853)`,
      },
      fiscal_year: latest,
      status: 'aoe_stated',
      spending_basis: 'aoe_edspend',
    };
  }

  return groupings.map((g) => {
    const members = g.members.map((slug, i): GroupingBudgetMember => {
      const m = resolveMember(slug, i);
      const filled = m.budget?.education_spending != null ? { ...m, spending_basis: 'budget' as const } : withAoeSpending(slug, m);
      return { ...filled, pupils: pupilsFor(slug, filled.fiscal_year) };
    });

    function resolveMember(slug: string, i: number): GroupingBudgetMember {
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
          spending_basis: null,
          pupils: null,
        };
      }

      // via_su only applies when the member is itself a district (spec rule 2).
      // A non-district-like member (e.g. a school, or a town operated by another
      // district) must never inherit its SU's budget, or the same SU total could
      // be attributed to two members of one group and double-counted.
      const self = registry.get(slug);
      const su = self?.supervisory_union ?? null;
      if (su && self && isDistrictLike(self)) {
        const suBudget = pickBudget(byEntity.get(su) ?? []);
        if (suBudget) {
          const districtCount = suDistrictCount.get(su) ?? 0;
          if (districtCount === 1) {
            return {
              slug,
              name_as_written: name,
              budget: adapt(suBudget),
              resolution: 'via_su',
              fiscal_year: suBudget.fiscal_year,
              status: suBudget.status,
              spending_basis: null,
              pupils: null,
            };
          }
          if (districtCount > 1) {
            // SU has budget data but more than one district member: cannot split.
            return { slug, name_as_written: name, budget: null, resolution: 'ambiguous', fiscal_year: null, status: null, spending_basis: null, pupils: null };
          }
          // districtCount === 0: an SU budget with no district-like member to
          // attribute it to (e.g. a non-district member). Fall through to missing.
        }
      }

      return { slug, name_as_written: name, budget: null, resolution: 'missing', fiscal_year: null, status: null, spending_basis: null, pupils: null };
    }

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
