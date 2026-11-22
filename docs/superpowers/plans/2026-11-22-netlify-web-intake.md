# Netlify Web Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public `/contribute/` form on the Netlify site that takes a budget document (upload of any size up to 100 MB, or a link) and turns each verified submission into the same LFS-backed pull request the GitHub issue form produces.

**Architecture:** The browser uploads the file in 4 MB chunks to Netlify Functions that buffer it in the Netlify Blobs store `intake-uploads`, then posts a Netlify Form carrying only the fields. The form-submitted event function verifies a Turnstile token and sends a `repository_dispatch` (`web-intake`) to GitHub, where `intake.yml` runs `npm run intake` in web mode: it pulls the chunks through an HMAC-signed download function (or fetches the link safely), runs the existing validation, commits to LFS and opens a PR, or opens a `web-intake-failed` issue. All decision logic lives in pure, tested modules under `tools/src/`; the Netlify functions are thin wrappers.

**Tech Stack:** TypeScript 6 (`.ts` import extensions, tsx), vitest, Astro static site, Netlify Functions (modern `(req: Request, context) => Response` format) + Netlify Blobs (`@netlify/blobs`) + Netlify Forms, Cloudflare Turnstile, GitHub App installation tokens, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-22-netlify-web-intake-design.md`

## Global Constraints

- Node ≥ 22; imports carry explicit `.ts` extensions; tests sit beside source as `*.test.ts` and run with `npm test` (root vitest).
- `MAX_WEB_BYTES` = 100 MB (`100 * 1024 * 1024`). Chunk size = 4 MB (`4 * 1024 * 1024`). Pending-storage cap = 1 GB (`1024 ** 3`).
- Abandoned (state `uploaded`, never submitted) uploads deleted after 48 h; every upload deleted after 14 days.
- HMAC window: requests whose timestamp is more than 5 minutes from now (either direction) are refused.
- Upload ids and write tokens: ≥ 128 random bits (`crypto.randomBytes(16)` or more, hex/base64url).
- Blobs store name `intake-uploads`, strong consistency. Keys `uploads/<id>/<n>` (chunks, 0-based) and `uploads/<id>/meta`; counter key `pending-bytes`.
- Routes: `POST /api/intake-upload/start`, `PUT /api/intake-upload/<id>/<n>`, `POST /api/intake-upload/<id>/done`, `GET /api/intake-download/<id>/meta`, `GET /api/intake-download/<id>/<n>`, `DELETE /api/intake-download/<id>`.
- Netlify form name `budget-intake`, honeypot field `bot-field`. Dispatch event type `web-intake`.
- Secrets/env: Netlify — `INTAKE_DOWNLOAD_SECRET`, `TURNSTILE_SECRET_KEY`, `INTAKE_APP_ID`, `INTAKE_APP_PRIVATE_KEY`, `PUBLIC_TURNSTILE_SITE_KEY`; GitHub Actions — `INTAKE_DOWNLOAD_SECRET` (secret), `INTAKE_SITE_ORIGIN` (variable, `https://www.vermont-school-budgets.org`), plus the existing `INTAKE_APP_ID`/`INTAKE_APP_PRIVATE_KEY`.
- The submitter's `email` never leaves Netlify: not in the dispatch payload, commit, PR, issue, or log line.
- Attacker-controlled values travel as data (`client_payload`, `process.env`, `--body-file`), never interpolated into a shell `run:` line.
- Web-mode PRs: branch `intake/web-<submission-id>`, title `Budget intake: <entity> FY<year>`, no `Co-authored-by` trailer. Never auto-merged.
- `retrieved_by`: `web form: <name>` when a name is given, else `web form (anonymous)`.
- Failure issues: label `web-intake-failed`, title `Web intake failed: <entity> FY<year>`, list reasons and the Netlify submission id, no contact details.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A dispatch payload with hostile strings** (quotes, `$(…)`, newlines in `note`/`name`) must reach the PR/issue body verbatim and never execute. → Task 9 test `web mode passes hostile note text through as data`.
2. **A link that redirects** from https to http, or to a host resolving to `127.0.0.1`/`169.254.169.254`/`10.x`/`::1`, must be refused, and so must a response that streams past 100 MB without a `Content-Length`. → Task 3 tests `refuses redirect to private address`, `aborts body over cap without content-length`.
3. **A chunk re-sent after `done`** (an attempt to swap bytes between upload and review) must be refused even with the original token. → Task 6 test `chunk after done is refused`.
4. **A submission whose upload never finished** (user submitted the form with a stale or empty `upload_id`, or the meta is missing) must still produce a visible failure issue, not silence. → Task 9 test `missing upload meta becomes a failure issue`.
5. **An uploaded filename with a path, spaces or a disallowed character** (`../../evil.pdf`, `Budget FY27 (final).pdf`) must fall back to the generated name rather than reject the whole submission. → Task 4 test `unusable original name falls back to generated name`.

---

## File Structure

