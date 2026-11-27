# My Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/my/` section that walks a resident from their town, to their school district (if it covers several towns), to their supervisory union, to their grouping, showing homestead rate, students and people with scale visuals; picking a town sends one PostHog event and sets a cookie.

**Architecture:** Pure, unit-tested TypeScript in `site/src/lib/` turns the existing generated JSON (`registry.json`, `combiner.json`, `adm-subgroups.json`, `groupings.json`) into a per-place model at build time. Static Astro pages under `site/src/pages/my/` render that model. One small client script handles the picker, cookie and PostHog event. No new data pipeline.

**Tech Stack:** Astro (static, `trailingSlash: 'always'`), TypeScript, Vitest (`npm test`), existing `Base.astro` layout and PostHog snippet.

**Spec:** `docs/superpowers/specs/2026-11-24-my-journey-design.md` (read it first; the plan argues from it).

## Global Constraints

- Static site, no server. Data is imported at build time from `site/src/generated/*.json` (run `npm run build:data` to create them; they are git-ignored).
- All public copy at a ~5th-grade reading level (`AGENT.md`); gloss *supervisory union*, *ADM* ("students counted by the state"), *homestead rate* on first use on a page.
- No scoring, ranking, "good/bad" or recommendation. Scale wording is neutral and symmetric ("higher than 38 of 100 towns" / "lower than 62 of 100 towns").
- Never show a number for a null/unverified/withheld input. Use the repo's blank kinds (`missing_input`, `unverified`, `undetermined`, `not_computable`) with a plain reason.
- PostHog: one event, name `town_selected`, properties exactly `{ town: <slug>, source: 'picker' }`. Sent only on an active pick on `/my/`. Never sent on auto-redirect. No `identify()`. Call as `window.posthog?.capture(...)` (absent in dev/preview).
- Cookie: name `my_town`, value is the town slug (e.g. `town/addison` stored as `addison`), `Path=/`, `Max-Age=31536000`, `SameSite=Lax`, `Secure` on https. No consent banner.
- Grouping = facilitators' committee number (`publishedCommittees` in `site/src/lib/groupings.ts`), plus the Act 170 group the district started in. Say the committee list is preliminary.
- Rate figures: FY2026 published homestead rate (`combiner.json` `towns[slug].published_homestead_rate`). Students: SY25 (fiscal year 2026) town-of-residence ADM, sum of the four grade bands, from `adm-subgroups.json`. People: 2020 Census (`population_2020`). Label each with its own year.
- Union/district/grouping rate is a **range** (lowest to highest member-town rate) with the resident's town marked, never an average.
- Closed towns (`effective_to` set, e.g. `town/underhill-id`) and `reporting_only` towns get no page and are not in the picker.
- Commit as the repo's configured identity; one commit per task; run `npm test` before each commit.

## Review Focus

- A town with a null published rate (2 towns) or null population (6 towns): shows a plain blank with its reason, never 0, and is left out of scale comparisons; the page says how many towns each comparison covers.
- A town whose students are hidden or partly hidden (`sumCells` returns `range` / `not_usable`): shows the range or "at least" wording and is excluded from percentile/dot comparisons.
- A town whose district is in no committee, and a union whose districts sit in different committees: grouping step shows a reason / the union page lists the split.
- Cookie holds a slug that no longer exists or is garbage: ignored, picker shown, no redirect, no error.
- `?change=1` on `/my/` never redirects; visiting with JavaScript off shows a working list of plain links to all towns.
- Site served under a non-root `BASE_URL`: every link and the cookie redirect honor it.

---

### Task 1: Scale maths

**Files:**
- Create: `site/src/lib/journey-scale.ts`
- Test: `site/src/lib/journey-scale.test.ts`

**Interfaces:**
- Produces:
  - `percentileOf(value: number, all: ReadonlyArray<number>): { lower: number; of: number }` — `lower` = count of values strictly below `value`; `of` = `all.length`.
  - `percentileWords(p: { lower: number; of: number }, noun: string): string` — e.g. `"higher than 38 of 100 towns"` / `"lower than 62 of 100 towns"` / `"the same as every other town"` when all equal; picks the direction with the larger count, ties use "higher than".
  - `shareOf(part: number, whole: number): number | null` — fraction 0–1, null when `whole <= 0`.
  - `percentText(f: number): string` — whole-percent string; `"less than 1%"` for 0 < f < 0.005.

