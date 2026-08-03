# Slim the SU Budget Model to Essentials — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the normalized district-budget record to six essential fields, delete the personnel/enrollment/per-pupil machinery, and bring every place that duplicates the field list (schema, validator, intake form, docs) into agreement.

**Architecture:** The budget field list is duplicated across four in-sync surfaces — the JSON schema (`schemas/budget-1.0.schema.json`), the null-accounting rule (`tools/src/validate/rules.ts`), the form↔record table (`tools/src/normalize/fields.ts`), and the GitHub issue form (`.github/ISSUE_TEMPLATE/budget-normalize.yml`) — plus a validator (`checkRecomputation`) and a dormant assisted-extraction subsystem (`tools/src/cli/extract.ts` + `schemas/mapping-1.0.schema.json`) that both exist only to serve the fields being removed. We edit schema `1.0` in place (the only two records are freshly authored and unpublished), migrate those two records, and retire the recomputation check and the extraction subsystem.

**Tech Stack:** TypeScript (Node, ESM, `tsx`), ajv 2020 JSON-Schema validation, Vitest, GitHub issue-form YAML.

**Baseline note (revised 2026-08-03):** After this plan was first written, `main` advanced to `46eff38`, merging the **`total-driven-merger-calc`** feature. That feature added a merger engine, [`model/src/scenario.ts`](model/src/scenario.ts), whose per-district `DistrictBudget` carries the eight expenditure function grains and a full `PersonnelRollup`, and whose `buildCaveats` reconciles those grains against the stated total. It is exercised **only** by `model/src/engine.test.ts` — nothing in the site or `build-data` constructs a `ScenarioSpec`. The decision (2026-08-03) is to commit to the totals-only direction and trim that engine to match, so Task 7 (below) is new and Task 8 also updates PLAN.md §7. The merge also already added `expenditures.total_stated` to the schema's `expenditures.required` (compatible — this plan keeps it required) and added the `record.ts` non-accountable-emits-null behavior plus its `record.test.ts` block (which Task 3 removes, since every essential figure is now accountable).

## Global Constraints

- **The complete required field set** of a normalized budget record after this change — nothing else is required:
  - `schema_version`, `entity`, `fiscal_year`, `status`, `source` (identity, unchanged)
  - `revenues.education_fund`
  - `revenues.education_fund_previous_year_actual` *(new)*
  - `revenues.total_stated`
  - `expenditures.total_stated`
  - `expenditures.previous_year_actual` *(new)*
  - `tax.towns`
  - `not_published`, `lines_flagged` (accounting arrays, unchanged)
- **The two new fields are nested**, not top-level: `revenues.education_fund_previous_year_actual` and `expenditures.previous_year_actual`. Both are `money` (`$ref` common `#/$defs/money`, i.e. number-or-null).
- **Removed entirely** from the schema, form, `FIGURE_FIELDS`, and `ACCOUNTABLE`: the whole `personnel` block, the whole `enrollment` block, the whole `per_pupil` block, `membership_note`, the granular revenue lines (`revenues.local`, `revenues.federal`, `revenues.other`), and the granular expenditure lines (`expenditures.instruction`, `special_education`, `administration_district`, `administration_school`, `operations_maintenance`, `transportation`, `debt_service`, `other`). Also remove the budget schema's optional `mapping` property.
- **Schema version stays `1.0`, edited in place.** Do not create a `2.0`. Migrate the two existing records to the slim shape.
- **Null-accounting is kept for the essentials.** All five essential money fields are `accountable: true`: a blank submission is rejected; `n/p` records a confirmed `not_published` entry. `tax.towns` rates stay null-allowed with the existing whole-table generalization. This means `total_stated` (both) becomes **accountable**, a change from today where it was an optional printed total.
- **`checkRecomputation` is deleted** — after the granular lines and personnel are gone it has no inputs left and can never fire.
- **The assisted-extraction subsystem is retired**: delete `tools/src/cli/extract.ts`, `schemas/mapping-1.0.schema.json`, the `extract` npm script, the `mapping` entry in `SchemaName`/`SCHEMA_IDS`, and the extraction-mappings walk in the validate CLI.
- **The merger engine goes totals-only.** `model/src/scenario.ts`'s `DistrictBudget` reduces to `{ entity, fiscal_year, total_stated, source }` (drop `ExpenditureRollup` and `PersonnelRollup`). Remove `computeStaffing`, `StaffingComparison`, `ConsolidatedPosition`, `consolidatedPositions`, the `health_insurance_trend` and `benefit_load_on_consolidated_salary` assumptions, the `GRAIN_KEYS`/`sumGrains` reconciliation, and the staffing/reconcile caveats. The headline (combined `total_stated` × `consolidation_factor` → signed `delta`) and the transition-cost + headline caveats stay. `engine.test.ts`'s scenario suite is trimmed to the surviving behavior.
- **Gates** (npm scripts): `npm run typecheck` (`tsc --build --force`), `npm test` (`vitest run`), `npm run validate` (`tsx tools/src/cli/validate.ts`). Money is stored in whole dollars; a `null` money value always means "the source did not publish it" and must be accounted for.

---

## File Structure

**Edited**

- `schemas/budget-1.0.schema.json` — slim the record schema (Task 3).
- `tools/src/validate/rules.ts` — slim `ACCOUNTABLE`; delete `checkRecomputation` + its `num` helper (Tasks 1–2).
- `tools/src/validate/rules.test.ts` — drop the recomputation suite; update the null-accounting fixtures (Tasks 1–2).
- `tools/src/cli/validate.ts` — remove the `checkRecomputation` call/import and the extraction-mappings walk + `counts.mappings` (Tasks 1, 6).
- `tools/src/cli/normalize.ts` — remove the `checkRecomputation` call/import (Task 1).
- `tools/src/normalize/fields.ts` — slim `FIGURE_FIELDS` to the five essential money fields (Task 3).
- `tools/src/normalize/fields.test.ts` — update the `FIGURE_FIELDS` assertions (Task 3).
- `tools/src/normalize/record.test.ts` — update fixtures for the slim field set (Task 3).
- `tools/src/validate/schemas.test.ts` — extend the budget-schema regression guard (Task 3).
- `warehouse/su-addison-central/fy2023-proposed.yaml`, `fy2024-proposed.yaml` — migrate to slim shape (Task 4).
- `.github/ISSUE_TEMPLATE/budget-normalize.yml` — slim the intake form (Task 5).
- `tools/src/validate/schemas.ts` — remove `mapping` from `SchemaName` and `SCHEMA_IDS` (Task 6).
- `package.json` — remove the `extract` script (Task 6).
- `model/src/scenario.ts` — trim the merger engine to totals-only (Task 7).
- `model/src/engine.test.ts` — trim the scenario test suite (Task 7).
- `PLAN.md`, `docs/superpowers/specs/2026-07-31-warehouse-normalize-channel-design.md` — update prose field lists and the §7 merger-tool description (Task 8).

**Deleted**

- `tools/src/cli/extract.ts`, `schemas/mapping-1.0.schema.json` (Task 6).

**`record.ts` is deliberately not edited** — it iterates `FIGURE_FIELDS` generically, so slimming that table changes its output with no code change.

