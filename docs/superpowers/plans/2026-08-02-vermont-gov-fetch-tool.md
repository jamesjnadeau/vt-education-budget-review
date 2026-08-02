# Vermont.gov Fetch Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node CLI that fetches web pages and documents from `*.vermont.gov` domains into a folder (default `/tmp`), so agents stop reaching for a browser to read Vermont state sources.

**Architecture:** A small pure-logic module (`tools/src/fetch/vermont.ts`) holds the host allowlist, the HTML→text stripper, the saved-filename derivation, and an orchestrator that fetches bytes and writes them. It reuses the existing `statuteAgent()` from `tools/src/statute/fetch.ts` so `legislature.vermont.gov`'s incomplete TLS chain is repaired automatically for every vermont.gov host. A thin CLI (`tools/src/cli/vt-fetch.ts`) parses args, enforces the allowlist, and prints where each file landed with its sha256. AGENT.md is updated to direct agents to this tool and to record that we now go around `education.vermont.gov`'s 403 with a browser-like user agent.

**Tech Stack:** TypeScript (Node native type-stripping via `tsx`), `node:https`/`node:http`, `node:crypto`, vitest. No new dependencies.

## Global Constraints

- Node `>=22`; ESM only (`"type": "module"`). Source imports carry explicit `.ts` extensions (`import { x } from '../foo.ts'`).
- Strict TypeScript: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` (use `import type` for type-only imports), `isolatedModules`.
- Tests are colocated `*.test.ts`, run by vitest (`npm test` → `vitest run`); test glob is `tools/**/*.test.ts`.
- Every new module opens with a doc comment explaining *why* it exists, matching the house style in `tools/src/statute/fetch.ts` and `tools/src/intake/security.ts`.
- Domain scope is `vermont.gov` and any `*.vermont.gov` subdomain — nothing else may be fetched.
- User agent is exactly `Mozilla/5.0 (compatible; VT Budget bot)` — browser-like so `education.vermont.gov` serves us, and self-identifying.
- Default output directory is the literal `/tmp` (the user asked for `/tmp`, not `os.tmpdir()`).
- Never weaken TLS verification (`rejectUnauthorized` stays true; no `NODE_TLS_REJECT_UNAUTHORIZED=0`). The AIA repair in `statuteAgent()` is the only sanctioned handling.
- No provenance sidecar files — fetch the bytes, print the sha256 to stdout.

---

## File Structure

- **Create** `tools/src/fetch/vermont.ts` — all fetch logic: `isVermontGovUrl`, `isHtmlResponse`, `htmlToText`, `savedFileName`, the private `fetchRaw`, and the `fetchToFolder` orchestrator plus its `FetchResult` type. Single responsibility: "get one vermont.gov URL onto disk."
- **Create** `tools/src/fetch/vermont.test.ts` — unit tests for the pure functions and one localhost-server integration test for `fetchToFolder`.
- **Create** `tools/src/cli/vt-fetch.ts` — argument parsing, allowlist gate, per-URL reporting, exit code. Mirrors the shape of other `tools/src/cli/*.ts` entry points.
- **Modify** `package.json` (repo root) — add the `vt:fetch` script alongside the other `tsx tools/src/cli/*.ts` scripts.
- **Modify** `AGENT.md` — rewrite the `education.vermont.gov` section and add a "Fetching from vermont.gov" directive section.

The pure functions carry all the real logic and are fully unit-tested. `fetchToFolder` deliberately does **not** enforce the vermont.gov allowlist — that gate lives in the CLI — so the orchestrator can be integration-tested against a `127.0.0.1` server without tripping the allowlist or hitting the network.

---

### Task 1: Host allowlist and HTML→text helpers

**Files:**
- Create: `tools/src/fetch/vermont.ts`
- Test: `tools/src/fetch/vermont.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `isVermontGovUrl(url: string): boolean`
  - `isHtmlResponse(contentType: string | null | undefined): boolean`
  - `htmlToText(html: string): string`

- [ ] **Step 1: Write the failing tests**

Create `tools/src/fetch/vermont.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { htmlToText, isHtmlResponse, isVermontGovUrl } from './vermont.ts';

describe('isVermontGovUrl', () => {
  it('accepts vermont.gov and its subdomains over http or https', () => {
    expect(isVermontGovUrl('https://legislature.vermont.gov/statutes/section/16/135/04001')).toBe(true);
    expect(isVermontGovUrl('https://education.vermont.gov/documents/budget.pdf')).toBe(true);
    expect(isVermontGovUrl('http://vermont.gov')).toBe(true);
    expect(isVermontGovUrl('https://VERMONT.GOV/thing')).toBe(true);
  });

  it('rejects lookalike and unrelated hosts', () => {
    expect(isVermontGovUrl('https://vermont.gov.evil.com/x')).toBe(false);
    expect(isVermontGovUrl('https://notvermont.gov/x')).toBe(false);
    expect(isVermontGovUrl('https://example.com/x')).toBe(false);
  });

  it('rejects non-web schemes and unparseable input', () => {
    expect(isVermontGovUrl('ftp://legislature.vermont.gov/x')).toBe(false);
    expect(isVermontGovUrl('file:///etc/passwd')).toBe(false);
    expect(isVermontGovUrl('not a url')).toBe(false);
  });
});

describe('isHtmlResponse', () => {
  it('is true only for an html content type', () => {
    expect(isHtmlResponse('text/html; charset=utf-8')).toBe(true);
    expect(isHtmlResponse('TEXT/HTML')).toBe(true);
    expect(isHtmlResponse('application/pdf')).toBe(false);
    expect(isHtmlResponse(null)).toBe(false);
    expect(isHtmlResponse(undefined)).toBe(false);
  });
});

describe('htmlToText', () => {
  it('strips tags, decodes entities, and collapses whitespace to lines', () => {
    const html = '<h1>Title</h1><p>One &amp; two.</p><style>.x{}</style><p>Three&nbsp;§4.</p>';
    expect(htmlToText(html)).toBe('Title\nOne & two.\nThree §4.');
  });

  it('drops script contents entirely', () => {
    expect(htmlToText('<p>keep</p><script>var x = 1 < 2;</script>')).toBe('keep');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tools/src/fetch/vermont.test.ts`
Expected: FAIL — cannot resolve `./vermont.ts`.

- [ ] **Step 3: Write the module with the three pure functions**

Create `tools/src/fetch/vermont.ts`:

```ts
/**
 * Fetching one vermont.gov page or document onto disk.
 *
 * Agents kept reaching for a browser to read Vermont state sources -- statute
 * text, AOE guidance, budget PDFs -- which is slow, unciteable, and, for the
 * TLS-misconfigured Legislature site, actually harder than doing it right. This
 * module does it right once: it repairs that certificate chain (by reusing the
 * statute fetcher's agent), speaks a browser-like user agent so
 * education.vermont.gov serves us, and drops the bytes in a folder. See
 * AGENT.md, "Fetching from vermont.gov".
 *
 * The vermont.gov allowlist is enforced by the CLI, not here, so this module's
 * mechanics can be tested against a localhost server.
 */

