# Design: a warehouse-normalize channel that turns a read budget book into a record

Status: draft, pending review
Date: 2026-07-31

## What this is for

The intake channel lands a raw budget book and its provenance, and stops there
by design — extraction is "a separate, deliberate step." This is that step, made
into a channel of the same shape.

Right now the only way a normalized `warehouse/` record can appear is for
someone with a checkout to hand-author a schema-conformant YAML file, get every
one of the budget schema's thirteen required blocks right, account for every
null, and open a PR. The coverage dashboard even names the gap: an `intake_only`
cell means "the raw artifact is in the repo but nothing is extracted yet." Those
cells are the exact place a person who has just read the budget book wants a
button that says *normalize this*, and today there is none.

This design adds a `warehouse/` counterpart to the intake channel: a structured
issue form a trusted extractor fills in from the budget book, a bot that turns it
into a validated budget record and opens a PR, and a link from every
`intake_only` coverage cell that starts the form already pointed at the right
entity, fiscal year, and source artifact.

## The decisions that shape everything else

Three were settled before this was written and the rest follow from them.

**The audience is trusted extractors, not the public.** Unlike intake — which a
parent or reporter uses once — normalizing a budget book means reading it and
locating a handful of published totals, not a chart of accounts. That is work
for someone who has done it before, so the form can be long and demand
precision rather than holding a stranger's hand.

**Every figure is a number or the literal `n/p`; blank is an error.** The budget
schema's whole claim is that a null means "the district did not publish this,"
never "nobody looked," and it enforces that by requiring every null to be
accounted for. Rather than let a blank field quietly become either, the form
makes the extractor decide on every accountable figure: a number, or `n/p` for
not-published. An empty accountable field is rejected. This is the most
deliberate of the options considered, and it matches the rest of the codebase's
refusal to let a null be ambiguous.

**It is a separate channel, mirroring intake, not an extension of it.** A new
issue template, a new workflow, pure builders in `tools/src/normalize/`, and a
thin CLI — the same proven shape as intake, reusing its App token, its
form-parsing, its scratch-file helper, and its security posture. The intake path
was just made to work end to end; coupling a second, very different job into its
workflow would put that at risk for no gain. The cost is a second workflow YAML,
which is cheap and obvious.

## The form

`.github/ISSUE_TEMPLATE/budget-normalize.yml`, auto-labelled `budget-normalize`,
title prefix `Budget normalize:`. The fields are the budget schema minus what a
machine records better than a human.

### Identity and metadata

| Field | Type | Notes |
|---|---|---|
| `entity` | input | Registry slug, prefilled from the cell, e.g. `su/addison-central` |
| `fiscal_year` | input | Prefilled from the cell |
| `status` | dropdown | The schema's enum verbatim: `proposed`, `warned`, `approved`, `actual` |
| `source` | input | Repo-relative intake path, prefilled from the cell |
| `source_pages` | input, optional | e.g. `pp. 14-17`, so the record is checkable by hand in a minute |
| `adopted_date` | input, optional | Town-meeting/board vote date; for `approved`/`actual` |

`status` is a dropdown carrying the enum verbatim, for the same reason intake's
dropdowns do: a submission cannot record a status the validator will later
reject. `entity`, `source` and the town slugs are validated against the registry
and the repository rather than trusted — a prefilled field can be edited.

### Accountable figures — a number or `n/p`

Each must be a number or the literal `n/p`; empty is rejected.

- **Education spending:** `education_spending`
- **ADM (district-stated), by statutory band:** `adm.prekindergarten`,
  `adm.kindergarten_through_5`, `adm.grades_6_through_8`, `adm.grades_9_through_12`
- **Tax:** each member town's `homestead_rate_stated` and `cla`

### Optional descriptive fields — blank is fine

`source_pages`, `adopted_date`, and `notes` (free text). Every budget figure is
accountable; these are not.

### Tax — a structured textarea

Issue forms have no repeatable-group field, and `tax.towns` is a variable-length
array, so member-town figures go in one textarea, one town per line:

```
town-slug, homestead_rate, cla
```

for example `town/addison, 1.5225, 0.8734`. The rate and CLA are each a number
or `n/p`. The CLA is a ratio (`0.8734`), never a percentage. A budget book that
publishes no per-town rates is recorded by putting the single literal `n/p` on
its own line instead of any town rows. The textarea is required — empty is an
error, the same decision the sentinel forces everywhere else — so "no town
table" is stated, not left silent.

### lines_flagged — an optional textarea

Anything that did not fit cleanly — an ambiguous figure in the source document,
a discrepancy between two documents, a judgement call. One finding per line:

```
path :: issue text
```

`resolution` defaults to `pending`. Blank means no findings.

## Null-accounting and the sentinel

Every `n/p` on an accountable figure becomes a `not_published` entry, with
`confirmed_by` set to the issue author's GitHub handle (`@login`) and
`confirmed_date` set to the submission date. That is a truthful record: the
person submitting the form is the person confirming the figure is absent, on the
day they submit.

An empty accountable field is not guessed at and not silently nulled — it is
rejected with a comment naming the field, because an empty field is the one thing
the sentinel exists to forbid: a figure nobody decided about.

The PR body lists every path recorded as not-published, so the extractor sees
exactly what was claimed absent and can catch a mistaken `n/p` the same way an
intake contributor can catch a bad field — by editing the issue, which re-runs.