---

### Task 1: Retire the recomputation check

`checkRecomputation` reconciles expenditure sub-lines, revenue sub-lines, and the personnel block against stated totals. Every one of those inputs is being removed, so the function becomes permanently inert. Delete it and its two call sites. This task is independent of the field slimming and leaves the whole test suite green.

**Files:**
- Modify: `tools/src/validate/rules.ts` (remove `checkRecomputation` ≈ lines 489–585, and the `num` helper at ≈ line 477 that only it uses)
- Modify: `tools/src/validate/rules.test.ts` (remove the `describe('recomputation', …)` block and the `checkRecomputation` import)
- Modify: `tools/src/cli/validate.ts` (remove the `checkRecomputation` import and its call at ≈ line 318)
- Modify: `tools/src/cli/normalize.ts` (remove the `checkRecomputation` import and its call at ≈ line 105)

**Interfaces:**
- Consumes: nothing new.
- Produces: `checkRecomputation` no longer exists or is exported; `checkNullAccounting`, `checkProvenance`, `checkRegistryRefs` are unchanged.

- [ ] **Step 1: Confirm the only importers before deleting**

Run: `grep -rn "checkRecomputation" tools/src`
Expected: matches only in `rules.ts` (definition), `rules.test.ts` (import + `describe`), `cli/validate.ts` (import + call), `cli/normalize.ts` (import + call). If anything else appears, add it to this task's file list.

- [ ] **Step 2: Delete the `describe('recomputation', …)` block in `rules.test.ts`**

Remove the entire block that begins:

```ts
describe('recomputation', () => {
```

through its closing `});`. Then remove `checkRecomputation` from the import at the top of the file so it reads:

```ts
import {
  checkNullAccounting,
  checkRegistryRefs,
  collectNullPaths,
  type BudgetRecord,
} from './rules.ts';
```

- [ ] **Step 3: Delete `checkRecomputation` and its `num` helper from `rules.ts`**

Remove the `// Recomputation of derived figures` section: the `num` helper and the entire `export function checkRecomputation(record: BudgetRecord, file: string): Finding[] { … }`. Leave the sections above (null accounting, provenance) and below (corrections) intact.

- [ ] **Step 4: Remove the call site and import in `cli/validate.ts`**

Delete this line (≈ 318):

```ts
    findings.push(...checkRecomputation(record, file));
```

and remove `checkRecomputation` from the `./rules.ts` import list at the top of `validate.ts`.

- [ ] **Step 5: Remove the call site and import in `cli/normalize.ts`**

In the `findings` array (≈ 100–106) delete:

```ts
    ...checkRecomputation(record, label),
```

and remove `checkRecomputation` from the `./rules.ts` (or `../validate/rules.ts`) import in `normalize.ts`.

- [ ] **Step 6: Typecheck and run the full test suite**

Run: `npm run typecheck && npm test`
Expected: PASS. No references to `checkRecomputation` remain; `grep -rn "checkRecomputation" tools/src` returns nothing.

- [ ] **Step 7: Commit**

```bash
git add tools/src/validate/rules.ts tools/src/validate/rules.test.ts tools/src/cli/validate.ts tools/src/cli/normalize.ts
git commit -m "refactor(validate): remove the recomputation check ahead of slimming the budget model"
```

---

### Task 2: Slim the null-accounting `ACCOUNTABLE` list

`ACCOUNTABLE` is the hand-written list of dotted paths whose `null` must be explained. Point it at the five essential money fields plus the town-rate paths, and drop everything else. `checkNullAccounting` and `collectNullPaths` are unchanged. `rules.test.ts` does not invoke the JSON schema, so this task's fixtures can be slimmed independently and the suite stays green.

**Files:**
- Modify: `tools/src/validate/rules.ts` (the `ACCOUNTABLE` array, ≈ lines 65–77)
- Modify: `tools/src/validate/rules.test.ts` (the `record()` helper and the null-accounting `describe` block)

**Interfaces:**
- Consumes: nothing new.
- Produces: `ACCOUNTABLE` matches exactly `revenues.education_fund`, `revenues.education_fund_previous_year_actual`, `revenues.total_stated`, `expenditures.total_stated`, `expenditures.previous_year_actual`, and `tax.towns.<n>.homestead_rate_stated|cla`.

- [ ] **Step 1: Update the null-accounting fixtures in `rules.test.ts` first (they fail before the code changes)**

Replace the `record()` helper's money blocks with the slim shape, and rewrite the two personnel/enrollment-based null tests to use essential fields. Change the helper to:

```ts
function record(over: Partial<BudgetRecord> = {}): BudgetRecord {
  return {
    schema_version: '1.0',
    entity: 'ud/test-55',
    fiscal_year: 2027,
    status: 'proposed',
    source: 'intake/test/fy2027/budget.pdf',
    revenues: { education_fund: 1000, education_fund_previous_year_actual: 950, total_stated: 1200 },
    expenditures: { total_stated: 1150, previous_year_actual: 1100 },
    tax: { towns: [{ town: 'town/test', homestead_rate_stated: 1.5, cla: 0.9 }] },
    not_published: [],
    lines_flagged: [],
    ...over,
  } as BudgetRecord;
}
```

Replace the "rejects an unexplained null in the personnel block" test with:

```ts
  it('rejects an unexplained null in an essential figure', () => {
    const r = record({
      expenditures: { total_stated: 1150, previous_year_actual: null },
    });
    const findings = checkNullAccounting(r, 'f.yaml');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('error');
    expect(findings[0]?.message).toMatch(/expenditures\.previous_year_actual is null/);
    expect(findings[0]?.message).toMatch(/cannot be distinguished from a field nobody checked/);
  });
```

Replace the "accepts the same null once it is confirmed absent" test with:

```ts
  it('accepts the same null once it is confirmed absent from the source', () => {
    const r = record({
      expenditures: { total_stated: 1150, previous_year_actual: null },
      not_published: [
        { path: 'expenditures.previous_year_actual', confirmed_by: 'jn', confirmed_date: '2026-07-29' },
      ],
    });
    expect(checkNullAccounting(r, 'f.yaml')).toHaveLength(0);
  });
```

Replace the "accepts a null explained as a flagged line instead" test with one that uses an essential field:

```ts
  it('accepts a null explained as a flagged line instead', () => {
    const r = record({
      revenues: { education_fund: 1000, education_fund_previous_year_actual: null, total_stated: 1200 },
      lines_flagged: [
        { path: 'revenues.education_fund_previous_year_actual', issue: 'prior-year actual not yet transcribed' },
      ],
    });
    expect(checkNullAccounting(r, 'f.yaml')).toHaveLength(0);
  });
```

In the "does not demand an explanation for optional descriptive fields" test, drop `membership_note` (removed) and keep `adopted_date`:

```ts
  it('does not demand an explanation for optional descriptive fields', () => {
    // A missing date is not a missing figure.
    const r = record({ adopted_date: null });
    expect(checkNullAccounting(r, 'f.yaml')).toHaveLength(0);
  });
```

Leave the "lets one entry cover a whole town table" test unchanged — it already uses `tax.towns`.

