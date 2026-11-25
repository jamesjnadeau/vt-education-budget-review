# Persona review — a 10-year-old in Milton

| | |
|---|---|
| **Date walked** | 2026-11-24 |
| **Site as of** | live at https://vermont-school-budgets.org/ |
| **Persona** | 10 years old, 5th grade, lives in Milton, dad sent him to the site |
| **Errand** | "What does my school cost?" |
| **Path walked** | `/` → `/my/` → `/my/town/milton/` → `/my/union/milton/` → `/my/grouping/19/` → `/su/milton/` → `/model/` → `/admin/coverage/` |
| **Device** | desktop browser. Mobile **not verified** — device emulation did not take in the test session |

---

## In their words

I'm 10. I live in Milton. My dad said there's a website about school budgets, so
I went on it.

### What I found out

Milton's school tax rate is 1.2462. There are 1,451.22 students who live here.
There are 10,723 people. Our rate is lower than 182 towns, and we're bigger than
168 towns. Milton is its own supervisory union. Then I clicked "next" twice and
the pages stopped telling me anything.

### What I asked out loud

1. **"One point two four six two *what*?"** It says `1.2462` with no dollar sign,
   no unit, nothing after it. Is that dollars? Percent? Is it a lot? Nobody on
   the whole site tells me that this means "$1.2462 for every $100 your house is
   worth," and nobody once shows me what it costs for a real house.
2. **"How do you have .22 of a student?"** It says 1,451.22 students. Twenty-two
   hundredths of a kid. I found the answer later — a kid who was only there part
   of the year counts as part of one — but it's on the *supervisory union* page,
   not the page with the decimal on it.
3. **"Where are my schools?"** My school is Milton Elementary. There's also
   Milton Middle and Milton Senior High. None of them are on my town's page.
4. **"Why is it 'lower than 182 of 258 towns' here, but 'higher than 168 of 176
   towns' there?"** Same page, three different numbers of towns. There are 267
   towns in the list.
5. **"What's FY2026?"** Everybody writes FY2026 like I'm supposed to know. Is it
   this year? Next year? School year or money year?
6. **"What's 'my group'? Group 19?"** It's just a number, so I don't know who's
   in it until I'm there. And when I got there it said the groups got changed and
   "we cannot see how." So is this page about what's happening or what used to be
   happening? It made me trust the page less, not more.
7. **"Where's the money?"** I came to see what Milton's schools spend. It never
   says. Not one dollar figure about Milton's schools anywhere.
8. **"Why does it say 'not usable'?"** Next to English learners and free lunch it
   says "not usable," which sounds like something is broken or that those kids
   don't count. The site says blanks are supposed to say *why* they're blank.
   This one doesn't.
9. **"Who is 'town/milton'?"** Under my schools it says "Operated by:
   town/milton." That's not a person or a place.
10. **"Milton has zero school districts?"** The supervisory union page says
    "Member districts (0)" but lists three Milton schools right underneath.
11. **"Why does the other page say a different rate?"** In the what-if tool,
    Milton for FY2026 says **$1.8975**. The Milton page says **1.2462**. Same
    town, same year, two answers.

### Where I stopped

The top of the home page. It's about how careful the site is, not about Milton.
I had to scroll past "every number can be traced" and "we show what's missing" to
find the one button I wanted. The first two pages I read had long sentences — the
home page reads at about a 10th-grade level, my town's page at about 13th.

### What would make this better for me

1. **Put the meaning under the number.** `1.2462` → *"$1.2462 per $100 of house
   value. A $250,000 house pays about $3,116 a year in school tax."* One sentence,
   one example. I understood the whole site the second I did that math myself.
2. **Put my three schools on my town's page**, with grades.
3. **Say what's missing in words I can read.** Not "not usable" — *"the district
   didn't publish this."*
4. **One comparison sentence per fact.** "Lower than 182 of the 258 towns that
   published a rate."
5. **"Group 19: Milton, Colchester, the islands"** — a name I can recognize.
6. **Explain decimals where they appear**, not two pages later.
7. **Tell me which number to believe.** If the tool and the town page disagree
   about Milton, one of them has to say so on the screen.

---

## For the builder

