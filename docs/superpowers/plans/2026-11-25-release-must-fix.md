# Release Must-Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the "Must fix before release" tier of `docs/release-readiness.md`, so the public site says nothing wrong or self-contradicting about Vermont school tax rates.

**Architecture:** Three independent tracks touch disjoint files and can run in any order:
- **A. What-if tool** (`site/src/scripts/`). Stop using demo values. Every district-dependent input is either filled from held data the reader opts into, or left blank so the engine refuses with `missing_input`.
- **B. Resident pages** (`site/src/lib/`, `site/src/components/`, `site/src/pages/my/`). Correct the rate copy. Add a unit and dollar line, a source line and a residual flag.
- **C. Registry and copy** (`site/src/pages/su/`, `town/`, `admin/`, `methodology/`, `site/src/lib/display.ts`).

Two items are not code: the parameter sign-off (Task 11, human only) and the phone check (Task 12, run in the browser pane).

**Tech Stack:** Astro static site, TypeScript, Vitest (`npx vitest run <file>`), `npm run build:data`, `npm run validate`.

**Spec:** [`docs/release-readiness.md`](../../release-readiness.md), section "Must fix before release". The evidence is in [`docs/feedback/`](../../feedback/).

## Global Constraints

- Public copy is written at a 5th-grade reading level (`AGENT.md`). Use short sentences and no semicolons in reader-facing text.
- Every blank uses one of the four kinds: `missing_input` ("not published"), `not_computable` ("cannot be told"), `unverified` ("not checked yet"), `undetermined` ("not decided yet"). Do not invent a fifth.
- Never fill a number from memory. Every figure shown comes from a file in `warehouse/`, `registry/`, `intake/`, or `site/src/generated/`.
- Rates in `warehouse/tax-rates/fy2026.yaml` are per $100 of value. The source is Vermont Department of Taxes, "FY2026 Education Property Tax Rates", dated August 18, 2025. Its document page is `https://tax.vermont.gov/document/fy2026-education-property-tax-rates`, as recorded in `intake/tax-rates/fy2026/provenance.yaml`.
- The example house value is $250,000 and is always labelled as an example.
- Do not touch `model/parameters/fy2026.yaml` values. The engine's refusal of unverified parameters stays (`model/src/node.ts`).
- Each task ends with `npm test` and `npm run validate` passing.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Out of scope: the "who made this" page and everything else in the Should-fix tier.

## Review Focus

1. **A multi-town district whose towns have different CLAs**, such as Champlain Valley #56 (Hinesburg and Shelburne). The what-if tool must not pick one town's CLA silently. Task 2 adds a test.
2. **A district where AOE withheld a town's English-learner or lunch count.** The suggestion must say "at least N", and a lower-limit estimate must never be ticked by default. Task 1 adds a test.
3. **A reader who has already typed a value, then picks a district.** Their value must survive, exactly as `userEditedAdm` already guards the ADM fields. Task 2 adds a test.
4. **A town in a residual district that is also a multi-town district** (Norwich, Hartford). The town page shows both the residual flag and the unit line, and neither replaces the other. Task 7 adds a test.
5. **A blank rate** (the rate is `kind: 'blank'`). The unit line, dollar example and source line must not render around an empty value. Task 5 adds a test.

---

## Track A — What-if tool

### Task 1: Source-or-refuse plan for the four district inputs

**Files:**
- Create: `site/src/scripts/district-inputs.ts`
- Test: `site/src/scripts/district-inputs.test.ts`

**Interfaces:**
- Consumes:
  - `combinedSubgroupEstimate(slugs, data, 'ell' | 'frl')`, `subgroupEstimateText`, `combinedDensity`, `combinedDensityText` and `CombinerData` from `site/src/scripts/combiner-view.ts`.
  - `site/src/generated/combiner.json`. Its `towns[slug].cla` comes from the tax-rates warehouse.
