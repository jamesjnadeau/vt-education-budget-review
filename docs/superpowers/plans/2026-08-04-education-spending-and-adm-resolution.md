# Education Spending & District-First ADM Resolution — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape the normalized budget record around a single captured **education spending** figure plus district-stated **ADM by statutory band**, keep the per-town tax block and the null-accounting sentinel, add a free-text **notes** field, and build the district-first ADM resolution that feeds the `/model` tool and a calculated-vs-published homestead table on the SU page.

**Architecture:** The budget field list is duplicated across four in-sync surfaces — the JSON schema (`schemas/budget-1.0.schema.json`), the null-accounting rule (`tools/src/validate/rules.ts`), the form↔record table (`tools/src/normalize/fields.ts`), and the GitHub issue form (`.github/ISSUE_TEMPLATE/budget-normalize.yml`). We edit schema `1.0` in place (the only two records are unpublished) and migrate them. On top of that, a pure per-band resolver (`model/src/adm-resolution.ts`) prefers the district's stated ADM over the state's AOE count; a tools-side lookup (`tools/src/adm-lookup.ts`) rolls AOE town figures up to an entity; both feed a published `resolved-adm.json`, a `/model` prefill, a validator cross-check warning, and a build-time homestead comparison rendered on the SU page.

**Tech Stack:** TypeScript (Node, ESM, `tsx`), ajv 2020 JSON-Schema validation, Vitest, Astro (build-time pages + a browser island), GitHub issue-form YAML.

## Global Constraints

- **The complete required field set** of a normalized budget record after this change — nothing else is required:
  - `schema_version`, `entity`, `fiscal_year`, `status`, `source` (identity, unchanged)
  - `education_spending` *(new, replaces the whole `revenues` and `expenditures` blocks)*
  - `adm` *(new object; all four band keys required-but-nullable)*
  - `tax` (unchanged — `towns[]` of `{ town, homestead_rate_stated, nonhomestead_rate_stated?, cla }`)
  - `not_published`, `lines_flagged` (accounting arrays, unchanged)
  - `notes` is a **new optional** top-level `string | null`, default `null`; never required, never accountable.
