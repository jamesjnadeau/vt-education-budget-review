# Design: represent AOE-suppressed small-cell values as bounded, not blank

Status: draft, pending review
Date: 2026-08-20

## What this is for

AOE's LTWADM extracts withhold any cell derived from 11 or fewer students. The
FY27 file states the rule in its own header: `(suppressed when student data <=
11)`. When we import the English-learner and economically-disadvantaged counts
this project still needs, a share of them will arrive withheld under that rule,
and there is no version of the request that changes this — the suppression
protects identifiable students and AOE is right to apply it.

The question this design answers is how those cells are recorded.

The tempting answer is `missing_input`, the existing blank meaning "the source
did not publish a figure." It is the wrong answer twice over. It misattributes
the blank — AOE did not fail to publish, they published a privacy-protective
bound, and the four-kinds-of-blank doctrine at `model/src/types.ts` exists
precisely to stop us implying a party failed when they did not. And it discards
information we actually hold: a count of 11 or fewer bounds the weight it feeds,
which bounds long-term weighted ADM, which bounds a tax rate. A district with a
suppressed EL count has a *knowably small* EL weight. Recording that as an empty
cell throws the bound away.

So a suppressed cell is not a blank at all. It is a value with a range and no
centre, and the engine already knows how to carry one of those.

## The decisions that shape everything else

Settled in brainstorming; the rest follows.

**Suppression applies only to student-derived cells.** In the FY27 file that is
the grade-levels weight and the combined economically-disadvantaged-plus-EL
weight, and in future imports the separate EL and NSLELG counts. Sparsity and
small-schools are *not* suppressible: sparsity derives from population density
and ADM, small-schools from school enrolment, and neither discloses anything
about an individual pupil. Where those columns are blank, the blank means
something else and must be recorded as something else.

**The bound propagates as an interval, with no invented centre.** A suppressed
cell reports `value: null` with a range. Downstream nodes corner-evaluate through
it and report a band. We do not compute from a midpoint: publishing 5.5 pupils
for a cell that AOE withheld would be the "fabrication that looked like data"
that `warehouse/small-sparse/gaps.yaml` already refuses elsewhere.

**The sum constraint is validated, not exploited.** Where a published total pins
the suppressed parts, we record the relationship and assert the bands can contain
it, but the engine keeps treating intervals as independent. The resulting bands
are wider than strictly necessary, which is the safe direction — never falsely
narrow. Narrowing needs constrained optimisation and dependency tracking that
`node.ts` explicitly says it cannot do today; storing the constraint means adding
it later requires no re-import.

**Towns with no pupils get their own status.** Buels Gore, Ferdinand and Somerset
publish nothing because they have nothing to publish. That is a fifth kind of
blank, terminal and correct, not a gap in coverage.

## The evidence

Read off `AAA FY27 LTWADM Public.xlsx`, 122 LEA rows. Blanks and published zeros
by column:

| column | blank | published zero |
|---|---|---|
| 2-year average ADM | 3 | 0 |
| grade levels | 7 | 0 |
| econ-disadvantaged + EL | 7 | 0 |
| sparsity | 7 | 27 |
| small schools | 1 | 66 |
| LTWADM | 3 | 0 |

Two facts drive the design. Grade-levels and ED+EL **never** appear as a
published zero, consistent with a cell that is either a real positive number or
withheld. Sparsity and small-schools **do** publish zeros freely — 27 and 66 of
them — so a blank in those columns cannot be read as "zero" either.

The seven affected rows split cleanly in three:

| rows | ADM | LTWADM | reading |
|---|---|---|---|
| Buels Gore, Ferdinand, Somerset | blank | blank | no pupils at all |
| Stannard, Stratton, Windham, Pittsfield | published | published | student cells suppressed |

All three of the first group carry `operated_by: null` and `grades: []` in the
registry. They are unpopulated gores and towns. Reading them as suppression would
invent up to 11 phantom pupils in three places that have none.

### Sparsity is computable, so it is never suppressed

Across the 88 districts with a positive sparsity weight, the ratio of sparsity to
two-year-average ADM takes exactly three values:

