# Design: reshape the budget record around Education Spending

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

This design retires the `revenues`/`expenditures` blocks and reshapes the
budget record around four things a reader of a Vermont budget book can locate
and that matter for modelling:

1. **Education spending** — the single published figure.
2. **ADM by statutory grade band** — PreK, K–5, 6–8, 9–12.
3. **Town figures** — per member town, homestead rate and CLA (unchanged).
4. **Notes** — free text.

The null-accounting sentinel that the whole repository is built around is
**kept**: every null still means "the district did not publish this," never
"nobody looked."

## The decisions that shape everything else

These were settled in brainstorming and the rest follows from them.

**Education spending is captured, not computed.** Vermont budget books print an
"Education Spending" line directly. We transcribe that single figure rather than
storing budgeted expenditures and the three offsetting-revenue categories and
computing the difference ourselves. This matches "simplify to only these
fields" and keeps the record to one money figure instead of four. The trade-off
— we do not store the offset breakdown for an independent recomputation — is
accepted; the figure the district published is the figure that drives the rate.

**ADM is captured district-stated *and* the AOE data remains the state's
separate voice.** The record gains four district-stated ADM fields transcribed
from the budget book. The authoritative AOE ADM dataset (`warehouse/aoe-adm/`)
stays exactly as it is — the state's voice, kept separate, never reconciled. An
automated cross-check that rolls AOE town figures up to the entity and compares
them band-for-band is **out of scope for this spec** and becomes its own
follow-up; see "Out of scope." The band keys reuse the ADM schema's existing
`statutory_band` vocabulary verbatim so the two datasets speak the same
language.

**The sentinel stays; `notes` is additive.** `not_published` and
`lines_flagged` are unchanged. `notes` is a new, optional, free-text field for
context that does not belong in the structured accounting arrays. It is never
held to null-accounting.

**Schema stays `1.0`, edited in place.** The only two records are freshly
authored and unpublished, so we migrate them rather than versioning. This
follows the precedent set by the earlier slim-model change.

**The tax block is unchanged.** Each member town keeps `homestead_rate_stated`,
the optional `nonhomestead_rate_stated`, and `cla`, with the existing
null-accounting on the stated rate and CLA. Nothing in this spec touches
`tools/src/normalize/tax.ts` or the tax textarea.

## The new record shape

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

ADM is a pupil count, published to two decimals (e.g. `88.56`), not money. It
is a new figure *kind* but reuses the same parse path: a number (decimals
allowed, `>= 0`), the `n/p` sentinel, or a rejected blank. `FigureKind` gains an
`adm` member; `parseFigure` already accepts decimals and needs no change.

## The four surfaces that hold the field list, in agreement

The budget field list is duplicated across four in-sync surfaces plus the
merger engine. All move together:

1. **`schemas/budget-1.0.schema.json`** — the record body above.
2. **`tools/src/normalize/fields.ts`** — `FIGURE_FIELDS` becomes the five
   essential figures: `education_spending` (`money`) and the four `adm.*` bands
   (`adm`), all `accountable: true`. `FigureKind` gains `'adm'`.
3. **`tools/src/validate/rules.ts`** — the `ACCOUNTABLE` regex list points at
   `^education_spending$`,
   `^adm\.(prekindergarten|kindergarten_through_5|grades_6_through_8|grades_9_through_12)$`,
   and the existing `^tax\.towns\.\d+\.(homestead_rate_stated|cla)$`.
4. **`.github/ISSUE_TEMPLATE/budget-normalize.yml`** — the figure inputs become
   `education_spending`, the four `adm.*` bands (each required, number-or-`n/p`),
   the unchanged tax textarea, a new optional `notes` textarea, and the
   unchanged `lines_flagged` textarea. Input `label`s equal the dotted paths, as
   today, because `record.ts` reads the form by label.

`tools/src/normalize/record.ts` iterates `FIGURE_FIELDS` generically and is not
edited for the figure change; it gains only the read of the optional `notes`
textarea into `record.notes`.

## Ripple into the merger engine and site

