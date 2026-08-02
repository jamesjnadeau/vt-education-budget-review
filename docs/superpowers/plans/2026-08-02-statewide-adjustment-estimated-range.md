# Estimated Range for statewide_adjustment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a parameter carried as `value: null` + unverified but with a `range` (low/high/central) compute from its central value as an explicitly-labeled *estimate*, and propagate that range through the engine so every downstream node — up to the billed homestead and nonhomestead rates — shows a computed min–max band in the UI.

**Architecture:** General interval propagation. `parameterNode` uses `range.central` as the point value for an estimated parameter (status `estimated`, non-blocking). `make()` — the one generic node constructor every operation flows through — evaluates each formula at the endpoints of its inputs' ranges (corner evaluation) and records the min/max on `CalcNode.range`. Because every op is monotonic per argument, corner evaluation is the exact band and reuses each formula's existing `compute`. The UI reads `node.range` and renders a band plus a new `estimated` status tag on every node that carries one.

**Tech Stack:** TypeScript (Node ≥22, ESM), Vitest (`environment: 'node'`), Astro + vanilla TS for the site, YAML parameter files, `tsx` CLI build.

## Global Constraints

- Node ≥ 22, ESM (`"type": "module"`); `.ts` extensions in relative imports.
- No new runtime dependencies.
- TDD: write the failing test, watch it fail, minimal implementation, watch it pass, commit. One logical change per commit.
- Follow existing engine invariants (node.ts top-of-file doc): a node carries a value only if nothing it rests on is unverified/missing; the explanation is produced in the same call as the arithmetic. The `estimated` path is a *deliberate, labeled* exception to the first invariant — it must always be visibly tagged, never silent.
- Range band separator is the en-dash character `–` (`–`), matching existing range/basis prose.
- Parameter-file honesty rules still hold (see `docs/parameter-verification.md`): an estimated value must keep its citation `verified: false` and its stated `range.basis`.
- Run `npx tsc --build --force` (must exit 0) and `npx vitest run` (all pass) before every commit that touches `model/` or `site/`.
- The model package is consumed by the site as `@vt-budget/model` (re-exports `model/src/index.ts`, which does `export * from './node.ts'` etc.). Anything newly exported from `node.ts` is automatically importable as `@vt-budget/model`.

## File Structure

- `model/src/types.ts` — add `'estimated'` to `NodeStatus`; add `'estimated_parameter'` to `Blocker['kind']`. (Modify)
- `model/src/node.ts` — estimated leaf in `parameterNode`; the `estimated_parameter` branch in `blockersOfParameter`; `blocksValue`/`statusFromBlockers` updates; interval propagation in `make()`; new exported `formatRange` helper. (Modify)
- `model/src/estimated-range.test.ts` — all engine-side tests for this feature (leaf, propagation, rate-path integration, `formatRange`). (Create)
- `site/src/scripts/model-tool.ts` — `STATUS_LABEL`/`STATUS_CLASS` entries; render band in `renderWalkthrough` and the summary `facts` list; import `formatRange`. (Modify)
- `site/src/styles/global.css` — `.tag.estimated`, `.step-range`, `.fact-range` styles. (Modify)
- `model/parameters/fy2027.yaml` — `tax.statewide_adjustment` back to `value: null` / unverified, keep the range; refresh the header comment + `note`. (Modify)

---

### Task 1: Engine leaf — an estimated parameter computes from its range's central value

A parameter with a `range` whose `central` is set and whose `value` is `null` should compute from `central`, carry status `estimated`, expose `range: {low, high}`, and **not** block — replacing the `unverified`/`missing_input` blockers it would otherwise raise.

**Files:**
- Modify: `model/src/types.ts` (`NodeStatus`, `Blocker['kind']`)
- Modify: `model/src/node.ts` (`blockersOfParameter`, `blocksValue`, `statusFromBlockers`, `parameterNode`)
- Create: `model/src/estimated-range.test.ts`

