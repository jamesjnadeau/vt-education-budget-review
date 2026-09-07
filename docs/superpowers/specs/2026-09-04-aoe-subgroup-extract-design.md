# Design: importing AOE's SU-grain subgroup extract

Status: draft, pending review
Date: 2026-09-04
Amends: `docs/superpowers/specs/2026-08-20-suppressed-value-representation-design.md`

## What arrived

A public records request to AOE, answered by email on 2026-09-04, returned
`ADM_Sums_by_SU_Across_Years.csv` — 156 rows, 52 supervisory unions across SY24,
SY25 and SY26, carrying average daily membership in four grade bands plus
English-learner and NSLELG-eligible sums.

```
sha256  29394b1e742fce33b9ec20dc49d2ea90ccf30fae304c9d701663fa03c62d088c
bytes   15156
```

The request specified the extract as SQL, and that file — `adm_ferpa_suppressed.sql`
— is committed beside the artifact. It is the reason this design can state a
suppression threshold as fact rather than inference: the rule is not a header
gloss to be read carefully, it is the executable predicate AOE ran.

Two facts make the file worth having even though, as Part 4 explains, it cannot
feed the weights.

**The grade bands are the Act 127 bands.** PreK / K-5 / 6-8 / 9-12, exactly the
bands 16 V.S.A. § 4010 weights. `intake/aoe-adm/fy2024/provenance.yaml` records
that the resident-district report publishes only Elem (K-6) and SEC (7-12) and
is "not reducible" to these. This extract is the first source in the project that
carries them.

**The crosswalk is exact.** The `su` column is `aoe_org_id` in
`registry/entities/su.json`. All 52 identifiers resolve. The single registry SU
absent from the file is `SU060`, Battenkill Valley, which closed 2021-06-30 — an
absence that confirms the join rather than qualifying it.

## Part 1 — What this settles in the 2026-08-20 spec

### The floor is confirmed

The earlier spec left `[0, 11]` versus `[1, 11]` open, turning on whether AOE
publishes a true zero or suppresses it alongside the small counts. The SQL
answers it directly:

```sql
WHEN t.n_ell = 0 THEN 'published_true_zero'
```

A true zero is published and labelled. A suppressed cell therefore holds at least
one student. `floor_confirmed` becomes `true`, and `rule_source` points at the
committed SQL rather than at an argument from absence.

### The threshold is per-source, and this one is [1, 10]

```sql
SELECT 11 AS min_n
...
WHEN t.n_ell BETWEEN 1 AND p.min_n - 1 THEN NULL
```

Primary suppression fires on a headcount of 1 through 10. The FY27 LTWADM file
states its own rule as `(suppressed when student data <= 11)`, which is 1 through
11. Two AOE products, two thresholds, one off by a student.

This vindicates the earlier spec's decision to store `rule` and `rule_source` on
each suppressed cell rather than hoisting a threshold into a shared constant. **No
`MIN_N` constant is introduced.** A single global would be silently wrong for one
of the two sources, and wrong in the direction that understates a bound.

### The bound is on headcount; the value is ADM

The SQL is explicit in its header comment: suppression is keyed on student
headcount, while the published figure stays ADM. The consequence is that a
published value may sit below the threshold without being suppressible. `SU036`
in SY25 publishes `ell = 7.98` — below 11, and correctly not withheld, because
7.98 ADM is spread across twelve or more part-year students.

Because ADM per pupil never exceeds one, headcount bounds ADM from above. A
suppressed cell is therefore `(0, 10]` in ADM space: strictly above zero, since
`published_true_zero` rules out the empty case, and at most 10. The floor is
exclusive rather than 1 — a single prekindergarten pupil is 0.46 ADM.

### Constraint non-exploitation stops being a deferral

The earlier spec declined to narrow bands using the sum constraint, on the
engineering ground that `model/src/node.ts` cannot do constrained optimisation
today, and listed narrowing as something a later version could add without
re-importing.

That framing is now wrong. Narrowing a suppressed band using a published total
would partially reconstruct the figure AOE withheld. The constraint is recorded
and asserted; it is **never** exploited, and this is a privacy rule rather than a
capability gap. Adding constrained optimisation to the engine later must not
change this behaviour.

## Part 2 — Complementary band suppression

Rule 4 of the extract has no representation in the earlier spec:

```sql
-- a single suppressed band is recoverable by subtracting the published bands
-- from the SU total, so blank the smallest non-empty survivor as well
WHEN n_primary = 1 AND primary_supp = 0 AND n_band > 0 AND rn = 1 THEN TRUE
```