- [ ] **Step 1: Write failing tests** covering: `percentileOf(5,[1,5,9,5]) → {lower:1,of:4}`; `percentileWords({lower:38,of:100},'towns') === 'higher than 38 of 100 towns'`; `{lower:0,of:100}` → `'lower than 99 of 100 towns'` (the 99 others); all-equal list → the "same as" wording; `shareOf(1,0) === null`; `percentText(0.001) === 'less than 1%'`, `percentText(0.084) === '8%'`.
- [ ] **Step 2: Run** `npx vitest run site/src/lib/journey-scale.test.ts` — expect FAIL (module missing).
- [ ] **Step 3: Implement** the four functions above in `journey-scale.ts`. Pure; no imports.
- [ ] **Step 4: Run** the same command — expect PASS.
- [ ] **Step 5: Commit** `git add site/src/lib/journey-scale* && git commit -m "journey: scale maths"`.

---

### Task 2: Cookie and picker helpers

**Files:**
- Create: `site/src/lib/journey-cookie.ts`
- Test: `site/src/lib/journey-cookie.test.ts`

**Interfaces:**
- Produces:
  - `COOKIE_NAME = 'my_town'`
  - `serializeTownCookie(slug: string, secure: boolean): string` — full `Set-Cookie`-style string for `document.cookie` with the attributes in Global Constraints.
  - `readTownCookie(cookieHeader: string, validSlugs: ReadonlySet<string>): string | null` — returns the slug only if present and in `validSlugs`; otherwise null.
  - `clearTownCookie(secure: boolean): string` — same cookie with `Max-Age=0`.
  - `shouldRedirect(search: string, remembered: string | null): boolean` — false when `search` contains `change=1`, false when `remembered` is null.

- [ ] **Step 1: Write failing tests**: serialize contains `my_town=addison`, `Path=/`, `Max-Age=31536000`, `SameSite=Lax`, and `Secure` only when `secure`; `readTownCookie('a=b; my_town=addison', new Set(['addison'])) === 'addison'`; unknown value → null; garbage like `my_town=%E0%A4%A` → null (no throw); `shouldRedirect('?change=1','addison') === false`; `shouldRedirect('', null) === false`; `shouldRedirect('', 'addison') === true`.
- [ ] **Step 2: Run** `npx vitest run site/src/lib/journey-cookie.test.ts` — FAIL.
- [ ] **Step 3: Implement** the functions. Use `encodeURIComponent`/`decodeURIComponent` inside a try/catch.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `journey: cookie helpers`.

---

### Task 3: The journey model

**Files:**
- Create: `site/src/lib/journey.ts`
- Test: `site/src/lib/journey.test.ts`

