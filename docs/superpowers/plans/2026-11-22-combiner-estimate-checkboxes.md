# Combiner Estimate Checkboxes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Use estimate" checkboxes to the combiner's "students from lower-income homes" and "English learners" boxes, filled with a labeled lower-limit sum of AOE's SY25 town-level counts.

**Architecture:** The build adds each town's SY25 `ell` and `nslelg` cells to `combiner.json` (`CombinerTown`). The browser sums the picked districts' member towns (like `combinedDensity`) in a pure, tested function, writes the sum into the box, and shows a note. Estimate flags ride in the share link and mark the engine's assumption text.

**Tech Stack:** TypeScript, Astro, vitest. Build: `tools/src/cli/build-data.ts`. Engine: `model/src/combine.ts`.

**Spec:** `docs/superpowers/specs/2026-11-22-combiner-estimates-design.md`

## Global Constraints

- Source year: SY25, `fiscal_year` 2026, `preliminary: false`. Never SY26 or SY24.
- Poverty box ← `nslelg`; EL box ← `ell`. State-placed box unchanged: no checkbox, no estimate.
- Filled value = sum of published cells only (lower limit). Bounded withheld cell adds 0–10 to the upper bound; complement-suppressed or missing town → no upper bound.
- Typing in a box unticks its checkbox. Result label: "lower limit estimate" if anything was withheld, else "estimate".
- Share params: `poverty_est=1`, `el_est=1`. Unknown params stay ignored; blank fields stay out of the URL.
- Notes say FRL is not the 185%-of-poverty count and that counts are students resident in the towns.
- No change to how `model/src/combine.ts` sums published district counts.

## Review Focus

- Every picked town fully withheld: box gets 0 with note "at least 0" (not blank, not NaN).
- Town with `not_applicable` row: `no_resident_students` counts as 0; `entity_closed` or no record is named as missing, no upper bound.
- Picked set includes a town absent from the data: named in the note, sum still shown as lower limit.
- Visitor types over a ticked box: unticks, value kept, share link no longer carries the flag.
- Link carries `poverty_est=1` but the picks changed/data missing: box refills from current data or stays blank with the note, never keeps a stale number.

## File Structure

- Modify `tools/src/combiner-data.ts`: `CombinerTown` gains `ell_sy25`, `frl_sy25`; `CombinerInputs` gains `subgroupTowns`.
- Modify `tools/src/cli/build-data.ts`: `subgroupTownsForCombiner()` from `subgroupPublication`.
- Modify `site/src/scripts/combiner-view.ts`: mirror types; `combinedSubgroupEstimate`, `subgroupEstimateText`.
- Modify `site/src/scripts/combiner-share.ts`: estimate flags.
- Modify `site/src/scripts/combiner-tool.ts`, `site/src/pages/combiner/index.astro`: UI.
- Modify `model/src/combine.ts`: estimated-count assumption wording.
- Tests: `tools/src/combiner-data.test.ts`, `site/src/scripts/combiner-view.test.ts`, `site/src/scripts/combiner-share.test.ts`, `model/src/combine.test.ts`.

---

### Task 1: Town ELL/FRL cells in the generated combiner data

**Files:**
- Modify: `tools/src/combiner-data.ts` (`CombinerInputs`, `CombinerTown`, town construction ~276-293; update the comment at ~252-257 that says the counts are not published because they are by town and mostly suppressed)
- Modify: `tools/src/cli/build-data.ts` (import ~34, helper near `censusTownsForCombiner` ~57, call ~295-308)
- Test: `tools/src/combiner-data.test.ts`

**Interfaces:**
- Produces: `export type TownCount = PublishedCell | null` (import `PublishedCell` from `./aoe/adm-subgroups/publish.ts`); `CombinerTown.ell_sy25: TownCount`, `CombinerTown.frl_sy25: TownCount`; `CombinerInputs.subgroupTowns?: ReadonlyArray<{ slug: string; ell: PublishedCell; nslelg: PublishedCell } | { slug: string; absent: 'no_resident_students' | 'entity_closed' }>`.
- Mapping: published/below-floor row → its cells; `no_resident_students` → `{ value: 0 }` for both; `entity_closed` or town missing from `subgroupTowns` → `null`.

