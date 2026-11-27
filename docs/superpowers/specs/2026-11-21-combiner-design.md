# The combiner — design

Status: approved, 2026-11-21. Brainstormed with James Nadeau.

## Intent and the why

Add a new tool, the **combiner**, beside the what-if tool. A visitor picks two or more
school districts, the tool pools their students (average daily membership, "ADM") and their
spending into one district, and it shows what that would do to the **homestead education
tax rate in every town involved**, compared with today.

The purpose is a sandbox for testing *groupings*: "if these districts were one, which towns'
rates go up, which go down, and by how much?" Act 170 of 2026 puts forward twenty such
groupings (all already transcribed in `site/src/generated/groupings.json`), so the tool
should let a visitor start from one of those and then add or remove districts.

The what-if tool (`/model`) can't do this. It runs one district with one common level of
appraisal (CLA). A pooled district has many towns, each with its own CLA.

## Goals

- Pick 2+ districts; see per-town **today** vs **pooled** homestead rate, signed change,
  and the CLA used.
- "Today" and "pooled" both come from the **engine's own chain** (`tax.ts`) so the
  difference is purely the effect of pooling. A town's published rate is shown beside it
  as a reference only; it is not part of the change.
- Spending is held fixed by default: pooled spending = sum of members' published education
  spending × a user-adjustable `consolidation_factor` (starts at 1.0; reuse the idea from
  `model/src/scenario.ts`). Any movement shown is movement the visitor chose.