/** True for `vermont.gov` or any `*.vermont.gov` host over http/https. */
export function isVermontGovUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  const host = parsed.hostname.toLowerCase();
  return host === 'vermont.gov' || host.endsWith('.vermont.gov');
}

/** Whether a response's Content-Type is HTML (so we save extracted text). */
export function isHtmlResponse(contentType: string | null | undefined): boolean {
  return typeof contentType === 'string' && contentType.toLowerCase().includes('text/html');
}

/**
 * Strips an HTML page down to readable text: drops scripts and styles, turns
 * block-closing tags into line breaks, removes remaining tags, decodes the
 * entities Vermont sites actually emit, and trims each line. General-purpose --
 * unlike `statuteText`, it does not clip to a statute body.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&sect;/g, '§')
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#8211;|&ndash;/g, '-')
    .replace(/&#8212;|&mdash;/g, '—')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tools/src/fetch/vermont.test.ts`
Expected: PASS (all three describe blocks).

- [ ] **Step 5: Commit**

```bash
git add tools/src/fetch/vermont.ts tools/src/fetch/vermont.test.ts
git commit -m "feat(fetch): vermont.gov host allowlist and html-to-text helpers"
```

---

### Task 2: Saved-filename derivation

**Files:**
- Modify: `tools/src/fetch/vermont.ts`
- Test: `tools/src/fetch/vermont.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `savedFileName(finalUrl: string, isHtml: boolean): string` — the basename (no directory) to write under the output folder. HTML pages become a `host_path.txt` slug; documents keep their released basename, sanitized.

- [ ] **Step 1: Write the failing tests**

Append to `tools/src/fetch/vermont.test.ts`:

```ts
import { savedFileName } from './vermont.ts';

describe('savedFileName', () => {
  it('keeps a document basename and sanitizes it', () => {
    expect(savedFileName('https://education.vermont.gov/sites/aoe/files/FY24%20Budget.pdf', false)).toBe(
      'FY24_Budget.pdf',
    );
    expect(savedFileName('https://education.vermont.gov/a/b/report.xlsx', false)).toBe('report.xlsx');
  });

  it('never lets a document name climb out of the folder', () => {
    const name = savedFileName('https://x.vermont.gov/a/..', false);
    expect(name.includes('/')).toBe(false);
    expect(name.startsWith('.')).toBe(false);
    expect(name).not.toBe('..');
  });

  it('slugs an html page to a .txt name from host and path', () => {
    expect(savedFileName('https://legislature.vermont.gov/statutes/section/16/135/04001', true)).toBe(
      'legislature.vermont.gov_statutes_section_16_135_04001.txt',
    );
  });

  it('names an html root page by host', () => {
    expect(savedFileName('https://education.vermont.gov/', true)).toBe('education.vermont.gov_index.txt');
  });

  it('falls back to a host-based name when a document path has no basename', () => {
    expect(savedFileName('https://data.vermont.gov/', false)).toBe('data.vermont.gov.bin');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tools/src/fetch/vermont.test.ts -t savedFileName`
Expected: FAIL — `savedFileName` is not exported.

- [ ] **Step 3: Implement `savedFileName`**

Add to `tools/src/fetch/vermont.ts` (below `htmlToText`):

```ts
/**
 * Replaces every character that is not a safe filename character with `_`, then
 * strips leading dots so the result can never be `.`, `..`, or a hidden file.
 * Collapses runs of `_` so a messy path does not become a wall of underscores.
 */