- Produces:
  ```ts
  export type InputField = 'econ' | 'el' | 'density' | 'cla';
  export type InputPlan =
    | { kind: 'suggest'; value: number; note: string; tickByDefault: boolean }
    | { kind: 'choose'; choices: { town: string; label: string; cla: number }[]; note: string } // cla only
    | { kind: 'refuse'; reason: string };
  export function planDistrictInputs(entity: string, data: CombinerData): Record<InputField, InputPlan>;
  ```

Rules:
- **econ:** suggest the FRL town sum, with `tickByDefault: false` always. FRL is not the 185% poverty measure, and the note says so, reusing `subgroupEstimateText(..., 'frl')`. Refuse when the estimate is `null`.
- **el:** suggest the ELL town sum. `tickByDefault` is true only when nothing was withheld or missing. Refuse when the estimate is `null`.
- **density:** suggest `density2020`, ticked by default. Refuse when it is `null`, with the reason from `combinedDensityText`.
- **cla:**
  - One-town district: suggest that town's `cla`, ticked by default, with the note "Common level of appraisal for {Town}, Vermont Department of Taxes, August 18, 2025."
  - Multi-town district: `choose`, listing every member town with a held CLA.
  - No held CLA: refuse.

- [ ] **Step 1: Write the failing tests**
  - `every district gets a plan for all four fields, never a placeholder`: loop over every key of `combiner.json` `districts`. Assert each of the four fields is `suggest`, `choose` or `refuse`. Assert no `suggest` value equals 40, 8, 30 or 0.8 unless it equals the held source value.
  - `econ is never ticked by default`: holds for every district.
  - `withheld ELL is offered unticked with "at least"`: pick a district with a withheld town from the data. Assert `tickByDefault === false` and that the note contains `at least`.
  - `multi-town CLA is a choice, not a value`: for `ud/champlain-valley-56`, the plan is `choose`. Its choices include Hinesburg and Shelburne, each carrying the `cla` that `warehouse/tax-rates/fy2026.yaml` holds for that town. Read the values from the yaml and pin them in the test.
  - The checklist asks for "every district + year". These four inputs do not vary by year in the held data, so one check per district covers every year. Say so in a comment in the test.
  - `single-town CLA is suggested`: for `town/milton`, the plan is `suggest`, and its value equals `combiner.towns['milton'].cla` (match the slug form the file uses).
