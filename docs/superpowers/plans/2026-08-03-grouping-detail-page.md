# Grouping Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the missing `/groupings/<n>/` detail page, which renders an Act 170 group's members and — where member budgets exist — the total-driven merger comparison (members run individually vs. combined) using the existing `runScenario()` model, degrading to an honest data-gap + intake CTA everywhere else.

**Architecture:** A pure, unit-tested resolver in `tools/src` maps each grouping member to at most one budget record (no double-counting) and emits `site/src/generated/grouping-budgets.json` from `build-data`. A new Astro dynamic route `groupings/[number].astro` reads that file, runs `runScenario()` at build time when every member resolved to a non-null total, and renders one of three states (computed / partial / recruitment).

**Tech Stack:** TypeScript (ESM, `.ts` extension imports), Astro (static build), vitest, the `@vt-budget/model` package (`runScenario`, `defaultAssumptions`, `createContext`, `formatValue`).

## Global Constraints

- **The merger model is total-driven and minimal.** `DistrictBudget = { entity, fiscal_year, total_stated, source }` (flat). `total_stated` is **published total expenditure**. `ScenarioSpec = { name, districts, assumptions }`. `ScenarioResult = { name, currentTotal, scenarioTotal, delta, assumptions, caveats }`. There is **no staffing, no personnel/FTE, and exactly one assumption** (`consolidation_factor`, default `1`). Do not add or assume anything richer.
- **Honesty over completeness.** `null` means "not published," never `0`. Never show a combined total unless every member resolved to a non-null total. Never guess a member→budget match; an uncertain match is a gap.
- **No scoring language.** The output is a signed `delta`; never label it "savings," and never rank or recommend.
- **Generated JSON is gitignored and reproducible** (`site/src/generated/`, `site/public/data/`). Do **not** commit `grouping-budgets.json`; commit only source and code. `build:data` regenerates it.
- **Import style:** relative imports carry the `.ts` extension (e.g. `'./registry/types.ts'`); the model package is imported as `'@vt-budget/model'`.
- **Spec:** `docs/superpowers/specs/2026-08-03-grouping-detail-page-design.md`.

---

### Task 1: `buildGroupingBudgets` resolver + tests

The correctness core: resolve each member to at most one budget, mark gaps, adapt to the model's flat `DistrictBudget`. Pure function, fully unit-tested. No file I/O here.

**Files:**
- Create: `tools/src/grouping-budgets.ts`
- Test: `tools/src/grouping-budgets.test.ts`

**Interfaces:**
- Consumes: `RegistryEntity` from `./registry/types.ts`; `DistrictBudget` from `@vt-budget/model`.
- Produces:
  - `buildGroupingBudgets(groupings: readonly GroupingInput[], registry: ReadonlyMap<string, RegistryEntity>, budgets: readonly BudgetInput[]): GroupingBudgets[]`
  - types `GroupingInput`, `BudgetInput`, `Resolution`, `GroupingBudgetMember`, `GroupingBudgets` (exact fields in Step 3).

- [ ] **Step 1: Write the failing tests**