function sanitizeSegment(raw: string): string {
  const cleaned = raw
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '');
  return cleaned;
}

/**
 * The basename to write under the output folder. A document keeps the name the
 * site released it under (sanitized); an HTML page becomes a `host_path.txt`
 * slug so two pages from the same site do not collide. Never returns a name
 * containing a path separator or starting with a dot.
 */
export function savedFileName(finalUrl: string, isHtml: boolean): string {
  const parsed = new URL(finalUrl);
  const host = parsed.hostname.toLowerCase();
  const pathname = decodeURIComponent(parsed.pathname);

  if (isHtml) {
    const slug = sanitizeSegment(`${host}${pathname}`.replace(/\/+$/, ''));
    const base = slug === sanitizeSegment(host) || slug === '' ? `${host}_index` : slug;
    return `${sanitizeSegment(base)}.txt`;
  }

  const lastSegment = pathname.split('/').filter(Boolean).pop() ?? '';
  const name = sanitizeSegment(lastSegment);
  if (!name || !name.includes('.')) {
    return name ? `${name}.bin` : `${sanitizeSegment(host)}.bin`;
  }
  return name;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tools/src/fetch/vermont.test.ts -t savedFileName`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/src/fetch/vermont.ts tools/src/fetch/vermont.test.ts
git commit -m "feat(fetch): derive safe saved filenames for pages and documents"
```

---

### Task 3: Network fetch and `fetchToFolder` orchestrator

**Files:**
- Modify: `tools/src/fetch/vermont.ts`
- Test: `tools/src/fetch/vermont.test.ts`

**Interfaces:**
- Consumes: `isHtmlResponse`, `htmlToText`, `savedFileName` (Task 1–2); `statuteAgent` from `../statute/fetch.ts`.
- Produces:
  - `interface FetchResult { readonly requestedUrl: string; readonly finalUrl: string; readonly status: number; readonly contentType: string | null; readonly savedPath: string; readonly sha256: string; readonly bytes: number; readonly kind: 'text' | 'raw'; }`
  - `fetchToFolder(url: string, outDir: string): Promise<FetchResult>` — fetches, follows redirects, writes the file, returns the record. Throws on HTTP status >= 400. Does **not** check the vermont.gov allowlist.

- [ ] **Step 1: Write the failing integration test**

Append to `tools/src/fetch/vermont.test.ts`:

```ts
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll } from 'vitest';

import { fetchToFolder } from './vermont.ts';

describe('fetchToFolder (integration, localhost)', () => {
  const PDF_BYTES = Buffer.from('%PDF-1.7\nhello vermont\n');
  let baseUrl = '';
  const server = createServer((req, res) => {
    if (req.url === '/page') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<h1>Budget</h1><p>Line one.</p>');
    } else if (req.url === '/files/report.pdf') {
      res.writeHead(200, { 'content-type': 'application/pdf' });
      res.end(PDF_BYTES);
    } else if (req.url === '/missing') {
      res.writeHead(404, { 'content-type': 'text/html' });
      res.end('nope');
    } else {
      res.writeHead(500);
      res.end();
    }
  });

  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('saves an html page as extracted .txt with a matching sha256', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vtfetch-'));
    const result = await fetchToFolder(`${baseUrl}/page`, dir);
    expect(result.kind).toBe('text');
    expect(result.status).toBe(200);
    const onDisk = readFileSync(result.savedPath, 'utf8');
    expect(onDisk).toBe('Budget\nLine one.');
    expect(result.sha256).toBe(createHash('sha256').update(onDisk).digest('hex'));
  });

  it('saves a document as raw bytes, unchanged', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vtfetch-'));
    const result = await fetchToFolder(`${baseUrl}/files/report.pdf`, dir);
    expect(result.kind).toBe('raw');
    expect(result.savedPath.endsWith('report.pdf')).toBe(true);
    expect(readFileSync(result.savedPath).equals(PDF_BYTES)).toBe(true);
  });

  it('throws on an http error status without writing a file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vtfetch-'));
    await expect(fetchToFolder(`${baseUrl}/missing`, dir)).rejects.toThrow(/404/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tools/src/fetch/vermont.test.ts -t fetchToFolder`
Expected: FAIL — `fetchToFolder` is not exported.

- [ ] **Step 3: Implement the network layer and orchestrator**

Add the imports at the top of `tools/src/fetch/vermont.ts` (below the doc comment):

```ts
import { createHash } from 'node:crypto';
import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { statuteAgent } from '../statute/fetch.ts';
```

Add at the bottom of `tools/src/fetch/vermont.ts`:

```ts
/** Browser-like so education.vermont.gov serves us; self-identifying. */
const USER_AGENT = 'Mozilla/5.0 (compatible; VT Budget bot)';

interface RawResponse {
  readonly finalUrl: string;
  readonly status: number;
  readonly contentType: string | null;
  readonly body: Buffer;
}

/**
 * GETs a URL, following up to five redirects. HTTPS requests go through the
 * statute agent, which supplies the intermediate certificate legislature.
 * vermont.gov omits; other vermont.gov hosts serve a complete chain and are
 * unaffected. Verification stays full -- see tools/src/statute/fetch.ts.
 */
async function fetchRaw(url: string, redirectsLeft = 5): Promise<RawResponse> {
  const isHttps = url.startsWith('https:');
  const agent = isHttps ? await statuteAgent() : undefined;
  const getter = isHttps ? httpsGet : httpGet;
  return new Promise<RawResponse>((resolve, reject) => {
    const options = agent
      ? { agent, headers: { 'user-agent': USER_AGENT } }
      : { headers: { 'user-agent': USER_AGENT } };
    getter(url, options, (res) => {
      const status = res.statusCode ?? 0;
      const location = res.headers.location;
      if (status >= 300 && status < 400 && location && redirectsLeft > 0) {
        res.resume();
        resolve(fetchRaw(new URL(location, url).toString(), redirectsLeft - 1));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () =>
        resolve({
          finalUrl: url,
          status,
          contentType: (res.headers['content-type'] as string | undefined) ?? null,
          body: Buffer.concat(chunks),
        }),
      );
    }).on('error', reject);
  });
}

export interface FetchResult {
  readonly requestedUrl: string;
  readonly finalUrl: string;
  readonly status: number;
  readonly contentType: string | null;
  readonly savedPath: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly kind: 'text' | 'raw';
}

/**
 * Fetches one URL into `outDir` and returns what landed. An HTML response is
 * saved as extracted text (`.txt`); anything else is saved as raw bytes under
 * its released name. The sha256 is of the bytes actually written, so it matches
 * the file on disk. Throws on any status >= 400 rather than saving an error
 * page. Does not enforce the vermont.gov allowlist -- the CLL does that.
 */
export async function fetchToFolder(url: string, outDir: string): Promise<FetchResult> {
  const res = await fetchRaw(url);
  if (res.status >= 400) {
    throw new Error(
      `HTTP ${res.status} fetching ${res.finalUrl}. Nothing was saved. If this is ` +
        `education.vermont.gov still refusing an automated client, fetch it by hand.`,
    );
  }

  const html = isHtmlResponse(res.contentType);
  const bytes = html ? Buffer.from(htmlToText(res.body.toString('utf8')), 'utf8') : res.body;

  mkdirSync(outDir, { recursive: true });
  const savedPath = join(outDir, savedFileName(res.finalUrl, html));
  writeFileSync(savedPath, bytes);

  return {
    requestedUrl: url,
    finalUrl: res.finalUrl,
    status: res.status,
    contentType: res.contentType,
    savedPath,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
    kind: html ? 'text' : 'raw',
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tools/src/fetch/vermont.test.ts`
Expected: PASS (all describe blocks, including the localhost integration cases).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors (watch for `verbatimModuleSyntax` — `AddressInfo` in the test is already `import type`).

- [ ] **Step 6: Commit**

```bash
git add tools/src/fetch/vermont.ts tools/src/fetch/vermont.test.ts
git commit -m "feat(fetch): fetchToFolder orchestrator over the statute TLS agent"
```

---

### Task 4: CLI entry point and npm script

**Files:**
- Create: `tools/src/cli/vt-fetch.ts`
- Modify: `package.json` (repo root)

**Interfaces:**
- Consumes: `isVermontGovUrl`, `fetchToFolder`, `FetchResult` from `../fetch/vermont.ts`.
- Produces: the `vt:fetch` npm script. No exported symbols (it is an entry point).

- [ ] **Step 1: Write the CLI**

Create `tools/src/cli/vt-fetch.ts`:

```ts
#!/usr/bin/env node
/**
 * Fetch pages and documents from vermont.gov into a folder.
 *
 *   npm run vt:fetch -- <url> [<url> ...] [--out <dir>]
 *
 * Default output folder is /tmp. HTML pages are saved as extracted text;
 * PDFs and other documents are saved as raw bytes. Only vermont.gov hosts are
 * allowed -- any other URL is refused before a request is made. See AGENT.md.
 */

import { fetchToFolder, isVermontGovUrl } from '../fetch/vermont.ts';

interface Args {
  readonly urls: string[];
  readonly outDir: string;
}

function parseArgs(argv: string[]): Args {
  const urls: string[] = [];
  let outDir = '/tmp';
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out' || arg === '-o') {
      const next = argv[i + 1];
      if (!next) throw new Error('--out needs a directory');
      outDir = next;
      i += 1;
    } else if (arg !== undefined) {
      urls.push(arg);
    }
  }
  return { urls, outDir };
}

const USAGE = 'usage: npm run vt:fetch -- <url> [<url> ...] [--out <dir>]';

async function main(): Promise<number> {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`${(error as Error).message}\n${USAGE}`);
    return 1;
  }

  if (args.urls.length === 0) {
    console.error(USAGE);
    return 1;
  }

  let failed = false;
  for (const url of args.urls) {
    if (!isVermontGovUrl(url)) {
      console.error(`refused: ${url} is not a vermont.gov URL`);
      failed = true;
      continue;
    }
    try {
      const r = await fetchToFolder(url, args.outDir);
      console.log(r.savedPath);
      console.log(`  ${r.status} ${r.kind} ${r.bytes}B sha256:${r.sha256}`);
    } catch (error) {
      console.error(`error: ${url}: ${(error as Error).message}`);
      failed = true;
    }
  }
  return failed ? 1 : 0;
}

process.exit(await main());
```

- [ ] **Step 2: Add the npm script**

In the repo-root `package.json`, add to `"scripts"` (next to `"statute:sync"`):

```json
    "vt:fetch": "tsx tools/src/cli/vt-fetch.ts",
```

- [ ] **Step 3: Verify the allowlist gate refuses a non-vermont.gov URL**

Run: `npm run vt:fetch -- https://example.com/x`
Expected: prints `refused: https://example.com/x is not a vermont.gov URL` and exits non-zero (no network request made). Confirm exit code:

Run: `npm run vt:fetch -- https://example.com/x; echo "exit=$?"`
Expected: ends with `exit=1`.

- [ ] **Step 4: Verify a real fetch against a live vermont.gov page**

Run: `npm run vt:fetch -- https://legislature.vermont.gov/statutes/section/16/133/04001`
Expected: prints a path under `/tmp` ending `.txt`, then a line with `200 text <n>B sha256:<hex>`. This exercises the AIA cert repair end to end (it fails loudly if `statuteAgent()` cannot fetch the intermediate — network-dependent; skip if offline). (Section 16 V.S.A. § 4001 lives under chapter 133, not 135.)

Confirm the file has statute text:

Run: `head -5 /tmp/legislature.vermont.gov_statutes_section_16_133_04001.txt`
Expected: readable statute text, not HTML tags.

- [ ] **Step 5: Commit**

```bash
git add tools/src/cli/vt-fetch.ts package.json
git commit -m "feat(cli): vt:fetch command for vermont.gov pages and documents"
```

---

### Task 5: Update AGENT.md

**Files:**
- Modify: `AGENT.md`

**Interfaces:**
- Consumes: nothing (documentation).
- Produces: nothing (documentation).

- [ ] **Step 1: Rewrite the education.vermont.gov section**

In `AGENT.md`, replace the body of the section titled **"education.vermont.gov blocks automated clients"** with the following (keep the heading):

```markdown
## education.vermont.gov blocks automated clients

`education.vermont.gov` returns **HTTP 403** to a plain, honestly-identified script,
even for pages that are public in a browser. We used to fetch these by hand.

We now go around the block so this documentation can be captured by automated means:
the fetch tool (`npm run vt:fetch`) sends a browser-like user agent that also names us
— `Mozilla/5.0 (compatible; VT Budget bot)` — and the AOE server serves the page. Use
the tool; do not spin up a browser for these pages.

AOE guidance pages are useful for cross-checking a reading, but they are still never the
citation of record — the site's position is independent verification of the state's
figures, which requires reading the same statute the state read. When a number depends
on an AOE page, record it and cite the statute it restates.

The AOE **Public Data API** at `datacollection.education.vermont.gov` is a different
host and works fine unauthenticated. That is what the registry sync uses.
```

- [ ] **Step 2: Add the "Fetching from vermont.gov" directive section**

In `AGENT.md`, add this section immediately **after** the "education.vermont.gov blocks automated clients" section:

```markdown
## Fetching from vermont.gov: use the tool, not a browser

**From now on, get anything from a `*.vermont.gov` domain with `npm run vt:fetch` — not
a browser and not a generic web-fetch tool.**

```bash
npm run vt:fetch -- <url> [<url> ...] [--out <dir>]
```

It saves into `/tmp` by default. HTML pages are saved as extracted text (`.txt`);
PDFs, spreadsheets and other documents are saved as raw bytes under the name the site
released them. It prints each saved path with the HTTP status, byte count and sha256.

Why a dedicated tool instead of a browser or a generic fetcher:

- It repairs `legislature.vermont.gov`'s incomplete TLS chain automatically (it reuses
  `statuteAgent()`), so statute fetches that break every other client just work — with
  **full** verification, nothing bypassed.
- It sends the browser-like `VT Budget bot` user agent, so `education.vermont.gov`
  serves it instead of returning 403.
- It refuses any host that is not `vermont.gov`, so it can never be turned into a
  general fetch proxy.

Implementation: `tools/src/fetch/vermont.ts` and `tools/src/cli/vt-fetch.ts`. If a fetch
fails in a new way (a different host with a broken chain, a new block), fix the tool —
do not fall back to disabling TLS verification or scraping through a browser.
```

- [ ] **Step 3: Verify the edits read correctly**

Run: `grep -n "vt:fetch\|VT Budget bot\|Fetching from vermont.gov" AGENT.md`
Expected: matches in both the education section and the new section.

- [ ] **Step 4: Commit**

```bash
git add AGENT.md
git commit -m "docs: direct agents to vt:fetch for vermont.gov, note the 403 workaround"
```

---

### Task 6: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: PASS, including the new `tools/src/fetch/vermont.test.ts`.

- [ ] **Step 2: Typecheck the workspace**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: End-to-end smoke of a document fetch (network-dependent)**

Run: `npm run vt:fetch -- https://legislature.vermont.gov/statutes/section/16/133/04001 --out /tmp/vt-smoke`
Expected: a `.txt` file appears in `/tmp/vt-smoke` with statute text; stdout shows `200 text`. Skip if offline.

- [ ] **Step 4: Confirm nothing else changed**

Run: `git status`
Expected: only the files this plan created/modified are staged/committed; no stray edits.

---

## Self-Review

**1. Spec coverage:**
- "tool that uses node to fetch web-pages and documents from vermont.gov" → Tasks 1–4 (`fetchToFolder`, CLI, allowlist).
- "to a specified folder, default to the /tmp directory" → Task 4 `--out`, default `/tmp`.
- "Add a note to AGENT.md to use this tool ... from now on and not via a browser" → Task 5, both sections.
- Web pages as extracted text, documents as raw bytes → Task 3 (`isHtmlResponse` branch).
- Spoof browser UA as "VT Budget bot" + AGENT.md rewrite → Task 3 `USER_AGENT`, Task 5 Step 1.
- Print sha256, no sidecar → Task 3 `FetchResult.sha256`, Task 4 stdout.

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step is complete.

**3. Type consistency:** `fetchToFolder(url, outDir)` and `FetchResult` field names (`savedPath`, `sha256`, `bytes`, `kind`) are identical across Task 3's definition, its test, and the CLI in Task 4. `isVermontGovUrl`, `isHtmlResponse`, `htmlToText`, `savedFileName` signatures match their tests. `statuteAgent` is imported from `../statute/fetch.ts` where it is already exported.