- [ ] **Step 2: Run them.** Command: `npx vitest run site/src/scripts/district-inputs.test.ts`. Expected: FAIL, with module not found.
- [ ] **Step 3: Implement `planDistrictInputs`** in `site/src/scripts/district-inputs.ts`.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat(model): plan district inputs as source-or-refuse`.

### Task 2: Wire the plan into the what-if form, and show AOE's weighted ADM

**Files:**
- Modify:
  - `site/src/scripts/model-tool.ts`: `applyAdmPrefill()` (about lines 1063–1090), `recompute()`, and the load-entity handler.
  - `site/src/pages/model/index.astro`: the `econ`, `el`, `density` and `cla` inputs (about lines 183–231). Remove their `value=` attributes, and add a suggestion slot and a CLA town `<select>`.
  - `site/src/scripts/adm-prefill.ts`: one pure helper.
- Test: `site/src/scripts/adm-prefill.test.ts`, plus a jsdom test `site/src/scripts/model-tool.district-inputs.test.ts`. Use jsdom only if the existing tests already use it. Otherwise keep the test on pure helpers.

**Interfaces:**
- Consumes: `planDistrictInputs` (Task 1), and the existing `setSuggestion(id, Suggestion)`, `userEditedAdm` and `resolvedAdmData`.
- Produces:
  ```ts
  // adm-prefill.ts
  export function weightedAdmComparison(engine: number | null, published: number | null): { text: string; gapPercent: number | null };
  ```

Behaviour:
- The four inputs start empty on first load. Then the engine blocks with `missing_input`, and its message names the field. Check this message reads well.
- On district load, for each field:
  - Skip it if the reader edited it (extend `userEditedAdm`, or add a parallel set for these four ids).
  - Otherwise clear it and apply the plan:
    - `suggest`: `setSuggestion` with the checkbox ticked per `tickByDefault`.
    - `choose`: fill the CLA `<select>` with "{Town} — {cla}" options and an empty first option "Pick your town". The field stays blank until the reader picks.
    - `refuse`: leave it blank and show the reason under the field.
- Beside the engine's weighted membership total, show `weightedAdmComparison(engineTotal, resolvedAdmData.spending[entity][fy].pupils)`. Text when both values exist: "AOE publishes {published}. This page counts {engine}." Add "They differ by {n}%." when the gap is at least 0.5%. When `published` is null: "AOE has not published a weighted count for this year."

- [ ] **Step 1: Write the failing tests**
  - `weightedAdmComparison(1921.78, 2417.47)`: `gapPercent` rounds to `-20.5`, and the text contains `2,417.47` and `1,921.78`.
  - `weightedAdmComparison(5683.51, 5683.51)`: the text has no "differ" sentence.
  - `weightedAdmComparison(100, null)`: the text is the not-published sentence.
  - Review Focus #1: for CVSD, the CLA select has one option per member town and no option is selected.
  - Review Focus #3: when the reader typed 55 into `econ` and then loads Milton, `econ` stays 55.
- [ ] **Step 2: Run them.** Command: `npx vitest run site/src/scripts/adm-prefill.test.ts site/src/scripts/model-tool.district-inputs.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Add `weightedAdmComparison`, wire the plan into `applyAdmPrefill`, and clear the placeholder `value=` attributes.
- [ ] **Step 4: Run the tests and a build.** Commands: the same vitest command, then `npm run build` in `site/`. Expected: PASS.
- [ ] **Step 5: Check in the browser pane.**
  - Load Milton FY2026, and tick each suggestion. Record in the commit message the billed rate shown next to the published $1.2462. Do not assert equality: FRL is a stand-in for the poverty count.
  - Load CVSD and pick Hinesburg.
- [ ] **Step 6: Commit.** Message: `feat(model): fill or refuse district inputs; show AOE weighted ADM`.

### Task 3: Champlain Valley #56 fully blocked

**Files:** found in Step 1. The likely files are `site/src/scripts/adm-prefill.ts` (`planAdmPrefill`, `bandFill`) and `site/src/scripts/model-tool.ts`.

**Interfaces:**
- Produces: `export function blockedBandsText(plan: ReturnType<typeof planAdmPrefill>): string | null` in `adm-prefill.ts`. It returns null when no band is withheld.

- [ ] **Step 1: Find the cause** with superpowers:systematic-debugging. Load CVSD FY2026 and trace which node blocks first. The working hypothesis is that 2026 grade bands are withheld (prekindergarten and grades 6–8). Confirm or replace it before writing code.
- [ ] **Step 2: Write the failing test.** For the CVSD FY2026 prefill plan, `blockedBandsText` names every withheld band in plain words. It also says that the State hides small counts and that the range boxes under each band can be used. If Step 1 found a different cause, write the test for that cause instead, with the same rule: the screen says why.
- [ ] **Step 3: Run it.** Expected: FAIL.
- [ ] **Step 4: Implement it.** Render the text above the results when it is not null.
- [ ] **Step 5: Run it.** Expected: PASS. Run `npm test`.
- [ ] **Step 6: Commit.** Message: `fix(model): say why Champlain Valley #56 is blocked`.

---

## Track B — Resident pages

### Task 4: Replace "each town sets its own", and add glossary entries

**Files:**
- Create: `site/src/lib/rate-copy.ts`
- Test: `site/src/lib/rate-copy.test.ts`
- Modify:
  - `site/src/pages/my/district/[slug].astro:50`
  - `site/src/pages/my/union/[slug].astro:53`
  - `site/src/pages/my/grouping/[number].astro:69`
  - `site/src/pages/explanations/index.astro`: add sections with `id="cla"` and `id="property-tax-credit"`.

