# Design: an intake channel that works, and an LFS bill that does not grow

Status: draft, pending review
Date: 2026-07-31

## What this is for

The coverage dashboard promises something it cannot deliver. Every missing cell
links to GitHub's web upload page, and `CONTRIBUTING.md` describes that link as
"an ordinary file picker" that "produces a normal commit — no local checkout
needed." Clicking it and choosing a PDF produces this instead:

> The following files are configured to be stored in Git LFS and must be pushed
> using the Git command line with Git LFS installed:
> intake/su-addison-central/fy2025/ACSD Budget Book FY24.pdf

`.gitattributes` LFS-tracks `intake/**/*.pdf`, `.xlsx`, `.doc`, `.docx` and
`.zip`. GitHub's web upload UI cannot write LFS pointers and refuses any path
matching an LFS filter. So the link is not merely awkward: it is structurally
incapable of accepting the exact file types the project asks strangers to send.
All 324 cells currently link to a dead end.

This design replaces the channel, and fixes a second problem found while
costing the first: the workflows re-download the entire LFS corpus on every run,
which at full coverage bills for bytes that never change.

## The decision that shapes everything else

Two constraints were in tension and only one could win:

- Keep the one-click browser upload, which means intake files stop being
  LFS-tracked and become ordinary git blobs.
- Keep raw artifacts in LFS, which means the intake channel becomes something
  other than GitHub's web upload page.

**LFS wins.** Raw artifacts stay LFS-tracked. The intake channel is what
changes.

The audience constraint is that contributors are the public — a parent, a
reporter, a board member who finds the coverage page. They cannot be asked to
install `git-lfs` or clone anything. So the replacement channel must still be a
browser file picker, which means building automation to bridge it.

## What is actually possible in a browser

Two facts were verified rather than assumed, because the whole design rests on
them:

**Issue attachments cap at 25 MB.** GitHub's limits are 10 MB for images and
GIFs, 10 MB (free) or 100 MB (paid) for video, and 25 MB for "all other files."
PDFs and spreadsheets fall in the last bucket. Budget books occasionally exceed
this, so the design needs an escape hatch rather than pretending it does not
happen.

**Issue *forms* have no file-upload field, but `textarea` fields accept
drag-and-drop attachments.** A dedicated upload input has been the top-requested
issue-forms feature since 2021; the last GitHub staff response, in November
2022, said there was no progress. The textarea workaround is what other projects
use and it is sufficient here.

Together these mean a structured YAML issue form can collect both the provenance
fields *and* the document, in a browser, with no checkout.

## Part 1 — the intake channel

### The form is the schema

`schemas/provenance-1.0.schema.json` already specifies exactly what a submission
must carry. The issue form is that schema, minus the fields a machine computes
better than a human.

`.github/ISSUE_TEMPLATE/budget-intake.yml`, auto-labelled `budget-intake`:

| Field | Type | Notes |
|---|---|---|
| `entity` | input | Prefilled from the cell, e.g. `su/addison-central` |
| `fiscal_year` | input | Prefilled from the cell |
| `document` | textarea, required | The contributor drags the PDF here |
| `source_url` | input | Where it came from |
| `retrieved_date` | input | ISO date |
| `retrieval_method` | dropdown | The schema's enum verbatim: `http-fetch`, `scrape`, `manual-download`, `email`, `in_person`, `foia` |
| `document_type` | dropdown | The schema's enum verbatim: `budget_book`, `annual_report`, `town_meeting_warning`, `board_presentation`, `spreadsheet`, `aoe_report`, `tax_department_report`, `other` |
| `note` | textarea | Required when `retrieval_method` is `email` or `in_person` |

The dropdowns carry the schema's enums verbatim so a submission cannot record a
`retrieval_method` the validator will later reject. A human typing "downloaded
it" into a free-text box produces a record that fails validation after the
work of submitting it is already done.

`note` is conditionally required because the schema permits a null `source_url`
only when the method is `email` or `in_person`, and requires `note` to explain.
The form cannot enforce conditional requirements, so the workflow enforces it
and comments when it is missing.

Four fields are **never asked**: `sha256`, `bytes` and `media_type` are computed
from the received bytes, and `retrieved_by` is recorded as the issue author's
GitHub handle prefixed with `@`, e.g. `@octocat`. This is a real improvement
over the current flow, in which `sha256` is a field a human is trusted to paste
correctly into a PR — the one field where a typo silently breaks the guarantee
the schema exists to make.

`entity` is prefilled by the coverage page, but a submitter can edit it and
issues can be filed without going through a cell. The workflow therefore
validates it against the registry rather than trusting it, and rejects a slug
with no entity record. Writing `intake/su-typo/` would otherwise create a
directory the coverage matrix never reads and nobody ever finds.

### The workflow

`.github/workflows/intake.yml`, triggered on `issues: [opened, edited]` and
filtered to the `budget-intake` label:

1. Parse the form's `### Heading` sections out of the issue body.
2. Extract the attachment: the **URL** from the markdown link target, the
   **filename** from the link text. This split matters — `user-attachments`
   URLs are bare UUIDs and carry no filename, so the link text is the only
   record of what the district called the file. `.gitattributes` and the schema
   both require the artifact be stored exactly as released.

   **Exactly one attachment per issue.** The schema's `artifacts` array permits
   several, but each needs its own `source_url`, `retrieved_date` and
   `document_type`, and a flat issue form cannot express per-file fields. Two
   documents means two issues. A body carrying more than one attachment link is
   rejected with a comment saying so, rather than silently taking the first —
   silently dropping a submitted document is the worst available behaviour for
   a project about completeness. Where a directory already holds artifacts, the
   workflow appends to the existing `provenance.yaml` rather than overwriting.
3. Validate, download, hash.
4. Write `intake/<entity-slug-with-dashes>/fy<year>/<file>` and a generated
   `provenance.yaml`.
5. `git lfs install`, commit to branch `intake/issue-<n>` with a
   `Co-authored-by:` trailer for the contributor's GitHub noreply address, and
   open a PR that closes the issue.

Re-running on `edited` updates the existing branch and PR rather than opening a
second one, so a contributor who fixes a bad field does not produce duplicates.

The PR contains the raw artifact and its `provenance.yaml`, and nothing else.
Extraction and normalization stay a separate, deliberate step; `validate.yml`
checks the PR as it checks any other.

### Attribution

The commit is authored by `github-actions[bot]` using the default `GITHUB_TOKEN`
identity, with a `Co-authored-by:` trailer naming the contributor at their
GitHub noreply address (`<id>+<login>@users.noreply.github.com`). No deploy key
or PAT is introduced; a bot identity that can be impersonated by whoever holds a
long-lived secret is worse for provenance than an obviously-automated one.

This is weaker than what `CONTRIBUTING.md` currently promises —
"a normal commit with your name on it" — and the docs must stop promising it.
What the project gets in exchange is a provenance record that is structurally
validated and machine-computed rather than a template that asks nicely, which
is the better trade for a project whose entire claim is provenance rigor.

### Security boundary

This workflow downloads attacker-supplied URLs and commits the bytes. The
constraints below are load-bearing, not decorative.

**No shell interpolation of issue content.** `${{ github.event.issue.body }}`
must never appear inside a `run:` block. It is passed via `env:` and read from
`process.env` by a Node script. Direct interpolation is a script-injection hole
that gives an anonymous stranger command execution with a write token.

**Host allowlist for attachment URLs**: `github.com/user-attachments/assets/`,
`objects.githubusercontent.com`, `user-images.githubusercontent.com`. Anything
else is rejected, so the workflow cannot be used as a fetch proxy for arbitrary
hosts.

**Filename sanitisation.** Reject path separators, `..`, leading dots and
control characters; enforce an extension allowlist matching the LFS filters in
`.gitattributes`, case-insensitively — that file tracks both `*.pdf` and
`*.PDF`, and a `.Pdf` accepted by a case-sensitive check would land as a plain
git blob, defeating the LFS decision this design is built on. The filename
comes from attacker-controlled link text and without sanitisation it writes
anywhere in the tree.

**Size cap at 25 MB** and a magic-byte check that a `.pdf` actually begins
`%PDF-` and a `.xlsx` begins `PK`.

**The workflow opens a PR and never pushes to `main`.** Human merge stays the
gate, which is what `validate.yml` already describes itself as standing in for.
`permissions:` is limited to `contents: write`, `pull-requests: write`,
`issues: write`.

### Failure modes

Every rejection posts a comment naming the specific problem and leaves the issue
open, so the contributor can fix it and the `edited` trigger picks it up.

Over 25 MB is the one failure a contributor cannot fix. That comment points at
a documented clone + `git lfs install` path. This is the reason that path stays
in `CONTRIBUTING.md` rather than being deleted: it is no longer the main
channel, but it remains the only channel for oversize documents.

## Part 2 — the LFS bandwidth defect

### What is wrong

`deploy.yml` and `validate.yml` both check out with `lfs: true`, which fetches
**every LFS object at HEAD**, not the ones that changed. GitHub meters Actions
downloads like any other client: "If GitHub Actions downloads a 500 MB file
that is tracked with Git LFS, it will use 500 MB of the repository owner's
bandwidth."

The coverage matrix is 54 SUs × 6 fiscal years = **324 cells**. At the 25 MB
attachment ceiling that is a **7.9 GiB** corpus at full coverage. Free tier is
10 GiB of bandwidth per month, with overage around $0.0875/GiB.

`validate.yml` runs on `pull_request` and on `push: main`; `deploy.yml` runs on
`push: main` and deliberately re-runs `npm run validate` rather than trusting
the PR check. So a single merge to `main` costs two full-corpus fetches:

| | Bandwidth | Cost |
|---|---|---|
| One run | 7.9 GiB | $0.69 |
| One merge to `main` | 15.8 GiB | $1.38 |

