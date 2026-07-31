# Verifying the parameter files

Every statutory parameter this project uses is data in `model/parameters/fyNNNN.yaml`,
and every one carries a `citation` block with a `verified` flag. This document is the
procedure for turning `verified: false` into `verified: true`.

It exists because of a specific risk. The site's whole credibility position is
independent verification, plainly explained. A single wrong pupil weight, published
confidently with a statutory citation beside it, damages that position more than a
year of missing data would. Vermont's education funding statutes have been amended in
most recent sessions — Act 127 of 2022, Act 73 of 2025 — so a remembered weight is
quite likely to be a repealed one, and a weight copied from a secondary source may be
several amendments stale.

## The rule

**A parameter may be marked `verified: true` only by a person who has read the
operative sentence in the current statute text and pasted it into the `quote` field.**

Not a summary of the statute. Not a table on an agency page. Not a previous version of
this file. Not a language model's recollection, including the one that drafted the
file. The statute text, current as of the date you record.

## Current state of the FY2027 file

17 of 23 parameters carry values read from the statute text snapshotted verbatim in
`model/statute/2026-07-29/`, with the operative sentence in each `citation.quote`.

The remaining six are unverified, each for a reason that is a fact about the world
rather than unfinished work:

| Parameter | Why it has no value |
|---|---|
| `weights.grade.prekindergarten` | 16 V.S.A. § 4010(d)(1) has a version effective July 1, 2026 **if the Act 73 contingency is met**, in which prekindergarten is repealed. That date falls inside FY2027 and the contingency status is not determinable from the codified section. |
| `yield.property_dollar_equivalent` | Set annually by the yield act. Not yet set for FY2027. |
| `yield.income_dollar_equivalent` | Same. |
| `tax.statewide_adjustment` | Published annually by the Department of Taxes. Not yet published for FY2027. |
| `foundation.base_amount` | Contingent on Act 73. The $6,800.00 statutory base is fixed but the FY2027 amount depends on a price index not applied here. |
| `foundation.statewide_homestead_rate` | Contingent, and to be adopted each year by act of the General Assembly. |

**The file is still `status: draft`, and the reason matters.** The retrieval and
transcription were automated. Nobody has yet read `model/statute/2026-07-29/` against
`model/parameters/fy2027.yaml` and put their name to it. Do that, then set
`status: verified` — the parser will refuse it while any entry is still unverified, so
it is safe to just try.

Note also that `status: verified` is gated a second time: `model/src/goldens.test.ts`
fails if a parameter file claims verification while `model/goldens/` is empty.
Checking citations by eye and reproducing the state's published figures are different
claims, and the second is the one the site's credibility rests on.

### The blocking question

**Has the contingency in 2025 Acts and Resolves No. 73 been met?**

Until that is answered, the engine will decline to produce weighted membership for any
district, because the prekindergarten weight is either −0.54 or does not exist and the
difference changes every district's total. That refusal is the correct output. The
answer is in Act 73 itself, not in the codified section — read the act text.

## What protects you in the meantime

This is enforced structurally, not by discipline:

- `model/src/node.ts` refuses to produce a number from an unverified parameter. It
  returns `null` and marks the computation node `unverified`, and that status
  propagates to every node above it. An unverified weight cannot become a published
  figure several steps downstream.
- `model/src/parameters/parse.ts` rejects a file declaring `status: verified` while any
  entry inside it is unverified, and rejects a `verified: true` citation with no
  `verified_date`.
- The engine distinguishes `unverified` (our outstanding work) from `missing_input`
  (the district did not publish it). These must never collapse into one another.
- `npm run validate` fails CI if a warehouse record or parameter file breaks any of the
  above.

The tests in `model/src/engine.test.ts` assert each of these directly.

## Procedure, per parameter

1. Open the statute at the URL in the parameter's `citation.source_url`. If the URL is
   stale, find the current section and **update the URL as part of the same commit**.
2. Read the operative subsection. Confirm three things separately:
   - the **value** is what the file says;
   - the **structure** is what the engine assumes — whether the weight multiplies or
     adds, what it applies to, whether it stacks with others. See the caveat below.
   - the section is **currently in force** for the fiscal year of this file, not
     effective on a future date or repealed on a past one.