- [ ] **Step 1: Write failing tests** in `combiner-data.test.ts`: (a) a town with `ell: {value: 12}`, `nslelg: {status:'suppressed', low:1, high:10}` yields `ell_sy25 = {value:12}` and `frl_sy25` the suppressed cell; (b) `no_resident_students` → both `{value: 0}`; (c) `entity_closed` and a town absent from `subgroupTowns` → `null`; (d) with `subgroupTowns` omitted, every town has both fields `null`.
- [ ] **Step 2: Run** `npx vitest run tools/src/combiner-data.test.ts` — expect FAIL (fields undefined).
- [ ] **Step 3: Implement** the types and mapping in `combiner-data.ts`; fix the stale comment to say the district counts stay null and the town counts are carried for the page's estimate.
- [ ] **Step 4: Implement `subgroupTownsForCombiner(publication: SubgroupPublication)` in `build-data.ts`**: for each town slug, take the `PublishedTownYear` for the year whose `fiscal_year === 2026` (look up its `school_year` in `publication.years`); map per the rule above. Pass it in the `buildCombinerData` call. Move the `buildSubgroupPublication` call ahead of the combiner write if it currently comes after.
- [ ] **Step 5: Run** `npx vitest run tools/src/combiner-data.test.ts` — PASS; run `npm run build-data` (check `package.json` for the exact script) and confirm `site/src/generated/combiner.json` has `ell_sy25`/`frl_sy25` on towns and no SY26 values (spot-check one town against `warehouse/aoe-adm-subgroups/town-sy25.yaml`).
- [ ] **Step 6: Commit** `git add tools site/src/generated && git commit -m "Combiner data: carry each town's SY25 ELL and FRL cells"`

### Task 2: Summing the picked towns, and the note

**Files:**
- Modify: `site/src/scripts/combiner-view.ts` (mirror `TownCount` on the browser `CombinerTown` ~75-86; add functions next to `combinedDensity`)
- Test: `site/src/scripts/combiner-view.test.ts`

**Interfaces:**
- Consumes: `CombinerData` towns with `ell_sy25`/`frl_sy25` (Task 1).
- Produces:
  - `export interface SubgroupEstimate { sum: number; towns: number; withheld: string[]; missing: string[]; upperBound: number | null }`
  - `export function combinedSubgroupEstimate(slugs: readonly string[], data: CombinerData, kind: 'ell' | 'frl'): SubgroupEstimate | null` — union of member towns (same union logic as `combinedDensity`); `sum` = published cells; `withheld` = town names whose cell is suppressed (sorted); `missing` = town names with a `null` cell or absent from data; `upperBound` = `sum + 10 * (bounded withheld)` using each cell's `high` (use `high` when present, else 10), or `null` if any cell is complement-suppressed (no `high`) or any town is missing. Returns `null` only when `slugs` yields no towns.
  - `export function subgroupEstimateText(e: SubgroupEstimate | null, kind: 'ell' | 'frl'): string`

- [ ] **Step 1: Write failing tests**: all published (sum, no withheld, `upperBound === sum`); two bounded withheld towns of 0–10 → `upperBound === sum + 20`; one complement-suppressed → `upperBound === null`; all withheld → `sum === 0`, text starts "at least 0"; missing town named in `missing` and `upperBound === null`; shared town across two picked districts counted once; text for `frl` contains "not the same as" the 185 percent poverty count and "live in" (residency caveat); text for `ell` omits the FRL caveat; text with nothing withheld contains no "at least".
- [ ] **Step 2: Run** `npx vitest run site/src/scripts/combiner-view.test.ts` — FAIL.
- [ ] **Step 3: Implement** both functions; pure, no DOM. Text rules: nothing withheld → "Estimate: N, the sum of AOE’s published counts for the towns."; withheld → "Lower limit estimate: at least N[, up to M] — K town(s) withheld small counts (names)." plus "No upper limit can be given" when `upperBound` is null; always the caveats from Global Constraints.
- [ ] **Step 4: Run tests** — PASS.
- [ ] **Step 5: Commit** `git commit -am "Combiner: sum town ELL/FRL counts as a lower-limit estimate"`

### Task 3: Share link carries the estimate flags

**Files:**
- Modify: `site/src/scripts/combiner-share.ts` (`CombinerShareState`, `CombinerShareInput`, `TextField`, encode/decode, notes builder)
- Test: `site/src/scripts/combiner-share.test.ts`

**Interfaces:**
- Produces: `CombinerShareState.povertyEstimate: boolean` and `elEstimate: boolean` (default `false`), excluded from `TextField`; encoded as `poverty_est=1` / `el_est=1` only when true; decoded true only for exactly `1`. Notes builder adds a line saying poverty/EL were "filled from AOE town-level counts as an estimate" when set, and does not list them under "entered by the sharer".