Create `tools/src/grouping-budgets.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { buildGroupingBudgets, type BudgetInput, type GroupingInput } from './grouping-budgets.ts';
import type { RegistryEntity } from './registry/types.ts';

function entity(over: Partial<RegistryEntity> & Pick<RegistryEntity, 'slug' | 'type'>): RegistryEntity {
  return {
    name: over.slug,
    aoe_server_id: null,
    edfi_id: null,
    effective_from: null,
    effective_from_basis: 'first_observed',
    effective_to: null,
    effective_to_basis: 'first_observed',
    successor: null,
    successor_basis: null,
    supervisory_union: null,
    operated_by: null,
    reporting_only: false,
    ...over,
  } as RegistryEntity;
}

function budget(over: Partial<BudgetInput> & Pick<BudgetInput, 'entity'>): BudgetInput {
  return {
    fiscal_year: 2024,
    status: 'proposed',
    source: 'test fixture',
    expenditures: { total_stated: 1_000_000 },
    ...over,
  };
}

function registryOf(...entities: RegistryEntity[]): Map<string, RegistryEntity> {
  return new Map(entities.map((e) => [e.slug, e]));
}

const GROUP = (members: string[], names?: string[]): GroupingInput => ({
  number: 1,
  slug: 'group-1',
  name: 'Group 1',
  members,
  member_names_as_written: names,
});

describe('buildGroupingBudgets', () => {
  it('resolves a member with its own budget record as direct', () => {
    const reg = registryOf(entity({ slug: 'ud/a-1', type: 'ud', supervisory_union: 'su/a' }));
    const [g] = buildGroupingBudgets([GROUP(['ud/a-1'])], reg, [budget({ entity: 'ud/a-1' })]);
    expect(g.members[0].resolution).toBe('direct');
    expect(g.members[0].budget?.total_stated).toBe(1_000_000);
    expect(g.resolved_count).toBe(1);
  });

  it('resolves via the SU when the SU has exactly one district-like member', () => {
    const reg = registryOf(entity({ slug: 'ud/ac-55', type: 'ud', supervisory_union: 'su/ac' }));
    const [g] = buildGroupingBudgets([GROUP(['ud/ac-55'])], reg, [budget({ entity: 'su/ac' })]);
    expect(g.members[0].resolution).toBe('via_su');
    expect(g.members[0].budget?.entity).toBe('su/ac');
  });

  it('does not attribute an SU budget when the SU has two district-like members', () => {
    const reg = registryOf(
      entity({ slug: 'ud/x-1', type: 'ud', supervisory_union: 'su/multi' }),
      entity({ slug: 'ud/y-2', type: 'ud', supervisory_union: 'su/multi' }),
    );
    const [g] = buildGroupingBudgets([GROUP(['ud/x-1', 'ud/y-2'])], reg, [budget({ entity: 'su/multi' })]);
    expect(g.members.map((m) => m.resolution)).toEqual(['ambiguous', 'ambiguous']);
    expect(g.members.every((m) => m.budget === null)).toBe(true);
    expect(g.resolved_count).toBe(0);
  });

  it('marks a member with no direct and no attributable SU budget as missing', () => {
    const reg = registryOf(entity({ slug: 'town/lincoln', type: 'town', supervisory_union: 'su/lincoln' }));
    const [g] = buildGroupingBudgets([GROUP(['town/lincoln'])], reg, []);
    expect(g.members[0].resolution).toBe('missing');
    expect(g.members[0].budget).toBeNull();
  });

  it('prefers the latest fiscal year, and approved over proposed within a year', () => {
    const reg = registryOf(entity({ slug: 'ud/a-1', type: 'ud' }));
    const [g] = buildGroupingBudgets(
      [GROUP(['ud/a-1'])],
      reg,
      [
        budget({ entity: 'ud/a-1', fiscal_year: 2023, status: 'approved' }),
        budget({ entity: 'ud/a-1', fiscal_year: 2024, status: 'proposed' }),
        budget({ entity: 'ud/a-1', fiscal_year: 2024, status: 'approved' }),
      ],
    );
    expect(g.members[0].fiscal_year).toBe(2024);
    expect(g.members[0].status).toBe('approved');
  });

  it('prefers a budget-status record over a more recent actual', () => {
    const reg = registryOf(entity({ slug: 'ud/a-1', type: 'ud' }));
    const [g] = buildGroupingBudgets(
      [GROUP(['ud/a-1'])],
      reg,
      [
        budget({ entity: 'ud/a-1', fiscal_year: 2023, status: 'approved' }),
        budget({ entity: 'ud/a-1', fiscal_year: 2025, status: 'actual' }),
      ],
    );
    expect(g.members[0].fiscal_year).toBe(2023);
    expect(g.members[0].status).toBe('approved');
  });

  it('falls back to the latest actual when the member has no budget-status record', () => {
    const reg = registryOf(entity({ slug: 'ud/a-1', type: 'ud' }));
    const [g] = buildGroupingBudgets(
      [GROUP(['ud/a-1'])],
      reg,
      [
        budget({ entity: 'ud/a-1', fiscal_year: 2024, status: 'actual' }),
        budget({ entity: 'ud/a-1', fiscal_year: 2025, status: 'actual' }),
      ],
    );
    expect(g.members[0].fiscal_year).toBe(2025);
    expect(g.members[0].status).toBe('actual');
  });

  it('marks a member missing (not ambiguous) when its SU budget has no district-like member to attribute', () => {
    const reg = registryOf(entity({ slug: 'school/x', type: 'school', supervisory_union: 'su/z' }));
    const [g] = buildGroupingBudgets([GROUP(['school/x'])], reg, [budget({ entity: 'su/z' })]);
    expect(g.members[0].resolution).toBe('missing');
    expect(g.members[0].budget).toBeNull();
  });

  it('does not attribute an SU budget to a non-district-like member even when the SU has one district-like member', () => {
    const reg = registryOf(
      entity({ slug: 'ud/real-1', type: 'ud', supervisory_union: 'su/z' }),
      entity({ slug: 'school/x', type: 'school', supervisory_union: 'su/z' }),
    );
    const [g] = buildGroupingBudgets([GROUP(['school/x'])], reg, [budget({ entity: 'su/z' })]);
    expect(g.members[0].resolution).toBe('missing');
    expect(g.members[0].budget).toBeNull();
  });

  it('adapts total_stated from expenditures (not revenues) and keeps an unpublished total null', () => {
    const reg = registryOf(entity({ slug: 'ud/a-1', type: 'ud' }));
    const [g] = buildGroupingBudgets(
      [GROUP(['ud/a-1'])],
      reg,
      [budget({ entity: 'ud/a-1', expenditures: { total_stated: null } })],
    );
    expect(g.members[0].resolution).toBe('direct');
    expect(g.members[0].budget?.total_stated).toBeNull();
  });

  it('reports member_count, resolved_count and distinct fiscal_years_present', () => {
    const reg = registryOf(
      entity({ slug: 'ud/a-1', type: 'ud' }),
      entity({ slug: 'ud/b-2', type: 'ud' }),
    );
    const [g] = buildGroupingBudgets(
      [GROUP(['ud/a-1', 'ud/b-2', 'ud/missing-3'])],
      reg,
      [
        budget({ entity: 'ud/a-1', fiscal_year: 2024 }),
        budget({ entity: 'ud/b-2', fiscal_year: 2023 }),
      ],
    );
    expect(g.member_count).toBe(3);
    expect(g.resolved_count).toBe(2);
    expect(g.fiscal_years_present).toEqual([2023, 2024]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tools/src/grouping-budgets.test.ts`
