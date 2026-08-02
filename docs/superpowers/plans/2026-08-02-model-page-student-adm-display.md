# Model Page Student & ADM Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Under the "Spending and the town" heading on the `/model/` page, show a live, grouped display of the district's student count (entered total and two-year average) and the pupils that grade weights and demographic weights add, ending in the weighted long-term membership the spending is divided among.

**Architecture:** The figures are the membership engine's own `CalcNode`s, not a second calculation. The model package (`computeWeightedMembership`) is extended to expose the grade/demographic split, the three subtotals, and the raw entered headcount as new fields on `MembershipResult`. A thin, pure site helper arranges those nodes into labelled sections; the model-tool island renders them into a grouped definition list beneath the heading, recomputing on every input change exactly like the rest of the tool. Arranging rather than recomputing is what keeps this display from ever drifting away from the "Show the work" walkthrough below it.

**Tech Stack:** TypeScript (ESM, Node ≥22), the `@vt-budget/model` engine package, Astro 7 for the page, Vitest for tests. No new dependencies.

## Global Constraints

- **Never fabricate a figure.** Every displayed value must be a `CalcNode` whose value is `null` (rendered `—` with a status tag) when any input is missing or unverified. Do not compute display numbers by hand or with bare arithmetic on possibly-null form values — build them through the engine's node constructors so blockers and status propagate.
- **Single source of truth.** Do not re-derive band memberships, weights, or averaging in the site layer. All arithmetic lives in `@vt-budget/model`; the site only arranges and renders nodes.
- **Additive weights, per 16 V.S.A. § 4010(d)(6).** Weights add pupils on top of the count; they never multiply the count down. Preserve the existing engine behaviour exactly — the changes here only *expose* intermediate nodes, never change any existing value.
- **Weights unit is `'pupils'`.** Every new node uses unit `'pupils'` and is formatted with the existing `formatValue(value, 'pupils')` (one-decimal).
- **Reuse existing UI primitives:** the `el()` helper, `dl.facts` styling, and the `STATUS_CLASS` / `STATUS_LABEL` maps already in `site/src/scripts/model-tool.ts`. Do not introduce a new status vocabulary.
- **Import style:** intra-package model imports use explicit `.ts` extensions (e.g. `./membership.ts`); site imports from the engine use the bare specifier `@vt-budget/model`.
- **Test commands** run from the repo root: `npm test` (Vitest across all workspaces) and `npm run typecheck` (`tsc --build --force`).

---

### Task 1: Expose the grade/demographic split, subtotals, and entered headcount on `MembershipResult`

The engine already computes every needed quantity inside `computeWeightedMembership`, but folds the weights into one flat `increments` array and never surfaces the pre-average headcount. This task splits the increments into a grade group and a demographic group, adds the three subtotal nodes and the raw entered-headcount node, and returns them. Existing values (`increments` contents and order, `beforeHoldHarmless`, `total`, `longTermMembership`) are unchanged.

**Files:**
- Modify: `model/src/membership.ts` (interface `MembershipResult` at lines 94-103; function body of `computeWeightedMembership` at lines 191-344)
- Test: `model/src/engine.test.ts` (add a new `describe` block; membership tests already live in this file)

**Interfaces:**
- Consumes: existing `computeWeightedMembership(ctx, data)`, the module-local `BANDS` array, and the node helpers `sum`, `input`, `applyWeight` (already imported at line 54).
- Produces: `MembershipResult` gains six read-only fields, all consumed by Task 2:
  - `gradeWeightIncrements: readonly CalcNode[]` — the four § 4010(d)(1) grade-band increments.
  - `demographicWeightIncrements: readonly CalcNode[]` — poverty, English learner, sparsity, and any small-school increments.
  - `gradeWeightTotal: CalcNode` — sum of `gradeWeightIncrements`.
  - `demographicWeightTotal: CalcNode` — sum of `demographicWeightIncrements`.
  - `allWeightsTotal: CalcNode` — sum of every increment (grade + demographic).
  - `enteredHeadcountBothYears: CalcNode` — raw sum of band ADM across the averaged years, before averaging and before State-placed.