- [ ] **Step 2: Run the null-accounting tests to watch them fail**

Run: `npx vitest run tools/src/validate/rules.test.ts -t "null accounting"`
Expected: FAIL — `expenditures.previous_year_actual` is not yet accountable, so the "rejects an unexplained null" test finds 0 findings instead of 1.

- [ ] **Step 3: Replace the `ACCOUNTABLE` list in `rules.ts`**

```ts
const ACCOUNTABLE = [
  /^revenues\.(education_fund|education_fund_previous_year_actual|total_stated)$/,
  /^expenditures\.(total_stated|previous_year_actual)$/,
  /^tax\.towns\.\d+\.(homestead_rate_stated|cla)$/,
];
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tools/src/validate/rules.test.ts`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npm run typecheck && npm test`
Expected: PASS. (`record.test.ts` still builds and validates records against the *old* schema and old `FIGURE_FIELDS`; those are untouched here, so they remain green.)

- [ ] **Step 6: Commit**

```bash
git add tools/src/validate/rules.ts tools/src/validate/rules.test.ts
git commit -m "feat(validate): hold only the essential budget figures to null-accounting"
```

---

### Task 3: Slim the schema, the field table, and their tests (the model change)

This is the atomic model change: the JSON schema, the `FIGURE_FIELDS` table, and the three affected test files move together so that `buildRecord` produces a slim record that validates against the slim schema. Vitest is green at the end. The two on-disk warehouse records are **not** touched here — they still describe the old shape and will fail `npm run validate` until Task 4. That is the one deliberately-deferred red, and Task 4 closes it immediately.

**Files:**
- Modify: `schemas/budget-1.0.schema.json` (full replacement of the record body)
- Modify: `tools/src/normalize/fields.ts` (`FIGURE_FIELDS`)
- Modify: `tools/src/normalize/fields.test.ts`
- Modify: `tools/src/normalize/record.test.ts`
- Modify: `tools/src/validate/schemas.test.ts`

**Interfaces:**
- Consumes: `ACCOUNTABLE` from Task 2 (the five essential paths).
- Produces: the budget schema requires `[schema_version, entity, fiscal_year, status, source, revenues, expenditures, tax, not_published, lines_flagged]`; `revenues` requires `[education_fund, education_fund_previous_year_actual, total_stated]`; `expenditures` requires `[total_stated, previous_year_actual]`. `FIGURE_FIELDS` is the five essential money fields, all `accountable: true`.

- [ ] **Step 1: Add the slim-schema assertions to `schemas.test.ts` first**

Append to `tools/src/validate/schemas.test.ts` (keep the existing source-pattern and expenditure-total suites):

```ts
describe('budget schema is slimmed to the essentials', () => {
  const schema = JSON.parse(
    readFileSync(join(PATHS.schemas, 'budget-1.0.schema.json'), 'utf8'),
  );

  it('requires exactly the essential top-level blocks', () => {
    expect(new Set(schema.required)).toEqual(
      new Set([
        'schema_version', 'entity', 'fiscal_year', 'status', 'source',
        'revenues', 'expenditures', 'tax', 'not_published', 'lines_flagged',
      ]),
    );
  });

  it('has dropped the personnel, enrollment and per_pupil blocks', () => {
    expect(schema.properties.personnel).toBeUndefined();
    expect(schema.properties.enrollment).toBeUndefined();
    expect(schema.properties.per_pupil).toBeUndefined();
  });

  it('requires the previous-year actuals nested under revenues and expenditures', () => {
    expect(new Set(schema.properties.revenues.required)).toEqual(
      new Set(['education_fund', 'education_fund_previous_year_actual', 'total_stated']),
    );
    expect(new Set(schema.properties.expenditures.required)).toEqual(
      new Set(['total_stated', 'previous_year_actual']),
    );
  });
});
```

- [ ] **Step 2: Run the new schema test to watch it fail**

Run: `npx vitest run tools/src/validate/schemas.test.ts -t "slimmed to the essentials"`
Expected: FAIL — the current schema still requires `personnel` etc.

- [ ] **Step 3: Replace the budget schema body**

Overwrite `schemas/budget-1.0.schema.json` with this exact content:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:vt-budget:schema:budget:1.0",
  "title": "Normalized district budget record, schema version 1.0",
  "description": "One record per district-fiscal-year. Deliberately minimal: the current-year stated revenue and education-fund receipts, the current-year stated expenditure total, the prior-year actuals for the education fund and for total expenditure, and the per-town stated tax figures. A null money value means the source document did not publish that figure; it never means it was not looked for. The validator enforces that guarantee by requiring every null to be accounted for in `not_published` or `lines_flagged`.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schema_version",
    "entity",
    "fiscal_year",
    "status",
    "source",
    "revenues",
    "expenditures",
    "tax",
    "not_published",
    "lines_flagged"
  ],
  "properties": {
    "schema_version": {
      "description": "Version of this schema the record was extracted under.",
      "const": "1.0"
    },
    "entity": {
      "$ref": "urn:vt-budget:schema:common:1.0#/$defs/entity_ref",
      "description": "Registry slug of the district or supervisory union this budget belongs to."
    },
    "fiscal_year": {
      "type": "integer",
      "minimum": 2015,
      "maximum": 2100,
      "description": "Fiscal year the budget covers. FY2027 = the year ending June 30, 2027."
    },
    "status": {
      "enum": ["proposed", "warned", "approved", "actual"],
      "description": "Where in its lifecycle this budget was when the source document was published. A district-fiscal-year may legitimately have several records at different statuses; they are distinct rows, not revisions of one row."
    },
    "source": {
      "type": "string",
      "pattern": "^intake/[a-z0-9-]+/fy[0-9]{4}/[^/]+$",
      "description": "Repo-relative path to the raw intake artifact this record was extracted from. CI rejects any record whose source path does not exist."
    },
    "source_pages": {
      "type": ["string", "null"],
      "description": "Page or section reference within the source artifact, e.g. 'pp. 14-17'. Makes a record checkable by hand in under a minute.",
      "default": null
    },
    "adopted_date": {
      "type": ["string", "null"],
      "format": "date",
      "description": "Date of the Town Meeting or board vote that adopted this budget, where applicable. Null for proposed/warned records.",
      "default": null
    },
    "extracted_by": {
      "type": ["string", "null"],
      "description": "Who performed or confirmed the extraction. Free text; a name or handle.",
      "default": null
    },
    "extracted_date": {
      "type": ["string", "null"],
      "format": "date",
      "default": null
    },

    "revenues": {
      "type": "object",
      "additionalProperties": false,
      "description": "The current-year stated total revenue, the education-fund receipts within it, and the prior year's actual education-fund figure as printed in this document.",
      "required": ["education_fund", "education_fund_previous_year_actual", "total_stated"],
      "properties": {
        "education_fund": {
          "$ref": "urn:vt-budget:schema:common:1.0#/$defs/money",
          "description": "Statewide Education Fund receipts for this fiscal year -- the main revenue line for most Vermont districts."
        },
        "education_fund_previous_year_actual": {
          "$ref": "urn:vt-budget:schema:common:1.0#/$defs/money",
          "description": "The actual (not budgeted) education-fund receipts for the prior fiscal year, as printed in this document's comparison column."
        },
        "total_stated": {
          "$ref": "urn:vt-budget:schema:common:1.0#/$defs/money",
          "description": "Total revenue for this fiscal year as printed in the document."
        }
      }
    },

    "expenditures": {
      "type": "object",
      "additionalProperties": false,
      "description": "The current-year stated expenditure total and the prior year's actual expenditure total as printed in this document.",
      "required": ["total_stated", "previous_year_actual"],
      "properties": {
        "total_stated": {
          "$ref": "urn:vt-budget:schema:common:1.0#/$defs/money",
          "description": "Total expenditure for this fiscal year as printed in the document."
        },
        "previous_year_actual": {
          "$ref": "urn:vt-budget:schema:common:1.0#/$defs/money",
          "description": "The actual (not budgeted) total expenditure for the prior fiscal year, as printed in this document's comparison column."
        }
      }
    },

    "tax": {
      "type": "object",
      "additionalProperties": false,
      "required": ["towns"],
      "properties": {
        "towns": {
          "type": "array",
          "description": "One entry per member town, with the rate and CLA as stated in this document. Tax Department published CLAs and rates are joined separately and labeled as the state's figures.",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["town"],
            "properties": {
              "town": { "$ref": "urn:vt-budget:schema:common:1.0#/$defs/entity_ref" },
              "homestead_rate_stated": {
                "type": ["number", "null"],
                "minimum": 0,
                "description": "Homestead education property tax rate in dollars per $100 of equalized value, as printed."
              },
              "nonhomestead_rate_stated": { "type": ["number", "null"], "minimum": 0, "default": null },
              "cla": {
                "type": ["number", "null"],
                "exclusiveMinimum": 0,
                "description": "Common Level of Appraisal as a ratio (0.8734), not a percentage (87.34)."
              }
            }
          }
        }
      }
    },

    "not_published": {
      "type": "array",
      "description": "Dotted paths of fields this source document does not publish, each confirmed absent by a human rather than merely skipped. The validator requires that every null in the record appears here or in lines_flagged. This is what makes a null mean 'the district did not publish it' instead of 'we did not look'.",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["path", "confirmed_by", "confirmed_date"],
        "properties": {
          "path": {
            "type": "string",
            "pattern": "^[a-z_]+(\\.[a-z_0-9]+)*$",
            "examples": ["expenditures.previous_year_actual", "revenues.education_fund_previous_year_actual"]
          },
          "confirmed_by": { "type": "string", "minLength": 1 },
          "confirmed_date": { "type": "string", "format": "date" },
          "note": { "type": ["string", "null"], "default": null }
        }
      }
    },

    "lines_flagged": {
      "type": "array",
      "description": "Anything that did not fit cleanly: figures that do not reconcile, apparent errors in the source, judgement calls made during extraction, or an essential figure not yet transcribed.",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["path", "issue"],
        "properties": {
          "path": { "type": "string" },
          "issue": { "type": "string", "minLength": 1 },
          "source_text": { "type": ["string", "null"], "default": null },
          "resolution": {
            "enum": ["allocated", "left_null", "recorded_as_other", "pending"],
            "default": "pending"
          }
        }
      }
    }
  }
}
```

