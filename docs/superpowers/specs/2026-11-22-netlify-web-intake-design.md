# Design: a web form for sending in budget documents

Status: approved
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
- Either upload the file (real budget-book sizes, tens of MB) or paste a link.
- Every accepted submission becomes a pull request automatically, with the raw
  artifact in Git LFS and a machine-computed `provenance.yaml` — the same
  output the issue path produces.
- No submission is ever silently dropped. A submission that cannot become a PR
  becomes a visible GitHub issue for the maintainer.

## Non-goals

- Replacing the GitHub issue form. It stays, for contributors who prefer it,
  and as the maintainer's way to re-send a failed web submission.
- Extraction or normalization. The PR holds the raw artifact and its
  provenance only, as today.
- Two-way conversation with the submitter inside the site.
- New retry/reprocessing tooling (see Failure handling).

## Anti-goals

- Publishing a submitter's email address or anything private. The repository
  is public; contact details must never reach a commit, PR, or issue.
- Auto-merging. Human merge of the PR stays the gate.
- Turning the site into an open fetch proxy or free file host.
- Silently overwriting an artifact already in the corpus.

## Constraints (verified against Netlify docs, 2026-11-22)

- **Netlify Forms caps a whole submission at 8 MB**, so the form itself never
  carries the file.
- **Netlify Functions accept at most 6 MB buffered request bodies**; binary
  bodies are base64-encoded, so ~4.5 MB of file per request. Synchronous
  functions run up to 60 s; streamed responses up to 20 MB; scheduled
  functions 30 s.
- **Netlify Blobs**: objects up to 5 GB, written only from functions / edge
  functions / build / CLI. No presigned browser upload. Readable from outside
  Netlify only with a Netlify personal access token, which is account-wide.
  Eventually consistent by default (≤ 60 s); strong consistency is opt-in.
- **Verified Netlify Forms submissions only** trigger the form-submitted event
  function; Akismet filters every submission, honeypot/reCAPTCHA rejects are
  dropped before storage.
- Forms are free and unlimited on credit-based plans.
- Raw artifacts must land in Git LFS (`.gitattributes`). The existing Actions
  intake job already has `git lfs` and the Intake GitHub App.
- Netlify builds do not set `GITHUB_REPOSITORY`, so `intakeIssueUrl()` in
  `tools/src/config.ts` currently returns `null` and the "send it in" links are
  missing on the Netlify-built site.
- `deploy.yml` still publishes a copy of the site to GitHub Pages, where
  Netlify Forms and Functions do not exist.

## Approaches considered

**A. Netlify Forms, finished by hand.** Submissions sit in the Netlify
dashboard; the maintainer runs a local command per submission. Least to
build, but every document waits on the maintainer, and uploads cap at 8 MB.

**B. Netlify Forms (file field ≤ 8 MB) plus an automatic hand-off to the
existing intake workflow; larger documents by link.** Simple, but most budget
books exceed 8 MB, and emailed documents have no link.

**B′. B, with uploads buffered in Netlify Blobs via chunked upload (chosen).**
Netlify Forms still carries the fields and does spam filtering; the file goes
to a Blobs store in ≤ 4 MB chunks through an upload function; the Actions job
pulls the chunks back through an authenticated download function. More to
build than B, but removes the size limit while staying entirely on Netlify
plus the existing GitHub machinery.

**C. Direct-to-object-storage upload (e.g. Cloudflare R2) plus a function.**
Fewer requests per upload than B′, but a second vendor, signed-URL plumbing,
and storage outside the platform the maintainer is paying for.

**Chosen: B′.** The maintainer chose B, then asked to use Blobs as a buffer to
remove the 8 MB limit. Most budget books are larger than 8 MB, and the cases a
link cannot cover — a document someone was emailed or handed — are exactly
where the site needs outside help.

## How it works

```
browser (/contribute/)
  1. picks file ──▶ POST /api/intake-upload/start      → upload id + token
  2. 4 MB chunks ──▶ PUT  /api/intake-upload/<id>/<n>   → Blobs: uploads/<id>/<n>
  3. finish     ──▶ POST /api/intake-upload/<id>/done  → Blobs: uploads/<id>/meta
  4. submits Netlify Form (fields + hidden upload_id)  ── honeypot + Akismet
                    │ verified submission
                    ▼
  Netlify form-submitted event function
    - checks upload_id is complete, marks it "submitted"
    - mints GitHub App token, repository_dispatch "web-intake"
                    │
                    ▼
  .github/workflows/intake.yml (new trigger), npm run intake in web mode
    - full validation (buildSubmission rules)
    - get bytes: GET /api/intake-download/<id>/<n> (HMAC-signed), or fetch link
    - verify assembled sha256 matches meta, size cap, magic bytes
    - duplicate + filename-collision checks
    - LFS commit, PR on intake/web-<submission-id>
    - success: DELETE /api/intake-download/<id>  (frees the blobs)
    - any failure: GitHub issue labeled web-intake-failed

  nightly scheduled function: delete uploads older than 48 h that were never
  submitted, and submitted ones older than 14 days (failure backstop)
```