- [ ] **Step 1: Write the failing tests**

Add this block to `model/src/engine.test.ts` (after the existing `describe('weighted long-term membership', ...)` block). It reuses the file's existing `DISTRICT` fixture and `syntheticParameters()` import, whose weights make every number hand-checkable.

```ts
describe('membership breakdown for display', () => {
  it('splits grade weights from demographic weights and totals each', () => {
    const ctx = createContext(syntheticParameters());
    const r = computeWeightedMembership(ctx, DISTRICT);

    // Grade increments: prek 15×-0.5=-7.5, K-5 150×0=0, 6-8 80×0.5=40, 9-12 60×1=60.
    expect(r.gradeWeightIncrements).toHaveLength(4);
    expect(r.gradeWeightTotal.value).toBeCloseTo(92.5, 10);

    // Demographic increments: poverty 40×1=40, EL 8×2=16, sparsity 0 (density 120, no band).
    expect(r.demographicWeightTotal.value).toBeCloseTo(56, 10);

    // Grade + demographic equals the existing cumulation of all weights.
    expect(r.allWeightsTotal.value).toBeCloseTo(148.5, 10);
    expect(r.increments).toHaveLength(r.gradeWeightIncrements.length + r.demographicWeightIncrements.length);
  });

  it('sums entered headcount across the averaged years without averaging', () => {
    const ctx = createContext(syntheticParameters());
    const r = computeWeightedMembership(ctx, DISTRICT);
    // (10+100+60+40) + (20+200+100+80) = 210 + 400 = 610; the two-year average
    // (long-term membership, which also adds State-placed) is 310.
    expect(r.enteredHeadcountBothYears.value).toBe(610);
    expect(r.longTermMembership.value).toBe(310);
  });

  it('leaves the entered headcount blank when a year's band is missing', () => {
    const ctx = createContext(syntheticParameters());
    const r = computeWeightedMembership(ctx, {
      ...DISTRICT,
      adm_years: DISTRICT.adm_years.map((y, i) =>
        i === 0 ? { ...y, grades_9_through_12: null } : y,
      ),
    });
    expect(r.enteredHeadcountBothYears.value).toBeNull();
    expect(r.enteredHeadcountBothYears.status).toBe('missing_input');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- engine.test.ts`
Expected: FAIL — `gradeWeightIncrements`, `gradeWeightTotal`, `demographicWeightTotal`, `allWeightsTotal`, and `enteredHeadcountBothYears` do not exist on the result (TypeScript error and/or runtime `undefined`).

- [ ] **Step 3: Extend the `MembershipResult` interface**

In `model/src/membership.ts`, replace the interface (currently lines 94-103):

```ts
export interface MembershipResult {
  readonly longTermMembership: CalcNode;
  /** Each statutory weight, expressed as the pupils it adds. */
  readonly increments: readonly CalcNode[];
  /** The four § 4010(d)(1) grade-band increments: prek, K-5, 6-8, 9-12. */
  readonly gradeWeightIncrements: readonly CalcNode[];
  /** The remaining § 4010(d) weights: poverty, English learner, sparsity, small school. */
  readonly demographicWeightIncrements: readonly CalcNode[];
  /** Sum of the grade-band increments — extra pupils from grade weights. */
  readonly gradeWeightTotal: CalcNode;
  /** Sum of the demographic/district increments — extra pupils from those weights. */
  readonly demographicWeightTotal: CalcNode;
  /** Sum of every weight increment (grade + demographic). */
  readonly allWeightsTotal: CalcNode;
  /**
   * The plain student count entered across the averaged years, before averaging
   * and before State-placed students are added. Shown on the site so a reader
   * can see the two-year average halve it; not a statutory quantity itself.
   */
  readonly enteredHeadcountBothYears: CalcNode;
  /** Before the § 4010(e) floor. Equal to `total` in years the floor is off. */
  readonly beforeHoldHarmless: CalcNode;
  /** The § 4010(e) floor, or null in years it does not apply. */
  readonly holdHarmlessFloor: CalcNode | null;
  readonly total: CalcNode;
}
```