- [ ] **Step 4: Replace `FIGURE_FIELDS` in `fields.ts`**

Replace the whole `export const FIGURE_FIELDS` array with:

```ts
export const FIGURE_FIELDS: readonly FigureField[] = [
  { path: 'revenues.education_fund', kind: 'money', accountable: true },
  { path: 'revenues.education_fund_previous_year_actual', kind: 'money', accountable: true },
  { path: 'revenues.total_stated', kind: 'money', accountable: true },
  { path: 'expenditures.total_stated', kind: 'money', accountable: true },
  { path: 'expenditures.previous_year_actual', kind: 'money', accountable: true },
];
```

Leave `FigureKind`, `FigureField`, `STATUSES`, `parseFigure`, and `setPath` unchanged (`kind` values other than `money` are simply no longer used, which is harmless).

- [ ] **Step 5: Update `fields.test.ts`**

Replace the `describe('FIGURE_FIELDS', …)` block with:

```ts
describe('FIGURE_FIELDS', () => {
  it('is exactly the five essential money figures, all accountable', () => {
    expect(FIGURE_FIELDS.map((f) => f.path)).toEqual([
      'revenues.education_fund',
      'revenues.education_fund_previous_year_actual',
      'revenues.total_stated',
      'expenditures.total_stated',
      'expenditures.previous_year_actual',
    ]);
    expect(FIGURE_FIELDS.every((f) => f.accountable && f.kind === 'money')).toBe(true);
  });
});
```

Leave the `parseFigure`, `setPath`, and `STATUSES` suites unchanged — they test generic helpers and do not depend on the field set.

- [ ] **Step 6: Update `record.test.ts` for the slim field set**

Three edits:

(a) In the two sentinel tests, change the `n/p` field from `personnel.benefits_health` to `expenditures.previous_year_actual`. The first becomes:

```ts
  it('turns n/p into a not_published entry attributed to the author and date', () => {
    const r = buildRecord(input({ body: body({ 'expenditures.previous_year_actual': 'n/p' }) }));
    if (!r.ok) throw new Error('expected ok');
    const rec = r.record as Record<string, any>;
    expect(rec.expenditures.previous_year_actual).toBeNull();
    const entry = rec.not_published.find((n: any) => n.path === 'expenditures.previous_year_actual');
    expect(entry).toEqual({
      path: 'expenditures.previous_year_actual',
      confirmed_by: '@octocat',
      confirmed_date: '2026-07-31',
    });
  });
```

and in the second sentinel test change `body({ 'personnel.benefits_health': 'n/p' })` to `body({ 'expenditures.previous_year_actual': 'n/p' })`.

(b) In "rejects a value that is neither a number nor n/p", change `revenues.local` to `revenues.education_fund`:

```ts
    const errs = errorsFrom({ body: body({ 'revenues.education_fund': 'a lot' }) });
    expect(errs.join('\n')).toMatch(/revenues\.education_fund/);
```

(c) Delete the entire `describe('buildRecord — non-accountable field emission', …)` block. There are no non-accountable numeric fields left — `total_stated` is now accountable — so a blank `expenditures.total_stated` is now (correctly) rejected, which the existing `describe('buildRecord — the sentinel')` "rejects an empty accountable field" test already covers.

(d) Optional tidy: the "parses lines_flagged in the path :: issue format" test uses `expenditures.other` as its example path. `lines_flagged` paths are free text (not checked against the field set), so the test passes unchanged — but for cleanliness replace both occurrences of `expenditures.other` with `expenditures.previous_year_actual` and `bond premium lumped in` with `prior-year column unreadable`, giving:

```ts
  it('parses lines_flagged in the path :: issue format', () => {
    const r = buildRecord(
      input({ body: body({ lines_flagged: 'expenditures.previous_year_actual :: prior-year column unreadable' }) }),
    );
    if (!r.ok) throw new Error('expected ok');
    expect((r.record as any).lines_flagged).toEqual([
      { path: 'expenditures.previous_year_actual', issue: 'prior-year column unreadable', resolution: 'pending' },
    ]);
  });
```