- **Removed entirely** from the schema, form, `FIGURE_FIELDS`, and `ACCOUNTABLE`: the whole `revenues` block (`education_fund`, `education_fund_previous_year_actual`, `total_stated`) and the whole `expenditures` block (`total_stated`, `previous_year_actual`).
- **The four ADM band keys are the statutory-band vocabulary verbatim:** `prekindergarten`, `kindergarten_through_5`, `grades_6_through_8`, `grades_9_through_12`. Each is `{ type: [number, null], minimum: 0 }` in the schema and `accountable: true` in `FIGURE_FIELDS`.
- **Accountable figures** (a number or `n/p`; a blank is rejected): `education_spending`, the four `adm.*` bands, and each town's `homestead_rate_stated` and `cla` (unchanged).
- **Schema version stays `1.0`, edited in place.** Do not create a `2.0`. Migrate the two existing records.
- **Null-accounting sentinel is kept.** Every null in an accountable field is explained in `not_published` (who/when) or `lines_flagged`.
- **ADM resolution is per-band and same-fiscal-year:** each band resolves independently to `district` (record's `adm.<band>` non-null), else `aoe` (AOE statutory-band value for the same entity and fiscal year), else `unknown`. The AOE fallback never uses an adjacent year and never reconciles a disagreement — it only fills a gap or (via the cross-check) warns.
- **Derived data is never committed.** `resolved-adm.json` and `homestead-comparison.json` are built into `site/src/generated/` at build time, like `adm.json`.
- **The engine refuses to compute from an unverified parameter.** The homestead "calculated" column will therefore be a blocker (not a number) for every real year until parameters are verified; this is expected and correct.
- **Published shapes produced by this plan** (used across tasks):
  - `ResolvedBand = { value: number | null; source: 'district' | 'aoe' | 'unknown' }`
  - `ResolvedAdm = { prekindergarten: ResolvedBand; kindergarten_through_5: ResolvedBand; grades_6_through_8: ResolvedBand; grades_9_through_12: ResolvedBand }`
  - `resolved-adm.json = { generated: string; entities: Record<string /*entity slug*/, Record<string /*fiscal year*/, ResolvedAdm>> }`
  - `homestead-comparison.json = { generated: string; sus: Record<string /*su slug*/, Record<string /*fiscal year*/, Array<{ town: string; published: number | null; calculated: number | null; blocker: string | null; difference: number | null }>>> }`
- **Gates** (npm scripts): `npm run typecheck` (`tsc --build --force`), `npm test` (`vitest run`), `npm run validate` (`tsx tools/src/cli/validate.ts`), `npm run build:data`. Money is whole dollars; ADM is pupils to two decimals; a `null` value in an accountable field always means "the source did not publish it" and must be accounted for.

---

## File Structure

**Edited**
- `schemas/budget-1.0.schema.json` — reshape the record body (Task 1).
- `tools/src/normalize/fields.ts` — `FIGURE_FIELDS` + `FigureKind` (Task 1).
- `tools/src/normalize/record.ts` — read `notes` (Task 1).
- `tools/src/validate/rules.ts` — `ACCOUNTABLE` list (Task 1); new `checkAdmCrossCheck` (Task 5).
- `.github/ISSUE_TEMPLATE/budget-normalize.yml` — figure inputs + notes (Task 1).
- `tools/src/normalize/fields.test.ts`, `tools/src/normalize/record.test.ts`, `tools/src/validate/schemas.test.ts`, `tools/src/validate/rules.test.ts` — tests (Tasks 1, 5).
- `warehouse/su-addison-central/fy2023-proposed.yaml`, `fy2024-proposed.yaml` — migrate (Task 2).
- `model/src/scenario.ts`, `model/src/engine.test.ts` — `total_stated` → `education_spending` (Task 3).
- `tools/src/grouping-budgets.ts`, `tools/src/grouping-budgets.test.ts` — `adapt()` reads `education_spending` (Task 3).
- `tools/src/aoe/adm/publish.ts`, `tools/src/aoe/adm/publish.test.ts` — statutory-band output (Task 4).
- `tools/src/cli/build-data.ts` — emit `resolved-adm.json` and `homestead-comparison.json` (Tasks 5, 7).
- `tools/src/cli/validate.ts` — wire the ADM cross-check (Task 5).
- `site/src/pages/model/index.astro`, `site/src/scripts/model-tool.ts` — entity+year ADM prefill (Task 6).
- `site/src/pages/su/[slug].astro` — homestead comparison table (Task 7).
- `PLAN.md`, `docs/superpowers/specs/2026-07-31-warehouse-normalize-channel-design.md`, `site/src/content/explanations/vt-4-glossary.md` — docs (Task 8).

**Created**
- `model/src/adm-resolution.ts`, `model/src/adm-resolution.test.ts` (Task 5).
- `tools/src/adm-lookup.ts`, `tools/src/adm-lookup.test.ts` (Task 5).
- `tools/src/homestead-comparison.ts`, `tools/src/homestead-comparison.test.ts` (Task 7).

**`record.ts` figure loop is deliberately not edited** — it iterates `FIGURE_FIELDS` generically, so slimming that table changes its output with no code change; only the new `notes` read is added.

---

### Task 1: Reshape the budget record (schema + field surfaces + tests)

The atomic model change: the JSON schema, `FIGURE_FIELDS`, `ACCOUNTABLE`, the issue form, and `record.ts`'s `notes` read move together with their tests, so `buildRecord` produces a record that validates against the reshaped schema. Vitest is green at the end; the two on-disk warehouse records still describe the old shape and fail `npm run validate` until Task 2 (the one deliberately-deferred red).

**Files:**
- Modify: `schemas/budget-1.0.schema.json`, `tools/src/normalize/fields.ts`, `tools/src/normalize/record.ts`, `tools/src/validate/rules.ts`, `.github/ISSUE_TEMPLATE/budget-normalize.yml`
- Test: `tools/src/validate/schemas.test.ts`, `tools/src/normalize/fields.test.ts`, `tools/src/normalize/record.test.ts`, `tools/src/validate/rules.test.ts`

**Interfaces:**
- Produces: budget record requires `[schema_version, entity, fiscal_year, status, source, education_spending, adm, tax, not_published, lines_flagged]`; `adm` requires the four band keys. `FIGURE_FIELDS` is `education_spending` (`money`) + four `adm.*` (`adm`), all `accountable: true`. `FigureKind` includes `'adm'`. `notes` is read into `record.notes` (`string | null`).

- [ ] **Step 1: Rewrite the schema-regression suites to the new shape (they fail first)**

In `tools/src/validate/schemas.test.ts`, delete the two suites `describe('budget schema requires a stated expenditure total', …)` (lines 29–37) and `describe('budget schema is slimmed to the essentials', …)` (lines 39–67), and replace them with:

```ts
describe('budget schema is reshaped around education spending', () => {
  const schema = JSON.parse(
    readFileSync(join(PATHS.schemas, 'budget-1.0.schema.json'), 'utf8'),
  );

  it('requires exactly the reshaped top-level blocks', () => {
    expect(new Set(schema.required)).toEqual(
      new Set([
        'schema_version', 'entity', 'fiscal_year', 'status', 'source',
        'education_spending', 'adm', 'tax', 'not_published', 'lines_flagged',
      ]),
    );
  });

  it('has dropped the revenues and expenditures blocks', () => {
    expect(schema.properties.revenues).toBeUndefined();
    expect(schema.properties.expenditures).toBeUndefined();
  });

  it('carries education_spending and the four statutory ADM bands', () => {
    expect(schema.properties.education_spending).toBeDefined();
    expect(new Set(schema.properties.adm.required)).toEqual(
      new Set([
        'prekindergarten', 'kindergarten_through_5',
        'grades_6_through_8', 'grades_9_through_12',
      ]),
    );
  });

  it('has an optional, non-required notes field', () => {
    expect(schema.properties.notes).toBeDefined();
    expect((schema.required as string[])).not.toContain('notes');
  });
});
```

- [ ] **Step 2: Run the schema suite to watch it fail**

Run: `npx vitest run tools/src/validate/schemas.test.ts -t "reshaped around education spending"`
Expected: FAIL — the current schema still has `revenues`/`expenditures`.

- [ ] **Step 3: Replace the budget schema body**

Overwrite `schemas/budget-1.0.schema.json` with exactly:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:vt-budget:schema:budget:1.0",
  "title": "Normalized district budget record, schema version 1.0",
  "description": "One record per district-fiscal-year. Deliberately minimal: the district's published education spending, its stated average daily membership by statutory grade band, the per-town stated tax figures, and free-text notes. A null value in an accountable field means the source document did not publish that figure; it never means it was not looked for. The validator enforces that guarantee by requiring every such null to be accounted for in `not_published` or `lines_flagged`.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schema_version",
    "entity",
    "fiscal_year",
    "status",
    "source",
    "education_spending",
    "adm",
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

    "education_spending": {
      "$ref": "urn:vt-budget:schema:common:1.0#/$defs/money",
      "description": "The district's published Education Spending figure -- budgeted expenditures net of offsetting revenues (federal grants, categorical aid, non-tax revenue). This is the figure that drives the homestead tax rate. Transcribed as printed; not recomputed here."
    },

    "adm": {
      "type": "object",
      "additionalProperties": false,
      "description": "District-STATED average daily membership by statutory grade band (16 V.S.A. 4010), as printed in this budget document. Kept separate from the state's AOE count; where they disagree the discrepancy is recorded, never reconciled. A null band was not published by this document.",
      "required": ["prekindergarten", "kindergarten_through_5", "grades_6_through_8", "grades_9_through_12"],
      "properties": {
        "prekindergarten": { "type": ["number", "null"], "minimum": 0 },
        "kindergarten_through_5": { "type": ["number", "null"], "minimum": 0 },
        "grades_6_through_8": { "type": ["number", "null"], "minimum": 0 },
        "grades_9_through_12": { "type": ["number", "null"], "minimum": 0 }
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

    "notes": {
      "type": ["string", "null"],
      "default": null,
      "description": "Free-text context that does not belong in the structured accounting arrays. Never held to null-accounting."
    },

    "not_published": {
      "type": "array",
      "description": "Dotted paths of fields this source document does not publish, each confirmed absent by a human rather than merely skipped. The validator requires that every null in an accountable field appears here or in lines_flagged. This is what makes a null mean 'the district did not publish it' instead of 'we did not look'.",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["path", "confirmed_by", "confirmed_date"],
        "properties": {
          "path": {
            "type": "string",
            "pattern": "^[a-z_]+(\\.[a-z_0-9]+)*$",
            "examples": ["education_spending", "adm.prekindergarten"]
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

- [ ] **Step 4: Replace `FIGURE_FIELDS` and extend `FigureKind` in `fields.ts`**

Change the `FigureKind` type to include `'adm'`:

```ts
export type FigureKind = 'money' | 'adm' | 'fte' | 'number' | 'text';
```

Replace the whole `export const FIGURE_FIELDS` array with:

```ts
export const FIGURE_FIELDS: readonly FigureField[] = [
  { path: 'education_spending', kind: 'money', accountable: true },
  { path: 'adm.prekindergarten', kind: 'adm', accountable: true },
  { path: 'adm.kindergarten_through_5', kind: 'adm', accountable: true },
  { path: 'adm.grades_6_through_8', kind: 'adm', accountable: true },
  { path: 'adm.grades_9_through_12', kind: 'adm', accountable: true },
];
```

Leave `parseFigure`, `setPath`, `STATUSES`, `FigureField`, and `FigureParse` unchanged (`parseFigure` already accepts decimals, which ADM needs).

- [ ] **Step 5: Read `notes` in `record.ts`**

In `buildRecord`, immediately after the tax block (after the line `else record['tax'] = { towns: tax.towns };`), add:

```ts
  // --- notes (free text, optional, never accountable) ---------------------
  const notes = get('notes');
  record['notes'] = notes && notes.trim() !== '' ? notes.trim() : null;
```

- [ ] **Step 6: Replace the `ACCOUNTABLE` list in `rules.ts`**

Replace the `ACCOUNTABLE` array (lines ~65–69) with:

```ts
const ACCOUNTABLE = [
  /^education_spending$/,
  /^adm\.(prekindergarten|kindergarten_through_5|grades_6_through_8|grades_9_through_12)$/,
  /^tax\.towns\.\d+\.(homestead_rate_stated|cla)$/,
];
```

- [ ] **Step 7: Update the null-accounting fixtures in `rules.test.ts`**

Point the `record()` helper's money/figure blocks at the new shape, and rewrite the two figure-based null tests to use essential fields. Change the helper's body so the record it builds is:

```ts
    schema_version: '1.0',
    entity: 'ud/test-55',
    fiscal_year: 2027,
    status: 'proposed',
    source: 'intake/test/fy2027/budget.pdf',
    education_spending: 1_150_000,
    adm: {
      prekindergarten: 10,
      kindergarten_through_5: 100,
      grades_6_through_8: 50,
      grades_9_through_12: 50,
    },
    tax: { towns: [{ town: 'town/test', homestead_rate_stated: 1.5, cla: 0.9 }] },
    not_published: [],
    lines_flagged: [],
```

Rewrite the "rejects an unexplained null in the personnel/essential block" test to:

```ts
  it('rejects an unexplained null in an ADM band', () => {
    const r = record({
      adm: { prekindergarten: null, kindergarten_through_5: 100, grades_6_through_8: 50, grades_9_through_12: 50 },
    });
    const findings = checkNullAccounting(r, 'f.yaml');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('error');
    expect(findings[0]?.message).toMatch(/adm\.prekindergarten is null/);
  });
```

Rewrite the "accepts the same null once confirmed absent" test to:

```ts
  it('accepts the same null once it is confirmed absent from the source', () => {
    const r = record({
      adm: { prekindergarten: null, kindergarten_through_5: 100, grades_6_through_8: 50, grades_9_through_12: 50 },
      not_published: [{ path: 'adm.prekindergarten', confirmed_by: 'jn', confirmed_date: '2026-07-29' }],
    });
    expect(checkNullAccounting(r, 'f.yaml')).toHaveLength(0);
  });
```

Rewrite the "accepts a null explained as a flagged line" test to use `education_spending`:

```ts
  it('accepts a null explained as a flagged line instead', () => {
    const r = record({
      education_spending: null,
      lines_flagged: [{ path: 'education_spending', issue: 'education spending not yet transcribed' }],
    });
    expect(checkNullAccounting(r, 'f.yaml')).toHaveLength(0);
  });
```

Leave the "does not demand an explanation for optional descriptive fields" test (using `adopted_date`) and the "lets one entry cover a whole town table" test unchanged.

- [ ] **Step 8: Update `fields.test.ts` `FIGURE_FIELDS` suite**

Replace the body of `describe('FIGURE_FIELDS', …)` (the single `it(...)`) with:

```ts
  it('is exactly education spending and the four statutory ADM bands, all accountable', () => {
    expect(FIGURE_FIELDS.map((f) => f.path)).toEqual([
      'education_spending',
      'adm.prekindergarten',
      'adm.kindergarten_through_5',
      'adm.grades_6_through_8',
      'adm.grades_9_through_12',
    ]);
    expect(FIGURE_FIELDS.every((f) => f.accountable)).toBe(true);
    expect(FIGURE_FIELDS[0]?.kind).toBe('money');
    expect(FIGURE_FIELDS.slice(1).every((f) => f.kind === 'adm')).toBe(true);
  });
```

Leave the `parseFigure`, `setPath`, and `STATUSES` suites unchanged.

- [ ] **Step 9: Update `record.test.ts` for the new shape**

Four edits:

(a) In `describe('buildRecord — happy path')`, the "records identity…" test asserts `rec.revenues.education_fund`. Replace that assertion block's figure lines with:

```ts
    expect(rec.education_spending).toBe(100);
    expect(rec.adm).toEqual({
      prekindergarten: 100,
      kindergarten_through_5: 100,
      grades_6_through_8: 100,
      grades_9_through_12: 100,
    });
    expect(rec.notes).toBeNull();
    expect(rec.tax.towns).toEqual([
      { town: 'town/addison', homestead_rate_stated: 1.52, cla: 0.8734 },
    ]);
```

(b) In `describe('buildRecord — the sentinel')`, change the two `'expenditures.previous_year_actual'` sentinel bodies and assertions to `'adm.grades_9_through_12'`. The first test becomes:

```ts
  it('turns n/p into a not_published entry attributed to the author and date', () => {
    const r = buildRecord(input({ body: body({ 'adm.grades_9_through_12': 'n/p' }) }));
    if (!r.ok) throw new Error('expected ok');
    const rec = r.record as Record<string, any>;
    expect(rec.adm.grades_9_through_12).toBeNull();
    const entry = rec.not_published.find((n: any) => n.path === 'adm.grades_9_through_12');
    expect(entry).toEqual({
      path: 'adm.grades_9_through_12',
      confirmed_by: '@octocat',
      confirmed_date: '2026-07-31',
    });
  });
```

In the "still validates…" test change `body({ 'expenditures.previous_year_actual': 'n/p' })` to `body({ 'adm.grades_9_through_12': 'n/p' })`. In "rejects an empty accountable field, naming it" change the body key and the regex to `education_spending`:

```ts
  it('rejects an empty accountable field, naming it', () => {
    const errs = errorsFrom({ body: body({ education_spending: '' }) });
    expect(errs.join('\n')).toMatch(/education_spending/);
  });
```

In "rejects a value that is neither a number nor n/p" change `revenues.education_fund` to `education_spending`:

```ts
    const errs = errorsFrom({ body: body({ education_spending: 'a lot' }) });
    expect(errs.join('\n')).toMatch(/education_spending/);
```

(c) In `describe('buildRecord — tax and lines_flagged')`, the "parses lines_flagged" test uses `expenditures.previous_year_actual` as a free-text path — replace both occurrences with `education_spending` and its issue text with `education spending line unreadable`:

```ts
  it('parses lines_flagged in the path :: issue format', () => {
    const r = buildRecord(
      input({ body: body({ lines_flagged: 'education_spending :: education spending line unreadable' }) }),
    );
    if (!r.ok) throw new Error('expected ok');
    expect((r.record as any).lines_flagged).toEqual([
      { path: 'education_spending', issue: 'education spending line unreadable', resolution: 'pending' },
    ]);
  });
```

(d) Add a `notes` read-through test to `describe('buildRecord — tax and lines_flagged')`:

```ts
  it('reads a notes field through, and defaults it to null when blank', () => {
    const withNotes = buildRecord(input({ body: body({ notes: 'warned budget; revote scheduled' }) }));
    if (!withNotes.ok) throw new Error('expected ok');
    expect((withNotes.record as any).notes).toBe('warned budget; revote scheduled');

    const without = buildRecord(input());
    if (!without.ok) throw new Error('expected ok');
    expect((without.record as any).notes).toBeNull();
  });
```

- [ ] **Step 10: Replace the figure inputs in the issue form**

In `.github/ISSUE_TEMPLATE/budget-normalize.yml`, replace the five inputs from `revenues_education_fund` through `expenditures_previous_year_actual` (lines 67–106) with:

```yaml
  - type: input
    id: education_spending
    attributes:
      label: "education_spending"
      description: The district's published Education Spending figure (expenditures net of offsetting revenues). Whole dollars, or n/p if the document does not publish it.
      placeholder: "number or n/p"
    validations:
      required: true
  - type: input
    id: adm_prekindergarten
    attributes:
      label: "adm.prekindergarten"
      description: District-stated prekindergarten ADM. A number (pupils, decimals allowed), or n/p.
      placeholder: "number or n/p"
    validations:
      required: true
  - type: input
    id: adm_kindergarten_through_5
    attributes:
      label: "adm.kindergarten_through_5"
      description: District-stated K-5 ADM. A number, or n/p.
      placeholder: "number or n/p"
    validations:
      required: true
  - type: input
    id: adm_grades_6_through_8
    attributes:
      label: "adm.grades_6_through_8"
      description: District-stated grades 6-8 ADM. A number, or n/p.
      placeholder: "number or n/p"
    validations:
      required: true
  - type: input
    id: adm_grades_9_through_12
    attributes:
      label: "adm.grades_9_through_12"
      description: District-stated grades 9-12 ADM. A number, or n/p.
      placeholder: "number or n/p"
    validations:
      required: true
```

Then add a `notes` textarea immediately before the `lines_flagged` textarea:

```yaml
  - type: textarea
    id: notes
    attributes:
      label: "notes"
      description: Optional free text — context that doesn't belong in a figure or a flagged line.
    validations:
      required: false
```

Leave the `tax_towns` textarea unchanged. (The tax help text still says `town-slug, homestead_rate, cla` — correct, unchanged.)

- [ ] **Step 11: Verify the form and run the affected suites**

Run: `grep -nE 'label: "(education_spending|adm\.|revenues|expenditures)' .github/ISSUE_TEMPLATE/budget-normalize.yml`
Expected: five lines — `education_spending` and the four `adm.*`; no `revenues`/`expenditures`.

Run: `node -e "require('js-yaml').load(require('fs').readFileSync('.github/ISSUE_TEMPLATE/budget-normalize.yml','utf8'));console.log('OK')"`
Expected: `OK`.

Run: `npx vitest run tools/src/normalize/ tools/src/validate/schemas.test.ts tools/src/validate/rules.test.ts`
Expected: PASS.

- [ ] **Step 12: Typecheck + full suite**

Run: `npm run typecheck && npm test`
Expected: PASS. (`npm run validate` is NOT run yet — the two warehouse records still describe the old shape; Task 2 fixes that.)

- [ ] **Step 13: Commit**

```bash
git add schemas/budget-1.0.schema.json tools/src/normalize/fields.ts tools/src/normalize/record.ts tools/src/validate/rules.ts .github/ISSUE_TEMPLATE/budget-normalize.yml tools/src/normalize/fields.test.ts tools/src/normalize/record.test.ts tools/src/validate/schemas.test.ts tools/src/validate/rules.test.ts
git commit -m "feat(schema): reshape the budget record around education spending and district-stated ADM"
```

---

### Task 2: Migrate the two Addison Central warehouse records

The only two real records were authored under the old shape. Rewrite them: `education_spending` and all four `adm.*` were never captured, so they become `null` with a `pending` `lines_flagged` entry each (honest — not-yet-transcribed, not not-published). The tax block is kept verbatim. After this, `npm run validate` is green.

**Files:** Modify `warehouse/su-addison-central/fy2024-proposed.yaml`, `warehouse/su-addison-central/fy2023-proposed.yaml`

**Interfaces:** Consumes the reshaped schema (Task 1) and slim `ACCOUNTABLE` (Task 1).

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
adopted_date: 2023-03-01
education_spending: null
adm:
  prekindergarten: null
  kindergarten_through_5: null
  grades_6_through_8: null
  grades_9_through_12: null
tax:
  towns:
    - town: town/bridport
      homestead_rate_stated: 1.77
      cla: .7929
    - town: town/cornwall
      homestead_rate_stated: 1.63
      cla: .8567
    - town: town/middlebury
      homestead_rate_stated: 1.67
      cla: .8388
    - town: town/ripton
      homestead_rate_stated: 1.76
      cla: .7945
    - town: town/salisbury
      homestead_rate_stated: 1.84
      cla: .7597
    - town: town/shoreham
      homestead_rate_stated: 1.69
      cla: .8290
    - town: town/weybridge
      homestead_rate_stated: 1.65
      cla: .8475
notes: null
lines_flagged:
  - path: education_spending
    issue: education spending not yet transcribed from the source; backfill from the FY23 budget book
    resolution: pending
  - path: adm.prekindergarten
    issue: district-stated ADM by band not yet transcribed from the source; backfill from the FY23 budget book
    resolution: pending
  - path: adm.kindergarten_through_5
    issue: district-stated ADM by band not yet transcribed from the source; backfill from the FY23 budget book
    resolution: pending
  - path: adm.grades_6_through_8
    issue: district-stated ADM by band not yet transcribed from the source; backfill from the FY23 budget book
    resolution: pending
  - path: adm.grades_9_through_12
    issue: district-stated ADM by band not yet transcribed from the source; backfill from the FY23 budget book
    resolution: pending
not_published: []
```

> Note: the two prior `bridport`/`cornwall` CLAs were stored as percentages (`79.29`) in the old file; the schema calls for a ratio and `exclusiveMinimum: 0` accepts either, but for consistency with the other five towns (already ratios) they are written as ratios here. If you prefer to preserve the file's exact prior values, keep `79.29`/`85.67` — validation passes either way. This plan normalizes them.

- [ ] **Step 2: Rewrite `fy2023-proposed.yaml`**

Overwrite with the same structure, keeping that file's own identity and its existing tax rows. Read the current `warehouse/su-addison-central/fy2023-proposed.yaml` first to preserve its `extracted_date`, `adopted_date`, and the exact `tax.towns` rows; then replace its `revenues:`/`expenditures:` blocks with:

```yaml
education_spending: null
adm:
  prekindergarten: null
  kindergarten_through_5: null
  grades_6_through_8: null
  grades_9_through_12: null
```

insert `notes: null` before `lines_flagged:`, and replace the two old `lines_flagged` entries (the `revenues.*`/`expenditures.*` pending entries) with the same five `education_spending` + `adm.*` pending entries shown in Step 1.

- [ ] **Step 3: Validate the warehouse**

Run: `npm run validate`
Expected: exit 0. If the intake PDF is an unfetched Git LFS pointer you may see a `hash-verification` **warning** (not an error); those do not fail the run. If it errors on missing LFS bytes, run `git lfs pull` first.

- [ ] **Step 4: Smoke-check the data build**

Run: `npm run build:data`
Expected: completes without error.

- [ ] **Step 5: Commit**

```bash
git add warehouse/su-addison-central/fy2023-proposed.yaml warehouse/su-addison-central/fy2024-proposed.yaml
git commit -m "data(addison-central): migrate the two records to the education-spending shape"
```

---

### Task 3: Rename `total_stated` → `education_spending` in the merger engine and grouping resolver

`DistrictBudget` carries the single figure the merger math runs on. Rename it and update the labels/prose from "total expenditure" to "education spending"; `grouping-budgets.ts` `adapt()` reads `record.education_spending`.

**Files:** Modify `model/src/scenario.ts`, `model/src/engine.test.ts`, `tools/src/grouping-budgets.ts`, `tools/src/grouping-budgets.test.ts`

**Interfaces:**
- Produces: `DistrictBudget = { entity: string; fiscal_year: number; education_spending: number | null; source: string }`. `runScenario`/`defaultAssumptions` keep their names and signatures. `BudgetInput.education_spending?: number | null` replaces `BudgetInput.expenditures`.

- [ ] **Step 1: Update the scenario test fixtures first (they fail until `scenario.ts` changes)**

In `model/src/engine.test.ts`, in the scenario block: change `total_stated: 1_700_000,` (line ~524) to `education_spending: 1_700_000,` and `{ ...base, entity: 'ud/c', total_stated: null }` (line ~553) to `{ ...base, entity: 'ud/c', education_spending: null }`.

- [ ] **Step 2: Run the scenario tests to watch them fail**

Run: `npx vitest run model/src/engine.test.ts -t "movement in both directions"`
Expected: FAIL — `DistrictBudget` still requires `total_stated`.

- [ ] **Step 3: Rename the field and relabel in `scenario.ts`**

In `model/src/scenario.ts`:
- In `interface DistrictBudget`, replace the `total_stated` member and its comment with:

```ts
  /** Education spending as published. The figure the merger math runs on. */
  readonly education_spending: number | null;
```

- In `runScenario`, change `totalOf(spec.districts, (d) => d.total_stated)` to `totalOf(spec.districts, (d) => d.education_spending)`.
- Change the three headline labels/notes from expenditure wording to spending wording: `'Total expenditure, current structure'` → `'Combined education spending, current structure'`; the `notes` string `'The sum of each district’s published total expenditure. …'` → `'The sum of each district’s published education spending. Districts do not slice their budgets the same way, so only the published spending totals are summed.'`; `'Total expenditure, scenario'` → `'Combined education spending, scenario'`; `'Change in total expenditure'` → `'Change in combined education spending'`.
- In `defaultAssumptions()` and `buildCaveats()`, change the phrase "combined total expenditure"/"combined published total expenditure" to "combined published education spending" (three occurrences across the `label`, the `rationale`, and the second caveat), and the file header comment's "combined published total expenditure" likewise.

- [ ] **Step 4: Update `grouping-budgets.ts`**

- In `interface BudgetInput`, replace `readonly expenditures?: { readonly total_stated?: number | null } | null;` with `readonly education_spending?: number | null;`
- In `adapt()`, replace `total_stated: record.expenditures?.total_stated ?? null,` with `education_spending: record.education_spending ?? null,`

- [ ] **Step 5: Update `grouping-budgets.test.ts`**

- The `budget()` fixture builder uses `expenditures: { total_stated: 1_000_000 }` (line ~29) — change it to `education_spending: 1_000_000`.
- The assertion `member.budget?.total_stated` (line ~55) → `member.budget?.education_spending`.
- The test titled "adapts total_stated from expenditures…" (lines ~151–160): rename to "adapts education_spending and keeps an unpublished figure null", change the fixture `expenditures: { total_stated: null }` to `education_spending: null`, and the assertion `member.budget?.total_stated` → `member.budget?.education_spending`.

- [ ] **Step 6: Typecheck + full suite**

Run: `npm run typecheck && npm test`
Expected: PASS. `grep -rn "total_stated" model/src tools/src` returns nothing.

- [ ] **Step 7: Commit**

```bash
git add model/src/scenario.ts model/src/engine.test.ts tools/src/grouping-budgets.ts tools/src/grouping-budgets.test.ts
git commit -m "refactor(model): the merger figure is education spending, not total expenditure"
```

---

### Task 4: AOE ADM by statutory band in the publication

`buildAdmPublication` emits each district's rollup `values` in published-band order. Add a `statutory_bands` map per year so a consumer can read AOE ADM by statutory band. Derive it from `bands_as_published[].statutory_band`: sum the published columns that share a statutory band; drop columns that map to `null`. A year that does not map to statutory bands (`maps_to_statutory_bands: false`) emits an **empty** `statutory_bands` (no district gets a value), so the fallback is simply unavailable there.

**Files:** Modify `tools/src/aoe/adm/publish.ts`, `tools/src/aoe/adm/publish.test.ts`

**Interfaces:**
- Produces: each entry of `AdmPublication.years` gains `statutory_bands: Record<string /*district slug*/, { prekindergarten: number|null; kindergarten_through_5: number|null; grades_6_through_8: number|null; grades_9_through_12: number|null }>`. Empty object when the year does not map. Only bands present in the source are numbers; a statutory band with no contributing column is `null`.

- [ ] **Step 1: Add a failing publish test**

In `tools/src/aoe/adm/publish.test.ts`, add:

```ts
describe('statutory-band rollup', () => {
  it('is empty for a year whose bands do not map to the statutory bands', () => {
    // adm24 publishes K-6 / 7-12, which have no statutory-band counterpart.
    const pub = buildAdmPublication([nonMappingRecord()], registry, '2026-08-04T00:00:00Z');
    expect(pub.years[0]?.statutory_bands).toEqual({});
  });

  it('keys each district by statutory band for a mapping year', () => {
    const pub = buildAdmPublication([mappingRecord()], registry, '2026-08-04T00:00:00Z');
    const bands = pub.years[0]?.statutory_bands['ud/example'];
    expect(bands).toEqual({
      prekindergarten: 5,
      kindergarten_through_5: 100,
      grades_6_through_8: 50,
      grades_9_through_12: 60,
    });
  });
});
```

Add `nonMappingRecord()` and `mappingRecord()` fixture helpers alongside the existing fixtures in this test file: `nonMappingRecord()` mirrors the existing `adm24`-style fixture (bands `Elem (K-6)`/`SEC (7-12)`, `statutory_band: null`, `maps_to_statutory_bands: false`). `mappingRecord()` has four columns whose `statutory_band` values are the four statutory bands in order, `maps_to_statutory_bands: true`, and a single member town resolving into `ud/example` (reuse whatever registry-backed slug the existing publish tests already use for a one-district rollup; if none exists, add a town→district fixture the same way the existing tests build `registry`).

- [ ] **Step 2: Run it to watch it fail**

Run: `npx vitest run tools/src/aoe/adm/publish.test.ts -t "statutory-band rollup"`
Expected: FAIL — `statutory_bands` is undefined.

- [ ] **Step 3: Emit `statutory_bands` in `publish.ts`**

Add the type to `AdmPublication.years[]` (after `grand_total`):

```ts
    readonly statutory_bands: Record<
      string,
      {
        readonly prekindergarten: number | null;
        readonly kindergarten_through_5: number | null;
        readonly grades_6_through_8: number | null;
        readonly grades_9_through_12: number | null;
      }
    >;
```

Add this helper above `buildAdmPublication`:

```ts
const STATUTORY_BANDS = [
  'prekindergarten',
  'kindergarten_through_5',
  'grades_6_through_8',
  'grades_9_through_12',
] as const;

/**
 * Map a district's published-band values onto the four statutory bands, summing
 * any published columns that share a statutory band and dropping columns that
 * map to null. Returns null for a band with no contributing column. Every value
 * is null when the year does not map, and the caller emits {} in that case.
 */
function toStatutoryBands(
  bands: Array<{ header: string; statutory_band: string | null }>,
  values: ReadonlyArray<number | null>,
): Record<(typeof STATUTORY_BANDS)[number], number | null> {
  const out = Object.fromEntries(STATUTORY_BANDS.map((b) => [b, null])) as Record<
    (typeof STATUTORY_BANDS)[number],
    number | null
  >;
  bands.forEach((band, col) => {
    const key = band.statutory_band as (typeof STATUTORY_BANDS)[number] | null;
    if (!key || !STATUTORY_BANDS.includes(key)) return;
    const v = values[col];
    if (v === null || v === undefined) return;
    out[key] = Number(((out[key] ?? 0) + v).toFixed(2));
  });
  return out;
}
```

In the `.map((record) => { … })` that builds each year, after `const rollup = aggregate(...)`, compute:

```ts
      const statutory_bands: Record<string, ReturnType<typeof toStatutoryBands>> = {};
      if (record.maps_to_statutory_bands) {
        for (const d of rollup.districts) {
          statutory_bands[d.district] = toStatutoryBands(record.bands_as_published, d.values);
        }
      }
```

and add `statutory_bands,` to the returned year object.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tools/src/aoe/adm/publish.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck, full suite, rebuild data**

Run: `npm run typecheck && npm test && npm run build:data`
Expected: PASS; `site/src/generated/adm.json` now carries a `statutory_bands` key per year (empty for FY2024, the only current record).

- [ ] **Step 6: Commit**

```bash
git add tools/src/aoe/adm/publish.ts tools/src/aoe/adm/publish.test.ts
git commit -m "feat(adm): publish AOE membership keyed by statutory band"
```

---

### Task 5: The ADM resolver, the AOE entity lookup, the cross-check, and the published dataset

Three small units and a build step: a pure per-band resolver (`model`), a registry-aware AOE lookup that rolls up to an entity (`tools`), a validator warning, and `resolved-adm.json`.

**Files:**
- Create: `model/src/adm-resolution.ts`, `model/src/adm-resolution.test.ts`
- Create: `tools/src/adm-lookup.ts`, `tools/src/adm-lookup.test.ts`
- Modify: `model/src/index.ts` (export the resolver), `tools/src/validate/rules.ts` (+ `checkAdmCrossCheck`), `tools/src/validate/rules.test.ts`, `tools/src/cli/validate.ts`, `tools/src/cli/build-data.ts`

**Interfaces:**
- Produces: `resolveAdm(district, aoe): ResolvedAdm` (pure, per-band, district→aoe→unknown). `aoeBandsFor(entity, fiscalYear, publication, registry): BandValues | null` (sums member district-like entities for an SU; direct row for a district-like entity; `null` when the year does not map or no row exists). `checkAdmCrossCheck(record, aoeBands, file): Finding[]` (warning on per-band disagreement beyond tolerance). `resolved-adm.json` per the Global Constraints shape.

- [ ] **Step 1: Write the resolver test (`model/src/adm-resolution.test.ts`)**

```ts
import { describe, expect, it } from 'vitest';
import { resolveAdm, STATUTORY_BANDS } from './adm-resolution.ts';

const full = { prekindergarten: 5, kindergarten_through_5: 100, grades_6_through_8: 50, grades_9_through_12: 60 };

describe('resolveAdm', () => {
  it('prefers the district figure for every band it published', () => {
    const r = resolveAdm(full, { prekindergarten: 4, kindergarten_through_5: 99, grades_6_through_8: 51, grades_9_through_12: 61 });
    for (const b of STATUTORY_BANDS) expect(r[b]).toEqual({ value: full[b], source: 'district' });
  });

  it('falls back to the state figure per band, only where the district left a gap', () => {
    const district = { ...full, prekindergarten: null };
    const r = resolveAdm(district, { prekindergarten: 7, kindergarten_through_5: 99, grades_6_through_8: 51, grades_9_through_12: 61 });
    expect(r.prekindergarten).toEqual({ value: 7, source: 'aoe' });
    expect(r.kindergarten_through_5).toEqual({ value: 100, source: 'district' });
  });

  it('reports unknown when neither source has the band', () => {
    const r = resolveAdm({ ...full, prekindergarten: null }, null);
    expect(r.prekindergarten).toEqual({ value: null, source: 'unknown' });
    expect(r.grades_9_through_12).toEqual({ value: 60, source: 'district' });
  });

  it('reports unknown for a band the AOE row is missing', () => {
    const r = resolveAdm({ ...full, prekindergarten: null }, { prekindergarten: null, kindergarten_through_5: 99, grades_6_through_8: 51, grades_9_through_12: 61 });
    expect(r.prekindergarten).toEqual({ value: null, source: 'unknown' });
  });
});
```

- [ ] **Step 2: Write `model/src/adm-resolution.ts`**

```ts
/**
 * District-first ADM resolution.
 *
 * The record now carries the district's own stated ADM by statutory band, and
 * the AOE dataset carries the state's count rolled up to the same entity. This
 * chooses between them PER BAND -- the district's figure wherever it published
 * one, the state's only to fill a gap -- and tags each band with its source so
 * a total that blends the two is never presented as if it came from one place.
 * It never reconciles a disagreement; that is the cross-check's job, and it
 * only warns.
 */

export const STATUTORY_BANDS = [
  'prekindergarten',
  'kindergarten_through_5',
  'grades_6_through_8',
  'grades_9_through_12',
] as const;

export type StatutoryBand = (typeof STATUTORY_BANDS)[number];
export type BandValues = Record<StatutoryBand, number | null>;
export type AdmSource = 'district' | 'aoe' | 'unknown';
export interface ResolvedBand {
  readonly value: number | null;
  readonly source: AdmSource;
}
export type ResolvedAdm = Record<StatutoryBand, ResolvedBand>;

export function resolveAdm(
  district: BandValues | null | undefined,
  aoe: BandValues | null | undefined,
): ResolvedAdm {
  const out = {} as Record<StatutoryBand, ResolvedBand>;
  for (const band of STATUTORY_BANDS) {
    const d = district?.[band];
    if (d !== null && d !== undefined) {
      out[band] = { value: d, source: 'district' };
      continue;
    }
    const a = aoe?.[band];
    if (a !== null && a !== undefined) {
      out[band] = { value: a, source: 'aoe' };
      continue;
    }
    out[band] = { value: null, source: 'unknown' };
  }
  return out;
}
```

- [ ] **Step 3: Export the resolver and run its test**

Add to `model/src/index.ts`, after the `scenario.ts` export line:

```ts
export * from './adm-resolution.ts';
```

Run: `npx vitest run model/src/adm-resolution.test.ts`
Expected: PASS.

- [ ] **Step 4: Write the AOE lookup test (`tools/src/adm-lookup.test.ts`)**

```ts
import { describe, expect, it } from 'vitest';
import { aoeBandsFor } from './adm-lookup.ts';
import type { RegistryEntity } from './registry/types.ts';

function reg(entries: Array<Partial<RegistryEntity> & { slug: string; type: string }>): Map<string, RegistryEntity> {
  return new Map(entries.map((e) => [e.slug, e as RegistryEntity]));
}

const BANDS = { prekindergarten: 5, kindergarten_through_5: 100, grades_6_through_8: 50, grades_9_through_12: 60 };

const publication = {
  generated: 'x',
  years: [
    {
      fiscal_year: 2027,
      maps_to_statutory_bands: true,
      statutory_bands: { 'ud/one': BANDS, 'ud/two': { prekindergarten: 1, kindergarten_through_5: 2, grades_6_through_8: 3, grades_9_through_12: 4 } },
    },
  ],
} as any;

describe('aoeBandsFor', () => {
  it('returns a district-like entity’s own row directly', () => {
    const registry = reg([{ slug: 'ud/one', type: 'ud', supervisory_union: 'su/x' } as any]);
    expect(aoeBandsFor('ud/one', 2027, publication, registry)).toEqual(BANDS);
  });

  it('sums an SU’s member district-like entities', () => {
    const registry = reg([
      { slug: 'su/x', type: 'su' } as any,
      { slug: 'ud/one', type: 'ud', supervisory_union: 'su/x' } as any,
      { slug: 'ud/two', type: 'ud', supervisory_union: 'su/x' } as any,
    ]);
    expect(aoeBandsFor('su/x', 2027, publication, registry)).toEqual({
      prekindergarten: 6, kindergarten_through_5: 102, grades_6_through_8: 53, grades_9_through_12: 64,
    });
  });

  it('returns null when the year does not map / has no data', () => {
    const registry = reg([{ slug: 'ud/one', type: 'ud' } as any]);
    expect(aoeBandsFor('ud/one', 2099, publication, registry)).toBeNull();
  });
});
```

- [ ] **Step 5: Write `tools/src/adm-lookup.ts`**

```ts
/**
 * Resolve the AOE statutory-band ADM for a budget entity and fiscal year.
 *
 * The publication is keyed by operating district (a UD, or a town that runs its
 * own school). A budget record's entity is often the supervisory union, so an
 * SU is resolved by summing the statutory-band rollups of its member
 * district-like entities. Returns null when the year does not map to the
 * statutory bands or when the entity has no contributing AOE row -- the same
 * "unavailable, not zero" posture the rest of the ADM layer takes.
 */

import type { BandValues, StatutoryBand } from '@vt-budget/model';
import { STATUTORY_BANDS } from '@vt-budget/model';
import type { RegistryEntity } from './registry/types.ts';

interface AdmPublicationLike {
  readonly years: ReadonlyArray<{
    readonly fiscal_year: number;
    readonly maps_to_statutory_bands: boolean;
    readonly statutory_bands: Record<string, BandValues>;
  }>;
}

/** A UD, or a town that runs its own school. Mirrors grouping-budgets.isDistrictLike. */
function isDistrictLike(e: RegistryEntity): boolean {
  return e.type === 'ud' || (e.type === 'town' && !e.operated_by && !e.reporting_only);
}

function sumBands(rows: BandValues[]): BandValues {
  const out = Object.fromEntries(STATUTORY_BANDS.map((b) => [b, null])) as BandValues;
  for (const row of rows) {
    for (const band of STATUTORY_BANDS) {
      const v = row[band];
      if (v === null || v === undefined) continue;
      out[band] = Number(((out[band] ?? 0) + v).toFixed(2));
    }
  }
  return out;
}

export function aoeBandsFor(
  entity: string,
  fiscalYear: number,
  publication: AdmPublicationLike,
  registry: ReadonlyMap<string, RegistryEntity>,
): BandValues | null {
  const year = publication.years.find((y) => y.fiscal_year === fiscalYear);
  if (!year || !year.maps_to_statutory_bands) return null;

  const self = registry.get(entity);
  if (self && isDistrictLike(self)) {
    return year.statutory_bands[entity] ?? null;
  }

  // An SU (or any non-district-like entity): sum its district-like members.
  const rows: BandValues[] = [];
  for (const e of registry.values()) {
    if (e.supervisory_union === entity && isDistrictLike(e)) {
      const row = year.statutory_bands[e.slug];
      if (row) rows.push(row);
    }
  }
  return rows.length > 0 ? sumBands(rows) : null;
}
```

Run: `npx vitest run tools/src/adm-lookup.test.ts`
Expected: PASS.

- [ ] **Step 6: Add the cross-check warning to `rules.ts`**

Add, after the null-accounting section:

```ts
// --------------------------------------------------------------------------
// District-stated vs AOE ADM cross-check
// --------------------------------------------------------------------------

const ADM_BANDS = [
  'prekindergarten',
  'kindergarten_through_5',
  'grades_6_through_8',
  'grades_9_through_12',
] as const;

/** Pupils. Two ADM counts within this of each other are not a discrepancy. */
const ADM_TOLERANCE = 0.5;

/**
 * Warns where the district's stated ADM and the state's AOE count disagree for
 * the same band. A warning, never an error, and never reconciled: a district
 * disagreeing with the state about its own pupils is a finding to publish, not
 * a bug to fix. `aoeBands` is null when no comparable AOE figure exists (a
 * non-mapping year), in which case this is silent.
 */
export function checkAdmCrossCheck(
  record: BudgetRecord,
  aoeBands: Record<string, number | null> | null,
  file: string,
): Finding[] {
  if (!aoeBands) return [];
  const adm = (record as { adm?: Record<string, number | null> }).adm;
  if (!adm) return [];

  const findings: Finding[] = [];
  for (const band of ADM_BANDS) {
    const d = adm[band];
    const a = aoeBands[band];
    if (typeof d !== 'number' || typeof a !== 'number') continue;
    if (Math.abs(d - a) > ADM_TOLERANCE) {
      findings.push({
        severity: 'warning',
        file,
        rule: 'adm-cross-check',
        message:
          `adm.${band}: this record states ${d}, the AOE count for the same year is ${a}. ` +
          `Recorded, not reconciled -- a district's stated membership and the state's count ` +
          `are different voices, and the disagreement is itself the finding.`,
      });
    }
  }
  return findings;
}
```

- [ ] **Step 7: Test the cross-check in `rules.test.ts`**

```ts
import { checkAdmCrossCheck } from './rules.ts';

describe('adm cross-check', () => {
  const rec = () => ({
    adm: { prekindergarten: 10, kindergarten_through_5: 100, grades_6_through_8: 50, grades_9_through_12: 50 },
  }) as any;

  it('is silent when no AOE figure is available', () => {
    expect(checkAdmCrossCheck(rec(), null, 'f.yaml')).toHaveLength(0);
  });

  it('is silent when the figures agree within tolerance', () => {
    const aoe = { prekindergarten: 10.2, kindergarten_through_5: 100, grades_6_through_8: 50, grades_9_through_12: 50 };
    expect(checkAdmCrossCheck(rec(), aoe, 'f.yaml')).toHaveLength(0);
  });

  it('warns (never errors) on a band that disagrees beyond tolerance', () => {
    const aoe = { prekindergarten: 10, kindergarten_through_5: 130, grades_6_through_8: 50, grades_9_through_12: 50 };
    const findings = checkAdmCrossCheck(rec(), aoe, 'f.yaml');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('warning');
    expect(findings[0]?.message).toMatch(/kindergarten_through_5/);
  });
});
```

- [ ] **Step 8: Wire the cross-check into the validate CLI**

In `tools/src/cli/validate.ts`: where budget records are validated (the warehouse loop that calls `checkNullAccounting`/`checkProvenance`), build the AOE publication once before the loop and call the cross-check per record. Add imports:

```ts
import { buildAdmPublication } from '../aoe/adm/publish.ts';
import { aoeBandsFor } from '../adm-lookup.ts';
import { checkAdmCrossCheck } from '../validate/rules.ts';
```

Before the warehouse/budget loop, build the publication from the AOE warehouse (guard for none):

```ts
  const admDir = join(PATHS.warehouse, 'aoe-adm');
  const admRecords = walkFiles(admDir, (n) => /^adm\d{2}\.yaml$/.test(n)).map(
    (file) => readData(file),
  );
  const admPublication = admRecords.length > 0
    ? buildAdmPublication(admRecords, registry, new Date(0).toISOString())
    : { generated: '', years: [], gaps: [] as unknown };
```

Inside the loop, for each budget `record` and its `file`:

```ts
    findings.push(
      ...checkAdmCrossCheck(
        record,
        aoeBandsFor(record.entity, record.fiscal_year, admPublication as any, registry),
        file,
      ),
    );
```

(Match the loop's existing `readData`/`walkFiles`/`join`/`PATHS` usage — these are already imported in `validate.ts`; add only what is missing.)

- [ ] **Step 9: Emit `resolved-adm.json` in `build-data.ts`**

In `tools/src/cli/build-data.ts`, after the AOE `adm.json` block (which already builds `admRecords` and writes `adm.json`), compute and write the resolved dataset. Add imports at the top:

```ts
import { resolveAdm } from '@vt-budget/model';
import { aoeBandsFor } from '../adm-lookup.ts';
```

After `adm.json` is written, add:

```ts
  // --- resolved ADM (district-first, AOE fallback), per entity+year --------
  if (admRecords.length > 0) {
    const publication = buildAdmPublication(admRecords, registry, today.toISOString());
    const entities: Record<string, Record<string, unknown>> = {};
    for (const budget of budgets) {
      const adm = (budget as { adm?: Record<string, number | null> }).adm ?? null;
      const aoe = aoeBandsFor(budget.entity, budget.fiscal_year, publication, registry);
      if (!adm && !aoe) continue;
      (entities[budget.entity] ??= {})[String(budget.fiscal_year)] = resolveAdm(adm, aoe);
    }
    writeJson(join(PATHS.siteGenerated, 'resolved-adm.json'), {
      generated: today.toISOString(),
      entities,
    });
  }
```

(Only budgets carry district-stated ADM, so keying on `budgets` is correct; a future non-budget entity that wants AOE-only resolution is out of scope.)

- [ ] **Step 10: Typecheck, test, validate, build**

Run: `npm run typecheck && npm test && npm run validate && npm run build:data`
Expected: PASS. `site/src/generated/resolved-adm.json` exists; for the two migrated records every band resolves `unknown` (district nulls, AOE FY2024 non-mapping), which is correct today.

- [ ] **Step 11: Commit**

```bash
git add model/src/adm-resolution.ts model/src/adm-resolution.test.ts model/src/index.ts tools/src/adm-lookup.ts tools/src/adm-lookup.test.ts tools/src/validate/rules.ts tools/src/validate/rules.test.ts tools/src/cli/validate.ts tools/src/cli/build-data.ts
git commit -m "feat(adm): district-first resolver, AOE entity lookup, cross-check warning, resolved-adm.json"
```

---

### Task 6: Prefill the `/model` tool from resolved ADM (entity + year picker)

Add an optional "load a district" control to the anonymous `/model` tool. On selection, prefill the eight ADM band inputs (two years) from `resolved-adm.json`, labelling each field's source, without overwriting a value the user typed. Every field stays editable.

**Files:** Modify `site/src/pages/model/index.astro`, `site/src/scripts/model-tool.ts`

**Interfaces:** Consumes `resolved-adm.json` (Task 5). No engine change — the tool still reads the eight `numberField` inputs; this only fills them.

- [ ] **Step 1: Add the picker markup and a source-label slot to `model/index.astro`**

Immediately before the first grade fieldset (`<h2>How many students</h2>`), add:

```astro
    <fieldset class="field-group" id="load-district-group">
      <legend>Load a district (optional)</legend>
      <p class="field-note">
        Prefills the grade counts below from a district's stated budget, filling any gap with the
        state's AOE count. Each field is labelled with its source, and you can edit any of them.
      </p>
      <div class="field">
        <label for="load-entity">District or supervisory union</label>
        <select id="load-entity"><option value="">— none —</option></select>
      </div>
      <div class="field">
        <label for="load-year">Budget year</label>
        <select id="load-year"><option value="">— none —</option></select>
      </div>
    </fieldset>
```

Add an empty source-note span after each of the eight grade inputs, e.g. after `<input id="prek-1" ... />` add `<small class="adm-source" data-adm-source="prek-1"></small>`, and likewise for `k5-1`, `g68-1`, `g912-1`, `prek-2`, `k5-2`, `g68-2`, `g912-2`.

- [ ] **Step 2: Load the dataset and wire the picker in `model-tool.ts`**

Near the other generated-data imports at the top of `model-tool.ts`, import the dataset (Astro/Vite resolves JSON imports):

```ts
import resolvedAdm from '../generated/resolved-adm.json';
```

Add, inside the island's setup (near where `statewideField`/`applyStatewidePrefill` are defined), a prefill routine:

```ts
  // Load-a-district ADM prefill. Mirrors the statewide-average prefill: it fills
  // a field only when the user has not already typed one, and it records what it
  // autofilled so a later prefill can replace its own value but never the user's.
  const entities = (resolvedAdm as { entities: Record<string, Record<string, any>> }).entities ?? {};
  const loadEntity = document.getElementById('load-entity') as HTMLSelectElement | null;
  const loadYear = document.getElementById('load-year') as HTMLSelectElement | null;
  const SOURCE_TEXT: Record<string, string> = {
    district: 'from the district’s budget',
    aoe: 'from the state AOE count',
    unknown: 'not available',
  };
  const BAND_FIELD: Record<string, string> = {
    prekindergarten: 'prek', kindergarten_through_5: 'k5', grades_6_through_8: 'g68', grades_9_through_12: 'g912',
  };
  const autofilledAdm = new Set<string>();

  const fillBandRow = (band: any, slot: '1' | '2'): void => {
    for (const [key, prefix] of Object.entries(BAND_FIELD)) {
      const id = `${prefix}-${slot}`;
      const field = document.getElementById(id) as HTMLInputElement | null;
      const note = document.querySelector<HTMLElement>(`[data-adm-source="${id}"]`);
      if (!field) continue;
      const resolved = band?.[key] as { value: number | null; source: string } | undefined;
      // Never overwrite a value the user typed (one we did not autofill).
      const userTyped = field.value !== '' && !autofilledAdm.has(id);
      if (!userTyped && resolved && resolved.value !== null) {
        field.value = String(resolved.value);
        autofilledAdm.add(id);
      } else if (!userTyped) {
        field.value = '';
        autofilledAdm.delete(id);
      }
      if (note) note.textContent = resolved ? SOURCE_TEXT[resolved.source] ?? '' : '';
    }
  };

  const applyAdmPrefill = (): void => {
    const entity = loadEntity?.value ?? '';
    const year = loadYear?.value ?? '';
    if (!entity || !year || !entities[entity]?.[year]) return;
    fillBandRow(entities[entity]?.[String(Number(year) - 1)], '1');
    fillBandRow(entities[entity]?.[year], '2');
    recompute();
  };

  // Populate the entity options (sorted), and the year options for the chosen entity.
  for (const slug of Object.keys(entities).sort()) {
    const opt = document.createElement('option');
    opt.value = slug; opt.textContent = slug;
    loadEntity?.append(opt);
  }
  loadEntity?.addEventListener('change', () => {
    if (!loadYear) return;
    loadYear.replaceChildren(new Option('— none —', ''));
    for (const y of Object.keys(entities[loadEntity.value] ?? {}).sort()) loadYear.append(new Option(`FY${y}`, y));
    applyAdmPrefill();
  });
  loadYear?.addEventListener('change', applyAdmPrefill);
```

- [ ] **Step 3: Verify in the browser**

Start the dev server (preview_start with the site's launch config) and open `/model/`. With `resolved-adm.json` currently resolving every band to `unknown`, confirm: the "Load a district" control renders, choosing `su/addison-central` populates the year dropdown (FY2023, FY2024), and selecting a year sets each grade field's source note to "not available" and leaves the fields blank (nothing to prefill yet). Confirm no console errors (read_console_messages) and that typing a grade value still recomputes.

- [ ] **Step 4: Typecheck + build the site**

Run: `npm run typecheck && npm run build` (or the repo's site build script)
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add site/src/pages/model/index.astro site/src/scripts/model-tool.ts
git commit -m "feat(model): load-a-district ADM prefill from resolved-adm.json"
```

---

### Task 7: The homestead calculated-vs-published table on the SU page

A build-time per-entity engine run compares each member town's published stated homestead rate against the engine's billed rate. With statutory parameters unverified, every calculated cell is a blocker today; the published column is populated now.

**Files:**
- Create: `tools/src/homestead-comparison.ts`, `tools/src/homestead-comparison.test.ts`
- Modify: `tools/src/cli/build-data.ts` (emit the dataset), `site/src/pages/su/[slug].astro` (render it)

**Interfaces:**
- Produces: `buildHomesteadComparison(sus, budgets, resolvedAdm, parameterSets, registry): HomesteadComparison` where the output matches the `homestead-comparison.json` shape in the Global Constraints. `calculated` is the billed rate node's value (a number) or `null`; `blocker` is `null` when `calculated` is a number, else `"<ref>: <detail>"` from the node's first blocker.

- [ ] **Step 1: Write `tools/src/homestead-comparison.ts`**

```ts
/**
 * Build-time comparison of each member town's published homestead rate against
 * the engine's billed rate, run from the district's education spending, the
 * resolved ADM, the town's CLA, and the live fiscal-year parameter set.
 *
 * The engine refuses to compute from an unverified parameter, so today the
 * calculated side is a blocker for every real year rather than a number. That
 * is the point: the published side is shown now, the calculated side declares
 * exactly what it is waiting on, and the column lights up when parameters are
 * verified.
 */

import {
  createContext,
  computeWeightedMembership,
  input,
  parseParameterSet,
  perWeightedPupil,
  townRate,
  type ResolvedAdm,
} from '@vt-budget/model';
import type { RegistryEntity } from './registry/types.ts';

export interface HomesteadCell {
  readonly town: string;
  readonly published: number | null;
  readonly calculated: number | null;
  readonly blocker: string | null;
  readonly difference: number | null;
}
export interface HomesteadComparison {
  readonly generated: string;
  readonly sus: Record<string, Record<string, HomesteadCell[]>>;
}

interface BudgetLike {
  readonly entity: string;
  readonly fiscal_year: number;
  readonly education_spending?: number | null;
  readonly tax?: { readonly towns?: Array<{ town: string; homestead_rate_stated?: number | null; cla?: number | null }> };
}

function admYear(resolved: ResolvedAdm | undefined, fiscal_year: number) {
  const band = (k: keyof ResolvedAdm) => resolved?.[k]?.value ?? null;
  return {
    fiscal_year,
    prekindergarten: band('prekindergarten'),
    kindergarten_through_5: band('kindergarten_through_5'),
    grades_6_through_8: band('grades_6_through_8'),
    grades_9_through_12: band('grades_9_through_12'),
  };
}

export function buildHomesteadComparison(
  sus: readonly RegistryEntity[],
  budgets: readonly BudgetLike[],
  resolvedAdm: Record<string, Record<string, ResolvedAdm>>,
  parameterSets: ReadonlyArray<ReturnType<typeof parseParameterSet>>,
  generated: string,
): HomesteadComparison {
  const paramByYear = new Map(parameterSets.map((p) => [p.fiscal_year, p]));
  const out: Record<string, Record<string, HomesteadCell[]>> = {};

  for (const su of sus) {
    const suBudgets = budgets.filter((b) => b.entity === su.slug && b.tax?.towns?.length);
    if (suBudgets.length === 0) continue;
    const years: Record<string, HomesteadCell[]> = {};

    for (const budget of suBudgets) {
      const fy = budget.fiscal_year;
      const params = paramByYear.get(fy);
      // No parameter file for the year: every town is blocked identically.
      const ctx = params ? createContext(params) : null;

      const resolved = resolvedAdm[su.slug];
      const membership = ctx
        ? computeWeightedMembership(ctx, {
            entity: su.slug,
            adm_years: [admYear(resolved?.[String(fy - 1)], fy - 1), admYear(resolved?.[String(fy)], fy)],
            state_placed_fte: null,
            poverty_185_fpl: null,
            english_learners: null,
            persons_per_square_mile: null,
            prior_year_weighted_membership: null,
            small_schools: [],
            source: 'resolved ADM (district-first, AOE fallback)',
          })
        : null;

      const spendingNode = ctx
        ? input(ctx, 'Education spending', budget.education_spending ?? null, 'usd', { source: 'district budget record' })
        : null;
      const perPupil = ctx && membership && spendingNode ? perWeightedPupil(ctx, spendingNode, membership.total) : null;

      years[String(fy)] = (budget.tax?.towns ?? []).map((t): HomesteadCell => {
        const published = t.homestead_rate_stated ?? null;
        if (!ctx || !perPupil) {
          return { town: t.town, published, calculated: null, blocker: 'no parameter file for this year', difference: null };
        }
        const rate = townRate(
          ctx,
          perPupil,
          { town: t.town, cla: t.cla ?? null, cla_source: 'district budget record' },
          null, // statewide average determination — not supplied here
          { capitalReserveFivePlusYears: null, bondExclusionPreJuly2024: null, weightedMembership: membership!.total },
        );
        const node = rate.billedRate;
        const calculated = node.value;
        const blocker = calculated === null && node.blockers[0] ? `${node.blockers[0].ref}: ${node.blockers[0].detail}` : null;
        const difference = calculated !== null && published !== null ? Number((published - calculated).toFixed(4)) : null;
        return { town: t.town, published, calculated, blocker, difference };
      });
    }
    out[su.slug] = years;
  }

  return { generated, sus: out };
}
```

> The `townRate` call must match its current signature in `model/src/tax.ts` (see `site/src/scripts/model-tool.ts` lines ~701–722 for the live call shape). If the excess-spending adjustments object requires other keys, pass `null` for each — an unsupplied statutory input surfaces as a `missing_input` blocker, which is the correct behavior here. Confirm the exact keys against `TownRateInput`/`townRate` before finalizing and adjust the object literal to match.

- [ ] **Step 2: Write `tools/src/homestead-comparison.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { buildHomesteadComparison } from './homestead-comparison.ts';
import { parseParameterSet } from '@vt-budget/model';
import type { RegistryEntity } from './registry/types.ts';

const su = { slug: 'su/x', type: 'su', name: 'X SU' } as RegistryEntity;
const budget = {
  entity: 'su/x', fiscal_year: 2027, education_spending: 3_370_000,
  tax: { towns: [{ town: 'town/a', homestead_rate_stated: 1.7, cla: 0.85 }] },
};

// A parameter set whose values are all null/unverified — the real-world case today.
const unverified = parseParameterSet({
  fiscal_year: 2027, status: 'draft', note: null, parameters: [], inputs: [],
});

describe('buildHomesteadComparison', () => {
  it('reports the published rate and a blocker for the calculated rate when parameters are unverified', () => {
    const out = buildHomesteadComparison([su], [budget], {}, [unverified], 'x');
    const cell = out.sus['su/x']['2027'][0];
    expect(cell.published).toBe(1.7);
    expect(cell.calculated).toBeNull();
    expect(cell.blocker).not.toBeNull();
    expect(cell.difference).toBeNull();
  });

  it('omits an SU with no budget records carrying a town table', () => {
    const out = buildHomesteadComparison([su], [], {}, [unverified], 'x');
    expect(out.sus['su/x']).toBeUndefined();
  });
});
```

(If `parseParameterSet` rejects an empty `parameters` array, build the set with the minimal parameter list the other build-data tests use; the assertion that matters is `calculated === null` with a non-null `blocker`.)

- [ ] **Step 3: Run the builder tests**

Run: `npx vitest run tools/src/homestead-comparison.test.ts`
Expected: PASS.

- [ ] **Step 4: Emit `homestead-comparison.json` in `build-data.ts`**

Add the import:

```ts
import { buildHomesteadComparison } from '../homestead-comparison.ts';
```

`parameterSets` is already parsed in `build-data.ts` for `parameters.json`, but note it maps to a plain object; reuse the parsed `parseParameterSet` results instead. Capture them: where `parameterSets` is built, also keep the parsed sets:

```ts
  const parsedParameterSets = parameterFiles.map((file) =>
    parseParameterSet(parseYaml(readFileSync(file, 'utf8'))),
  );
```

After the resolved-ADM block (Task 5, Step 9), add:

```ts
  // --- homestead: calculated vs published, per SU/year/town ----------------
  const resolvedAdmForHomestead = admRecords.length > 0
    ? (() => {
        const publication = buildAdmPublication(admRecords, registry, today.toISOString());
        const map: Record<string, Record<string, ReturnType<typeof resolveAdm>>> = {};
        for (const b of budgets) {
          const aoe = aoeBandsFor(b.entity, b.fiscal_year, publication, registry);
          const adm = (b as { adm?: Record<string, number | null> }).adm ?? null;
          if (!adm && !aoe) continue;
          (map[b.entity] ??= {})[String(b.fiscal_year)] = resolveAdm(adm, aoe);
        }
        return map;
      })()
    : {};
  writeJson(
    join(PATHS.siteGenerated, 'homestead-comparison.json'),
    buildHomesteadComparison(sus, budgets as any, resolvedAdmForHomestead, parsedParameterSets, today.toISOString()),
  );
```

(`sus` is already computed later in `main()`; move this block to after the `const sus = …` line, or hoist `sus` earlier. Keep it after both `admRecords` and `sus` exist.)

- [ ] **Step 5: Render the table on the SU page**

In `site/src/pages/su/[slug].astro` frontmatter, import the dataset and pull this SU's rows:

```ts
import homesteadComparison from '../../generated/homestead-comparison.json';
const homesteadYears = (homesteadComparison.sus as Record<string, Record<string, Array<{
  town: string; published: number | null; calculated: number | null; blocker: string | null; difference: number | null;
}>>>)[su.slug] ?? {};
const homesteadRows = Object.entries(homesteadYears)
  .flatMap(([year, cells]) => cells.map((c) => ({ year, ...c })))
  .sort((a, b) => Number(b.year) - Number(a.year) || a.town.localeCompare(b.town));
```

In the template, immediately after the "Member-town homestead rates" `notice` block (around line 213–225), add:

```astro
  {homesteadRows.length > 0 && (
    <>
      <h2>Homestead rate: calculated vs published</h2>
      <p>
        Each member town's homestead rate as printed in the budget, beside the rate the statutory
        formula produces from this SU's education spending and resolved membership. The calculated
        column is blank while any statutory parameter it needs is still unverified — it shows what
        it is waiting on, and fills in once those are checked.
      </p>
      <div class="scroll-x">
        <table>
          <thead>
            <tr>
              <th scope="col">Town</th>
              <th scope="col">Year</th>
              <th scope="col">Published</th>
              <th scope="col">Calculated (billed)</th>
              <th scope="col">Difference</th>
            </tr>
          </thead>
          <tbody>
            {homesteadRows.map((r) => (
              <tr>
                <th scope="row">{slugTail(r.town)}</th>
                <td>FY{r.year}</td>
                <td>{r.published === null ? '—' : r.published.toFixed(4)}</td>
                <td>
                  {r.calculated !== null ? (
                    r.calculated.toFixed(4)
                  ) : (
                    <span class="tag unverified">awaiting {r.blocker ?? 'inputs'}</span>
                  )}
                </td>
                <td>{r.difference === null ? '—' : r.difference.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )}
```

(`slugTail` is already imported on the SU page.)

- [ ] **Step 6: Build data and verify the page**

Run: `npm run build:data`
Then start the dev server and open `/su/addison-central/`. Confirm the "Homestead rate: calculated vs published" table renders one row per member town × year (FY2023, FY2024), the Published column shows the stated rates (e.g. `1.7700`), the Calculated column shows an "awaiting …" tag naming a parameter, and Difference shows `—`. Check no console errors.

- [ ] **Step 7: Typecheck + full suite + build**

Run: `npm run typecheck && npm test && npm run build:data`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add tools/src/homestead-comparison.ts tools/src/homestead-comparison.test.ts tools/src/cli/build-data.ts site/src/pages/su/[slug].astro
git commit -m "feat(site): homestead calculated-vs-published table on the SU page"
```

---

### Task 8: Update the prose docs

Bring PLAN.md, the normalize-channel spec, and the glossary into agreement with the reshaped model.

**Files:** Modify `PLAN.md`, `docs/superpowers/specs/2026-07-31-warehouse-normalize-channel-design.md`, `site/src/content/explanations/vt-4-glossary.md`

- [ ] **Step 1: Replace the PLAN.md §5 field tree**

In `PLAN.md`, replace the YAML block under "## 5. The budget template and normalization" (the `revenues: / expenditures: / tax: …` tree, lines ~90–110) with:

```yaml
schema_version: "1.0"
entity: su/<slug>                     # registry slug
fiscal_year: 2027
status: proposed|warned|approved|actual
source: intake/<slug>/fy<year>/<file> # the raw artifact this came from
education_spending: …                 # the district's published Education Spending line
adm:                                  # district-STATED ADM by statutory band
  prekindergarten: …
  kindergarten_through_5: …
  grades_6_through_8: …
  grades_9_through_12: …
tax:
  towns: [ { town, homestead_rate_stated, cla } ]  # per member town, as stated
notes: …                              # optional free text
not_published: [ … ]                  # every accountable null accounted for, with who/when
lines_flagged: [ … ]                  # anything that didn't fit cleanly
```

- [ ] **Step 2: Rewrite the §5 design-principle and extraction prose**

Replace the "Design principles for the schema: essentials only …" paragraph with:

```markdown
Design principles for the schema: **essentials only** (the district's published
education spending, its stated ADM by the four statutory grade bands, and the
per-town stated tax figures — not a chart of accounts), **a null in an
accountable field always means "not published"** (enforced by the
null-accounting rule: every such null is listed in `not_published` or
`lines_flagged`), and **version the schema** so records stay readable as it
evolves. Education spending is captured as the district's published figure, not
recomputed from expenditures and offsetting revenues.
```

Leave the "**Extraction.**" paragraph as-is (it already describes the form→bot→PR flow accurately). In the "**Enrichment joins.**" paragraph, change the parenthetical about ADM to note that district-stated ADM now lives in the record and the AOE series is resolved district-first with a cross-check that warns but never reconciles.

- [ ] **Step 3: Update the normalize-channel spec field lists**

In `docs/superpowers/specs/2026-07-31-warehouse-normalize-channel-design.md`, replace the "Accountable figures" and "Optional descriptive fields" bulleted subsections with:

```markdown
### Accountable figures — a number or `n/p`

Each must be a number or the literal `n/p`; empty is rejected.

- **Education spending:** `education_spending`
- **ADM (district-stated), by statutory band:** `adm.prekindergarten`,
  `adm.kindergarten_through_5`, `adm.grades_6_through_8`, `adm.grades_9_through_12`
- **Tax:** each member town's `homestead_rate_stated` and `cla`

### Optional descriptive fields — blank is fine

`source_pages`, `adopted_date`, and `notes` (free text). Every budget figure is
accountable; these are not.
```

- [ ] **Step 4: Add the glossary Education spending entry**

In `site/src/content/explanations/vt-4-glossary.md`, add, in ABC order immediately after the **Education Fund** paragraph:

```markdown
**Education spending.** The number that actually sets your tax rate. Start with everything a district plans to spend, then subtract the money that comes from somewhere other than the statewide school tax — federal grants, categorical state aid, and other non-tax revenue. What is left is education spending. It is smaller than the total budget, and it is the figure the **yield** and the **excess spending threshold** are measured against. "Total budget" and "education spending" are different numbers, and this is the one that lands on your bill.
```

- [ ] **Step 5: Verify no stale field references remain**

Run: `grep -nE "personnel|per_pupil|revenues:|expenditures:|total_stated" PLAN.md docs/superpowers/specs/2026-07-31-warehouse-normalize-channel-design.md`
Expected: no matches in the edited sections (unrelated historical mentions elsewhere in PLAN.md are acceptable if they are not in §5/§7).

Run: `npm run build:data`
Expected: the glossary/content build completes (the explanations collection still parses).

- [ ] **Step 6: Commit**

```bash
git add PLAN.md docs/superpowers/specs/2026-07-31-warehouse-normalize-channel-design.md site/src/content/explanations/vt-4-glossary.md
git commit -m "docs: describe the education-spending budget model, ADM resolution, and glossary term"
```

---

## Final verification

- [ ] `npm run typecheck && npm test && npm run validate && npm run build:data` all pass.
- [ ] `grep -rn "total_stated\|revenues\.\|expenditures\." tools/src model/src schemas` returns no budget-record references (unrelated hits, if any, are not budget fields).
- [ ] `schemas/budget-1.0.schema.json`, `FIGURE_FIELDS`, `ACCOUNTABLE`, and the `budget-normalize.yml` form all list the same figures: `education_spending` + the four `adm.*` bands (+ the tax town rate/cla).
- [ ] `site/src/generated/resolved-adm.json` and `site/src/generated/homestead-comparison.json` are produced; on today's data every resolved band is `unknown` and every calculated homestead cell is a blocker.
- [ ] `/model/` shows the load-a-district control; `/su/addison-central/` shows the homestead comparison table.

## Notes & scope boundaries

- **The calculated homestead column is dormant.** Every real-year cell is a blocker until the statutory parameters are verified; this is by design and matches the SU page's existing "baseline figures blocked" messaging.
- **The AOE cross-check and the ADM fallback are dormant too.** The only current AOE record (`adm24`) does not map to the statutory bands, so `aoeBandsFor` returns null and both the cross-check and the state-side of the resolver are silent until a mapping-year AOE report lands.
- **The two migrated records carry `null` education spending and ADM** with `pending` `lines_flagged` entries. Backfilling the real figures from the FY23 budget book is a follow-up data task.
- **CLA normalization.** Task 2 writes the Bridport/Cornwall CLAs as ratios for consistency; the schema accepts either form. If the exact prior values matter, keep them.
- **`townRate`'s exact signature** must be confirmed against `model/src/tax.ts` when writing Task 7's builder (the plan mirrors the live `/model` call); pass `null` for any excess-spending adjustment key not supplied.
