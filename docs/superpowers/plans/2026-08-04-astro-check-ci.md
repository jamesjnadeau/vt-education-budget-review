# Wire `astro check` into CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `.astro` frontmatter type errors fail CI, closing the gap that let the groupings bug ship.

**Architecture:** `.astro` files are never seen by `tsc --build` (the site's `tsconfig.json` includes only `src/**/*.ts`), so frontmatter type errors go uncaught. Astro ships `astro check` for exactly this — it runs Volar over the `.astro` files — but Volar's `@volar/kit` does `require("typescript")` and uses the classic compiler JS API (`ts.sys`, `createLanguageService`, `ScriptSnapshot`). The repo pins `typescript@^7.0.2`, the **native TS7 preview**, which exposes none of that API (`ts.sys === false`), so `astro check` crashes at `@volar/kit/createChecker.js:44` with `Cannot read properties of undefined (reading 'useCaseSensitiveFileNames')`. The fix has three parts: (1) pin the classic TypeScript line (`6.0.3`) so Volar and `tsc --build` share one compiler with the API Volar needs; (2) give `astro check` a dedicated tsconfig that actually **includes** `.astro`; (3) fix the two real frontmatter errors this surfaces, then add the check as a CI step after `build:data`.

**Tech Stack:** npm workspaces, Astro 7, `@astrojs/check` 0.9.10 (Volar 2.4.28 under the hood), classic TypeScript 6.0.3, GitHub Actions.

## Global Constraints

- **TypeScript pin:** root `devDependencies.typescript` = **`6.0.3`** (exact). This is the classic-API line. **Do not bump to any `7.x`** — that is the native preview and it removes the JS API Volar depends on, re-breaking `astro check`. Verified: `tsc --build --force` passes on `6.0.3` (~3.8 s full rebuild), and `@astrojs/check`'s peer range is `^5.0.0 || ^6.0.0`, which `6.0.3` satisfies.
- **`@astrojs/check` pin:** `0.9.10` (exact), declared on the `site` workspace.
- **Node:** 22 (unchanged, already the repo/CI floor).
- **CI ordering:** the astro-check step MUST run **after** `npm run build:data`. The `.astro` pages import JSON from `site/src/generated/` (e.g. `groupings.json`, `parameters.json`), which is **gitignored** and produced by `build:data`. Without it the check fails on missing-module errors, not type errors.
- **No second TypeScript / no isolation package.** The decision (2026-08-04) is to unify on classic TS6, not to keep native TS7 alongside an isolated checker. One `typescript` at the workspace root serves both `tsc --build` and `astro check`.

---

## File Structure

- `package.json` (root) — flip `typescript` pin `^7.0.2` → `6.0.3`. Sole compiler for the whole workspace.
- `site/package.json` — add `@astrojs/check` devDependency; point the `check` script at the astro tsconfig.
- `site/tsconfig.astro.json` (**new**) — the tsconfig `astro check` uses. Extends `astro/tsconfigs/strict` and, crucially, **includes `.astro`**. Kept separate from `site/tsconfig.json` because that one is a `composite`, emit-producing project consumed by `tsc --build` and must stay `.ts`-only (it excludes `src/pages/**` on purpose — those import `astro:*` virtual modules plain `tsc` can't resolve).
- `site/src/env.d.ts` (**new**) — global `Window` augmentation for the two `__VT_*` globals the model page sets on `window`. This is what turns the surfaced errors green.
- `site/src/scripts/model-tool.ts` — export `RawParameterSet` so `env.d.ts` can name it.
- `.github/workflows/validate.yml` — split the single `Build` step into `Build data` → `Check site types` → `Build site`.

---

### Task 1: Pin the classic TypeScript toolchain (unblock the crash)

Flip the compiler to the classic line and install `@astrojs/check`. After this, `astro check` runs instead of crashing — but with the *default* tsconfig it is still blind to `.astro` (that's Task 2). This task's deliverable: the mismatch is gone and `tsc --build` still passes.

**Files:**
- Modify: `package.json` (root) — `devDependencies.typescript`
- Modify: `site/package.json` — add `devDependencies`
- Modify: `package-lock.json` (via `npm install`)

**Interfaces:**
- Produces: a workspace where `require("typescript")` resolves `6.0.3` (classic API) from every location, including the hoisted `@volar/kit`. Later tasks rely on `npm run check --workspace site` being runnable.

- [ ] **Step 1: Flip the root TypeScript pin**

In `package.json`, change:

```json
    "typescript": "^7.0.2",
```

to:

```json
    "typescript": "6.0.3",
```

- [ ] **Step 2: Add `@astrojs/check` to the site workspace**

In `site/package.json`, add a `devDependencies` block (the file currently has only `dependencies`):

```json
  "devDependencies": {
    "@astrojs/check": "0.9.10"
  }
```

Do **not** add `typescript` here — the root `6.0.3` hoists and satisfies both `@astrojs/check`'s peer (`^5 || ^6`) and Volar's (`*`). Verified: with only the root pin, `@volar/kit` resolves `6.0.3`.

- [ ] **Step 3: Install and update the lockfile**

Run: `npm install`
Expected: completes; `package-lock.json` updated. (An unrelated `npm audit` "1 high severity" notice may print — ignore, it predates this change.)

- [ ] **Step 4: Verify the compiler unified on the classic line**

Run:
```bash
node -e "console.log('root', require('./node_modules/typescript/package.json').version)"
node -e "const d=require('path').dirname(require.resolve('@volar/kit/package.json')); console.log('volar sees', require(require.resolve('typescript/package.json',{paths:[d]})).version)"
```
Expected: both print `6.0.3`.

- [ ] **Step 5: Verify `tsc --build` still passes on classic TS6**

Run: `npm run typecheck`
Expected: PASS, exit 0 (runs `tsc --build --force` across model/tools/site; ~4 s).

- [ ] **Step 6: Verify the crash is gone**

Run: `npm run check --workspace site`
Expected: it **runs to completion** (no `useCaseSensitiveFileNames` TypeError). It reports `0 errors` here — that is expected and wrong-looking: the default `site/tsconfig.json` includes only `.ts`, so no `.astro` file is in the program yet. Task 2 fixes that. The point of this step is only that the toolchain no longer crashes.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json site/package.json
git commit -m "build: pin classic typescript 6.0.3 so astro check / Volar can run

Native typescript@7 exposes none of the classic compiler JS API
(ts.sys, createLanguageService), which @volar/kit requires, so
astro check crashed. Unify the workspace on the classic 6.0.3 line;
tsc --build still passes. Add @astrojs/check to the site workspace."
```

---

### Task 2: Give `astro check` a tsconfig that includes `.astro` (the gate starts biting)

This is the TDD "make it fail" step. The default `site/tsconfig.json` has `include: ["src/**/*.ts"]` — no `.astro` file is ever in the program, which is the deeper reason frontmatter errors slip. Add a dedicated tsconfig that includes `.astro`, point the `check` script at it, and watch two **real** pre-existing errors surface (exit 1). Leaving CI red here is intentional; Task 3 makes it green.

**Files:**
- Create: `site/tsconfig.astro.json`
- Modify: `site/package.json` — the `check` script

**Interfaces:**
- Consumes: `@astrojs/check` runnable (Task 1).
- Produces: `npm run check --workspace site` typechecks `.astro` frontmatter. Task 4 wires this exact command into CI.

- [ ] **Step 1: Write the astro-check tsconfig**

Create `site/tsconfig.astro.json`:

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "src/**/*", "astro.config.mjs"],
  "exclude": ["dist"]
}
```

`astro/tsconfigs/strict` resolves from `site/node_modules/astro`. It sets `moduleResolution: "Bundler"`, `noEmit`, `allowJs`, and — the part that matters — `include` covering `.astro`. This is a **standalone diagnostic config**; it is not referenced by `tsconfig.json` and does not participate in `tsc --build`.

- [ ] **Step 2: Point the `check` script at it**

In `site/package.json`, change:

```json
    "check": "astro check"
```

to:

```json
    "check": "astro check --tsconfig ./tsconfig.astro.json"
```

- [ ] **Step 3: Run the check — expect it to FAIL with real errors**

Run:
```bash
npm run build:data          # generate site/src/generated/*.json (pages import it)
npm run check --workspace site
```
Expected: **FAIL, exit 1**, `2 errors`, both in `src/pages/model/index.astro`:
```
src/pages/model/index.astro:315 - error ts(2339): Property '__VT_RESOLVED_ADM__' does not exist on type 'Window & typeof globalThis'.
src/pages/model/index.astro:315 - error ts(2339): Property '__VT_PARAMETERS__' does not exist on type 'Window & typeof globalThis'.
```
These are genuine — the processed `<script>` reads `window.__VT_PARAMETERS__` / `window.__VT_RESOLVED_ADM__` with no global declaration. (There will also be ~10 hints and an `astro(4000)` `is:inline` warning; the default `--minimumFailingSeverity error` means only the 2 errors fail the run.)

- [ ] **Step 4: Prove the gate catches `.astro` frontmatter errors (throwaway check)**

Add a deliberate frontmatter error to confirm the gate bites where the old one was blind, then remove it:

```bash
# inject into a page frontmatter
perl -0pi -e "s/(^---\n)/\$1const _gateProof: number = 'nope';\n/m" 'site/src/pages/groupings/index.astro'
npm run check --workspace site   # expect an extra ts(2322) error on _gateProof
git checkout -- 'site/src/pages/groupings/index.astro'   # revert the probe
```
Expected: the run reports a `ts(2322)` error for `_gateProof` (a `.astro` frontmatter error — exactly the class that shipped in the groupings bug), then the revert restores the file. Do **not** commit the probe.

- [ ] **Step 5: Commit (CI intentionally red until Task 3)**

```bash
git add site/tsconfig.astro.json site/package.json
git commit -m "feat(site): typecheck .astro frontmatter via a dedicated astro-check tsconfig

The composite tsconfig.json is .ts-only by design, so .astro frontmatter
was never typechecked -- how the groupings bug shipped. Add
tsconfig.astro.json (extends astro/tsconfigs/strict, includes .astro)
and run astro check against it. Surfaces 2 real Window-global errors,
fixed next."
```

---

### Task 3: Fix the two real frontmatter errors (gate goes green)

The model page sets two globals on `window` in an inline (untypechecked) script and reads them in a processed (typechecked) script. Add a global `Window` augmentation typed to `initModelTool`'s signature.

**Files:**
- Create: `site/src/env.d.ts`
- Modify: `site/src/scripts/model-tool.ts` — export `RawParameterSet`

**Interfaces:**
- Consumes: `initModelTool(liveParameters: RawParameterSet[], resolvedAdmData: ResolvedAdmData)` at `site/src/scripts/model-tool.ts:583`. `ResolvedAdmData` is exported (line 68); `RawParameterSet` (line 78) is not yet.
- Produces: `npm run check --workspace site` exits 0.

- [ ] **Step 1: Export `RawParameterSet`**

In `site/src/scripts/model-tool.ts`, change line 78 from:

```ts
interface RawParameterSet {
```

to:

```ts
export interface RawParameterSet {
```

- [ ] **Step 2: Write the global augmentation**

Create `site/src/env.d.ts`:

```ts
/// <reference types="astro/client" />

// The model page hands data to its client script through two globals set on
// `window` in an `is:inline` script (JSON.parse'd there) and read in the
// processed module script. Declaring them here is what lets astro check
// typecheck that read site. Types mirror initModelTool's signature.
import type { RawParameterSet, ResolvedAdmData } from './scripts/model-tool';

declare global {
  interface Window {
    __VT_PARAMETERS__?: RawParameterSet[];
    __VT_RESOLVED_ADM__?: ResolvedAdmData;
  }
}

export {};
```

The `import type` makes this a module, so `declare global` is required to reach the ambient `Window`. `src/**/*` in `tsconfig.astro.json` pulls it into the program.

- [ ] **Step 3: Run the check — expect PASS**

Run:
```bash
npm run build:data
npm run check --workspace site
```
Expected: **exit 0**, `0 errors`. (Hints/warnings may remain; they don't fail the run.)

- [ ] **Step 4: Confirm `tsc --build` is unaffected**

Run: `npm run typecheck`
Expected: PASS, exit 0. (`env.d.ts` *is* part of the composite program — `src/**/*.ts` matches `.d.ts` — so a passing build confirms its additive/optional `Window` augmentation doesn't disturb the other `.ts` in it.)

- [ ] **Step 5: Commit**

```bash
git add site/src/env.d.ts site/src/scripts/model-tool.ts
git commit -m "fix(site): declare the __VT_* window globals the model page reads

astro check flagged reads of window.__VT_PARAMETERS__ /
__VT_RESOLVED_ADM__ (ts2339) -- real latent type holes. Add a global
Window augmentation typed to initModelTool's params; export
RawParameterSet so it can be named."
```

---

### Task 4: Wire the check into the validate workflow

Split the single `Build` step so `astro check` runs on freshly built data and gates the site build. Same command locally and in CI.

**Files:**
- Modify: `.github/workflows/validate.yml` — replace the `Build` step (lines 84–86)

**Interfaces:**
- Consumes: `npm run check --workspace site` (green, Task 3); `npm run build:data` produces `site/src/generated/*.json`.

- [ ] **Step 1: Replace the `Build` step**

In `.github/workflows/validate.yml`, replace:

```yaml
      - name: Build
        run: npm run build:data && npm run build:site
```

with:

```yaml
      - name: Build data
        run: npm run build:data

      - name: Check site types
        # astro check runs `astro sync` internally to regenerate content types,
        # then typechecks .astro frontmatter (which tsc --build never sees). It
        # must follow build:data: the pages import site/src/generated/*.json,
        # which is gitignored and produced there.
        run: npm run check --workspace site

      - name: Build site
        run: npm run build:site
```

- [ ] **Step 2: Reproduce the CI sequence locally**

Run, from a clean tree:
```bash
npm ci
npm run build:data
npm run check --workspace site
npm run build:site
```
Expected: every command exits 0. This is exactly the new job order.

- [ ] **Step 3: Confirm the workflow is valid YAML**

Run: `node -e "require('js-yaml')" 2>/dev/null && npx --yes js-yaml .github/workflows/validate.yml >/dev/null && echo OK || python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/validate.yml')); print('OK')"`
Expected: `OK` (parses without error).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/validate.yml
git commit -m "ci: gate on astro check (.astro frontmatter types)

Split Build into Build data -> Check site types -> Build site so
astro check runs on generated data and blocks the site build. This is
the type gate .astro files previously escaped."
```

- [ ] **Step 5: Push and confirm the PR check is green**

```bash
git push
```
Then confirm the `Validate` workflow's `Check site types` step passes on the PR.

---

## Self-Review

**1. Spec coverage.** The ask was "wire astro check into CI; the `.astro` frontmatter escapes every type gate; blocked by a TS7/@volar version mismatch — sort that out first." Mapping:
- *Sort out the mismatch* → Task 1 (classic TS6.0.3; verified `tsc --build` and Volar both work).
- *`.astro` escapes the gate* → Task 2 (the tsconfig `include` was `.ts`-only — the actual escape hatch — plus the mismatch). Verified: default tsconfig = 0 errors on an injected `.astro` error; astro tsconfig = caught.
- *Wire into CI* → Task 4, ordered after `build:data`.
- Bonus surfaced by the work: 2 real `ts(2339)` errors → Task 3, so CI is green on merge.

**2. Placeholder scan.** No TBD/"add error handling"/"similar to Task N". Every code block is literal and copied from a verified spike; every command has an expected result observed during investigation.

**3. Type consistency.** `RawParameterSet[]` / `ResolvedAdmData` in `env.d.ts` (Task 3) match `initModelTool(liveParameters: RawParameterSet[], resolvedAdmData: ResolvedAdmData)`. `RawParameterSet` is exported in the same task before it's referenced. `ResolvedAdmData` is already exported (model-tool.ts:68). The `check` script name is consistent across Tasks 2 and 4 (`npm run check --workspace site`).

## Notes / risks

- **Do not let `typescript` drift to `7.x`.** Renovate/npm-update bumping it re-breaks `astro check`. The exact pin plus the Global-Constraints note guard this; consider a follow-up to add a comment or a range ceiling if automated updates are enabled.
- **`astro/tsconfigs/strict`** is slightly looser than the repo's `tsconfig.base.json` (no `noUncheckedIndexedAccess` / `exactOptionalPropertyTypes`). It's the verified baseline that yields a green gate today. Tightening the `.astro` check to the repo's full strictness is a reasonable follow-up but will surface more diagnostics — out of scope here.
- **`.astro/` and `site/src/generated/` are gitignored** and regenerated (by `astro sync` inside the check, and by `build:data` respectively). CI already runs on a clean checkout, so both are rebuilt each run.
