# Contributing

Most useful contributions here are not code. They are budget documents, corrections, and
someone reading a statute carefully.

## Sending in a budget document

The [coverage dashboard](https://example.invalid/admin/coverage/) shows every gap. Each missing
cell links to GitHub's web upload page, already pointed at the right folder. That is an ordinary
file picker, and committing through it produces a normal commit — no local checkout needed.

Two things matter more than anything else:

**Send the document exactly as released.** Do not crop it, re-save it, extract the budget pages,
or convert it. The raw artifact is the provenance record for every number derived from it, and a
re-saved PDF has a different hash from the one the district published.

**Say where it came from.** The pull request template asks for the source URL, the date you
retrieved it, and how. If it was emailed to you by a business manager rather than downloaded,
say that — it is a perfectly good provenance record, it just needs to be recorded as one.

## Reporting an error

Open an issue. Errors get fixed in public: the correction is a commit, and it shows up in the
changelog alongside everything else. A record of having been wrong and then correcting it is an
asset, not something to be quietly edited away.

If a number here disagrees with a number a district published, that is worth reporting even if
you think we are right — the disagreement itself is often the interesting part, and the schema
keeps both figures deliberately.

## Correcting AOE organization data

Some of what AOE publishes is out of date. A correction is not a local edit — it
is a claim against a named source, recorded in `registry/corrections.yaml` with
the value AOE published, the value it should be, and how you checked.

Evidence is tiered by what the field can break. A website needs a URL, the date
you retrieved it, and what you saw. A relationship — `operated_by`,
`supervisory_union`, `member_towns` — changes model output for every town
involved, so it needs a document and the operative sentence quoted, the same
standard `docs/parameter-verification.md` sets for a statutory parameter.

`npm run validate` enforces that tier and that the field and entity are real. If
AOE later moves the field to some third value that matches neither figure, the
corrected value stays in force — an evidence-backed assertion is not dropped
silently — but the build fails until a human resolves it: re-check the field,
then either update the correction's evidence or set `status: withdrawn`.

Corrections retire themselves. Once AOE publishes the value you asserted, the
sync stops asserting it — the entity is unchanged, because the two values now
agree.

To send the open set upstream:

    npm run registry:corrections -- --report --csv

This writes a markdown email body and a CSV to `derived/corrections/`, both keyed
on AOE's own organization IDs rather than our slugs, because the person receiving
them works in AOE's systems and not this repository. Neither file is committed —
both are exactly reproducible from `registry/corrections.yaml` at any commit, and
the durable record of what was sent is that file's own `sent_date`.

## Verifying a statutory parameter

This is the highest-value contribution available right now, because nothing on the site can
publish a computed figure until it is done.

Read [docs/parameter-verification.md](docs/parameter-verification.md) first. The short version:

- A parameter may be marked `verified: true` **only** by a person who has read the operative
  sentence in current statute text and pasted it into the `quote` field.
- Not a summary. Not an agency table. Not a previous version of the file. Not a language model's
  recollection, including the one that drafted these files.
- Verify the **structure** as well as the value — which weights exist, what they apply to,
  whether they multiply a base or add to a total. Correct numbers in a wrong structure produce
  confident wrong answers, and a parameter-file review will not catch it because the parameter
  file looks complete.

## Transcribing the Act 170 groupings

Bounded and mechanical, and currently blocking the default scenarios in the modeling tool. See
the comments in `registry/groupings.yaml`. Record district names exactly as the act writes them
alongside the registry slugs they map to, so the mapping itself stays auditable, and list
anything that will not map rather than dropping it.

## Code

```bash
npm install
npm test
npm run validate
npm run typecheck
```

All three must pass. CI runs the same commands.

A few conventions that are load-bearing rather than stylistic:

- **Never add a `savings` field**, or any framing that presumes which direction a result should
  go. Deltas are signed and presented in both directions.
- **Never let a null mean "unknown" ambiguously.** If you add a field that can be absent, make
  the code distinguish "the source did not publish it" from "we have not verified it", the same
  way the rest of the codebase does.
- **Never make the engine estimate.** If an input is missing, the result is `null` with a stated
  reason. Substituting a plausible value is the one thing this project cannot do.
- **Do not read AOE's `ParentOrg` / `OperatedBy` fields directly.** They mean opposite things for
  towns and schools. Go through the registry.

## Questions

Open an issue. Questions about how something works usually reveal that a comment or a document
needs improving, which is itself a contribution.