**Interfaces:**
- Produces: `export function groupRateReason(level: 'district' | 'union' | 'grouping'): string`, and `export const EXPLAIN = { cla: '/explanations/#cla', credit: '/explanations/#property-tax-credit' }` (prefix with `base` at the call site, the way the pages already link).

Exact copy:
- `district`: "Voters approve the district budget. The State turns that budget into a tax rate. Each town in the district gets a different final rate because of its common level of appraisal (CLA), which adjusts for how close the town's listed values are to market prices."
- `union`: "A supervisory union is a group of districts. It does not have its own tax rate. Each district's budget sets its rate."
- `grouping`: "A group is a plan for districts that may join. It does not have a tax rate yet."

The CLA entry on the explanations page needs at most four sentences in the same register. The credit entry says the homestead rate is before the property tax credit. Some households pay less based on income, and the credit is claimed with the Vermont income tax return. Do not give dollar thresholds.

- [ ] **Step 1: Write the failing test.** No reason contains "sets its own". The `district` reason contains "CLA" and "Voters approve". Each reason has no semicolon.
- [ ] **Step 2: Run it.** Command: `npx vitest run site/src/lib/rate-copy.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement it.** Add `rate-copy.ts`, use it in the three pages, link "common level of appraisal" to `EXPLAIN.cla` on the district page, and add the two explanations sections.
- [ ] **Step 4: Run it, then check the copy.** Run the test (expected: PASS). Then run `grep -rn "sets its own" site/src`. Expected: no matches.
- [ ] **Step 5: Commit.** Message: `fix(copy): say the rate comes from the district budget and the CLA`.

### Task 5: Unit and dollar line under every homestead rate

**Files:**
- Create: `site/src/lib/rate-format.ts`
- Test: `site/src/lib/rate-format.test.ts`
- Modify:
  - `site/src/components/JourneyStats.astro`: under the rate value.
  - `site/src/pages/my/district/[slug].astro`: the `rateRange` line.
  - Any other page that prints a homestead rate. Run `grep -rln "homestead_rate\|homesteadRate\|rate.value" site/src/pages site/src/components` and cover each hit.

**Interfaces:**
- Consumes: `EXPLAIN.credit` (Task 4).
- Produces:
  ```ts
  export const EXAMPLE_HOUSE = 250_000;
  export function rateUnitLine(ratePer100: number): string;
  export function rateRangeText(low: number, high: number): string;
  ```

Format, exactly:
- `rateUnitLine(1.2462)` returns "$1.2462 per $100 of value ($12.46 per $1,000). About $3,116 a year on a $250,000 house (an example). School tax only, before the property tax credit."
- Rules: per-$1,000 to cents; the example rounded to whole dollars with `en-US` grouping.
- The component wraps "before the property tax credit" in a link to `EXPLAIN.credit`. Build the sentence from parts, not by string replace.

- [ ] **Step 1: Write the failing tests**
  - The exact string above for 1.2462.
  - `rateUnitLine(1.8777)` contains "$18.78 per $1,000" and "About $4,694".
  - `rateRangeText(1.0207, 1.8777)` contains both per-$100 figures and both example dollars.
  - Review Focus #5: render `JourneyStats` with `rate.kind === 'blank'`, using whatever Astro component test pattern the repo already has (check `site/src/**/*.test.ts` for `experimental_AstroContainer`). Assert that no `$` and no "per $100" appear. If there is no component-test pattern, put the guard in a pure helper (`rateLines(rate: Figure<number>): string[]`, which returns `[]` for a blank) and test that.
- [ ] **Step 2: Run them.** Command: `npx vitest run site/src/lib/rate-format.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement it, and render it at every hit from the grep.**
- [ ] **Step 4: Run the tests and build the site.** Expected: PASS. Open `/my/town/milton/` in the browser pane and confirm the line.
- [ ] **Step 5: Commit.** Message: `feat(pages): unit, per-$1,000 and example bill under homestead rates`.

### Task 6: Source line under the headline rate on every town page