(e) In `describe('buildRecord — the sentinel')`, the "rejects an empty accountable field, naming it" test uses `expenditures.instruction`, which no longer exists in `FIGURE_FIELDS`. Change it to an essential accountable field:

```ts
  it('rejects an empty accountable field, naming it', () => {
    const errs = errorsFrom({ body: body({ 'expenditures.previous_year_actual': '' }) });
    expect(errs.join('\n')).toMatch(/expenditures\.previous_year_actual/);
  });
```

- [ ] **Step 7: Run the affected suites to watch them pass**

Run: `npx vitest run tools/src/normalize/ tools/src/validate/schemas.test.ts`
Expected: PASS — `buildRecord` now emits `{revenues:{education_fund, education_fund_previous_year_actual, total_stated}, expenditures:{total_stated, previous_year_actual}, tax, …}`, which validates against the slim schema.

- [ ] **Step 8: Full suite + typecheck**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add schemas/budget-1.0.schema.json tools/src/normalize/fields.ts tools/src/normalize/fields.test.ts tools/src/normalize/record.test.ts tools/src/validate/schemas.test.ts
git commit -m "feat(schema): slim the normalized budget record to the six essential fields"
```

---

### Task 4: Migrate the two Addison Central warehouse records

The only two real records were authored under the old shape. Rewrite them to the slim shape. The two new fields were never captured, so they become `null` with a `lines_flagged` `pending` entry each — this is honest (the source book almost certainly prints prior-year actuals; they simply have not been transcribed) and keeps the null accounted without falsely claiming the source omits them. After this, `npm run validate` is green again.

**Files:**
- Modify: `warehouse/su-addison-central/fy2024-proposed.yaml`
- Modify: `warehouse/su-addison-central/fy2023-proposed.yaml`

**Interfaces:**
- Consumes: the slim schema (Task 3) and slim `ACCOUNTABLE` (Task 2).
- Produces: two records validating clean under `npm run validate`.

- [ ] **Step 1: Rewrite `fy2024-proposed.yaml`**

Overwrite with exactly:

```yaml
schema_version: "1.0"
extracted_by: "@jamesjnadeau"
extracted_date: 2026-08-02
entity: su/addison-central
fiscal_year: 2024
status: proposed
source: intake/su-addison-central/fy2023/Annual Report FY23 Budget Book.pdf
adopted_date: 2021-03-02
revenues:
  education_fund: 5339299
  education_fund_previous_year_actual: null
  total_stated: 9239721
expenditures:
  total_stated: 46338984
  previous_year_actual: null
tax:
  towns:
    - town: town/bridport
      homestead_rate_stated: 1.71
      cla: 90.58
    - town: town/cornwall
      homestead_rate_stated: 1.72
      cla: 90.02
    - town: town/middlebury
      homestead_rate_stated: 1.66
      cla: 93.4
    - town: town/ripton
      homestead_rate_stated: 1.85
      cla: 83.61
    - town: town/salisbury
      homestead_rate_stated: 1.78
      cla: 87.27
    - town: town/shoreham
      homestead_rate_stated: 1.65
      cla: 94.08
    - town: town/weybridge
      homestead_rate_stated: 1.61
      cla: 96.53
lines_flagged:
  - path: revenues.education_fund_previous_year_actual
    issue: prior-year actual education-fund receipts not yet transcribed from the source; backfill from the budget book
    resolution: pending
  - path: expenditures.previous_year_actual
    issue: prior-year actual total expenditure not yet transcribed from the source; backfill from the budget book
    resolution: pending
not_published: []
```

- [ ] **Step 2: Rewrite `fy2023-proposed.yaml`**

Overwrite with exactly:

```yaml
schema_version: "1.0"
extracted_by: "@jamesjnadeau"
extracted_date: 2026-08-01
entity: su/addison-central
fiscal_year: 2023
status: proposed
source: intake/su-addison-central/fy2023/Annual Report FY23 Budget Book.pdf
adopted_date: 2021-03-02
revenues:
  education_fund: 4392664
  education_fund_previous_year_actual: null
  total_stated: 7014771
expenditures:
  total_stated: 41578089
  previous_year_actual: null
tax:
  towns:
    - town: town/bridport
      homestead_rate_stated: 1.71
      cla: 90.58
    - town: town/cornwall
      homestead_rate_stated: 1.72
      cla: 90.02
    - town: town/middlebury
      homestead_rate_stated: 1.66
      cla: 93.4
    - town: town/ripton
      homestead_rate_stated: 1.85
      cla: 83.61
    - town: town/salisbury
      homestead_rate_stated: 1.78
      cla: 87.27
    - town: town/shoreham
      homestead_rate_stated: 1.65
      cla: 94.08
    - town: town/weybridge
      homestead_rate_stated: 1.61
      cla: 96.53
lines_flagged:
  - path: revenues.education_fund_previous_year_actual
    issue: prior-year actual education-fund receipts not yet transcribed from the source; backfill from the budget book
    resolution: pending
  - path: expenditures.previous_year_actual
    issue: prior-year actual total expenditure not yet transcribed from the source; backfill from the budget book
    resolution: pending
not_published: []
```

- [ ] **Step 3: Validate the warehouse**

Run: `npm run validate`
Expected: exit 0. If the two intake PDFs are unfetched Git LFS pointers you may see `hash-verification` **warnings** (not errors) — those do not fail the run. If it errors on missing LFS bytes, run `git lfs pull` first and re-run.

- [ ] **Step 4: Smoke-check the site data build still reads the slim records**

Run: `npm run build:data`
Expected: completes without error (the coverage build keys off `entity`/`fiscal_year`/`status`, none of the removed fields).

- [ ] **Step 5: Commit**

```bash
git add warehouse/su-addison-central/fy2023-proposed.yaml warehouse/su-addison-central/fy2024-proposed.yaml
git commit -m "data(addison-central): migrate the two budget records to the slim model"
```

---

### Task 5: Slim the budget-normalize intake form

Bring the human intake form into agreement with `FIGURE_FIELDS`: the five essential money fields (all required, number-or-`n/p`), `tax.towns`, `lines_flagged`, and the identity/optional metadata inputs. Remove every personnel/enrollment/per-pupil/granular input and `membership_note`.

**Files:**
- Modify: `.github/ISSUE_TEMPLATE/budget-normalize.yml`

**Interfaces:**
- Consumes: the `FIGURE_FIELDS` paths from Task 3 (the input `label`s must equal those dotted paths — `record.ts` reads the form by label).
- Produces: a form whose figure inputs are exactly the five essential paths plus `tax.towns` and `lines_flagged`.

- [ ] **Step 1: Replace the figure inputs**

Keep the `markdown` header and the identity inputs (`entity`, `fiscal_year`, `status`, `source`, `source_pages`, `adopted_date`) exactly as they are. Replace everything from the `revenues_education_fund` input up to (but not including) the `tax_towns` textarea with these five inputs:

```yaml
  - type: input
    id: revenues_education_fund
    attributes:
      label: "revenues.education_fund"
      description: This year's education-fund receipts. Whole dollars, or n/p if the document does not publish it.
      placeholder: "number or n/p"
    validations:
      required: true
  - type: input
    id: revenues_education_fund_previous_year_actual
    attributes:
      label: "revenues.education_fund_previous_year_actual"
      description: Prior year's ACTUAL education-fund receipts (the comparison column). Whole dollars, or n/p.
      placeholder: "number or n/p"
    validations:
      required: true
  - type: input
    id: revenues_total_stated
    attributes:
      label: "revenues.total_stated"
      description: This year's total revenue as printed. Whole dollars, or n/p.
      placeholder: "number or n/p"
    validations:
      required: true
  - type: input
    id: expenditures_total_stated
    attributes:
      label: "expenditures.total_stated"
      description: This year's total expenditure as printed. Whole dollars, or n/p.
      placeholder: "number or n/p"
    validations:
      required: true
  - type: input
    id: expenditures_previous_year_actual
    attributes:
      label: "expenditures.previous_year_actual"
      description: Prior year's ACTUAL total expenditure (the comparison column). Whole dollars, or n/p.
      placeholder: "number or n/p"
    validations:
      required: true