Expected: FAIL — cannot resolve `./grouping-budgets.ts` / `buildGroupingBudgets` is not defined.

- [ ] **Step 3: Write the implementation**

Create `tools/src/grouping-budgets.ts`:

```ts
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
  })[0];
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
            };
          }
          if (districtCount > 1) {
            // SU has budget data but more than one district member: cannot split.
            return { slug, name_as_written: name, budget: null, resolution: 'ambiguous', fiscal_year: null, status: null };
          }
          // districtCount === 0: an SU budget with no district-like member to
          // attribute it to (e.g. a non-district member). Fall through to missing.
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tools/src/grouping-budgets.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add tools/src/grouping-budgets.ts tools/src/grouping-budgets.test.ts
git commit -m "feat(tools): resolve grouping members to budgets (no double-counting)"
```

---

### Task 2: Emit `grouping-budgets.json` from build-data

Wire the resolver into the build so the site has the generated artifact.

**Files:**
- Modify: `tools/src/cli/build-data.ts` (imports near line 24–35; groupings block at lines 117–124)

**Interfaces:**
- Consumes: `buildGroupingBudgets`, `GroupingInput`, `BudgetInput` from `../grouping-budgets.ts` (Task 1); the existing `registry`, `budgets`, `groupings`, `writeJson`, `PATHS` in `build-data.ts`.
- Produces: `site/src/generated/grouping-budgets.json` — a `GroupingBudgets[]` (gitignored, not committed).

- [ ] **Step 1: Add the import**

In `tools/src/cli/build-data.ts`, alongside the other `../` imports (after the `buildCoverage` import, ~line 26), add:

```ts
import { buildGroupingBudgets, type BudgetInput, type GroupingInput } from '../grouping-budgets.ts';
```

- [ ] **Step 2: Emit the artifact in the groupings block**

The groupings block currently reads (lines ~117–124):

```ts
  // --- groupings -----------------------------------------------------------
  let groupings: unknown = { status: 'draft', groupings: [] };
  try {
    groupings = parseYaml(readFileSync(PATHS.groupings, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  writeJson(join(PATHS.siteGenerated, 'groupings.json'), groupings);
```

