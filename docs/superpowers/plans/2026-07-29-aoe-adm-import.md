# AOE ADM Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import AOE's published Average Daily Membership series into the warehouse as a labeled state-published series, joined to the registry and rolled up to districts without silent data loss.

**Architecture:** A human downloads spreadsheets into `intake/aoe-adm/fy<YEAR>/` (the host returns 403 to all scripts); everything after that is automated and tested. Pure functions handle each concern — read, year-label, parse, join, classify, aggregate — and only the CLI touches disk. Town-level transcriptions are committed to `warehouse/`; the district rollup is derived at build time and never committed.

**Tech Stack:** TypeScript (ESM, `verbatimModuleSyntax`), Node ≥ 22, `tsx` as runner, `vitest` for tests, `ajv` for schema validation, `yaml` for serialization, `read-excel-file` for spreadsheet parsing (gated in Task 4).

## Global Constraints

- **Read the spec first:** `docs/superpowers/specs/2026-07-29-aoe-adm-import-design.md`. It contains the evidence behind every rule below.
- Node ≥ 22. ESM only. Relative imports **include the `.ts` extension** (`./paths.ts`) — `verbatimModuleSyntax` is on.
- Tests are colocated as `*.test.ts` under `model/` or `tools/`. `vitest.config.ts` only includes `model/**/*.test.ts` and `tools/**/*.test.ts`.
- Run all tests with `npm test`. Typecheck with `npm run typecheck`. Validate data with `npm run validate`.
- **Join towns on `aoe_org_id` only, never on name.** 15 of 254 rows have cosmetically different names.
- **ADM values round to exactly 2 decimals at ingest.** Raw XML carries float artifacts (`79.509999999999991` is `79.51`).
- **Year invariants:** `fiscal_year == adm_label + 2000` and `count_year_start == fiscal_year - 2`. Both hold for all 10 published years.
- **Never coerce grade bands between regimes.** ADM-24 is `K-6 / 7-12`; ADM-25 is `K-5 / 6-8 / 9-12`. Grade 6 and grades 7–8 fall on opposite sides. Not reducible.
- **`prekindergarten` is `null`, never `0`.** No AOE resident-district report publishes it.
- **No new dependencies** beyond `read-excel-file` (Task 4).
- **Nothing derived is committed.** `build/`, `site/public/data/`, `site/src/generated/` are gitignored.
- Baseline before you start: `npm run validate` reports **0 errors, 3 warnings** (pre-existing `parameters-unverified` on fy2025/fy2026/fy2027). Do not "fix" those warnings.

## File Structure

**Task 1 — registry repair (commit 1)**
- Modify: `tools/src/registry/placeholder.ts` — add structural 900-range rule; change `isReportingBucket` signature.
- Modify: `tools/src/registry/sync.ts:204` — pass `{ id, name }`.
- Modify: `tools/src/registry/placeholder.test.ts` — new cases.
- Regenerate: `registry/entities/town.json` via offline snapshot rebuild.

**Tasks 2–3 — site typecheck repair (commit 2)**
- Create: `site/tsconfig.json` — project reference so `site/` is typechecked.
- Modify: `tsconfig.json` — add `./site` reference.
- Modify: `site/src/scripts/model-tool.ts:311-332` — current `MembershipInput` shape.
- Modify: `site/src/pages/model/index.astro:62-106` — form inputs matching the new fields.

**Tasks 4–13 — the import (commit 3)**
- Create: `tools/src/aoe/adm/xlsx.ts` — thin adapter over `read-excel-file`; the only module aware of the library.
- Create: `tools/src/aoe/adm/year.ts` — year labels and invariants.
- Create: `tools/src/aoe/adm/parse.ts` — header-shape recognition, band regimes, rows.
- Create: `tools/src/aoe/adm/join.ts` — town code → registry slug.
- Create: `tools/src/aoe/adm/classify.ts` — the six-class town taxonomy.
- Create: `tools/src/aoe/adm/aggregate.ts` — town → district rollup + conservation invariant.
- Create: `tools/src/aoe/adm/gaps.ts` — § 4010 gap register.
- Create: `tools/src/aoe/adm/discover.ts` — link discovery from a saved page snapshot.
- Create: `tools/src/cli/adm-import.ts` — the CLI.
- Create: `schemas/adm-1.0.schema.json`, `schemas/aoe-source-1.0.schema.json`.
- Modify: `tools/src/validate/schemas.ts` — register both schemas.
- Modify: `tools/src/validate/rules.ts` — `source/` prefix exemption.
- Modify: `tools/src/cli/validate.ts` — discriminate the warehouse walk.
- Modify: `schemas/common-1.0.schema.json` — `source/` prefix in `entity_ref`.
- Modify: `tools/src/cli/build-data.ts` — emit `adm.json`.
- Modify: `package.json` — `adm:import` script, `read-excel-file` dependency.

Each `*.ts` above gets a colocated `*.test.ts`.

---

## Phase 1 — Registry repair

### Task 1: 900-range records are residency reporting buckets

**Why:** `isReportingBucket` matches whole normalized names against a set containing `out of state` and `other`. The six AOE residency buckets are compounds (`Other State -Massachusetts`, `Other Out of Country`), so none match, and all six carry `reporting_only: false` despite being the same class as `T000 UNKNOWN`. A structural org-ID rule is robust where name matching is not. `T999 ORFORD NH` must **not** match — it is a real town in the Rivendell Interstate district.

**Files:**
- Modify: `tools/src/registry/placeholder.ts:157-160`
- Modify: `tools/src/registry/sync.ts:204`
- Test: `tools/src/registry/placeholder.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `isReportingBucket(record: { readonly id: string | null; readonly name: string | null }): boolean` — **signature change**, was `(name: string | null)`. Task 7 (`classify.ts`) calls it.

- [ ] **Step 1: Write the failing tests**

Append to `tools/src/registry/placeholder.test.ts`:

```ts
describe('residency reporting buckets are identified structurally', () => {
  // AOE records out-of-state and out-of-country residency as bare-numeric town
  // codes in the 900 range. They are not places and are awarded no ADM. Name
  // matching misses them because their names are compounds.
  const RESIDENCY_BUCKETS: ReadonlyArray<readonly [string, string]> = [
    ['901', 'Other State -Massachusetts'],
    ['902', 'Other State -New Hampshire'],
    ['903', 'Other State -New York'],
    ['904', 'Other Country -Quebec, Canada'],
    ['905', 'Other Out of State'],
    ['906', 'Other Out of Country'],
  ];

  it('flags every bare-numeric 900-range record', () => {
    for (const [id, name] of RESIDENCY_BUCKETS) {
      expect(isReportingBucket({ id, name }), `${id} ${name}`).toBe(true);
    }
  });

  it('does not flag Orford NH, which is a real interstate member town', () => {
    // T999 is a real New Hampshire town and a member of the Rivendell
    // Interstate district. It earns no Vermont ADM because it has no Vermont
    // operating district -- not because it is a bucket. Flagging it would
    // corrupt the interstate district's structure.
    expect(isReportingBucket({ id: 'T999', name: 'ORFORD NH' })).toBe(false);
  });

  it('does not flag T-prefixed towns whose digits fall in the 900 range', () => {
    expect(isReportingBucket({ id: 'T900', name: 'SOMEWHERE' })).toBe(false);
    expect(isReportingBucket({ id: 'T901', name: 'SOMEWHERE ELSE' })).toBe(false);
  });

  it('does not flag other bare-numeric codes outside the 900 range', () => {
    expect(isReportingBucket({ id: '101', name: 'A Real Place' })).toBe(false);
    expect(isReportingBucket({ id: '9001', name: 'Four Digits' })).toBe(false);
  });

  it('still flags name-based buckets, with or without an id', () => {
    expect(isReportingBucket({ id: 'T000', name: 'UNKNOWN' })).toBe(true);
    expect(isReportingBucket({ id: null, name: 'Unassigned' })).toBe(true);
  });

  it('still does not flag real towns', () => {
    expect(isReportingBucket({ id: 'T027', name: 'BRATTLEBORO' })).toBe(false);
    expect(isReportingBucket({ id: 'T037', name: 'BURLINGTON' })).toBe(false);
  });
});
```

Then update the two pre-existing `isReportingBucket` call sites in the same file (currently around lines 66 and 72) from `isReportingBucket(name)` to `isReportingBucket({ id: 'T300', name })`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tools/src/registry/placeholder.test.ts`
Expected: FAIL — TypeScript/argument errors, and the 900-range assertions returning `false`.

- [ ] **Step 3: Implement the structural rule**

In `tools/src/registry/placeholder.ts`, add after `PLACEHOLDER_ID_PREFIX`:

```ts
/**
 * Bare-numeric org IDs in the 900 range: AOE's out-of-state and out-of-country
 * residency buckets.
 *
 * Structural rather than name-based, because the names are compounds -- "Other
 * State -Massachusetts", "Other Out of Country" -- that no whole-name match
 * catches. Real Vermont towns are T-prefixed (T001-T263), and these six are the
 * only bare-numeric org IDs anywhere in the registry, checked across all nine
 * entity files.
 *
 * Deliberately anchored and exactly three digits. T999 ORFORD NH must not match:
 * it is a real New Hampshire town and a real member of the Rivendell Interstate
 * district, which earns no Vermont ADM because it has no Vermont operating
 * district, not because it is a bucket.
 */
const RESIDENCY_BUCKET_ID = /^9\d\d$/;
```

Then replace `isReportingBucket` entirely:

```ts
export function isReportingBucket(record: {
  readonly id: string | null;
  readonly name: string | null;
}): boolean {
  if (record.id !== null && RESIDENCY_BUCKET_ID.test(record.id.trim())) return true;
  if (!record.name) return false;
  return REPORTING_BUCKET_NAMES.has(normalizeName(record.name));
}
```

Update its doc comment's first line to mention both routes. In `tools/src/registry/sync.ts:204`, change:

```ts
      reporting_only: isReportingBucket(name),
```

to:

```ts
      reporting_only: isReportingBucket({ id, name }),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tools/src/registry/placeholder.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no output (success). If it fails, a call site still passes a bare string.

- [ ] **Step 6: Regenerate the registry offline**

Run: `npm run registry:sync -- --from 2026-07-29`

This rebuilds from the committed snapshot in `registry/raw/2026-07-29` with **no network**, so the diff is deterministic.

- [ ] **Step 7: Verify exactly the intended records changed**

Run:

```bash
git diff --stat registry/
git diff registry/entities/town.json | grep -E '^[+-].*(reporting_only|"name"|aoe_org_id)' | head -40
```

Expected: `reporting_only` flips `false` → `true` for exactly `901`, `902`, `903`, `904`, `905`, `906`. `T000 UNKNOWN` stays `true`. `T999 ORFORD NH` stays `false`. Confirm the six also left any `member_towns` lists:

```bash
node -e "
const r=JSON.parse(require('fs').readFileSync('registry/entities/town.json','utf8')).records;
const b=r.filter(x=>/^9\d\d\$/.test(String(x.aoe_org_id)));
console.log('buckets flagged:', b.every(x=>x.reporting_only), b.length);
console.log('orford:', r.find(x=>x.aoe_org_id==='T999').reporting_only);
"
```

Expected: `buckets flagged: true 6` and `orford: false`.

- [ ] **Step 8: Validate**

Run: `npm run validate`
Expected: `0 error(s), 3 warning(s)` — the same three pre-existing parameter warnings.

- [ ] **Step 9: Commit**

```bash
git add tools/src/registry/placeholder.ts tools/src/registry/placeholder.test.ts \
        tools/src/registry/sync.ts registry/
git commit -m "Identify AOE residency buckets by org ID, not by name

The six bare-numeric 900-range town records are how AOE reports out-of-state and
out-of-country residency. They are not places and are awarded no ADM, but
isReportingBucket matched whole normalized names against a set holding 'other'
and 'out of state', and every one of these names is a compound -- 'Other State
-Massachusetts', 'Other Out of Country' -- so none matched and all six carried
reporting_only: false.