`DistrictBudget` in `model/src/scenario.ts` carries the single figure the
merger math runs on. It is renamed `total_stated` → `education_spending`
throughout, and the engine's labels and prose change from "total expenditure"
to "education spending." The headline math is otherwise identical: combined
`education_spending` × `consolidation_factor` → signed `delta`.

`tools/src/grouping-budgets.ts` `adapt()` reads `record.education_spending`
instead of `record.expenditures?.total_stated`; its `BudgetInput` type follows.
The `/groupings/<n>/` page (`site/src/pages/groupings/[number].astro`) labels
follow the same rename.

## Migration of the two existing records

`warehouse/su-addison-central/fy2023-proposed.yaml` and `fy2024-proposed.yaml`
were authored under the old shape and hold total *expenditure* (~$41M and
~$46M) — which is **not** education spending. That figure was never captured,
and neither was district-stated ADM. So on migration:

- `education_spending` and all four `adm.*` bands become `null`, each with a
  `pending` `lines_flagged` entry recording that the figure is not yet
  transcribed (honest: not-yet-transcribed, not not-published).
- `tax.towns` is kept verbatim (rates and CLAs unchanged).
- `notes` is `null`.
- The old `revenues`/`expenditures` blocks are dropped.

After migration `npm run validate` is green. Backfilling the real education
spending and ADM figures from the FY23 budget book is a follow-up data task.

## Structure and testing

Each surface moves with its tests, all under the existing gates
(`npm run typecheck`, `npm test`, `npm run validate`):

- `tools/src/validate/schemas.test.ts` — the budget-schema regression guard
  asserts the new required set, the presence of `education_spending`/`adm`, and
  the absence of `revenues`/`expenditures`.
- `tools/src/validate/rules.test.ts` — null-accounting fixtures use the new
  shape; an unexplained null in `education_spending` or an `adm` band is
  rejected; the same null with a `not_published` or `lines_flagged` entry is
  accepted.
- `tools/src/normalize/fields.test.ts` — `FIGURE_FIELDS` is exactly the five new
  figures, all accountable.
- `tools/src/normalize/record.test.ts` — a well-formed body produces a record
  that validates against the slim schema; `n/p` on an `adm` band becomes a
  `not_published` entry; `notes` is read through.
- `model/src/engine.test.ts` — the scenario suite uses `education_spending`.
- `tools/src/grouping-budgets.test.ts` — resolution reads `education_spending`.

## Documentation

- `PLAN.md` §5 (the field tree and the design-principle/extraction prose) and §7
  (the merger tool's headline figure) are updated to the new shape and the
  "education spending" vocabulary.
- `docs/superpowers/specs/2026-07-31-warehouse-normalize-channel-design.md` — the
  "Accountable figures" and "Optional descriptive fields" sections are updated
  to the new field list.
- `site/src/content/explanations/vt-4-glossary.md` — the glossary gains an
  **Education spending** entry, in ABC order immediately after **Education
  Fund**, so the term this whole reshape centres on is defined for readers in
  the same plain-language voice as the rest of the list. Draft text:

  > **Education spending.** The number that actually sets your tax rate. Start
  > with everything a district plans to spend, then subtract the money that
  > comes from somewhere other than the statewide school tax — federal grants,
  > categorical state aid, and other non-tax revenue. What is left is education
  > spending. It is smaller than the total budget, and it is the figure the
  > **yield** and the **excess spending threshold** are measured against. "Total
  > budget" and "education spending" are different numbers, and this is the one
  > that lands on your bill.

## Out of scope

- **Computing education spending from expenditures minus offsets.** We capture
  the published figure; we do not store the offset breakdown or recompute it.
- **The automated AOE ADM cross-check.** Rolling AOE town figures up to the
  record's entity and comparing them band-for-band against the district-stated
  `adm` is a separate follow-up spec. It would be a warning-only check, never a
  reconciliation, and would be dormant on current AOE data because `adm24` has
  `maps_to_statutory_bands: false`. The `aggregate.ts` rollup it would reuse
  already exists.
- **Backfilling the two migrated records** with real education-spending and ADM
  figures from the source budget book.
- **A schema `2.0`.** Version `1.0` is edited in place and the two unpublished
  records are migrated.