| File | Responsibility |
|---|---|
| `tools/src/intake/rules.ts` (new) | Field rules shared by issue and web paths: `isIsoDate`, `checkFields`. |
| `tools/src/intake/submission.ts` (modify) | `buildSubmission` delegates field rules to `rules.ts`. |
| `tools/src/intake/security.ts` (modify) | Export `extensionOf`, `ALLOWED_EXTENSIONS`; `contentErrors` takes a cap. |
| `tools/src/web-intake/limits.ts` | All web constants from Global Constraints. |
| `tools/src/web-intake/payload.ts` | `WebIntakePayload` type, `toDispatchPayload` (Netlify side), `buildWebSubmission` (Actions side). |
| `tools/src/web-intake/fetch-link.ts` | Safe https fetch: private-IP block after DNS, manual redirects, cap, timeout. |
| `tools/src/web-intake/filename.ts` | Choose the artifact filename for a web submission. |
| `tools/src/web-intake/corpus.ts` | Duplicate-sha256 and filename-collision checks against the checkout. |
| `tools/src/web-intake/provenance-map.ts` | Map a web submission + how the bytes were obtained → `Submission` for `buildProvenance`. |
| `tools/src/web-intake/signing.ts` | HMAC sign/verify for the download routes (used by both sides). |
| `tools/src/web-intake/uploads.ts` | Upload state machine over a `BlobStore` interface (start/chunk/done/submit/read/delete/cleanup). |
| `tools/src/web-intake/turnstile.ts` | Turnstile siteverify call. |
| `tools/src/web-intake/github-app.ts` | App JWT, installation token, `repository_dispatch`. |
| `tools/src/web-intake/download-client.ts` | Actions-side signed fetch of meta + chunks, reassembly, verification. |
| `tools/src/cli/intake.ts` (modify) | Web mode (`INTAKE_MODE=web`). |
| `netlify/functions/*.mts` (new) | Thin wrappers: `intake-upload-start`, `intake-upload-chunk`, `intake-upload-done`, `intake-download`, `submission-created`, `intake-cleanup`. |
| `netlify/tsconfig.json` (new) | Typecheck the wrappers; referenced from root `tsconfig.json`. |
| `netlify.toml` (modify) | `[functions]`, `GITHUB_REPOSITORY`, PostHog vars, comment rewrite. |
| `.github/workflows/intake.yml` (modify) | `repository_dispatch` job. |
| `site/src/pages/contribute/index.astro`, `site/src/pages/contribute/thanks/index.astro` (new) | Form and thank-you page. |
| `site/src/scripts/contribute-upload.ts` (+ test) | Browser upload client and client-side checks. |
| `tools/src/config.ts`, `tools/src/coverage.ts`, `site/src/pages/su/[slug].astro`, `site/src/pages/admin/coverage.astro`, `CONTRIBUTING.md` (modify) | Links lead with the web form. |
| `.github/workflows/deploy.yml` (delete), `site/astro.config.mjs`, `README.md` (modify) | Retire Pages. |

---

### Task 1: Share the field rules; parameterize the size cap

**Files:**
- Create: `tools/src/intake/rules.ts`, `tools/src/intake/rules.test.ts`, `tools/src/web-intake/limits.ts`
- Modify: `tools/src/intake/submission.ts:82-…` (move `isIsoDate`, entity/FY/method/source/note/date/type checks), `tools/src/intake/security.ts:17-160`
- Test: `tools/src/intake/security.test.ts`, existing `tools/src/intake/submission.test.ts` (must pass unchanged)

**Interfaces:**
- Produces:
  - `limits.ts`: `MAX_WEB_BYTES`, `CHUNK_BYTES`, `PENDING_CAP_BYTES`, `ABANDONED_AFTER_MS` (48 h), `RETAIN_MS` (14 d), `SIGNATURE_WINDOW_MS` (5 min), `STORE_NAME = 'intake-uploads'`, `FORM_NAME = 'budget-intake'`, `DISPATCH_TYPE = 'web-intake'`.
  - `rules.ts`:
    ```ts
    export interface RawFields { entity: string|null; fiscalYear: string|null; sourceUrl: string|null;
      retrievedDate: string|null; retrievalMethod: string|null; documentType: string|null; note: string|null }
    export interface CheckedFields { entity: string; entityDir: string; fiscalYear: number; sourceUrl: string|null;
      retrievedDate: string; retrievalMethod: string; documentType: string; note: string|null }
    export function isIsoDate(value: string): boolean
    export function checkFields(raw: RawFields, knownSlugs: ReadonlySet<string>):
      { ok: true; fields: CheckedFields } | { ok: false; errors: string[] }
    ```
    Error strings are the existing ones from `buildSubmission`, moved verbatim.
  - `security.ts`: `export const ALLOWED_EXTENSIONS`, `export function extensionOf(filename): string|null`, `contentErrors(filename, bytes, maxBytes = MAX_ATTACHMENT_BYTES)`. When `maxBytes !== MAX_ATTACHMENT_BYTES` the size message is `the file is <x> MB, over the <cap> MB limit.` (no GitHub wording).

- [ ] **Step 1: Write failing tests** in `rules.test.ts`:
  - `checkFields` with all valid fields → `ok: true`, `entityDir` is the slug with `/`→`-`.
  - `note` required: method `email`, `sourceUrl: null`, `note: null` → errors include the existing null-source-needs-note message.
  - fiscal year `2014` and `2101` rejected; `isIsoDate('2026-02-30') === false`.
  - In `security.test.ts`: `contentErrors('a.pdf', Buffer.from('%PDF-' + 'x'.repeat(30 * 1024 * 1024)), MAX_WEB_BYTES)` → `[]`; same bytes with default cap → one error mentioning `25 MB`; 101 MB with `MAX_WEB_BYTES` → error matching `/over the 100 MB limit/`.
- [ ] **Step 2: Run** `npx vitest run tools/src/intake` — Expected: new tests FAIL (module not found).
- [ ] **Step 3: Implement** `rules.ts` and `limits.ts`; make `buildSubmission` call `checkFields` after `parseIssueForm`, keeping its attachment/filename checks; export the security helpers.
- [ ] **Step 4: Run** `npx vitest run tools/src/intake && npm run typecheck` — Expected: all PASS, including the untouched `submission.test.ts`.
- [ ] **Step 5: Commit** — `refactor(intake): share field rules and parameterize the size cap`.

---

### Task 2: Dispatch payload and web submission

**Files:**
- Create: `tools/src/web-intake/payload.ts`, `tools/src/web-intake/payload.test.ts`

