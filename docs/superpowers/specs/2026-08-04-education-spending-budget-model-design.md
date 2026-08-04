# Design: reshape the budget record around Education Spending, and resolve ADM district-first

Status: draft, pending review
Date: 2026-08-04

## What this is for

The figures we collect per district-fiscal-year have drifted away from the one
number that actually drives Vermont's homestead tax rate. The record today
captures *total expenditure* and a handful of revenue lines. But the
tax-relevant quantity is **Education Spending** — budgeted expenditures net of
certain offsetting revenues (federal grants, categorical aid, and non-tax
revenue). Total expenditure and education spending are different numbers with
confusingly similar names, and capturing the wrong one has been a recurring
source of error.

This design does three things:

1. **Reshapes the budget record** around education spending, district-stated ADM
   by statutory grade band, the existing per-town tax figures, and free-text
   notes — retiring the `revenues`/`expenditures` blocks.
2. **Makes the engine's ADM district-first.** It builds a resolver that, for a
   given entity and fiscal year, produces the four statutory ADM bands preferring
   the district's own stated figures and falling back to the state's (AOE) count,
   publishes that resolution, and wires it into the `/model` tool as a prefill.
3. **Compares the statute's arithmetic to what districts printed.** On the SU
   page, for each year we hold a budget, a table lists member towns' homestead
   rates as published against the engine's billed-rate calculation — the
   calculated side declaring which unverified parameter blocks it until the
   statutory values are countersigned.

The null-accounting sentinel the whole repository is built around is **kept**:
every null still means "the district did not publish this," never "nobody
looked."

## The decisions that shape everything else

Settled in brainstorming; the rest follows.

**Education spending is captured, not computed.** Vermont budget books print an
"Education Spending" line directly. We transcribe that single figure rather than
storing budgeted expenditures and the three offsetting-revenue categories and
computing the difference. This matches "simplify to only these fields" and keeps
the record to one money figure. We do not store the offset breakdown; the figure
the district published is the figure that drives the rate.

**ADM is captured district-stated, and the engine prefers it over the state
count.** The record gains four district-stated ADM fields transcribed from the
budget book. The authoritative AOE ADM dataset (`warehouse/aoe-adm/`) stays
exactly as it is — the state's separate voice, never reconciled. A resolver
prefers the district-stated figure and falls back to the AOE count per band; a
validator cross-check *warns* where the two disagree but never reconciles them.
Band keys reuse the ADM schema's `statutory_band` vocabulary verbatim.

**The sentinel stays; `notes` is additive.** `not_published` and
`lines_flagged` are unchanged. `notes` is a new, optional, free-text field, never
held to null-accounting.

**Schema stays `1.0`, edited in place.** The two records are freshly authored and
unpublished, so we migrate them. Follows the earlier slim-model precedent.

**The tax block is unchanged.** Each member town keeps `homestead_rate_stated`,
the optional `nonhomestead_rate_stated`, and `cla`, with the existing
null-accounting. This spec does not touch `tools/src/normalize/tax.ts` or the tax
textarea.

## Part 1 — The new record shape

`schemas/budget-1.0.schema.json`, edited in place. Identity and metadata
(`schema_version`, `entity`, `fiscal_year`, `status`, `source`, `source_pages`,
`adopted_date`, `extracted_by`, `extracted_date`) are unchanged.

```yaml
schema_version: "1.0"
entity: su/<slug>
fiscal_year: 2027
status: proposed|warned|approved|actual
source: intake/<slug>/fy<year>/<file>

education_spending: …            # the book's published "Education Spending" line
adm:                             # district-STATED average daily membership, by statutory band
  prekindergarten: …             # each: number >= 0, or null
  kindergarten_through_5: …
  grades_6_through_8: …
  grades_9_through_12: …
tax:
  towns:
    - { town, homestead_rate_stated, nonhomestead_rate_stated?, cla }
notes: …                         # free text, optional (string | null)

not_published: [ … ]             # every null explained: path, confirmed_by, confirmed_date
lines_flagged: [ … ]             # anything that didn't fit cleanly
```

**Removed entirely:** the `revenues` block (`education_fund`,
`education_fund_previous_year_actual`, `total_stated`) and the `expenditures`
block (`total_stated`, `previous_year_actual`).

**Added:** top-level `education_spending` (money), the `adm` object with its four
band keys (each `number >= 0` or `null`), and top-level `notes`
(`string | null`, default `null`).

### Required and accountable

The record's `required` set becomes:

```
schema_version, entity, fiscal_year, status, source,
education_spending, adm, tax, not_published, lines_flagged
```

