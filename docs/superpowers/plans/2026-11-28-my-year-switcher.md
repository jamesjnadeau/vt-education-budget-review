# My-journey year switcher: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every `/my/` page belong to one fiscal year (FY2020 to FY2027, default FY2026), with a year switcher left of the route map.

**Architecture:** Stage 1 lands the source files and a new generated file, `site/src/generated/journey-years.json`, holding each year's homestead rate and (for FY2020 to FY2024) town student total. Stage 2 makes `buildJourney` take a year, moves the four pages under `site/src/pages/my/[year]/`, adds `YearSwitcher.astro`, and leaves redirect stubs at the old addresses. `combiner.json` and everything that reads it stay FY2026.

**Tech stack:** TypeScript (tsx, vitest), Astro static pages, YAML warehouse records.

**Spec:** `docs/superpowers/specs/2026-11-28-my-year-switcher-design.md`

## Global constraints

- Fetch anything on `*.vermont.gov` only with `npm run vt:fetch` (`AGENT.md`).
- Raw artifacts are never edited; each has a `provenance.yaml` entry with its sha256.
- Never invent a number: a missing figure is a blank with a plain reason.
- Never rank or recommend; comparisons stay neutral.
- `YEARS = [2020..2027]`, `DEFAULT_YEAR = 2026`, both in `site/src/lib/years.ts` only.
- A fiscal year N runs July 1, N-1 to June 30, N.
- Public copy is plain words; no em dashes.

## Review focus

1. A town with no rate in one year (Barre City, Barre Town in FY2027; "pending" rows in older sheets): the page shows the reason, the dot grid and percentiles leave it out.
2. A town in the registry that an older sheet spells differently or does not list: reported by the importer, blank on the page, never matched by guess.
3. A CLA published as a percent (101.27) in old sheets and a fraction (0.6659) in new ones: stored as a fraction in every year.
4. Changing year on a district, union or group page lands on the same place in the new year, not on the town.
5. An address with a year outside `YEARS` does not exist (404), and the old yearless addresses still reach the FY2026 page.

---

### Task 1: Land the source files

**Files:** create `intake/tax-rates/fy2020..fy2025/` and `intake/aoe-adm/fy2020..fy2023/` (artifact + `provenance.yaml` each); modify `intake/aoe-adm/source.yaml`, the header of `tools/src/cli/adm-import.ts`.

- [ ] Fetch with `vt:fetch` into each folder: the six Tax Department workbooks (FY20 `FY20 Education Tax Rates 2019.0930.xlsx`, FY21 `TaxRates12FEB2021.xlsx`, FY22 `FY22TaxRates-2021.0818.xlsx`, FY23 `FY23TaxRates-2022.0824.xlsx`, FY24 `FY24 TaxRates_8252023.xlsx`, FY25 `FY25EdTaxRates_102424.xlsx`) and the four AOE reports (`edu-average-daily-membership-by-resident-district-fy20..fy23.xlsx`).
- [ ] Write provenance for each, modelled on the FY2027 and ADM-24 entries (`retrieval_method: vt-fetch`, `publisher`, `title`, `published_date`, `document_page`).
- [ ] Replace the "download by hand" text in `source.yaml` and `adm-import.ts` with the `vt:fetch` instruction; mark the held reports.
- [ ] `npm run validate` passes. Commit.

### Task 2: Import every year of tax rates

**Files:** modify `tools/src/tax-rates/parse.ts`, `parse.test.ts`, `tools/src/cli/tax-rates-import.ts`; create `warehouse/tax-rates/fy2020..fy2025.yaml`, `fy2027.yaml`.

**Produces:** `TaxRateRow` with `school_code: string | null`, `cla: number` (always a fraction), `statewide_adjustment`, `cla_over_sa`, `district_rate`, `homestead_rate`, `nonhomestead_rate` all `number | null`.

- [ ] Tests first: an FY2020-layout sheet (`TOWN, STATUS, CALC, CLA, HS_TAXRATE, NHS_TAXRATE`, CLA 101.27 → 1.0127), an FY2023-layout sheet (`SCHOOL CODE, TOWN, 2022 Reappraisal, Common Level of Appraisal, Homestead Tax Rate, ...`), the FY2025 layout, a rate cell holding text → null, footnote rows ignored. The existing FY2026 test still passes unchanged.
- [ ] `parseTaxRates` finds columns by header name (case-insensitive); the header row is the one with a "Town" cell. Data ends at the first row with no town or with only one filled cell.
- [ ] `tax-rates:import` loops over every `intake/tax-rates/fy*/` folder (one workbook each), or one year with `--year`. `fy2026.yaml` must come out byte-identical.
- [ ] Run it; check row counts (about 260 a year) and report towns with a null homestead rate per year. Commit.