**Interfaces:**
- Consumes: `createContext`, `parameterNode` (both exported from `node.ts`); `syntheticParameters` from `testing/synthetic.ts`; `ParameterSet`, `Parameter` from `types.ts`.
- Produces: `NodeStatus` now includes `'estimated'`; `Blocker['kind']` includes `'estimated_parameter'`. A `parameterNode` for an estimated parameter returns `{ value: <central>, status: 'estimated', range: {low, high}, blockers: [{kind:'estimated_parameter', ...}] }`. Test helper `withEstimatedStatewide(): ParameterSet` (defined in the test file; reused by later tasks in the same file).

- [ ] **Step 1: Write the failing test**

Create `model/src/estimated-range.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { createContext, input, nonhomesteadRate, parameterNode, quotient, townRate } from './index.ts';
import type { ParameterSet } from './types.ts';
import { syntheticParameters } from './testing/synthetic.ts';

/**
 * A synthetic set whose statewide adjustment is unverified, value-less, and
 * carried only as a range with a central estimate -- the shape this feature
 * teaches the engine to compute from. Shared by every test below.
 */
function withEstimatedStatewide(): ParameterSet {
  const base = syntheticParameters();
  const params = new Map(base.parameters);
  const existing = params.get('tax.statewide_adjustment');
  if (!existing) throw new Error('fixture missing tax.statewide_adjustment');
  params.set('tax.statewide_adjustment', {
    ...existing,
    value: null,
    contingent: false,
    range: { low: 0.7, high: 0.8, central: 0.75, basis: 'test estimate range' },
    citation: { ...existing.citation, verified: false, verified_date: null, verified_by: null },
  });
  return { ...base, parameters: params };
}

describe('estimated parameter leaf', () => {
  it('computes from the range central value, is tagged estimated, and does not block', () => {
    const ctx = createContext(withEstimatedStatewide());
    const node = parameterNode(ctx, 'tax.statewide_adjustment', 'ratio');

    expect(node.value).toBe(0.75);
    expect(node.status).toBe('estimated');
    expect(node.range).toEqual({ low: 0.7, high: 0.8 });
    expect(node.blockers.map((b) => b.kind)).toEqual(['estimated_parameter']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run model/src/estimated-range.test.ts`
Expected: FAIL — either a TypeScript error on `'estimated'`/`'estimated_parameter'` not being valid, or `node.value` is `null` and `node.status` is `'unverified'` (current behavior).

- [ ] **Step 3: Add the status and blocker kinds to types**

In `model/src/types.ts`, add `'estimated'` to `NodeStatus` (extend the doc comment above it to explain the kind):

```typescript
export type NodeStatus =
  | 'ok'
  | 'unverified'
  | 'missing_input'
  | 'undetermined'
  | 'not_computable'
  | 'contingent'
  | 'estimated';
```

Add a note to the `NodeStatus` doc block (just below the `contingent` note):

```
 * `estimated` is likewise not a blank: a parameter with a stated range but no
 * published figure computes from the range's central value and is labeled as an
 * estimate, so a reader never mistakes it for the settled number.
```

Add `'estimated_parameter'` to the `Blocker['kind']` union:

```typescript
export interface Blocker {
  readonly kind:
    | 'unverified_parameter'
    | 'missing_input'
    | 'contingent_parameter'
    | 'undetermined_determination'
    | 'not_computable'
    | 'estimated_parameter';
  readonly ref: string;
  readonly detail: string;
}
```

- [ ] **Step 4: Teach `blockersOfParameter` the estimated branch**

In `model/src/node.ts`, replace the body of `blockersOfParameter` (currently starting `const out: Blocker[] = [];`) with:

```typescript
function blockersOfParameter(p: Parameter): Blocker[] {
  const out: Blocker[] = [];

  // A parameter with a stated range and a central value stands in for an
  // unpublished figure: it computes from that central value as a labeled
  // estimate rather than blocking. This deliberately takes precedence over the
  // unverified/missing blockers it would otherwise raise -- we have chosen to
  // carry the estimate, and `estimated_parameter` is non-blocking below.
  if (p.range !== null && p.range.central !== null && p.value === null) {
    out.push({
      kind: 'estimated_parameter',
      ref: p.key,
      detail: `${p.description} (${p.citation.statute}) is carried as an estimate from a stated range; no figure has been published for this year.`,
    });
    if (p.contingent) {
      out.push({
        kind: 'contingent_parameter',
        ref: p.key,
        detail: `${p.description} depends on legislation that has not been enacted.`,
      });
    }
    return out;
  }

  if (!p.citation.verified) {
    out.push({
      kind: 'unverified_parameter',
      ref: p.key,
      detail: `${p.description} (${p.citation.statute}) has not been verified against current statute text.`,
    });
  }
  if (p.value === null && p.citation.verified && !p.contingent) {
    out.push({
      kind: 'missing_input',
      ref: p.key,
      detail: `${p.description} has no value set for this fiscal year.`,
    });
  }
  if (p.contingent) {
    out.push({
      kind: 'contingent_parameter',
      ref: p.key,
      detail: `${p.description} depends on legislation that has not been enacted.`,
    });
  }
  return out;
}
```

- [ ] **Step 5: Make `estimated_parameter` non-blocking and mapped to a status**

In `model/src/node.ts`, update `blocksValue`:

```typescript
/** A contingent or estimated parameter does not prevent a value -- it qualifies it. */
function blocksValue(blockers: readonly Blocker[]): boolean {
  return blockers.some((b) => b.kind !== 'contingent_parameter' && b.kind !== 'estimated_parameter');
}
```

And add the `estimated` mapping to `statusFromBlockers`, after the `contingent_parameter` line:

```typescript
  if (blockers.some((b) => b.kind === 'contingent_parameter')) return 'contingent';
  if (blockers.some((b) => b.kind === 'estimated_parameter')) return 'estimated';
  return 'ok';
```

- [ ] **Step 6: Use the central value in `parameterNode`**

In `model/src/node.ts` `parameterNode`, after `const p = lookup(ctx, key);` and `const blockers = dedupeBlockers(blockersOfParameter(p));`, replace the `const numeric = ...` line with:

```typescript
  const estimated = p.range !== null && p.range.central !== null && p.value === null;
  const numeric = typeof p.value === 'number' ? p.value : estimated && p.range ? p.range.central : null;
```

Then change the `explanation` field so the estimated case reads as an estimate. Replace the existing `explanation:` expression with:

```typescript
    explanation: blocksValue(blockers)
      ? explainBlocked(p.description, blockers)
      : estimated && p.range
        ? `${p.description} is estimated at ${formatValue(numeric, unit)} (range ${formatValue(p.range.low, unit)}–${formatValue(p.range.high, unit)}); ${cite} has not published a figure for this year, so the range's central value stands in. ${p.range.basis}`
        : p.is_law
          ? `${p.description} is ${rendered}, set by ${cite}.`
          : `${p.description} is ${rendered} under ${cite}. That is a PROPOSED standard, ` +
            `not law: it has not been enacted and may never be.`,
```

(The `value:` line already reads `blocksValue(blockers) ? null : numeric`, which now yields `central` for an estimated parameter because `estimated_parameter` is non-blocking. The `range:` line already reads `p.range ? { low: p.range.low, high: p.range.high } : null`. Leave both as-is.)

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run model/src/estimated-range.test.ts`
Expected: PASS.

- [ ] **Step 8: Full suite + typecheck (no regressions)**

Run: `npx tsc --build --force` (expect exit 0), then `npx vitest run` (expect all pass).
If any test that exhaustively switches over `NodeStatus`/`Blocker['kind']` now fails to compile, add the new arm; do not change unrelated behavior.

- [ ] **Step 9: Commit**

```bash
git add model/src/types.ts model/src/node.ts model/src/estimated-range.test.ts
git commit -m "feat(model): estimated parameter computes from range central value"
```

---

### Task 2: Engine — propagate ranges through `make()` by endpoint evaluation

Make every computed node carry the min–max band implied by its inputs' ranges, by evaluating the node's own `compute` at the corners of the input intervals. This is what turns a ranged `statewide_adjustment` leaf into a banded billed-rate at the top of the tree.

**Files:**
- Modify: `model/src/node.ts` (`make()`)
- Modify: `model/src/estimated-range.test.ts` (add propagation + rate-path tests)

