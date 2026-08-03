# Total-Driven Merger Calculation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the two-SU merger model compute from each SU's published total expenditure (`expenditures.total_stated`) instead of summing per-function grains, so the current total is reliable even when SUs slice their budgets differently.

**Architecture:** The per-SU function grains (`instruction`, `special_education`, …) stay on every record but leave the merger arithmetic entirely. `runScenario` now sums each SU's `total_stated` for the current total, and produces the scenario total by applying a single `consolidation_factor` assumption to it. The four per-line assumptions collapse into that one factor. The staffing comparison is kept unchanged as an independent, informational view that does not feed the headline delta. A new reconciliation caveat, mirroring the validator's existing 0.1% tolerance, flags any SU whose grains do not sum to its stated total.

**Tech Stack:** TypeScript (Node ≥22, ESM, `.ts` import specifiers), Vitest, JSON Schema (Ajv). npm workspaces (`model`, `tools`, `site`).

## Global Constraints

- No `savings` field, ever. Deltas are signed; both directions are shown with equal weight. (scenario.ts file header, rules 1–2.)
- `null` money means "the source did not publish it," never a silent zero. Null must propagate through totals. (common-1.0 schema `money` def; `totalOf` in scenario.ts.)
- Every assumption is an explicit, labelled, user-adjustable object carrying its own `rationale`. Nothing hidden in a constant.
- Defaults never assume a reduction: `consolidation_factor` starts at `1.0` so any change shown is one the user chose.
- Use `.ts` extensions in import specifiers (e.g. `from './node.ts'`).
- Run tests with `npx vitest run <file>` (focused) and `npm test` (full suite, all workspaces). Typecheck with `npm run typecheck`.
- `expenditures.total_stated` stays `accountable: false` in `tools/src/normalize/fields.ts` — a blank printed total is a legitimate null by deliberate design (fields.ts:7-9). Do NOT make it accountable.

---

## File Structure

- `schemas/budget-1.0.schema.json` — normalized per-district/SU record schema. Change: add `total_stated` to `expenditures.required`.
- `model/src/scenario.ts` — the merger engine. Change: add `total_stated` to `ExpenditureRollup`; swap four per-line assumptions for one `consolidation_factor`; rewrite `runScenario` to be total-driven; drop `LineComparison` and `ScenarioResult.lines` and `SCALED_LINES`; rewrite `buildCaveats` (base + reconciliation).
- `model/src/engine.test.ts` — engine tests. Change: add `total_stated` to the scenario fixture; rewrite the delta tests for the factor; add null-propagation and reconciliation tests.

Not changed, but verified in Task 4:
- `site/src/scripts/model-tool.ts` — renders `defaultAssumptions()` generically (label/value/rationale) and never calls `runScenario`; the new assumption set renders automatically.
- `tools/**` — does not import the model; `total_stated` already exists in `fields.ts` and is controlled per-test in `rules.test.ts`.

---

### Task 1: Require `total_stated` in the budget schema

