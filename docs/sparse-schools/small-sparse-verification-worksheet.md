# Small / sparse parameters — verification worksheet

Companion to `model/parameters/fy2030-small-sparse.yaml`, which is all nulls. This is where the
secondary-source readings live, deliberately **outside** the parameter file.

Per `docs/parameter-verification.md`, the danger is not a wrong number, it is a *plausible*
number sitting in a `value:` field one careless edit from publication. So the numbers below are
in a document that no code reads. Copying one into the parameter file without pasting the
operative statutory sentence into the `quote` field is the exact failure the rule exists to
prevent.

**None of these is a citation of record.** They came from AOE summary pages, a JFO briefing to
House Ways and Means, and a fiscal note written against the House version of H.955 — sources
ranked fourth in the authority list, useful for cross-checking a reading and for golden tests,
never for the citation itself.

---

## What to read

| Source | Why |
|---|---|
| Act 73 of 2025, Sec. 37 — as enacted | Establishes the grants. Contingently effective, so the codified text may not reflect it |
| Act 170 of 2026 — as enacted | Reportedly repeals and re-enacts the Sec. 37 language with changes, and moves the determination to AOE annually |
| Act 73 of 2025, Sec. 8 | The charge under which the State Board committee produced the framework |
| Current codified 16 V.S.A. text | To see whether the contingent provisions have been codified yet |

Both `legislature.vermont.gov` and `education.vermont.gov` were unreachable from the environment
this project was built in — TLS chain failure and HTTP 403 to automated clients respectively.
Neither blocks a person with a browser. This is a manual afternoon, not a technical obstacle,
and it gates everything downstream.

---

## Statutory readings to confirm or refute

| Parameter | Secondary reading | Source of that reading | Watch for |
|---|---|---|---|
| `grants.small_school.per_pupil` | 3,157 USD per pupil | AOE Act 73 summary; JFO 2026-01-08 briefing | Whether Act 170 changed it |
| `grants.small_school.pupil_count_basis` | Two-year average enrollment | JFO briefing | Whether it matches the qualifying test |
| `grants.small_school.inflation_index` | "Adjusted for inflation annually", index unnamed | AOE summary | The index name; compare to the base amount's |
| `grants.sparse_school.per_pupil` | 1,954 USD per pupil | AOE Act 73 summary; JFO briefing | — |
| `grants.sparse_school.inflation_index` | Not stated | Absence in AOE summary | Whether the silence is real or a summary artifact |
| `grants.stacking_rule` | Not stated anywhere found | — | **Structural.** Additive, greater-of, or exclusive |
| `screens.small_enrollment.threshold` | Fewer than 100 students | AOE summary; JFO briefing | Strict or inclusive comparator |
| `screens.small_enrollment` basis | **Conflicting.** AOE: enrolls fewer than 100. JFO: two-year average under 100 | Both | Whether test and payment use one figure |
| `screens.sparse_density.threshold` | Fewer than 55 persons per square mile of land | AOE summary | The exact phrase, especially "of land" |
| `screens.sparse_density.geography` | The municipality the school is located in | AOE summary | **Structural.** School's town, or district's towns |
| `screens.sparse_density.population_series` | Not stated | — | If unspecified, that is the finding |
| `determination.authority` | AOE, annually, under SBE rules | Fiscal note on House H.955 | Section numbers are unconfirmed |
| `determination.rules_due_date` | 2027-03-31, folded into EQS | Fiscal note on House H.955 | Drives the comment deadline |

### The two structural questions

Numbers are the easy part. Per the structural caveat in the verification doc, these change the
shape of the calculation and a parameter review will not catch them:

1. **Stacking.** If the grants are additive, a school meeting both screens carries roughly
   5,100 per pupil under the secondary readings. If it is greater-of, roughly 3,200. That is a
   60% spread on the line item, concentrated in precisely the schools most exposed in the March
   2028 votes.

2. **Density geography.** If the test looks at the district's member towns rather than the
   school's own town, the candidate set changes substantially and a school-level model is the
   wrong shape. Read the phrase before building the screen.

---

## Framework readings — different category

The 45/60 minute thresholds and the 10–15 mile range are **not** statutory and are not on this
worksheet's confirm-or-refute list. They come from the committee report itself, which is the
primary source for what the committee proposed, and they sit in the parameter file's `framework:`
block with values present and `is_law: false`.

One thing still to do: `education.vermont.gov` serves the presentation PDF but 403s automated
clients, so the artifact needs a manual save into `intake/sbe/2025-12-17-small-sparse-framework/`
with a SHA-256 before anything cites it. The reading currently in the parameter file came from a
copy supplied in conversation. That is not a hashed intake artifact, and under rule 2 the
distinction matters.

---

## Golden tests

The layer cannot make the project's strongest claim. There are no published necessity
determinations, so there is nothing to reproduce, and `model/goldens/small-sparse/` cannot
contain a reproduction of the state's figures the way the membership goldens will. The
methodology page has to say so rather than letting a reader assume this layer carries the same
validation as the rest.

What the goldens *can* contain:

- Hand-computed screen arithmetic, including a school exactly at the enrollment threshold, a town
  exactly at the density threshold, a lakeside town where land and total area diverge sharply,
  and a school with one published enrollment year and one missing.
- A land-versus-total-area regression that fails if anyone swaps the area measure.
- A property test asserting no input combination yields a non-null grant amount while
  `eligibility_assumption` is `none`. This is the most important test in the layer and should
  fail loudly if someone later "fixes" the suppression as a bug.
- Basis-sensitivity fixtures: which schools change status between enrollment bases, and between
  population series. These double as publishable findings.

**Possible lead worth ten minutes.** Vermont pays a small schools support grant under the
*current* system, and AOE publishes the annual awards. The Act 73 grant is a different structure
with different amounts, so those awards are not a golden for this layer's values. But they may be
a structural cross-check on how a per-pupil support grant is computed and applied against a
two-year enrollment average, and they would confirm which enrollment series AOE actually uses in
practice. Check whether the published awards are reconstructable; if they are, that is a
legitimate golden for the *mechanism* even though the parameters differ.

---

## Recurring checklist addition

Add to the session checklist in `parameter-verification.md`:

- [ ] **March 2027 (or when the docket opens): small/sparse rules.** The State Board defines
      "small by necessity" and "sparse by necessity" in rule, folded into the Education Quality
      Standards. When the rules land they become a new parameter file, not an edit to this one —
      same treatment as the December JFO recommendations. File the comment before they land; see
      business plan §10.
- [ ] Confirm whether AOE has published any necessity determinations. The first publication flips
      `determination_status` from `undetermined` for some schools and is the moment the grant gate
      can open for them.