**Interfaces:**
- Consumes: everything from Task 1; `input`, `quotient`, `townRate`, `nonhomesteadRate` (all exported from the package index).
- Produces: any `CalcNode` returned by `make()`/`derive()`/`sum`/`product`/`quotient`/etc. now has `range: {low, high} | null`, non-null exactly when some input carried a range and the node has a point value. `townRate(...).billedRate` and `nonhomesteadRate(...)` carry a range and status `estimated` when `tax.statewide_adjustment` is estimated.

- [ ] **Step 1: Write the failing propagation tests**

Append to `model/src/estimated-range.test.ts`:

```typescript
describe('range propagation through make()', () => {
  it('evaluates the formula at the range endpoints (division inverts the interval)', () => {
    const ctx = createContext(withEstimatedStatewide());
    const statewide = parameterNode(ctx, 'tax.statewide_adjustment', 'ratio'); // 0.75, range 0.7-0.8
    const base = input(ctx, 'base rate', 1.59, 'rate_per_100');
    const rate = quotient(ctx, 'rate', base, statewide, 'rate_per_100'); // 1.59 / statewide

    expect(rate.value).toBeCloseTo(1.59 / 0.75, 10);
    // Dividing by a larger denominator yields a smaller number, so low uses 0.8.
    expect(rate.range?.low).toBeCloseTo(1.59 / 0.8, 10);
    expect(rate.range?.high).toBeCloseTo(1.59 / 0.7, 10);
  });

  it('leaves range null when no input carries a range', () => {
    const ctx = createContext(syntheticParameters());
    const a = input(ctx, 'a', 2, 'ratio');
    const b = input(ctx, 'b', 4, 'ratio');
    expect(quotient(ctx, 'q', a, b, 'ratio').range).toBeNull();
  });
});

describe('estimated band reaches the billed rates', () => {
  it('carries the band and estimated status through townRate and nonhomesteadRate', () => {
    const ctx = createContext(withEstimatedStatewide());
    const perPupil = input(ctx, 'spending per pupil', 15000, 'usd_per_pupil');
    const result = townRate(ctx, perPupil, { town: 'test', cla: 1, cla_source: 'test' }, 12000);

    expect(result.billedRate.value).not.toBeNull();
    expect(result.billedRate.status).toBe('estimated');
    expect(result.billedRate.range).not.toBeNull();
    expect(result.billedRate.range!.low).toBeLessThan(result.billedRate.range!.high);

    const nonhs = nonhomesteadRate(ctx);
    expect(nonhs.status).toBe('estimated');
    expect(nonhs.range).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run model/src/estimated-range.test.ts -t "propagation"`
Expected: FAIL — `rate.range` is `null` (make() currently hardcodes `range: null`).

- [ ] **Step 3: Implement endpoint evaluation in `make()`**

In `model/src/node.ts` `make()`, after the block that computes `value` (ends with the non-finite guard) and before `const status = statusFromBlockers(blockers);`, insert:

```typescript
  // Interval propagation. When any input carries a range, evaluate this node's
  // own formula at the corners of the input intervals and take the extremes.
  // Every op is monotonic per argument, so the corner evaluation is the exact
  // min/max; it reuses `compute` rather than duplicating each formula's interval
  // math. Runs only when a point value exists, so a blocked node stays a plain
  // blank rather than sprouting a band with no center.
  let range: { low: number; high: number } | null = null;
  if (value !== null && inputs.some((i) => i.range !== null)) {
    const intervals = inputs.map((i) =>
      i.range ? ([i.range.low, i.range.high] as const) : ([i.value as number, i.value as number] as const),
    );
    if (intervals.every(([lo, hi]) => Number.isFinite(lo) && Number.isFinite(hi))) {
      const corners = intervals.reduce<number[][]>(
        (acc, [lo, hi]) => {
          const ends = lo === hi ? [lo] : [lo, hi];
          return acc.flatMap((prefix) => ends.map((end) => [...prefix, end]));
        },
        [[]],
      );
      const results: number[] = [];
      for (const corner of corners) {
        const r = args.compute(corner, parameters);
        if (r !== null && Number.isFinite(r)) results.push(r);
      }
      if (results.length > 0) range = { low: Math.min(...results), high: Math.max(...results) };
    }
  }
```