- [ ] **Step 4: Split the increments into grade and demographic groups**

In `computeWeightedMembership`, replace the entire weights section (currently lines 219-330, from the comment `// --- Weights, § 4010(d).` down to and including the small-school `else if` block, ending just before the `// --- § 4010(d)(6)` comment) with the following. This is the same arithmetic and the same node order; it only accumulates into two arrays instead of one, then concatenates them so `increments` is byte-for-byte the previous sequence (grade bands, poverty, English learner, sparsity, small school).

```ts
  // --- Weights, § 4010(d). Every one is an ADDITIONAL amount. --------------
  // Grade-band weights, § 4010(d)(1), kept as their own group so the site can
  // show grade weighting apart from the demographic and district weights.
  const gradeWeightIncrements: CalcNode[] = [];
  for (const band of BANDS) {
    const membership = bandMemberships.get(band.key);
    if (!membership) continue;
    gradeWeightIncrements.push(
      applyWeight(ctx, `Additional weighting for ${band.label}`, membership, band.weight, 'pupils'),
    );
  }

  // Everything else § 4010(d) adds: poverty, English learner, sparsity, small school.
  const demographicWeightIncrements: CalcNode[] = [];

  demographicWeightIncrements.push(
    applyWeight(
      ctx,
      'Additional weighting for pupils at or below 185 percent of the federal poverty level',
      input(
        ctx,
        'Pupils whose family is at or below 185 percent of FPL',
        data.poverty_185_fpl,
        'pupils',
        { source: data.source },
      ),
      'weights.poverty_185_fpl',
      'pupils',
    ),
  );

  demographicWeightIncrements.push(
    applyWeight(
      ctx,
      'Additional weighting for English learner pupils',
      input(ctx, 'English learner pupils', data.english_learners, 'pupils', { source: data.source }),
      'weights.english_learner',
      'pupils',
    ),
  );

  // Sparsity applies to every pupil in a qualifying district, not a subset.
  const density = input(
    ctx,
    'Persons per square mile in the district',
    data.persons_per_square_mile,
    'count',
    { source: data.source },
  );
  const band = sparsityBand(data.persons_per_square_mile);
  if (band) {
    demographicWeightIncrements.push(
      applyWeight(ctx, 'Additional weighting for low population density', longTermMembership, band, 'pupils'),
    );
  } else {
    demographicWeightIncrements.push(
      input(
        ctx,
        'Additional weighting for low population density',
        data.persons_per_square_mile === null ? null : 0,
        'pupils',
        {
          source: 'computed from district population density',
          notes:
            data.persons_per_square_mile === null
              ? ['District population density was not supplied, so the sparsity weight cannot be determined.']
              : ['This district is at or above 100 persons per square mile, so no sparsity weight applies.'],
        },
      ),
    );
  }

  // Small schools, gated on the district's density, § 4010(d)(5).
  const ceiling = parameterNode(ctx, 'weights.small_school.density_ceiling', 'count');
  const eligibleForSmallSchool =
    ceiling.value !== null && data.persons_per_square_mile !== null
      ? data.persons_per_square_mile <= ceiling.value
      : null;

  if (eligibleForSmallSchool === true) {
    for (const school of data.small_schools) {
      const tier = smallSchoolTier(school.average_two_year_enrollment);
      if (!tier) continue;
      demographicWeightIncrements.push(
        applyWeight(
          ctx,
          `Additional weighting for the small school ${school.name}`,
          input(
            ctx,
            `${school.name} average two-year enrollment`,
            school.average_two_year_enrollment,
            'pupils',
            { source: data.source },
          ),
          tier,
          'pupils',
        ),
      );
    }
  } else if (eligibleForSmallSchool === null) {
    demographicWeightIncrements.push(
      input(ctx, 'Additional weighting for small schools', null, 'pupils', {
        notes: [
          'District population density was not supplied, so small school eligibility ' +
            'cannot be determined. The weight applies only where the district has 55 or ' +
            'fewer persons per square mile.',
        ],
      }),
    );
  }

  const increments = [...gradeWeightIncrements, ...demographicWeightIncrements];
```