**Interfaces:**
- Consumes: `checkFields`, `RawFields` (Task 1).
- Produces:
  ```ts
  export interface WebIntakePayload {           // ≤ 10 top-level keys (GitHub limit)
    submission_id: string; upload_id: string | null; entity: string; fiscal_year: string;
    fields: { document_url: string|null; source_url: string|null; retrieved_date: string|null;
      retrieval_method: string|null; document_type: string|null; note: string|null; name: string|null };
  }
  export function toDispatchPayload(submissionId: string, data: Readonly<Record<string, unknown>>): WebIntakePayload
  export type WebSource = { kind: 'upload'; uploadId: string } | { kind: 'link'; url: string };
  export interface WebSubmission extends CheckedFields { submissionId: string; source: WebSource; name: string|null }
  export function buildWebSubmission(payload: unknown, knownSlugs: ReadonlySet<string>):
    { ok: true; submission: WebSubmission } | { ok: false; errors: string[]; entity: string; fiscalYear: string }
  ```
  `toDispatchPayload` copies only the named keys, trims strings, turns `''` into `null`, and drops everything else (including `email`, `bot-field`, the Turnstile field). `buildWebSubmission` validates shape (any non-string → error, never throws), requires exactly one of `upload_id` / `fields.document_url`, requires `document_url` to start with `https://`, then runs `checkFields`. `entity`/`fiscalYear` on failure are the raw values or `'unknown'`, for the failure-issue title.

- [ ] **Step 1: Write failing tests:**
  - `toDispatchPayload drops email`: input with `email: 'a@b.c'`, `bot-field: 'x'` → `JSON.stringify(result)` does not contain `a@b.c` or `bot-field`; `Object.keys(result).length <= 10`.
  - `both upload and link rejected`, `neither rejected` (error text: `Send either a file or a link, not both.` / `Send a file or a link to the document.`).
  - `http link rejected` (`http://x/y.pdf` → error mentioning `https`).
  - `non-object payload returns errors`: `buildWebSubmission(null, slugs).ok === false`, and `buildWebSubmission({ entity: 5 }, slugs)` does not throw.
  - Valid upload payload → `source.kind === 'upload'`, `name` preserved.
- [ ] **Step 2: Run** `npx vitest run tools/src/web-intake/payload.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `payload.ts`.
- [ ] **Step 4: Run** the test — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(web-intake): dispatch payload and web submission validation`.

---

### Task 3: Safe link fetch

**Files:**
- Create: `tools/src/web-intake/fetch-link.ts`, `tools/src/web-intake/fetch-link.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function isPrivateAddress(ip: string): boolean
  export interface FetchLinkOptions { maxBytes: number; timeoutMs: number;
    lookup?: (host: string) => Promise<{ address: string }[]>;   // default: dns.promises.lookup(host, { all: true })
    fetchImpl?: typeof fetch; maxRedirects?: number }              // default 5
  export interface FetchedLink { bytes: Buffer; finalUrl: string; contentType: string | null }
  export function fetchLink(url: string, opts: FetchLinkOptions): Promise<FetchedLink>   // throws LinkFetchError
  export class LinkFetchError extends Error {}
  ```
  `isPrivateAddress` covers IPv4 `0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.168/16, 224/4, 240/4` and IPv6 `::`, `::1`, `fc00::/7`, `fe80::/10`, and IPv4-mapped `::ffff:a.b.c.d` (checked as IPv4). Every hop: URL must be `https:`, every resolved address must be public, then `fetch(url, { redirect: 'manual', signal })`; 3xx follows `Location` (resolved against the current URL) up to `maxRedirects`. Read the body as a stream and abort once the running total exceeds `maxBytes`. Timeout covers the whole operation (`AbortSignal.timeout(timeoutMs)`). The CLI passes `{ maxBytes: MAX_WEB_BYTES, timeoutMs: 120_000 }`. Known gap, accepted: DNS can change between our lookup and fetch's own (rebinding); note it in a comment.

- [ ] **Step 1: Write failing tests** (inject `lookup` and `fetchImpl`):
  - `isPrivateAddress` true for `127.0.0.1`, `169.254.169.254`, `10.1.2.3`, `172.31.0.1`, `::1`, `fe80::1`, `::ffff:192.168.0.1`; false for `8.8.8.8`, `2606:4700::1111`.
  - `refuses http url`; `refuses host resolving to private address`.
  - `refuses redirect to private address`: first response `302 Location: https://internal.example/` whose lookup returns `10.0.0.5` → `LinkFetchError`.
  - `refuses redirect to http`.
  - `aborts body over cap without content-length`: a `ReadableStream` yielding 1 MB chunks forever, `maxBytes: 3 MB` → rejects with message matching `/over the 3 MB limit/`.
  - Happy path returns bytes, `finalUrl` after one redirect, and `contentType`.
- [ ] **Step 2: Run** `npx vitest run tools/src/web-intake/fetch-link.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `fetch-link.ts` (use `node:net` `isIP` + manual CIDR math; no new dependency).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(web-intake): https-only link fetch with private-address blocking`.

---

### Task 4: Filename, collisions and duplicates

**Files:**
- Create: `tools/src/web-intake/filename.ts`, `tools/src/web-intake/corpus.ts`, and their `.test.ts`

**Interfaces:**
- Consumes: `filenameError`, `extensionOf`, `ALLOWED_EXTENSIONS` (Task 1).
- Produces:
  ```ts
  export function chooseWebFilename(input: { original: string | null; contentType: string | null;
    entityDir: string; fiscalYear: number; documentType: string }):
    { ok: true; filename: string; generated: boolean } | { ok: false; error: string }
  export function findDuplicate(sha256: string, intakeRoot: string): string | null  // repo-relative path of the existing artifact
  export function collisionError(targetPath: string): string | null                 // non-null when the file exists
  ```
  `original` is the uploaded file's name, or for links the URL's last path segment, `decodeURIComponent`d (decode failure → treat as unusable). If `filenameError(original) === null`, use it. Otherwise generate `<entityDir>-fy<year>-<documentType>.<ext>` where `ext` is `extensionOf(original)` if allowed, else from `contentType` (`application/pdf`→`pdf`, the two Excel and two Word types, `application/zip`); no extension → `{ ok: false, error: "Couldn't tell what kind of file this is …" }`. `findDuplicate` walks `intakeRoot` for `provenance.yaml`, parses with `yaml`, and compares each artifact's `sha256`. The caller writes "Filename generated by the web form; the original name was not usable." into the provenance `note` when `generated`.