The rule is now structural. Real Vermont towns are T-prefixed and these six are
the only bare-numeric org IDs in the registry, so an anchored three-digit 900
pattern is both sufficient and conservative. T999 ORFORD NH deliberately does not
match: it is a real New Hampshire town and a real member of the Rivendell
Interstate district, and it earns no Vermont ADM because it has no Vermont
operating district rather than because it is a bucket."
```

---

## Phase 2 — Site typecheck repair

### Task 2: Bring `site/` into typecheck

**Why:** `tsconfig.json` references only `./model` and `./tools`, and there is no `site/tsconfig.json`, so `npm run typecheck` never looks at `site/`. That is how `model-tool.ts` drifted onto the pre-Act-127 `MembershipInput` shape without anything failing. This task adds the coverage; Task 3 fixes what it exposes.

`astro check` is deliberately **not** used: it requires installing `@astrojs/check` and prompts interactively. A plain project reference needs no new dependency and covers `.ts` files, which is where the drift is.

**Files:**
- Create: `site/tsconfig.json`
- Modify: `tsconfig.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm run typecheck` now fails on `site/src/**/*.ts` type errors.

- [ ] **Step 1: Read the existing config to match its conventions**

Run: `cat tsconfig.base.json tsconfig.json model/tsconfig.json`

- [ ] **Step 2: Create `site/tsconfig.json`**

```jsonc
{
  // site/ was outside typecheck until now, which let model-tool.ts drift onto a
  // MembershipInput shape the model had already changed. Only .ts is covered --
  // .astro needs @astrojs/check, which is a separate decision.
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "dist/types",
    "rootDir": "src",
    "noEmit": false,
    "emitDeclarationOnly": true,
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/generated/**"],
  "references": [{ "path": "../model" }]
}
```

- [ ] **Step 3: Add the root reference**

`tsconfig.json` becomes:

```json
{
  "files": [],
  "references": [{ "path": "./model" }, { "path": "./tools" }, { "path": "./site" }]
}
```

- [ ] **Step 4: Run typecheck and capture the exposed errors**

Run: `npm run typecheck 2>&1 | tee /tmp/site-typecheck.txt`
Expected: **FAIL**, with errors in `site/src/scripts/model-tool.ts` around the `computeWeightedMembership` call — unknown properties `prek`, `elementary`, `secondary`, `economically_deprived`, `sparsity_eligible`, `small_school_eligible`, and missing required properties. This failure is the point of the task; do not fix it here.

- [ ] **Step 5: Add `site/dist/types` to gitignore**

Append to `.gitignore` under the existing build-output block:

```
site/dist/types/
```

- [ ] **Step 6: Commit the coverage, with the failure documented**

```bash
git add site/tsconfig.json tsconfig.json .gitignore
git commit -m "Bring site/ into typecheck, exposing the model-tool drift

The root tsconfig referenced model and tools only, and site/ had no tsconfig at
all, so npm run typecheck never looked at it. That is how model-tool.ts came to
call computeWeightedMembership with the shape MembershipInput had before commits
27ac20c and c240af0 corrected it, without anything failing.

Typecheck now fails on site/src/scripts/model-tool.ts. That is intended and is
fixed in the next commit; splitting them keeps the mechanical config change
reviewable apart from the substantive one.

astro check is not used here: it needs @astrojs/check installed and prompts
interactively. A project reference needs no new dependency and covers the .ts
files where the drift actually is."
```

---

### Task 3: Fix `model-tool.ts` and the model form to the current `MembershipInput`

**Why:** Every field the ADM import populates is a field the site currently gets wrong, so the import has no correct consumer until this is fixed. The form must change too: `sparsity_eligible`/`small_school_eligible` booleans became a density number and a small-school list, and three grade inputs became four.

**Files:**
- Modify: `site/src/scripts/model-tool.ts:311-332`
- Modify: `site/src/pages/model/index.astro:62-106`
- Test: `model/src/membership.test.ts` is unaffected; verification is `npm run typecheck` plus a manual page check.

**Interfaces:**
- Consumes: `MembershipInput`, `AdmYear`, `SmallSchool` from `@vt-budget/model` — see `model/src/membership.ts:55-80`:
  - `AdmYear`: `{ fiscal_year: number; prekindergarten: number | null; kindergarten_through_5: number | null; grades_6_through_8: number | null; grades_9_through_12: number | null }`
  - `SmallSchool`: `{ name: string; average_two_year_enrollment: number | null }`
  - `MembershipInput`: `{ entity, adm_years, state_placed_fte, poverty_185_fpl, english_learners, persons_per_square_mile, small_schools, source }`
- Produces: a site that typechecks.

- [ ] **Step 1: Replace the grade and eligibility inputs in the Astro form**

In `site/src/pages/model/index.astro`, replace the block currently spanning the `prek-1` … `small-school` inputs (lines ~62-106) with:

```astro
        <label for="prek-1">FY2025 prekindergarten</label>
        <input id="prek-1" type="number" min="0" step="0.01" value="10" />

        <label for="k5-1">FY2025 kindergarten through grade 5</label>
        <input id="k5-1" type="number" min="0" step="0.01" value="100" />

        <label for="g68-1">FY2025 grades 6 through 8</label>
        <input id="g68-1" type="number" min="0" step="0.01" value="50" />

        <label for="g912-1">FY2025 grades 9 through 12</label>
        <input id="g912-1" type="number" min="0" step="0.01" value="50" />

        <label for="prek-2">FY2026 prekindergarten</label>
        <input id="prek-2" type="number" min="0" step="0.01" value="20" />

        <label for="k5-2">FY2026 kindergarten through grade 5</label>
        <input id="k5-2" type="number" min="0" step="0.01" value="200" />

        <label for="g68-2">FY2026 grades 6 through 8</label>
        <input id="g68-2" type="number" min="0" step="0.01" value="100" />

        <label for="g912-2">FY2026 grades 9 through 12</label>
        <input id="g912-2" type="number" min="0" step="0.01" value="100" />

        <label for="state-placed">State-placed students (FTE, most recent year)</label>
        <input id="state-placed" type="number" min="0" step="0.01" value="0" />

        <label for="econ">Pupils at or below 185% FPL</label>
        <input id="econ" type="number" min="0" step="0.01" value="40" />

        <label for="el">English learner pupils</label>
        <input id="el" type="number" min="0" step="0.01" value="8" />

        <!-- Sparsity and small-school eligibility are derived from density, not
             asserted. 16 V.S.A. 4010(d)(4) sets the density bands and (d)(5)
             gates the small-school weight on 55 or fewer persons per square
             mile, so a checkbox would let the user claim a weight the statute
             would not grant. -->
        <label for="density">Persons per square mile in the district</label>
        <input id="density" type="number" min="0" step="0.1" value="30" />

        <label for="small-school-name">Small school name (optional)</label>
        <input id="small-school-name" type="text" value="" />

        <label for="small-school-enrollment">That school's average two-year enrollment</label>
        <input id="small-school-enrollment" type="number" min="0" step="0.01" value="" />
```

- [ ] **Step 2: Run typecheck to confirm the script still fails**

Run: `npm run typecheck`
Expected: still FAIL in `model-tool.ts` — the markup changed, the call did not.

- [ ] **Step 3: Fix the `computeWeightedMembership` call**

In `site/src/scripts/model-tool.ts`, replace lines 311-332 with:

```ts
    const smallSchoolName = textField('small-school-name');
    const smallSchoolEnrollment = numberField('small-school-enrollment');

    const membership = computeWeightedMembership(ctx, {
      entity: 'ud/illustrative',
      adm_years: [
        {
          fiscal_year: 2025,
          prekindergarten: numberField('prek-1'),
          kindergarten_through_5: numberField('k5-1'),
          grades_6_through_8: numberField('g68-1'),
          grades_9_through_12: numberField('g912-1'),
        },
        {
          fiscal_year: 2026,
          prekindergarten: numberField('prek-2'),
          kindergarten_through_5: numberField('k5-2'),
          grades_6_through_8: numberField('g68-2'),
          grades_9_through_12: numberField('g912-2'),
        },
      ],
      state_placed_fte: numberField('state-placed'),
      poverty_185_fpl: numberField('econ'),
      english_learners: numberField('el'),
      persons_per_square_mile: numberField('density'),
      // A school with no name is no school. An unnamed row would otherwise
      // become a weight applied to an anonymous entity in the walkthrough.
      small_schools:
        smallSchoolName !== null && smallSchoolName !== ''
          ? [{ name: smallSchoolName, average_two_year_enrollment: smallSchoolEnrollment }]
          : [],
      source: 'figures entered by you in this form',
    });
```

- [ ] **Step 4: Add the `textField` helper**

In `site/src/scripts/model-tool.ts`, immediately after `numberField` (around line 271):

```ts
function textField(id: string): string | null {
  const element = document.getElementById(id) as HTMLInputElement | null;
  if (!element) return null;
  return element.value.trim();
}
```

- [ ] **Step 5: Remove the now-unused `checked` helper if nothing calls it**

Run: `grep -n "checked(" site/src/scripts/model-tool.ts`
If the only match is its own definition, delete the `checked` function (around line 271-273). If other call sites remain, leave it.

- [ ] **Step 6: Run typecheck to verify it passes**

Run: `npm run typecheck`
Expected: no output (success).

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: all pass.

- [ ] **Step 8: Verify the page actually works**

Run: `npm run dev`, open the model page, and confirm the walkthrough renders and responds to the density input — set density to `30` (expect a sparsity weight to appear) and then `200` (expect the walkthrough to say no sparsity weight applies). Stop the server.

- [ ] **Step 9: Commit**

```bash
git add site/src/scripts/model-tool.ts site/src/pages/model/index.astro
git commit -m "Fix the model tool onto the corrected membership shape

Now that site/ is typechecked, model-tool.ts fails against the MembershipInput
that commits 27ac20c and c240af0 established. The grade bands become the four
16 V.S.A. 4010(b)(1)(B) counting categories, economically_deprived becomes
poverty_185_fpl, and english_learners becomes a single count rather than a
category list.

The two eligibility checkboxes are replaced by a persons-per-square-mile input.
Sparsity and small-school eligibility are consequences of density under
4010(d)(4) and (d)(5), not assertions a user gets to make: the small-school
weight requires 55 or fewer persons per square mile, so a checkbox would let
someone claim a weight the statute would refuse. State-placed FTE gains an input
because 4001(7)(B) adds it at its current-year count rather than averaging it."
```

---

## Phase 3 — The ADM import

### Task 4: Spreadsheet reader adapter, and the dependency gate

**Why:** This is a **gate**. `read-excel-file` was chosen on published evidence (v9.3.5, 2026-07-28, MIT, read-only, four small deps) but a trial install could not be completed during design. Verify it against both real files before anything is built on it. Isolating it behind one module means a reversal touches one file.

**Files:**
- Modify: `package.json`
- Create: `tools/src/aoe/adm/xlsx.ts`
- Test: `tools/src/aoe/adm/xlsx.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Cell = string | number | null`
  - `readSheetRows(absolutePath: string): Promise<Cell[][]>` — every row of the first sheet, cells in column order, trailing empty cells trimmed.

- [ ] **Step 1: Install the dependency**

Run: `npm install read-excel-file@9.3.5`

Then confirm the tree is small: `npm ls read-excel-file --all`
Expected: `read-excel-file` plus roughly `fflate`, `saxen`, `unzipper-esm`, `worker-f`. If the tree is large or the install fails, **stop and report** — the alternative is `exceljs`, and that decision belongs to a human.

- [ ] **Step 2: Write the failing test**

Create `tools/src/aoe/adm/xlsx.test.ts`:

```ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from '../../paths.ts';
import { readSheetRows } from './xlsx.ts';

// Tests read the real hashed artifacts from intake/ rather than a copied
// fixture, so what is verified is the same bytes provenance records. They skip
// rather than fail when the artifact is not present locally, because it lives in
// LFS and a fresh clone may not have fetched it.
const ADM24 = join(
  REPO_ROOT,
  'intake/aoe-adm/fy2024/edu-average-daily-membership-by-resident-district-fy24.xlsx',
);

describe.skipIf(!existsSync(ADM24))('reading a real AOE spreadsheet', () => {
  it('reads the title row, the header row and every data row', async () => {
    const rows = await readSheetRows(ADM24);

    expect(String(rows[0]?.[0])).toBe(
      'Average Daily Membership (ADM) Report for 2022-2023 (ADM-24) by Resident District',
    );
    expect(rows[1]?.map(String)).toEqual([
      'Resident Disrict',
      'District Name',
      'Elem ( K - 6)',
      'SEC ( 7 - 12)',
    ]);

    // 1 title + 1 header + 254 data rows. A trailing blank row may or may not
    // be reported, so assert the data-row count directly.
    const data = rows.slice(2).filter((r) => String(r[0] ?? '').trim() !== '');
    expect(data).toHaveLength(254);

    expect(String(data[0]?.[0])).toBe('T001');
    expect(String(data[0]?.[1])).toBe('Addison');
    expect(Number(data[0]?.[2])).toBeCloseTo(88.56, 2);
    expect(Number(data[0]?.[3])).toBeCloseTo(57.97, 2);
  });

  it('returns numeric cells as numbers, not strings', async () => {
    const rows = await readSheetRows(ADM24);
    const firstData = rows.slice(2).find((r) => String(r[0] ?? '').trim() === 'T001');
    expect(typeof firstData?.[2]).toBe('number');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- tools/src/aoe/adm/xlsx.test.ts`
Expected: FAIL — `Cannot find module './xlsx.ts'`.

- [ ] **Step 4: Implement the adapter**

Create `tools/src/aoe/adm/xlsx.ts`:

```ts
/**
 * The only module that knows which spreadsheet library we use.
 *
 * read-excel-file was chosen because it is read-only by design, actively
 * maintained, MIT, and pulls four small dependencies. The alternatives were all
 * worse for this repo: exceljs is stale and drags in archiver and unzipper for
 * write support we never use; node-xlsx resolves SheetJS from a CDN tarball,
 * which defeats lockfile-verified installs; npm's xlsx is the abandoned
 * community build with unfixed advisories.
 *
 * Everything above this module sees plain arrays, so replacing the library is a
 * one-file change.
 */

import readXlsxFile from 'read-excel-file/node';

export type Cell = string | number | null;

/**
 * Every row of the workbook's first sheet.
 *
 * The library yields `null` for empty cells and preserves numbers as numbers,
 * which matters: ADM figures must not round-trip through strings. Trailing empty
 * cells are trimmed so a row's length reflects its real width.
 */
export async function readSheetRows(absolutePath: string): Promise<Cell[][]> {
  const rows = (await readXlsxFile(absolutePath)) as Cell[][];
  return rows.map((row) => {
    let end = row.length;
    while (end > 0 && (row[end - 1] === null || row[end - 1] === '')) end--;
    return row.slice(0, end);
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- tools/src/aoe/adm/xlsx.test.ts`
Expected: PASS.

If the import specifier is wrong, try `read-excel-file/node` vs `read-excel-file`, and consult `node -e "console.log(require.resolve('read-excel-file/node'))"`. If cells come back as strings, do **not** coerce here — report it, because it changes what `parse.ts` must guard.

- [ ] **Step 6: Verify against ADM-25 too, if present**

Run:

```bash
ls ~/Downloads/edu-average-daily-membership-by-resident-district-fy25.xlsx 2>/dev/null \
  && npx tsx -e "
import { readSheetRows } from './tools/src/aoe/adm/xlsx.ts';
const rows = await readSheetRows(process.env.HOME + '/Downloads/edu-average-daily-membership-by-resident-district-fy25.xlsx');
console.log(rows[0][0]);
console.log(rows[1]);
console.log('data rows:', rows.slice(2).filter(r => String(r[0] ?? '').trim() !== '').length);
"
```

Expected: the ADM-25 title, a **three**-band header (`Elem ( K - 5)`, `Middle ( 6 - 8)`, `SEC ( 9 - 12)`), and 254 data rows.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tools/src/aoe/adm/xlsx.ts tools/src/aoe/adm/xlsx.test.ts
git commit -m "Add a spreadsheet reader adapter, verified against the real artifact

read-excel-file was selected during design on published evidence but could not be
trial-installed then, so this commit is the gate: it verifies the library against
the real ADM-24 file before anything is built on it, including that numeric cells
arrive as numbers rather than strings.

The library is confined to one module. Everything above it sees plain arrays, so
a reversal to exceljs would touch this file only.

Tests read the hashed artifact from intake/ rather than a copied fixture, so what
they verify is the same bytes provenance records, and skip rather than fail when
LFS content is absent."
```

---

### Task 5: Year labels and their invariants

**Files:**
- Create: `tools/src/aoe/adm/year.ts`
- Test: `tools/src/aoe/adm/year.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface YearLabels { readonly count_year: string; readonly count_year_start: number; readonly adm_label: number; readonly fiscal_year: number; readonly source_title: string }`
  - `parseTitleRow(title: string): YearLabels` — throws `Error` on an unparseable or self-inconsistent title.
  - `normalizeLinkText(raw: string): string`
  - `parseLinkText(text: string): YearLabels & { readonly grain: string }` — throws on failure.
  - `assertYearAgreement(labels: YearLabels, filename: string): void` — throws when the filename's `fy<NN>`/`adm<NN>` disagrees.

- [ ] **Step 1: Write the failing tests**

Create `tools/src/aoe/adm/year.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  assertYearAgreement,
  normalizeLinkText,
  parseLinkText,
  parseTitleRow,
} from './year.ts';

describe('parsing the title row', () => {
  it('reads both year labels and derives the fiscal year', () => {
    const labels = parseTitleRow(
      'Average Daily Membership (ADM) Report for 2023-2024 (ADM-25) by Resident District',
    );
    expect(labels.count_year).toBe('2023-2024');
    expect(labels.count_year_start).toBe(2023);
    expect(labels.adm_label).toBe(25);
    expect(labels.fiscal_year).toBe(2025);
  });

  it('handles the ADM-24 title', () => {
    const labels = parseTitleRow(
      'Average Daily Membership (ADM) Report for 2022-2023 (ADM-24) by Resident District',
    );
    expect(labels.fiscal_year).toBe(2024);
    expect(labels.count_year_start).toBe(2022);
  });

  it('rejects a title whose label and count year contradict each other', () => {
    // fiscal_year would be 2025, so count_year_start must be 2023.
    expect(() =>
      parseTitleRow('Average Daily Membership (ADM) Report for 2019-2020 (ADM-25) by Resident District'),
    ).toThrow(/2019.*expected 2023|invariant/i);
  });

  it('rejects a title whose school years are not consecutive', () => {
    expect(() =>
      parseTitleRow('Average Daily Membership (ADM) Report for 2023-2025 (ADM-25) by Resident District'),
    ).toThrow(/consecutive/i);
  });

  it('rejects an unrecognizable title rather than guessing', () => {
    expect(() => parseTitleRow('Some Other AOE Report')).toThrow(/could not read/i);
  });
});

describe('normalizing link text', () => {
  it('strips the invisible characters AOE’s CMS emits', () => {
    // ADM-17 carries NBSP; ADM-16 carries NBSP and a trailing zero-width space.
    expect(normalizeLinkText('2015-2016 Resident District Report')).toBe(
      '2015-2016 Resident District Report',
    );
    expect(normalizeLinkText('2014-2015 (ADM-16) Resident District Report​')).toBe(
      '2014-2015 (ADM-16) Resident District Report',
    );
  });

  it('decodes the HTML entities that appear in the markup', () => {
    expect(normalizeLinkText('2015-2016&nbsp;Resident District Report')).toBe(
      '2015-2016 Resident District Report',
    );
  });
});

describe('parsing link text', () => {
  it('reads the year labels and the grain', () => {
    const parsed = parseLinkText('2022-2023 (ADM-24) Resident District Report');
    expect(parsed.fiscal_year).toBe(2024);
    expect(parsed.count_year).toBe('2022-2023');
    expect(parsed.grain).toBe('Resident District Report');
  });

  it('parses every published year, including the ones with invisible characters', () => {
    const published: ReadonlyArray<readonly [string, number]> = [
      ['2022-2023 (ADM-24) Resident District Report', 2024],
      ['2021-2022 (ADM-23) Resident District Report', 2023],
      ['2020-2021 (ADM-22) Resident District Report', 2022],
      ['2019-2020 (ADM-21) Resident District Report', 2021],
      ['2018-2019 (ADM-20) Resident District Report', 2020],
      ['2017-2018 (ADM-19) Resident District Report', 2019],
      ['2016-2017 (ADM-18) Resident District Report', 2018],
      ['2015-2016 (ADM-17) Resident District Report', 2017],
      ['2014-2015 (ADM-16) Resident District Report​', 2016],
    ];
    for (const [text, fy] of published) {
      expect(parseLinkText(normalizeLinkText(text)).fiscal_year, text).toBe(fy);
    }
  });
});

describe('agreement with the filename', () => {
  const labels = parseTitleRow(
    'Average Daily Membership (ADM) Report for 2022-2023 (ADM-24) by Resident District',
  );

  it('accepts the era-A filename', () => {
    expect(() =>
      assertYearAgreement(labels, 'edu-average-daily-membership-by-resident-district-fy24.xlsx'),
    ).not.toThrow();
  });

  it('accepts an era-C filename', () => {
    expect(() =>
      assertYearAgreement(labels, 'data-average-daily-membership-resident-district-adm24.xlsx'),
    ).not.toThrow();
  });

  it('rejects a misfiled download', () => {
    expect(() =>
      assertYearAgreement(labels, 'edu-average-daily-membership-by-resident-district-fy25.xlsx'),
    ).toThrow(/fy25|disagree/i);
  });

  it('rejects a filename carrying no year at all', () => {
    expect(() => assertYearAgreement(labels, 'download.xlsx')).toThrow(/no year/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tools/src/aoe/adm/year.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `year.ts`**

```ts
/**
 * Year labels for an AOE ADM report, and the invariants that catch a misfiled
 * or mislabeled download.
 *
 * One row of numbers carries more than one year, and conflating them misdates
 * the whole series:
 *
 *   count_year   the school year pupils were actually counted  ("2023-2024")
 *   adm_label    AOE's "(ADM-NN)" label                        (25)
 *   fiscal_year  the determination year, and this project's     (2025)
 *                single name for the year
 *
 * fiscal_year and count_year sit TWO years apart, and that is correct: a FY2025
 * determination is made on pupils counted in SY2023-24. Both invariants below
 * were verified against all ten published years with no exceptions, so a
 * violation means a bad file rather than an unusual one.
 */

export interface YearLabels {
  readonly count_year: string;
  readonly count_year_start: number;
  readonly adm_label: number;
  readonly fiscal_year: number;
  readonly source_title: string;
}

const TITLE = /for\s+(\d{4})-(\d{4})\s*\(ADM-(\d{2})\)/i;
const LINK = /^(\d{4})-(\d{4})\s*\(ADM-(\d{2})\)\s*(.+)$/i;

/** Applies the two invariants, or explains precisely which one failed. */
function build(
  startRaw: string,
  endRaw: string,
  labelRaw: string,
  sourceTitle: string,
): YearLabels {
  const count_year_start = Number(startRaw);
  const count_year_end = Number(endRaw);
  const adm_label = Number(labelRaw);
  const fiscal_year = adm_label + 2000;

  if (count_year_end - count_year_start !== 1) {
    throw new Error(
      `"${sourceTitle}" spans ${startRaw}-${endRaw}, which is not two consecutive school years.`,
    );
  }

  const expectedStart = fiscal_year - 2;
  if (count_year_start !== expectedStart) {
    throw new Error(
      `"${sourceTitle}" is labelled ADM-${labelRaw}, so its count year must start in ` +
        `${expectedStart}, but it states ${startRaw}. The invariant ` +
        `count_year_start == fiscal_year - 2 holds for every published year, so this ` +
        `file is mislabeled rather than unusual.`,
    );
  }

  return {
    count_year: `${startRaw}-${endRaw}`,
    count_year_start,
    adm_label,
    fiscal_year,
    source_title: sourceTitle,
  };
}

export function parseTitleRow(title: string): YearLabels {
  const trimmed = title.trim();
  const m = TITLE.exec(trimmed);
  if (!m) {
    throw new Error(
      `Could not read year labels from the title row "${trimmed}". Expected something ` +
        `containing "for YYYY-YYYY (ADM-NN)".`,
    );
  }
  return build(m[1] as string, m[2] as string, m[3] as string, trimmed);
}

/**
 * AOE's CMS emits non-breaking spaces and, in ADM-16's case, a trailing
 * zero-width space. Left in place they defeat a plain text match.
 */
export function normalizeLinkText(raw: string): string {
  return raw
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/ /g, ' ')
    .replace(/[​-‏  ﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseLinkText(text: string): YearLabels & { readonly grain: string } {
  const normalized = normalizeLinkText(text);
  const m = LINK.exec(normalized);
  if (!m) {
    throw new Error(
      `Could not read year labels from the link text "${normalized}". Expected ` +
        `"YYYY-YYYY (ADM-NN) <grain>".`,
    );
  }
  const labels = build(m[1] as string, m[2] as string, m[3] as string, normalized);
  return { ...labels, grain: (m[4] as string).trim() };
}

/**
 * The filename is a third statement of the year. It is checked because the
 * cheapest real failure is a human downloading the right link into the wrong
 * name, or the wrong link at all.
 *
 * Three URL slug eras exist, so both spellings are accepted:
 *   ...-by-resident-district-fy24.xlsx      (eras A and B)
 *   ...-resident-district-adm17.xlsx        (era C)
 */
export function assertYearAgreement(labels: YearLabels, filename: string): void {
  const m = /(?:fy|adm)[-_]?(\d{2})(?!\d)/i.exec(filename);
  if (!m) {
    throw new Error(
      `The filename "${filename}" states no year, so it cannot be checked against the ` +
        `document's own ADM-${labels.adm_label} label. Rename it as released rather than ` +
        `guessing which year it is.`,
    );
  }
  const fromName = Number(m[1]);
  if (fromName !== labels.adm_label) {
    throw new Error(
      `The filename "${filename}" says ADM-${fromName} but the document says ` +
        `ADM-${labels.adm_label} (count year ${labels.count_year}). These disagree, so the ` +
        `file is misfiled or misnamed. Resolve it by hand rather than trusting either.`,
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tools/src/aoe/adm/year.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add tools/src/aoe/adm/year.ts tools/src/aoe/adm/year.test.ts
git commit -m "Parse and cross-check the ADM year labels

One row of numbers carries three year labels -- the count year, AOE's ADM-NN
label, and the fiscal year the determination belongs to -- and the count year
sits two years behind the fiscal year, so conflating them misdates the series.

Two invariants hold across all ten published years and are now asserted rather
than assumed: fiscal_year == adm_label + 2000, and count_year_start ==
fiscal_year - 2. A violation means a bad file, so the parser refuses instead of
guessing. The filename is checked as an independent third statement of the year,
in both the fyNN and admNN spellings the three URL eras use, because the cheapest
real failure is a correct download saved under the wrong name.

Link-text normalization strips the non-breaking spaces AOE's CMS emits and the
trailing zero-width space on the ADM-16 link, which would otherwise defeat the
match."
```

---

### Task 6: Parse a report into band-tagged rows

**Why:** Header shapes differ by band regime, and only ADM-24 and ADM-25 have been opened. The parser must recognize known shapes and **hard-fail on an unknown one**, listing what it found — never guess a mapping. That refusal is what lets the remaining eight files be added safely later.

**Files:**
- Create: `tools/src/aoe/adm/parse.ts`
- Test: `tools/src/aoe/adm/parse.test.ts`

**Interfaces:**
- Consumes: `readSheetRows`, `Cell` (Task 4); `parseTitleRow`, `assertYearAgreement`, `YearLabels` (Task 5).
- Produces:
  - `type StatutoryBand = 'prekindergarten' | 'kindergarten_through_5' | 'grades_6_through_8' | 'grades_9_through_12'`
  - `interface BandColumn { readonly header: string; readonly statutory_band: StatutoryBand | null }`
  - `interface AdmRow { readonly aoe_org_id: string; readonly name_as_published: string; readonly values: ReadonlyArray<number | null> }`
  - `interface ParsedReport { readonly labels: YearLabels; readonly bands_as_published: ReadonlyArray<BandColumn>; readonly maps_to_statutory_bands: boolean; readonly rows: ReadonlyArray<AdmRow>; readonly band_totals: ReadonlyArray<number>; readonly grand_total: number }`
  - `parseRows(rows: Cell[][], filename: string): ParsedReport`
  - `parseReport(absolutePath: string): Promise<ParsedReport>`

- [ ] **Step 1: Write the failing tests**

Create `tools/src/aoe/adm/parse.test.ts`:

```ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from '../../paths.ts';
import { parseReport, parseRows } from './parse.ts';
import type { Cell } from './xlsx.ts';

const ADM24 = join(
  REPO_ROOT,
  'intake/aoe-adm/fy2024/edu-average-daily-membership-by-resident-district-fy24.xlsx',
);

function sheet(title: string, headers: string[], data: Cell[][]): Cell[][] {
  return [[title], ['Resident Disrict', 'District Name', ...headers], ...data];
}

const ADM25_TITLE =
  'Average Daily Membership (ADM) Report for 2023-2024 (ADM-25) by Resident District';
const ADM24_TITLE =
  'Average Daily Membership (ADM) Report for 2022-2023 (ADM-24) by Resident District';

describe('recognizing band regimes', () => {
  it('maps the post-Act-127 three-band shape onto statutory bands', () => {
    const parsed = parseRows(
      sheet(ADM25_TITLE, ['Elem ( K - 5)', 'Middle ( 6 - 8)', 'SEC ( 9 - 12)'], [
        ['T001', 'Addison', 79.51, 28.66, 37.71],
      ]),
      'edu-average-daily-membership-by-resident-district-fy25.xlsx',
    );
    expect(parsed.maps_to_statutory_bands).toBe(true);
    expect(parsed.bands_as_published.map((b) => b.statutory_band)).toEqual([
      'kindergarten_through_5',
      'grades_6_through_8',
      'grades_9_through_12',
    ]);
  });

  it('recognizes the pre-Act-127 two-band shape but refuses to map it', () => {
    // K-6 / 7-12 cannot be reduced to K-5 / 6-8 / 9-12: grade 6 and grades 7-8
    // fall on opposite sides, and no grade-level detail exists to split them.
    const parsed = parseRows(
      sheet(ADM24_TITLE, ['Elem ( K - 6)', 'SEC ( 7 - 12)'], [['T001', 'Addison', 88.56, 57.97]]),
      'edu-average-daily-membership-by-resident-district-fy24.xlsx',
    );
    expect(parsed.maps_to_statutory_bands).toBe(false);
    expect(parsed.bands_as_published.map((b) => b.statutory_band)).toEqual([null, null]);
    expect(parsed.bands_as_published.map((b) => b.header)).toEqual(['Elem ( K - 6)', 'SEC ( 7 - 12)']);
  });

  it('hard-fails on an unrecognized header shape, naming what it found', () => {
    expect(() =>
      parseRows(
        sheet(ADM25_TITLE, ['Elem ( K - 4)', 'Upper ( 5 - 12)'], [['T001', 'Addison', 1, 2]]),
        'edu-average-daily-membership-by-resident-district-fy25.xlsx',
      ),
    ).toThrow(/Elem \( K - 4\)/);
  });
});

describe('reading rows', () => {
  it('rounds to the two decimals the source actually publishes', () => {
    const parsed = parseRows(
      sheet(ADM24_TITLE, ['Elem ( K - 6)', 'SEC ( 7 - 12)'], [
        ['T010', 'Barnet', 101.25, 133.44999999999999],
        ['T011', 'Barre City', 645.66000000000008, 423.97],
      ]),
      'fy24.xlsx',
    );
    expect(parsed.rows[0]?.values).toEqual([101.25, 133.45]);
    expect(parsed.rows[1]?.values).toEqual([645.66, 423.97]);
  });

  it('keeps the published name for auditing but never uses it to identify a town', () => {
    const parsed = parseRows(
      sheet(ADM24_TITLE, ['Elem ( K - 6)', 'SEC ( 7 - 12)'], [['T003', 'Alburg', 1, 2]]),
      'fy24.xlsx',
    );
    expect(parsed.rows[0]?.aoe_org_id).toBe('T003');
    expect(parsed.rows[0]?.name_as_published).toBe('Alburg');
  });

  it('stops at the trailing blank row', () => {
    const parsed = parseRows(
      sheet(ADM24_TITLE, ['Elem ( K - 6)', 'SEC ( 7 - 12)'], [
        ['T001', 'Addison', 1, 2],
        ['', ''],
      ]),
      'fy24.xlsx',
    );
    expect(parsed.rows).toHaveLength(1);
  });

  it('distinguishes an empty cell from a zero', () => {
    const parsed = parseRows(
      sheet(ADM24_TITLE, ['Elem ( K - 6)', 'SEC ( 7 - 12)'], [
        ['T256', 'Averill', 0, 0],
        ['T258', 'Ferdinand', null, 2.5],
      ]),
      'fy24.xlsx',
    );
    expect(parsed.rows[0]?.values).toEqual([0, 0]);
    expect(parsed.rows[1]?.values).toEqual([null, 2.5]);
  });

  it('computes band totals and a grand total', () => {
    const parsed = parseRows(
      sheet(ADM24_TITLE, ['Elem ( K - 6)', 'SEC ( 7 - 12)'], [
        ['T001', 'Addison', 10.5, 5.25],
        ['T002', 'Albany', 1.5, 2.75],
      ]),
      'fy24.xlsx',
    );
    expect(parsed.band_totals).toEqual([12, 8]);
    expect(parsed.grand_total).toBe(20);
  });
});

describe.skipIf(!existsSync(ADM24))('against the real ADM-24 artifact', () => {
  it('reproduces the pinned golden totals', async () => {
    const parsed = await parseReport(ADM24);
    expect(parsed.labels.fiscal_year).toBe(2024);
    expect(parsed.labels.count_year).toBe('2022-2023');
    expect(parsed.rows).toHaveLength(254);
    expect(parsed.maps_to_statutory_bands).toBe(false);
    expect(parsed.band_totals[0]).toBeCloseTo(47301.13, 2);
    expect(parsed.band_totals[1]).toBeCloseTo(36686.14, 2);
    expect(parsed.grand_total).toBeCloseTo(83987.27, 2);
  });

  it('has no null cells', async () => {
    const parsed = await parseReport(ADM24);
    expect(parsed.rows.filter((r) => r.values.some((v) => v === null))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tools/src/aoe/adm/parse.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `parse.ts`**

```ts
/**
 * Turns an AOE ADM report into band-tagged rows.
 *
 * The parser recognizes band regimes and refuses unknown ones. That refusal is
 * the design: Act 127 changed the grade bands effective July 1, 2024, only two
 * of the ten published years have been opened, and a parser that guessed at an
 * unfamiliar header would produce numbers filed under the wrong grades.
 */

import { basename } from 'node:path';

import { assertYearAgreement, parseTitleRow, type YearLabels } from './year.ts';
import { readSheetRows, type Cell } from './xlsx.ts';

export type StatutoryBand =
  | 'prekindergarten'
  | 'kindergarten_through_5'
  | 'grades_6_through_8'
  | 'grades_9_through_12';

export interface BandColumn {
  readonly header: string;
  /** Null when the published band has no § 4010 counterpart. */
  readonly statutory_band: StatutoryBand | null;
}

export interface AdmRow {
  readonly aoe_org_id: string;
  /** Retained for auditing only. Never used to identify a town. */
  readonly name_as_published: string;
  readonly values: ReadonlyArray<number | null>;
}

export interface ParsedReport {
  readonly labels: YearLabels;
  readonly bands_as_published: ReadonlyArray<BandColumn>;
  readonly maps_to_statutory_bands: boolean;
  readonly rows: ReadonlyArray<AdmRow>;
  readonly band_totals: ReadonlyArray<number>;
  readonly grand_total: number;
}

/** Collapses the inconsistent spacing AOE uses inside header labels. */
function normalizeHeader(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().toLowerCase();
}

interface Regime {
  readonly label: string;
  readonly headers: readonly string[];
  readonly bands: ReadonlyArray<StatutoryBand | null>;
}

/**
 * Every band regime observed in a real file.
 *
 * ADM-25 onwards matches § 4010(d)(1) exactly. ADM-24 and earlier are
 * pre-Act-127 and map to nothing: grade 6 sits inside "Elem ( K - 6)" here but
 * inside "Middle ( 6 - 8)" in ADM-25, and grades 7 and 8 sit inside
 * "SEC ( 7 - 12)" here but inside "Middle ( 6 - 8)" there. Neither report
 * publishes grade-level detail, so no arithmetic separates them, and § 4010
 * weights differ across exactly the boundary that would have to be invented.
 *
 * Add a regime here only after opening the file it came from.
 */
const REGIMES: readonly Regime[] = [
  {
    label: 'post-Act-127 three-band (ADM-25 onwards)',
    headers: ['elem ( k - 5)', 'middle ( 6 - 8)', 'sec ( 9 - 12)'],
    bands: ['kindergarten_through_5', 'grades_6_through_8', 'grades_9_through_12'],
  },
  {
    label: 'pre-Act-127 two-band (ADM-24 and earlier)',
    headers: ['elem ( k - 6)', 'sec ( 7 - 12)'],
    bands: [null, null],
  },
];

function matchRegime(headers: readonly string[]): Regime {
  const normalized = headers.map(normalizeHeader);
  const found = REGIMES.find(
    (r) =>
      r.headers.length === normalized.length &&
      r.headers.every((h, i) => h === normalized[i]),
  );
  if (found) return found;

  throw new Error(
    `Unrecognized ADM band headers: ${JSON.stringify(headers)}.\n\n` +
      `Known regimes are:\n` +
      REGIMES.map((r) => `  - ${r.label}: ${JSON.stringify(r.headers)}`).join('\n') +
      `\n\nThis is deliberate. Act 127 changed the statutory grade bands effective ` +
      `July 1, 2024, and guessing how an unfamiliar band maps onto § 4010 would file ` +
      `pupils under the wrong grades. Open the file, decide what the bands mean, and add ` +
      `a regime to REGIMES in tools/src/aoe/adm/parse.ts with a test.`,
  );
}

function cellToValue(cell: Cell): number | null {
  if (cell === null || cell === undefined) return null;
  if (typeof cell === 'string' && cell.trim() === '') return null;
  const n = Number(cell);
  if (!Number.isFinite(n)) return null;
  // The source publishes two decimals; the raw XML carries float artifacts such
  // as 79.509999999999991 for 79.51.
  return Number(n.toFixed(2));
}

export function parseRows(rows: Cell[][], filename: string): ParsedReport {
  const titleCell = rows[0]?.[0];
  if (titleCell === null || titleCell === undefined || String(titleCell).trim() === '') {
    throw new Error(`${filename}: the first row carries no title, so the year cannot be read.`);
  }
  const labels = parseTitleRow(String(titleCell));
  assertYearAgreement(labels, basename(filename));

  const headerRow = rows[1];
  if (!headerRow) throw new Error(`${filename}: no header row.`);
  const headers = headerRow.slice(2).map((c) => String(c ?? '')).filter((h) => h.trim() !== '');
  const regime = matchRegime(headers);

  const bands_as_published: BandColumn[] = headers.map((header, i) => ({
    header,
    statutory_band: regime.bands[i] ?? null,
  }));

  const parsedRows: AdmRow[] = [];
  for (const row of rows.slice(2)) {
    const code = String(row?.[0] ?? '').trim();
    if (code === '') continue;
    parsedRows.push({
      aoe_org_id: code,
      name_as_published: String(row?.[1] ?? '').trim(),
      values: headers.map((_, i) => cellToValue(row?.[i + 2] ?? null)),
    });
  }

  const band_totals = headers.map((_, i) =>
    Number(parsedRows.reduce((acc, r) => acc + (r.values[i] ?? 0), 0).toFixed(2)),
  );

  return {
    labels,
    bands_as_published,
    maps_to_statutory_bands: regime.bands.every((b) => b !== null),
    rows: parsedRows,
    band_totals,
    grand_total: Number(band_totals.reduce((a, b) => a + b, 0).toFixed(2)),
  };
}

export async function parseReport(absolutePath: string): Promise<ParsedReport> {
  return parseRows(await readSheetRows(absolutePath), absolutePath);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tools/src/aoe/adm/parse.test.ts`
Expected: PASS, including the real-artifact goldens 47,301.13 / 36,686.14 / 83,987.27.

- [ ] **Step 5: Commit**

```bash
git add tools/src/aoe/adm/parse.ts tools/src/aoe/adm/parse.test.ts
git commit -m "Parse ADM reports into band-tagged rows, refusing unknown regimes

Two band regimes have been observed in real files: ADM-25's three bands, which
match 16 V.S.A. 4010(d)(1) exactly, and ADM-24's two, which map to nothing. K-6 /
7-12 cannot be reduced to K-5 / 6-8 / 9-12 -- grade 6 and grades 7-8 fall on
opposite sides of the boundary and neither report publishes grade-level detail --
so the parser records maps_to_statutory_bands: false rather than inventing a
split across weights that differ.

An unrecognized header shape is a hard failure naming the headers found and the
regimes known. Eight of the ten published years are still unopened, and a parser
that guessed at an unfamiliar band would file pupils under the wrong grades
silently. Values round to the two decimals the source actually publishes, and an
empty cell stays distinct from a zero."
```

---

### Task 7: Join to the registry and classify towns

**Files:**
- Create: `tools/src/aoe/adm/join.ts`, `tools/src/aoe/adm/classify.ts`
- Test: `tools/src/aoe/adm/join.test.ts`, `tools/src/aoe/adm/classify.test.ts`

**Interfaces:**
- Consumes: `AdmRow` (Task 6); `isReportingBucket` (Task 1); `readRegistry` from `tools/src/registry/store.ts`; `RegistryEntity` from `tools/src/registry/types.ts`.
- Produces:
  - `type TownClass = 'union_district_member' | 'own_district' | 'no_operating_district' | 'out_of_state_member' | 'residency_bucket'`
  - `classifyTown(entity: RegistryEntity): TownClass`
  - `earnsVermontAdm(cls: TownClass): boolean`
  - `interface JoinedRow { readonly row: AdmRow; readonly slug: string; readonly entity: RegistryEntity; readonly town_class: TownClass }`
  - `joinRows(rows: ReadonlyArray<AdmRow>, registry: ReadonlyMap<string, RegistryEntity>): ReadonlyArray<JoinedRow>` — throws on any unmatched code.

- [ ] **Step 1: Write the failing classify tests**

Create `tools/src/aoe/adm/classify.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { RegistryEntity } from '../../registry/types.ts';
import { classifyTown, earnsVermontAdm } from './classify.ts';

function town(over: Partial<RegistryEntity>): RegistryEntity {
  return {
    slug: 'town/example',
    name: 'EXAMPLE',
    type: 'town',
    aoe_org_id: 'T001',
    aoe_server_id: null,
    edfi_id: null,
    effective_from: '2026-07-29',
    effective_from_basis: 'first_observed',
    effective_to: null,
    effective_to_basis: 'unknown',
    successor: null,
    successor_basis: null,
    supervisory_union: null,
    operated_by: null,
    reporting_only: false,
    member_towns: [],
    grades: [],
    website: null,
    latitude: null,
    longitude: null,
    manual_overrides: [],
    notes: null,
    ...over,
  } as RegistryEntity;
}

describe('classifying towns for ADM purposes', () => {
  it('a town with a union district is a member of it', () => {
    const cls = classifyTown(
      town({ aoe_org_id: 'T001', operated_by: 'ud/addison-northwest-54', supervisory_union: 'su/addison-northwest' }),
    );
    expect(cls).toBe('union_district_member');
    expect(earnsVermontAdm(cls)).toBe(true);
  });

  it('a town that is its own supervisory district is its own district', () => {
    // Burlington is SU015 Burlington Supervisory District, and Burlington High
    // School carries op: town/burlington. operated_by: null here means "no
    // separate operating district", not "no district".
    const cls = classifyTown(
      town({ aoe_org_id: 'T037', name: 'BURLINGTON', supervisory_union: 'su/burlington' }),
    );
    expect(cls).toBe('own_district');
    expect(earnsVermontAdm(cls)).toBe(true);
  });

  it('Orford NH is a real out-of-state member town earning no Vermont ADM', () => {
    const cls = classifyTown(
      town({ aoe_org_id: 'T999', name: 'ORFORD NH', supervisory_union: 'su/rivendell-interstate' }),
    );
    expect(cls).toBe('out_of_state_member');
    expect(earnsVermontAdm(cls)).toBe(false);
  });

  it('a 900-range record is a residency bucket', () => {
    const cls = classifyTown(town({ aoe_org_id: '902', name: 'Other State -New Hampshire' }));
    expect(cls).toBe('residency_bucket');
    expect(earnsVermontAdm(cls)).toBe(false);
  });

  it('UNKNOWN is a residency bucket', () => {
    const cls = classifyTown(town({ aoe_org_id: 'T000', name: 'UNKNOWN', reporting_only: true }));
    expect(cls).toBe('residency_bucket');
    expect(earnsVermontAdm(cls)).toBe(false);
  });

  it('a town with neither SU nor operating district has no operating district', () => {
    // Underhill ID is in this position in the current registry.
    const cls = classifyTown(town({ aoe_org_id: 'T211', name: 'UNDERHILL ID' }));
    expect(cls).toBe('no_operating_district');
    expect(earnsVermontAdm(cls)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tools/src/aoe/adm/classify.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `classify.ts`**

```ts
/**
 * The six-way taxonomy an AOE town row can fall into, and which classes earn
 * Vermont ADM.
 *
 * This exists because `operated_by: null` is ambiguous. 60 of 268 registry towns
 * have it, and they include Burlington, Rutland City, South Burlington,
 * Winooski, Springfield, St Johnsbury, Colchester, Milton, Hartford and Stowe --
 * towns that ARE districts, not towns without one. Grouping by operated_by alone
 * would silently drop them.
 *
 * NOTE ON `own_district`: that a town with a supervisory union but no separate
 * operating district is its own district is inferred from SU015 Burlington
 * Supervisory District and from Burlington High School carrying
 * `op: town/burlington`. It is recorded here as the working rule and must be
 * confirmed against AOE's organizations data and the statute -- see the spec's
 * open question 1. The conservation invariant in aggregate.ts is what stops a
 * wrong answer here from being a silent one.
 */

import { isReportingBucket } from '../../registry/placeholder.ts';
import type { RegistryEntity } from '../../registry/types.ts';

export type TownClass =
  | 'union_district_member'
  | 'own_district'
  | 'no_operating_district'
  | 'out_of_state_member'
  | 'residency_bucket';

export function classifyTown(entity: RegistryEntity): TownClass {
  if (entity.reporting_only || isReportingBucket({ id: entity.aoe_org_id, name: entity.name })) {
    return 'residency_bucket';
  }
  // Orford NH is a real town and a real member of the Rivendell Interstate
  // district. Its pupils are New Hampshire's, so it earns no Vermont ADM, but it
  // is emphatically not a bucket and must never be dropped from the registry.
  if (entity.aoe_org_id === 'T999') return 'out_of_state_member';
  if (entity.operated_by) return 'union_district_member';
  if (entity.supervisory_union) return 'own_district';
  return 'no_operating_district';
}

/** Only Vermont districts receive Vermont ADM. */
export function earnsVermontAdm(cls: TownClass): boolean {
  return cls === 'union_district_member' || cls === 'own_district';
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tools/src/aoe/adm/classify.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing join tests**

Create `tools/src/aoe/adm/join.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { readRegistry } from '../../registry/store.ts';
import { joinRows } from './join.ts';
import type { AdmRow } from './parse.ts';

function row(aoe_org_id: string, name_as_published: string): AdmRow {
  return { aoe_org_id, name_as_published, values: [1, 2] };
}

describe('joining ADM rows to the registry', () => {
  const registry = readRegistry();

  it('joins on the org ID even when the published name differs', () => {
    // 15 of 254 rows disagree cosmetically. Matching on name would drop them.
    const joined = joinRows(
      [
        row('T003', 'Alburg'), //            registry: ALBURGH
        row('T123', 'Middlebury ID #4'), //  registry: MIDDLEBURY
        row('T176', 'St. Albans City'), //   registry: ST ALBANS CITY
        row('T249', 'Winooski ID'), //       registry: WINOOSKI
      ],
      registry,
    );
    expect(joined).toHaveLength(4);
    expect(joined.map((j) => j.slug)).toEqual([
      'town/alburgh',
      'town/middlebury',
      'town/st-albans-city',
      'town/winooski',
    ]);
  });

  it('attaches the classification', () => {
    const joined = joinRows([row('T037', 'Burlington')], registry);
    expect(joined[0]?.town_class).toBe('own_district');
  });

  it('hard-fails on an unmatched code rather than skipping the row', () => {
    expect(() => joinRows([row('T001', 'Addison'), row('T777', 'Nowhere')], registry)).toThrow(
      /T777/,
    );
  });
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npm test -- tools/src/aoe/adm/join.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement `join.ts`**

```ts
/**
 * Resolves an AOE town code to a registry entity.
 *
 * The join is on `aoe_org_id` and nothing else. 15 of the 254 rows in a real
 * report carry a name that differs from the registry's -- "Alburg" for ALBURGH,
 * "Middlebury ID #4" for MIDDLEBURY, "St. Albans City" for ST ALBANS CITY -- so
 * a name-based join would silently drop real towns. The published name is
 * carried through for auditing and used for nothing else.
 */

import type { RegistryEntity } from '../../registry/types.ts';
import { classifyTown, type TownClass } from './classify.ts';
import type { AdmRow } from './parse.ts';

export interface JoinedRow {
  readonly row: AdmRow;
  readonly slug: string;
  readonly entity: RegistryEntity;
  readonly town_class: TownClass;
}

export function joinRows(
  rows: ReadonlyArray<AdmRow>,
  registry: ReadonlyMap<string, RegistryEntity>,
): ReadonlyArray<JoinedRow> {
  const byOrgId = new Map<string, RegistryEntity>();
  for (const entity of registry.values()) {
    if (entity.type === 'town' && entity.aoe_org_id) byOrgId.set(entity.aoe_org_id, entity);
  }

  const joined: JoinedRow[] = [];
  const unmatched: string[] = [];

  for (const row of rows) {
    const entity = byOrgId.get(row.aoe_org_id);
    if (!entity) {
      unmatched.push(`${row.aoe_org_id} ("${row.name_as_published}")`);
      continue;
    }
    joined.push({ row, slug: entity.slug, entity, town_class: classifyTown(entity) });
  }

  if (unmatched.length > 0) {
    throw new Error(
      `${unmatched.length} ADM row(s) name a town code with no registry entity:\n` +
        unmatched.map((u) => `  ${u}`).join('\n') +
        `\n\nEvery row in every report opened so far joins cleanly, so an unmatched code ` +
        `means either a stale registry or a new AOE record. Run \`npm run registry:sync\` ` +
        `and look at what changed. Rows are never skipped: a dropped town is missing ` +
        `pupils, and missing pupils are indistinguishable from a town with none.`,
    );
  }

  return joined;
}
```

- [ ] **Step 8: Run to verify pass**

Run: `npm test -- tools/src/aoe/adm/join.test.ts`
Expected: PASS. If a slug assertion fails, read the real slug out of the registry and correct the expectation — slugs are generated, and the test should assert what `registry:sync` actually produces.

- [ ] **Step 9: Commit**

```bash
git add tools/src/aoe/adm/join.ts tools/src/aoe/adm/join.test.ts \
        tools/src/aoe/adm/classify.ts tools/src/aoe/adm/classify.test.ts
git commit -m "Join ADM rows by org ID and classify what each town is

The join is on aoe_org_id alone. Fifteen of the 254 rows in a real report carry a
name the registry spells differently -- Alburg for ALBURGH, Middlebury ID #4 for
MIDDLEBURY -- so a name-based join would drop real towns holding real pupils. An
unmatched code is a hard failure listing every offender, because a skipped row is
indistinguishable from a town with no pupils.

Classification exists because operated_by: null is ambiguous across 60 of 268
towns, including Burlington, Rutland City and Winooski, which are their own
districts rather than towns lacking one. The five classes separate that case from
the unpopulated places, from Orford NH -- a real interstate member town whose
pupils are New Hampshire's -- and from the residency buckets.

That a town with a supervisory union but no separate operating district is its own
district is still an inference, documented as such at the top of classify.ts. The
conservation invariant in the next task is what keeps a wrong answer from being a
silent one."
```

---

### Task 8: Roll towns up to districts under a conservation invariant

**Why:** This is the primary regression guard for the whole import. An `operated_by`-keyed rollup would have dropped Burlington and 57 others without erroring. The invariant makes that class of loss impossible: every pupil is either in a district total or in a named, justified exclusion.

**Files:**
- Create: `tools/src/aoe/adm/aggregate.ts`
- Test: `tools/src/aoe/adm/aggregate.test.ts`

**Interfaces:**
- Consumes: `JoinedRow`, `TownClass`, `earnsVermontAdm` (Task 7); `ParsedReport` (Task 6).
- Produces:
  - `interface Exclusion { readonly aoe_org_id: string; readonly slug: string; readonly name_as_published: string; readonly town_class: TownClass; readonly values: ReadonlyArray<number | null>; readonly total: number; readonly justification: string }`
  - `interface DistrictTotal { readonly district: string; readonly member_towns: ReadonlyArray<string>; readonly values: ReadonlyArray<number | null> }`
  - `interface Rollup { readonly districts: ReadonlyArray<DistrictTotal>; readonly exclusions: ReadonlyArray<Exclusion>; readonly town_band_totals: ReadonlyArray<number>; readonly district_band_totals: ReadonlyArray<number>; readonly excluded_band_totals: ReadonlyArray<number> }`
  - `aggregate(joined: ReadonlyArray<JoinedRow>, bandCount: number): Rollup` — throws when conservation fails.

- [ ] **Step 1: Write the failing tests**

Create `tools/src/aoe/adm/aggregate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { RegistryEntity } from '../../registry/types.ts';
import { aggregate } from './aggregate.ts';
import type { JoinedRow } from './join.ts';
import type { TownClass } from './classify.ts';

function joined(
  aoe_org_id: string,
  slug: string,
  town_class: TownClass,
  values: (number | null)[],
  operated_by: string | null = null,
): JoinedRow {
  return {
    row: { aoe_org_id, name_as_published: slug, values },
    slug,
    town_class,
    entity: { slug, aoe_org_id, operated_by, type: 'town' } as RegistryEntity,
  };
}

describe('rolling towns up to districts', () => {
  it('sums union district members into their district', () => {
    const rollup = aggregate(
      [
        joined('T074', 'town/fairlee', 'union_district_member', [10, 5], 'ud/rivendell-interstate'),
        joined('T215', 'town/vershire', 'union_district_member', [20, 7], 'ud/rivendell-interstate'),
      ],
      2,
    );
    expect(rollup.districts).toHaveLength(1);
    expect(rollup.districts[0]?.district).toBe('ud/rivendell-interstate');
    expect(rollup.districts[0]?.values).toEqual([30, 12]);
    expect(rollup.districts[0]?.member_towns).toEqual(['town/fairlee', 'town/vershire']);
  });

  it('makes a town that is its own district a district in its own right', () => {
    const rollup = aggregate([joined('T037', 'town/burlington', 'own_district', [500, 300])], 2);
    expect(rollup.districts).toHaveLength(1);
    expect(rollup.districts[0]?.district).toBe('town/burlington');
    expect(rollup.districts[0]?.values).toEqual([500, 300]);
  });

  it('excludes buckets and out-of-state members, with a justification each', () => {
    const rollup = aggregate(
      [
        joined('T001', 'town/addison', 'union_district_member', [10, 5], 'ud/x'),
        joined('902', 'town/other-state-new-hampshire', 'residency_bucket', [0, 0]),
        joined('T999', 'town/orford-nh', 'out_of_state_member', [0, 0]),
      ],
      2,
    );
    expect(rollup.exclusions.map((e) => e.aoe_org_id).sort()).toEqual(['902', 'T999']);
    for (const e of rollup.exclusions) expect(e.justification).toMatch(/\S/);
  });

  it('excludes a town with real pupils and no operating district, and says so', () => {
    // Buels Gore reports 1 / 3 / 0 in ADM-25 and has no operating district. Its
    // pupils must be visible as an exclusion, never silently dropped.
    const rollup = aggregate(
      [
        joined('T001', 'town/addison', 'union_district_member', [10, 5], 'ud/x'),
        joined('T255', 'town/buels-gore', 'no_operating_district', [4, 0]),
      ],
      2,
    );
    const gore = rollup.exclusions.find((e) => e.aoe_org_id === 'T255');
    expect(gore?.total).toBe(4);
    expect(gore?.justification).toMatch(/no operating district/i);
    expect(rollup.district_band_totals).toEqual([10, 5]);
    expect(rollup.excluded_band_totals).toEqual([4, 0]);
    expect(rollup.town_band_totals).toEqual([14, 5]);
  });

  it('conserves every pupil: districts plus exclusions equal the town total', () => {
    const rollup = aggregate(
      [
        joined('T001', 'town/a', 'union_district_member', [10.5, 5.25], 'ud/x'),
        joined('T002', 'town/b', 'union_district_member', [1.5, 2.75], 'ud/x'),
        joined('T037', 'town/c', 'own_district', [100, 50]),
        joined('T255', 'town/d', 'no_operating_district', [4, 0]),
        joined('902', 'town/e', 'residency_bucket', [0, 0]),
      ],
      2,
    );
    for (let band = 0; band < 2; band++) {
      expect(
        Number(
          (
            (rollup.district_band_totals[band] ?? 0) + (rollup.excluded_band_totals[band] ?? 0)
          ).toFixed(2),
        ),
      ).toBe(rollup.town_band_totals[band]);
    }
  });

  it('treats a null as unknown rather than zero when summing a district', () => {
    // One town's missing count makes the district's count unknown. Coercing to
    // zero would publish a district total that is quietly too low.
    const rollup = aggregate(
      [
        joined('T001', 'town/a', 'union_district_member', [10, null], 'ud/x'),
        joined('T002', 'town/b', 'union_district_member', [5, 5], 'ud/x'),
      ],
      2,
    );
    expect(rollup.districts[0]?.values).toEqual([15, null]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tools/src/aoe/adm/aggregate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `aggregate.ts`**

```ts
/**
 * Rolls town-level ADM up to districts, and refuses to lose a pupil doing it.
 *
 * AOE publishes by resident district (town); § 4010 weights a school district's
 * membership. The obvious rule -- group by `operated_by` -- silently drops the 60
 * towns whose `operated_by` is null, among them Burlington, Rutland City and
 * Winooski, which are districts rather than district members.
 *
 * The conservation invariant is the guard. Every town's pupils land either in a
 * district total or in an individually justified exclusion, and the two must add
 * back to the town-level total per band. A rollup that loses pupils fails loudly
 * instead of publishing a plausible, smaller number.
 */

import { earnsVermontAdm, type TownClass } from './classify.ts';
import type { JoinedRow } from './join.ts';

export interface Exclusion {
  readonly aoe_org_id: string;
  readonly slug: string;
  readonly name_as_published: string;
  readonly town_class: TownClass;
  readonly values: ReadonlyArray<number | null>;
  readonly total: number;
  readonly justification: string;
}

export interface DistrictTotal {
  readonly district: string;
  readonly member_towns: ReadonlyArray<string>;
  readonly values: ReadonlyArray<number | null>;
}

export interface Rollup {
  readonly districts: ReadonlyArray<DistrictTotal>;
  readonly exclusions: ReadonlyArray<Exclusion>;
  readonly town_band_totals: ReadonlyArray<number>;
  readonly district_band_totals: ReadonlyArray<number>;
  readonly excluded_band_totals: ReadonlyArray<number>;
}

const JUSTIFICATION: Readonly<Record<TownClass, string>> = {
  union_district_member: 'included in its union district',
  own_district: 'is its own district',
  no_operating_district:
    'has no operating district, so its pupils belong to no district total. Excluded ' +
    'rather than dropped: the pupils are real and must stay visible.',
  out_of_state_member:
    'is a real out-of-state member town of an interstate district. Its pupils are ' +
    'that state’s, so it earns no Vermont ADM, but it is not a reporting bucket.',
  residency_bucket:
    'is an AOE residency reporting bucket rather than a place, and is awarded no ADM.',
};

/** Null is contagious: one town's unknown count makes the district's unknown. */
function addNullable(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  return Number((a + b).toFixed(2));
}

function sumBand(values: ReadonlyArray<ReadonlyArray<number | null>>, band: number): number {
  return Number(values.reduce((acc, v) => acc + (v[band] ?? 0), 0).toFixed(2));
}

export function aggregate(joined: ReadonlyArray<JoinedRow>, bandCount: number): Rollup {
  const byDistrict = new Map<string, { towns: string[]; values: (number | null)[] }>();
  const exclusions: Exclusion[] = [];

  for (const j of joined) {
    if (!earnsVermontAdm(j.town_class)) {
      const total = Number(j.row.values.reduce((a, v) => a + (v ?? 0), 0).toFixed(2));
      exclusions.push({
        aoe_org_id: j.row.aoe_org_id,
        slug: j.slug,
        name_as_published: j.row.name_as_published,
        town_class: j.town_class,
        values: j.row.values,
        total,
        justification: JUSTIFICATION[j.town_class],
      });
      continue;
    }

    // A union district member rolls into its district; a town that is its own
    // district is keyed by itself.
    const key =
      j.town_class === 'union_district_member' && j.entity.operated_by
        ? j.entity.operated_by
        : j.slug;

    const acc = byDistrict.get(key) ?? {
      towns: [],
      values: Array.from({ length: bandCount }, () => 0 as number | null),
    };
    acc.towns.push(j.slug);
    for (let b = 0; b < bandCount; b++) {
      acc.values[b] = addNullable(acc.values[b] ?? null, j.row.values[b] ?? null);
    }
    byDistrict.set(key, acc);
  }

  const districts: DistrictTotal[] = [...byDistrict.entries()]
    .map(([district, { towns, values }]) => ({
      district,
      member_towns: [...towns].sort(),
      values,
    }))
    .sort((a, b) => a.district.localeCompare(b.district));

  const town_band_totals = Array.from({ length: bandCount }, (_, b) =>
    sumBand(joined.map((j) => j.row.values), b),
  );
  const district_band_totals = Array.from({ length: bandCount }, (_, b) =>
    sumBand(districts.map((d) => d.values), b),
  );
  const excluded_band_totals = Array.from({ length: bandCount }, (_, b) =>
    sumBand(exclusions.map((e) => e.values), b),
  );

  for (let b = 0; b < bandCount; b++) {
    const recombined = Number(
      ((district_band_totals[b] ?? 0) + (excluded_band_totals[b] ?? 0)).toFixed(2),
    );
    const expected = town_band_totals[b] ?? 0;
    if (Math.abs(recombined - expected) > 0.005) {
      throw new Error(
        `Conservation failed for band ${b}: districts ${district_band_totals[b]} + ` +
          `exclusions ${excluded_band_totals[b]} = ${recombined}, but the town-level ` +
          `total is ${expected} (difference ${(recombined - expected).toFixed(2)}).\n\n` +
          `Every pupil must land in a district total or in a named exclusion. A ` +
          `mismatch means the rollup is losing towns -- which is exactly how an ` +
          `operated_by-keyed rollup would quietly drop Burlington, Rutland City and ` +
          `56 others. Do not relax this check; find the missing towns.`,
      );
    }
  }

  return {
    districts,
    exclusions,
    town_band_totals,
    district_band_totals,
    excluded_band_totals,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tools/src/aoe/adm/aggregate.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Add a real end-to-end conservation test**

Append to `tools/src/aoe/adm/aggregate.test.ts`:

```ts
describe.skipIf(
  !existsSync(
    join(REPO_ROOT, 'intake/aoe-adm/fy2024/edu-average-daily-membership-by-resident-district-fy24.xlsx'),
  ),
)('conservation against the real ADM-24 artifact', () => {
  it('conserves the pinned grand total across the rollup', async () => {
    const parsed = await parseReport(
      join(REPO_ROOT, 'intake/aoe-adm/fy2024/edu-average-daily-membership-by-resident-district-fy24.xlsx'),
    );
    const rollup = aggregate(joinRows(parsed.rows, readRegistry()), parsed.bands_as_published.length);

    const districts = rollup.district_band_totals.reduce((a, b) => a + b, 0);
    const excluded = rollup.excluded_band_totals.reduce((a, b) => a + b, 0);
    expect(Number((districts + excluded).toFixed(2))).toBeCloseTo(83987.27, 2);

    // Burlington must be a district in its own right, not a dropped town.
    expect(rollup.districts.map((d) => d.district)).toContain('town/burlington');
  });
});
```

Add the imports this needs at the top of the file: `existsSync` from `node:fs`, `join` from `node:path`, `REPO_ROOT` from `../../paths.ts`, `parseReport` from `./parse.ts`, `joinRows` from `./join.ts`, `readRegistry` from `../../registry/store.ts`.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add tools/src/aoe/adm/aggregate.ts tools/src/aoe/adm/aggregate.test.ts
git commit -m "Roll ADM up to districts under a conservation invariant

AOE publishes by resident district; 16 V.S.A. 4010 weights a school district's
membership, so towns must be rolled up. Grouping by operated_by alone would drop
the 60 towns whose operated_by is null -- Burlington, Rutland City, South
Burlington, Winooski and the rest -- without raising anything, producing a
statewide figure that looks plausible and is badly wrong.

The invariant makes that impossible. Every town's pupils land either in a district
total or in an individually justified exclusion, and the two must add back to the
town-level total in every band or the rollup throws. Buels Gore is the case that
proves it earns its keep: four real pupils in a town with no operating district,
which now appear as a named exclusion instead of evaporating.

Nulls stay contagious. One town's unknown count makes its district's count
unknown, because summing a null as zero publishes a district total that is
quietly too low."
```

---

### Task 9: Schemas and validator integration

**Why:** Three validator assumptions block an AOE source, all confirmed by running the validator: provenance `entity` must resolve to a registry entity; every warehouse YAML is validated as a budget record; and intake paths are per-SU per-FY. The third is already resolved by using `intake/aoe-adm/fy<YEAR>/`. **This task must land before any warehouse file is written**, or the first ADM commit breaks `npm run validate` for everyone.

**Files:**
- Create: `schemas/adm-1.0.schema.json`, `schemas/aoe-source-1.0.schema.json`
- Modify: `schemas/common-1.0.schema.json`, `tools/src/validate/schemas.ts`, `tools/src/validate/rules.ts`, `tools/src/cli/validate.ts`
- Test: `tools/src/validate/rules.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `SchemaName` gains `'adm' | 'aoe-source'`; `source/<slug>` refs validate without a registry entity; the warehouse walk dispatches by path.

- [ ] **Step 1: Write the failing test for the `source/` exemption**

Append to `tools/src/validate/rules.test.ts`:

```ts
describe('source references are not registry references', () => {
  // A statewide AOE dataset has no organization record in AOE's own API -- the
  // only state/ entity is Woodside, closed in 2020 -- so provenance for it
  // cannot name a registry entity. A source/ prefix says "this is a publisher,
  // not an organization in the registry" without weakening the rule that every
  // real entity slug must resolve.
  it('accepts a source/ slug with no registry entity', () => {
    const findings = checkRegistryRefs(
      { entity: 'source/aoe-adm' },
      'intake/aoe-adm/fy2024/provenance.yaml',
      new Map(),
    );
    expect(findings).toEqual([]);
  });

  it('still rejects an unknown entity slug', () => {
    const findings = checkRegistryRefs(
      { entity: 'town/nowhere' },
      'intake/aoe-adm/fy2024/provenance.yaml',
      new Map(),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toBe('registry-reference');
  });
});
```

Ensure `checkRegistryRefs` is imported in that test file; add it to the existing import if absent.

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tools/src/validate/rules.test.ts`
Expected: FAIL — the `source/aoe-adm` case returns one finding.

- [ ] **Step 3: Implement the exemption**

In `tools/src/validate/rules.ts`, replace the `ENTITY_REF` constant and add a source pattern:

```ts
const ENTITY_REF = /^(su|sd|ud|school|town|academy|techcenter|independent|state)\/[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * A publisher of data, rather than an organization in the registry.
 *
 * AOE publishes statewide datasets but has no organization record for itself --
 * the only `state/` entity is Woodside, closed 2020 -- so provenance for an AOE
 * artifact has nothing valid to name. A `source/` slug fills that gap without
 * hand-authoring a registry record, which matters because the registry is
 * generated and `registry:sync` would be free to discard one.
 */
const SOURCE_REF = /^source\/[a-z0-9]+(-[a-z0-9]+)*$/;
```

Then in `walk`, skip source refs before the entity check:

```ts
    if (typeof v === 'string') {
      if (SOURCE_REF.test(v)) return;
      if (ENTITY_REF.test(v) && !seen.has(v)) {
```

- [ ] **Step 4: Allow `source/` in the shared schema**

In `schemas/common-1.0.schema.json`, update `$defs.entity_ref.pattern` to include `source`:

```json
"pattern": "^(su|sd|ud|school|town|academy|techcenter|independent|state|source)/[a-z0-9]+(-[a-z0-9]+)*$"
```

Add to its `description`: ` A "source/" slug names a publisher of data rather than an organization in the registry, for datasets whose publisher has no organization record of its own.`

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- tools/src/validate/rules.test.ts`
Expected: PASS.

- [ ] **Step 6: Create `schemas/adm-1.0.schema.json`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:vt-budget:schema:adm:1.0",
  "title": "AOE average daily membership, one report year",
  "description": "A transcription of one AOE Average Daily Membership report, at the grain AOE publishes: by resident district, which is to say by town. This is the state's voice and is kept separate from the district-stated enrollment.adm figure in a budget record; where they disagree the discrepancy is recorded, never reconciled.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schema_version",
    "source",
    "count_year",
    "adm_label",
    "fiscal_year",
    "source_title",
    "bands_as_published",
    "maps_to_statutory_bands",
    "towns",
    "band_totals",
    "grand_total",
    "not_published",
    "extracted_by",
    "extracted_date"
  ],
  "properties": {
    "schema_version": { "const": "1.0" },
    "source": {
      "type": "string",
      "pattern": "^intake/[a-z0-9-]+/fy[0-9]{4}/[^\\s]+$",
      "description": "The hashed artifact this was transcribed from."
    },
    "count_year": {
      "type": "string",
      "pattern": "^[0-9]{4}-[0-9]{4}$",
      "description": "The school year pupils were counted, verbatim from the report's title row."
    },
    "adm_label": { "type": "integer", "minimum": 10, "maximum": 99 },
    "fiscal_year": {
      "type": "integer",
      "minimum": 2015,
      "maximum": 2100,
      "description": "The determination year and this project's single name for the year. Two years ahead of count_year: a FY2025 determination is made on pupils counted in SY2023-24."
    },
    "source_title": { "type": "string", "minLength": 1 },
    "bands_as_published": {
      "type": "array",
      "minItems": 1,
      "description": "The grade bands exactly as the report prints them. Never normalized: Act 127 changed the statutory bands effective July 1 2024, and a report's bands follow its determination year.",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["header", "statutory_band"],
        "properties": {
          "header": { "type": "string", "minLength": 1 },
          "statutory_band": {
            "type": ["string", "null"],
            "enum": [
              "prekindergarten",
              "kindergarten_through_5",
              "grades_6_through_8",
              "grades_9_through_12",
              null
            ],
            "description": "Null where the published band has no 16 V.S.A. 4010 counterpart. K-6 and 7-12 are null: grade 6 and grades 7-8 fall on opposite sides of the current bands and no arithmetic separates them."
          }
        }
      }
    },
    "maps_to_statutory_bands": {
      "type": "boolean",
      "description": "False means this year cannot feed the engine. It remains a valid cross-check and trend series."
    },
    "towns": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["entity", "aoe_org_id", "name_as_published", "town_class", "values"],
        "properties": {
          "entity": { "$ref": "urn:vt-budget:schema:common:1.0#/$defs/entity_ref" },
          "aoe_org_id": { "type": "string", "minLength": 1 },
          "name_as_published": {
            "type": "string",
            "description": "The name as the report prints it, kept for auditing. Never used to identify a town: 15 of 254 rows disagree with the registry."
          },
          "town_class": {
            "enum": [
              "union_district_member",
              "own_district",
              "no_operating_district",
              "out_of_state_member",
              "residency_bucket"
            ]
          },
          "values": {
            "type": "array",
            "minItems": 1,
            "description": "One entry per bands_as_published column, in the same order. Null means the report left the cell empty, which is not a zero.",
            "items": { "type": ["number", "null"], "minimum": 0 }
          }
        }
      }
    },
    "band_totals": {
      "type": "array",
      "minItems": 1,
      "items": { "type": "number", "minimum": 0 }
    },
    "grand_total": { "type": "number", "minimum": 0 },
    "not_published": {
      "type": "array",
      "description": "Fields 16 V.S.A. 4010 needs that this report does not publish, confirmed by a person against the artifact. A null must always mean 'the source did not publish this' and never 'we did not look'.",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["path", "confirmed_by", "confirmed_date", "note"],
        "properties": {
          "path": { "type": "string", "minLength": 1 },
          "confirmed_by": { "type": "string", "minLength": 1 },
          "confirmed_date": { "type": "string", "format": "date" },
          "note": { "type": "string", "minLength": 1 }
        }
      }
    },
    "extracted_by": { "type": "string", "minLength": 1 },
    "extracted_date": { "type": "string", "format": "date" }
  }
}
```

- [ ] **Step 7: Create `schemas/aoe-source-1.0.schema.json`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:vt-budget:schema:aoe-source:1.0",
  "title": "AOE published-dataset source manifest",
  "description": "Where an AOE dataset is published and what it offers, recorded so the knowledge does not live only in one person's head. education.vermont.gov returns HTTP 403 to every non-browser client, for page and direct file URLs alike, so acquisition is manual by necessity and this file is what makes the manual step repeatable.",
  "type": "object",
  "additionalProperties": false,
  "required": ["schema_version", "source", "page_url", "acquisition", "reports"],
  "properties": {
    "schema_version": { "const": "1.0" },
    "source": { "$ref": "urn:vt-budget:schema:common:1.0#/$defs/entity_ref" },
    "page_url": { "type": "string", "format": "uri" },
    "link_selector": {
      "type": ["string", "null"],
      "description": "CSS selector scoping the link list on the page. Recorded because it is the scoping fact, but positional and therefore fragile: AOE adding one accordion section above it moves the match silently. Link text is the primary matcher."
    },
    "link_text_pattern": {
      "type": ["string", "null"],
      "description": "The stable matcher. Hrefs come in three incompatible slug eras across the ten published years, so a URL pattern finds five of them and misses the rest."
    },
    "acquisition": {
      "type": "object",
      "additionalProperties": false,
      "required": ["method", "detection", "notes"],
      "properties": {
        "method": { "enum": ["http-fetch", "scrape", "manual"] },
        "detection": { "enum": ["page_hash", "link_scan", "none"] },
        "notes": { "type": ["string", "null"] }
      }
    },
    "reports": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["adm_label", "fiscal_year", "count_year", "url", "grain", "held"],
        "properties": {
          "adm_label": { "type": "integer", "minimum": 10, "maximum": 99 },
          "fiscal_year": { "type": "integer", "minimum": 2015, "maximum": 2100 },
          "count_year": { "type": "string", "pattern": "^[0-9]{4}-[0-9]{4}$" },
          "url": { "type": "string", "format": "uri" },
          "grain": { "type": "string", "minLength": 1 },
          "held": {
            "type": "boolean",
            "description": "Whether the artifact is in intake/ yet."
          }
        }
      }
    }
  }
}
```

- [ ] **Step 8: Register both schemas**

In `tools/src/validate/schemas.ts`, extend the `SchemaName` union and `SCHEMA_IDS`:

```ts
export type SchemaName =
  | 'budget'
  | 'registry'
  | 'provenance'
  | 'collector'
  | 'parameters'
  | 'grouping'
  | 'mapping'
  | 'adm'
  | 'aoe-source';

const SCHEMA_IDS: Readonly<Record<SchemaName, string>> = {
  budget: 'urn:vt-budget:schema:budget:1.0',
  registry: 'urn:vt-budget:schema:registry:1.0',
  provenance: 'urn:vt-budget:schema:provenance:1.0',
  collector: 'urn:vt-budget:schema:collector:1.0',
  parameters: 'urn:vt-budget:schema:parameters:1.0',
  grouping: 'urn:vt-budget:schema:grouping:1.0',
  mapping: 'urn:vt-budget:schema:mapping:1.0',
  adm: 'urn:vt-budget:schema:adm:1.0',
  'aoe-source': 'urn:vt-budget:schema:aoe-source:1.0',
};
```

- [ ] **Step 9: Make the warehouse walk discriminate**

In `tools/src/cli/validate.ts`, replace the warehouse loop (around lines 155-166) so ADM files are validated against their own schema:

```ts
  // --- warehouse ----------------------------------------------------------
  for (const file of walkFiles(PATHS.warehouse, (n) => n.endsWith('.yaml') || n.endsWith('.json'))) {
    counts.warehouse++;
    const data = readData(file);

    // The warehouse holds more than budget records now. Dispatching on the path
    // rather than validating everything as a budget keeps an ADM series from
    // being reported as a budget missing every field a budget has.
    const relative = rel(file);
    if (relative.startsWith('warehouse/aoe-adm/')) {
      if (relative.endsWith('/gaps.yaml')) continue;
      findings.push(...schemaFindings('adm', data, file));
      findings.push(...checkRegistryRefs(data, file, registry));
      continue;
    }

    const record = data as BudgetRecord;
    const schemaProblems = schemaFindings('budget', record, file);
    findings.push(...schemaProblems);

    // Cross-file rules assume a well-formed record; running them on a
    // malformed one produces noise that buries the real error.
    if (schemaProblems.length > 0) continue;

    findings.push(...checkRegistryRefs(record, file, registry));
```

Keep the remainder of the original loop body unchanged after this point. Ensure `rel` is imported from `../paths.ts` in that file; add it if absent.

- [ ] **Step 10: Add intake source-manifest validation**

In `tools/src/cli/validate.ts`, immediately after the intake provenance loop, add:

```ts
  // --- AOE source manifests -----------------------------------------------
  for (const file of walkFiles(PATHS.intake, (n) => n === 'source.yaml')) {
    const data = readData(file);
    findings.push(...schemaFindings('aoe-source', data, file));
    findings.push(...checkRegistryRefs(data, file, registry));
  }
```

- [ ] **Step 11: Run tests and validate**

Run: `npm test && npm run typecheck && npm run validate`
Expected: tests pass, typecheck clean, `0 error(s), 3 warning(s)`.

- [ ] **Step 12: Commit**

```bash
git add schemas/adm-1.0.schema.json schemas/aoe-source-1.0.schema.json \
        schemas/common-1.0.schema.json tools/src/validate/schemas.ts \
        tools/src/validate/rules.ts tools/src/validate/rules.test.ts \
        tools/src/cli/validate.ts
git commit -m "Teach the validator about a statewide published source

Three assumptions blocked an AOE dataset, each confirmed by running the validator
rather than reading it.

Provenance required entity to resolve to a registry entity, and AOE publishes no
organization record for itself -- the only state/ entity is Woodside, closed in
2020. A source/ prefix names a publisher rather than an organization, so
provenance for a statewide dataset has something true to say, while every real
entity slug must still resolve. Hand-authoring a registry record was rejected: the
registry is generated, and registry:sync would be free to discard it.

Every warehouse YAML was validated as a budget record, so the first ADM series
file would have emitted a dozen errors about missing revenues and expenditures.
The walk now dispatches on path.

The adm schema keeps bands_as_published verbatim and carries
maps_to_statutory_bands, so a pre-Act-127 year is a first-class record that
declares itself unusable by the engine rather than being silently normalized into
bands it does not have. The aoe-source schema records the page, the fragile
positional selector, and the link-text pattern that is the actual matcher."
```

---

### Task 10: The § 4010 gap register

**Files:**
- Create: `tools/src/aoe/adm/gaps.ts`
- Test: `tools/src/aoe/adm/gaps.test.ts`

**Interfaces:**
- Consumes: `ParsedReport` (Task 6).
- Produces:
  - `interface GapEntry { readonly input: string; readonly statute: string; readonly supplied: boolean; readonly note: string }`
  - `buildGapRegister(reports: ReadonlyArray<{ readonly fiscal_year: number; readonly maps_to_statutory_bands: boolean }>): { readonly generated_from: ReadonlyArray<number>; readonly engine_eligible_years: ReadonlyArray<number>; readonly entries: ReadonlyArray<GapEntry>; readonly weighted_membership_blocked_because: ReadonlyArray<string> }`

- [ ] **Step 1: Write the failing test**

Create `tools/src/aoe/adm/gaps.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { buildGapRegister } from './gaps.ts';

describe('the § 4010 gap register', () => {
  const register = buildGapRegister([
    { fiscal_year: 2024, maps_to_statutory_bands: false },
    { fiscal_year: 2025, maps_to_statutory_bands: true },
  ]);

  it('reports only band-compatible years as engine eligible', () => {
    expect(register.engine_eligible_years).toEqual([2025]);
  });

  it('records ADM as supplied and everything else as absent', () => {
    const supplied = register.entries.filter((e) => e.supplied).map((e) => e.input);
    const absent = register.entries.filter((e) => !e.supplied).map((e) => e.input);
    expect(supplied).toContain('adm.kindergarten_through_5');
    expect(absent).toContain('adm.prekindergarten');
    expect(absent).toContain('poverty_185_fpl');
    expect(absent).toContain('english_learners');
    expect(absent).toContain('state_placed_fte');
    expect(absent).toContain('persons_per_square_mile');
  });

  it('cites a statute section for every entry', () => {
    for (const e of register.entries) expect(e.statute).toMatch(/4001|4010/);
  });

  it('states every independent reason a total is blocked', () => {
    expect(register.weighted_membership_blocked_because.length).toBeGreaterThanOrEqual(3);
    expect(register.weighted_membership_blocked_because.join(' ')).toMatch(/two-year average/i);
    expect(register.weighted_membership_blocked_because.join(' ')).toMatch(/prekindergarten/i);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tools/src/aoe/adm/gaps.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `gaps.ts`**

```ts
/**
 * What § 4010 needs, and what this source actually supplies.
 *
 * The point is to make a null explicable. The site renders this so the "show
 * your work" walkthrough can say WHY a weighted-membership figure is absent
 * instead of rendering a blank, and so nobody re-derives the answer to "why
 * can't we just compute it" a year from now.
 */

export interface GapEntry {
  readonly input: string;
  readonly statute: string;
  readonly supplied: boolean;
  readonly note: string;
}

const ENTRIES: readonly GapEntry[] = [
  {
    input: 'adm.kindergarten_through_5',
    statute: '16 V.S.A. § 4010(b)(1)(B)',
    supplied: true,
    note: 'Published, in reports whose bands match the current statutory bands.',
  },
  {
    input: 'adm.grades_6_through_8',
    statute: '16 V.S.A. § 4010(d)(1)',
    supplied: true,
    note: 'Published, in reports whose bands match the current statutory bands.',
  },
  {
    input: 'adm.grades_9_through_12',
    statute: '16 V.S.A. § 4010(d)(1)',
    supplied: true,
    note: 'Published, in reports whose bands match the current statutory bands.',
  },
  {
    input: 'adm.prekindergarten',
    statute: '16 V.S.A. § 4010(d)(1)',
    supplied: false,
    note:
      'No AOE resident-district report publishes a prekindergarten column at all. The ' +
      'value is null, never zero, and the absence is confirmed against the artifact.',
  },
  {
    input: 'state_placed_fte',
    statute: '16 V.S.A. § 4001(7)(B)',
    supplied: false,
    note:
      'Not in this report. State-placed students are excluded from the two-year average ' +
      'and added at their most recent count, so this is a distinct input rather than a ' +
      'subset of ADM.',
  },
  {
    input: 'poverty_185_fpl',
    statute: '16 V.S.A. § 4010(d)(2)',
    supplied: false,
    note: 'Not in this report. A separate AOE source with its own provenance.',
  },
  {
    input: 'english_learners',
    statute: '16 V.S.A. § 4010(d)(3)',
    supplied: false,
    note: 'Not in this report. A separate AOE source with its own provenance.',
  },
  {
    input: 'persons_per_square_mile',
    statute: '16 V.S.A. § 4010(b)(2), (d)(4)',
    supplied: false,
    note:
      'Not in this report. Also gates the small-school weight under (d)(5), so its ' +
      'absence blocks two weights rather than one.',
  },
  {
    input: 'small_school.average_two_year_enrollment',
    statute: '16 V.S.A. § 4010(b)(3)(B), (d)(5)',
    supplied: false,
    note: 'Not in this report. Per-school, not per-town, so it cannot be derived from ADM.',
  },
];

export function buildGapRegister(
  reports: ReadonlyArray<{ readonly fiscal_year: number; readonly maps_to_statutory_bands: boolean }>,
): {
  readonly generated_from: ReadonlyArray<number>;
  readonly engine_eligible_years: ReadonlyArray<number>;
  readonly entries: ReadonlyArray<GapEntry>;
  readonly weighted_membership_blocked_because: ReadonlyArray<string>;
} {
  const eligible = reports
    .filter((r) => r.maps_to_statutory_bands)
    .map((r) => r.fiscal_year)
    .sort((a, b) => a - b);

  return {
    generated_from: reports.map((r) => r.fiscal_year).sort((a, b) => a - b),
    engine_eligible_years: eligible,
    entries: ENTRIES,
    weighted_membership_blocked_because: [
      'Long-term membership under § 4001(7) is a two-year average, and the published ' +
        'reports change grade bands at the Act 127 boundary of July 1 2024. K-6 / 7-12 ' +
        'cannot be reduced to K-5 / 6-8 / 9-12 because grade 6 and grades 7-8 fall on ' +
        'opposite sides and no report publishes grade-level detail, so no two consecutive ' +
        'years share a band regime.',
      'The report publishes no prekindergarten column, so that band is null for every year.',
      'Four further § 4010 inputs come from sources not yet imported: state-placed FTE, ' +
        'pupils at or below 185 percent of FPL, English learner counts, and district ' +
        'population density.',
      'The prekindergarten weight itself is unverifiable while the Act 73 contingency ' +
        'stands, so the engine already declines to total on it independently.',
    ],
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tools/src/aoe/adm/gaps.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/src/aoe/adm/gaps.ts tools/src/aoe/adm/gaps.test.ts
git commit -m "Record what § 4010 needs that this source does not supply

Importing ADM does not unblock a weighted-membership total, and the reasons are
worth stating in data rather than leaving someone to rediscover them. The register
names each statutory input, cites its section, and says whether this source
carries it: three ADM bands yes, prekindergarten no, and state-placed FTE,
poverty, English learners, density and small-school enrollment all no.

It also lists the four independent reasons a total is blocked, so a null in the
walkthrough can explain itself instead of rendering blank. Only years whose bands
match the current statutory bands are reported engine eligible."
```

---

### Task 11: Link discovery from a saved page snapshot

**Files:**
- Create: `tools/src/aoe/adm/discover.ts`
- Test: `tools/src/aoe/adm/discover.test.ts`

**Interfaces:**
- Consumes: `normalizeLinkText`, `parseLinkText` (Task 5).
- Produces:
  - `interface DiscoveredReport { readonly url: string; readonly text: string; readonly adm_label: number; readonly fiscal_year: number; readonly count_year: string; readonly grain: string }`
  - `discoverFromHtml(html: string): ReadonlyArray<DiscoveredReport>`

- [ ] **Step 1: Write the failing test**

Create `tools/src/aoe/adm/discover.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { discoverFromHtml } from './discover.ts';

// The real markup from the page's accordion, including the entity and
// invisible-character quirks in the two oldest links.
const HTML = `<ul>
<li><a href="https://education.vermont.gov/documents/average-daily-membership-by-resident-district-fy24" target="_blank">2022-2023 (ADM-24) Resident District Report</a></li>
<li><a href="https://education.vermont.gov/documents/2017-2018-adm-19-resident-district-report" target="_blank">2017-2018 (ADM-19) Resident District Report</a></li>
<li><a href="https://education.vermont.gov/documents/data-average-daily-membership-resident-district-adm16" target="_blank">2014-2015&nbsp;(ADM-16)&nbsp;Resident District Report​</a></li>
<li><a href="/about/news">Unrelated link</a></li>
</ul>`;

describe('discovering ADM reports from a saved page snapshot', () => {
  it('finds every ADM link and ignores unrelated ones', () => {
    const found = discoverFromHtml(HTML);
    expect(found).toHaveLength(3);
    expect(found.map((f) => f.adm_label)).toEqual([24, 19, 16]);
  });

  it('reads the years from the link text, not the URL', () => {
    // The three URL slug eras are mutually incompatible, so the href cannot be
    // the matcher: it would find era A and miss B and C.
    const found = discoverFromHtml(HTML);
    expect(found[1]?.fiscal_year).toBe(2019);
    expect(found[1]?.count_year).toBe('2017-2018');
    expect(found[2]?.fiscal_year).toBe(2016);
    expect(found[2]?.count_year).toBe('2014-2015');
  });

  it('normalizes the invisible characters in the oldest link', () => {
    const found = discoverFromHtml(HTML);
    expect(found[2]?.text).toBe('2014-2015 (ADM-16) Resident District Report');
    expect(found[2]?.grain).toBe('Resident District Report');
  });

  it('returns nothing rather than throwing when the markup has no ADM links', () => {
    expect(discoverFromHtml('<ul><li><a href="/x">Something else</a></li></ul>')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tools/src/aoe/adm/discover.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `discover.ts`**

```ts
/**
 * Finds the ADM reports a saved page snapshot offers.
 *
 * This is the automation that pays for itself, in the terms
 * tools/src/cli/collect.ts already sets out: detection, not retrieval. Nobody
 * has to remember to check the page next August -- the diff between what the
 * snapshot lists and what intake/ holds is the answer.
 *
 * It matches on LINK TEXT. The hrefs come in three incompatible slug eras across
 * the ten published years:
 *
 *   A  average-daily-membership-by-resident-district-fyNN     ADM-20..25
 *   B  YYYY-YYYY-adm-NN-resident-district-report              ADM-18, 19
 *   C  data-average-daily-membership-resident-district-admNN  ADM-16, 17
 *
 * so a URL pattern finds five and silently misses the rest. The link text is
 * uniform across all ten.
 *
 * Regex over HTML rather than a DOM parser, following the precedent in
 * tools/src/statute/fetch.ts, so no dependency is added for one link list.
 */

import { normalizeLinkText, parseLinkText } from './year.ts';

export interface DiscoveredReport {
  readonly url: string;
  readonly text: string;
  readonly adm_label: number;
  readonly fiscal_year: number;
  readonly count_year: string;
  readonly grain: string;
}

const LINK = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

export function discoverFromHtml(html: string): ReadonlyArray<DiscoveredReport> {
  const found: DiscoveredReport[] = [];

  for (const m of html.matchAll(LINK)) {
    const url = m[1] as string;
    // Strip any nested markup before normalizing, so <em> inside a label does
    // not become part of the text.
    const text = normalizeLinkText((m[2] as string).replace(/<[^>]+>/g, ''));
    let parsed;
    try {
      parsed = parseLinkText(text);
    } catch {
      // Not an ADM report link. The page carries plenty of others.
      continue;
    }
    found.push({
      url,
      text,
      adm_label: parsed.adm_label,
      fiscal_year: parsed.fiscal_year,
      count_year: parsed.count_year,
      grain: parsed.grain,
    });
  }

  return found;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tools/src/aoe/adm/discover.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/src/aoe/adm/discover.ts tools/src/aoe/adm/discover.test.ts
git commit -m "Discover available ADM years from a saved page snapshot

Detection is the part worth automating, as collect.ts already argues: retrieval
stays manual because the host refuses every non-browser client, but nobody should
have to remember to check the page next August. Diffing what the snapshot lists
against what intake holds answers that.

Matching is on link text. The hrefs fall into three mutually incompatible slug
eras across the ten published years, so a URL pattern finds five and misses the
rest, while the link text is uniform across all ten. Unparseable links are
skipped rather than fatal, because the page carries many links that are not ADM
reports. Regex over HTML follows the precedent in statute/fetch.ts and avoids
adding a DOM dependency for one link list."
```

---

### Task 12: The `adm:import` CLI

**Files:**
- Create: `tools/src/cli/adm-import.ts`
- Modify: `package.json`
- Replace: `intake/aoe-adm/fy2024/NOTES.md` → `intake/aoe-adm/fy2024/provenance.yaml`
- Create: `intake/aoe-adm/source.yaml`

**Interfaces:**
- Consumes: everything from Tasks 4–11.
- Produces: `npm run adm:import` writing `warehouse/aoe-adm/adm<NN>.yaml` and `warehouse/aoe-adm/gaps.yaml`.

- [ ] **Step 1: Add the npm script**

In `package.json`, after the `"extract"` line:

```json
    "adm:import": "tsx tools/src/cli/adm-import.ts",
```

- [ ] **Step 2: Write the CLI**

Create `tools/src/cli/adm-import.ts`:

```ts
#!/usr/bin/env node
/**
 * Imports AOE average daily membership reports.
 *
 *   npm run adm:import                 import every artifact in intake/aoe-adm
 *   npm run adm:import -- --check      parse and report, write nothing
 *   npm run adm:import -- --discover   list years the saved page snapshot offers
 *
 * Retrieval is not automated and cannot be: education.vermont.gov returns HTTP
 * 403 to every non-browser client, for page and direct file URLs alike, and
 * AGENT.md rules out working around it. A human downloads the files. Everything
 * after that is deterministic.
 */

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, join } from 'node:path';

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import { walkFiles } from '../fs-walk.ts';
import { PATHS, rel } from '../paths.ts';
import { readRegistry } from '../registry/store.ts';
import { aggregate } from '../aoe/adm/aggregate.ts';
import { discoverFromHtml } from '../aoe/adm/discover.ts';
import { buildGapRegister } from '../aoe/adm/gaps.ts';
import { joinRows } from '../aoe/adm/join.ts';
import { parseReport, type ParsedReport } from '../aoe/adm/parse.ts';

const ADM_INTAKE = join(PATHS.intake, 'aoe-adm');
const ADM_WAREHOUSE = join(PATHS.warehouse, 'aoe-adm');

function artifacts(): string[] {
  if (!existsSync(ADM_INTAKE)) return [];
  return walkFiles(ADM_INTAKE, (n) => /\.xlsx?$/i.test(n)).sort();
}

/** The person recorded as having confirmed what the source does not publish. */
function extractedBy(file: string): string {
  const provenance = join(dirname(file), 'provenance.yaml');
  if (existsSync(provenance)) {
    const data = parseYaml(readFileSync(provenance, 'utf8')) as {
      artifacts?: Array<{ file?: string; retrieved_by?: string }>;
    };
    const entry = data.artifacts?.find((a) => a.file === basename(file));
    if (entry?.retrieved_by) return entry.retrieved_by;
  }
  throw new Error(
    `${rel(file)} has no provenance entry naming who retrieved it.\n\n` +
      `The import records a person against every "the source does not publish this" ` +
      `finding, so that a null always means the source was silent and never that nobody ` +
      `looked. Write ${rel(join(dirname(file), 'provenance.yaml'))} first.`,
  );
}

function sha256(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function verifyHash(file: string): void {
  const provenance = join(dirname(file), 'provenance.yaml');
  if (!existsSync(provenance)) return;
  const data = parseYaml(readFileSync(provenance, 'utf8')) as {
    artifacts?: Array<{ file?: string; sha256?: string }>;
  };
  const entry = data.artifacts?.find((a) => a.file === basename(file));
  if (entry?.sha256 && entry.sha256 !== sha256(file)) {
    throw new Error(
      `${rel(file)} does not match the sha256 in its provenance. A raw artifact is never ` +
        `edited, so a mismatch means the file changed after it was recorded. Re-download ` +
        `it and record the new hash as a superseding artifact rather than overwriting.`,
    );
  }
}

function toRecord(file: string, parsed: ParsedReport): Record<string, unknown> {
  const registry = readRegistry();
  const joined = joinRows(parsed.rows, registry);
  const rollup = aggregate(joined, parsed.bands_as_published.length);
  const who = extractedBy(file);
  const today = new Date().toISOString().slice(0, 10);

  // Recorded per year, against the artifact, so the null is a finding.
  const notPublished = [
    {
      path: 'adm.prekindergarten',
      confirmed_by: who,
      confirmed_date: today,
      note:
        'The AOE resident-district report publishes no prekindergarten column. This is ' +
        'a confirmed absence in the source, not an unfilled field.',
    },
  ];

  return {
    schema_version: '1.0',
    source: rel(file),
    count_year: parsed.labels.count_year,
    adm_label: parsed.labels.adm_label,
    fiscal_year: parsed.labels.fiscal_year,
    source_title: parsed.labels.source_title,
    bands_as_published: parsed.bands_as_published,
    maps_to_statutory_bands: parsed.maps_to_statutory_bands,
    towns: joined.map((j) => ({
      entity: j.slug,
      aoe_org_id: j.row.aoe_org_id,
      name_as_published: j.row.name_as_published,
      town_class: j.town_class,
      values: j.row.values,
    })),
    band_totals: parsed.band_totals,
    grand_total: parsed.grand_total,
    not_published: notPublished,
    extracted_by: who,
    extracted_date: today,
    // Reported, not stored: the rollup is derived and must not be committed.
    _rollup_summary: {
      districts: rollup.districts.length,
      exclusions: rollup.exclusions.length,
    },
  };
}

function write(path: string, header: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${header}\n${stringifyYaml(data, { lineWidth: 88 })}`, 'utf8');
  console.log(`  wrote ${rel(path)}`);
}

function discover(): number {
  const snapshots = existsSync(ADM_INTAKE)
    ? walkFiles(ADM_INTAKE, (n) => n.endsWith('.html')).sort()
    : [];
  if (snapshots.length === 0) {
    console.error(
      `No saved page snapshot under ${rel(ADM_INTAKE)}.\n\n` +
        `The page cannot be fetched: education.vermont.gov returns 403 to every ` +
        `non-browser client. Save it from a browser as page-<date>.html.`,
    );
    return 1;
  }

  const latest = snapshots[snapshots.length - 1] as string;
  const found = discoverFromHtml(readFileSync(latest, 'utf8'));
  const held = new Set(artifacts().map((f) => basename(f)));

  console.log(`${found.length} ADM report(s) listed in ${rel(latest)}:\n`);
  for (const r of found) {
    const have = [...held].some((f) => new RegExp(`(?:fy|adm)[-_]?${r.adm_label}(?!\\d)`, 'i').test(f));
    console.log(`  ${have ? 'have' : 'MISSING'}  FY${r.fiscal_year}  SY${r.count_year}  ${r.url}`);
  }
  return 0;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.includes('--discover')) return discover();

  const check = argv.includes('--check');
  const files = artifacts();
  if (files.length === 0) {
    console.error(
      `No ADM spreadsheets under ${rel(ADM_INTAKE)}.\n\n` +
        `Download them from the AOE page by hand -- the host refuses scripted clients -- ` +
        `into ${rel(ADM_INTAKE)}/fy<YEAR>/.`,
    );
    return 1;
  }

  const summaries: Array<{ fiscal_year: number; maps_to_statutory_bands: boolean }> = [];

  for (const file of files) {
    console.log(`\n${rel(file)}`);
    verifyHash(file);
    const parsed = await parseReport(file);
    console.log(
      `  FY${parsed.labels.fiscal_year}  SY${parsed.labels.count_year}  ` +
        `${parsed.rows.length} town(s)  ` +
        `bands ${parsed.bands_as_published.map((b) => b.header).join(' | ')}`,
    );
    console.log(
      `  totals ${parsed.band_totals.join(' / ')} = ${parsed.grand_total}` +
        `  ${parsed.maps_to_statutory_bands ? 'maps to § 4010 bands' : 'PRE-ACT-127 bands: not engine input'}`,
    );

    const record = toRecord(file, parsed);
    const summary = record['_rollup_summary'] as { districts: number; exclusions: number };
    console.log(`  ${summary.districts} district(s), ${summary.exclusions} exclusion(s)`);
    delete record['_rollup_summary'];

    summaries.push({
      fiscal_year: parsed.labels.fiscal_year,
      maps_to_statutory_bands: parsed.maps_to_statutory_bands,
    });

    if (!check) {
      write(
        join(ADM_WAREHOUSE, `adm${parsed.labels.adm_label}.yaml`),
        `# AOE average daily membership, ${parsed.labels.source_title}\n` +
          `#\n` +
          `# Transcribed from ${rel(file)} by npm run adm:import. Do not hand-edit:\n` +
          `# re-run the import instead, so the record always matches the hashed artifact.\n` +
          `#\n` +
          `# bands_as_published is verbatim and is never normalized. Act 127 changed the\n` +
          `# statutory grade bands effective July 1 2024, and a report's bands follow its\n` +
          `# determination year, so years either side of that boundary are not comparable\n` +
          `# band to band.`,
        record,
      );
    }
  }

  if (!check) {
    write(
      join(ADM_WAREHOUSE, 'gaps.yaml'),
      `# What 16 V.S.A. § 4010 needs that the AOE resident-district report does not\n` +
        `# supply. Generated by npm run adm:import. The site reads this so a null in the\n` +
        `# walkthrough can say why it is null.`,
      buildGapRegister(summaries),
    );
  }

  console.log(
    `\n${files.length} report(s) ${check ? 'checked' : 'imported'}. ` +
      `Engine-eligible years: ${summaries.filter((s) => s.maps_to_statutory_bands).map((s) => s.fiscal_year).join(', ') || 'none'}.`,
  );
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`\n${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  },
);
```

- [ ] **Step 3: Write the provenance file, replacing NOTES.md**

Create `intake/aoe-adm/fy2024/provenance.yaml`, taking the values from `intake/aoe-adm/fy2024/NOTES.md`:

```yaml
schema_version: "1.0"
entity: source/aoe-adm
fiscal_year: 2024
artifacts:
  - file: edu-average-daily-membership-by-resident-district-fy24.xlsx
    source_url: https://education.vermont.gov/sites/aoe/files/documents/edu-average-daily-membership-by-resident-district-fy24.xlsx
    retrieved_date: "2026-07-29"
    retrieval_method: manual-download
    sha256: 50f4355c2b6f9d137fbec82d41b32dd7c9326e872550a998546e0e989a94e424
    bytes: 26499
    media_type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
    retrieved_by: James Nadeau
    document_type: aoe_report
    note: >-
      Average Daily Membership (ADM) Report for 2022-2023 (ADM-24) by Resident
      District. Downloaded in a browser because education.vermont.gov returns
      HTTP 403 to every non-browser client, for page and direct file URLs alike.
      Publishes two grade bands, Elem (K-6) and SEC (7-12), which are
      pre-Act-127 and not reducible to the K-5 / 6-8 / 9-12 bands 16 V.S.A.
      § 4010 weights.
```

Then delete `intake/aoe-adm/fy2024/NOTES.md`.

Verify the recorded hash is still correct:

```bash
sha256sum intake/aoe-adm/fy2024/edu-average-daily-membership-by-resident-district-fy24.xlsx
```

Expected: `50f4355c2b6f9d137fbec82d41b32dd7c9326e872550a998546e0e989a94e424`.

- [ ] **Step 4: Create the source manifest**

Create `intake/aoe-adm/source.yaml`. The `held` flag is `true` only for FY2024 until more files are downloaded.

```yaml
schema_version: "1.0"
source: source/aoe-adm
page_url: https://education.vermont.gov/accountability-data/school-reports/average-daily-membership
# Positional and therefore fragile: AOE adding one accordion section above this
# moves the match silently. Recorded because it is the scoping fact, but the
# link text is the matcher.
link_selector: "#block-agency-template-content > article:nth-child(1) > div:nth-child(2) > div:nth-child(1) > details:nth-child(9) > div:nth-child(2)"
link_text_pattern: "YYYY-YYYY (ADM-NN) Resident District Report"
acquisition:
  method: manual
  detection: link_scan
  notes: >-
    education.vermont.gov returns HTTP 403 to every non-browser client. Verified
    for both the document page and the direct file URL, byte-identically, and
    verified that this is a CloudFront WAF refusal after a successful TLS
    handshake rather than the incomplete certificate chain AGENT.md documents for
    legislature.vermont.gov -- that host's AIA repair does not apply here. There
    is no Wayback snapshot, and the AOE Public Data API carries no membership
    data. Download by hand from a browser; do not attempt to defeat the block.
reports:
  - { adm_label: 25, fiscal_year: 2025, count_year: "2023-2024", grain: Resident District Report, held: false,
      url: "https://education.vermont.gov/sites/aoe/files/documents/edu-average-daily-membership-by-resident-district-fy25.xlsx" }
  - { adm_label: 24, fiscal_year: 2024, count_year: "2022-2023", grain: Resident District Report, held: true,
      url: "https://education.vermont.gov/sites/aoe/files/documents/edu-average-daily-membership-by-resident-district-fy24.xlsx" }
  - { adm_label: 23, fiscal_year: 2023, count_year: "2021-2022", grain: Resident District Report, held: false,
      url: "https://education.vermont.gov/documents/average-daily-membership-by-resident-district-fy23" }
  - { adm_label: 22, fiscal_year: 2022, count_year: "2020-2021", grain: Resident District Report, held: false,
      url: "https://education.vermont.gov/documents/average-daily-membership-by-resident-district-fy22" }
  - { adm_label: 21, fiscal_year: 2021, count_year: "2019-2020", grain: Resident District Report, held: false,
      url: "https://education.vermont.gov/documents/average-daily-membership-by-resident-district-fy21" }
  - { adm_label: 20, fiscal_year: 2020, count_year: "2018-2019", grain: Resident District Report, held: false,
      url: "https://education.vermont.gov/documents/average-daily-membership-by-resident-district-fy20" }
  - { adm_label: 19, fiscal_year: 2019, count_year: "2017-2018", grain: Resident District Report, held: false,
      url: "https://education.vermont.gov/documents/2017-2018-adm-19-resident-district-report" }
  - { adm_label: 18, fiscal_year: 2018, count_year: "2016-2017", grain: Resident District Report, held: false,
      url: "https://education.vermont.gov/documents/2016-2017-adm-18-resident-district-report" }
  - { adm_label: 17, fiscal_year: 2017, count_year: "2015-2016", grain: Resident District Report, held: false,
      url: "https://education.vermont.gov/documents/data-average-daily-membership-resident-district-adm17" }
  - { adm_label: 16, fiscal_year: 2016, count_year: "2014-2015", grain: Resident District Report, held: false,
      url: "https://education.vermont.gov/documents/data-average-daily-membership-resident-district-adm16" }
```

- [ ] **Step 5: Dry-run the import**

Run: `npm run adm:import -- --check`

Expected output includes:

```
intake/aoe-adm/fy2024/edu-average-daily-membership-by-resident-district-fy24.xlsx
  FY2024  SY2022-2023  254 town(s)  bands Elem ( K - 6) | SEC ( 7 - 12)
  totals 47301.13 / 36686.14 = 83987.27  PRE-ACT-127 bands: not engine input
  ... district(s), ... exclusion(s)

1 report(s) checked. Engine-eligible years: none.
```

If conservation throws, **do not relax the check** — read the error, find the missing towns, and fix `classify.ts` or `aggregate.ts`.

- [ ] **Step 6: Run the real import**

Run: `npm run adm:import`
Expected: writes `warehouse/aoe-adm/adm24.yaml` and `warehouse/aoe-adm/gaps.yaml`.

- [ ] **Step 7: Validate**

Run: `npm run validate`
Expected: `0 error(s), 3 warning(s)`. The new `provenance.yaml`, `source.yaml` and `warehouse/aoe-adm/adm24.yaml` all validate. If the ADM record fails, fix the schema or the CLI — not by loosening `required`.

- [ ] **Step 8: Run everything**

Run: `npm test && npm run typecheck && npm run validate`
Expected: all clean.

- [ ] **Step 9: Commit**

```bash
git add package.json tools/src/cli/adm-import.ts intake/aoe-adm warehouse/aoe-adm
git rm --cached intake/aoe-adm/fy2024/NOTES.md 2>/dev/null || true
git add -A intake/aoe-adm
git commit -m "Add the adm:import CLI, provenance and the source manifest

The CLI verifies each artifact against its recorded hash, parses it, joins to the
registry, rolls up under the conservation invariant, and writes a warehouse
transcription plus the gap register. It refuses to run against an artifact with no
provenance entry naming who retrieved it, because every 'the source does not
publish this' finding is recorded against a person -- that is what keeps a null
meaning the source was silent rather than that nobody looked.

Provenance now validates, using the source/aoe-adm slug the previous commit
introduced, and replaces the interim NOTES.md. The source manifest records all ten
published years with the direct file URL where the era-A scheme provides one, so
--discover can say which years exist upstream that intake lacks.

The rollup summary is reported and deliberately not stored: the district
aggregation is derived from the warehouse and the registry, and nothing derived is
committed."
```

---

### Task 13: Publish the series to the site

**Files:**
- Modify: `tools/src/cli/build-data.ts`
- Test: `tools/src/aoe/adm/publish.test.ts`
- Create: `tools/src/aoe/adm/publish.ts`

**Interfaces:**
- Consumes: `aggregate`, `joinRows`, `buildGapRegister`.
- Produces:
  - `interface AdmPublication { readonly generated: string; readonly years: ReadonlyArray<{ readonly fiscal_year: number; readonly count_year: string; readonly bands: ReadonlyArray<string>; readonly maps_to_statutory_bands: boolean; readonly grand_total: number; readonly districts: ReadonlyArray<{ readonly district: string; readonly values: ReadonlyArray<number | null> }>; readonly exclusions: ReadonlyArray<{ readonly slug: string; readonly total: number; readonly justification: string }> }>; readonly gaps: ReturnType<typeof buildGapRegister> }`
  - `buildAdmPublication(records: ReadonlyArray<unknown>, registry: ReadonlyMap<string, RegistryEntity>, generated: string): AdmPublication`

- [ ] **Step 1: Write the failing test**

Create `tools/src/aoe/adm/publish.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { readRegistry } from '../../registry/store.ts';
import { buildAdmPublication } from './publish.ts';

const RECORD = {
  schema_version: '1.0',
  source: 'intake/aoe-adm/fy2024/x.xlsx',
  count_year: '2022-2023',
  adm_label: 24,
  fiscal_year: 2024,
  source_title: 'ADM Report for 2022-2023 (ADM-24)',
  bands_as_published: [
    { header: 'Elem ( K - 6)', statutory_band: null },
    { header: 'SEC ( 7 - 12)', statutory_band: null },
  ],
  maps_to_statutory_bands: false,
  towns: [
    { entity: 'town/addison', aoe_org_id: 'T001', name_as_published: 'Addison', town_class: 'union_district_member', values: [10, 5] },
    { entity: 'town/burlington', aoe_org_id: 'T037', name_as_published: 'Burlington', town_class: 'own_district', values: [100, 50] },
  ],
  band_totals: [110, 55],
  grand_total: 165,
  not_published: [],
  extracted_by: 'tester',
  extracted_date: '2026-07-29',
};

describe('publishing the ADM series', () => {
  const pub = buildAdmPublication([RECORD], readRegistry(), '2026-07-29T00:00:00.000Z');

  it('carries one entry per year, with its bands and totals', () => {
    expect(pub.years).toHaveLength(1);
    expect(pub.years[0]?.fiscal_year).toBe(2024);
    expect(pub.years[0]?.bands).toEqual(['Elem ( K - 6)', 'SEC ( 7 - 12)']);
    expect(pub.years[0]?.grand_total).toBe(165);
    expect(pub.years[0]?.maps_to_statutory_bands).toBe(false);
  });

  it('rolls districts up, keeping a town that is its own district', () => {
    const districts = pub.years[0]?.districts.map((d) => d.district) ?? [];
    expect(districts).toContain('town/burlington');
  });

  it('includes the gap register so a null can explain itself', () => {
    expect(pub.gaps.entries.length).toBeGreaterThan(0);
    expect(pub.gaps.engine_eligible_years).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tools/src/aoe/adm/publish.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `publish.ts`**

```ts
/**
 * Turns committed ADM transcriptions into the JSON the site reads.
 *
 * The district rollup happens HERE rather than in the warehouse, because it is
 * derived from the warehouse plus the registry and `.gitignore` states the rule:
 * nothing derived is committed, so the git history only ever shows source data
 * changing.
 */

import type { RegistryEntity } from '../../registry/types.ts';
import { aggregate } from './aggregate.ts';
import { classifyTown } from './classify.ts';
import { buildGapRegister } from './gaps.ts';
import type { JoinedRow } from './join.ts';

interface AdmRecord {
  fiscal_year: number;
  count_year: string;
  bands_as_published: Array<{ header: string; statutory_band: string | null }>;
  maps_to_statutory_bands: boolean;
  grand_total: number;
  towns: Array<{
    entity: string;
    aoe_org_id: string;
    name_as_published: string;
    values: Array<number | null>;
  }>;
}

export interface AdmPublication {
  readonly generated: string;
  readonly years: ReadonlyArray<{
    readonly fiscal_year: number;
    readonly count_year: string;
    readonly bands: ReadonlyArray<string>;
    readonly maps_to_statutory_bands: boolean;
    readonly grand_total: number;
    readonly districts: ReadonlyArray<{
      readonly district: string;
      readonly values: ReadonlyArray<number | null>;
    }>;
    readonly exclusions: ReadonlyArray<{
      readonly slug: string;
      readonly total: number;
      readonly justification: string;
    }>;
  }>;
  readonly gaps: ReturnType<typeof buildGapRegister>;
}

export function buildAdmPublication(
  records: ReadonlyArray<unknown>,
  registry: ReadonlyMap<string, RegistryEntity>,
  generated: string,
): AdmPublication {
  const years = (records as AdmRecord[])
    .slice()
    .sort((a, b) => a.fiscal_year - b.fiscal_year)
    .map((record) => {
      const joined: JoinedRow[] = record.towns.map((t) => {
        const entity = registry.get(t.entity);
        if (!entity) {
          throw new Error(
            `ADM record for FY${record.fiscal_year} names "${t.entity}", which is not a ` +
              `registry entity. Run \`npm run registry:sync\` and re-run \`npm run adm:import\`.`,
          );
        }
        return {
          row: {
            aoe_org_id: t.aoe_org_id,
            name_as_published: t.name_as_published,
            values: t.values,
          },
          slug: t.entity,
          entity,
          town_class: classifyTown(entity),
        };
      });

      const rollup = aggregate(joined, record.bands_as_published.length);

      return {
        fiscal_year: record.fiscal_year,
        count_year: record.count_year,
        bands: record.bands_as_published.map((b) => b.header),
        maps_to_statutory_bands: record.maps_to_statutory_bands,
        grand_total: record.grand_total,
        districts: rollup.districts.map((d) => ({ district: d.district, values: d.values })),
        exclusions: rollup.exclusions.map((e) => ({
          slug: e.slug,
          total: e.total,
          justification: e.justification,
        })),
      };
    });

  return {
    generated,
    years,
    gaps: buildGapRegister(
      years.map((y) => ({
        fiscal_year: y.fiscal_year,
        maps_to_statutory_bands: y.maps_to_statutory_bands,
      })),
    ),
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tools/src/aoe/adm/publish.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire it into `build-data.ts`**

In `tools/src/cli/build-data.ts`, add the import:

```ts
import { buildAdmPublication } from '../aoe/adm/publish.ts';
```

Then, after the coverage block, add:

```ts
  // --- AOE average daily membership ---------------------------------------
  // The district rollup is computed here, not stored: it is derived from the
  // warehouse and the registry, and nothing derived is committed.
  const admDir = join(PATHS.warehouse, 'aoe-adm');
  const admRecords = walkFiles(admDir, (n) => /^adm\d{2}\.yaml$/.test(n)).map(
    (file) => parseYaml(readFileSync(file, 'utf8')) as unknown,
  );
  if (admRecords.length > 0) {
    writeJson(
      join(PATHS.siteGenerated, 'adm.json'),
      buildAdmPublication(admRecords, registry, today.toISOString()),
    );
  }
```

`readBudgets` walks the whole warehouse, so exclude the ADM files from it — change its filter to skip `aoe-adm`:

```ts
function readBudgets(): BudgetRecord[] {
  return walkFiles(PATHS.warehouse, (n) => n.endsWith('.yaml') || n.endsWith('.json'))
    .filter((file) => !rel(file).startsWith('warehouse/aoe-adm/'))
    .map((file) => {
```

- [ ] **Step 6: Build and inspect the output**

Run: `npm run build:data`

Then:

```bash
node -e "
const a=require('./site/src/generated/adm.json');
console.log('years:', a.years.map(y=>y.fiscal_year));
console.log('FY2024 districts:', a.years[0].districts.length, 'exclusions:', a.years[0].exclusions.length);
console.log('burlington present:', a.years[0].districts.some(d=>d.district==='town/burlington'));
console.log('engine eligible:', a.gaps.engine_eligible_years);
"
```

Expected: `years: [ 2024 ]`, Burlington present, `engine eligible: []`.

- [ ] **Step 7: Full verification**

Run: `npm test && npm run typecheck && npm run validate && npm run build`
Expected: all clean.

- [ ] **Step 8: Commit**

```bash
git add tools/src/cli/build-data.ts tools/src/aoe/adm/publish.ts tools/src/aoe/adm/publish.test.ts
git commit -m "Publish the ADM series and its gap register to the site

The district rollup is computed at build time rather than stored, because it is a
pure function of the warehouse and the registry and .gitignore states the rule:
nothing derived is committed, so the history only ever shows source data changing.
Each year carries its published bands, whether they map to the statutory bands,
its district totals, and its named exclusions -- so a page can show both the
number and what was left out of it.

The gap register ships alongside, which is the point: a null in the walkthrough
can now say which statutory input is missing and why, rather than rendering blank.
readBudgets learns to skip warehouse/aoe-adm so an ADM series is not read as a
budget record."
```

---

## Self-Review

**Spec coverage.** Every numbered decision in the spec maps to a task: decision 1 (link text) → Tasks 5, 11; decision 2 (join by ID) → Task 7; decision 3 (year labels) → Task 5; decision 4 (prek null) → Tasks 6, 12; decision 5 (bands never coerced) → Task 6; decision 6 (town taxonomy) → Task 7; decision 7 (conservation) → Task 8; decision 8 (2-decimal rounding) → Task 6; decision 9 (structural buckets) → Task 1. Validation integration → Task 9. Gap register → Task 10. Prerequisite repairs → Tasks 1–3. Architecture and module table → Tasks 4–13.

**Known gaps, deliberately.** Open question 2 (the town-to-district rule) is *not* resolved by this plan; `classify.ts` documents it as an inference and the conservation invariant contains the risk. Open question 3 (band regimes in ADM-16…23) cannot be closed until those files exist — `parse.ts` hard-fails on an unknown shape, and adding a regime is a documented, tested edit. The `page-<date>.html` snapshot that `--discover` reads is not created here, since only the accordion's inner HTML was available; `--discover` reports a clear error until someone saves the page.

**Type consistency.** `isReportingBucket({id, name})` is used consistently in Tasks 1, 7. `Cell` (Task 4) flows into `parseRows` (Task 6). `AdmRow`/`ParsedReport` (Task 6) into `joinRows` (Task 7). `JoinedRow` (Task 7) into `aggregate` (Task 8) and `buildAdmPublication` (Task 13). `TownClass` is defined once in `classify.ts` and imported everywhere else. `buildGapRegister`'s parameter shape matches both call sites (Tasks 12, 13).

**Sequencing constraint.** Task 9 must precede Task 12. Writing a warehouse file before the validator discriminates breaks `npm run validate` for everyone.