### 1. The form page

A static page, `site/src/pages/contribute/index.astro` (path is Claude's
call), with a Netlify Forms `<form name="budget-intake" data-netlify="true"
netlify-honeypot="bot-field">`. The form posts URL-encoded fields only; there
is no file field.

| Field | Control | Notes |
|---|---|---|
| `entity` | `<select>` of **active supervisory unions** — the same set the coverage matrix shows | Prefilled from `?entity=`. Options built at site-build time from the registry. |
| `fiscal_year` | `<select>` of tracked years | Prefilled from `?fiscal_year=`. |
| file picker | `<input type="file">` outside the Netlify form's fields | `.pdf,.xlsx,.xls,.doc,.docx,.zip`. Uploaded by script on selection, with a progress bar. |
| `upload_id` | hidden | Set by the script once the upload completes. |
| `document_url` | URL input | "Or paste a link to the document." Exactly one of file / link. |
| `source_url` | URL input | Where the contributor got it. |
| `retrieved_date` | date input | Defaults to today. |
| `retrieval_method` | select | Plain-language labels whose `value`s are the schema enums verbatim. |
| `document_type` | select | Same. |
| `note` | textarea | Required when method is email or in person. |
| `name` | text, optional | "Your name, if you'd like credit." Goes into `retrieved_by`. |
| `email` | email, optional | "So we can ask a question if something is unclear. Never published." Stays in Netlify only. |
| `bot-field` | hidden honeypot | |
| captcha | Cloudflare Turnstile widget | Token in a hidden field; see Bot protection. |

Client-side validation mirrors `buildSubmission` (exactly one of file/link,
null-source-needs-note, ISO date, extension, size ≤ cap) so most mistakes are
caught before Submit — there is no comment thread to report them in. Submit is
disabled until any chosen file has finished uploading.

The page requires JavaScript (for the upload and the captcha). Without it,
the page says so and points to the GitHub issue form.

On success Netlify shows a thank-you page we provide, saying what happens
next and that the document will appear once reviewed.

### 2. Upload functions

