# Design: a web form for sending in budget documents

Status: draft, pending review
Date: 2026-11-22

## What this is for

The site needs documents its maintainer does not have: budget books, warnings,
board presentations that districts post or hand out. The only way in today is
the GitHub issue form (`.github/ISSUE_TEMPLATE/budget-intake.yml`), which needs
a GitHub account and an unfamiliar interface. For a parent, a reporter or a
board member who lands on a coverage page, that is too much of a barrier, and
the submissions do not come.

The site is now hosted on Netlify, and the maintainer is willing to pay for
Netlify features to make this work. The goal is the **lowest possible effort
for the person sending the document**, without giving up the provenance rigor
the project is built on.

## Goals

- A form on the site itself: no account, no GitHub, no git.
- Same questions as the issue form, phrased for the public, with the dropdowns
  still producing the schema's exact enum values.
- Either attach the file or paste a link to it.
- Every accepted submission becomes a pull request automatically, with the raw
  artifact in Git LFS and a machine-computed `provenance.yaml` — the same
  output the issue path produces.
- No submission is ever silently dropped. A submission that cannot become a PR
  becomes a visible GitHub issue for the maintainer.

## Non-goals

- Replacing the GitHub issue form. It stays, for contributors who prefer it.
- Accepting emailed documents over 8 MB through the form (see constraints).
  Those still go through the clone-and-push path in `CONTRIBUTING.md`, or the
  contributor emails the maintainer.
- Extraction or normalization. The PR holds the raw artifact and its
  provenance only, as today.
- Two-way conversation with the submitter inside the site.

## Anti-goals

- Publishing a submitter's email address or anything private. The repository
  is public; contact details must never reach a commit, PR, or issue.
- Auto-merging. Human merge of the PR stays the gate.
- Turning the site into an open fetch proxy for arbitrary URLs.

## Constraints (verified against Netlify docs, 2026-11-22)

- **Netlify Forms caps a whole submission at 8 MB** and uploads time out after
  30 seconds. One file per field.
- **Verified submissions only** trigger the form-submitted event function;
  Akismet filters every submission, and honeypot/reCAPTCHA rejects are dropped
  before storage. No plan requirement for spam filters.
- Forms are free and unlimited on credit-based plans; legacy plans cap at 100
  submissions/site/month before overage.
- Uploaded files arrive in the submission as a link. The docs do not say
  whether that link is signed or expires, so the design must fetch it promptly
  and must not depend on it living long.
- The submissions API (`GET /api/v1/forms/{form_id}/submissions`) lists
  submissions with their file links, which gives a retry/backup path.
- Raw artifacts must land in Git LFS (`.gitattributes`). Writing LFS objects
  needs `git lfs` or the LFS batch API; the existing Actions job already has
  the former.
- Netlify builds do not set `GITHUB_REPOSITORY`, so `intakeIssueUrl()` in
  `tools/src/config.ts` currently returns `null` and the "send it in" links are
  missing on the Netlify-built site.

## Approaches considered

**A. Netlify Forms, finished by hand.** Submissions sit in the Netlify
dashboard; the maintainer runs a local command per submission to fetch, check
and open the PR. Least to build, but every document waits on the maintainer.

**B. Netlify Forms plus an automatic hand-off to the existing intake workflow
(chosen).** Netlify Forms collects the submission and filters spam; an
event-triggered function passes it to GitHub; the existing intake job does the
download, checks, LFS commit and PR. Large posted documents come in by link.

**C. Custom upload to object storage (e.g. Cloudflare R2) plus a function.**
No size limit, but the most to build — storage, signed upload URLs, our own spam
protection — and a second storage system beside LFS.

**Chosen: B.** It removes the GitHub barrier for contributors, keeps the
maintainer's review step unchanged, and reuses nearly all of
`tools/src/intake/`. The 8 MB limit mostly doesn't bite, because most budget
books are already posted on a district site and can be submitted by link.

## How it works

