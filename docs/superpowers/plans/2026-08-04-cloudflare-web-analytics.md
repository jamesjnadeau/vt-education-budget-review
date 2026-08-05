# Cloudflare Web Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit the Cloudflare Web Analytics beacon on every page, but *only* on the released production GitHub Pages build — never in local dev, local builds, or previews.

**Architecture:** A pure, unit-tested helper (`site/src/lib/analytics.ts`) decides whether to emit the beacon based on a single build-time environment flag, `PUBLIC_CF_ANALYTICS`. The shared `Base.astro` layout (used by all 325 pages) reads that decision from `import.meta.env` and conditionally renders the `<script is:inline>` beacon in `<head>`. The flag is set to `'1'` only in the `Deploy` workflow's build step, which runs solely on merge to `main` — so production-and-released is the only place the flag is present, and every other build omits the beacon.

**Tech Stack:** Astro 7 (static output), Vitest 4 (node environment), TypeScript, GitHub Actions (GitHub Pages deploy).

## Global Constraints

- **Node:** `>=22` (repo `engines`). Do not introduce syntax or deps requiring newer.
- **The exact beacon token is `da8000ca451b4497b086e6a9c38b2f41`** — copy verbatim. This token is public by design (it ships in the HTML to every visitor); it is not a secret and needs no GitHub secret.
- **The beacon must NOT appear** in: `astro dev` (`npm run dev`), a local `npm run build:site`, or any build where `PUBLIC_CF_ANALYTICS` is unset. It appears **only** when `PUBLIC_CF_ANALYTICS === '1'`.
- **Astro env exposure:** only `PUBLIC_`-prefixed vars are surfaced on `import.meta.env` in Astro/Vite. The flag name is therefore `PUBLIC_CF_ANALYTICS` (the `PUBLIC_` prefix is load-bearing, not cosmetic).
- **Test idiom:** match `site/src/lib/explanations.test.ts` — `import { describe, it, expect } from 'vitest';`, import the module under test with an explicit `.ts` extension.
- **Test discovery:** `vitest.config.ts` already includes `site/**/*.test.ts`. No config change needed for new tests.
- **Do not** add the beacon to any individual page — `Base.astro` is the single layout every page wraps, so the one insertion covers all 325 pages.

---

## File Structure

- `site/src/lib/analytics.ts` — **new.** Owns the token constant and the pure gate function `cfBeaconToken(env)`. No Astro or DOM imports; plain logic so it is unit-testable and covered by the existing `site/tsconfig.json` (`include: ["src/**/*.ts"]`).
- `site/src/lib/analytics.test.ts` — **new.** Vitest unit tests for `cfBeaconToken`.
- `site/src/layouts/Base.astro` — **modify.** Import the helper, compute the token from `import.meta.env` in the frontmatter, and conditionally render the beacon `<script>` in `<head>`.
- `.github/workflows/deploy.yml` — **modify.** Add `PUBLIC_CF_ANALYTICS: '1'` to the existing `Build` step's `env:` block (the step that already sets `SITE_URL`/`SITE_BASE`).
- `README.md` — **modify.** Add a short note documenting the analytics (cookieless, production-only, how it is gated).

---

### Task 1: Analytics gate helper (pure, unit-tested)

**Files:**
- Create: `site/src/lib/analytics.ts`
- Test: `site/src/lib/analytics.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `CF_BEACON_TOKEN: string` — the constant `'da8000ca451b4497b086e6a9c38b2f41'`.
  - `cfBeaconToken(env: Record<string, string | undefined>): string | null` — returns `CF_BEACON_TOKEN` when `env.PUBLIC_CF_ANALYTICS === '1'`, otherwise `null`. Task 2 calls this with `import.meta.env`.

- [ ] **Step 1: Write the failing test**

Create `site/src/lib/analytics.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { cfBeaconToken, CF_BEACON_TOKEN } from './analytics.ts';

