# Year switcher for the "My journey" pages: design

Date: 2026-11-28. Status: awaiting approval.

## Intent

The `/my/` pages (town, district, union, group) show one fiscal year, FY2026, and
say so only in small labels. The Tax Department has since published FY2027 rates,
and earlier years are on its site too. A resident should be able to see which year
a page is about, in plain dates, and move to another year without losing their
place.

## Goals

- Every `/my/` town, district, union and group page belongs to one fiscal year and
  shows only that year's figures.
- A switcher sits to the left of the route map. It reads "for year 20xx", with a
  dropdown under it listing the other years.
- The page explains, with dates, what a fiscal year is and which one is showing.
- Years offered: FY2020 through FY2027 (eight years). FY2026 is the default.
- The year is in every page address, the default year included.

## Non-goals

- The combiner, the model and the district budget pages stay on FY2026.
- No year-by-year history of which towns belong to which district or union. Every
  year uses today's memberships (see "Membership").
- Countersigning the FY2027 parameters is separate work.

## Anti-goals

- A figure from one year shown under another year's heading.
- A missing figure filled with a neighbouring year's number. It shows a plain reason
  instead, as blanks do today.

## Approaches

1. **A page per year, year in the address** (chosen). `/my/2026/town/hinesburg/`.
   Works with no JavaScript, each year can be linked and shared, and it fits how the
   site is already built (static pages from `getStaticPaths`). Cost: about four
   times as many `/my/` pages per year added: roughly 3,000 for eight years instead
   of 380 today. Build time must be measured, not assumed.
2. **One page, figures swapped in the browser.** Fewer pages, but nothing shows
   without JavaScript, a year can't be linked to, and the dot grid, comparisons and
   source line would all need to be redrawn by script. Rejected.
3. **Year as a query string** (`?year=2027`). A static site can't act on a query
   string without script, so this is approach 2 with a nicer address. Rejected.

The owner chose year-in-address for every year, and the range FY2020 to FY2027.

## Design

### Addresses

- `/my/<year>/town/<slug>/`, `/my/<year>/district/<slug>/`,
  `/my/<year>/union/<slug>/`, `/my/<year>/grouping/<number>/`, for 2020 to 2027.
- The old addresses (`/my/town/<slug>/` and so on) become small redirect pages to
  the FY2026 page, so existing links and the PR #88 pages keep working. (My call.)
- `/my/` stays the town picker, with no year. Picking a town, or the returning
  visitor cookie, goes to the default year. (My call: the cookie remembers the town
  only, not the year.)
- One helper builds these addresses (`myHref(year, kind, slug)` in
  `site/src/lib/journey.ts` or beside it). Route-map steps, "next" links, the dot
  grid's town links and member-town lists all use it, so the chosen year carries
  through the whole walk.
- The year list and the default live in one place (`site/src/lib/years.ts`):
  `YEARS = [2020, ..., 2027]`, `DEFAULT_YEAR = 2026`. Changing the default
  later is a one-line edit.

### The switcher

A new component, `YearSwitcher.astro`, placed in a row with `JourneyProgress`: the
switcher on the left, the route map taking the rest of the width. Under 36rem, where
the route map already turns vertical, the switcher stacks above it.

```
for year 2026                 ● ┄┄┄┄▶ ○ ┄┄┄┄▶ ○ ┄┄┄┄▶ ○
[ 2026 ▾ ]                  Your town  District  Union  Group
July 1, 2025 to             you are here
June 30, 2026
```

- "for year 2026" is the visible label of the dropdown.
- Each dropdown entry carries its dates: "2026 (July 2025 to June 2026)".
- Choosing an entry goes to the same page in that year. This needs a few lines of
  script; without script, a plain list of year links shows instead (`<noscript>`).
- Under the dropdown, one short line of dates, and a `title`/help text on the label:
  "A fiscal year (FY) is the State's and schools' budget year. Fiscal year 2026 runs
  from July 1, 2025 to June 30, 2026. It pays for the 2025-2026 school year, and its
  tax rate is on the bills towns sent in summer 2025." (Wording is my call; the dates
  come from a function of the year, not typed per year.)
- The stat labels that now say "(FY2026)" and "(school year 2025)" take their year
  from the page's year.

### Figures per year

| Year | Homestead rate (Tax Department) | Students (AOE) |
|---|---|---|
| FY2020 | web-page table | Resident District Report ADM-20 (count 2018-2019) |
| FY2021 | web-page table | ADM-21 (2019-2020) |
| FY2022 | spreadsheet, Aug 18, 2021 | ADM-22 (2020-2021) |
| FY2023 | spreadsheet, Aug 24, 2022 | ADM-23 (2021-2022) |
| FY2024 | spreadsheet, Aug 25, 2023 | ADM-24 (2022-2023), already imported |
| FY2025 | spreadsheet, Oct 24, 2024 | town file SY24 (2023-2024) |
| FY2026 | spreadsheet, Aug 18, 2025, already imported | town file SY25 |
| FY2027 | spreadsheet, Jul 29, 2026, on file (two Barre towns blank) | town file SY26, marked preliminary |

People is the 2020 Census figure in every year, labelled as 2020.