Synchronous Netlify Functions (layout is Claude's call), Blobs store
`intake-uploads`, strong consistency for reads.

- **start**: body `{ filename, bytes, sha256? }`. Rejects bad extension
  (same allowlist as `security.ts`) and `bytes > MAX_WEB_BYTES` (100 MB).
  Checks the **pending-storage cap** (total bytes of unsubmitted + submitted-
  but-unprocessed uploads, tracked in a small Blobs counter/index; proposed
  1 GB) and refuses with a clear message when full. Returns a random upload id
  and a random per-upload write token.
- **chunk** `PUT …/<id>/<n>`: requires the write token; body is raw bytes
  ≤ 4 MB; `n` must be within `ceil(bytes / 4 MB)`. Writes `uploads/<id>/<n>`.
  Idempotent, so the browser can retry a failed chunk.
- **done**: requires the write token; verifies all chunks are present and the
  total length matches; records `meta` (filename, bytes, chunk count,
  created-at, state `uploaded`). The browser computes the sha256 with
  `crypto.subtle` and sends it at start so the job can verify reassembly;
  the authoritative hash is still the job's own, computed from the bytes.
- **download** `GET …/intake-download/<id>/<n>` and `GET …/<id>/meta`, and
  **delete** `DELETE …/intake-download/<id>`: authenticated by an HMAC over
  method + path + timestamp using `INTAKE_DOWNLOAD_SECRET`, shared between a
  Netlify env var and a GitHub Actions secret; requests older than 5 minutes
  are refused. Not reachable from the browser in any useful way.

The shared secret is long-lived, which the issue path's design refused for a
PAT. The difference is scope: it can read and delete pending uploads only,
not anything in the Netlify account or the repository. That is accepted.

**What the uploader can and cannot do** (maintainer's concern: no one should
be able to hijack the storage):

- The Blobs store is never exposed to the browser. There is no public read
  route; the only way to read an upload back is the HMAC-signed download
  route, which only the Actions job can sign.
- The write token is random, per upload, and good only for that upload's
  chunks and `done`. It cannot list, read, or touch any other upload.
- **After `done`, the upload is locked**: the token is invalidated and any
  further chunk write is refused, so nobody can swap the bytes between
  upload and review.
- The chunk function records each chunk's sha256 as it is written, and `done`
  stores them in `meta`. The job checks every chunk against those, then
  computes the artifact's own sha256 — the browser's hash is a cross-check,
  never trusted on its own.
- Upload ids and tokens are unguessable (≥ 128 random bits).
- Bots are kept out by a **captcha checked server-side in `start`** (see
  Bot protection). No upload can begin without a fresh, valid captcha token.
- Filling the storage is bounded by the per-file cap, the global pending cap
  and cleanup of never-submitted uploads after 48 h. There is no per-person
  or per-IP limit on how many documents someone sends. The worst a
  determined human abuser can do is fill the pending cap and make the form
  refuse uploads until cleanup; the link path keeps working, and the
  maintainer can clear the store by hand.

### Bot protection

The maintainer asked for a captcha rather than limits on submission count.

Netlify Forms' built-in reCAPTCHA option only guards the final form post,
and Netlify verifies it, so the upload function cannot see it — uploads
happen before that post. So the captcha must be verified by our own code:

- **Cloudflare Turnstile** (Claude's call): free, usually invisible or a
  single click, no image puzzles, and does not track visitors for ads the
  way Google reCAPTCHA does. It is only a widget plus a verify call, not a
  storage vendor; its site key is public, its secret key is a Netlify env
  var.
- The widget sits on the form. Its token is sent to `start`, which verifies
  it with Cloudflare's siteverify endpoint before creating the upload.
  Tokens are single-use, so the page fetches a fresh one for the final
  submit.
- The final form post carries a second token in a hidden field, and the
  form-submitted event function verifies it before dispatching. A
  submission without a valid token (including link-only submissions) is not
  dispatched; it stays in Netlify Forms for the maintainer to see.
- Netlify's honeypot and Akismet spam filtering stay on as well.
- Without JavaScript the captcha cannot run, so the page asks the visitor to
  enable it or use the GitHub issue form.

### 3. The form-submitted event function

1. Ignores forms other than `budget-intake`.
2. If `upload_id` is set: checks `meta` exists with state `uploaded`, sets it
   to `submitted`. If not, still dispatches — the job reports the problem as a
   failure issue (never silent).
3. Mints a GitHub App installation token from the Intake App
   (`INTAKE_APP_ID`, `INTAKE_APP_PRIVATE_KEY` as Netlify env vars) and sends
   `repository_dispatch` type `web-intake` with: submission id, entity, fiscal
   year, upload id, `document_url`, `source_url`, `retrieved_date`,
   `retrieval_method`, `document_type`, `note`, `name` (nested to fit GitHub's
   10-top-level-key limit). **Never `email`.**
4. There is **no cap on the number of submissions** or open PRs (maintainer's
   decision); bots are kept out by the captcha instead.
5. A dispatch failure throws, so it shows in function logs; the submission is
   still in Netlify Forms and the maintainer's notification email.

### 4. The Actions job

`intake.yml` gains `repository_dispatch: types: [web-intake]`. The issue job
stays. Web mode is either a second job or a mode flag (Claude's call) and
reads the payload from an environment variable, never interpolated into
`run:`. It needs `INTAKE_DOWNLOAD_SECRET` and the site origin.

Changes in `tools/src/intake/` and `tools/src/cli/intake.ts`:

- `buildSubmission` is split so its field rules accept either a parsed issue
  body or a dispatch payload. The rules don't change, with the web-mode
  exceptions below.
- **Getting the bytes**: with `upload_id`, fetch `meta` then each chunk via
  signed requests, concatenate, verify length and the browser's sha256. With
  `document_url`, fetch it: https only, no redirect to non-https, no
  private/loopback/link-local addresses after DNS resolution, `MAX_WEB_BYTES`
  cap, timeout. Then the existing `contentErrors` magic-byte checks.
- **Provenance tells what actually happened** (Claude's call):
  - *Uploaded file*: the contributor's `source_url`, `retrieved_date`,
    `retrieval_method` and `note` are recorded as given; the bytes are the
    contributor's own copy, as on the issue path.
  - *Link the bot fetched*: `retrieval_method: http-fetch`,
    `retrieved_date` = the job's fetch date, `source_url` = the URL fetched.
    The contributor's own account (their date, method, any differing source
    page) goes into `note`. This also resolves "email, but here is a Drive
    link": the bot fetched it, so it is an `http-fetch` of that link.
- `retrieved_by`: `web form: <name>` when a name is given, else
  `web form (anonymous)`.
- **Filename**: the uploaded file's original name, or the link's last path
  segment, through the existing `filenameError` sanitizer. If none is usable,
  generate `<entity-dir>-fy<year>-<document_type>.<ext>` and say so in `note`.
- **Collisions and duplicates** (Claude's call): if a file of that name
  already exists in the target directory on `main`, reject (failure issue) —
  never overwrite, never rename. If the sha256 already appears in any
  `provenance.yaml` in the corpus, reject as a duplicate, naming the existing
  path.
- Branch `intake/web-<submission-id>`, PR title `Budget intake: <entity> FY<year>`,
  body notes it came from the web form and gives the Netlify submission id.
  No co-author trailer.
- After the PR is open, delete the upload's blobs.

### 5. Failure handling: never silent

Any rejection in the job opens a GitHub issue labeled `web-intake-failed`,
titled with entity and FY, listing the reasons and the Netlify submission id,
and no contact details. The maintainer finds the email in Netlify if one was
given and follows up by hand.

**Reprocessing** (Claude's call): no new tooling. The maintainer re-sends the
corrected document through the existing GitHub issue form. The upload's blobs
are kept for 14 days after submission so the maintainer can still retrieve the
file (e.g. via `netlify blobs:get` on their own machine) while doing so.

If the function never reaches GitHub, the submission still exists in Netlify
Forms. The maintainer should turn on Netlify's email notification for the form
so every submission reaches their inbox regardless of the automation.

### 6. Cleanup

A nightly scheduled function deletes uploads in state `uploaded` older than
48 h (abandoned — picked a file, never submitted) and any older than 14 days,
and keeps the pending-storage counter honest by recomputing it from what
remains.

### 7. Links from the rest of the site

- Fix `intakeIssueUrl`'s `null` on Netlify by setting `GITHUB_REPOSITORY` in
  `netlify.toml`'s `[build.environment]`.
- Add `intakeFormUrl(entity, fy)` → `/contribute/?entity=…&fiscal_year=…`.
  Coverage cells and the SU page's "send it in" copy lead with the web form
  and mention the GitHub form as an alternative.
- `CONTRIBUTING.md` describes the web form first.
- **GitHub Pages is retired**: delete `.github/workflows/deploy.yml` (and
  any Pages-only base-path config), so Netlify is the only copy of the site
  and the form always works where it is linked. The maintainer turns Pages
  off in the repository settings.

## Security summary

- Form and upload fields are attacker-controlled at every hop: passed as
  data, as `client_payload`, read from `process.env`, never interpolated into
  a shell.
- The upload endpoint is public; it is bounded by the extension allowlist,
  captcha, per-file cap, per-upload write token (invalidated at `done`),
  pending-storage cap and nightly cleanup. Uploaded bytes are never
  served back publicly, so the store cannot be used as a file host.
- The download/delete endpoint requires an HMAC with a 5-minute window.
- The event function holds the App private key and only sends
  `repository_dispatch`, after verifying the captcha token.
- Link fetches are https-only, private-address-blocked, capped, time-limited,
  type-checked.
- PRs are never merged automatically; `validate.yml` runs on them.
- The email address never leaves Netlify.

## Decided by the maintainer

- Approach B′: Netlify Forms + chunked upload buffered in Netlify Blobs +
  hand-off to the existing intake workflow.
- The GitHub issue form stays alongside.
- GitHub Pages is retired; Netlify is the only host.
- No limit on the number of submissions or open PRs; a captcha keeps bots
  out instead.

## Claude's calls (correctable)

- Provenance rule for bot-fetched links, filename-collision and duplicate
  rejection, entity list = active SUs, reprocessing via the issue form,
  14-day / 48-hour retention — all above.
- Cloudflare Turnstile as the captcha, verified at upload start and at
  form submit.
- Size limits: 100 MB per file, 1 GB of uploads waiting for review.
- Page path, copy, plain-language dropdown labels.
- Chunk size 4 MB; function layout and routes; whether web mode is a separate
  job.
- Tests: unit tests in the existing `tools/src/intake/` style for split
  validation, payload parsing, provenance mapping, URL safety, filename
  derivation, collision/duplicate checks, and HMAC signing; function logic
  kept in pure modules tested the same way. One real end-to-end submission
  (a > 8 MB PDF and a link) on a deploy preview before announcing.