**Files:**
- Create:
  - `site/src/lib/sources.ts`
  - `site/src/components/SourceLine.astro`
- Test: `site/src/lib/sources.test.ts`
- Modify:
  - `site/src/pages/my/town/[slug].astro`: under `JourneyStats`.
  - `site/src/pages/town/[slug].astro`: wherever it shows a rate or the headline figure.

**Interfaces:**
- Produces:
  ```ts
  export interface Source { publisher: string; document: string; date: string; url: string }
  export const TAX_RATES_FY2026: Source;
  export function sourceText(s: Source): string; // "Source: {publisher}, “{document}”, {date}."
  ```
- `TAX_RATES_FY2026` is read from `intake/tax-rates/fy2026/provenance.yaml` at build time, not typed by hand: the publisher and document from the `note`, the date "August 18, 2025", and `url` set to the document page URL. If parsing the free-text `note` is brittle, add structured `publisher`, `title`, `published_date` and `document_page` keys to the provenance file, and read those.
- `SourceLine.astro` renders `sourceText` with the document title as a link to `url`.

- [ ] **Step 1: Write the failing test.** `TAX_RATES_FY2026.url` starts with `https://tax.vermont.gov/`, and `sourceText(TAX_RATES_FY2026)` contains "Vermont Department of Taxes" and "2025".
- [ ] **Step 2: Run it.** Command: `npx vitest run site/src/lib/sources.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement it, and place `SourceLine` on both town pages.**
- [ ] **Step 4: Run the tests and build.** Then check the built HTML: `grep -l "tax.vermont.gov" site/dist/my/town/milton/index.html site/dist/town/milton/index.html`. Expected: both files listed. Adjust the path to the repo's actual output directory.
- [ ] **Step 5: Commit.** Message: `feat(pages): source line under the town rate`.

### Task 7: Flag the eleven districts the engine cannot reproduce

**Files:**
- Create:
  - `site/src/lib/rate-residuals.ts`
  - `site/src/components/ResidualNote.astro`
- Test: `site/src/lib/rate-residuals.test.ts`
- Modify:
  - `site/src/pages/my/town/[slug].astro` and `site/src/pages/my/district/[slug].astro`: next to the rate.
  - `site/src/pages/town/[slug].astro`, if it shows the rate.

**Interfaces:**
- Produces:
  ```ts
  export const RATE_RESIDUALS: Readonly<Record<string /* registry slug */, string /* plain reason */>>;
  export function residualFor(districtSlug: string | null): string | null;
  ```
- The eleven are the rows of the table under "What the FY2026 table showed" in `docs/act-127-transition.md` (about line 137): Buels Gore, Norwich, Hartford, West River Modified Union Education District B, Mountain Views School District, North Country Sr UHSD, Canaan, Orleans Southwest UESD, Bellows Falls UHSD, Mt. Anthony UHSD, and Lamoille North MUSD B. Find each one's registry slug in `registry/entities/*.json`.
- Each reason is one 5th-grade sentence drawn from that row's "Why" column. Example for Norwich: "This page's math does not match the State's rate for Norwich. The State's rate is lower, likely because of a bond or other cost this site does not include yet."
- `ResidualNote.astro` shows the reason, then "The State's published rate is shown." and a link to `docs/act-127-transition.md` on GitHub. Use the repository URL already used elsewhere in the site, found with `grep -rn "github.com/jamesjnadeau" site/src`.

- [ ] **Step 1: Write the failing tests**
  - `RATE_RESIDUALS` has exactly 11 keys, and each one exists in the registry entities.
  - Drift guard: parse the markdown table in `docs/act-127-transition.md` at test time. Its row count equals 11.
  - Review Focus #4: `residualFor` returns a string for Norwich's district slug and for Hartford's, and `null` for `town/milton`.
- [ ] **Step 2: Run them.** Command: `npx vitest run site/src/lib/rate-residuals.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement it, and render it.** On a town page, look up the town's `districtSlug` (from `TownPage`) and also the town's own slug, because town districts such as Norwich are their own district.
- [ ] **Step 4: Run the tests and build.** Expected: PASS. In the browser pane, `/my/town/norwich/` shows the note, the unit line and the source line together.
- [ ] **Step 5: Commit.** Message: `feat(pages): flag rates the engine does not reproduce`.

---

## Track C — Registry errors and copy

### Task 8: Keep every blank inside the four-blank taxonomy

**Files:**
- Modify:
  - `site/src/pages/town/[slug].astro:125,170`
  - `site/src/pages/su/[slug].astro:244,297`
  - `site/src/pages/my/town/[slug].astro` (about line 149, "No group yet")
  - `site/src/pages/admin/coverage.astro:93`
- Test: `site/src/lib/blank-copy.test.ts`, a source scan.

Changes:
- "not usable" with class `not-computable`, where the cause is `not_published`: change the text to "not published" and the class to `not-published`. Add a `.tag.not-published` style if none exists, matching the other tags.
- "No group yet for your district": replace it with a `missing_input` statement that names who holds the answer. "The State has not placed {district} in a group yet. The State Board of Education decides the groups under Act 73 of 2025." Check `registry/groupings.yaml`'s header for the right body and act. If it names someone else, use that.
- "send in" on coverage: change it to "we have not collected it yet".

- [ ] **Step 1: Write the failing test.** Scan `site/src/pages/**/*.astro`. Assert that none contains `not usable`, `No group yet`, or `>send in<`.
- [ ] **Step 2: Run it.** Command: `npx vitest run site/src/lib/blank-copy.test.ts`. Expected: FAIL, listing the four files.
- [ ] **Step 3: Make the copy changes.**
- [ ] **Step 4: Run it.** Expected: PASS. Then run `npm test`.
- [ ] **Step 5: Commit.** Message: `fix(copy): keep blanks inside the four kinds`.

### Task 9: Registry errors visible to readers

**Files:**
- Modify:
  - `site/src/lib/display.ts`: `KEEP_UPPER`, and a new helper.
  - `site/src/pages/town/[slug].astro`: `getStaticPaths`.
  - `site/src/pages/su/[slug].astro:479,519,528`
  - Any page that lists towns from `registry/entities/town.json`. Find them with `grep -rln "type === 'town'" site/src/pages`.
- Test: `site/src/lib/display.test.ts`. Create it if it does not exist.

**Interfaces:**
- Produces:
  ```ts
  export function isOutOfState(e: { name: string }): boolean; // name ends in " NH", " NY" or " MA"
  export function entityLabel(slug: string | null, entities: { slug: string; name: string }[]): string;
  ```
  `entityLabel` returns the title-cased name, or "not listed" when the slug is null or unknown. It never returns the raw id.

Changes:
- **Orford NH:** no town page. Filter `isOutOfState` in `getStaticPaths` and in every town list.
- **The Orford school under SAU 70:** keep it, because it is part of the interstate union. Add "(New Hampshire school)" after its name when its SU is `su/school-administrative-unit-70` and the school has no Vermont member town. Its operator cell uses `entityLabel`.
- **Operator columns** (`su/[slug].astro:519` and any other `<code>{…operated_by…}</code>`): use `entityLabel` and link to the operator's page when one exists.
- **"Member districts (0)":** when the count is 0, render "This supervisory union has no member districts on file." instead of the heading and the empty list.
- **Windham Southeast, 4 against 5:** first confirm the cause. `ud/windham-southeast-96` lists 4 member towns. The SU page counts the SU's towns, probably 5 including Vernon. If so, the numbers are both correct but unlabelled. Change the headings to "Towns in the supervisory union ({n})" and, on district listings, "Towns in this district ({n})". If the cause is different, fix that cause instead, and say so in the commit.
- **Title-case:** add `'nh'` and `'id'` to `KEEP_UPPER`. "ORFORD NH" becomes "Orford NH", and "BARTON ID" becomes "Barton ID".

- [ ] **Step 1: Write the failing tests**
  - `titleCase('ORFORD NH') === 'Orford NH'`
  - `titleCase('BARTON ID') === 'Barton ID'`
  - `titleCase('Barton Id') === 'Barton Id'`: a name that is not shouting is left alone. This is the existing rule, and the test pins it.
  - `isOutOfState({ name: 'ORFORD NH' })` is true, and `isOutOfState({ name: 'NORWICH' })` is false.
  - `entityLabel('town/milton', [{ slug: 'town/milton', name: 'MILTON' }]) === 'Milton'`
  - `entityLabel(null, []) === 'not listed'`
  - `entityLabel('ud/nope', []) === 'not listed'`
- [ ] **Step 2: Run them.** Command: `npx vitest run site/src/lib/display.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement the helpers, and apply them to the pages listed.**
- [ ] **Step 4: Run the tests, build, and check.**
  - `ls site/dist/town/ | grep -i orford`: expect nothing.
  - `grep -rl "town/milton</code>" site/dist`: expect nothing.
  - Open the Windham Southeast SU page in the browser pane and confirm the counts match their labels.