- [ ] **Step 1: Write failing tests**: round-trip with both flags; flag false/absent → param absent; `poverty_est=2` decodes false; existing links (no flag params) decode unchanged; notes line present only when a flag is set.
- [ ] **Step 2: Run** `npx vitest run site/src/scripts/combiner-share.test.ts` — FAIL.
- [ ] **Step 3: Implement.** Update every constructor of `CombinerShareState` (`readState` in combiner-tool.ts, test fixtures) with the two new fields.
- [ ] **Step 4: Run tests** — PASS; run `npx tsc --noEmit -p site` (or the project's typecheck script) to catch fixtures.
- [ ] **Step 5: Commit** `git commit -am "Combiner share link: carry the estimate flags"`

### Task 4: Engine labels estimated counts

**Files:**
- Modify: `model/src/combine.ts` (`CombinerOptions` ~line 64; assumption/`enteredCounts` logic ~163-200; the summary at ~602)
- Test: `model/src/combine.test.ts`

**Interfaces:**
- Produces: `CombinerOptions.pooled_inputs_estimated?: Partial<Record<'poverty_185_fpl' | 'english_learners', boolean>>`. For a count that is entered (not published by every member) and flagged, the `pooled_inputs.<key>` assumption rationale reads "estimated from AOE town-level counts (a lower limit where counts were withheld), not a published district figure" instead of "entered on this page, not published", and the `enteredCounts` summary says "estimated" for it. Unflagged behavior is unchanged. A flag on a count every member published is ignored.

- [ ] **Step 1: Write failing tests**: flagged poverty → assumption text contains "estimated from AOE town-level counts" and not "entered on this page"; unflagged → existing text (assert exact old string); flag ignored when every member has the count; EL and poverty flagged independently.
- [ ] **Step 2: Run** `npx vitest run model/src/combine.test.ts` — FAIL.
- [ ] **Step 3: Implement** in `runCombiner` (read the existing assumption code first; change only the wording branch).
- [ ] **Step 4: Run** the full model tests — PASS.
- [ ] **Step 5: Commit** `git commit -am "Combiner engine: say when a pooled count is an estimate"`

### Task 5: Checkboxes on the page

**Files:**
- Modify: `site/src/pages/combiner/index.astro` (fieldset ~125-185; intro copy ~40-58)
- Modify: `site/src/scripts/combiner-tool.ts` (`TEXT_INPUTS` ~62; density wiring ~309-330 as the pattern; `readState`/`applyState` ~362-396)
- Modify: `site/src/scripts/combiner-view.ts` `planCombiner` (pass `pooled_inputs_estimated` from the share state flags)
- Test: `site/src/scripts/combiner-view.test.ts` (planCombiner), manual browser check

**Interfaces:**
- Consumes: `combinedSubgroupEstimate`, `subgroupEstimateText` (Task 2); `povertyEstimate`/`elEstimate` (Task 3); `pooled_inputs_estimated` (Task 4).

- [ ] **Step 1: Write failing tests** for `planCombiner`: state with `povertyEstimate: true` and a poverty value → `options.pooled_inputs_estimated.poverty_185_fpl === true`; flags false → absent or false; state-placed never flagged.
- [ ] **Step 2: Run** — FAIL; implement the pass-through in `planCombiner`; run — PASS.
- [ ] **Step 3: Markup.** In `index.astro`, under each of `combiner-poverty` and `combiner-el` add `<label class="use-suggestion"><input type="checkbox" id="combiner-poverty-use" /> <span>Use estimate</span></label>` (ids `combiner-el-use` for EL) and `<small id="combiner-poverty-note"></small>` / `combiner-el-note`, matching the what-if markup/classes in `model/index.astro`. Update intro copy: the page fills in two figures as labeled estimates (lower-income, English learners) and will not fill in state-placed; typed values are the visitor's own.
- [ ] **Step 4: Wire in `combiner-tool.ts`**: `renderSubgroupEstimates()` called from `update()`: compute both estimates; set each note text; if the box is ticked, set the input value to `String(estimate.sum)` (or `''` when estimate is `null`); input `input` listener unticks and calls `update()`. Ticking triggers `update()`. `readState` reads the checkboxes into `povertyEstimate`/`elEstimate`; `applyState` ticks them before `update()` so the link refills from current data. Fire the same analytics capture as `estimate_suggestion_toggled` with the field id.
- [ ] **Step 5: Verify in the browser** (preview_start the site's dev server; page `/combiner/`): pick two districts, tick both boxes → values and notes appear, results say estimate in assumptions; type over one → unticks; copy share link, open it → ticked and refilled; a district set with a withheld town shows "at least … up to …"; state-placed box unchanged. Check console is clean.
- [ ] **Step 6: Run** the full suite (`npx vitest run` at repo root) and the site build — PASS.
- [ ] **Step 7: Commit** `git commit -am "Combiner page: use-estimate checkboxes for lower-income and English-learner counts"`