Then change the returned object's `range: null,` line to `range,`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run model/src/estimated-range.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Full suite + typecheck**

Run: `npx tsc --build --force` (exit 0), then `npx vitest run` (all pass).
Note: existing computed nodes had `range: null` before and still do unless a ranged input appears, so no existing assertion should change. If a snapshot/equality test on a specific node now includes `range`, update it to the correct `{low, high}` value it computes.

- [ ] **Step 6: Commit**

```bash
git add model/src/node.ts model/src/estimated-range.test.ts
git commit -m "feat(model): propagate parameter ranges through make() via endpoint evaluation"
```

---

### Task 3: UI — render the estimated tag and the min–max band

Expose a tested `formatRange` helper, then render (a) the new `estimated` status tag and (b) the band on every node that carries a range, in both the step-by-step walkthrough and the summary facts list.

**Files:**
- Modify: `model/src/node.ts` (add + export `formatRange`)
- Modify: `model/src/estimated-range.test.ts` (test `formatRange`)
- Modify: `site/src/scripts/model-tool.ts` (`STATUS_LABEL`, `STATUS_CLASS`, `renderWalkthrough`, summary facts, import)
- Modify: `site/src/styles/global.css` (`.tag.estimated`, `.step-range`, `.fact-range`)

**Interfaces:**
- Consumes: `CalcNode.range`, `CalcNode.status` from Tasks 1–2.
- Produces: `formatRange(range: { readonly low: number; readonly high: number } | null, unit: Unit): string | null` exported from `@vt-budget/model` — returns `"<low>–<high>"` formatted per `unit`, or `null` when `range` is `null`.

- [ ] **Step 1: Write the failing `formatRange` test**

Append to `model/src/estimated-range.test.ts`:

```typescript
import { formatRange } from './index.ts'; // add to the existing import list at the top instead of duplicating

describe('formatRange', () => {
  it('formats low and high with the unit, joined by an en-dash', () => {
    expect(formatRange({ low: 0.7, high: 0.8 }, 'ratio')).toBe('0.7–0.8');
  });

  it('returns null when there is no range', () => {
    expect(formatRange(null, 'rate_per_100')).toBeNull();
  });
});
```