The free allowance is exhausted before the first merge of the month completes.
At 100 merges/month that is roughly **$138/month**; at the project's current
pace of 46 commits in three days it is far worse. At a more realistic 5 MiB per
budget book the corpus is 1.6 GiB and 100 merges costs ~$27/month — still real
money for bytes that never change.

The defect is that **cost scales with commit rate, not data volume**. A PDF
committed once and never touched is re-downloaded on every run forever.

### Why the fetch is there, and why it is too broad

`tools/src/validate/rules.ts` re-hashes every artifact against its recorded
`sha256`. The comment in `validate.yml` defends this correctly as far as it
goes — without the bytes the validator sees only pointer files. But it verifies
all 324 artifacts on every run, when only those changed in the PR can possibly
have a new hash. The rest were verified when they landed, and the schema
declares them immutable: "a mismatch means the artifact was edited, which is
never permitted."

Nothing else needs the bytes. `tools/src/coverage.ts` reads intake *filenames*
via `readdirSync`, which works against pointer files.

### The fix

Replace `lfs: true` with `lfs: false` plus an explicit
`git lfs pull --include=<paths changed against the base ref>`. On
`pull_request` the base ref gives the diff; on `push: main` the previous commit
does.

| | Now | After |
|---|---|---|
| Bandwidth per merge | 15.8 GiB | ~50 MiB |
| Cost per merge | $1.38 | ~$0.004 |
| 100 merges/month | ~$138 | $0 — inside free tier |

Full-corpus re-verification does not disappear; it moves to a monthly scheduled
job. That costs one 7.9 GiB fetch and fits the free allowance. This preserves
the store-corruption check the current setup gets by accident, on a cadence
matching how often LFS stores actually rot, rather than on every push.

`validate.yml` must fail loudly when a changed artifact's bytes could not be
fetched. The current arrangement is safe by brute force; a selective fetch that
silently skips a file would verify nothing and report success, which is worse
than the bill.

### Storage

Storage is not the problem but is worth recording. 7.9 GiB at HEAD sits under
the 10 GiB free tier, but LFS storage counts every version ever pushed, and the
schema's `supersedes` field means revised budget books accumulate rather than
replace. Overage is ~$0.07/GiB, so this stays in the low single-digit dollars
and needs no action now. The `.gitattributes` comment already anticipates a
migration to release assets "if LFS quota becomes the binding constraint" —
after this design, it is not.

## Part 3 — site and documentation

`uploadUrl()` in `tools/src/config.ts` becomes `intakeIssueUrl()`, emitting
`/issues/new?template=budget-intake.yml&entity=<slug>&fiscal_year=<fy>`. The
function's doc comment, which currently justifies web upload as satisfying "the
everything-through-git constraint," is rewritten — the constraint is still
satisfied, but by a PR rather than a direct commit.

Callers follow: `tools/src/coverage.ts` where the cell is built, and the two
consumers in `site/src/pages/admin/coverage.astro` and
`site/src/pages/su/[slug].astro`.

Two pieces of prose describe the broken flow and must be rewritten rather than
patched:

- `site/src/pages/admin/coverage.astro`, the "How to send a budget in" section,
  which says red cells link to GitHub's web upload page.
- `CONTRIBUTING.md`, "Sending in a budget document", which makes the
  "no local checkout needed" promise and describes the PR template asking for
  provenance fields. That template's job moves into the issue form.

The rewritten prose should be honest that a bot opens the PR, and should keep
the two rules that still hold and matter most: send the document exactly as
released, and say where it came from.

## Structure and testing

The parsing, validation and provenance generation live in `tools/src/intake/`
as pure functions over an issue-body string — not in the workflow YAML, which
stays a thin shell. This is the difference between logic that can be tested
against fixtures and logic that can only be tested by filing a real issue.

Unit tests cover the hostile cases, which are the point:

- traversal filenames (`../../.github/workflows/deploy.yml`)
- non-allowlisted attachment hosts
- missing or empty attachment
- more than one attachment link in the body
- oversize file
- an `entity` slug with no registry record
- `retrieval_method: email` with a null `source_url` and no `note`
- a `retrieval_method` or `document_type` outside the schema enum
- magic bytes not matching the extension
- a case-variant extension (`.Pdf`) accepted by the allowlist
- a body with the headings reordered or a section absent

Plus the happy path: a well-formed body produces a `provenance.yaml` that
validates against `schemas/provenance-1.0.schema.json`.

For Part 2, a test asserts that a selective LFS fetch which fails to materialise
a changed artifact causes validation to fail rather than pass.

## Out of scope

- Extraction and normalization of the submitted document. The PR lands the raw
  artifact and its provenance record; turning that into a normalized budget is
  a separate, deliberate step.
- Migrating raw artifacts to release assets. Part 2 removes the pressure that
  would have forced it.
- Any change to `registry-sync.yml` or `link-check.yml`, neither of which
  fetches LFS.
