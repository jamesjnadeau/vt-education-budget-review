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

## Why the file is currently all nulls

The FY2027 file was drafted in an environment that could not reach either
authoritative source:

| Source | Result |
|---|---|
| `legislature.vermont.gov` | TLS certificate chain could not be verified |
| `education.vermont.gov` | HTTP 403 to automated clients |

Rather than fill values in from memory or from a mirror and mark them unverified-but-present,
every value was left `null`. That choice matters more than it looks: a null value and an
unverified citation fail the same way in the engine, but a *plausible* value with an
unverified citation is one careless edit away from being published. There is nothing to
carelessly promote here.

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
- [ ] Re-read the structural assumptions above, not only the values.