## The workflow and the code

`.github/workflows/normalize.yml`, triggered on `issues: [opened, edited,
labeled]` and gated on the `Budget normalize:` title prefix or the
`budget-normalize` label — the same double gate intake uses, for the same reason
(GitHub silently drops a template's non-existent labels). It mints the same
GitHub App token, so the PR it opens is checked by `validate.yml`.

The logic is pure functions in `tools/src/normalize/`, tested against fixture
bodies, with `tools/src/cli/normalize.ts` as the thin IO shell — exactly the
intake split. It reuses `parseIssueForm` from `tools/src/intake/parse.ts` and
`writeScratchFile` from `tools/src/intake/scratch.ts` rather than copying them.

1. Parse the form's `### Heading` sections.
2. Build the record, enforcing the sentinel on accountable fields, parsing the
   tax and `lines_flagged` textareas, and generating the `not_published` entries.
3. Validate in-process against `schemas/budget-1.0.schema.json` **and** the
   cross-file rules — `checkNullAccounting` and `checkProvenance` — so a
   problem arrives as a comment on the issue before a branch exists, not as a
   red check on a PR a bot opened.
4. Validate `entity` and every town slug against the registry, `status` against
   the enum, and `source` against both the intake-path pattern and the
   repository — a record whose `source` does not exist is rejected here rather
   than by CI later.
5. Write `warehouse/<entity-slug-with-dashes>/fy<year>-<status>.yaml` and open an
   App-token PR that closes the issue.

The filename carries the status because the schema is explicit that a
district-fiscal-year may have several records at different statuses — a
`proposed` and an `approved` are distinct rows, not revisions — so
`fy2023-proposed.yaml` and `fy2023-approved.yaml` sit side by side. Re-running on
`edited` updates the existing branch and PR rather than opening a second one.

## Security boundary

The same posture as intake, because the same thing is true: an issue body is
attacker-controllable even when the channel is aimed at trusted extractors.
`${{ github.event.issue.body }}` is passed via `env:` and read from
`process.env` by the Node script, never interpolated into a `run:` block. This
channel writes no attacker-named path and downloads nothing — the only file it
writes is the warehouse record at a path the workflow computes from a
registry-validated slug — so the filename-sanitisation and host-allowlist
concerns intake carries do not arise here. `permissions:` stays
`contents: write`, `pull-requests: write`, `issues: write`, and the workflow
opens a PR and never pushes to `main`.

## Failure modes

Every rejection posts a comment naming the specific problem and leaves the issue
open, so the extractor fixes it and the `edited` trigger picks it up — the same
loop intake uses. The rejections are: an empty accountable field; a value that
is neither a number nor `n/p`; a `status` outside the enum; an `entity` or town
slug with no registry record; a `source` that does not match the intake pattern
or does not exist; a malformed tax or `lines_flagged` line.

The slim model carries no cross-field recomputation check: the six essential
figures are each stated independently, with no rollup or per-pupil derivation
to reconcile against.

## The coverage trigger

`intakeIssueUrl()` in `tools/src/config.ts` gains a sibling
`normalizeIssueUrl(entitySlug, fiscalYear, sourcePath)`, emitting
`/issues/new?template=budget-normalize.yml&entity=<slug>&fiscal_year=<fy>&source=<path>`.

In `tools/src/coverage.ts`, the cell gains a `normalizeUrl`, populated only for
`intake_only` cells — the ones that have a raw artifact and no record yet — using
the intake filename the coverage index already reads. Where a directory holds
more than one artifact the link prefills the first; the `source` field is
editable and the bot validates whatever it receives against the repository, so
the extractor confirms or corrects it. `missing` cells keep their intake link;
`intake_only` cells gain the normalize link. The two site consumers,
`site/src/pages/admin/coverage.astro` and `site/src/pages/su/[slug].astro`,
render it: an `intake_only` cell becomes a link that says *normalize*.

## Structure and testing

The parsing, sentinel enforcement, record building and provenance of nulls live
in `tools/src/normalize/` as pure functions over an issue-body string — the
difference, again, between logic tested against fixtures and logic tested only by
filing a real issue.

Unit tests cover the cases that carry the design:

- an empty accountable field is rejected
- a value that is neither a number nor `n/p`
- an `n/p` becomes a `not_published` entry attributed to the author
- a tax row parses to a `tax.towns` entry; a bad town slug is rejected
- the single-`n/p` tax block produces an empty `tax.towns`
- a `status` outside the enum
- a `source` that does not exist in the repository
- the `lines_flagged` mini-format parses, and an unparseable line is rejected

Plus the happy path: a well-formed body produces a record that validates against
`schemas/budget-1.0.schema.json` and passes `checkNullAccounting`.

## Out of scope

- **Extracting the figures from the PDF.** A human still reads the budget book
  and captures the six essential figures (total revenue, education-fund
  receipts and their prior-year actual, total expenditure and its prior-year
  actual, and per-town tax figures); this channel structures and validates
  what they read, it does not read it for them.
- **More than one record per issue.** One district-fiscal-year-status per form,
  the same way intake takes one document per issue.
- **Editing or superseding an already-normalized record.** This channel creates
  records; revising one that already exists in `warehouse/` is a separate motion.
