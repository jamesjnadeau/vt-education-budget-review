# FY2027 model readiness

What has to be filled in before the pipeline can produce complete FY2027 models — a
town's or district's weighted membership and homestead tax rate, plus the merge/close
scenarios. The engine refuses to emit any figure that traces back to an unverified or
null parameter, so the **hard blockers** gate everything below them: until they close,
no per-district number renders regardless of how much data is collected.

Ordering is by what each item blocks, not by effort. Check an item only when the thing
it names is actually done and `npm run validate` still passes — a checkbox here is a
claim about the world, the same standard the parameter files hold themselves to.

## Hard blockers — the engine computes nothing for FY2027 until these close

- [ ] **Resolve the Act 73 contingency and set the prekindergarten weight.**
  `weights.grade.prekindergarten` in [`model/parameters/fy2027.yaml`](../model/parameters/fy2027.yaml)
  is `null` because 16 V.S.A. § 4010(d)(1) has a version repealing it "effective July 1,
  2026 if contingency met" — a date inside FY2027. The answer is in the text of 2025
  Acts and Resolves No. 73 itself, not the codified section. Until it is read, the engine
  declines to produce weighted membership for **every** district. See
  [`docs/parameter-verification.md`](parameter-verification.md).

- [ ] **Countersign the FY2027 parameter file.** [`model/parameters/fy2027.yaml`](../model/parameters/fy2027.yaml)
  is `status: draft`. Its 17 populated values were read and transcribed by automation
  from the snapshot in `model/statute/2026-07-29/`; a person must read the snapshot
  against the file, then set `status: verified`. The parser refuses `verified` while any
  entry is still unverified.

- [ ] **`yield.property_dollar_equivalent`** — set by the FY2027 yield act; `null` until
  the act passes. Never carry a prior year forward.
  [`fy2027.yaml`](../model/parameters/fy2027.yaml)

- [ ] **`yield.income_dollar_equivalent`** — same; set by the FY2027 yield act.
  [`fy2027.yaml`](../model/parameters/fy2027.yaml)

- [ ] **`tax.statewide_adjustment`** — published annually by the Department of Taxes; not
  yet published for FY2027. [`fy2027.yaml`](../model/parameters/fy2027.yaml)

- [ ] **`foundation.base_amount`** — contingent on Act 73. The $6,800.00 statutory base
  is fixed, but the FY2027 amount depends on a published price index not yet applied.
  [`fy2027.yaml`](../model/parameters/fy2027.yaml)

- [ ] **`foundation.statewide_homestead_rate`** — contingent; to be adopted each fiscal
  year by act of the General Assembly. [`fy2027.yaml`](../model/parameters/fy2027.yaml)

## Per-district data inputs — needed to turn the formula into actual numbers

- [ ] **Collect FY2027 membership (ADM) data in the post-Act-127 grade bands.** The
  warehouse holds only ADM-24 ([`warehouse/aoe-adm/adm24.yaml`](../warehouse/aoe-adm/adm24.yaml)),
  and that report publishes pre-Act-127 Elem/SEC bands that **do not reduce** to the
  K-5 / 6-8 / 9-12 bands the weights require. Long-term membership is a two-year average
  whose later year is the current one, so FY2027 needs count-year data not yet collected
  — and [`intake/aoe-adm/source.yaml`](../intake/aoe-adm/source.yaml) only lists reports
  through ADM-25. Download by hand; `education.vermont.gov` returns 403 to automated
  clients.

- [ ] **Acquire and extract the FY2027 SU budgets.** 54 collector configs exist under
  [`collectors/`](../collectors/) but **0 budget documents are collected and 0 warehouse
  budget records exist**. Without a released budget per district there is no spending to
  run the tax math on.

- [ ] **Census land area for the remaining subdivisions** (252 of 256). Needed for the
  district population-density that drives the sparsity and small-school weights.
  `npm run census:import`.

- [ ] **Census population** — the population import needs a Census API key; without it the
  density denominator is incomplete. `npm run census:import` (with key).

- [ ] **Locate the remaining schools in a municipality** (277 of 438).
  [`derived/school-municipality/`](../derived/school-municipality/), `npm run school:municipality`.

## Scenario-modeling inputs — the tool's headline feature

- [ ] **Transcribe the Act 170 district groupings.** [`registry/groupings.yaml`](../registry/groupings.yaml)
  is empty. The ~20 groupings are the default merge/close scenarios the modeling tool is
  built around. Record each grouping's number, slug, name, and member district names
  exactly as the act writes them; map each to a registry slug; put anything unmappable in
  `unmapped_members` rather than dropping it; set `verified: true` per grouping. `npm run
  validate` checks every slug against the registry.

- [ ] **Small/sparse statutory values** — every statutory value in
  [`model/parameters/fy2030-small-sparse.yaml`](../model/parameters/fy2030-small-sparse.yaml)
  is `null` pending a reading of Act 73 Sec. 37 as possibly amended by Act 170. The
  grants implement in 2029-30 and are **not required for the core FY2027 tax model**, but
  the two statutory screens return nothing for all 438 schools until these are read.
  Structural readings to resolve first: `sparse_density.geography` (school's town vs.
  district member towns), `sparse_density.area_measure` (land vs. total area), and
  `grants.stacking_rule`.

- [ ] **Save the State Board small/sparse framework as a hashed intake artifact.** The
  proposed-framework values carry numbers but are `is_law: false` and unverified until the
  2025-12-17 committee presentation is saved into
  `intake/sbe/2025-12-17-small-sparse-framework/`. (AOE has published no "by necessity"
  determinations because the rules are not yet written — that is the State's position, not
  a repo gap.)

## Quality gate that unlocks `verified`

- [ ] **Add at least one golden fixture reproducing a published state figure.**
  [`model/src/goldens.test.ts`](../model/src/goldens.test.ts) fails if a parameter file
  claims `verified` while `model/goldens/` is empty (the small-sparse goldens do not
  count). Checking citations by eye and reproducing the state's published numbers are
  different claims, and the second is the one the site's credibility rests on.

---

The three true gates are the **Act 73 contingency**, the **human countersignature**, and
the **FY2027 yield-act figures**. None of the per-district numbers render until those
close; the groupings are what make the merge/close scenarios work on top of them.