**Files:**
- Modify: `schemas/budget-1.0.schema.json:102-111` (the `expenditures.required` array)
- Test: `tools/src/validate/schemas.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the guarantee that every conforming record carries an `expenditures.total_stated` key (value may still be `null`). Task 2's `runScenario` relies on this key being present.

- [ ] **Step 1: Write the failing test**

Add this `describe` block to the end of `tools/src/validate/schemas.test.ts`:

```ts
describe('budget schema requires a stated expenditure total', () => {
  it('lists expenditures.total_stated as required', () => {
    const schema = JSON.parse(
      readFileSync(join(PATHS.schemas, 'budget-1.0.schema.json'), 'utf8'),
    );
    const required = schema.properties.expenditures.required as string[];
    expect(required).toContain('total_stated');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tools/src/validate/schemas.test.ts`
Expected: FAIL — `expected [ 'instruction', … 'other' ] to include 'total_stated'`.

- [ ] **Step 3: Add `total_stated` to the required array**

In `schemas/budget-1.0.schema.json`, change the `expenditures.required` array (currently lines 102-111) to include `total_stated` as the last entry:

```json
      "required": [
        "instruction",
        "special_education",
        "administration_district",
        "administration_school",
        "operations_maintenance",
        "transportation",
        "debt_service",
        "other",
        "total_stated"
      ],
```

Leave the `total_stated` property definition (lines 127-130) exactly as it is — it is already declared with the reconciliation-focused description.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tools/src/validate/schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Emit non-accountable keys so required-but-blank records stay valid**

Plan-defect correction (discovered during Task 1 review, human-approved): the original assumption that normalized records always emit every key was wrong — non-accountable fields with a blank value were *omitted*. With `total_stated` now schema-required, a district that publishes no printed total would emit a record *missing* the key and fail validation. In `tools/src/normalize/record.ts`, the non-accountable branch of `buildRecord` now emits an explicit `null` (via `setPath(record, field.path, null)`) instead of `continue`-ing. This is schema-safe: every non-accountable field (`*.total_stated`, `as_stated_note`, `adm_basis`, `equalized_pupils_stated`, `membership_note`, `as_stated_basis`) is nullable in the schema. Add a test in `tools/src/normalize/record.test.ts` asserting a blank non-accountable figure (e.g. `expenditures.total_stated`) is emitted as `null`, not omitted.

Then confirm no existing tool tests broke:

Run: `npx vitest run tools/`
Expected: PASS. (`rules.test.ts` sets `total_stated` per-test and does not run Ajv on its in-memory records.)

- [ ] **Step 6: Commit**

```bash
git add schemas/budget-1.0.schema.json tools/src/validate/schemas.test.ts
git commit -m "feat(schema): require expenditures.total_stated on budget records"
```

---

### Task 2: Compute the merger from published totals

**Files:**
- Modify: `model/src/scenario.ts` (import line 24; `ExpenditureRollup` 37-46; `defaultAssumptions` 88-160; `LineComparison` 183-189; `ScenarioResult` 191-201; `SCALED_LINES` 213-226; `runScenario` 228-275; `buildCaveats` 365-396)
- Test: `model/src/engine.test.ts` (scenario fixture and `describe('scenarios present movement in both directions', …)` 520-608)

**Interfaces:**
- Consumes: `DistrictBudget.expenditures.total_stated: number | null` (guaranteed present by Task 1); `Assumption` records; `input`, `product`, `difference`, `totalOf`, `assumptionValue`, `assumptionLabel`, `computeStaffing` (all already in scenario.ts).
- Produces:
  - `ExpenditureRollup` gains `readonly total_stated: number | null`.
  - `defaultAssumptions()` returns exactly three assumptions, in order: `consolidation_factor` (value `1`, unit `multiplier`), `health_insurance_trend` (unchanged), `benefit_load_on_consolidated_salary` (unchanged).
  - `runScenario(ctx, spec): ScenarioResult` where `ScenarioResult` no longer has `lines`; `currentTotal`, `scenarioTotal`, `delta`, `staffing`, `assumptions`, `caveats`, `name` remain. `currentTotal = Σ total_stated` (null-propagating); `scenarioTotal = currentTotal × consolidation_factor`; `delta = scenarioTotal − currentTotal`.
  - `LineComparison` and `SCALED_LINES` are removed from the module's exports/surface.

- [ ] **Step 1: Update the fixture and rewrite the delta tests (failing)**

In `model/src/engine.test.ts`, add `total_stated` to the `base` fixture's `expenditures` block (the eight grains sum to 1,700,000):

```ts
    expenditures: {
      instruction: 1_000_000,
      special_education: 200_000,
      administration_district: 100_000,
      administration_school: 80_000,
      operations_maintenance: 150_000,
      transportation: 90_000,
      debt_service: 50_000,
      other: 30_000,
      total_stated: 1_700_000,
    },
```

Replace the whole `it('reports a signed delta that can go either way', …)` test (currently 545-567) with:

```ts
  it('reports a signed delta that can go either way', () => {
    const ctx = createContext(syntheticParameters());

    // Two districts, each with a published total of 1,700,000 -> 3,400,000.
    const reduced = runScenario(ctx, {
      name: 'assume a 5% consolidation efficiency',
      districts: two,
      consolidatedPositions: [],
      assumptions: defaultAssumptions().map((a) =>
        a.key === 'consolidation_factor' ? { ...a, value: 0.95 } : a,
      ),
    });
    expect(reduced.currentTotal.value).toBe(3_400_000);
    expect(reduced.delta.value).toBeCloseTo(-170_000, 6);

    const increased = runScenario(ctx, {
      name: 'assume costs rise 5% during the transition',
      districts: two,
      consolidatedPositions: [],
      assumptions: defaultAssumptions().map((a) =>
        a.key === 'consolidation_factor' ? { ...a, value: 1.05 } : a,
      ),
    });
    expect(increased.delta.value).toBeCloseTo(170_000, 6);
  });

  it('reports the current total as unknown when a district did not publish it', () => {
    const ctx = createContext(syntheticParameters());
    const missing: DistrictBudget = {
      ...base,
      entity: 'ud/c',
      expenditures: { ...base.expenditures, total_stated: null },
    };
    const result = runScenario(ctx, {
      name: 'one district published no total',
      districts: [base, missing],
      consolidatedPositions: [],
      assumptions: defaultAssumptions(),
    });
    expect(result.currentTotal.value).toBeNull();
    expect(result.delta.value).toBeNull();
  });
```

Leave `it('changes nothing at all under default assumptions', …)`, `it('reports an unpriced consolidated position as unknown, never as zero', …)`, and `it('applies the health insurance trend independently of headcount', …)` unchanged — they do not reference `total_stated` or the removed assumptions and remain correct.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run model/src/engine.test.ts`
Expected: FAIL — `consolidation_factor` is not yet a known assumption (the `.map` leaves the default 1.0, so deltas are 0), and `DistrictBudget`/`ExpenditureRollup` typing plus `runScenario` still carry the old shape.

- [ ] **Step 3: Add `total_stated` to `ExpenditureRollup`**

In `model/src/scenario.ts`, change the `ExpenditureRollup` interface (37-46) to add the field after `other`:

```ts
export interface ExpenditureRollup {
  readonly instruction: number | null;
  readonly special_education: number | null;
  readonly administration_district: number | null;
  readonly administration_school: number | null;
  readonly operations_maintenance: number | null;
  readonly transportation: number | null;
  readonly debt_service: number | null;
  readonly other: number | null;
  /** Total expenditure as published. The figure the merger math runs on. */
  readonly total_stated: number | null;
}
```

- [ ] **Step 4: Replace the per-line assumptions with `consolidation_factor`**

In `defaultAssumptions()` (88-160), remove the four objects with keys `district_admin_retained`, `school_admin_retained`, `operations_retained`, and `transportation_multiplier`. In their place, as the first element of the returned array, add:

```ts
    {
      key: 'consolidation_factor',
      label: 'Consolidation factor applied to combined total expenditure',
      value: 1,
      unit: 'multiplier',
      rationale:
        'Starts at 1.0 -- no change -- so any reduction or increase shown is one the ' +
        'user chose and can see, never one the tool assumed for them. A merger can ' +
        'consolidate district administration and some shared services, but how much a ' +
        'real board would consolidate is a political question, not an arithmetic one. ' +
        'The factor applies to the combined published total because districts do not ' +
        'slice their budgets the same way, so a line-by-line model would be comparing ' +
        'figures that are not comparable.',
      userAdjustable: true,
    },
```

Keep the `health_insurance_trend` (135-146) and `benefit_load_on_consolidated_salary` (147-158) objects exactly as they are. The array now returns three assumptions in this order: `consolidation_factor`, `health_insurance_trend`, `benefit_load_on_consolidated_salary`.

- [ ] **Step 5: Drop `sum` from the node import**

Change line 24 from:

```ts
import { difference, input, product, sum } from './node.ts';
```

to:

```ts
import { difference, input, product } from './node.ts';
```

- [ ] **Step 6: Remove `LineComparison` and `ScenarioResult.lines`**

Delete the `LineComparison` interface entirely (183-189). In `ScenarioResult` (191-201), delete the line `readonly lines: readonly LineComparison[];`. The interface becomes:

```ts
export interface ScenarioResult {
  readonly name: string;
  readonly currentTotal: CalcNode;
  readonly scenarioTotal: CalcNode;
  readonly delta: CalcNode;
  readonly staffing: StaffingComparison;
  readonly assumptions: readonly Assumption[];
  /** Everything the user should know before quoting this result at a meeting. */
  readonly caveats: readonly string[];
}
```

- [ ] **Step 7: Remove `SCALED_LINES`**

Delete the entire `SCALED_LINES` constant (213-226).

- [ ] **Step 8: Rewrite `runScenario`**

Replace the whole `runScenario` function (228-275) with:

```ts
export function runScenario(ctx: EngineContext, spec: ScenarioSpec): ScenarioResult {
  const currentValue = totalOf(spec.districts, (d) => d.expenditures.total_stated);
  const currentTotal = input(ctx, 'Total expenditure, current structure', currentValue, 'usd', {
    source: spec.districts.map((d) => d.source).join('; '),
    notes: [
      'The sum of each district’s published total expenditure. Function-level ' +
        'figures are kept on each record but are not summed across districts, ' +
        'because districts do not slice their budgets the same way.',
    ],
  });

  const factor = assumptionValue(spec, 'consolidation_factor');
  const multiplier = input(ctx, assumptionLabel(spec, 'consolidation_factor'), factor, 'multiplier', {
    source: 'scenario assumption',
  });
  const scenarioTotal = product(ctx, 'Total expenditure, scenario', currentTotal, multiplier, 'usd');
  const delta = difference(ctx, 'Change in total expenditure', scenarioTotal, currentTotal, 'usd');

  const staffing = computeStaffing(ctx, spec);

  return {
    name: spec.name,
    currentTotal,
    scenarioTotal,
    delta,
    staffing,
    assumptions: spec.assumptions.length > 0 ? spec.assumptions : defaultAssumptions(),
    caveats: buildCaveats(spec),
  };
}
```

- [ ] **Step 9: Rewrite `buildCaveats` (base version)**

Replace the whole `buildCaveats` function (365-396) with the version below. (Task 3 adds the reconciliation loop to this same function.)

```ts
function buildCaveats(spec: ScenarioSpec): string[] {
  const caveats: string[] = [
    'This scenario changes district boundaries on paper. It does not model the ' +
      'transition costs of getting there: contract harmonization, severance, ' +
      'systems integration, or the multi-year period in which two structures ' +
      'run in parallel.',
    'The headline delta is a single consolidation factor applied to the combined ' +
      'published total expenditure. The tool does not model which functions change ' +
      'or by how much, and it does not separate debt service, construction aid or ' +
      'transportation routing, all of which are out of scope for version 1.',
    'The staffing figures are an independent view of the same budget. They do not ' +
      'feed the headline delta -- that comes solely from the consolidation factor -- ' +
      'so the two must never be added together.',
  ];

  if (spec.consolidatedPositions.length === 0) {
    caveats.push(
      'This scenario consolidates no positions, so the staffing view shows no ' +
        'change. The headline delta comes entirely from the consolidation factor.',
    );
  }

  const unpricedPositions = spec.consolidatedPositions.filter((p) => p.average_salary === null);
  if (unpricedPositions.length > 0) {
    caveats.push(
      `${unpricedPositions.length} consolidated position(s) have no stated average ` +
        'salary, so the staffing effect cannot be quantified and is reported as ' +
        'unknown rather than as zero.',
    );
  }

  return caveats;
}
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `npx vitest run model/src/engine.test.ts`
Expected: PASS (all scenario tests, including the two new ones).

- [ ] **Step 11: Typecheck the whole build**

Run: `npm run typecheck`
Expected: PASS — no dangling references to `LineComparison`, `SCALED_LINES`, `sum`, or the removed assumption keys anywhere in `model`, `tools`, or `site`.

- [ ] **Step 12: Commit**

```bash
git add model/src/scenario.ts model/src/engine.test.ts
git commit -m "feat(model): compute merger from published totals via a single consolidation factor"
```

---

### Task 3: Flag SUs whose grains do not reconcile to their stated total

**Files:**
- Modify: `model/src/scenario.ts` (add a module-level `GRAIN_KEYS` const and `sumGrains` helper; extend `buildCaveats`)
- Test: `model/src/engine.test.ts` (add one test to the scenarios `describe` block)

**Interfaces:**
- Consumes: `ExpenditureRollup` (from Task 2), `ScenarioSpec.districts`.
- Produces: `buildCaveats` appends one caveat per district whose eight function grains are all present but sum to a figure differing from `total_stated` by more than `max(1, total_stated × 0.001)`. The caveat text contains the district's `entity` and the word "reconcile". Tolerance matches the validator's `checkRecomputation` (rules.ts:519).

- [ ] **Step 1: Write the failing test**

Add this test inside `describe('scenarios present movement in both directions', …)` in `model/src/engine.test.ts`:

```ts
  it('flags a district whose function rollups do not reconcile to its stated total', () => {
    const ctx = createContext(syntheticParameters());
    const mismatched: DistrictBudget = {
      ...base,
      entity: 'ud/d',
      // Grains still sum to 1,700,000; the printed total says otherwise.
      expenditures: { ...base.expenditures, total_stated: 2_000_000 },
    };
    const result = runScenario(ctx, {
      name: 'grains disagree with the printed total',
      districts: [mismatched],
      consolidatedPositions: [],
      assumptions: defaultAssumptions(),
    });
    expect(
      result.caveats.some((c) => c.includes('ud/d') && /reconcile/i.test(c)),
    ).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run model/src/engine.test.ts -t "do not reconcile"`
Expected: FAIL — no caveat mentions `ud/d`.

- [ ] **Step 3: Add the grain-sum helper**

In `model/src/scenario.ts`, add these two module-level declarations immediately above the `buildCaveats` function:

```ts
const GRAIN_KEYS: ReadonlyArray<keyof ExpenditureRollup> = [
  'instruction',
  'special_education',
  'administration_district',
  'administration_school',
  'operations_maintenance',
  'transportation',
  'debt_service',
  'other',
];

/** Sum of the eight function grains, or null if any grain is unpublished. */
function sumGrains(e: ExpenditureRollup): number | null {
  let acc = 0;
  for (const key of GRAIN_KEYS) {
    const v = e[key];
    if (v === null) return null;
    acc += v;
  }
  return acc;
}
```

- [ ] **Step 4: Append the reconciliation loop to `buildCaveats`**

In `buildCaveats`, insert this block immediately before the final `return caveats;`:

```ts
  // Mirrors the validator's recomputation tolerance (0.1%, floor of $1). The
  // published total is authoritative; a gap is surfaced, not silently resolved.
  for (const d of spec.districts) {
    const grains = sumGrains(d.expenditures);
    const stated = d.expenditures.total_stated;
    if (grains !== null && stated !== null) {
      const diff = Math.abs(grains - stated);
      if (diff > Math.max(1, stated * 0.001)) {
        caveats.push(
          `${d.entity}: function rollups sum to ${grains.toLocaleString()} but the ` +
            `published total is ${stated.toLocaleString()} (difference ` +
            `${diff.toLocaleString()}). The published total is used; this gap is not ` +
            `explained here and should be checked against the source document.`,
        );
      }
    }
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run model/src/engine.test.ts`
Expected: PASS (including the new reconciliation test and all Task 2 tests). The clean fixture (`total_stated: 1_700_000`, grains sum 1,700,000) produces no reconciliation caveat, so the two-direction test's other assertions are unaffected.

- [ ] **Step 6: Commit**

```bash
git add model/src/scenario.ts model/src/engine.test.ts
git commit -m "feat(model): caveat SUs whose function rollups don't reconcile to the stated total"
```

---

### Task 4: Full-suite verification

**Files:** none modified. This task confirms the change is coherent across all three workspaces.

**Interfaces:**
- Consumes: everything from Tasks 1–3.
- Produces: a green full suite and typecheck, and confirmation the site renders the new assumption set.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS across `model`, `tools`, and `site`.

- [ ] **Step 2: Typecheck all workspaces**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Confirm the site model page still builds and renders assumptions**

The site build imports generated data (e.g. `site/generated/registry.json`), so generate it first — the standalone `npm run build --workspace site` fails on a fresh worktree with `UNRESOLVED_IMPORT ../../generated/registry.json` otherwise (this is a missing prerequisite, not a regression):

Run: `npm run build:data`
Then run: `npm run build --workspace site`
Expected: SUCCESS (all pages built). `renderAssumptions` (site/src/scripts/model-tool.ts:471) iterates `defaultAssumptions()` generically, so the assumptions table now shows the three current assumptions (Consolidation factor, Annual health insurance cost trend, Benefit cost as a share of salary) with no code change required. Note: `tsc --build` (Step 2) is what actually verifies the site's TypeScript against the new model API; the astro build failure above is a data-prerequisite issue that surfaces before any model-API type check.

- [ ] **Step 4: Confirm nothing still references the removed surface**

Run:
```bash
grep -rn "LineComparison\|SCALED_LINES\|district_admin_retained\|school_admin_retained\|operations_retained\|transportation_multiplier\|\.lines\b" --include=*.ts --include=*.tsx --include=*.astro . | grep -v node_modules | grep -v "/dist/"
```
Expected: no matches (a `dist/` match is a stale build artifact and is acceptable; regenerate with `npm run typecheck` if desired).

- [ ] **Step 5: Final commit if anything regenerated**

Only if build artifacts under `model/dist` changed and are tracked:
```bash
git add -A
git commit -m "chore: regenerate model build artifacts for total-driven merger calc"
```
Otherwise, no commit is needed — Tasks 1–3 already captured all source changes.

---

## Self-Review

**Spec coverage** (against the approved design):
1. Add `total`/`total_stated` field used in calculations — Task 2 Step 3 (type) + Step 8 (`runScenario` uses it). ✓
2. Keep the grains — grains remain on `ExpenditureRollup`; only removed from the calc. Task 3 puts them to use in reconciliation. ✓
3. Total replaces grains entirely in calculations — Task 2 Step 8. ✓
4. Scenario = single top-level multiplier — `consolidation_factor` in Task 2 Steps 4 & 8. ✓
5. Staffing kept as informational, decoupled from delta — unchanged `computeStaffing`; caveat added in Task 2 Step 9. ✓
6. Recommendation 1: `total_stated` schema-required — Task 1. ✓
7. Recommendation 2: reconciliation caveat mirroring the 0.1% tolerance — Task 3. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** `total_stated` named identically in schema, `ExpenditureRollup`, tests, and helpers. `consolidation_factor` used identically in `defaultAssumptions`, `runScenario`, and tests. `runScenario` return shape matches the edited `ScenarioResult` (no `lines`). `GRAIN_KEYS` typed as `keyof ExpenditureRollup` excludes `total_stated`, so `sumGrains` sums only the eight function grains. ✓

**Scope:** Single implementation plan, three source files touched, isolated from tools; site needs no code change. ✓