- **Fetching.** Everything from a `*.vermont.gov` host is fetched with
  `npm run vt:fetch -- <url> --out <dir>`, as `AGENT.md` requires: no browser, no
  plain `curl`. That covers the AOE reports (the tool's user agent is served where a
  plain script gets a 403) and the Tax Department files. Checked on 2026-11-28: the
  tool returns 200 for an AOE document page, an AOE spreadsheet and a Tax Department
  rate page. The note in `intake/aoe-adm/source.yaml` that says "download by hand"
  predates the tool and is corrected as part of this work. Each fetched file goes
  into `intake/.../fy<year>/` with a `provenance.yaml` entry (URL, date, sha256,
  `retrieval_method`), like the files already there.
- **Rates.** `tax-rates:import` takes a year and writes
  `warehouse/tax-rates/fy<year>.yaml`. Three source shapes:
  - FY2026 and FY2027: the current sheet layout.
  - FY2022 to FY2025: older spreadsheets with fewer columns (no SA or CLA ÷ SA), so
    the parser finds columns by header name and those two fields become optional.
  - FY2020 and FY2021: tables on a web page (TOWN, STATUS, CLA, HS_TAXRATE, ...).
    `vt:fetch` saves pages as extracted text, which may not keep the table's
    columns apart. The FY2020 page links a spreadsheet ("Download tax rates
    (xlsx)", `/content/fy2020-education-property-tax-rates`); use a spreadsheet
    where one exists. Where only the page exists, teach `vt:fetch` to keep the raw
    HTML (fix the tool, per `AGENT.md`) and parse the table from that.
  A town whose rate is absent or marked pending in the source is blank with the
  source's own reason.
  `build-data` writes a new `site/src/generated/journey-rates.json` (homestead rate
  per town per year). `combiner.json` is untouched and stays FY2026; the FY2026
  rates in the new file must equal the ones in `combiner.json`, and a test says so.
- **Students.** Two AOE sources, because neither covers all eight years:
  - FY2020 to FY2024: the Resident District Report for that year (`adm:import`,
    already used for ADM-24). A town's figure is the sum of its grade-band columns.
    These reports withhold nothing, so every town has an exact figure and share.
  - FY2025 to FY2027: the town file the pages use today (`adm-subgroups.json`),
    which already names the fiscal year of each count. FY2027 carries the file's
    own "preliminary" flag as a short note by the figure.
  The two sources count slightly differently: for the one count year both cover
  (2023-2024), town totals differ by a few percent either way (Hinesburg 825.04
  against 808.08). So the student label and source line name which report a year
  uses, and FY2024 and FY2025 pages carry one line saying the count changed between
  them. No page compares student figures across years. (My call: keep the current
  file for FY2025 rather than switch that year to ADM-25, so FY2025 to FY2027 keep
  the grade bands and the withheld-number handling they have now.)
  Town names in older reports ("Alburg") are matched through the AOE town code
  (`T003`), as `adm:import` does today; an unmatched row is reported, not guessed.
- **Comparisons.** The dot grid, the percentile sentences, the state and county
  medians and means, and the district/union/group rate ranges are all worked out
  within the page's year.
- **Source line.** Each year's line is read from that year's `provenance.yaml`.
- **"The State's rate differs from this site's math" note.** Shown on FY2026 pages
  only: that comparison was only ever made for FY2026.

### Membership

Districts, unions and groups are today's in every year. A town that changed district
between FY2020 and now is shown in its current one. FY2020 is the floor partly for
this reason: the builder checks the registry's `effective_from`/`effective_to` dates
and reports how many current districts began after July 1, 2019, so the owner knows
how many pages the caveat really touches. Pages for years before the
default say so in one line near the route map: "Districts, unions and groups are
shown as they are today." (My call. A year-aware registry is a larger job.)

### Code shape

- `buildJourney(inputs, year)` returns one year's journey; `inputs` gains the rates
  file. The four `[slug].astro` pages move under `site/src/pages/my/[year]/...` and
  their `getStaticPaths` loop over `YEARS`. Redirect pages sit at the old paths.
- Tests: `journey.test.ts` gains cases for a second year (different rate, different
  student source, a blank year, year-carrying links); parser tests cover an old-layout
  sheet and a web-page table; a test pins FY2026 rates equal to `combiner.json`.
- Verification per the site-editing skill: build, `npm run check`, vitest, grep the
  built pages for one town in each year, and look at desktop and phone widths.

## Left to the builder

- Exact CSS, and the redirect mechanism (Astro `redirects` config or stub pages).
- How the older workbooks' town names map to registry slugs where they differ from
  the FY2026 sheet's; any town that can't be matched is reported, not guessed.
- Whether other pages that link into `/my/town/...` should use the helper now or
  rely on the redirects.

## Delivery

Two stages, so the data can be reviewed apart from the pages: first the fetches and
imports (intake, provenance, warehouse files, generated JSON), then the site change.
The switcher only lists years whose rate file exists, so the site can ship before
every year is in.


A new branch on top of `site/town-page-donuts` (PR #88 touches the same pages), with
its own PR. Imports and site change can be separate commits.