- Load an Act 170 grouping as a starting point.
- Every number has its calculation tree and sources, like `/model` (reuse
  `renderWalkthrough`). One fiscal year at a time, picker like `/model`, default FY2026
  (the year the golden tests check against the Tax Department's published rates).
- Pool only what is published. Anything missing is **not computable, with the reason
  named**, never guessed (project rule: "the engine never returns a number it cannot
  justify"; null propagates).

## Non-goals

- Predicting what a merged district would actually spend.
- Nonhomestead rates, per-household bills, income-sensitivity.
- Governance, school closures, staffing (the existing staffing view stays on `/model`).
- Small-school / sparsity eligibility screening (the FY2030 small-sparse work).
- Years other than ones with CLA data (see Data).

## Anti-goals (would make this a failure even if it works)

- Any "savings" field, ranking, scoring, "best grouping", or recommendation. Deltas are
  signed, both directions shown with equal weight (`scenario.ts` header rules).
- A town that goes "up" because of a rule the engine doesn't model, presented as a pooling
  effect. Where the engine is known to be incomplete, say so on the page.
- Silent zeros. A blank is one of the four kinds of blank, labelled.
- Public text above a ~5th-grade reading level (AGENT.md). Keep *supervisory union*,
  *average daily membership*, *common level of appraisal* with a plain gloss on first use.

## Constraints

- Pure, dependency-light engine code in `model/` that runs in the build and the browser
  (`model/src/index.ts` contract). `.ts` import specifiers; Vitest; `npm run typecheck`.
- `site/` is an Astro page plus a TS "island" like `model-tool.ts`. Generated JSON is
  imported only from `.astro` frontmatter and passed to the island (see the comment in
  `model-tool.ts` about `resolved-adm.json`).
- Parameters come from the same parameter files; FY2026 is 23/23 verified against
  statute snapshots, not countersigned by a person. Say so as `/model` does.

## Approaches considered

- **A. New page, pooling math in `model/` (chosen).** New `combine` module takes the
  selected districts, builds one pooled membership input, runs the existing
  `computeWeightedMembership` → `perWeightedPupil` → `townRate` once per member town. Page
  is a thin front end. Trade-off: one new module and one new page; best testability and
  walkthrough.
- **B. Combine mode on `/model`.** Less new UI, but `/model` is one-district/one-CLA and
  already long; a multi-town table doesn't fit. Rejected.
- **C. Precompute the 20 Act 170 groupings at build time.** Cheap, but cannot test the
  visitor's own groupings, which is the point. Rejected.

## What was decided in the brainstorm

1. Approach A.
2. "Today" is the engine's own rate for each district, not the published rate (published
   shown for reference only).
3. One fiscal year at a time, default FY2026.
4. Pool only published data; missing → named "not computable".

## Design

### What gets pooled (the "unit")

**Confirmed:** the selectable unit is the **taxing district** — the `ud/` and
`town/` school districts that the registry and AOE publish ADM, spending and rates for, and
that Act 170 groups. It is *not* the supervisory union record (`su/`), which has ADM for
only one SU in the build and no spending. The picker lists districts **under their SU**
with an "add every district in this SU" shortcut, so "combine these SUs" works.

### The model module — `model/src/combine.ts`

Input: list of members `{ entity, adm_years[], spending, state_placed_fte, poverty_185_fpl,
english_learners, act84_decrease, towns: TownTaxInput[] }`, `consolidation_factor`, shared
inputs (statewide average, excess-spending adjustments), `ParameterSet`.

Output: `{ pooled: { membership, spending, perPupil, adjustment }, towns: [{ town, today,
pooled, delta, trees }], members: [{ entity, perPupil, … }] , caveats }`.

Rules:

- **ADM** is summed per grade band, per year, across members, then run through the existing
  two-year average and weights on the **pool** (weights are additive on the pooled counts,
  so pooling is not a sum of members' weighted ADM — hold-harmless and any floor also
  apply to the pool).
- A band that AOE **withheld** (value null, range only) makes that band, and so the pool,
  not computable; the range may be shown but is never used as a value (existing rule in
  `resolved-adm.json`).
- **State-placed, poverty (185% FPL), English learners:** summed only if every member has
  a published figure; else not computable, naming which member is missing it.
- **Sparsity density and small-school enrollment** are not published per pooled district
  (no population in the build). They are **inputs on the page**, as on `/model`, left
  blank by default; the result names exactly which blank blocks it. (Builder: check how
  `/model` treats blank here and match it.)
- **Hold harmless (§ 4010(e)):** off for FY2026–FY2029 per parameter file. In years it
  applies, the pooled prior-year weighted membership is the sum of members' if all are
  known, else blocked.
- **Spending:** sum of members' AOE EdSpend education spending × `consolidation_factor`.
  Null from any member → not computable. Excess-spending adjustments (capital reserve,
  bonds) are blank = none, as on `/model`.
- **Today:** each member district alone, through the same chain, with its own spending,
  membership, and own Act 84 decrease, per its own towns.
- **Pooled:** the pooled per-pupil spending through the same chain, per town, each with
  that town's CLA.
- **Act 84 transition decrease:** the "today" side uses each member's published FY2025
  decrease (AOE worksheet, already in `resolved-adm.json` `act84`). The pooled district
  is not on AOE's list and the statute snapshots do not say how a merged district is
  treated. **Decided:** default 0, adjustable. The tool must not hide this: the
  assumption is an explicit, labelled register entry with its rationale, like every other
  assumption in `scenario.ts`.
- **Towns served by more than one district** (a town whose rate blends e.g. an elementary
  district and a union high school district): v1 marks the town "not computable yet:
  rate blends more than one district" and does not guess a blend.

### Data

- **Per-town CLA is not yet in the build.** The Tax Department's FY2026 table
  (`intake/tax-rates/fy2026/`, Git LFS xlsx, 260 towns, with provenance) has it. Add a
  small importer to `warehouse/` following the pattern of the other intake importers
  (`edspend:import`), and a generated JSON for the site. FY2026 first; other years when
  their CLA tables are imported.
- Member towns per district and `su` link: `warehouse/aoe-edspend/fy2026.yaml`
  (`towns[].union_districts`) and the registry.
- ADM and spending per district: `resolved-adm.json` (note: only 56 `ud/` + 44 `town/`
  entities have bands; spending for 60 `ud/` + 62 `town/`). A district missing either is
  listed in the picker but marked "can't be combined yet: <reason>".
- Published rate per town (reference column): `warehouse/aoe-edspend/fy2026.yaml`
  `homestead_rate`.
- Groupings: `groupings.json` (`members` are `ud/`/`town/` slugs, which fits the unit).

Note (correction made during brainstorming): `homestead-comparison.json` was thought to
hold calculated rates for every SU. It holds one SU, years 2023–2025, and its calculated
values are null (blocked on spending). It is not used here.

### The page — `/combiner`

1. Fiscal-year picker (as `/model`).
2. "Start from an Act 170 grouping" (optional) and a district picker grouped by SU.
3. Spending factor (default 1.0, with the rationale text).
4. Result:
   - Pool summary: districts, towns, pooled ADM, pooled weighted ADM, pooled spending per
     weighted pupil vs each member's.
   - **Per-town table**: town · district today · rate today · rate pooled · change
     (signed, with plain "goes up / goes down / no change", no color-as-judgement) ·
     CLA · published rate (reference).
   - Each row expands to its calculation tree and sources.
   - Assumptions register; a blockers list naming what is missing.
5. A visible note when the engine is known to differ from the published rates (47 of 97
   one-to-one districts: published is lower than the chain gives; see `handoff.md`).
6. Shareable link: encodes year, districts and factor (reuse `share-link.ts` approach).

### Testing

- **Identity:** pooling one district reproduces its stand-alone result exactly.
- **Hand-checkable:** with the synthetic example parameters, two districts with round
  numbers; check pooled weighted ADM and per-pupil by hand.
- **Null propagation:** a withheld band, a missing spending, a missing poverty count each
  yield "not computable" naming the member.
- **Equal districts:** two identical districts pooled → per-pupil unchanged, deltas zero
  except where CLA/floor effects apply (a floor-of-1.00 case).
- **Golden:** pooled Slate Valley members against the existing golden fixture inputs where
  they overlap.
- Typecheck and full `npm test` stay green; site builds.

## Left to the builder

- Module/file names and the island's internal structure.
- The CLA importer's exact shape (follow existing importers).
- Ordering and wording of the table, within the reading-level rule.
- Whether the multi-district-town case can be resolved for any towns in v1 beyond the
  "not computable" fallback.

## Decisions (confirmed by James, 2026-11-21)

1. **Unit** — taxing districts, listed under their SUs with an "add every district in this
   SU" shortcut. Confirmed.
2. **Pooled Act 84 decrease** — defaults to none (0), shown as a labelled assumption with a
   plain note on the page, and the visitor can change it. Confirmed.

Status: approved.