Immediately after the `writeJson(... 'groupings.json' ...)` line, add:

```ts
  const groupingList = (groupings as { groupings?: GroupingInput[] }).groupings ?? [];
  writeJson(
    join(PATHS.siteGenerated, 'grouping-budgets.json'),
    buildGroupingBudgets(groupingList, registry, budgets as unknown as BudgetInput[]),
  );
```

- [ ] **Step 3: Run the build and verify the artifact**

Run:
```bash
npm run build:data && node -e "const g=require('./site/src/generated/grouping-budgets.json'); const one=g.find(x=>x.number===1); console.log(JSON.stringify(one.members.map(m=>[m.slug,m.resolution,m.budget&&m.budget.total_stated]),null,1)); console.log('resolved',one.resolved_count,'of',one.member_count);"
```
Expected: `ud/addison-central-55` resolves `via_su` with a non-null total (from `su/addison-central`); the other members (`ud/addison-northwest-54`, `town/lincoln`, `ud/mt-abraham-61`) are `missing`; `resolved_count` is `1` of `4`. (Exact totals depend on warehouse data; the point is Group 1 is a *partial* group, not a crash.)

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

Only the source change is committed; the generated JSON is gitignored.

```bash
git add tools/src/cli/build-data.ts
git commit -m "feat(build): emit grouping-budgets.json for the grouping pages"
```

---

### Task 3: `groupings/[number].astro` detail page

The route that fixes the 404 and renders the three states.

**Files:**
- Create: `site/src/pages/groupings/[number].astro`

**Interfaces:**
- Consumes: `site/src/generated/groupings.json` (for `verified` + `act`), `site/src/generated/grouping-budgets.json` (Task 2), and `@vt-budget/model` (`createContext`, `runScenario`, `defaultAssumptions`, `formatValue`).
- Produces: static pages at `/groupings/<number>/` for every grouping.

- [ ] **Step 1: Ensure generated data exists**

Run: `npm run build:data`
Expected: `site/src/generated/grouping-budgets.json` present (Task 2). The Astro build imports it, so it must exist first.

- [ ] **Step 2: Create the page**