`adm` requires all four band keys present (a key may be `null`, but the key must
exist). `notes` is optional.

The **accountable** figures — a number or `n/p`, never a silent blank — are:

- `education_spending`
- `adm.prekindergarten`, `adm.kindergarten_through_5`,
  `adm.grades_6_through_8`, `adm.grades_9_through_12`
- each town's `homestead_rate_stated` and `cla` (unchanged)

`notes`, `nonhomestead_rate_stated`, and the identity/metadata fields are not
accountable.

### ADM values

ADM is a pupil count published to two decimals (e.g. `88.56`), not money. It is a
new figure *kind* but reuses the same parse path: a number (decimals allowed,
`>= 0`), the `n/p` sentinel, or a rejected blank. `FigureKind` gains an `adm`
member; `parseFigure` already accepts decimals and needs no change.

### The four field surfaces, in agreement

The budget field list is duplicated across four in-sync surfaces; all move
together:

1. **`schemas/budget-1.0.schema.json`** — the record body above.
2. **`tools/src/normalize/fields.ts`** — `FIGURE_FIELDS` becomes the five figures:
   `education_spending` (`money`) and the four `adm.*` bands (`adm`), all
   `accountable: true`. `FigureKind` gains `'adm'`.
3. **`tools/src/validate/rules.ts`** — the `ACCOUNTABLE` regex list points at
   `^education_spending$`,
   `^adm\.(prekindergarten|kindergarten_through_5|grades_6_through_8|grades_9_through_12)$`,
   and the existing `^tax\.towns\.\d+\.(homestead_rate_stated|cla)$`.
4. **`.github/ISSUE_TEMPLATE/budget-normalize.yml`** — the figure inputs become
   `education_spending`, the four `adm.*` bands (each required, number-or-`n/p`),
   the unchanged tax textarea, a new optional `notes` textarea, and the unchanged
   `lines_flagged` textarea. Input `label`s equal the dotted paths, as today,
   because `record.ts` reads the form by label.

`tools/src/normalize/record.ts` iterates `FIGURE_FIELDS` generically and is not
edited for the figure change; it gains only the read of the optional `notes`
textarea into `record.notes`.

## Part 2 — The merger engine and grouping page

`DistrictBudget` in `model/src/scenario.ts` carries the single figure the merger
math runs on. It is renamed `total_stated` → `education_spending` throughout, and
the engine's labels and prose change from "total expenditure" to "education
spending." The headline math is otherwise identical: combined `education_spending`
× `consolidation_factor` → signed `delta`.

`tools/src/grouping-budgets.ts` `adapt()` reads `record.education_spending`
instead of `record.expenditures?.total_stated`; its `BudgetInput` type follows.
The `/groupings/<n>/` page (`site/src/pages/groupings/[number].astro`) labels
follow the same rename.

## Part 3 — District-first ADM resolution

The `/model` engine today is an anonymous what-if calculator: it runs against
`entity: 'ud/illustrative'` and every ADM band is typed in by the user (the only
prefill is the statewide average). Nothing runs the engine for a named entity.
This part adds the data and the prefill so a user can load a real entity's ADM,
district-preferred, and still override it by typing.

### 3a. AOE ADM by statutory band (publication change)

`tools/src/aoe/adm/publish.ts` today emits, per year, each rolled-up operating
district's ADM as `values` in the *published-band* column order, plus the band
headers. It does **not** currently expose the statutory-band mapping, so a
consumer cannot read AOE ADM by statutory band.

Change: the publication additionally exposes, per year, each district's values
keyed by statutory band, derived from `bands_as_published[].statutory_band`. A
year whose bands do not map (`maps_to_statutory_bands: false`, which includes the
only current record, `adm24`) contributes **no** statutory-band values — the
fallback is simply unavailable for that year, exactly as the repo already keeps
things dormant until inputs exist. The existing published-band output is kept
unchanged for the ADM pages that already read it.

### 3b. The resolver (`model/src/adm-resolution.ts`, pure)

The choice is made **per band, not per record**: each of the four bands is
resolved independently, so a record can end up with some bands from the district
and others from the state. This uses every district-stated number available and
falls back to the state only to fill a specific missing band (PreK, most often),
rather than discarding a district's K–12 counts over one unstated row. The AOE
fallback matches on the **same fiscal year** as the budget record — never an
adjacent year.

Given an entity, a fiscal year, the district-stated ADM from that entity's budget
record, and the AOE statutory-band publication, produce the four bands each as
`{ value: number | null, source: 'district' | 'aoe' | 'unknown' }`:

- **Per band, district first.** If the budget record's `adm.<band>` is non-null,
  use it with `source: 'district'`.