| # | Status | Finding | Evidence |
|---|---|---|---|
| 1 | **Defect** | The what-if tool publishes a Milton rate that the state's own published rate contradicts. The main cause, found in the Norwich review, is the denominator: the tool divides AOE's published education spending by its own computed weighted membership (1,921.78) instead of AOE's published weighted ADM (2,417.47), which inflates per-weight pupil spending from $13,761 to $17,311 and trips the excess-spending rule. The demo's placeholder poverty/EL/density/CLA compound it: CLA 0.8 → $1.8975, 0.9 → $1.6866, 1.0 → $1.5180 billed. | `site/src/pages/model/index.astro:183,186,202,231` hardcode those four; `site/src/scripts/adm-prefill.ts` never sets them. All four fields carry no source label, though the picker promises "each field is labelled with its source." Denominator: `warehouse/aoe-edspend/fy2026.yaml` vs `/model/` step tree — see `2026-11-24-norwich-college-professor.md`, finding 1. |
| 2 | **Defect** | `not_published` renders as "not usable" with class `not-computable`, collapsing the four-blank taxonomy and mislabelling a document gap as a computation failure — in the one place residents actually look. | `site/src/pages/town/[slug].astro:122–127` |
| 3 | **Defect** | `/su/milton/` says **"Member districts (0)"** while listing three Milton schools, and shows the raw id **`town/milton`** as the operator. Also on the page: `Registry ID su/milton`, `AOE organization ID SU010`, `Status active`. | live `/su/milton/` |
| 4 | **Defect** | Year labels disagree: the town page calls the 1,451.22 count "school year 2025"; the SU table labels the identical column "2024-2025". | `/my/town/milton/` vs `/su/milton/` (that column sums to exactly 1,451.22) |
| 5 | **Defect** | Picking a district alone does nothing — no prefill, no message. It needs the year select too, and the copy above the control does not say so. | reproduced on `/model/` |
| 6 | **Gap** | No dollar figure and no per-student figure for Milton on any page a resident reaches; the only Milton money number on the site is inside the what-if tool. | `/my/town/milton/`, `/su/milton/` |
| 7 | **Gap** | Comparison denominators (258 / 176 / 254 towns) unexplained; no axis on the dot plot; `1.2462` has no unit and no glossary link; `FY2026` undefined on the page it appears on. | `/my/town/milton/` |
| 8 | **Taste** | `/my/grouping/19/` shows "from 1.2462 to 2.1839 across 7 of 7 towns" and then a card saying the rate "cannot be told" — contradictory on its face. "Students, combined: at least 4,698.99" is machine-speak. | live page |

### Not verified

- Mobile / phone layout. CDP device emulation did not apply in the test session
  (`window.innerWidth` stayed at the desktop width), so there is no claim either
  way about the school-Chromebook or phone experience.
- Screen-reader behaviour, colour contrast, and the charts' accessibility names.

### Fix order

1. Units and one worked example on every town page.
2. `not_published` → the site's own `missing_input` wording.
3. Source or refuse the four placeholder inputs in `/model/`.
4. Schools and one dollar figure on the town page.
5. One denominator per comparison, explained in the sentence.
6. `/su/[slug]` ids and the "Member districts (0)" line.
7. Reconcile the year label.
8. Name the groups by their towns.

### Copy-paste prompt

> For a fresh session: in jamesjnadeau/vt-education-budget-review, fix these in
> order, with tests. (1) `/model/` — the four placeholder inputs (`econ`, `el`,
> `density`, `cla` in `site/src/pages/model/index.astro`) stay at demo defaults
> when a district is loaded, producing a Milton FY2026 rate of 1.8975 against the
> published 1.2462. Prefill from AOE/warehouse where a source exists; where none
> exists, block the rate result and name the unverified field instead of
> computing from a placeholder. Add a test that loading any district+year either
> sources or refuses each of the four. (2) `site/src/pages/town/[slug].astro` —
> render `not_published` as "the district did not publish this" with the
> `missing_input` tag, not "not usable"/`not-computable`. (3) `/su/[slug]` — stop
> printing raw ids (`town/milton`); when a SU's schools are operated by a town
> district, say so instead of "Member districts (0)". (4) Reconcile the year label
> between the town page and the SU tables. Report what changed and what is still
> unverified.
