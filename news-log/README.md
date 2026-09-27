# news-log

A running log of Vermont education funding news, one file per run.

This is the dedup memory for the weekly "Vermont Education Funding weekly watch"
scheduled task. Before it searches anything, the run reads every file in here so it
never reports the same story twice. If you are here to read the news rather than to
feed it, start with the newest file.

The log is **append-only**. A run adds exactly one new file and never edits or deletes
an existing one. A correction to an earlier entry is written as a new bullet in the
current run's file that says what was wrong and what the right answer is — the same
principle as `registry/corrections.yaml` and the changelog: a record of having been
wrong and then fixing it is an asset, not something to edit away.

## File naming

`news-log/YYYY-MM-DD.md`, where the date is the **run date** — the day the watch ran,
not the day the news broke. One file per run date. Where the old Google Doc carried
more than one section for a date (a second run, or an addendum written after a document
was finally obtained), those are merged into that date's single file as `##` subheadings.

## Format

Each file is YAML front matter, a heading, a one-line window statement, then bullets:

```markdown
---
run_date: 2026-09-27
window: 2026-09-20..2026-09-27
cadence: weekly
beat: Vermont education funding
---

# Vermont Education Funding Watch — 2026-09-27

Covers everything published 2026-09-20 through 2026-09-27.

- HEADLINE — what happened, in a sentence or two. URL
```

Front matter fields:

| Field | Meaning |
|---|---|
| `run_date` | The day the watch ran. Matches the filename. |
| `window` | `START..END`. The publication window the run covered. Its start is the previous file's run date, so a missed week widens the window rather than skipping days. |
| `cadence` | `daily` or `weekly`. The watch ran daily 2026-08-18 through 2026-08-30 and weekly from 2026-09-07. |
| `beat` | Always `Vermont education funding`. |
| `migrated_from` | Present only on the files carried over from the original Google Doc. |

## What goes in a bullet

Substance, not a headline rewrite. Dollar figures, vote tallies, named people, statutory
deadlines — and, for a story the log has covered before, **what changed since the prior
entry**. An ongoing story is not a duplicate when it genuinely moves; it is a duplicate
when a second outlet retells the same event under a different headline. Every bullet ends
with the URL it came from. A source that could not be read is logged as unread rather
than summarized from its headline.

Alongside the news bullets, each file carries the housekeeping that makes the next run
possible:

- **`No other new items`** — names every source searched, so a future reader knows what
  silence means.
- **Verification detail** — things deliberately excluded and why (higher education,
  licensure, student achievement, nutrition administration), so they do not get
  re-litigated weekly.
- **Open threads checked** — the questions still unanswered, with how long they have
  been open. The class size implementation committee's silence is tracked in days here.
- **Run-quality note** — which fetches worked, which returned `PROVENANCE_REQUIRED`,
  `ROBOTS_DISALLOWED`, `429` or a redirect loop, and which workaround succeeded. This is
  how the fetch strategy in the scheduled task's prompt got written, and it is worth
  keeping accurate.
- **Upcoming** — a carried-forward list of dates, split into ones already logged and
  ones first logged that run.

If nothing new surfaced, the file is the front matter and heading plus a single bullet:

```markdown
- No new items.
```

## Scope

In scope: Vermont education property tax, the yield bill and the common level of
appraisal; Act 73 (2025) and Act 170 (2026) implementation — merger committees, the
foundation formula, CESAs, school construction aid; the Agency of Education, State Board
of Education, the Legislature's education and tax committees, the Governor's office, the
Tax Department and the Joint Fiscal Office; school budget votes, per-pupil spending and
Education Fund forecasts; and federal funding changes with a specific Vermont impact.

Out of scope, and excluded on purpose: higher education finance, educator licensing,
student achievement results, school cellphone and device policy, and federal nutrition
benefit administration. Each exclusion is recorded in the run's verification bullet
rather than silently dropped.

## History

The log ran in a Google Doc titled "Vermont Education Funding Watch Log" from
2026-08-18 through 2026-09-27. That doc is kept as a historical record only — do not
read from it, write to it, or recreate it. Everything in it was migrated here, one file
per run date, with the section text preserved verbatim.