- **Else the state count.** Else, if the AOE publication has a statutory-band
  value for this entity and fiscal year, use it with `source: 'aoe'`.
- **Else unknown.** Otherwise `value: null, source: 'unknown'` — and the engine's
  existing null-refusal applies downstream.

**Entity granularity (the SU↔operating-district join).** Budget records are keyed
by SU (`su/addison-central`); the AOE rollup is keyed by operating district. The
AOE branch resolves an entity to operating district(s) through the registry: a
district-like entity (a UD, or a town that runs its own school) uses its own
rollup row; an SU sums the statutory-band rollups of its member district-like
entities for that fiscal year. This reuses the same membership logic
`grouping-budgets.ts` already uses (`isDistrictLike` + `supervisory_union`). The
resolver is a pure function over already-loaded data and is unit-tested against
fixtures; it does no IO.

### 3c. Cross-check warning (rides along)

A validator check in `tools/src/validate/rules.ts`: when both a district-stated
band value **and** an AOE statutory-band value exist for the same entity and
fiscal year and disagree beyond a small tolerance, emit a **warning** (never an
error), naming both figures. It never reconciles them. Because the current AOE
record does not map to statutory bands, this warning is dormant on today's data
and fires only once a mapping-year AOE report lands — the same posture as the
rest of the ADM layer.

### 3d. Published resolved-ADM dataset

`tools/src/cli/build-data.ts` emits `site/src/generated/resolved-adm.json`, keyed
by `entity` then `fiscal_year`, each carrying the four resolved bands
(`{ value, source }`). Built from the budget records + the AOE publication + the
registry, at build time, so it is never committed (matching the derived-data
rule).

### 3e. The `/model` prefill

`site/src/pages/model/index.astro` gains an optional "load a district" control (an
entity picker and a fiscal-year picker, populated from `resolved-adm.json`).
`site/src/scripts/model-tool.ts`: on selection, prefill the four ADM band input
fields from the resolved dataset, and label each field with its source
(`from the district's budget` / `from the state AOE count` / `not available`).
The prefill follows the existing statewide-average prefill pattern: a value the
user has already typed is not overwritten, and every prefilled field remains
editable, so the tool stays a what-if. When a band resolves to `unknown` the
field is left blank, and the engine's existing "declines to compute" behavior
handles it.

## Part 4 — Migration of the two existing records

`warehouse/su-addison-central/fy2023-proposed.yaml` and `fy2024-proposed.yaml`
hold total *expenditure* (~$41M and ~$46M) — not education spending, which was
never captured, and neither was district-stated ADM. On migration:

- `education_spending` and all four `adm.*` bands become `null`, each with a
  `pending` `lines_flagged` entry recording that the figure is not yet
  transcribed (honest: not-yet-transcribed, not not-published).
- `tax.towns` is kept verbatim (rates and CLAs unchanged).
- `notes` is `null`.
- The old `revenues`/`expenditures` blocks are dropped.

After migration `npm run validate` is green. Backfilling the real figures from
the FY23 budget book is a follow-up data task.

## Part 5 — Homestead rate: calculated vs published, on the SU page

The `/model` tool already computes a town's billed homestead rate
(`billedHomesteadRate` / `townRate` in `model/src/tax.ts`), and the budget record
now carries each town's *published* stated rate. This part surfaces the two side
by side on the SU page, for the years we hold budgets, so a reader can see how the
statute's arithmetic compares to what the district printed.

### 5a. The comparison, built at build time

`tools/src/cli/build-data.ts` emits `site/src/generated/homestead-comparison.json`,
keyed by SU → fiscal year → town, each carrying:

- **published** — the town's `homestead_rate_stated` from that SU's budget record
  for the year (or `null` with a not-published/flag note, per the record).
- **calculated** — the engine's billed homestead rate for that town and year, run
  through the same billed-rate path the `/model` tool uses: district per-pupil
  education spending (`education_spending` ÷ resolved weighted membership from
  Part 3) folded through the spending adjustment, then divided by the town's CLA
  over the statewide adjustment. When any required input is a null/unverified
  parameter, this is **not a number but the engine's blocker** — the specific
  parameter that stopped it — exactly as the `/model` walkthrough renders a
  blocked step.
- **difference** — published minus calculated, present only when both are numbers.

The engine run reuses the resolved-ADM dataset (Part 3d) for weighted membership
and the live fiscal-year parameter set from `parameters.json`. Because those
statutory parameters are currently null/unverified, **every calculated cell is a
blocker today**; the column fills in automatically as parameters are verified.
This is scaffolding built ahead of its inputs, the same posture as the rest of the
engine — the published column is fully populated now, the calculated column
declares precisely what it is waiting on.