### Task 3: Import the four AOE reports

- [ ] `npm run adm:import`; `adm20..adm23.yaml` appear, `adm24.yaml` unchanged apart from the date line.
- [ ] `npm run build:data` and diff `site/src/generated/`: files other than `adm.json` must not change in a way that alters a published FY2026 figure. If one does, stop and report. Commit.

### Task 4: `journey-years.json`

**Files:** create `tools/src/journey-years.ts`, `journey-years.test.ts`; modify `tools/src/cli/build-data.ts`.

**Produces:**
```ts
interface JourneyYear {
  fiscal_year: number;
  rate_source: { publisher: string; title: string; published_date: string; document_page: string } | null;
  /** 'resident_district_report' for FY2020-FY2024, 'town_file' for FY2025+, null when neither is held. */
  students_source: { kind: 'resident_district_report' | 'town_file'; count_year: string; title: string | null; preliminary: boolean } | null;
  /** keyed by registry slug ("town/addison"). students is present only for resident_district_report years. */
  towns: Record<string, { homestead_rate: number | null; students?: number }>;
  /** Tax table rows that matched no registry town, by name as published. */
  unmatched: string[];
}
interface JourneyYears { generated: string; years: JourneyYear[] }
```
- [ ] Tests: name matching goes through `normalizeTown` and `TAX_NAME_ALIASES` (reuse the combiner's), an unmatched row lands in `unmatched`, students is the sum of a report's band values rounded to 2 places, a year with a town file gets `kind: 'town_file'`.
- [ ] Build it from `warehouse/tax-rates/fy*.yaml`, `warehouse/aoe-adm/adm*.yaml`, the subgroup publication's `years`, and each year's intake provenance. Write the file in `build-data`.
- [ ] Report: per-year counts of matched rates, and any FY2026 town whose rate differs from `combiner.json`'s `published_homestead_rate`. Commit.

### Task 5: Year-aware journey model

**Files:** create `site/src/lib/years.ts`, `years.test.ts`; modify `site/src/lib/journey.ts`, `journey.test.ts`.

**Produces:**
```ts
// years.ts
export const YEARS: readonly number[]; export const DEFAULT_YEAR = 2026;
export function fiscalYearDates(y: number): { start: string; end: string; short: string; schoolYear: string };
//   2026 -> { start: 'July 1, 2025', end: 'June 30, 2026', short: 'July 2025 to June 2026', schoolYear: '2025-2026' }
export function myHref(year: number, kind: 'town'|'district'|'union'|'grouping', slug: string|number): string; // '/my/2026/town/addison/'
// journey.ts
buildJourney(inputs: JourneyInputs & { years: JourneyYears }, year: number): Journey
// Journey gains: year, studentsLabel: { source: 'resident_district_report'|'town_file'|null; countYear: string|null; preliminary: boolean }
```
- [ ] Tests: two years with different rates give different `rate`, `rateOrder` and percentiles; step hrefs carry the year; a `resident_district_report` year gives exact students and shares; a year with no student source gives a blank reading "the state's student count for this year is not on file here."; a town-file year reads the school year whose `fiscal_year` matches.
- [ ] Implement. `rateOf` reads `years`; students read either source. Commit.

### Task 6: Pages, switcher, redirects

**Files:** create `site/src/components/YearSwitcher.astro`, `site/src/pages/my/[year]/{town,district,union}/[slug].astro`, `site/src/pages/my/[year]/grouping/[number].astro`; turn the four old page files into redirect stubs; modify `site/src/pages/my/index.astro`, `site/src/lib/sources.ts`, `DotGrid` callers, `global.css`.

- [ ] `YearSwitcher` props `{ year: number; hrefFor: (y: number) => string }`: label "for year 2026", a `<select>` of `YEARS` with text "2026 (July 2025 to June 2026)", a date line, a help line, and a `<noscript>` list of year links. It sits in a flex row with `JourneyProgress`, stacking under 36rem.
- [ ] Each page's `getStaticPaths` loops over `YEARS`; labels take the year; the source line comes from the year's `rate_source`; the residual note shows only when `year === 2026`; years before the default show "Districts, unions and groups are shown as they are today."; FY2024 and FY2025 carry the line about the student count changing source.
- [ ] Old paths: a stub page per slug with a meta refresh and a link to the `DEFAULT_YEAR` page. `/my/` sends people to the `DEFAULT_YEAR` page.
- [ ] Verify: `npm run build` (time it), `npm run check`, vitest; grep the built pages for one town in each year; screenshots at 1280 and 390 wide; change year on a district page and land on the same district. Commit, push, open a PR based on `site/town-page-donuts`.