| tier | districts |
|---|---|
| 0.15 x ADM | 38 |
| 0.12 x ADM | 30 |
| 0.07 x ADM | 20 |
| 0 | 27 |

(Three districts each land at 0.1499 and 0.1501, which is two-decimal rounding in
the published figures, not a fourth tier.) The zero tier goes to the dense
districts — Champlain Valley, Burlington, South Burlington, Colchester — exactly
as a density-gated weight should.

Sparsity is therefore a density tier times ADM. Both inputs are non-student data,
and for all four suppressed towns ADM *is* published, so the value is recoverable
rather than hidden. Modelling it as a suppressed `[0, 11]` band would manufacture
uncertainty that does not exist.

### What the constraint is worth

With sparsity derived and small-schools resolved, the suppressed group is two
members, not four:

| town | ADM | LTWADM | sparsity (derived, 0.15 tier) | grade + ED/EL |
|---|---|---|---|---|
| Stratton | 41.71 | 63.88 | 6.26 | 15.91 |
| Pittsfield | 44.83 | 66.27 | 6.72 | 14.72 |
| Windham | 24.00 | 37.90 | 3.60 | 10.30 |
| Stannard | 7.05 | 15.89 | 1.06 | 7.78 less small-schools |

These totals are only as good as the tier assumption, so the tier is recorded as
a derived value with its own provenance rather than hardcoded, and Stannard stays
a three-way constraint until its small-schools blank is resolved.

## Part 1 — The data representation

A new `suppression` object and a `suppressible_count` union in
`schemas/common-1.0.schema.json`, so the ADM schema, the new LTWADM schema and any
future EL/NSLELG import share one definition.

```yaml
values:
  - 88.56
  - suppressed:
      low: 0
      high: 11
      floor_confirmed: false
      rule: "suppressed when student data <= 11"
      rule_source: "AAA FY27 LTWADM Public.xlsx, header row 2"
```

Every field earns its place:

- **`low` and `high`, both explicit, never defaulted.** The floor is genuinely
  unknown: agencies split on whether a true zero is published as `0` or
  suppressed alongside the small counts. `[0, 11]` and `[1, 11]` are different
  claims, and the second additionally asserts the district *has* EL pupils.
  Hardcoding either would be guessing.
- **`floor_confirmed`.** Until AOE confirms which rule applies, the floor stays
  `0` because that is the safe direction. The flag records that the extra width
  is our uncertainty and not theirs, and converts a silent assumption into a
  one-line question.
- **`rule`, verbatim, with `rule_source`.** The same discipline
  `bands_as_published` already applies in the ADM schema: the source's own words,
  never normalised, with a pointer precise enough to re-check against the hashed
  artifact.

Note the bound is on the **count**. Weights are counts times a factor, so a
weight's band falls out of interval propagation rather than being stored.

The sum constraint stores separately, since it ties cells rather than describing
one:

```yaml
suppression_constraints:
  - members: [grade_levels, ed_ell]
    equals: 15.91
    basis: "LTWADM 63.88 less ADM 41.71 less sparsity 6.26 (0.15 tier) less small_schools 0"
```

Two consequential edits to `schemas/adm-1.0.schema.json`: `values` items widen
from `number | null` to the `suppressible_count` union, and the `minimum: 0`
constraint is lifted. The latter is required independently of this design —
grade-level weights are legitimately negative for 12 LEAs (down to -103.05 for
Southwest Vermont UESD), because K-5 is the unweighted baseline under
16 V.S.A. section 4010(d)(1) and a K-5-heavy district nets below it.

## Part 2 — The engine

The core change is one condition at `model/src/node.ts:274`, currently:

```ts
if (value !== null && inputs.some((i) => i.range !== null))
```

The `value !== null` guard is what enforces the documented invariant that "a
blocked node stays a plain blank rather than sprouting a band with no center."
Centreless bands need it to distinguish two kinds of null input that are today
indistinguishable:

- a **blocked null** — no value, no range. Still blocks, exactly as now.
- a **bounded null** — no value, but a range. Corner-evaluate through it.