> Note: `const density = ...` is unused here and was unused in the original too — preserve it verbatim so this task changes no behaviour and no lint outcome.

- [ ] **Step 5: Add the entered-headcount node and the three subtotals, and return them**

The `// --- § 4010(d)(6)` block (`const beforeHoldHarmless = sum(...)`), the `applyHoldHarmless` call, and the `return` statement currently occupy lines 332-343. Replace the `return` statement (currently line 343) with the block below, and immediately *above* the existing `const beforeHoldHarmless = sum(...)` line, insert the entered-headcount computation:

Insert above `const beforeHoldHarmless = sum(` :

```ts
  // The plain count entered across the averaged years, before averaging. Uses
  // the same averaging window the bands do, so the site can show the two-year
  // average halving it. Built from input nodes so a missing band blanks it.
  const windowParam = ctx.parameters.parameters.get('membership.long_term_membership_years');
  const declaredWindow = typeof windowParam?.value === 'number' ? windowParam.value : null;
  const windowYears = data.adm_years.slice(-Math.max(1, declaredWindow ?? data.adm_years.length));
  const enteredHeadcountBothYears = sum(
    ctx,
    'Students entered across the averaged years',
    windowYears.flatMap((y) =>
      BANDS.map((b) => input(ctx, `FY${y.fiscal_year} ${b.label}`, y[b.key], 'pupils', { source: data.source })),
    ),
    'pupils',
  );
```

Replace the `return` statement with:

```ts
  const gradeWeightTotal = sum(ctx, 'Extra pupils from grade weights', gradeWeightIncrements, 'pupils');
  const demographicWeightTotal = sum(ctx, 'Extra pupils from demographic weights', demographicWeightIncrements, 'pupils');
  const allWeightsTotal = sum(ctx, 'Extra pupils from all weights', increments, 'pupils');

  return {
    longTermMembership,
    increments,
    gradeWeightIncrements,
    demographicWeightIncrements,
    gradeWeightTotal,
    demographicWeightTotal,
    allWeightsTotal,
    enteredHeadcountBothYears,
    beforeHoldHarmless,
    holdHarmlessFloor: floor,
    total,
  };
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- engine.test.ts`
Expected: PASS — the new `describe('membership breakdown for display')` block passes and every pre-existing membership test still passes (values unchanged).

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add model/src/membership.ts model/src/engine.test.ts
git commit -m "feat(model): expose grade/demographic weight split and entered headcount"
```

---

### Task 2: Pure site helper that arranges the membership nodes into display sections

A small, DOM-free function maps a `MembershipResult` into the three sections the reader asked for: student counts, weights, and the grand total. Keeping it pure (following the `statewide-average.ts` pattern already in this directory) lets it be tested without a browser and keeps the ordering/labelling decision out of the render glue.

**Files:**
- Create: `site/src/scripts/student-summary.ts`
- Test: `site/src/scripts/student-summary.test.ts`

**Interfaces:**
- Consumes: `MembershipResult` and `CalcNode` types from `@vt-budget/model` (specifically the fields added in Task 1: `enteredHeadcountBothYears`, `longTermMembership`, `gradeWeightTotal`, `demographicWeightTotal`, `allWeightsTotal`, `beforeHoldHarmless`).
- Produces: `studentSummarySections(m: MembershipResult): SummarySection[]`, where `SummarySection = { heading: string; rows: readonly SummaryRow[] }` and `SummaryRow = { label: string; node: CalcNode }`. Consumed by Task 3's renderer.

- [ ] **Step 1: Write the failing test**

Create `site/src/scripts/student-summary.test.ts`:

```ts
/**
 * The grouping is a display decision, so it is a tested one: the reader asked
 * for the entered and averaged student counts, then grade weights, demographic
 * weights, their total, and the everything-added-up total, in that order.
 */

