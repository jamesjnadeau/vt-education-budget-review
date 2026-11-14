# Act 84 Decrease Prefill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loading a district on `/model/` fills the "Act 84 transition decrease" field from AOE's worksheet, with a note saying where the number came from.

**Architecture:** An `act84:import` CLI parses the worksheet's text layer into a checked-in
warehouse record (`warehouse/aoe-act84/fy2025.yaml`), resolving each name to a registry
district through AOE's FY2024 EdSpend names. `build-data` turns that record into an `act84`
map in `resolved-adm.json`. The model island fills the field from it on a `fill` plan,
behind the same typed-value guard as the other prefilled fields.

**Tech Stack:** TypeScript (tsx CLIs), vitest, ajv JSON Schema 2020-12, `yaml`, Astro island.

**Spec:** `docs/superpowers/specs/2026-11-14-act84-decrease-prefill-design.md`

## Global Constraints

- Only the worksheet's FY2025 column is read. FY2026–FY2029 columns are ignored.
- A district the worksheet does not list gets 0. Supervisory unions get no entry.
- The intake artifact is never edited. The import verifies the PDF's sha256 against `provenance.yaml` before reading the `.txt` beside it.
- `warehouse/aoe-act84/fy2025.yaml` is written only by the import. Its header ends "Do not hand-edit: re-run the import instead, so the record always matches the hashed artifact."
- A value the reader typed in `act84-decrease` is never overwritten, nor is its note relabelled.
- Public text at about a 5th-grade reading level (AGENT.md).
- Note strings, exactly:
  - listed: `from the state AOE worksheet (listed as ${listed_as})`
  - unlisted: `not on the state AOE worksheet, so 0`
  - no entry: `no AOE figure for this pick; field left blank`
  - no `tax.transition.phase_out_share` in the mode's parameter set: `does not apply in FY${fy}`

## Review Focus

1. A reader types a decrease, then loads a district. The typed value and its (empty) note stay. Pinned in Task 3, step 6.
2. A reader loads a listed district, then a supervisory union. The old figure must clear, not linger. Pinned in Task 3, step 1 (`act84Fill(undefined, …)`) and step 6.
3. A worksheet name with punctuation (`Taconic & Green Regional USD`, `Mt. Abraham USD`, `Essex-Westford EC USD`) or a row the regex misses. The import fails, never drops a row. Pinned in Task 1, step 1 (real-data test and total check).
4. A worksheet name that matches no FY2024 district, or two, or a row whose `entity` is null. The import fails and names every such row. Pinned in Task 1, step 1 (resolver tests).
5. Mountain Views, which AOE lists under its old name "Windsor Central UUSD" (code U076). It gets 0.01 with `listed_as: "Windsor Central UUSD"`. Pinned in Task 1, step 1, and Task 2, step 1.

---

### Task 1: Worksheet import to a warehouse record

**Files:**
- Create: `tools/src/aoe/act84/parse.ts`, `tools/src/aoe/act84/parse.test.ts`
- Create: `tools/src/aoe/act84/record.ts`, `tools/src/aoe/act84/record.test.ts`
- Create: `tools/src/cli/act84-import.ts`
- Create: `schemas/act84-1.0.schema.json`
- Create (by running the import): `warehouse/aoe-act84/fy2025.yaml`
- Modify: `package.json` (scripts), `tools/src/validate/schemas.ts` (`SchemaName`, `SCHEMA_IDS`), `tools/src/cli/validate.ts` (warehouse loop, beside the `aoe-edspend` branch at ~306), `tools/src/cli/build-data.ts` (`readBudgets()` exclusion list)