When exactly one grade band is primary-suppressed, a second band is blanked to
stop the first being recovered by subtraction. The second band is not small. It
is a sacrificed survivor, and it needs its own bound.

Both cells in the pair are bounded, differently, and the file does not say which
is which:

- one holds 1 to 10 students — it triggered primary suppression, so its ADM is
  `(0, 10]`;
- the other holds **at least 11** — it is non-empty and escaped `BETWEEN 1 AND 10`.

`rn = 1` also makes the survivor the smallest by headcount among the survivors,
but that does **not** bound its ADM against the published bands. The ordering is on
headcount while the figures are ADM, and prekindergarten ADM is statutorily
discounted — 21 PreK ADM is roughly 46 pupils. Comparing the two directly would
under-bound the survivor.

The upper bound comes from the sum instead. Where the SU total ADM is available
from another source, the pair sums to that total less the published bands, and
neither member can exceed that sum. Where it is not available, the survivor is
bounded below and open above, and says so.

`su/lincoln` is the only occurrence, in SY25 and SY26, with 6-8 and 9-12 blanked
against published PreK and K-5.

The representation is a pair, not two independent cells, because the disjunction
is the fact we hold:

```yaml
suppression_pairs:
  - members: [grades_6_through_8, grades_9_through_12]
    one_of:
      small:    { low: 0, high: 10, exclusive_low: true, basis: headcount }
      survivor: { low: 0, high: null, exclusive_low: true, basis: headcount_ge_11 }
    sum_equals: null    # resolved by the importer when an SU total is in hand
    rule: "primary 1..min_n-1; lone suppressed band forces smallest non-empty survivor"
    rule_source: "adm_ferpa_suppressed.sql, band_final"
```

Each member's published interval is the **union** of the two arms, since either
could be either. That is deliberately loose. Assigning the arms would require
guessing which band is small, and a wrong guess is a fabricated claim about
where a district's few pupils are.

## Part 3 — Structural zeros

The extract grids grade bands with a `CROSS JOIN` before aggregating, so an SU
that serves no such grades yields `n_band = 0`, `adm_band = 0`, and — because
`BETWEEN 1 AND 10` excludes zero — no suppression. A structural zero arrives as
the number `0.0`.

The earlier spec proposed `not_applicable` as a fifth kind of blank for towns
that publish nothing because they have nothing to publish. That status is still
needed, for Buels Gore, Ferdinand and Somerset in the LTWADM file. It does **not**
apply to this source's grade bands, which say zero out loud.

## Part 4 — Grain, and what this file is for

`warehouse/aoe-adm/adm24.yaml` holds 254 records at town grain, keyed
`town/<slug>`. LTWADM and the Act 127 weights resolve at LEA grain — 122 rows in
the FY27 file. This extract is at SU grain, 52 rows.

Fifty-two supervisory unions cannot be pushed down to 122 LEAs or 254 towns
without an allocation assumption, and inventing one would be the fabrication
`warehouse/small-sparse/gaps.yaml` refuses elsewhere. **This file does not feed
the weights, and no part of this design attempts to make it.**

What it is for:

- settling the floor and the threshold, above, against a committed artifact;
- exercising the suppression representation against 39 real primary-suppressed
  cells and two complementary pairs — `su/lincoln` in SY25 and again in SY26 — at a
  volume small enough to reason about;
- statewide validation — 82,478 / 81,647 / 79,690 ADM across the three years;
- establishing the Act 127 bands in the project for the first time.

A second request to AOE asks for LEA grain, which can feed the weights. Sequencing
this import first means that file lands into a representation already proven,
rather than debugging the representation and a much heavier suppression volume at
once.

## Part 5 — What the extract gets wrong

### SY24 English-learner and NSLELG figures are unusable

The SY24 branch of the roster derives NSLELG eligibility from a different field
than the later years:

```sql
(ADMFPSTAT = 'F') AS nslelg_flag   -- SY24
(NSLELG = 1)                       -- SY25, SY26
```

`ADMFPSTAT = 'F'` is true for very nearly every student, so it does not measure
eligibility. Where SY24 publishes a figure, it is the SU's total ADM:

| SU | nslelg | total ADM | ratio | SY25 ratio |
|---|---|---|---|---|
| SU007 | 2306.20 | 2306.10 | 1.000 | 0.321 |
| SU014 | 4065.35 | 4069.35 | 0.999 | 0.204 |
| SU065 | 3574.40 | 3560.82 | 1.004 | 0.256 |