import { describe, expect, it } from 'vitest';

import type { CalcNode, MembershipResult } from '@vt-budget/model';

import { studentSummarySections } from './student-summary.ts';

// A stub node is enough: the helper only reads and re-exposes nodes by identity,
// it does no arithmetic. The distinct values make each row identifiable.
const node = (value: number): CalcNode => ({ value, unit: 'pupils', status: 'ok' }) as unknown as CalcNode;

const membership = {
  enteredHeadcountBothYears: node(610),
  longTermMembership: node(310),
  gradeWeightTotal: node(92.5),
  demographicWeightTotal: node(56),
  allWeightsTotal: node(148.5),
  beforeHoldHarmless: node(458.5),
} as unknown as MembershipResult;

describe('studentSummarySections', () => {
  it('groups the figures into students, weights, and total', () => {
    const sections = studentSummarySections(membership);
    expect(sections.map((s) => s.heading)).toEqual([
      'Students',
      'Extra pupils added by weights',
      'Total',
    ]);
  });

  it('places each figure in the right row, in order', () => {
    const rows = studentSummarySections(membership).flatMap((s) => s.rows);
    expect(rows.map((r) => r.node.value)).toEqual([610, 310, 92.5, 56, 148.5, 458.5]);
  });

  it('shows both the entered and the averaged student counts', () => {
    const [students] = studentSummarySections(membership);
    expect(students!.rows).toHaveLength(2);
    expect(students!.rows[0]!.node.value).toBe(610);
    expect(students!.rows[1]!.node.value).toBe(310);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- student-summary.test.ts`
Expected: FAIL — cannot resolve `./student-summary.ts` (module does not exist).

- [ ] **Step 3: Write the helper**

Create `site/src/scripts/student-summary.ts`:

```ts
/**
 * The grouped student/ADM figures shown under "Spending and the town".
 *
 * These are the membership engine's own nodes, arranged into the sections a
 * reader asked to see: how many students (as entered, and as the two-year
 * average the formula uses), how many extra pupils each family of weights adds,
 * and the weighted total the spending is divided among. Arranging the engine's
 * nodes rather than recomputing anything is what keeps this display from ever
 * drifting away from the "Show the work" walkthrough below it.
 */

import type { CalcNode, MembershipResult } from '@vt-budget/model';

export interface SummaryRow {
  readonly label: string;
  readonly node: CalcNode;
}

export interface SummarySection {
  readonly heading: string;
  readonly rows: readonly SummaryRow[];
}

export function studentSummarySections(m: MembershipResult): SummarySection[] {
  return [
    {
      heading: 'Students',
      rows: [
        { label: 'Both years added together', node: m.enteredHeadcountBothYears },
        { label: 'Two-year average (the count the formula uses)', node: m.longTermMembership },
      ],
    },
    {
      heading: 'Extra pupils added by weights',
      rows: [
        { label: 'Grade weights', node: m.gradeWeightTotal },
        {
          label: 'Demographic weights (poverty, English learner, sparsity, small school)',
          node: m.demographicWeightTotal,
        },
        { label: 'All weights together', node: m.allWeightsTotal },
      ],
    },
    {
      heading: 'Total',
      rows: [{ label: 'Everything added up (weighted long-term membership)', node: m.beforeHoldHarmless }],
    },
  ];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- student-summary.test.ts`
Expected: PASS — all three cases green.

- [ ] **Step 5: Commit**

```bash
git add site/src/scripts/student-summary.ts site/src/scripts/student-summary.test.ts
git commit -m "feat(site): pure helper arranging membership nodes into display sections"
```

---

### Task 3: Render the display under "Spending and the town" and wire it into the tool

Add the container to the page, a renderer to the island that turns each section into a `dl.facts` block with the tool's existing status tags, and call it on every recompute so the figures track the form live.

**Files:**
- Modify: `site/src/pages/model/index.astro` (heading block at lines 131-141)
- Modify: `site/src/scripts/model-tool.ts` (imports at lines 28-44; `initModelTool` element lookups ~lines 405-414; `recompute` body ~lines 437-536)
- Modify: `site/src/styles/global.css` (after the `dl.facts` rules, lines 629-642)

**Interfaces:**
- Consumes: `studentSummarySections` and `SummarySection` from `./student-summary.ts` (Task 2); the extended `MembershipResult` (Task 1); the existing island primitives `el`, `formatValue`, `STATUS_CLASS`, `STATUS_LABEL`.
- Produces: no exported surface — a rendered `#student-summary` region on the page.

- [ ] **Step 1: Add the container to the page**

In `site/src/pages/model/index.astro`, the block at lines 131-132 is:

```astro
    <h2>Spending and the town</h2>
    <div class="controls">
```

Replace those two lines with:

```astro
    <h2>Spending and the town</h2>
    <p>
      Before the spending below is turned into a tax rate, it is spread across the district's
      students — first counted, then weighted. Here is that count, built live from the numbers above.
    </p>
    <div id="student-summary"></div>
    <div class="controls">
```

- [ ] **Step 2: Import the helper and the type in the island**

In `site/src/scripts/model-tool.ts`, add `type MembershipResult` to the existing `@vt-budget/model` import list (the block at lines 28-42), i.e. add the line `  type MembershipResult,` alongside the other `type` imports. Then, immediately below the existing `import { nextStatewideAverage } from './statewide-average.ts';` (line 44), add:

```ts
import { studentSummarySections } from './student-summary.ts';
```

- [ ] **Step 3: Add the renderer**

In `site/src/scripts/model-tool.ts`, add this function in the "Rendering" section (e.g. immediately after `renderAssumptions`, before the "Wiring" divider at line 387):

```ts
function renderStudentSummary(membership: MembershipResult, container: HTMLElement): void {
  container.replaceChildren();
  for (const section of studentSummarySections(membership)) {
    container.append(el('h3', 'student-summary-heading', section.heading));
    const dl = el('dl', 'facts');
    for (const row of section.rows) {
      dl.append(el('dt', undefined, row.label));
      const dd = el('dd');
      dd.append(document.createTextNode(formatValue(row.node.value, row.node.unit) + ' '));
      dd.append(el('span', `tag ${STATUS_CLASS[row.node.status]}`, STATUS_LABEL[row.node.status]));
      dl.append(dd);
    }
    container.append(dl);
  }
}
```

- [ ] **Step 4: Look up the container and render it on every recompute**

In `initModelTool`, alongside the other `document.getElementById` calls (lines 407-412), add:

```ts
  const studentSummary = document.getElementById('student-summary');
```

Do **not** add it to the `if (!walkthrough || ...) return;` guard at line 414 — it is optional, so a page without the container still works.

In `recompute`, the early return for an empty parameter set (lines 453-457) currently reads:

```ts
    if (parameters.parameters.size === 0) {
      walkthrough.replaceChildren();
      summary.textContent = 'No parameter file is available to compute with.';
      return;
    }
```

Add a clear of the container there so it never shows stale figures:

```ts
    if (parameters.parameters.size === 0) {
      walkthrough.replaceChildren();
      if (studentSummary) studentSummary.replaceChildren();
      summary.textContent = 'No parameter file is available to compute with.';
      return;
    }
```

Then, immediately after the `const membership = computeWeightedMembership(ctx, { ... });` call completes (after line 493, before `const spending = input(...)`), add:

```ts
    if (studentSummary) renderStudentSummary(membership, studentSummary);
```

- [ ] **Step 5: Style the section headings**

In `site/src/styles/global.css`, immediately after the `dl.facts dd { ... }` rule (ends at line 642), add:

```css
.student-summary-heading {
  margin: 1.5rem 0 0;
  font-size: 1rem;
  color: var(--text);
}
#student-summary dl.facts {
  margin-top: 0.5rem;
}
```

- [ ] **Step 6: Typecheck and run the full suite**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm test`
Expected: PASS — all workspaces, including the two new test files.

- [ ] **Step 7: Verify in the browser**

Start the dev server (the `site-dev-verify` launch config, port 4399):

1. `preview_start` with `{ name: "site-dev-verify" }`. If the page errors on `../../generated/parameters.json`, run `npm run build:data` first, then start again.
2. `navigate` to `http://localhost:4399/model/`.
3. In the mode picker choose **"Example (not real Vermont law)"** — the example set has complete synthetic weights, so every figure computes to a real number.
4. `read_page` and confirm a "Students / Extra pupils added by weights / Total" block appears under the "Spending and the town" heading, with two student rows, three weight rows, and a grand-total row, each showing a `pupils` value and a `computed` status tag.
5. Change one of the "FY2026 students by grade" inputs (e.g. `#k5-2`) via `form_input`, then `read_page` again and confirm the "Both years added together", "Two-year average", and totals update.
6. Clear a grade field to empty and confirm the affected figures show `—` with a `blocked` tag rather than a fabricated number.
7. `computer { action: "screenshot" }` to capture the working display for the review.

- [ ] **Step 8: Commit**

```bash
git add site/src/pages/model/index.astro site/src/scripts/model-tool.ts site/src/styles/global.css
git commit -m "feat(site): show student count and weighted ADM under Spending and the town"
```

---

## Self-Review

**1. Spec coverage** (against the user's answers):
- "Total number of students … both the years summed together, and the average" → `enteredHeadcountBothYears` (Task 1) and `longTermMembership`, both in the "Students" section (Task 2, Task 3). ✓
- "Awarded ADM based on grade weights" → `gradeWeightTotal` row (Task 1/2/3). ✓
- "The other weights grouped together as demographic weights" → `demographicWeightTotal`, labelled with its members (Task 1/2/3). ✓
- "A total for the weights" → `allWeightsTotal` ("All weights together"). ✓
- "A total for everything added up" → `beforeHoldHarmless` ("Everything added up (weighted long-term membership)"). ✓
- "Two summary figures" layout (not a per-grade table) → grouped `dl.facts` of summary rows, no per-band breakdown. ✓
- "Under the heading 'Spending and the town'" → container inserted directly beneath that `<h2>` (Task 3, Step 1). ✓

**2. Placeholder scan:** No TBD/TODO/"add error handling"/"similar to Task N". Every code step carries full code. Missing-input behaviour is exercised by real test cases, not hand-waved. ✓

**3. Type consistency:**
- `studentSummarySections` / `SummarySection` / `SummaryRow` named identically in Task 2 (definition), Task 2's test, and Task 3 (consumption). ✓
- Field names on `MembershipResult` — `gradeWeightIncrements`, `demographicWeightIncrements`, `gradeWeightTotal`, `demographicWeightTotal`, `allWeightsTotal`, `enteredHeadcountBothYears` — are identical in Task 1's interface, Task 1's tests, and Task 2's helper. ✓
- `renderStudentSummary(membership: MembershipResult, container: HTMLElement)` uses `MembershipResult`, imported as a type in Task 3, Step 2. ✓
- Node unit is `'pupils'` everywhere; `formatValue`, `STATUS_CLASS`, `STATUS_LABEL`, and `el` are the existing island exports/locals. ✓

**Risk notes for the executor:**
- Adding fields to `MembershipResult` is backward-compatible; the only consumers are `engine.test.ts` and `model-tool.ts` (confirmed via grep), neither of which breaks. Goldens assert node *values*, never node *ids*, so the extra nodes are safe.
- `increments` content and order are preserved exactly (grade group concatenated before demographic group, same order as before), so `beforeHoldHarmless`, `total`, and every golden value are unchanged.