**Interfaces:**
- Consumes: `DistrictRecord` from `tools/src/aoe/edspend/record.ts` (the top-level `districts:` rows only, never the `union_districts` nested under towns).
- Produces:
  ```ts
  // parse.ts
  export interface WorksheetRow {
    readonly line: number;               // 1-based line in the .txt
    readonly su: string;                 // "03", as printed
    readonly name: string;               // as printed
    readonly county: string;
    readonly pre_act127_ltw_adm: number; // commas stripped
    readonly fy2025_decrease: number;    // the first "$" figure
  }
  export interface Worksheet { readonly rows: WorksheetRow[]; readonly total: { readonly pre_act127_ltw_adm: number; readonly line: number } }
  export function parseWorksheet(text: string): Worksheet;

  // record.ts
  export const NAME_ALIASES: Readonly<Record<string, string>>; // worksheet name -> FY2024 name_as_published
  export interface Act84District {
    readonly entity: string; readonly aoe_org_id: string; readonly name_as_published: string;
    readonly su: string; readonly county: string;
    readonly pre_act127_ltw_adm: number; readonly fy2025_decrease: number; readonly source_line: number;
  }
  export function resolveRows(rows: ReadonlyArray<WorksheetRow>, districts: ReadonlyArray<DistrictRecord>): Act84District[];
  export interface Act84Record {
    readonly schema_version: '1.0';
    readonly source: string;        // the PDF, repo-relative
    readonly source_text: string;   // the .txt beside it
    readonly fiscal_year: 2025;
    readonly names_from: string;    // 'warehouse/aoe-edspend/fy2024.yaml'
    readonly unlisted_decrease: 0;
    readonly total: { readonly pre_act127_ltw_adm: number; readonly source_line: number };
    readonly districts: ReadonlyArray<Act84District>;
    readonly extracted_by: string;
    readonly extracted_date: string; // YYYY-MM-DD
  }
  ```

- [ ] **Step 1: Write the failing tests**

