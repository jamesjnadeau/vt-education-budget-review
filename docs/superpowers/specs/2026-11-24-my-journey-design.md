# My journey: a resident-first walk from town to union to grouping — design

Status: draft, awaiting approval. Revised after the builder check. Brainstormed with James Nadeau, 2026-11-24.

## Intent and the why

The site's pages (`/town`, `/su`, `/groupings`) are organized around the data. A resident
who lands on them cannot easily see how the numbers relate to *them*, or how big those
numbers are. James wants a new category of pages, built from the models already in the
repo, that walks a resident outward from where they live: **my town → my school district (only
when the district covers more than one town) → my supervisory union → my grouping**. At each step they see the homestead tax rate, student counts (ADM) and
census figures, and see each in **scale** (where their town sits among all towns; how much
of the union or grouping their town is).

The goal is discovery and understanding, not analysis. The reader is a Vermont resident,
not a budget analyst.

## Goals

- A new `/my/` section, one page per step, each with its own shareable URL:
  - `/my/` — pick your town.
  - `/my/town/<slug>/` — my town.
  - `/my/district/<slug>/` — my school district. Only for a town whose district covers more
    than one town (the registry's `operated_by` district with sibling towns). A town in a
    one-town district skips this step and goes straight to the union. The page lists the
    towns that share the district budget and marks the resident's own.
  - `/my/union/<slug>/` — my supervisory union (the union the town belongs to).
  - `/my/grouping/<number>/` — my grouping (the facilitators' committee number).
- Each step (town, district, union, grouping) shows three headline figures: homestead tax rate, students (ADM), people
  (Census). Each has a scale visual (below). Each step ends with a "Next" link to the
  following step, and a way back.
- Picking a town sends one PostHog event and remembers the town in a cookie. A returning
  visitor landing on `/my/` is sent to their town page.
- Pages are pre-built static HTML from the same data files the existing pages read. They
  work without JavaScript except the picker itself (the picker page also lists all towns
  as plain links, so it degrades to a link list).
- Public copy follows `AGENT.md`: 5th-grade reading level, plain gloss on first use of
  *supervisory union*, *ADM*, *homestead rate*.

## Non-goals

- No what-if modelling; `/model` and `/combiner` stay as they are and may be linked from here.
- No redesign of the existing `/town`, `/su`, `/groupings` pages. Adding a link to `/my/` from the home page, the nav and the town page is in scope.
- No per-household bills or income-based figures.
- No new data collection or parameter verification.

## Anti-goals

- No scoring, ranking, "good/bad", or recommendation. Scale statements are neutral
  ("higher than 38 of 100 towns"), shown the same in both directions. (Repo rule 3.)
- No invented numbers. A figure that cannot be shown shows *why*, using the repo's four
  kinds of blank (`missing_input`, `unverified`, `undetermined`, `not_computable`). An
  unverified or null figure is never shown as zero or estimated.
- No cookie banner. Vermont has no cookie-consent requirement and the cookie holds only a town name; James decided a plain note on the picker page and a README update are enough.
- No analytics that identify a person: no `identify()`, no extra properties.

## Constraints

- Static site (Astro, `output: 'static'`, `trailingSlash: 'always'`), no server. Data is
  imported at build time from `site/src/generated/*.json`, produced by `npm run build:data`.
- PostHog is already loaded by `Base.astro` / `components/posthog.astro`, only in the
  production build, with autocapture off and URL query strings stripped. Events use the
  existing pattern: `window.posthog?.capture(event, props)` (see `scripts/combiner-tool.ts`).
  `posthog` is absent in dev and previews; the code must tolerate that.
- The README says the site is "cookieless". The cookie changes that wording: update the README's
  analytics line and add a plain-language note on the picker page. No consent banner (James's call).
- Existing data: FY2026 homestead rate per town (`warehouse/tax-rates/fy2026.yaml`, published
  by the Tax Department); town-of-residence ADM (`adm-subgroups.json`, with suppressed cells
  and the range logic in `lib/residents.ts`); Census population and land area for 252 of 256
  towns (`warehouse/census/`); union membership in the registry; Act 170 groups and the
  facilitators' committees (`registry/groupings.yaml`, `lib/groupings.ts`).
- 4 towns have no Census data, and some towns have hidden ADM cells. Those render as the
  appropriate kind of blank.

## Approaches considered

1. **A new pre-built `/my/` section** (chosen). One static page per town, union and grouping,
   generated from existing data; small script for picker, cookie and event. Trades more
   generated pages (about 256 + 52 + 20) for shareable URLs, search visibility, and fit with
   how the site already works.
2. **One `/my/` page that draws everything in the browser from a large data file.** Fewer
   pages, but a big payload, no real URLs per place, blank without JavaScript, and unlike the
   rest of the site. Rejected.
3. **Rework the existing town/union/grouping pages.** Least new code, but those pages are
   data-first and James asked for a new category. Rejected.

James chose approach 1 and, for layout, one page per step (not one long page).

## Decisions made with James

- **Layout:** one page per step, linked by "Next" buttons.
- **Scale visuals: yes.** Mockup showed: a grid of dots (1 dot per town, the resident's
  highlighted) and a bar showing share or position.
- **Remembering the town: yes, with a cookie.**

## Calls I made (James to check)

- **PostHog:** one event, `town_selected`, properties `{ town: <slug>, source: 'picker' }`,
  sent only when a resident actively picks a town on `/my/`. Auto-redirect for a returning
  visitor sends nothing. No other events.
- **Cookie:** `my_town=<slug>`, first-party, `Path=/`, `Max-Age` one year, `SameSite=Lax`,
  `Secure` on https. Holds only the town slug. A "forget my town" link on the pages clears it.
- **Grouping shown is the facilitators' committee,** not the Act 170 group: `roster_published`
  is true, and the committees (checked by James 2026-11-22) are the groups districts actually
  meet in. The page also states the Act 170 group the town's district started in, and whether
  it moved, reusing `lib/groupings.ts` (`committeeOf`, `committeeMoves`). The committee list is
  marked preliminary in the source; the page says so.
- **District step:** shown only when the town's `operated_by` district has other member towns.
  Rate shown is a range across the member towns with the resident's town marked (each town has
  its own common level of appraisal, so the billed rates differ); students and people are sums
  of member towns. The "Next" link goes to the union. Towns in a one-town district skip it, and
  the progress bar at the top omits the step for them.
- **Towns with no union listed:** get a plain "no supervisory union listed" step with the reason,
  and the journey goes on to the grouping.
- **Grouping follows the resident's own district.** The facilitators placed districts, not unions,
  so a union can have districts in different committees. "My grouping" follows the resident's own
  town. The union page says when its districts sit in more than one grouping and lists them. A
  town whose district is in no committee shows a plain blank with the reason.
- **Returning visitors:** the redirect from `/my/` runs in the browser (the site is static). "Not
  your town?" goes to `/my/?change=1`, which does not redirect. No Netlify edge rules.
- **Hidden ADM in scale visuals:** towns with hidden student counts are left out of the percentile
  and dot grid, and the page says how many towns the comparison covers. A union or grouping share
  that is a range uses `lib/residents.ts` range logic; one that cannot be bounded shows "can't tell
  yet" with the reason.
- **Mixed years are fine** when each figure carries its own label (e.g. "tax rate, FY2026"; "people,
  2020 Census").
- **Which union:** the town's `supervisory_union` registry field. (A town's `operated_by`
  district is shown as a secondary fact, per the registry's two-direction field warning.)
- **Rate at union/grouping level:** a *range* (lowest to highest member-town rate) with the
  resident's town marked, not an average. Averaging rates over towns of different size would
  be a figure nobody publishes.
- **Students/people at union/grouping level:** sums of member towns, using the existing
  withheld-cell range logic in `lib/residents.ts` (a sum can be a range or "at least"). Which
  ADM year and which Census series (2020 decennial vs. 2025 estimate) to show is the builder's
  call; show the label of the one used.
- **Scale definitions:** "percentile among all 256 towns" for rate and students; "share of the
  union / grouping" for students and people. Computed at build time in a new
  `site/src/lib/journey.ts` with unit tests. Ties and nulls: nulls are excluded from the
  denominator and the page says how many towns the comparison covers.
- **Entry points:** a prominent link from the home page and the top nav. Existing town pages get
  a "See this town in your journey" link.

## Parts left to the builder

- Visual design and CSS, within the existing styles and the style guide in `style/`.
- Exact copy at a 5th-grade level; the picker's control (select with search vs. plain list).
- Generated data shape and whether to add a `journey.json` at build time or compute in-page
  from existing files.
- Handling the 4 towns without Census data and towns with a missing rate (blank, with reason).
- Tests: unit tests for scale maths and cookie helpers; a build test that every town, union and
  grouping gets a page; a test that no page renders a number for an `unverified`/null input.

## Open questions

None. The builder check's questions are all answered above.