- [ ] **Step 1: Write failing tests:**
  - `usable original name is kept`: `budget-fy27.pdf` → `{ filename: 'budget-fy27.pdf', generated: false }`.
  - `unusable original name falls back to generated name`: `../../evil.pdf` and `Budget FY27 (final).pdf` → `{ filename: 'su-x-fy2027-budget_book.pdf', generated: true }` (entityDir `su-x`, FY 2027, `budget_book`).
  - `no name, content type gives extension`: `original: null, contentType: 'application/pdf'` → `.pdf`.
  - `no name, unknown type fails`.
  - `findDuplicate` over a temp dir with `intake/a/fy2026/provenance.yaml` holding sha `abc…` → returns `intake/a/fy2026/<file>`; unknown sha → `null`.
  - `collisionError` non-null for an existing temp file, `null` otherwise.
- [ ] **Step 2: Run** `npx vitest run tools/src/web-intake` — Expected: new tests FAIL.
- [ ] **Step 3: Implement** both modules.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(web-intake): filename choice and duplicate/collision checks`.

---

### Task 5: Provenance mapping and request signing

**Files:**
- Create: `tools/src/web-intake/provenance-map.ts`, `tools/src/web-intake/signing.ts`, and their `.test.ts`

**Interfaces:**
- Consumes: `WebSubmission` (Task 2), `Submission` (`tools/src/intake/submission.ts`).
- Produces:
  ```ts
  export type Obtained = { kind: 'upload' } | { kind: 'link'; finalUrl: string; fetchedDate: string };
  export function toSubmission(ws: WebSubmission, filename: string, generatedName: boolean, how: Obtained): Submission
  export function signRequest(secret: string, method: string, path: string, timestampMs: number): string
  export function verifyRequest(secret: string, method: string, path: string,
    timestampHeader: string | null, signatureHeader: string | null, nowMs: number): boolean
  export const TIMESTAMP_HEADER = 'x-intake-timestamp', SIGNATURE_HEADER = 'x-intake-signature';
  ```
  `toSubmission`: upload → contributor's `sourceUrl`, `retrievedDate`, `retrievalMethod`, `note` as given. Link → `retrievalMethod: 'http-fetch'`, `retrievedDate: how.fetchedDate`, `sourceUrl: how.finalUrl`, and `note` = `Sent through the web form. Contributor said: method <m>, date <d>, source <s or "none">.` followed by their note if any. `retrievedBy` per Global Constraints. `attachmentUrl` = the link URL or `netlify-blobs:<uploadId>` (not written to provenance). Generated-name sentence appended to `note` when `generatedName`. Signing: hex HMAC-SHA256 over `` `${method.toUpperCase()}\n${path}\n${timestampMs}` ``; verify uses `timingSafeEqual` on equal-length buffers and the `SIGNATURE_WINDOW_MS` window; malformed or missing headers → `false`.

- [ ] **Step 1: Write failing tests:**
  - `upload keeps contributor fields`; `link records http-fetch with fetch date and final url` and the note contains the contributor's original method and date.
  - `retrievedBy` is `web form: Pat Smith` / `web form (anonymous)` for `name: null`.
  - `buildProvenance(toSubmission(...), facts, null)` passes `validate`'s provenance schema (use the same validator the existing `provenance.test.ts` uses).
  - Signing: round-trip true; altered path, method, or secret → false; timestamp 5 min + 1 ms old or in the future → false; signature `'zz'` → false (no throw).
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run tools/src/web-intake` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(web-intake): provenance mapping and HMAC request signing`.

---

### Task 6: Upload state machine and the upload/download functions

**Files:**
- Create: `tools/src/web-intake/uploads.ts`, `tools/src/web-intake/uploads.test.ts`, `tools/src/web-intake/turnstile.ts` (+ test), `netlify/functions/intake-upload-start.mts`, `intake-upload-chunk.mts`, `intake-upload-done.mts`, `intake-download.mts`, `netlify/tsconfig.json`
- Modify: `package.json` (add `@netlify/blobs`, `@netlify/functions` to `dependencies`), `tsconfig.json` (reference `./netlify`), `netlify.toml` (`[functions] directory = "netlify/functions"`, `node_bundler = "esbuild"`)

**Interfaces:**
- Consumes: limits (Task 1), `extensionOf`/`ALLOWED_EXTENSIONS` (Task 1), `verifyRequest` (Task 5).
- Produces:
  ```ts
  export interface BlobStore {   // the subset of @netlify/blobs Store we use; tests pass an in-memory Map version
    get(key: string, o: { type: 'arrayBuffer' }): Promise<ArrayBuffer | null>;
    getJSON(key: string): Promise<unknown>;                 // implement via get(key, { type: 'json' })
    getMetadata(key: string): Promise<{ metadata: Record<string, unknown> } | null>;
    set(key: string, data: ArrayBuffer | Uint8Array, o?: { metadata?: Record<string, unknown> }): Promise<void>;
    setJSON(key: string, data: unknown): Promise<void>;
    delete(key: string): Promise<void>;
    list(o: { prefix: string }): Promise<{ blobs: { key: string }[] }>;
  }
  export interface UploadMeta { id: string; filename: string; bytes: number; chunkCount: number;
    browserSha256: string | null; chunkSha256: string[]; createdAt: number; submittedAt: number | null;
    state: 'open' | 'uploaded' | 'submitted'; tokenHash: string | null }
  export type Outcome<T> = { ok: true; value: T } | { ok: false; status: 400 | 403 | 404 | 409 | 413 | 507; error: string };
  export function startUpload(s: BlobStore, req: { filename: string; bytes: number; sha256?: string }, now: number):
    Promise<Outcome<{ id: string; token: string; chunkBytes: number; chunkCount: number }>>
  export function putChunk(s: BlobStore, id: string, n: number, token: string, body: Uint8Array): Promise<Outcome<null>>
  export function finishUpload(s: BlobStore, id: string, token: string): Promise<Outcome<null>>
  export function markSubmitted(s: BlobStore, id: string, now: number): Promise<Outcome<null>>
  export function readMeta(s: BlobStore, id: string): Promise<UploadMeta | null>
  export function deleteUpload(s: BlobStore, id: string): Promise<void>      // chunks + meta, and subtracts from pending-bytes
  export function cleanup(s: BlobStore, now: number): Promise<{ deleted: string[]; pendingBytes: number }>
  export function verifyTurnstile(token: string | null, secret: string, remoteIp: string | null,
    fetchImpl?: typeof fetch): Promise<boolean>
  ```
  State rules: `start` writes meta with `state: 'open'` and `tokenHash = sha256(token)`, adds `bytes` to `pending-bytes` (refuse 507 `Uploads are full right now; please paste a link instead or try again tomorrow.` if it would exceed `PENDING_CAP_BYTES`). `putChunk` requires state `open`, matching token hash (`timingSafeEqual`), `0 ≤ n < chunkCount`, body length `CHUNK_BYTES` (or the remainder for the last chunk); stores chunk with `metadata: { sha256 }`; re-sending the same `n` overwrites (idempotent). `finishUpload` requires all chunks present with correct lengths, fills `chunkSha256` from chunk metadata, sets `state: 'uploaded'`, `tokenHash: null`. `markSubmitted` requires `uploaded`. `cleanup` deletes `uploaded`/`open` older than 48 h and anything older than 14 d, then rewrites `pending-bytes` as the sum of remaining metas. The pending counter's read-modify-write can race under concurrent starts; nightly recompute corrects it (comment this).

  Function wrappers (each: parse request → call the pure function → JSON response; `getStore({ name: STORE_NAME, consistency: 'strong' })`; `export const config = { path: … , method: … }`):
  - `intake-upload-start`: body `{ filename, bytes, sha256, turnstileToken }`; verify Turnstile (`TURNSTILE_SECRET_KEY`, IP from `context.ip`) first, 403 on failure.
  - `intake-upload-chunk`: `Authorization: Bearer <token>`, raw body via `await req.arrayBuffer()`.
  - `intake-upload-done`: `Authorization: Bearer <token>`.
  - `intake-download`: paths `/api/intake-download/:id/meta`, `/api/intake-download/:id/:n` (GET) and `/api/intake-download/:id` (DELETE); `verifyRequest(INTAKE_DOWNLOAD_SECRET, req.method, url.pathname, …)` else 403. Chunk GET streams the blob bytes with `content-type: application/octet-stream`. Meta GET omits `tokenHash`.
  Turnstile: POST `application/x-www-form-urlencoded` `secret`, `response`, `remoteip` to `https://challenges.cloudflare.com/turnstile/v0/siteverify`; true only if JSON `success === true`; network error → false.

  **Verify before relying on it** (Netlify docs, at implementation time): the `config.path` URL-pattern syntax for `:id/:n` and per-method routing; `context.params` vs. parsing `new URL(req.url).pathname`; `getMetadata` return shape in the installed `@netlify/blobs` version; whether esbuild bundling resolves `../../tools/src/…​.ts` imports (it should; if not, set `included_files` or move the wrapper imports). Record any difference in the wrapper's header comment.