```
contributor ──▶ /contribute/ form (Netlify Forms, honeypot + Akismet)
                    │ verified submission
                    ▼
        Netlify event function (formSubmitted)
          - light re-validation of fields
          - mints a GitHub App token
          - repository_dispatch "web-intake" with the fields + file link
                    │
                    ▼
        .github/workflows/intake.yml (new trigger)
          - npm run intake -- web mode
          - full validation (buildSubmission rules)
          - download: Netlify file link, or source_url
          - size cap, magic bytes, hash, LFS commit
          - PR on branch intake/web-<submission-id>
          - on any failure: open a GitHub issue labeled web-intake-failed
```

### 1. The form page

A new static page, `site/src/pages/contribute/index.astro` (path is the
builder's call), with a Netlify Forms `<form name="budget-intake" data-netlify="true"
netlify-honeypot="bot-field" enctype="multipart/form-data">`.

Fields, mapping one-to-one onto the issue form so the same validation applies:

| Field | Control | Notes |
|---|---|---|
| `entity` | `<select>` of every registry entity, by name | Prefilled from `?entity=` query param. A select, not free text, so a typo cannot happen. |
| `fiscal_year` | `<select>` of tracked years | Prefilled from `?fiscal_year=`. |
| `document` | file input, `.pdf,.xlsx,.xls,.doc,.docx,.zip` | Optional if `document_url` is given. Client-side check: ≤ 8 MB. |
| `document_url` | URL input | "Or paste a link to the document." |
| `source_url` | URL input | Where it came from. If the contributor gives only `document_url`, it doubles as the source URL. |
| `retrieved_date` | date input | Defaults to today. |
| `retrieval_method` | select | Plain-language labels ("Downloaded it from a website", "Someone emailed it to me", …) whose `value`s are the schema enums verbatim. |
| `document_type` | select | Same: plain labels, enum values. |
| `note` | textarea | Required (client-side) when method is email or in person. |
| `name` | text, optional | "Your name, if you'd like credit." Goes into `retrieved_by`. |
| `email` | email, optional | "So we can ask a question if something is unclear. Never published." Stays in Netlify only. |
| `bot-field` | hidden honeypot | |

Client-side validation mirrors the rules in `buildSubmission` (exactly one of
file/link, the null-source-needs-note rule, ISO date, 8 MB) so most mistakes
are caught before Submit, since there is no comment thread to report them in.
The page must work without JavaScript (plain HTML POST); JS only adds the
inline checks and the file-size warning. On success Netlify shows a thank-you
page we provide, saying what happens next.

If a file over 8 MB is chosen, the page says plainly: paste a link to where it
is posted instead, or, if it was emailed to you, email it to the maintainer
(address chosen by the maintainer at build time).

### 2. The event function

`netlify/functions/` (builder's call on exact layout), handling the
form-submitted event. It:

1. Ignores submissions from any form other than `budget-intake`.
2. Does a cheap sanity check only (fields present, strings within length
   limits). Full validation lives in the Actions job so the rules exist once.
3. Mints a GitHub App installation token from the same Intake App
   (`INTAKE_APP_ID`, `INTAKE_APP_PRIVATE_KEY`, set as Netlify environment
   variables), and sends `repository_dispatch` with event type `web-intake`
   and a `client_payload` containing: submission id, entity, fiscal year,
   the Netlify file link (if any), `document_url`, `source_url`,
   `retrieved_date`, `retrieval_method`, `document_type`, `note`, and `name`.
   **Never `email`.**
4. Returns quickly. If the dispatch fails, it throws, so Netlify's error is
   visible in function logs; the submission is still safe in Netlify (see
   Failure handling).

`client_payload` is limited to 10 top-level keys by GitHub; the builder nests
fields as needed.

### 3. The Actions job

`intake.yml` gains a `repository_dispatch: types: [web-intake]` trigger. The
existing issue job stays as is; a second job (or a mode switch in the same
job) runs `npm run intake` in a **web mode** that reads the payload from an
environment variable (same rule as today: never interpolated into `run:`).

Changes in `tools/src/`:

- `buildSubmission` is split so its field rules can be fed either a parsed
  issue body or a dispatch payload. The rules themselves don't change.
- `retrievedBy` for web submissions is `web form: <name>` when a name is
  given, else `web form (anonymous)`. The schema only requires a non-empty
  string.
- Download source: the Netlify file link when present, otherwise
  `document_url`. The issue path's host allowlist stays for issue
  attachments. For web mode:
  - Netlify file links must be on Netlify's upload host (builder confirms the
    exact host from a real test submission and allowlists it).
  - `document_url` may be any `https://` URL, with: no redirects to non-https,
    no private/loopback/link-local IPs after DNS resolution, a size cap, and a
    timeout. The same magic-byte check then rejects anything that isn't the
    claimed file type.
- Filename: from the uploaded file's original name, or the last path segment
  of `document_url`, then through the existing `filenameError` sanitizer. If
  no usable name can be derived (e.g. a URL ending in `/download?id=7`), the
  job builds one from the entity, fiscal year and document type and records
  that in the provenance `note`.
- Size cap for web mode: 100 MB (maintainer's call to change). Documents above
  25 MB are fine here because they come by link, not as a GitHub attachment.
- Branch `intake/web-<submission-id>`, PR title `Budget intake: <entity> FY<year>`,
  PR body says it came from the web form and includes the submission id so the
  maintainer can find the contact email in Netlify if needed. No co-author
  trailer (no GitHub identity to credit).

### 4. Failure handling: never silent

Any rejection in the Actions job — validation error, download failure,
oversize, wrong file type — opens a GitHub issue labeled `web-intake-failed`,
titled with entity and FY, listing the reasons and the Netlify submission id.
No contact details in it. The maintainer looks up the email in Netlify and
follows up by hand if one was given.

If the function never reaches GitHub (bad credentials, GitHub down), the
submission still exists in Netlify Forms and in the maintainer's Netlify email
notification. Recommended: turn on Netlify's email notification for the form,
so every submission reaches the maintainer's inbox regardless of what the
automation does. A retry script that re-dispatches a submission by id from the
submissions API is a nice-to-have, not required for the first version.

### 5. Links from the rest of the site

- `intakeIssueUrl` stays for the issue form. Fix its `null` on Netlify by
  setting `GITHUB_REPOSITORY` in `netlify.toml`'s `[build.environment]`
  (or a dedicated config value).
- Add `intakeFormUrl(entity, fy)` → `/contribute/?entity=…&fiscal_year=…`
  (respecting the site base). Coverage cells and the SU page's "send it in"
  copy lead with the web form, and mention the GitHub form as an alternative.
- `CONTRIBUTING.md` describes the web form first.

## Security summary

- Form fields are attacker-controlled at every hop: passed as data to the
  function, as `client_payload` to Actions, read from `process.env` by Node,
  and never interpolated into a shell.
- The function holds the App private key. It only ever sends
  `repository_dispatch`; it does not push or open PRs itself.
- URL fetches in web mode are https-only, private-address-blocked, size-capped,
  time-limited, and type-checked by magic bytes.
- The PR is never merged automatically; `validate.yml` runs on it as on any
  other.
- The email address never leaves Netlify.

## Decided

- Approach B, over A and C.
- The GitHub issue form stays alongside.
- Files up to 8 MB by upload, anything larger by link.

## Left to the builder (marked as Claude's calls, correctable)

- Page path (`/contribute/`) and exact copy.
- Plain-language labels for the enum dropdowns.
- Function file layout and the exact Netlify event handler name/signature
  (confirm against current Netlify docs; legacy `submission-created` naming
  may also apply).
- Web-mode size cap (proposed 100 MB) and fetch timeout.
- Generated filename format when none can be derived.
- Whether web mode is a separate job or a mode flag in the existing one.
- Test approach: unit tests for the split validation, payload parsing, URL
  safety checks and filename derivation, in the existing `tools/src/intake/`
  style; one real end-to-end submission on a deploy preview before
  announcing.