```

Leave the `tax_towns` and `lines_flagged` textareas unchanged.

- [ ] **Step 2: Verify the form has only the intended figure fields**

Run: `grep -nE "label: \"(revenues|expenditures|personnel|enrollment|per_pupil)" .github/ISSUE_TEMPLATE/budget-normalize.yml`
Expected: exactly five lines — the three `revenues.*` and two `expenditures.*` labels above; **no** `personnel`, `enrollment`, or `per_pupil` labels.

- [ ] **Step 3: Verify the form is still well-formed YAML**

Run: `npx js-yaml .github/ISSUE_TEMPLATE/budget-normalize.yml > /dev/null && echo OK`
Expected: `OK` (no parse error). If `js-yaml` is not available as a bin, use `node -e "require('js-yaml').load(require('fs').readFileSync('.github/ISSUE_TEMPLATE/budget-normalize.yml','utf8')); console.log('OK')"`.

- [ ] **Step 4: Commit**

```bash
git add .github/ISSUE_TEMPLATE/budget-normalize.yml
git commit -m "feat(intake): slim the budget-normalize form to the six essential fields"
```

---

### Task 6: Retire the dormant extract/mapping subsystem

`extract.ts` and `mapping-1.0.schema.json` exist only to enforce the personnel declaration being removed. They have no tests, no CI wiring, no importers, and no mapping files on disk. Delete them and the four references that keep them loadable.

**Files:**
- Delete: `tools/src/cli/extract.ts`
- Delete: `schemas/mapping-1.0.schema.json`
- Modify: `package.json` (remove the `extract` script)
- Modify: `tools/src/validate/schemas.ts` (remove `mapping` from `SchemaName` and `SCHEMA_IDS`)
- Modify: `tools/src/cli/validate.ts` (remove the extraction-mappings walk and `counts.mappings`)

**Interfaces:**
- Consumes: nothing.
- Produces: `SchemaName` no longer includes `'mapping'`; the validate CLI no longer walks `collectors/**/fyNNNN.yaml`.

- [ ] **Step 1: Confirm nothing else references them**

Run: `grep -rn "cli/extract\|schema:mapping\|'mapping'\|\"mapping\"\|counts.mappings" tools/src package.json`
Expected: matches only in the files listed above (plus `schemas.ts` and `validate.ts` as noted). If a match appears elsewhere, add that file to this task.

- [ ] **Step 2: Delete the two files**

```bash
git rm tools/src/cli/extract.ts schemas/mapping-1.0.schema.json
```

- [ ] **Step 3: Remove the `extract` script from `package.json`**

Delete this line from `"scripts"`:

```json
    "extract": "tsx tools/src/cli/extract.ts",
```

- [ ] **Step 4: Remove `mapping` from `schemas.ts`**

In the `SchemaName` union delete the `| 'mapping'` member, and in the `SCHEMA_IDS` object delete the line:

```ts
  mapping: 'urn:vt-budget:schema:mapping:1.0',
```

- [ ] **Step 5: Remove the extraction-mappings walk in `validate.ts`**

Delete the whole block (≈ 212–220):

```ts
  // --- extraction mappings ------------------------------------------------
  for (const file of walkFiles(PATHS.collectors, (n) => /^fy\d{4}\.yaml$/.test(n))) {
    counts.mappings++;
    const data = readData(file);
    findings.push(...schemaFindings('mapping', data, file));
    findings.push(...checkRegistryRefs(data, file, registry));
  }
```

Then delete `mappings: 0,` from the `counts` object (≈ 143), and remove the `` `${counts.mappings} mapping(s), ` `` fragment from the summary string (≈ 335) so the sentence reads `… collector config(s), ${counts.provenance} provenance file(s), …`.

- [ ] **Step 6: Typecheck, test, validate**

Run: `npm run typecheck && npm test && npm run validate`
Expected: PASS. `grep -rn "mapping" tools/src` shows no `schema:mapping` / `SchemaName` residue (unrelated substrings elsewhere are fine).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: retire the dormant extract CLI and mapping schema"
```

---

### Task 7: Trim the merger engine to totals-only

`model/src/scenario.ts` (merged after this plan was written) models mergers off the per-district expenditure function grains and a full personnel block, and its `buildCaveats` reconciles the grains against the stated total. Commit to the totals-only direction: the headline math (combined `total_stated` × `consolidation_factor`) stays; the function-grain detail, the personnel/staffing sub-feature, and the reconcile caveat go. Nothing outside `scenario.ts` and `engine.test.ts` references these types (verified: `grep -rn "runScenario\|StaffingComparison\|DistrictBudget\|PersonnelRollup\|ExpenditureRollup\|ConsolidatedPosition" --include=*.ts --include=*.astro site tools model/src` returns only `scenario.ts`/`engine.test.ts`/`index.ts`), so this is contained.

**Files:**
- Modify: `model/src/scenario.ts`
- Modify: `model/src/engine.test.ts` (the `describe('scenarios present movement in both directions', …)` block, ≈ L520–end)

**Interfaces:**
- Consumes: nothing from earlier tasks (independent model-layer change).
- Produces: `DistrictBudget = { entity: string; fiscal_year: number; total_stated: number | null; source: string }`; `ScenarioSpec = { name; districts; assumptions }` (no `consolidatedPositions`); `ScenarioResult = { name; currentTotal; scenarioTotal; delta; assumptions; caveats }` (no `staffing`); `defaultAssumptions()` returns only the `consolidation_factor` assumption; `runScenario` and `defaultAssumptions` keep their names and signatures.

- [ ] **Step 1: Rewrite the scenario test suite first (it fails until `scenario.ts` is trimmed)**

In `model/src/engine.test.ts`, replace the entire `describe('scenarios present movement in both directions', …)` block with:

```ts
describe('scenarios present movement in both directions', () => {
  const base: DistrictBudget = {
    entity: 'ud/a',
    fiscal_year: 2027,
    total_stated: 1_700_000,
    source: 'test fixture',
  };
  const two = [base, { ...base, entity: 'ud/b' }];

  it('reports a signed delta that can go either way', () => {
    const ctx = createContext(syntheticParameters());
    const reduced = runScenario(ctx, {
      name: 'assume a 5% consolidation efficiency',
      districts: two,
      assumptions: defaultAssumptions().map((a) =>
        a.key === 'consolidation_factor' ? { ...a, value: 0.95 } : a,
      ),
    });
    expect(reduced.currentTotal.value).toBe(3_400_000);
    expect(reduced.delta.value).toBeCloseTo(-170_000, 6);

    const increased = runScenario(ctx, {
      name: 'assume costs rise 5% during the transition',
      districts: two,
      assumptions: defaultAssumptions().map((a) =>
        a.key === 'consolidation_factor' ? { ...a, value: 1.05 } : a,
      ),
    });
    expect(increased.delta.value).toBeCloseTo(170_000, 6);
  });

  it('reports the current total as unknown when a district did not publish it', () => {
    const ctx = createContext(syntheticParameters());
    const missing: DistrictBudget = { ...base, entity: 'ud/c', total_stated: null };
    const result = runScenario(ctx, {
      name: 'one district published no total',
      districts: [base, missing],
      assumptions: defaultAssumptions(),
    });
    expect(result.currentTotal.value).toBeNull();
    expect(result.delta.value).toBeNull();
  });

  it('changes nothing at all under default assumptions', () => {
    const ctx = createContext(syntheticParameters());
    const result = runScenario(ctx, {
      name: 'merge with no assumed consolidation',
      districts: two,
      assumptions: defaultAssumptions(),
    });
    expect(result.delta.value).toBe(0);
  });
});
```

This drops the three staffing/reconcile tests ("reports an unpriced consolidated position…", "applies the health insurance trend…", "flags a district whose function rollups do not reconcile…") and the grain/personnel fixture fields, keeping only the totals-driven behavior.

- [ ] **Step 2: Run the scenario tests to watch them fail**

Run: `npx vitest run model/src/engine.test.ts -t "movement in both directions"`
Expected: FAIL — `DistrictBudget` still requires `expenditures`/`personnel`, so the trimmed `base` fixture does not typecheck / the run errors.

- [ ] **Step 3: Rewrite `scenario.ts`**

Overwrite `model/src/scenario.ts` with this exact content:

```ts
/**
 * Scenario composition: merging districts.
 *
 * Two rules from the plan govern this file.
 *
 * FIRST -- the tool computes and explains; it never scores, ranks or
 * recommends. There is no `savings` field anywhere in these types, and there
 * will not be one. A scenario produces a `delta`, a signed number, and the
 * presentation layer shows movement in both directions with equal weight.
 *
 * SECOND -- the merger math runs on published totals only. Districts do not
 * slice their budgets the same way, so a line-by-line model would compare
 * figures that are not comparable. The headline delta is a single consolidation
 * factor applied to the combined published total expenditure.
 *
 * Every assumption is an explicit, labelled, user-adjustable object carrying its
 * own rationale. Nothing is hidden in a constant.
 */

import { difference, input, product } from './node.ts';
import type { CalcNode, EngineContext, Unit } from './types.ts';

export interface Assumption {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly unit: Unit;
  /** Why this default. Rendered in the assumptions register beside the result. */
  readonly rationale: string;
  readonly userAdjustable: boolean;
}

export interface DistrictBudget {
  readonly entity: string;
  readonly fiscal_year: number;
  /** Total expenditure as published. The figure the merger math runs on. */
  readonly total_stated: number | null;
  readonly source: string;
}

export interface ScenarioSpec {
  readonly name: string;
  readonly districts: readonly DistrictBudget[];
  readonly assumptions: readonly Assumption[];
}

/**
 * The defaults a scenario starts from.
 *
 * The consolidation factor starts at 1.0 -- no change -- so any movement shown
 * is one the user chose and can see, never one the tool assumed for them.
 */
export function defaultAssumptions(): Assumption[] {
  return [
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
  ];
}

function assumptionValue(spec: ScenarioSpec, key: string): number {
  const found = spec.assumptions.find((a) => a.key === key);
  if (found) return found.value;
  const fallback = defaultAssumptions().find((a) => a.key === key);
  if (!fallback) throw new Error(`Unknown assumption "${key}".`);
  return fallback.value;
}

function totalOf(
  districts: readonly DistrictBudget[],
  pick: (d: DistrictBudget) => number | null,
): number | null {
  let acc = 0;
  for (const d of districts) {
    const v = pick(d);
    if (v === null) return null;
    acc += v;
  }
  return acc;
}

export interface ScenarioResult {
  readonly name: string;
  readonly currentTotal: CalcNode;
  readonly scenarioTotal: CalcNode;
  readonly delta: CalcNode;
  readonly assumptions: readonly Assumption[];
  /** Everything the user should know before quoting this result at a meeting. */
  readonly caveats: readonly string[];
}

export function runScenario(ctx: EngineContext, spec: ScenarioSpec): ScenarioResult {
  const currentValue = totalOf(spec.districts, (d) => d.total_stated);
  const currentTotal = input(ctx, 'Total expenditure, current structure', currentValue, 'usd', {
    source: spec.districts.map((d) => d.source).join('; '),
    notes: [
      'The sum of each district’s published total expenditure. Districts do not ' +
        'slice their budgets the same way, so only the published totals are summed.',
    ],
  });

  const factor = assumptionValue(spec, 'consolidation_factor');
  const multiplier = input(ctx, assumptionLabel(spec, 'consolidation_factor'), factor, 'multiplier', {
    source: 'scenario assumption',
  });
  const scenarioTotal = product(ctx, 'Total expenditure, scenario', currentTotal, multiplier, 'usd');
  const delta = difference(ctx, 'Change in total expenditure', scenarioTotal, currentTotal, 'usd');

  return {
    name: spec.name,
    currentTotal,
    scenarioTotal,
    delta,
    assumptions: spec.assumptions.length > 0 ? spec.assumptions : defaultAssumptions(),
    caveats: buildCaveats(),
  };
}

function assumptionLabel(spec: ScenarioSpec, key: string): string {
  const all = [...spec.assumptions, ...defaultAssumptions()];
  return all.find((a) => a.key === key)?.label ?? key;
}

function buildCaveats(): string[] {
  return [
    'This scenario changes district boundaries on paper. It does not model the ' +
      'transition costs of getting there: contract harmonization, severance, ' +
      'systems integration, or the multi-year period in which two structures ' +
      'run in parallel.',
    'The headline delta is a single consolidation factor applied to the combined ' +
      'published total expenditure. The tool does not model which functions change ' +
      'or by how much, and it does not separate debt service, construction aid or ' +
      'transportation routing, all of which are out of scope for version 1.',
  ];
}
```

- [ ] **Step 4: Run the scenario tests to verify they pass**

Run: `npx vitest run model/src/engine.test.ts`
Expected: PASS. Confirm the `DistrictBudget` import in `engine.test.ts` still resolves (it does — still exported).