describe('cfBeaconToken', () => {
  it('returns the beacon token when PUBLIC_CF_ANALYTICS is exactly "1"', () => {
    expect(cfBeaconToken({ PUBLIC_CF_ANALYTICS: '1' })).toBe(CF_BEACON_TOKEN);
  });

  it('returns null when the flag is unset', () => {
    expect(cfBeaconToken({})).toBeNull();
  });

  it('returns null when the flag is undefined', () => {
    expect(cfBeaconToken({ PUBLIC_CF_ANALYTICS: undefined })).toBeNull();
  });

  it('returns null for the string "0"', () => {
    expect(cfBeaconToken({ PUBLIC_CF_ANALYTICS: '0' })).toBeNull();
  });

  it('returns null for the empty string', () => {
    expect(cfBeaconToken({ PUBLIC_CF_ANALYTICS: '' })).toBeNull();
  });

  it('returns null for a truthy-but-not-"1" value like "true"', () => {
    expect(cfBeaconToken({ PUBLIC_CF_ANALYTICS: 'true' })).toBeNull();
  });

  it('exposes the exact public token', () => {
    expect(CF_BEACON_TOKEN).toBe('da8000ca451b4497b086e6a9c38b2f41');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run site/src/lib/analytics.test.ts`
Expected: FAIL — cannot resolve `./analytics.ts` (module does not exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `site/src/lib/analytics.ts`:

```ts
// Cloudflare Web Analytics beacon token. Public by design -- it ships in the
// HTML to every visitor and identifies the site's analytics property, not a
// credential. Kept here rather than in env because only the on/off decision
// needs to vary between builds.
export const CF_BEACON_TOKEN = 'da8000ca451b4497b086e6a9c38b2f41';

// The beacon is emitted only when the build explicitly opts in via
// PUBLIC_CF_ANALYTICS === '1'. That flag is set exclusively by the Deploy
// workflow (merge to main -> GitHub Pages), so local dev, local builds and
// previews never phone home. Returns the token to emit, or null to omit the
// beacon entirely.
export function cfBeaconToken(env: Record<string, string | undefined>): string | null {
  return env.PUBLIC_CF_ANALYTICS === '1' ? CF_BEACON_TOKEN : null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run site/src/lib/analytics.test.ts`
Expected: PASS — 7 passing.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS — `analytics.ts` is under `site/src/**/*.ts` and must compile cleanly.

- [ ] **Step 6: Commit**

```bash
git add site/src/lib/analytics.ts site/src/lib/analytics.test.ts
git commit -m "feat(site): production-only gate for the Cloudflare analytics beacon"
```

---

### Task 2: Render the beacon in the shared layout

**Files:**
- Modify: `site/src/layouts/Base.astro:1-44` (frontmatter import + `<head>` insertion)

**Interfaces:**
- Consumes: `cfBeaconToken(env)` and `CF_BEACON_TOKEN` from Task 1 (`site/src/lib/analytics.ts`).
- Produces: every page's `<head>` conditionally contains the beacon `<script is:inline>`. No new exports.

- [ ] **Step 1: Import the helper in the frontmatter**

In `site/src/layouts/Base.astro`, add the import next to the existing style import at the top of the frontmatter (line 2). After editing, the top of the frontmatter reads:

```astro
---
import '../styles/global.css';
import { cfBeaconToken } from '../lib/analytics.ts';
```

- [ ] **Step 2: Compute the token in the frontmatter**

In the same frontmatter block, immediately after the existing `const base = ...` line (currently line 11), add:

```astro
const beaconToken = cfBeaconToken(import.meta.env);
```

- [ ] **Step 3: Render the beacon conditionally in `<head>`**

Insert the beacon as the last child of `<head>`, immediately before the closing `</head>` (currently line 44, just after the `feedHref` `<link>` block). `is:inline` is required so Astro leaves the external module script untouched and passes the `data-cf-beacon` attribute through verbatim; `JSON.stringify` produces the exact JSON Cloudflare expects:

```astro
    {beaconToken && (
      <script
        is:inline
        type="module"
        src="https://static.cloudflareinsights.com/beacon.min.js"
        data-cf-beacon={JSON.stringify({ token: beaconToken })}
      />
    )}
  </head>
```

- [ ] **Step 4: Verify the beacon is ABSENT in a normal (no-flag) build**

Run:

```bash
npm run build:data && npm run build:site
grep -rl "cloudflareinsights" site/dist || echo "ABSENT (correct)"
```

Expected: prints `ABSENT (correct)` — no dist file references the beacon when the flag is unset. This is the core "not in dev/local builds" guarantee.

- [ ] **Step 5: Verify the beacon is PRESENT when the flag is set**

Run:

```bash
PUBLIC_CF_ANALYTICS=1 npm run build:site
grep -c "da8000ca451b4497b086e6a9c38b2f41" site/dist/index.html
grep -o 'data-cf-beacon=[^>]*' site/dist/index.html | head -1
```

Expected: the count is `1` on `index.html`, and the printed attribute is `data-cf-beacon='{"token":"da8000ca451b4497b086e6a9c38b2f41"}'` (Astro emits `is:inline` script attributes with single quotes; the JSON has no internal spaces, which Cloudflare parses correctly).

- [ ] **Step 6: Restore a clean (no-flag) dist to avoid committing a beacon build**

Run:

```bash
npm run build:site
grep -rl "cloudflareinsights" site/dist || echo "clean dist restored"
```

Expected: `clean dist restored`. (`site/dist` is a build artifact; this just avoids leaving a beacon-containing dist in the working tree.)

- [ ] **Step 7: Commit**

```bash
git add site/src/layouts/Base.astro
git commit -m "feat(site): emit Cloudflare analytics beacon on production builds only"
```

---

### Task 3: Enable the flag in the production deploy + document it

**Files:**
- Modify: `.github/workflows/deploy.yml:65-69` (the `Build` step's `env:` block)
- Modify: `README.md` (add an analytics note)

**Interfaces:**
- Consumes: the `PUBLIC_CF_ANALYTICS` contract from Task 1 and the render from Task 2.
- Produces: the released GitHub Pages build sets the flag; the README documents the behavior.

- [ ] **Step 1: Set the flag in the Deploy workflow's build step**

In `.github/workflows/deploy.yml`, add `PUBLIC_CF_ANALYTICS` to the existing `Build` step `env:` block so it reads:

```yaml
      - name: Build
        env:
          SITE_URL: ${{ steps.pages.outputs.origin }}
          SITE_BASE: ${{ steps.pages.outputs.base_path }}
          # Cloudflare Web Analytics is emitted only when this is '1'. It is set
          # here alone -- the merge-to-main Pages deploy -- so local dev, local
          # builds and PR previews never load the beacon.
          PUBLIC_CF_ANALYTICS: '1'
        run: npm run build:data && npm run build:site
```

- [ ] **Step 2: Confirm no other workflow builds the site with this flag**

Run:

```bash
grep -rn "PUBLIC_CF_ANALYTICS" .github/workflows
```

Expected: exactly one hit — `deploy.yml`. If any other workflow (e.g. a preview build) prints, that workflow would also load the beacon; it must not be added there.

- [ ] **Step 3: Document the analytics in the README**

In `README.md`, add the following section immediately before the `## Licence` section (currently line 188). Wording matches the project's privacy-forward, no-login framing:

```markdown
## Web analytics

The published site loads [Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/),
which is cookieless and collects no personal data — consistent with the site's "no server, no
database, no login" design. The beacon is emitted **only** by the production GitHub Pages deploy:
`site/src/lib/analytics.ts` renders it solely when the build sets `PUBLIC_CF_ANALYTICS=1`, and that
flag is set exclusively in the merge-to-main `Deploy` workflow. Local development (`npm run dev`),
local builds, and PR previews never load it.

```

- [ ] **Step 4: Verify the README renders the intended note**

Run:

```bash
grep -n "Web analytics" README.md && grep -n "PUBLIC_CF_ANALYTICS" README.md
```

Expected: the heading and the flag name both appear in `README.md`.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy.yml README.md
git commit -m "chore(deploy): enable Cloudflare analytics on production; document it"
```

---

## Self-Review

**1. Spec coverage**
- "Add Cloudflare analytics to the site" → Tasks 1 (gate) + 2 (render in `Base.astro`, covering all 325 pages).
- "Only run on the production site when it's released" → Task 1's flag gate + Task 3 setting `PUBLIC_CF_ANALYTICS=1` only in `deploy.yml` (push-to-`main` = release). Task 2 Steps 4–5 prove absent-without-flag and present-with-flag; Task 3 Step 2 proves no other workflow enables it.
- "Note that it exists in the README" (clarified: add a note) → Task 3 Step 3.
- Exact snippet/token preserved → Global Constraints + Task 1 constant + Task 2 Step 5 verification of the emitted attribute.

**2. Placeholder scan** — No TBD/TODO/"add appropriate…" placeholders. Every code and config step shows literal content.

**3. Type consistency** — `cfBeaconToken(env: Record<string, string | undefined>): string | null` and `CF_BEACON_TOKEN: string` are defined in Task 1 and consumed with those exact names/signatures in Task 2 (`cfBeaconToken(import.meta.env)`) and referenced in Task 3. The flag string `PUBLIC_CF_ANALYTICS` and the token `da8000ca451b4497b086e6a9c38b2f41` are identical across all tasks. Import path `../lib/analytics.ts` matches the `Base.astro` → `src/lib` relative location and the repo's explicit-`.ts`-extension idiom.

**Note on the "production-only" mechanism:** the gate is an explicit env flag rather than Astro's `import.meta.env.PROD`. `PROD` is true for *any* `astro build`, including a developer's local build — which would leak the beacon. A dedicated flag set only in the deploy workflow makes "released to production" the precise and only trigger.