The gate becomes:

```ts
if (inputs.every((i) => i.value !== null || i.range !== null))
```

Corner-evaluate whenever every input is either a point or a band; leave `value`
null when any input is centreless. Point arithmetic is untouched when nothing is
bounded, so every existing golden holds unchanged.

The monotonicity argument in that comment block still carries the proof. The
independence caveat, however, gains a live example and must be reworded: "no node
yet combines two inputs derived from the same ranged source" stops being true the
moment constraint groups exist. The replacement names them as a known dependency
we deliberately do not exploit, and states that the resulting over-approximation
is safe because corner evaluation over independent intervals is a superset of the
constrained region.

Two additions to `NodeStatus` in `model/src/types.ts`, with matching
`Blocker.kind` values, both propagating upward like every other status:

- **`suppressed`** — belongs with `contingent` and `estimated` as a qualifier on
  a value, *not* as a fifth blank. AOE published something; it is a bound rather
  than a figure. Stratton's LTWADM comes out `suppressed` carrying a band, never
  `ok` and never a bare blank.
- **`not_applicable`** — a genuine fifth blank, terminal in the same way
  `not_computable` is. The question does not arise because the town has no
  pupils.

The doctrine comment at `model/src/types.ts:101` is extended to cover both,
keeping its existing structure of naming the party and the remedy for each.

## Part 3 — Site, validation, gaps, goldens

**Labels**, at the reading level `AGENT.md` requires, each naming the right party
and neither reading as anyone's failure:

| status | label |
|---|---|
| `suppressed` | "hidden to protect student privacy" |
| `not_applicable` | "no students live here" |

`formatRange` already exists and renders the band beside the suppressed label.
`STATUS_LABEL` and `STATUS_CLASS` in `site/src/scripts/model-tool.ts` gain two
entries each, and the stylesheet gains two classes. Both maps are typed
`Record<CalcNode['status'], string>`, so extending `NodeStatus` makes the compiler
demand all four additions rather than letting a status render as `undefined`.

**Validation** gains one rule: each constraint group's bands must be able to
contain its published total. A violation means the importer mis-assigned a
suppressed row, which is the error this buys us.

**Coverage** treats `not_applicable` as complete and never red, on the same
reasoning the existing comment gives for `not_computable`. `suppressed` counts as
supplied-with-a-bound rather than missing.

**`warehouse/aoe-adm/gaps.yaml`** — the `poverty_185_fpl` and `english_learners`
entries change from flatly `supplied: false` to supplied-but-combined-and-partly-
suppressed. That is a materially different claim about AOE and the walkthrough
should make it.

**Goldens** — three fixtures under `model/goldens/`: Stratton for the two-member
band, Stannard for the unresolved three-way, Buels Gore for `not_applicable` with
no phantom pupils.

## What stays open

**The floor.** `[0, 11]` versus `[1, 11]` turns on whether AOE publishes a true
zero as `0` or suppresses it too. Nothing in the three files settles it: grade
and ED/EL show zero published zeros across all 122 rows, which is consistent with
either rule. Until AOE confirms, the floor is `0` and `floor_confirmed: false`
records why. This joins the follow-up list beside the unexplained +482.18
statewide gap between the FY27 two-year average ADM and the FY22-FY26 series.

**Sparsity's blank.** Sparsity is computable and non-disclosive, so its blank in
those four rows is not explained by AOE's stated rule on its face. It is most
likely an artifact of blanking a whole row rather than a deliberate cell
suppression, but that is inference. The tier is recorded as derived with its own
provenance so the assumption is visible and falsifiable.

**Stannard's small-schools blank.** Unresolved, which is why Stannard keeps a
three-member constraint rather than two.

## What this design does not do

- It does not narrow bands using constraints. Recorded, asserted, not exploited.
- It does not add constrained optimisation or dependency tracking to the engine.
- It does not change point arithmetic, or any existing golden.
- It does not import EL or NSLELG counts. No such source is in hand; this
  prepares the representation so that when one arrives the suppressed cells land
  correctly instead of silently becoming nulls.