- [ ] **Step 5: Typecheck + full suite**

Run: `npm run typecheck && npm test`
Expected: PASS. `grep -rn "PersonnelRollup\|ExpenditureRollup\|StaffingComparison\|ConsolidatedPosition\|computeStaffing\|consolidatedPositions" model tools site` returns nothing.

- [ ] **Step 6: Commit**

```bash
git add model/src/scenario.ts model/src/engine.test.ts
git commit -m "feat(model): make the merger engine totals-only, dropping the staffing and function-grain model"
```

---

### Task 8: Update the prose design docs

Bring the prose documents that enumerate budget fields (and the merger tool's design) into agreement so the next contributor is not told to capture or model a shape that no longer exists.

**Files:**
- Modify: `docs/superpowers/specs/2026-07-31-warehouse-normalize-channel-design.md` (the field lists, ≈ L74–100)
- Modify: `PLAN.md` (§5 field tree ≈ L89–135, the principle/extraction prose ≈ L137–139, **and** the §7 merger-tool description ≈ L163–174 that frames staffing as the tool's core)

**Interfaces:**
- Consumes: the final field set (Global Constraints).
- Produces: no code; docs match the schema.

- [ ] **Step 1: Rewrite the normalize-channel spec field section**

In `docs/superpowers/specs/2026-07-31-warehouse-normalize-channel-design.md`, replace the "Accountable figures" and "Optional descriptive fields" subsections (the bulleted lists) with:

```markdown
### Accountable figures — a number or `n/p`

These are exactly the fields the validator's null-accounting rule holds
accountable. Each must be a number or the literal `n/p`; empty is rejected.

- **Revenues:** `education_fund`, `education_fund_previous_year_actual`,
  `total_stated`
- **Expenditures:** `total_stated`, `previous_year_actual`
- **Tax:** each member town's `homestead_rate_stated` and `cla`

### Optional descriptive fields — blank is fine

Identity/metadata only: `source_pages`, `adopted_date`. Every budget figure is
now accountable, so there are no optional numeric fields.
```

- [ ] **Step 2: Replace the PLAN.md §5 field tree**

In `PLAN.md`, replace the YAML block under "## 5. The budget template and normalization" (the `revenues: / expenditures: / personnel: / enrollment: / per_pupil: …` tree) with:

```yaml
schema_version: "1.0"
entity: su/<slug>                     # registry slug
fiscal_year: 2027
status: proposed|warned|approved|actual
source: intake/<slug>/fy<year>/<file> # the raw artifact this came from
revenues:
  education_fund: …                   # this year's education-fund receipts
  education_fund_previous_year_actual: …  # prior year's ACTUAL, from the comparison column
  total_stated: …                     # this year's total revenue as printed
expenditures:
  total_stated: …                     # this year's total expenditure as printed
  previous_year_actual: …             # prior year's ACTUAL total expenditure
tax:
  towns: [ { town, homestead_rate_stated, cla } ]  # per member town, as stated
not_published: [ … ]                  # every null accounted for, with who/when
lines_flagged: [ … ]                  # anything that didn't fit cleanly
```

- [ ] **Step 3: Trim the §5 design-principle and extraction prose**

Replace the "Design principles for the schema" sentence (≈ L137) and the "Layer 2 — extraction" paragraph (≈ L139) with a short statement of the slim model:

```markdown
Design principles for the schema: **essentials only** (the current-year stated
revenue and education-fund receipts, the current-year stated expenditure total,
the prior-year actuals for each, and the per-town stated tax figures — six
figures, not a chart of accounts), **a null always means "not published"**
(enforced by the null-accounting rule: every null is listed in `not_published`
or `lines_flagged`), and **version the schema** so records stay readable as it
evolves.

**Extraction.** Records are entered through the `budget-normalize` issue form,
which mirrors these fields one-to-one; a bot validates the submission against
the schema and opens a pull request adding the warehouse record. Every warehouse
record links back to its intake artifact; CI rejects any record whose `source`
does not exist or whose schema validation fails.
```

- [ ] **Step 4: Update PLAN.md §7.1 to describe the totals-only merger tool**

In `PLAN.md` §7.1, replace the "**staff costs, split salary vs. benefits** — consolidation math runs through the `personnel` block…" bullet with one that matches the totals-only engine:

```markdown
- **combined published total expenditure**, with a single explicit, user-visible
  consolidation factor (starting at 1.0 — no change) applied to the combined
  total; the tool models the headline delta off published totals only, because
  districts do not slice their budgets the same way, and shows movement in both
  directions with equal weight;
```

(Leave the other §7.1 bullets — membership, per-weighted-pupil spending, homestead rate — unchanged.)

- [ ] **Step 5: Verify no stale field references remain in the edited sections**

Run: `sed -n '83,141p' PLAN.md | grep -nE "personnel|per_pupil|enrollment|instruction|mapping file|extract\b"` — expected: no matches.
Run: `sed -n '163,175p' PLAN.md | grep -nE "personnel block|staffing claims|salary vs\. benefits"` — expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add PLAN.md docs/superpowers/specs/2026-07-31-warehouse-normalize-channel-design.md
git commit -m "docs: describe the slim six-field budget model and totals-only merger tool"
```

---

## Final verification

- [ ] Run the full gate suite: `npm run typecheck && npm test && npm run validate`
- [ ] `grep -rn "checkRecomputation\|schema:mapping\|per_pupil\|PersonnelRollup\|ExpenditureRollup\|computeStaffing" tools/src schemas model/src` returns only unrelated hits (e.g. `statewide_average_per_pupil` in the engine, which is not a budget field).
- [ ] The `budget-normalize.yml` form, `FIGURE_FIELDS`, `ACCOUNTABLE`, and `schemas/budget-1.0.schema.json` all list the same six essential fields.
- [ ] `model/src/scenario.ts` compiles with `DistrictBudget = { entity, fiscal_year, total_stated, source }` and no staffing types; `engine.test.ts` passes.

## Notes & scope boundaries

- **`revenues.total_stated` becomes accountable.** Previously it was an optional printed total (blank → null, no accounting). Under the "keep null-accounting for the essentials" decision it now demands a number or `n/p`, same as the other four money fields. This is intentional.
- **The two migrated records carry `null` prior-year actuals** with `pending` `lines_flagged` entries. They are valid but incomplete; backfilling the real figures from the FY23 budget book is a follow-up data task, not part of this plan.
- **CLA values in the existing records are stored as percentages** (e.g. `90.58`) rather than the ratio the schema describes (`0.9058`). This is a pre-existing data issue, untouched here — flag separately if you want it corrected.
- **The merger engine's staffing model is deleted, not preserved elsewhere.** Task 7 removes the personnel/health-insurance/position-consolidation sub-feature that `total-driven-merger-calc` merged on 2026-08-02. It is recoverable from git history if a later version wants a staffing view back, but this plan does not keep it behind a flag. This reverses the direction stated in the merged `scenario.ts` header and PLAN.md §7 (updated in Task 8).
- **`docs/superpowers/plans/2026-08-02-total-driven-merger-calc.md`** (the merged feature's own plan) is left as a historical record and not edited.