**Interfaces:**
- Consumes: `sumCells`, `Sum`, `Cell`, `TownYear` from `site/src/lib/residents.ts`; `publishedCommittees`, `committeeOf`, `committeeMoves` from `site/src/lib/groupings.ts`; Task 1 functions; `slugTail` from `site/src/lib/display.ts`.
- Produces (all in `journey.ts`):
  - `type Figure<T> = { kind: 'value'; value: T } | { kind: 'blank'; why: 'missing_input' | 'unverified' | 'undetermined' | 'not_computable'; reason: string }`
  - `type Students = { sum: Sum }` (from `sumCells` over a place's four band cells for SY25).
  - `interface JourneyInputs { registry: Entity[]; combiner: CombinerJson; subgroups: SubgroupsJson; groupings: GroupingsJson }` (type the three JSON shapes narrowly with only the fields used).
  - `interface Step { id: 'town'|'district'|'union'|'grouping'; href: string; label: string }`
  - `interface TownPage { slug: string; name: string; rate: Figure<number>; rateScale: Figure<{ lower: number; of: number }>; students: Students; studentsScale: Figure<{ lower: number; of: number }>; people: Figure<number>; peopleScale: Figure<{ lower: number; of: number }>; shares: { district?: Share; union?: Share; grouping?: Share }; steps: Step[]; next: Step | null; unionSlug: string | null; districtSlug: string | null; committeeNumber: number | null }` where `type Share = { students: Figure<number>; people: Figure<number> }` is this town's fraction (0–1) of that level's total; students share is blank when either the town's or the level's sum is not `exact`.
  - `interface GroupPage { kind: 'district'|'union'|'grouping'; slug: string; name: string; members: { town: string; name: string }[]; rateRange: Figure<{ low: number; high: number; covers: number; of: number }>; students: Students; people: Figure<number>; split?: { number: number; towns: string[] }[]; actGroup?: { number: number; moved: boolean }; steps: Step[]; next: Step | null }` — group pages are shared by many residents, so they carry totals only; "your share" lives on `TownPage.shares`. `steps`/`next` on a group page are the chain from that level onward.
  - `buildJourney(inputs: JourneyInputs): { towns: Record<string, TownPage>; districts: Record<string, GroupPage>; unions: Record<string, GroupPage>; groupings: Record<number, GroupPage>; townList: { slug: string; name: string }[] }`
- Keys: town pages keyed by slug tail (`addison`); district/union by slug tail; groupings by committee number. A town's own district is its registry `operated_by`; if null, the town is its own one-town district and has **no** district step. A district page exists only when its member list has more than one non-closed town. A town's grouping follows its own district (or itself when it has none).

- [ ] **Step 1: Write failing tests** using a small hand-made `JourneyInputs` fixture (3 towns in one district in one union, 1 town alone, 1 town with null rate, 1 town with null population, 1 town with a hidden-ADM band, 1 closed town, one committee holding the district, one town in no committee). Assert, with the fixture's exact numbers:
  - closed town is absent from `towns` and `townList`;
  - `towns.alone.steps.map(s=>s.id)` equals `['town','union','grouping']` and `towns.shared.steps` equals `['town','district','union','grouping']`;
  - null-rate town → `rate` is `{kind:'blank', why:'missing_input'}`, excluded from `rateScale.of` of the others (`of` equals the number of towns with a rate);
  - hidden-ADM town → `students.sum.kind === 'range'` and `studentsScale` is blank; the others' `studentsScale.of` excludes it;
  - district `rateRange` low/high equal the min/max member-town rate and `covers`/`of` count towns with a rate vs all members;
  - town in no committee → `committeeNumber === null`, its `steps` omit `grouping`, `next` after union is null;
  - a union whose districts sit in two committees → union page `split` has two entries; a town's own grouping follows its own district.
- [ ] **Step 2: Run** `npx vitest run site/src/lib/journey.test.ts` — FAIL.
- [ ] **Step 3: Implement** `buildJourney`. Student cells for a town are `subgroups.towns[slug]['SY25']` bands (`prekindergarten`, `kindergarten_through_5`, `grades_6_through_8`, `grades_9_through_12`); a `row: 'not_applicable'` town gets blank `not_computable`. Percentile pools include only towns whose `sum.kind === 'exact'` / non-null rate / non-null population. Grouping membership via `committeeOf(publishedCommittees(groupings.reassignment), districtSlugOrTownSlug)`; `actGroup` from `groupings.groupings` (the Act 170 list) containing the same slug; `moved` from `committeeMoves`.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Add an integration test** `journey.real.test.ts` that skips (`it.skipIf`) when `site/src/generated/combiner.json` is missing, otherwise loads the real JSON and asserts: `Object.keys(towns).length` equals the count of non-closed, non-`reporting_only` registry towns; every town page has a non-empty `steps`; no `Figure` of kind `value` holds `NaN`/`null`.
- [ ] **Step 6: Run** `npm run build:data && npm test` — PASS.
- [ ] **Step 7: Commit** `journey: build the per-place model`.

---

### Task 4: Shared display components

**Files:**
- Create: `site/src/components/JourneyStats.astro`, `site/src/components/DotGrid.astro`, `site/src/components/ScaleBar.astro`, `site/src/components/JourneyProgress.astro`
- Modify: `site/src/styles/global.css` (append `.journey-*` rules; reuse existing tokens)

**Interfaces:**
- Consumes: `Figure`, `Step`, `Students` from Task 3; `count`, `bound` from `residents.ts`.
- Produces components with these props:
  - `JourneyStats`: `{ rate: Figure<...>; students: Students; people: Figure<number>; rateLabel: string; studentsLabel: string; peopleLabel: string }` — three cards. A blank renders its `reason` and a status tag (reuse `.tag` classes from the town page); a `range` students sum renders `bound`-style text ("at least N" / "N to M"), never one number.
  - `DotGrid`: `{ total: number; mineIndex: number | null; caption: string }` — one dot per town, the resident's highlighted; `aria-label` states the same thing in words.
  - `ScaleBar`: `{ fraction: number; caption: string }` — a filled bar with the caption as visible text.
  - `JourneyProgress`: `{ steps: Step[]; current: Step['id'] }` — ordered list, current step marked `aria-current="step"`.
- [ ] **Step 1:** Build the four components and CSS; every visual has the same information as visible or `aria-label` text (no meaning in color alone).
- [ ] **Step 2:** `npm run build:data && npm run build:site` — build succeeds. `npx astro check --root site` (the repo's `astro-check` CI step) — 0 errors.
- [ ] **Step 3: Commit** `journey: shared components`.

---

### Task 5: Picker page, cookie and PostHog event

**Files:**
- Create: `site/src/pages/my/index.astro`, `site/src/scripts/my-picker.ts`
- Test: extend `site/src/lib/journey-cookie.test.ts` only if helpers change; add `site/src/lib/journey-event.test.ts`

**Interfaces:**
- Consumes: `townList` (Task 3), cookie helpers (Task 2).
- Produces: `buildTownSelected(slug: string): { event: 'town_selected'; properties: { town: string; source: 'picker' } }` exported from `site/src/lib/journey-event.ts`; `my-picker.ts` calls it and `window.posthog?.capture(event, properties)`.

- [ ] **Step 1: Write failing test** `journey-event.test.ts`: `buildTownSelected('addison')` deep-equals `{ event:'town_selected', properties:{ town:'addison', source:'picker' } }`.
- [ ] **Step 2: Run** `npx vitest run site/src/lib/journey-event.test.ts` — FAIL.
- [ ] **Step 3: Implement** `journey-event.ts`.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Build `/my/`:** a `<select>` plus a "Show me" button, and below it the full list of towns as plain `<a>` links (works with JS off). `my-picker.ts` (loaded by a plain `<script>` tag in the page so Astro bundles it): on page load, if `shouldRedirect(location.search, readTownCookie(document.cookie, validSlugs))` then `location.replace` to the town page (use `import.meta.env.BASE_URL`); on select/submit, set the cookie, send the event, then navigate. "Not your town?" links (on town pages, Task 6) go to `/my/?change=1`. Add a one-paragraph plain note on the page: the site saves your town's name in a cookie on your device, only so it can take you back there.
- [ ] **Step 6: Verify** `npm run build:data && npm run build:site`, then `npm run dev` and in a browser check: picking a town sets `my_town`, reload of `/my/` redirects, `/my/?change=1` does not, a bad cookie value shows the picker with no error. Confirm with `window.posthog = { capture: (...a) => console.log(a) }` set before the pick that exactly one `town_selected` call happens on a pick and none on a redirect.
- [ ] **Step 7: Commit** `journey: town picker, cookie, town_selected event`.

---

### Task 6: Town, district, union and grouping pages

**Files:**
- Create: `site/src/pages/my/town/[slug].astro`, `site/src/pages/my/district/[slug].astro`, `site/src/pages/my/union/[slug].astro`, `site/src/pages/my/grouping/[number].astro`
- Test: `site/src/lib/journey.real.test.ts` (extend with page-count assertions)

**Interfaces:**
- Consumes: `buildJourney` output, components from Task 4. Each page's `getStaticPaths` lists keys of the matching record and passes the page object as props.

- [ ] **Step 1: Town page:** title "Your town: {Name}"; `JourneyStats`; a `DotGrid` for rate (total = `rateScale.of`, mine = the town's rank position) and students/people `ScaleBar` + `percentileWords`; `JourneyProgress`; a "Next" link to `page.next`; "Not your town?" → `/my/?change=1`.
- [ ] **Step 2: District page** (only the multi-town districts): the member-town list with the resident's own marked is **not** possible on a shared page, so list all towns as links and tell the reader "Your town is one of these"; rate range, student sum, people sum; Next → union.
- [ ] **Step 3: Union page:** same stats; when `split` exists, a notice "The districts in this union are in more than one grouping" with a list. Towns with no union (none today besides the closed one) are covered by a blank-reason component.
- [ ] **Step 4: Grouping page:** committee number, member districts, stats, the Act 170 start group and whether it moved, and the notice that the committee list is preliminary and checked by James Nadeau on 2026-11-22 (pull the wording and date from `groupings.reassignment`, do not hardcode).
- [ ] **Step 5: Extend the real-data test:** after `npm run build:site`, `site/dist/my/town/` contains one directory per non-closed town; `site/dist/my/union/` has 52; `site/dist/my/grouping/` has 18; no built HTML under `site/dist/my/` contains the strings `NaN`, `undefined` or `null` as visible text.
- [ ] **Step 6: Verify** `npm run build && npm test` — all pass; open `/my/town/addison/`, one single-town-district town, one hidden-ADM town, one no-committee town in `npm run dev` and confirm each step reads correctly and Next links chain town → district → union → grouping.
- [ ] **Step 7: Commit** `journey: town, district, union and grouping pages`.

---

### Task 7: Entry points, README, final check

**Files:**
- Modify: `site/src/layouts/Base.astro` (add `['/my/', 'Find my town']` first in `modelingNav` or as a top-level nav link), `site/src/pages/index.astro` (a "Start here" card to `/my/`), `site/src/pages/town/[slug].astro` ("See this town in your journey" link to `/my/town/<tail>/`), `README.md` (the "Web analytics" section: say the site now sets one first-party cookie holding a town name when a visitor picks one, and sends one PostHog event; replace "cookieless" wording for PostHog accurately)

- [ ] **Step 1:** Make the four edits. Link text at the 5th-grade level.
- [ ] **Step 2: Verify** `npm run build && npm test && npx astro check --root site` — all pass.
- [ ] **Step 3:** Run `npm run validate` — passes.
- [ ] **Step 4: Commit** `journey: entry points and README`, then open a pull request (or push to a branch) per the repo's convention in `CONTRIBUTING.md`.