- [ ] **Step 1: Write failing tests** in `uploads.test.ts` with an in-memory `BlobStore`:
  - `start rejects disallowed extension` (`x.exe` → 400) and `over 100 MB` (413).
  - `start refuses when pending cap would be exceeded` (seed `pending-bytes` at `PENDING_CAP_BYTES - 10`, request 11 bytes → 507).
  - `id and token are at least 128 bits` (hex length ≥ 32 or base64url ≥ 22) and differ across calls.
  - `chunk with wrong token is refused` (403); `chunk index out of range` (400); `wrong chunk length` (400).
  - `chunk after done is refused`: start, put all chunks, finish, then `putChunk` with the original token → `ok: false`, and the stored chunk bytes are unchanged.
  - `done with a missing chunk fails` (409); `done records chunk hashes` equal to sha256 of each chunk.
  - `markSubmitted twice fails the second time`.
  - `cleanup deletes 49 h old uploaded, keeps 47 h old uploaded, deletes 15 d old submitted, keeps 13 d old submitted`, and `pendingBytes` equals the sum of the kept uploads.
  - `turnstile.test.ts`: `success: true` → true; `success: false` → false; fetch throws → false; `null` token → false without calling fetch.
- [ ] **Step 2: Run** `npx vitest run tools/src/web-intake/uploads.test.ts tools/src/web-intake/turnstile.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `uploads.ts` and `turnstile.ts`.
- [ ] **Step 4: Run** the tests — Expected: PASS.
- [ ] **Step 5: Add dependencies and wrappers:** `npm install @netlify/blobs @netlify/functions`; write the four `.mts` wrappers, `netlify/tsconfig.json` (modelled on `site/tsconfig.json`: extends base, `composite`, `emitDeclarationOnly`, `lib` `ES2023`+`DOM`, include `functions/**/*.mts`, reference `../tools`), root reference, and `netlify.toml` `[functions]`.
- [ ] **Step 6: Run** `npm run typecheck && npx netlify build --offline` (or `npx netlify functions:build` if `build` needs a linked site) — Expected: typecheck clean; four functions bundled.
- [ ] **Step 7: Commit** — `feat(web-intake): chunked upload to Netlify Blobs with signed download`.

---

### Task 7: Form-submitted event function

**Files:**
- Create: `tools/src/web-intake/github-app.ts` (+ test), `tools/src/web-intake/on-submission.ts` (+ test), `netlify/functions/submission-created.mts`

**Interfaces:**
- Consumes: `toDispatchPayload` (Task 2), `markSubmitted`, `verifyTurnstile`, `BlobStore` (Task 6), `FORM_NAME`, `DISPATCH_TYPE`.
- Produces:
  ```ts
  export function appJwt(appId: string, privateKeyPem: string, nowSec: number): string  // RS256; iat now-60, exp now+540, iss appId
  export function installationToken(repo: string, jwt: string, fetchImpl?: typeof fetch): Promise<string>
    // GET /repos/{repo}/installation → id; POST /app/installations/{id}/access_tokens → token
  export function sendDispatch(repo: string, token: string, payload: WebIntakePayload, fetchImpl?: typeof fetch): Promise<void>
    // POST /repos/{repo}/dispatches { event_type: 'web-intake', client_payload }; throws on non-2xx
  export interface SubmissionEvent { formName: string; submissionId: string; data: Record<string, unknown>; remoteIp: string | null }
  export function handleSubmission(ev: SubmissionEvent, deps: { store: BlobStore; turnstileOk: (t: string|null, ip: string|null) => Promise<boolean>;
    dispatch: (p: WebIntakePayload) => Promise<void>; now: number }): Promise<'ignored' | 'captcha-failed' | 'dispatched'>
  ```
  `handleSubmission`: form other than `budget-intake` → `'ignored'`. Turnstile token read from `data['cf-turnstile-response']`; invalid → `'captcha-failed'` (log the submission id only; no dispatch). If `upload_id` is set, call `markSubmitted`; its failure is logged and does **not** stop the dispatch (the job reports it). Then `dispatch(toDispatchPayload(...))`; errors propagate so the function fails visibly.

  The wrapper uses the legacy event handler form (`export const handler = async (event) => …`), parses `JSON.parse(event.body).payload` → `{ form_name, id, data }`, reads `INTAKE_APP_ID`, `INTAKE_APP_PRIVATE_KEY` (newline-escaped `\n` → real newlines), `GITHUB_REPOSITORY`. **Verify before relying on it:** the current `submission-created` payload field names and where the client IP appears (`payload.data.ip` or similar) in Netlify's docs.

- [ ] **Step 1: Write failing tests:**
  - `appJwt` decodes to header `{ alg: 'RS256', typ: 'JWT' }`, payload `iss` = app id, `exp - iat === 600`, and verifies with the matching public key (generate a key pair in the test with `generateKeyPairSync`).
  - `installationToken` / `sendDispatch` hit the right URLs with `Authorization: Bearer`, `Accept: application/vnd.github+json`; `sendDispatch` throws on a 422.
  - `handleSubmission`: `other form ignored`; `captcha failure does not dispatch`; `stale upload still dispatches`; `dispatched payload has no email` (data includes `email`).
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** both modules and the wrapper.
- [ ] **Step 4: Run** `npx vitest run tools/src/web-intake && npm run typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(web-intake): verify captcha and dispatch verified form submissions`.

---

### Task 8: Nightly cleanup function

**Files:**
- Create: `netlify/functions/intake-cleanup.mts`

**Interfaces:**
- Consumes: `cleanup` (Task 6, already tested).

- [ ] **Step 1: Implement** the wrapper with `export const config = { schedule: '@daily' }`; it calls `cleanup(store, Date.now())` and logs counts only (no filenames).
- [ ] **Step 2: Run** `npm run typecheck` — Expected: clean.
- [ ] **Step 3: Commit** — `feat(web-intake): nightly cleanup of stale uploads`.

---

### Task 9: Web mode in the intake job

**Files:**
- Create: `tools/src/web-intake/download-client.ts` (+ test), `tools/src/web-intake/run-web.ts` (+ test)
- Modify: `tools/src/cli/intake.ts` (branch on `INTAKE_MODE`), `.github/workflows/intake.yml`

**Interfaces:**
- Consumes: Tasks 1–5 (`buildWebSubmission`, `fetchLink`, `chooseWebFilename`, `findDuplicate`, `collisionError`, `toSubmission`, `signRequest`, `contentErrors`, `mediaTypeFor`), existing `buildProvenance`, `serializeProvenance`, `readRegistry`, `PATHS`.
- Produces:
  ```ts
  export function downloadUpload(origin: string, secret: string, id: string, fetchImpl?: typeof fetch):
    Promise<{ filename: string; bytes: Buffer }>   // throws DownloadError with a user-readable reason
  export function deleteRemoteUpload(origin: string, secret: string, id: string, fetchImpl?: typeof fetch): Promise<void>
  export interface WebRunDeps { knownSlugs: ReadonlySet<string>; repoRoot: string; today: string;
    download: (id: string) => Promise<{ filename: string; bytes: Buffer }>;
    fetchLink: (url: string) => Promise<FetchedLink>;
    writeArtifact: (relDir: string, filename: string, bytes: Buffer, provenanceYaml: string) => void;
    openPr: (branch: string, title: string, bodyFile: string) => Promise<string>;      // returns PR URL
    openFailureIssue: (title: string, bodyFile: string) => Promise<void>;
    cleanupUpload: (id: string) => Promise<void> }
  export function runWebIntake(payload: unknown, deps: WebRunDeps): Promise<{ ok: true; pr: string } | { ok: false; reasons: string[] }>
  ```
  `downloadUpload` fetches `meta`, then each chunk; checks each chunk's sha256 against `meta.chunkSha256[n]`, total length against `meta.bytes`, and (when present) the assembled sha256 against `meta.browserSha256`; refuses if `meta.state !== 'submitted'`. Signed headers from `signRequest(secret, method, path, Date.now())`.
  `runWebIntake` order: `buildWebSubmission` → get bytes (download or `fetchLink`) → `chooseWebFilename` → `contentErrors(filename, bytes, MAX_WEB_BYTES)` → `collisionError(intake/<entityDir>/fy<year>/<filename>)` → `findDuplicate(sha256)` (error names the existing path) → `toSubmission` + `buildProvenance` (merging any existing `provenance.yaml` in that directory) → `writeArtifact` → `openPr` → `cleanupUpload` (failure here is logged, not a reason). Any reason anywhere → `openFailureIssue` and `{ ok: false }`; the upload is kept for the 14-day backstop. PR body: `Sent through the web form on the site. Netlify submission id: <id>.` plus the fields table; failure-issue body: entity, FY, submission id, bullet list of reasons, and `Re-send it through the GitHub issue form once fixed.` Bodies are written to files and passed with `--body-file`.

  `tools/src/cli/intake.ts`: when `process.env.INTAKE_MODE === 'web'`, read `WEB_INTAKE_PAYLOAD` (JSON), `INTAKE_SITE_ORIGIN`, `INTAKE_DOWNLOAD_SECRET`, `GITHUB_REPOSITORY`, and wire `runWebIntake` to the existing `git`/`gh` helpers: branch `intake/web-<submission_id>` from fresh `origin/main`, commit as `github-actions[bot]` **without** a co-author line, force-push, `gh pr create` (skip if one is open). Failure issue via `gh issue create --label web-intake-failed --title … --body-file …`.

  `intake.yml`: add `repository_dispatch: types: [web-intake]` to `on:`; guard the existing job with `if: github.event_name == 'issues' && (…existing…)`; add job `web-intake` with `concurrency: web-intake-${{ github.event.client_payload.submission_id }}`, same token-mint / checkout (`lfs: false`) / `git lfs install` / setup-node 22 / `npm ci` steps, then `npm run intake` with `env: INTAKE_MODE: web`, `WEB_INTAKE_PAYLOAD: ${{ toJSON(github.event.client_payload) }}`, `INTAKE_SITE_ORIGIN: ${{ vars.INTAKE_SITE_ORIGIN }}`, `INTAKE_DOWNLOAD_SECRET: ${{ secrets.INTAKE_DOWNLOAD_SECRET }}`, `GH_TOKEN` from the App token. Create the `web-intake-failed` label in a step (`gh label create … || true`).

- [ ] **Step 1: Write failing tests:**
  - `download-client.test.ts`: `reassembles chunks and verifies hashes`; `chunk hash mismatch throws`; `refuses meta not in submitted state`; requests carry `x-intake-timestamp` and a signature that `verifyRequest` accepts.
  - `run-web.test.ts` (all deps faked, temp `repoRoot`):
    - `upload happy path writes artifact and provenance, opens PR, cleans up` — provenance has `retrieved_by: 'web form: Pat'`, PR title `Budget intake: <entity> FY<year>`, branch `intake/web-<id>`.
    - `link path records http-fetch`.
    - `missing upload meta becomes a failure issue`: `download` throws `DownloadError('upload not found')` → `openFailureIssue` called once with title `Web intake failed: <entity> FY<year>` and body containing the submission id; `openPr` not called.
    - `duplicate sha256 is rejected naming the existing path`; `filename collision is rejected`.
    - `web mode passes hostile note text through as data`: note `` "$(rm -rf /)`\n--- `` appears byte-for-byte in the provenance YAML (parsed back) and in the PR body file.
    - `failure issue never contains email`: payload carrying an extra `email` key → body file has no `@`-address from it.