`parse.test.ts`, with a three-row synthetic text (a header line starting `S.U.`, two data rows in the worksheet's layout, a `Total` line):
- `parses a data row`: `{ line: 2, su: '03', name: 'Addison Central USD', county: 'Addison', pre_act127_ltw_adm: 1771.32, fy2025_decrease: 0.13 }` from `' 03    Addison Central USD      Addison   1,771.32  2.01%  2,487.15  1.74%  -13%   $  0.13  $  0.10'`.
- `keeps punctuation in names`: a row named `Taconic & Green Regional USD` parses with that exact name.
- `fails when the rows do not add up to the Total line`: change the Total; expect `toThrow(/Total/)`.
- `fails on a line that starts with an S.U. number but is not a row`: add `' 07    garbled'`; expect `toThrow(/line 4/)`.
- `fails with no Total line`: expect `toThrow(/Total/)`.
- `reads the real worksheet` (reads the `.txt` from `PATHS.intake`): 39 rows, `total.pre_act127_ltw_adm === 43781.32`, names include `Mt. Abraham USD`, `Essex-Westford EC USD`, `Taconic & Green Regional USD`; `Addison NW USD` has `fy2025_decrease === 0.02`; every `fy2025_decrease >= 0.01`.

`record.test.ts`, with a `district(name, entity, aoe_org_id)` builder for `DistrictRecord`:
- `joins an exact name`: `North Bennington ID` → `town/north-bennington`, `T141`.
- `joins through an alias`: `Harwood USD` → the row named `Harwood UUSD`.
- `fails on a name with no match, naming every such row`: two unmatched rows; the error message contains both names.
- `fails on a name with two matches`: expect `toThrow(/two|more than one/)`.
- `fails when the matched row has no entity`: `entity: null`; expect throw naming the row.
- `resolves every row of the real worksheet` (real `.txt` + `warehouse/aoe-edspend/fy2024.yaml`): 39 results; `Windsor Central UUSD` → `{ entity: 'ud/mountain-views', aoe_org_id: 'U076', fy2025_decrease: 0.01 }`; `Granville-Hancock USD` → `ud/granville-hancock`; no two results share an `entity`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tools/src/aoe/act84`
Expected: FAIL, cannot resolve `./parse.ts` / `./record.ts`.

- [ ] **Step 3: Implement `parseWorksheet` and `resolveRows`**

Row regex (captures all 39 real rows): `/^\s*(\d\d)\s+(.+?)\s{2,}(\w[\w ]*?)\s{2,}([\d,.]+)\s.*?\$\s+([\d.]+)/`, groups su, name, county, pre ADM, FY2025. A line matching `/^\s*\d\d\s/` that fails the row regex throws with its line number. The Total line is `/^\s*Total\s+([\d,.]+)/`. Compare the sum to the total in cents (`Math.round(x * 100)`).

`NAME_ALIASES`, exactly:

| Worksheet | FY2024 `name_as_published` |
|---|---|
| Granville-Hancock USD | Granville-Hancock Unified District |
| Essex-Westford EC USD | Essex-Westford ECUUSD |
| Quarry Valley USD | Quarry Valley UUSD |
| Barre USD | Barre UUSD |
| Harwood USD | Harwood UUSD |
| Montpelier-Roxbury USD | Montpelier Roxbury School District |
| Mount Ascutney USD | Mount Ascutney School District |

`resolveRows` collects every failure, then throws once with all of them.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tools/src/aoe/act84`
Expected: PASS.

- [ ] **Step 5: Add the schema, validator branch, build exclusion and CLI**

- `schemas/act84-1.0.schema.json`: `$id` `urn:vt-budget:schema:act84:1.0`, draft 2020-12, `additionalProperties: false` at every level, every `Act84Record` field required. `entity` uses `urn:vt-budget:schema:common:1.0#/$defs/entity_ref`. `aoe_org_id` uses `^[TU][0-9]{3}[A-Z]?$`. `su` uses `^[0-9]{2}$`. `source` uses `^intake/aoe-guidance/[^/]+/[^/]+\.pdf$` and `source_text` uses the same with `\.txt$`. `names_from` uses `^warehouse/aoe-edspend/fy[0-9]{4}\.yaml$`. `fiscal_year` is `const: 2025` and `unlisted_decrease` is `const: 0`. `fy2025_decrease` is a number with minimum 0. `districts` has `minItems: 1`.
- `schemas.ts`: add `'act84'` to `SchemaName` and `act84: 'urn:vt-budget:schema:act84:1.0'` to `SCHEMA_IDS`.
- `validate.ts`: a `warehouse/aoe-act84/` branch that runs `schemaFindings('act84', data, file)` and `checkRegistryRefs(data, file, registry)`, then `continue`. Mirror the `aoe-edspend` branch.
- `build-data.ts`: add `'warehouse/aoe-act84/'` to the `readBudgets()` exclusions.
- `act84-import.ts`: mirror `edspend-import.ts`. Copy its local `provenanceEntry`, `verifyHash`, `extractedBy` and `write`. Do not refactor them into a shared module. It verifies the PDF hash, reads the `.txt` beside it, and reads `names_from` districts. Then it calls `parseWorksheet` and `resolveRows`, prints `39 rows, total 43,781.32 ADM`, and writes the record unless `--check`. The header comment says:
  - what the record is
  - that only the FY2025 column is read
  - that unlisted districts are 0
  - the do-not-hand-edit line
- `package.json`: `"act84:import": "tsx tools/src/cli/act84-import.ts"`.

- [ ] **Step 6: Run the import and validate**

Run: `npm run act84:import && npm run act84:import -- --check && npm run validate`
Expected: the import writes `warehouse/aoe-act84/fy2025.yaml` with 39 districts. `--check` passes without writing. Validate reports no findings for the new file. Then run `npm run build:data`; it must still succeed, which shows the exclusion works.

- [ ] **Step 7: Commit**

```bash
git add tools/src/aoe/act84 tools/src/cli/act84-import.ts schemas/act84-1.0.schema.json warehouse/aoe-act84 package.json tools/src/validate/schemas.ts tools/src/cli/validate.ts tools/src/cli/build-data.ts
git commit -m "Import AOE's Act 84 worksheet into a warehouse record"
```

### Task 2: `act84` map in resolved-adm.json

**Files:**
- Create: `tools/src/act84-prefill.ts`, `tools/src/act84-prefill.test.ts`
- Modify: `tools/src/cli/build-data.ts` (prefill section, ~189–226)

**Interfaces:**
- Consumes: `Act84Record` (Task 1).
- Produces:
  ```ts
  export interface Act84Entry { readonly value: number; readonly listed_as: string | null }
  /** One entry per picker slug that is in `districtSlugs`; nothing for any other slug. */
  export function act84Prefill(
    record: Act84Record,
    districtSlugs: ReadonlyArray<string>, // non-null entities of the names_from record's districts
    pickerSlugs: ReadonlyArray<string>,
  ): Record<string, Act84Entry>;
  ```
  `resolved-adm.json` gains `act84: Record<string, Act84Entry>`.

- [ ] **Step 1: Write the failing tests**

Use a `rec(districts)` builder:
- `gives a listed district its worksheet figure and name`: `{ value: 0.09, listed_as: 'Harwood USD' }`.
- `gives an unlisted district 0`: `{ value: 0, listed_as: null }`.
- `gives a supervisory union no entry`: an `su/…` picker slug not in `districtSlugs` is absent.
- `leaves out districts the picker does not offer`.
- `builds from the real record`: read `warehouse/aoe-act84/fy2025.yaml` and its `names_from` file, and use those districts' slugs as the picker. Assert:
  - `ud/mountain-views` is `{ value: 0.01, listed_as: 'Windsor Central UUSD' }`
  - `ud/harwood-60` is `{ value: 0.09, listed_as: 'Harwood USD' }`
  - exactly 39 entries have a non-null `listed_as`

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tools/src/act84-prefill.test.ts`
Expected: FAIL, cannot resolve `./act84-prefill.ts`.

- [ ] **Step 3: Implement `act84Prefill` and wire it into build-data**

In build-data:
1. Read `warehouse/aoe-act84/fy2025.yaml`.
2. Read its `names_from` file, resolved against `REPO_ROOT`.
3. Collect the non-null `districts[].entity` values.
4. Add `act84: act84Prefill(record, districtSlugs, prefillSlugs)` to the `resolved-adm.json` object.

- [ ] **Step 4: Run tests and the build**

Run: `npx vitest run tools/src/act84-prefill.test.ts && npm run build:data && node -e "const j=require('./site/src/generated/resolved-adm.json'); console.log(Object.keys(j.act84).length, j.act84['ud/mountain-views'])"`
Expected: PASS. The script prints `122 { value: 0.01, listed_as: 'Windsor Central UUSD' }`, one entry per non-SU picker slug.

- [ ] **Step 5: Commit**

```bash
git add tools/src/act84-prefill.ts tools/src/act84-prefill.test.ts tools/src/cli/build-data.ts
git commit -m "Build each district's Act 84 decrease into the model prefill data"
```

### Task 3: Fill the field and its note

**Files:**
- Modify: `site/src/scripts/adm-prefill.ts`, `site/src/scripts/adm-prefill.test.ts`
- Modify: `site/src/scripts/model-tool.ts`:
  - `ResolvedAdmData` (~83)
  - the guard loop (~836)
  - add `fillAct84` beside `fillSpending` (~843)
  - `applyAdmPrefill` (~884)
- Modify: `site/src/pages/model/index.astro` (Act 84 fieldset, ~262–274)
- Modify: `docs/act-127-transition.md:143`

**Interfaces:**
- Consumes: the `act84` map (Task 2).
- Produces (in `adm-prefill.ts`):
  ```ts
  export interface Act84Entry { readonly value: number; readonly listed_as: string | null }
  export function act84Fill(entry: Act84Entry | undefined, transitionApplies: boolean, fy: number): { value: string; note: string };
  ```

- [ ] **Step 1: Write the failing tests** (in `adm-prefill.test.ts`, `describe('act84Fill')`)

- `fills a listed district with its figure`: `act84Fill({ value: 0.09, listed_as: 'Harwood USD' }, true, 2026)` returns `{ value: '0.09', note: 'from the state AOE worksheet (listed as Harwood USD)' }`.
- `fills an unlisted district with 0`: `act84Fill({ value: 0, listed_as: null }, true, 2026)` returns `{ value: '0', note: 'not on the state AOE worksheet, so 0' }`.
- `clears the field for a pick with no figure`: `act84Fill(undefined, true, 2026)` returns `{ value: '', note: 'no AOE figure for this pick; field left blank' }`.
- `clears the field when the year has no transition`: `act84Fill({ value: 0.09, listed_as: 'Harwood USD' }, false, 2030)` returns `{ value: '', note: 'does not apply in FY2030' }`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run site/src/scripts/adm-prefill.test.ts`
Expected: FAIL, `act84Fill` is not exported.

- [ ] **Step 3: Implement `act84Fill`**

The transition check comes first, then no entry, then unlisted, then listed. Add a bullet for this rule to the file's header comment, citing the spec.

- [ ] **Step 4: Wire it into the form**

- `ResolvedAdmData` gains `act84?: Record<string, Act84Entry>`.
- Add `'act84-decrease'` to the `userEditedAdm` loop.
- `fillAct84(entry, mode)` mirrors `fillSpending`. It uses `#act84-decrease` and `[data-act84-source]`, and returns early when the field is user-edited. `transitionApplies` is `sets.find((s) => s.fiscal_year === Number(mode))?.parameters.some((p) => p.key === 'tax.transition.phase_out_share') ?? false`.
- In `applyAdmPrefill`, call `fillAct84((resolvedAdmData.act84 ?? {})[entity], plan.mode)` after `fillSpending` and before `recompute()`.
- `index.astro`: add `<small class="adm-source" data-act84-source></small>` right after the `#act84-decrease` input. Add one sentence to its help text, e.g. "Loading a district above fills this in."
- `docs/act-127-transition.md:143`: Mountain Views' "Why" now says:
  - the worksheet lists it as Windsor Central UUSD (AOE code U076), with 0.01
  - the 0.01 accounts for only a small part of the gap, so the rest is still unexplained (possibly Sec. 3(g))

  Leave line 134's one-to-one count alone; it is about the name join.

- [ ] **Step 5: Run the tests, typecheck and full suite**

Run: `npx vitest run site/src/scripts/adm-prefill.test.ts && npm run typecheck && npm test`
Expected: all PASS.

- [ ] **Step 6: Check it in the browser** (`npm run build:data`, then the site dev server via `preview_start`, then `/model/`)

| Do | Expect in the field | Expect in the note |
|---|---|---|
| Load Addison Northwest, FY2026 | `0.02` | "from the state AOE worksheet (listed as Addison NW USD)" |
| Load Harwood | `0.09` | "(listed as Harwood USD)" |
| Load Mountain Views | `0.01` | "(listed as Windsor Central UUSD)" |
| Load an unlisted district (e.g. Burlington) | `0` | "not on the state AOE worksheet, so 0" |
| Load Harwood, then the SU | empty | "no AOE figure for this pick; field left blank" |
| Reload, type `0.05` in the field, then load Harwood | stays `0.05` | stays empty |

For Addison Northwest FY2026, the result shows a computed rate, not "not computable". Check the console for errors.

- [ ] **Step 7: Commit**

```bash
git add site/src/scripts/adm-prefill.ts site/src/scripts/adm-prefill.test.ts site/src/scripts/model-tool.ts site/src/pages/model/index.astro docs/act-127-transition.md
git commit -m "Fill the Act 84 decrease when a district is loaded"
```

### Task 4: Final verification

- [ ] **Step 1: Run every check**

Run: `npm test && npm run typecheck && npm run validate && npm run build:data && npm run act84:import -- --check`
Expected: all exit 0. `git status` shows no unexpected changes. The `--check` re-run matches the committed record.