- [ ] **Step 5: Commit.** Message: `fix(registry pages): out-of-state towns, operator names, member counts, casing`.

### Task 10: Correct the methodology "could not be reached" text

**Files:** Modify `site/src/pages/methodology/index.astro:185-191`.

The paragraph says the official sources "could not be reached". That is no longer true: `model/statute/` holds verbatim statute text fetched from the Legislature. Replace the paragraph with: "No number below has been checked against the law by a person yet, so the engine won't do any math with them. The law's text is saved in this project. A person still has to read it and sign off each number. Vermont's school funding laws were changed by Act 127 of 2022 and Act 73 of 2025, so a number from memory is very likely out of date."

- [ ] **Step 1: Make the edit.** Run `grep -rn "could not be reached" site/src`. Expected: no matches.
- [ ] **Step 2: Build.** Run `npm run build` in `site/`. Expected: success.
- [ ] **Step 3: Commit.** Message: `fix(copy): methodology no longer says sources were unreachable`.

---

## Not code

### Task 11: FY2026 parameter sign-off (human only)

A person, not an agent, does this. Per [`docs/parameter-verification.md`](../../parameter-verification.md):

- [ ] Read 16 V.S.A. § 4010(d) and the yield act against `model/parameters/fy2026.yaml`.
- [ ] Countersign it with a name and date in the format that document prescribes.
- [ ] Run `npm run validate`. Expected: the parameters now count as verified, and the `/methodology/` "unchecked" notice from Task 10 disappears on its own.