- [ ] **Step 2: Run** `npx vitest run tools/src/web-intake` — Expected: FAIL.
- [ ] **Step 3: Implement** `download-client.ts`, `run-web.ts`, the CLI branch and the workflow job.
- [ ] **Step 4: Run** `npm test && npm run typecheck` — Expected: PASS. Lint the workflow with `npx --yes action-validator .github/workflows/intake.yml` if available, otherwise check it parses: `node -e "require('yaml').parse(require('fs').readFileSync('.github/workflows/intake.yml','utf8'))"`.
- [ ] **Step 5: Commit** — `feat(intake): web mode driven by repository_dispatch`.

---

### Task 10: The `/contribute/` page and upload client

**Files:**
- Create: `site/src/scripts/contribute-upload.ts`, `site/src/scripts/contribute-upload.test.ts`, `site/src/pages/contribute/index.astro`, `site/src/pages/contribute/thanks/index.astro`
- Modify: `netlify.toml` (`PUBLIC_TURNSTILE_SITE_KEY` comes from the Netlify UI; document it in the header comment)

**Interfaces:**
- Consumes: `RETRIEVAL_METHODS`, `DOCUMENT_TYPES` (submission.ts), coverage.json `entities` + `fiscalYears`, `CHUNK_BYTES`, `MAX_WEB_BYTES`, `ALLOWED_EXTENSIONS`.
- Produces (pure, tested):
  ```ts
  export interface FormState { hasUpload: boolean; uploading: boolean; documentUrl: string; sourceUrl: string;
    retrievedDate: string; retrievalMethod: string; note: string; fileName: string | null; fileBytes: number | null }
  export function clientErrors(s: FormState): string[]   // mirrors buildWebSubmission + checkFields, plain-language
  export function chunkRanges(bytes: number, chunkBytes: number): Array<[start: number, end: number]>
  export function uploadFile(file: Blob, turnstileToken: string, opts: { fetchImpl?: typeof fetch;
    onProgress?: (fraction: number) => void; retries?: number }): Promise<string>   // resolves to upload id
  ```
  `uploadFile`: sha256 via `crypto.subtle.digest` (whole file; fine at ≤ 100 MB), `POST start`, sequential `PUT` per chunk with up to 3 retries each, `POST done`. Error messages from the server are shown as-is.

  Page: form `name="budget-intake" method="POST" data-netlify="true" netlify-honeypot="bot-field" action="/contribute/thanks/"`, hidden `form-name`. Fields and labels per spec §1 table; `retrieval_method`/`document_type` options have plain-language labels and the schema enum as `value`. `entity` options = coverage `entities` (name as label, slug as value), preselected from `?entity=`; `fiscal_year` options = coverage `fiscalYears`, preselected from `?fiscal_year=`. The file `<input>` has no `name` (so it is never posted). Turnstile widget (`https://challenges.cloudflare.com/turnstile/v0/api.js`) renders on load; the first token goes to `start`, then `turnstile.reset()` produces the token posted with the form. Submit disabled while uploading or while `clientErrors` is non-empty. `<noscript>` block: "This form needs JavaScript. You can also send the document through GitHub:" + `intakeIssueUrl`. Thank-you page: what happens next (reviewed, appears once merged, may be contacted if an email was given). Plain language; no jargon (no "PR", "LFS", "provenance").