3. Fill in:
   - `value`
   - `citation.quote` — the operative sentence, verbatim
   - `citation.session_law` — the act that last amended it
   - `citation.verified: true`, `verified_date` (today), `verified_by` (your name)
4. When every parameter in the file is verified, change the file's `status` to
   `verified`. The parser will refuse this while any entry is still unverified, so it
   is safe to just try it.
5. Commit with the statute sections in the message. The commit is the audit trail.

## The structural caveat, which is the easy one to miss

Verifying the *numbers* is not sufficient. The **shape** of the calculation in
`model/src/membership.ts` and `model/src/tax.ts` is itself a reading of statute:

- which weights exist and which pupils they apply to
- whether each weight multiplies a base or adds to a total
- whether sparsity and small-school weights apply to the whole weighted membership or
  to some subset
- how special education funding sits alongside the weighted membership rather than
  inside it
- whether the yield mechanism in `tax.ts` is still the operative one for this fiscal
  year, given Act 73 of 2025

A file of correct weights plugged into a wrong structure produces confident wrong
answers, and it is the failure mode a parameter-file review is least likely to catch,
because the parameter file looks complete. Read the section as a whole, not just the
numbers in it, and record structural findings in the module's header comment.

Since the small/sparse layer landed, a parameter may also carry a `structural_note` saying
what to watch for when reading that specific one — put the warning where the editing happens
rather than only in this document. Two of them decide whether that layer has the right shape
at all: whether the density test looks at the school's own town or at the district's member
towns, and whether the two grants stack. Neither is a number a review would flag.

### Two kinds of parameter, since the small/sparse layer

A parameter is law unless it says otherwise. `is_law: false` marks one that records what a
body **proposed** and may never enact — the State Board committee's necessity thresholds are
the case it exists for. These carry values, because the committee's own report is the primary
source for what the committee proposed, and quoting it accurately is a different act from
quoting a statute accurately. The engine labels anything measured against them as measured
against a proposed standard, and `parse.ts` refuses to let one carry a V.S.A. citation:
a recommendation dressed in a statute section reads as settled law to every renderer
downstream. That is this document's own rule running backwards, and it is just as damaging.

## Sources, in order of authority

1. **Vermont Statutes Online** — `legislature.vermont.gov/statutes/section/16/133/04010`
   and `.../chapter/32/135`. The authoritative current text.
2. **Acts as enacted** — `legislature.vermont.gov/Documents/.../ACTnnn As Enacted.pdf`.
   Needed when a provision is contingently effective and the codified text does not
   yet reflect it.
3. **Bill status pages** — for what changed in the current session.
4. **AOE guidance and published weight tables** — useful for cross-checking your
   reading and for the golden tests, but never the citation of record. AOE publishes
   the state's interpretation; the site's position is independent verification of it,
   which requires reading the same source they did.

## The recurring checklist

Add to the calendar, once per legislative session:

- [ ] Re-verify every parameter in the current fiscal year's file against current text.
- [ ] Run `npm run params -- --stale 400` to list citations verified more than roughly a
      year ago.
- [ ] Check whether any provision changed effective date, especially contingently
      effective foundation-formula provisions.
- [ ] Create the next fiscal year's file when the yield act passes. Do **not** carry the
      prior year's yield forward — an unset yield is genuinely null.
- [ ] December: JFO consultant recommendations on special education, sparsity, secondary
      and CTE weights land. These become a new parameter file, not an edit to an
      existing one, and the ranges they imply become `range` blocks with a real `basis`.
- [ ] **March 2027, or whenever the docket opens: the small/sparse rules.** The State Board
      defines "small by necessity" and "sparse by necessity" in rule, folded into the
      Education Quality Standards. When the rules land they become a new parameter file, not
      an edit to `fy2030-small-sparse.yaml` — same treatment as the December JFO
      recommendations. File the rulemaking comment *before* they land; the capital-cost-basis
      question in `framework.open_questions.capital_cost_basis` is the strongest one available,
      because it is public, technical, on the record, and requires no position on whether any
      district should merge. A missed comment window is unrecoverable in a way a missed number
      is not.
- [ ] Confirm whether AOE has published any necessity determinations. The first publication
      flips `determination_status` away from `undetermined` for some schools and is the moment
      the grant gate can open for them. Until then that field is the State's position, not a
      gap in our data.
- [ ] Re-read the structural assumptions above, not only the values.