(Fold `formatRange` into the file's existing top `import { ... } from './index.ts'` rather than adding a second import line.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run model/src/estimated-range.test.ts -t "formatRange"`
Expected: FAIL — `formatRange` is not exported.

- [ ] **Step 3: Implement `formatRange`**

In `model/src/node.ts`, directly below `export function formatValue(...) { ... }`, add:

```typescript
/** Formats a low/high band with the same unit rules as formatValue. */
export function formatRange(
  range: { readonly low: number; readonly high: number } | null,
  unit: Unit,
): string | null {
  if (range === null) return null;
  return `${formatValue(range.low, unit)}–${formatValue(range.high, unit)}`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run model/src/estimated-range.test.ts -t "formatRange"`
Expected: PASS.

- [ ] **Step 5: Add the `estimated` label/class in the UI**

In `site/src/scripts/model-tool.ts`, add the `estimated` arm to both maps:

```typescript
const STATUS_LABEL: Record<CalcNode['status'], string> = {
  ok: 'computed',
  unverified: 'blocked: parameter unverified',
  missing_input: 'blocked: figure not published',
  undetermined: 'undetermined: the State has not decided',
  not_computable: 'not computable from public data',
  contingent: 'contingent on legislation',
  estimated: 'estimated (from range)',
};

const STATUS_CLASS: Record<CalcNode['status'], string> = {
  ok: 'ok',
  unverified: 'unverified',
  missing_input: 'missing-input',
  undetermined: 'undetermined',
  not_computable: 'not-computable',
  contingent: 'contingent',
  estimated: 'estimated',
};
```

- [ ] **Step 6: Import `formatRange` in the UI**

In `site/src/scripts/model-tool.ts`, add `formatRange` to the existing `import { ... } from '@vt-budget/model';` block (alongside `formatValue`).

- [ ] **Step 7: Render the band in the walkthrough step head**

In `renderWalkthrough`, immediately after the line `head.append(el('span', 'step-value', formatValue(node.value, node.unit)));`, add:

```typescript
    const stepBand = formatRange(node.range, node.unit);
    if (stepBand) head.append(el('span', 'step-range', `range ${stepBand}`));
```

- [ ] **Step 8: Render the band in the summary facts list**

In the `results` loop that builds the `dl.facts`, after the line that appends the status tag (`dd.append(el('span', \`tag ${STATUS_CLASS[node.status]}\`, STATUS_LABEL[node.status]));`), add:

```typescript
      const factBand = formatRange(node.range, node.unit);
      if (factBand) dd.append(el('span', 'fact-range', ` (range ${factBand})`));
```

- [ ] **Step 9: Add CSS**

In `site/src/styles/global.css`, after the `.tag.contingent { ... }` block, add:

```css
.tag.estimated {
  border-color: var(--accent);
  color: var(--accent);
  border-style: dashed;
}
.step-range,
.fact-range {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
```

(If `--muted` is not defined in this stylesheet's `:root`, use the nearest existing muted-text variable; grep `global.css` for the color used by `.step-citation`.)

- [ ] **Step 10: Typecheck + full suite**

Run: `npx tsc --build --force` (exit 0), then `npx vitest run` (all pass).

- [ ] **Step 11: Commit**

```bash
git add model/src/node.ts model/src/estimated-range.test.ts site/src/scripts/model-tool.ts site/src/styles/global.css
git commit -m "feat(site): render estimated status and min-max band in the model tool"
```

---

### Task 4: Data + notes — statewide_adjustment as an estimate, and browser verification

Return `tax.statewide_adjustment` to `value: null` + unverified with its range intact so the engine treats it as an estimate, refresh the FY2027 notes to describe the new behavior, rebuild the generated data, and verify end-to-end in the browser.

**Files:**
- Modify: `model/parameters/fy2027.yaml`
- Regenerate: `site/src/generated/parameters.json` (via `npm run build:data`)

**Interfaces:**
- Consumes: the estimated-parameter engine + UI behavior from Tasks 1–3.
- Produces: FY2027 `tax.statewide_adjustment` = `value: null`, `verified: false`, `range: {low: 0.7, high: 0.8, central: 0.75, basis: ...}`; the model tool shows the FY2027 billed homestead rate as `estimated (from range)` with a band.

- [ ] **Step 1: Set the parameter back to an unverified, value-less estimate**

In `model/parameters/fy2027.yaml`, edit the `tax.statewide_adjustment` block: set `value: null` (currently `0.75`), keep the `range` block exactly (`low: 0.7`, `high: 0.8`, `central: 0.75`, `basis: ...`), and set the citation to unverified:

```yaml
      verified: false
      verified_date: null
      verified_by: null
```

Leave the `quote` ("... not yet published for FY2027.") as-is — it is now accurate again.

- [ ] **Step 2: Verify the parameter parses and the value is null with a range**

Run: `npm run build:data`
Then run:

```bash
python3 -c "import json;d=json.load(open('site/src/generated/parameters.json'));fy=[x for x in d if x['fiscal_year']==2027][0];p=[q for q in fy['parameters'] if q['key']=='tax.statewide_adjustment'][0];print('value=',p['value'],'verified=',p['citation']['verified'],'range=',p.get('range'))"
```

Expected: `value= None verified= False range= {'low': 0.7, 'high': 0.8, 'central': 0.75, ...}`.

- [ ] **Step 3: Update the FY2027 header comment (item 2)**

In `model/parameters/fy2027.yaml`, replace the item-2 block under `WHAT IS STILL OPEN` with:

```
#   2. THE FY2027 STATEWIDE ADJUSTMENT is not yet published by the Department of
#      Taxes. `tax.statewide_adjustment` stays unverified with no point value,
#      but carries a 0.7-0.8 range whose central estimate (0.75) the engine uses
#      to compute the homestead tax rate, alongside the min/max the range
#      implies. Every figure that rests on it is labeled `estimated (from range)`
#      in the tool, not presented as the published number. Give it a verified
#      value when the Department publishes one.
```

- [ ] **Step 4: Update the `note` field**

Replace the `note:` block with:

```yaml
note: >-
  Values read from current statute text snapshotted in model/statute/2026-07-29/,
  partially countersigned by hand. Weighted membership computes: the Act 73
  contingency did not fire, so the pre-repeal prekindergarten weight governs
  FY2027. The homestead tax rate is computed as an estimate -- the FY2027
  statewide adjustment is unpublished, so tax.statewide_adjustment stays null and
  unverified and the engine uses its 0.7-0.8 range (central 0.75), showing the
  implied min/max. The post-2028 foundation formula is modeled as contingent bands.
```

- [ ] **Step 5: Rebuild + full suite + typecheck**

Run: `npm run build:data`, then `npx tsc --build --force` (exit 0), then `npx vitest run` (all pass).

- [ ] **Step 6: Browser verification**

Start the site dev server and confirm the FY2027 homestead rate renders as estimated with a band. Use the project's own preview (do not reuse another chat's server):

1. `preview_start` with the site launch config (create `.claude/launch.json` for the site — `npm run dev` in the `site` workspace, its dev port — if absent).
2. Navigate to the model tool page (`/model`).
3. In the parameter-mode dropdown, select the FY2027 option.
4. Fill the form with any complete scenario (all four grade counts for both years, spending, CLA, and the pre-filled statewide average).
5. `read_page` and confirm:
   - the summary "Homestead rate as billed" fact shows the `estimated (from range)` tag and a `(range …–…)` suffix;
   - the walkthrough step for the billed rate shows a `range …–…` span.
6. `computer` screenshot for the record.

- [ ] **Step 7: Commit**

```bash
git add model/parameters/fy2027.yaml site/src/generated/parameters.json
git commit -m "feat(model): carry FY2027 statewide_adjustment as an estimated range"
```

---

## Self-Review

**1. Spec coverage:**
- "compute the range for statewide_adjustment" → Tasks 1 (leaf) + 2 (propagation).
- "value still unverified and set to null" → Task 4 Step 1 (`value: null`, `verified: false`); Task 1 makes that shape compute instead of block.
- "range's central value used instead" → Task 1 Step 6 (`numeric = ... central`).
- "show the computed min/max in the UI" → Task 3 (band in walkthrough + summary).
- "see how this range affects the outcome" → propagation reaches `billedRate`/`nonhomesteadRate` (Task 2 test) and is displayed on every ranged node (Task 3, per the display-scope decision).

**2. Placeholder scan:** No TBD/TODO. Every code step shows the exact code. The one conditional instruction (Task 3 Step 9 `--muted` fallback) names the concrete grep to resolve it.

**3. Type consistency:**
- `NodeStatus` gains `'estimated'` (Task 1) and every `Record<CalcNode['status'], ...>` in the UI gets the arm (Task 3 Step 5) — checked in both.
- `Blocker['kind']` gains `'estimated_parameter'`; used in `blockersOfParameter`, excluded in `blocksValue`, mapped in `statusFromBlockers` — all Task 1.
- `CalcNode.range` type `{low, high} | null` is unchanged; `make()` now populates it; `formatRange` accepts exactly that shape.
- `formatRange` signature is identical in the test (Task 3 Step 1), the implementation (Step 3), and the UI import/use (Steps 6–8).
- `withEstimatedStatewide()` is defined once (Task 1) and reused by Tasks 2–3 in the same file.

**Coverage gap check:** The `estimated` status also flows through `renderBlockers`/`renderCitations`? `renderBlockers` filters by specific blocker kinds and ignores `estimated_parameter` (correct — it is not a blocker and must not appear in the "things standing between this scenario and a number" box). `renderCitations` iterates `node.parameters` and already renders `not verified` for unverified citations — the estimated parameter keeps `verified: false`, so its citation still shows `not verified`, which is correct and needs no change. No additional task required.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-08-02-statewide-adjustment-estimated-range.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