An agent may prepare a side-by-side worksheet of each parameter and its statute line, from `model/statute/`, to speed this up. It must not write the sign-off.

### Task 12: Phone layout check

**Files:** CSS fixes as found, most likely in `site/src/layouts/` and the components touched above.

- [ ] **Step 1: Preview at phone width.** Start the site in the browser pane (`preview_start`) and set the viewport with `resize_window` preset `mobile` (375×812).
- [ ] **Step 2: Check each page for horizontal scroll and cut-off text.** Pages: `/`, `/my/town/milton/`, `/my/town/hinesburg/`, `/my/district/<cvsd slug>/`, `/town/milton/`, the Windham Southeast SU page, `/model/` and `/explanations/`. Use `document.documentElement.scrollWidth > innerWidth` to detect horizontal scroll, and take a screenshot of each page.
- [ ] **Step 3: Fix each overflow.** Wide tables get an `overflow-x: auto` wrapper, not a smaller font.
- [ ] **Step 4: Re-check every page.** Expected: no horizontal scroll on any of them.
- [ ] **Step 5: Commit.** Message: `fix(layout): phone width`. Attach the before and after screenshots to the PR description.

---

## Finish

- [ ] Run `npm test` and `npm run validate`. Expected: both pass.
- [ ] Tick each closed item in `docs/release-readiness.md`. Leave the sign-off item open until Task 11 is done.
- [ ] Use superpowers:finishing-a-development-branch.