Create `site/src/pages/groupings/[number].astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import groupingsDoc from '../../generated/groupings.json';
import groupingBudgets from '../../generated/grouping-budgets.json';
import { createContext, runScenario, defaultAssumptions, formatValue } from '@vt-budget/model';
import type { DistrictBudget } from '@vt-budget/model';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

interface Grouping {
  number: number;
  slug: string;
  name: string;
  members: string[];
  verified: boolean;
}
interface GroupingBudgetMember {
  slug: string;
  name_as_written: string | null;
  budget: DistrictBudget | null;
  resolution: 'direct' | 'via_su' | 'missing' | 'ambiguous';
  fiscal_year: number | null;
  status: string | null;
}
interface GroupingBudgets {
  number: number;
  slug: string;
  name: string;
  members: GroupingBudgetMember[];
  resolved_count: number;
  member_count: number;
  fiscal_years_present: number[];
}

const doc = groupingsDoc as {
  act?: { name?: string; citation?: { statute?: string } };
  groupings: Grouping[];
};
const budgetsByNumber = new Map(
  (groupingBudgets as GroupingBudgets[]).map((g) => [g.number, g]),
);

export function getStaticPaths() {
  const source = groupingsDoc as { groupings: Grouping[] };
  return source.groupings.map((g) => ({ params: { number: String(g.number) }, props: { grouping: g } }));
}

const { grouping } = Astro.props as { grouping: Grouping };
const budgets = budgetsByNumber.get(grouping.number) ?? {
  number: grouping.number,
  slug: grouping.slug,
  name: grouping.name,
  members: [],
  resolved_count: 0,
  member_count: grouping.members.length,
  fiscal_years_present: [],
};

// The combined total is only stated when every member resolved to a non-null
// total. A resolved record whose total is null (published nothing) is still a
// gap, because null propagates through the model to an unknown current total.
const computable =
  budgets.member_count > 0 &&
  budgets.members.length > 0 &&
  budgets.members.every((m) => m.budget && m.budget.total_stated !== null);

let result: ReturnType<typeof runScenario> | null = null;
if (computable) {
  const ctx = createContext({
    fiscal_year: budgets.fiscal_years_present[0] ?? 0,
    status: 'draft',
    note: null,
    parameters: new Map(),
    inputs: new Map(),
  });
  result = runScenario(ctx, {
    name: grouping.name,
    districts: budgets.members.map((m) => m.budget as DistrictBudget),
    assumptions: defaultAssumptions(),
  });
}

const gaps = budgets.members.filter((m) => !m.budget || m.budget.total_stated === null);
const mixedYears = budgets.fiscal_years_present.length > 1;
const state: 'computed' | 'partial' | 'recruitment' = computable
  ? 'computed'
  : budgets.resolved_count === 0
    ? 'recruitment'
    : 'partial';
---

<Base title={`${grouping.name} — Vermont School Budgets`}>
  <p><a href={`${base}/groupings/`}>← All Act 170 groups</a></p>
  <h1>{grouping.name}</h1>
  <p class="lede">
    The districts {doc.act?.name ?? 'Act 170'} groups together, run individually and combined.
    A grouping is a what-if the Legislature already named — this page runs it.
    {!grouping.verified && <span class="tag unverified" style="margin-left:.5rem">membership not checked</span>}
  </p>

  {state === 'computed' && result && (
    <>
      <h2>Run individually</h2>
      <div class="scroll-x">
        <table>
          <thead>
            <tr><th scope="col">District</th><th scope="col">Fiscal year</th><th scope="col">Status</th><th scope="col">Total expenditure</th></tr>
          </thead>
          <tbody>
            {budgets.members.map((m) => (
              <tr>
                <th scope="row">{m.name_as_written ?? m.slug}</th>
                <td>{m.fiscal_year ? `FY${m.fiscal_year}` : '—'}</td>
                <td>{m.status ?? '—'}{m.resolution === 'via_su' && <span class="tag" style="margin-left:.4rem">via SU</span>}{m.status === 'actual' && <span class="tag" style="margin-left:.4rem">year-end actuals, not an adopted budget</span>}</td>
                <td>{m.budget && m.budget.total_stated !== null ? formatValue(m.budget.total_stated, 'usd') : 'not published'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Combined</h2>
      <dl class="facts">
        <dt>{result.currentTotal.label}</dt>
        <dd>{formatValue(result.currentTotal.value, 'usd')}</dd>
        <dt>{result.scenarioTotal.label}</dt>
        <dd>{formatValue(result.scenarioTotal.value, 'usd')}</dd>
        <dt>{result.delta.label}</dt>
        <dd>{formatValue(result.delta.value, 'usd')}</dd>
      </dl>
      <p style="color:var(--text-muted)">
        At the default consolidation factor of 1.0 the change is {formatValue(result.delta.value, 'usd')} by
        design: the tool assumes no consolidation you did not choose. Adjust the factor in the
        <a href={`${base}/model/`}>what-if tool</a> to see movement in either direction.
      </p>

      {mixedYears && (
        <div class="notice">
          <strong>Members' budgets are from different years</strong>
          <p>The combined figure mixes fiscal years {budgets.fiscal_years_present.map((y) => `FY${y}`).join(', ')}. Compare years before quoting it.</p>
        </div>
      )}

      <h2>Assumptions</h2>
      <dl class="facts">
        {result.assumptions.map((a) => (
          <>
            <dt>{a.label}</dt>
            <dd>{a.value} — {a.rationale}</dd>
          </>
        ))}
      </dl>

      <h2>Before you quote this</h2>
      <ul>{result.caveats.map((c) => <li>{c}</li>)}</ul>
    </>
  )}

  {state === 'partial' && (
    <>
      <h2>Run individually (partial)</h2>
      <div class="scroll-x">
        <table>
          <thead>
            <tr><th scope="col">District</th><th scope="col">Fiscal year</th><th scope="col">Total expenditure</th></tr>
          </thead>
          <tbody>
            {budgets.members.map((m) => (
              <tr>
                <th scope="row">{m.name_as_written ?? m.slug}</th>
                <td>{m.fiscal_year ? `FY${m.fiscal_year}` : '—'}</td>
                <td>{m.budget && m.budget.total_stated !== null ? formatValue(m.budget.total_stated, 'usd') : 'no budget held'}{m.status === 'actual' && <span class="tag" style="margin-left:.4rem">year-end actuals, not an adopted budget</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div class="notice blocking">
        <strong>Combined total not computed: {gaps.length} of {budgets.member_count} member budgets are missing</strong>
        <p>A combined figure is only shown when every member has a published total, so one missing budget does not silently shrink the group. Missing or unmatched:</p>
        <ul>
          {gaps.map((m) => <li>{m.name_as_written ?? m.slug} — {m.resolution === 'ambiguous' ? 'budget held only at the supervisory-union level, which serves more than one district' : 'no budget held'}</li>)}
        </ul>
        <p>Have one of these budgets? <a href={`${base}/su/`}>Find the supervisory union</a> and send the document in through its issue form — a bot opens the pull request.</p>
      </div>
    </>
  )}

  {state === 'recruitment' && (
    <div class="notice blocking">
      <strong>No member budgets held for this group yet</strong>
      <p>None of the {budgets.member_count} districts in this group has a budget document collected, so the merger comparison cannot be run. This is a gap in coverage, not a statement that these districts published nothing.</p>
      <h3>Members</h3>
      <ul>{budgets.members.map((m) => <li>{m.name_as_written ?? m.slug} <code>{m.slug}</code></li>)}</ul>
      <p>Have one of these budgets? <a href={`${base}/su/`}>Find the supervisory union</a> and send it in through its issue form.</p>
    </div>
  )}

  <h2>Where this comes from</h2>
  <dl class="facts">
    <dt>Law</dt>
    <dd>{doc.act?.citation?.statute ?? '—'}</dd>
  </dl>
</Base>
```

