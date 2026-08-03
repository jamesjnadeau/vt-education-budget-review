# Grouping detail page — design

**Date:** 2026-08-03
**Status:** approved, ready for implementation plan

## Problem

`/groupings/1/` (and every `/groupings/<n>/`) 404s. The groupings index
(`site/src/pages/groupings/index.astro`) links to `/groupings/${g.number}/`, but
there is no route file to generate those pages — only `index.astro` exists. Astro
builds static pages, so a URL with no matching page file does not exist.

Beyond simply not-404ing, the page should do the thing the whole tool is for: an
Act 170 grouping is the set of districts the Legislature already grouped, i.e. a
pre-defined merger scenario. The page should show **who belongs** and a
**combined-vs-individual** comparison — the members' budgets run individually
(summed) versus run as a single merged district.

## Key constraints discovered

- **The merger model already exists, and it is total-driven.** The current
  `model/src/scenario.ts` → `runScenario()` (after the merged
  `total-driven-merger-calc` work) is deliberately minimal. It takes a flat
  `DistrictBudget = { entity, fiscal_year, total_stated, source }` — where
  `total_stated` is the district's **published total expenditure** — and returns
  `currentTotal` (members' published totals summed = run individually),
  `scenarioTotal` (combined total × a consolidation factor, default 1.0 = no
  change), a signed `delta`, `assumptions`, and `caveats`. There is **no staffing
  view, no personnel/FTE rollup, and exactly one assumption** (`consolidation_factor`);
  `defaultAssumptions()` returns only that, and `buildCaveats()` returns two fixed
  caveats. We reuse it as-is and do not re-implement or extend it in the view.
  (An earlier, richer rollup version with staffing existed but was replaced; do
  not design against it.)
- **Data is sparse.** Only one entity in the warehouse has budget data today
  (`warehouse/su-addison-central/`), and even it has salaries/benefits/FTE `null`.
  So for ~19 of 20 groups the page has nothing to compute and must degrade
  honestly.
- **Grain mismatch.** Groupings list *districts* (`ud/...`, and towns that are
  their own district like `town/lincoln`), but the one budget file is keyed to an
  *SU* (`su/addison-central`), which sits 1:1 above `ud/addison-central-55`.
  Resolution must bridge this without ever double-counting.
- **Project ethos: never show a plausible-but-unverified number.** SU pages show
  "Not computed" blocking notices; nulls mean "not published," not zero. The page
  must honor this.

## Decisions

- **Approach A (server-rendered scenario, computed at build via the model
  package).** Rejected alternatives: (B) sum budgets by hand in the view —
  duplicates model logic and risks silent divergence; (C) members list + `/model/`
  deep link only — doesn't deliver the on-page comparison.
- **Static now, interactive later.** Render the scenario at the default
  consolidation factor (1.0) statically; a `/model/` link is the interactive hook.
  Structured so an interactive island can hydrate the same figures later.
- **The page is both the computed page (option 1) and the data-recruitment page
  (option 2).** These are the same page in two data states; the empty state is the
  recruitment CTA.

## Section 1 — Data pipeline & matching rule

A new build step in `tools/src/cli/build-data.ts` emits
`site/src/generated/grouping-budgets.json`. The resolution/adapter logic lives in
a **pure, exported function** in `tools/src` (e.g.
`buildGroupingBudgets(groupings, registry, budgets)`) so it is unit-testable;
`build-data.ts` calls it and writes the file. The page reads only this file plus
`groupings.json` and never runs resolution itself.

**Member → budget resolution (priority order):**

1. A budget record whose `entity` exactly equals the member slug (e.g.
   `ud/addison-central-55`) → `direct`.
2. Else, if the member is a `ud`/`town` district whose `supervisory_union` has a
   budget record **and that SU has exactly one district member**, attribute the SU
   record to the member → `via_su`. (Covers today's `su/addison-central` →
   `ud/addison-central-55`.)
3. Else → `missing`.

Any member matching more than one record after 1–2, or where step 2 is ambiguous
(SU with multiple district children), is marked `ambiguous` and treated as a gap —
**never summed**. This is the no-double-counting guarantee.

**Year/status selection per member:** pick the latest `fiscal_year`; if a member
has both `adopted` and `proposed` for that year, prefer `adopted`. Carry the
chosen record's `fiscal_year` and `status` through.

**Adapter `BudgetRecord → DistrictBudget`:** the model's `DistrictBudget` is flat,
so the adapter is small — `entity` ← `record.entity`, `fiscal_year` ←
`record.fiscal_year`, `total_stated` ← `record.expenditures.total_stated` (the
published **total expenditure**, not revenues), `source` ← `record.source`. An
unpublished `expenditures.total_stated` stays `null` and propagates (the model
returns `currentTotal` = null if any member's total is null). No personnel/FTE
fields are mapped, because the model has none.

**Emitted shape per grouping:**

```
{
  number, slug, name,
  members: [{
    slug, name_as_written,
    budget: DistrictBudget | null,
    resolution: 'direct' | 'via_su' | 'missing' | 'ambiguous',
    fiscal_year, status
  }],
  resolved_count, member_count,
  fiscal_years_present: number[]
}
```

## Section 2 — Route & scenario execution

New file `site/src/pages/groupings/[number].astro`.

- `getStaticPaths()` emits one path per grouping from `groupings.json`, keyed on
  `number` (matching the existing `/groupings/${g.number}/` links). Props carry
  the grouping plus its entry from `grouping-budgets.json`.
- At build, the page imports `runScenario`, `defaultAssumptions`, and
  `createContext` from `@vt-budget/model`. It builds a `ScenarioSpec = { name,
  districts, assumptions: defaultAssumptions() }` from members that resolved to a
  non-null budget, at the default consolidation factor 1.0. It runs the scenario
  **only when every member resolved to a non-null total**; otherwise it skips
  computation and renders the gap state.
- `runScenario` needs an `EngineContext` but never reads its parameters (it only
  uses `ctx.nextId`). The page builds a minimal context with
  `createContext({ fiscal_year: <group FY or 0>, status: 'draft', note: null,
  parameters: new Map(), inputs: new Map() })`. No real `ParameterSet` /
  `parameters.json` is needed for the merger math.

## Section 3 — Page layout & empty states

**Header:** group number + name, member count, verified badge, Act citation
(reuse the groupings-index pattern).

Then one of three states:

**(a) All members resolved → full comparison:**

- "Run individually" table: one row per member (name, FY, status, published
  total; `null` renders as "not published," never 0).
- Combined total (`currentTotal`), scenario total at factor 1.0, and the signed
  `delta`, with a plain-language note that at the default factor the delta is $0
  by design and any change shown is one the user chose.
- Assumptions register: the single `consolidation_factor` assumption with its
  rationale, rendered from `result.assumptions`.
- The model's `caveats` list (the two fixed caveats), verbatim.
- "Explore this in the what-if tool" link to `/model/` (interactive-later hook).

**(b) Some members resolved → partial:** show the "run individually" table for the
members we have, then a blocking notice: "Combined total not computed: j of m
member budgets are missing." List exactly which members are missing/ambiguous +
the intake CTA (reuse SU page wording). **No combined number is shown.**

**(c) No members resolved → recruitment:** member list + which budgets are needed
+ intake CTA, mirroring the SU page's "No budget documents held" notice.

**Mixed fiscal years** across resolved members: show a caveat ("members' budgets
are from different years; the combined figure mixes FY20xx and FY20xx") but still
compute — withholding a fair-warning number helps no one.

## Section 4 — Testing

Correctness risk is in resolution/adapter, not markup. The pure function gets a
vitest suite alongside existing `tools/src` tests:

- **direct match** — member with its own record resolves `direct`.
- **via_su** — `ud/addison-central-55` resolves to `su/addison-central` when the
  SU has exactly one district child (real Group 1 case).
- **ambiguous** — SU with two district children is not attributed to either; both
  members come back `missing`/`ambiguous`, never summed.
- **year/status selection** — latest FY wins; `adopted` beats `proposed` same year.
- **null propagation** — a member with null `expenditures.total_stated` makes the
  group not-all-resolved, so no combined total is asserted.
- **adapter** — `total_stated` comes from `record.expenditures.total_stated` (not
  `revenues.total_stated`); an unpublished total stays `null`.

Lean on the model's existing `scenario` tests for `runScenario` behavior (delta,
caveats) rather than re-testing the engine. The `.astro` page gets no
unit test (consistent with the repo); its three states are verified in the browser
preview against Group 1 (computes) and a data-less group (recruitment state) as
the final check.

## Out of scope

- Interactive on-page controls (deferred; `/model/` link is the hook).
- Modeling transition costs, function-level merger effects, debt/transportation
  routing — all already out of scope for the model's version 1.
- Backfilling budget data for other groups (a separate intake effort).