- [ ] **Step 1: Write failing tests** in `contribute-upload.test.ts`:
  - `clientErrors` flags both/neither file and link, `http://` link, email method without note, bad date, `.exe`, 101 MB file.
  - `chunkRanges(9 * MB, 4 * MB)` → `[[0,4MB],[4MB,8MB],[8MB,9MB]]`; `chunkRanges(0, …)` → `[]` (and `clientErrors` rejects an empty file).
  - `uploadFile` with a fake fetch: calls start, then 3 PUTs in order, then done; retries a PUT that fails once; rejects with the server's message after 3 failures; `onProgress` ends at `1`.
- [ ] **Step 2: Run** `npx vitest run site/src/scripts/contribute-upload.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the script, then the two pages.
- [ ] **Step 4: Run** `npm test && npm run build` — Expected: PASS; `site/dist/contribute/index.html` contains `data-netlify="true"` and every `RETRIEVAL_METHODS` value.
- [ ] **Step 5: Check the page** with the preview server (`.claude/launch.json` entry for `npm run dev`): `/contribute/?entity=<slug>&fiscal_year=2027` preselects both; phone width has no horizontal scroll; screenshot.
- [ ] **Step 6: Commit** — `feat(site): contribute page with chunked upload and Turnstile`.

---

### Task 11: Links lead with the web form

**Files:**
- Modify: `tools/src/config.ts`, `tools/src/coverage.ts`, `site/src/pages/su/[slug].astro:~325`, `site/src/pages/admin/coverage.astro:89`, `netlify.toml`, `CONTRIBUTING.md`
- Test: `tools/src/config.test.ts` / `tools/src/coverage.test.ts` (whichever exists; create `config.test.ts` if neither covers link builders)

**Interfaces:**
- Produces: `export function intakeFormUrl(entity: string, fiscalYear: number): string` → `` `/contribute/?entity=${encodeURIComponent(entity)}&fiscal_year=${fiscalYear}` `` (site-relative, never null). `CoverageCell` gains `formUrl: string | null` (null exactly when the cell is normalized, like `intakeUrl`).

- [ ] **Step 1: Write failing tests:** `intakeFormUrl('su/x', 2027) === '/contribute/?entity=su%2Fx&fiscal_year=2027'`; a non-normalized coverage cell has `formUrl` set; a normalized one has `formUrl: null`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement**; SU page copy: "Have this document? [Send it to us](formUrl) — no account needed. (Or use the [GitHub form](intakeUrl).)"; admin coverage link order `normalizeUrl ?? formUrl ?? flagUrl`. Add `GITHUB_REPOSITORY = "jamesjnadeau/vt-education-budget-review"` to `netlify.toml [build.environment]`. `CONTRIBUTING.md`: web form section first, issue form second.
- [ ] **Step 4: Run** `npm test && npm run build` — Expected: PASS; a built SU page contains `/contribute/?entity=`.
- [ ] **Step 5: Commit** — `feat(site): coverage and SU pages link to the web form`.

---

### Task 12: Retire GitHub Pages

**Files:**
- Delete: `.github/workflows/deploy.yml`
- Modify: `site/astro.config.mjs:7-17` (drop `SITE_BASE`), `netlify.toml` (header comment; remove the SITE_BASE note; add `PUBLIC_POSTHOG_ENABLED = "1"` to production — token/host set as Netlify UI env vars `PUBLIC_POSTHOG_PROJECT_TOKEN`, `PUBLIC_POSTHOG_HOST`), `README.md:220`, any doc that names the Pages deploy (`grep -rn "deploy.yml\|GitHub Pages" --include=*.md . | grep -v docs/superpowers`)

- [ ] **Step 1: Make the changes.** Keep PLAN.md's history as-is (it is a historical plan); update only README and CONTRIBUTING-level docs that describe the current setup.
- [ ] **Step 2: Run** `npm run build` — Expected: PASS; `grep -rn "SITE_BASE" site/ netlify.toml` returns nothing.
- [ ] **Step 3: Commit** — `chore: retire the GitHub Pages deploy; Netlify is the only host`.

---

### Task 13: End-to-end check on a deploy preview

Not code; the maintainer must do the setup steps (they need account access).

- [ ] **Step 1: Maintainer setup** (list these in the PR description as a checklist): Turnstile site in Cloudflare → `PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` in Netlify; generate `INTAKE_DOWNLOAD_SECRET` (`openssl rand -hex 32`) into both Netlify and GitHub Actions secrets; `INTAKE_APP_ID`, `INTAKE_APP_PRIVATE_KEY` into Netlify; Actions variable `INTAKE_SITE_ORIGIN`; turn on form email notifications for `budget-intake`; turn off GitHub Pages in repo settings; PostHog vars in Netlify.
- [ ] **Step 2: On the deploy preview**, submit (a) a PDF over 8 MB as an upload and (b) a link to a public PDF. Note: the preview's functions write to the same Blobs store and dispatch to the same repo, and the Actions job downloads from `INTAKE_SITE_ORIGIN` — for the preview test set that variable to the preview URL, then set it back.
- [ ] **Step 3: Confirm** two PRs on `intake/web-<id>` branches with LFS artifacts and valid `provenance.yaml` (`validate.yml` green), and that the upload's blobs are gone (`netlify blobs:list intake-uploads`).
- [ ] **Step 4: Confirm the failure path:** submit a link to an `http://` page or a `.txt` renamed `.pdf` → a `web-intake-failed` issue with no email in it.
- [ ] **Step 5:** Close the test PRs without merging; delete their branches.