The 41 SY24 rows marked `complement_small_cell` follow from the same defect: the
complement rule fires when `n_total - n_nslelg < 11`, which is exactly what a
~100% subgroup produces. Those blanks are an artifact of the predicate, not a
fact about Vermont, and must not be recorded as suppression.

`ell` in SY24 is `not_collected` for all 52 rows and carries no information.

**SY24 imports for grade-band ADM only.** Its `ell` and `nslelg` columns are
recorded as `missing_input` with a note naming the predicate — this is a genuine
"the source did not publish a figure," and the party at fault is the query.

### `not_collected` is emitted as zero

```sql
WHEN NOT t.ell_collected THEN 0     -- SY24: measure not collected, a true 0
```

It is not a true zero. The comment is wrong and the value is wrong, and it lands
in the same column as five genuine `published_true_zero` rows, so `0` carries two
meanings. The disclosure column separates them, which makes that column
load-bearing data rather than QA scaffolding — a consumer reading `ell` alone
fabricates 52 zeros. The second request asks for `NULL`.

### `below_reporting_floor` never fires

No SU falls under 11 students, so the code appears in the vocabulary and never in
the data. The importer must still handle it; at LEA grain it may well trigger.

## Part 6 — Publication

**The disclosure codes are intake-only.** They are recorded in provenance and in
the warehouse, consumed by the importer to build bounds, and never rendered.

The bounds themselves are published, which qualifies that rule, because a
published bound re-encodes much of its code:

- A **primary** cell publishes its band. `(0, 10]` is precisely what AOE's stated
  rule tells any reader who sees a blank, so the band discloses nothing the
  suppression scheme did not already concede.
- A **complement** cell publishes the label and **no band**. Its bound reads "at
  most 10 students here are *not* in this subgroup," and those ten are a small
  identifiable group — a different population from the one the cell describes, and
  the one the suppression exists to protect. Downstream nodes treat a
  complement-suppressed input as centreless *and* rangeless, so it blocks under the
  engine gate rather than propagating a band, and the leak cannot reappear as a
  narrow interval on a derived figure. The cost is real and accepted: an LEA with a
  complement-suppressed cell reports no LTWADM at all rather than a tight one.
- A **pair** publishes each member's union interval, per Part 2.

No complement-suppressed cell survives into usable data here — the code appears
only on SY24 `nslelg`, which Part 5 disqualifies, and every SY25 and SY26 cell is
`published`. The rule is specified now because LEA grain will trigger it.

Labels, at the reading level `AGENT.md` requires:

| case | label |
|---|---|
| primary | "hidden to protect student privacy" |
| complement | "hidden to protect student privacy" |
| pair | "hidden to protect student privacy" |

One label for all three. The distinction is ours to reason about, not the
reader's, and three shades of the same sentence would invite a reader to work out
which cells are which — reconstructing the codes this section withholds.

## Part 7 — What gets built

1. `intake/aoe-adm-subgroups/` — the artifact, `adm_ferpa_suppressed.sql`, and
   `provenance.yaml` recording email delivery under a records request.
2. `schemas/common-1.0.schema.json` — `suppression`, `suppression_pairs`, and the
   `suppressible_count` union from the earlier spec, extended for the pair case
   and for `exclusive_low`.
3. Importer to `warehouse/aoe-adm-subgroups/`, SY24 EL and NSLELG excluded.
4. `model/src/node.ts` — the gate change from the earlier spec, unchanged.
5. `model/src/types.ts` — `suppressed` and `not_applicable`, unchanged.
6. `warehouse/aoe-adm/gaps.yaml` — the `ADMFPSTAT` finding; `poverty_185_fpl` and
   `english_learners` move from `supplied: false` to supplied at SU grain, partly
   bounded, not usable for weights.
7. Goldens: `su/lincoln` for the pair, one primary cell, one `published_true_zero`.

## What stays open

**The second request.** LEA grain, the `ADMFPSTAT` predicate corrected, and
`not_collected` emitting `NULL`. Everything in Parts 1 through 3 is expected to
hold; Part 5 is expected to be fixed; Part 4 is the reason to ask.

**SY26 may be preliminary.** Seventeen SY26 values carry a denominator of 220
(20 × 11) that no SY24 or SY25 value does, suggesting an eleven-period average
rather than a settled full-year count. Worth confirming with AOE before SY26
figures are cited as final.

**Whether the SQL is AOE's or ours.** The file predates the response by three
weeks and reads as the request specification. If AOE modified it before running
it, the committed copy is the request rather than the method, and `rule_source`
should say so.