- [ ] **Step 3: Type-check the site**

Run: `npm run check --prefix site`
Expected: no errors (Astro's `astro check`). If `runScenario`/`createContext`/`formatValue`/`DistrictBudget` are reported missing, confirm they are exported from `@vt-budget/model` (they are: `model/src/index.ts` re-exports `node.ts` and `scenario.ts`).

- [ ] **Step 4: Verify in the browser**

Start the dev server (launch config `site-dev`, port 4321) — note it runs `astro dev` only, so `build:data` must have run in Step 1. Then verify:
- `/groupings/1/` renders the **partial** state: a members table with Addison Central's total present, and a blocking notice listing the missing members + intake link. No combined total shown.
- A data-less group (e.g. `/groupings/3/`) renders the **recruitment** state: member list + intake CTA, no table of totals.
- The groupings index (`/groupings/`) links now resolve (no 404).
- No console errors; page is horizontally scroll-safe on mobile width.

Capture a screenshot of `/groupings/1/` as proof.

- [ ] **Step 5: Run the full test + typecheck sweep**

Run: `npm run typecheck && npm test`
Expected: all pass (existing suites + Task 1's).

- [ ] **Step 6: Commit**

```bash
git add site/src/pages/groupings/[number].astro
git commit -m "feat(site): grouping detail page with combined-vs-individual merger view"
```

---

## Self-Review

**Spec coverage:**
- Section 1 (data pipeline, resolution rule, adapter, emitted shape) → Task 1 (`buildGroupingBudgets` + types) and Task 2 (emit). ✔
- Section 2 (route, getStaticPaths, scenario execution, minimal EngineContext) → Task 3 Steps 2. ✔
- Section 3 (header + three states, mixed-year caveat) → Task 3 Step 2 markup. ✔
- Section 4 (resolution/adapter tests; lean on model's own scenario tests; browser-verify the page) → Task 1 Step 1 tests; Task 3 Step 4 browser verification. ✔

**Placeholder scan:** No TBD/TODO; all code blocks are complete; every test has a body; every step has an exact command and expected result.

**Type consistency:** `GroupingBudgetMember` / `GroupingBudgets` field names (`resolution`, `budget`, `fiscal_year`, `status`, `name_as_written`, `resolved_count`, `member_count`, `fiscal_years_present`) are identical across Task 1 (definition), Task 2 (emit), and Task 3 (consumption). `DistrictBudget` fields (`entity`, `fiscal_year`, `total_stated`, `source`) match the model. `runScenario`/`createContext`/`defaultAssumptions`/`formatValue` match `@vt-budget/model` exports.