### 5b. The table on the SU page

`site/src/pages/su/[slug].astro` renders, for each previous year the SU has a
budget record, a table of its member towns:

| Town | Year | Published rate | Calculated (billed) rate | Difference |
|---|---|---|---|---|

A calculated cell that is blocked shows the blocking parameter (e.g. "awaiting
`tax.property_yield`") rather than a number, and the Difference cell is blank. The
page reads `homestead-comparison.json`; it runs no engine itself. Where the SU has
no budget records the section is omitted rather than shown empty.

## Structure and testing

Each surface moves with its tests, all under the existing gates
(`npm run typecheck`, `npm test`, `npm run validate`):

- `tools/src/validate/schemas.test.ts` — regression guard: new required set,
  `education_spending`/`adm` present, `revenues`/`expenditures` absent.
- `tools/src/validate/rules.test.ts` — null-accounting on the new shape; the new
  ADM cross-check warning fires on a mapping-year disagreement fixture and stays
  silent on a non-mapping year.
- `tools/src/normalize/fields.test.ts` — `FIGURE_FIELDS` is exactly the five new
  figures, all accountable.
- `tools/src/normalize/record.test.ts` — a well-formed body validates against the
  slim schema; `n/p` on an `adm` band becomes a `not_published` entry; `notes` is
  read through.
- `model/src/adm-resolution.test.ts` (new) — district-first, AOE fallback,
  unknown; the SU-sums-members join; a non-mapping AOE year yields no fallback.
- `tools/src/aoe/adm/publish.test.ts` — the statutory-band output for a mapping
  year, and its absence for a non-mapping year.
- `model/src/engine.test.ts` — the scenario suite uses `education_spending`.
- `tools/src/grouping-budgets.test.ts` — resolution reads `education_spending`.
- `tools/src/cli/*` homestead-comparison builder test — for a town/year with a
  published rate and unverified parameters, `published` is the stated number and
  `calculated` is the named blocker; `difference` is absent. A fixture with
  verified parameters yields a numeric `calculated` and a `difference`, proving
  the column lights up when inputs arrive.

## Documentation

- `PLAN.md` §5 (field tree + design-principle/extraction prose) and §7 (the
  merger tool's headline figure) updated to the new shape and the "education
  spending" vocabulary; a short note on district-first ADM resolution.
- `docs/superpowers/specs/2026-07-31-warehouse-normalize-channel-design.md` — the
  "Accountable figures" and "Optional descriptive fields" sections updated to the
  new field list.
- `site/src/content/explanations/vt-4-glossary.md` — the glossary gains an
  **Education spending** entry, in ABC order immediately after **Education Fund**,
  in the same plain-language voice. Draft text:

  > **Education spending.** The number that actually sets your tax rate. Start
  > with everything a district plans to spend, then subtract the money that comes
  > from somewhere other than the statewide school tax — federal grants,
  > categorical state aid, and other non-tax revenue. What is left is education
  > spending. It is smaller than the total budget, and it is the figure the
  > **yield** and the **excess spending threshold** are measured against. "Total
  > budget" and "education spending" are different numbers, and this is the one
  > that lands on your bill.

## Out of scope

- **Computing education spending from expenditures minus offsets.** We capture the
  published figure; we do not store the offset breakdown or recompute it.
- **An interactive per-entity modeling tool.** The engine consumers added here are
  a prefill into the existing anonymous `/model` tool (Part 3e) and a static,
  build-time homestead comparison table on the SU page (Part 5). Neither is a new
  interactive what-if scoped to a named district; the `/model` tool stays the one
  interactive surface.
- **Backfilling the two migrated records** with real education-spending and ADM
  figures from the source budget book.
- **A schema `2.0`.** Version `1.0` is edited in place and the two unpublished
  records are migrated.
- **Reconciling district-stated and AOE ADM.** They are surfaced with their
  sources and cross-checked with a warning; they are never merged into one
  "true" number.

## A note on size

This spec is larger than the earlier slim-model change because it carries a data
reshape *and* a resolver-plus-prefill feature. The implementation plan will
sequence it so each stage is independently green: (1) schema + field surfaces +
tests, (2) record migration, (3) merger/grouping rename, (4) AOE statutory-band
publication, (5) resolver + cross-check + dataset, (6) `/model` prefill,
(7) SU-page homestead calculated-vs-published table, (8) docs. Stages 1–3 stand on
their own; stages 4–6 are the ADM-resolution feature; stage 7 is the homestead
comparison (it depends on stage 5's resolved-ADM dataset). Each can be reviewed as
a unit.
