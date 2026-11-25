# Persona review — a retired teacher from out of state, living in Brattleboro

| | |
|---|---|
| **Date walked** | 2026-11-24 |
| **Site as of** | live at https://vermont-school-budgets.org/ |
| **Persona** | 67, retired after 31 years teaching middle school in Massachusetts, moved to Brattleboro four years ago, owns an old house that was just reappraised, lives on a pension, reads long documents for pleasure |
| **Errand** | "What am I actually paying for schools, and where is the budget?" |
| **Path walked** | `/` → `/my/town/brattleboro/` → `/my/district/brattleboro/` → `/my/union/windham-southeast/` → `/su/windham-southeast/` → `/explanations/` → `/explanations/vt-4-glossary/` → `/admin/coverage/` → `/methodology/` |
| **Device** | desktop browser. Mobile **not verified** |

---

## In their words

I taught sixth grade for thirty-one years and I sat on the salary committee for
nine of them. I know what a school budget looks like from the inside. What I don't
know is Vermont, where the whole contraption works differently from Massachusetts
and nobody has explained it to me.

### What I found out

Brattleboro's homestead rate is 1.8991: higher than 220 of 258 towns, against a
state median of 1.5145. My county's median is 1.4966, so we're above that too.
That part is clear and it's the one thing the site does well.

### What I asked out loud

1. **"One point eight nine nine one — per *what*?"** In Massachusetts I'd say
   "$12.50 per thousand." Reading this cold, I assumed per thousand, which makes it
   look cheap, and then I worked out it must be per hundred, which makes it $18.99
   per thousand and looks expensive. Two opposite conclusions from the same four
   digits, and the page never says which. That's not a small thing: it's the first
   number on the page.
2. **"Is that what I pay?"** I'm on a pension. I know Vermont has something for
   people with modest incomes — I've heard two thirds of homeowners get a credit —
   and I know it's on my tax return. What I can't find out is whether *my* 1.8991 is
   anywhere near what comes out of my account, and no page tells me. The credit is
   a paragraph in a glossary I had to hunt for. There is no line under the number
   that says "you may pay less than this, here's how to tell."
3. **"Where is the budget?"** I have read hundreds of these things. I want
   salaries, benefits, special education, transportation, and how many people are on
   payroll. The site says it stores "about a dozen broad categories" — that's the
   right instinct, and it's more than the state gives you — but for Brattleboro
   there are **no documents at all**, so the categories are a promise, not a page.
4. **"Where does the money come from?"** In Massachusetts I could tell you what
   share came from Chapter 70 and what came from the town. Here I can't find one
   sentence about the Education Fund outside the glossary, and nothing anywhere says
   what share of Brattleboro's schools is paid by the state versus by us. If the
   answer is "it doesn't work that way here," then *say that*, because that's the
   single biggest thing a transplant gets wrong.
5. **"Is it going up?"** One year. FY2026, everywhere, with no prior year and no
   graph. I can't tell whether 1.8991 is a spike, a plateau or a slow climb, and
   that's the first question any of us asks.
6. **"What counts as a 'budget document'?"** The coverage page says you hold 3 of
   312 "supervisory-union years" and never says what the document is. The warned
   budget? The town report? A state form? I would go get one this week if I knew
   what to look for. Right now I can't tell whether Brattleboro is missing or
   whether you haven't asked.
7. **"Who is the Agency of Education and who is the Tax Department?"** Two agencies
   keep appearing, one owns the spending and the other owns the rate, and no page
   introduces either of them. I had to infer it.
8. **"Four towns or five?"** The Windham Southeast page says the district has "4
   member town(s)" and then lists five member towns. And Vernon Elementary is the
   only school in the list not operated by the district. I noticed because I taught
   in a district where that kind of thing was always a boundary dispute, not a typo.

### What I'd keep, and I mean this

The neutrality statement, the four kinds of blank, and the explanations series are
the best writing on the site. The glossary explains ADM, the Education Fund, income
sensitivity and the property tax credit better than anything the state publishes.
My complaint is not that it's missing — it's that **you wrote the explanation and
then put it three clicks away from the number it explains.** I would hang that
glossary off the town page and off every single figure.

### Where I stopped

At the "cannot be told" box on the district page, and again on the coverage page
when I couldn't work out what a budget document is. I didn't close the tab — I
opened a second one to look up Brattleboro's actual budget somewhere else, which is
the outcome you don't want.

### What would make this better for me

1. **Put the unit in words, first thing.** "$1.8991 per $100 of house value — that's
   $18.99 per $1,000, or about $4,748 a year on a $250,000 house." I'd never have
   guessed wrong again, and I'd have told my neighbor.
2. **One line about the credit under the rate.** "This is before the property tax
   credit. About two thirds of Vermont homeowners get one, based on income. If your
   income is under about $X, your bill is capped as a share of it." Link the
   glossary.
3. **One paragraph on how this differs from other states**, in the explanations
   series: no Chapter 70 equivalent, the Education Fund, why your town's rate isn't
   your district's rate.
4. **Say what a budget document is**, and what "3 of 312" is counting, with one
   example of a good one. Then a teacher like me can actually help you.
5. **Show a prior year.** Even one.
6. **Staff counts.** You store FTEs in the schema; nobody can see a single one.

---

## For the builder

| # | Status | Finding | Evidence |
|---|---|---|---|
| 1 | **Defect (high)** | **The rate has no unit anywhere on the town page.** Vermont quotes per $100; Massachusetts, New York and most others quote per $1,000. A transplant misreads by a factor of ten, in either direction. | `/my/town/brattleboro/` — `.journey-stat-figure` is a bare `1.8991`; "per hundred dollars of value" appears once on the site, in `vt-2-how-your-rate-is-set.md`, about the *non-homestead* rate |
| 2 | **Gap (high)** | **The displayed rate is before the property tax credit, and nothing on the page says so.** "About two thirds of Vermont homeowners get one" exists only in the glossary. No link from the number, no way to test eligibility. | `/explanations/vt-4-glossary/`; `/my/town/brattleboro/` |
| 3 | **Gap** | **No state/local share anywhere.** The Education Fund appears only as a glossary entry. Nothing explains that Vermont has no per-district state-aid line comparable to Chapter 70, which is the transplant's default mental model. | `site/src/content/explanations/vt-4-glossary.md`; no town or methodology page |
| 4 | **Gap** | **"Budget documents" is never defined.** `/admin/coverage/` counts "3 of 312 supervisory-union years" without saying what document satisfies a year, so a willing contributor cannot know what to send. | `/admin/coverage/` |
| 5 | **Defect** | **The Windham Southeast district has 4 member towns or 5**, depending on which line you read, and Vernon Elementary is `town/vernon` where the other eight schools are `ud/windham-southeast-96`. | `/su/windham-southeast/` |
| 6 | **Gap** | **No trend, and no staffing.** One fiscal year per town; FTEs in the schema but on no page. | `/my/town/brattleboro/`; `/methodology/` |
| 7 | **Gap** | **The explanations series is unreachable from the numbers.** Every concept a reader needs is in `site/src/content/explanations/`, unlinked from the town pages. | site nav; town page markup |
| 8 | **Defect** | **Two agencies, never introduced.** The Agency of Education owns spending, the Department of Taxes owns rates; no page says who does what before using both. | `/methodology/`, `/admin/coverage/` |

### Credit

- The glossary is genuinely better than the state's own materials on ADM, the
  Education Fund, income sensitivity and the credit.
- The neutrality statement and the four-blank taxonomy are the two things I would
  point a skeptical colleague at.

### Not verified

- Mobile layout (emulation did not apply).
- Whether Brattleboro's FY2026 rate differs from its district rate as the warehouse
  implies (1.8991 billed vs 1.844 district, CLA 0.7026) — the arithmetic is
  consistent but I did not reconcile it independently.
- Income-sensitivity thresholds; I deliberately did not state a number.

### Fix order

1. Unit line in words, with a per-$1,000 conversion and a worked example.
2. One sentence and one link about the property tax credit under every rate.
3. Define "budget document" on the coverage page, with an example.
4. A short "how Vermont differs" explainer, linked from the town page.
5. Reconcile the Windham Southeast 4-vs-5 and the Vernon operator.
6. Prior-year rate; FTE counts.

### Copy-paste prompt

> For a fresh session: in jamesjnadeau/vt-education-budget-review, make the town
> pages legible to someone arriving from another state's system. (1) Under every
> homestead rate, print the unit in words and a conversion — "$1.8991 per $100 of
> value ($18.99 per $1,000); about $4,748 a year on a $250,000 house" — derived from
> the published rate, with the house value labelled as an example. (2) Add one
> sentence plus a link about the property tax credit under the same number, stating
> that the rate shown is before the credit and pointing at the glossary entry. (3) On
> `/admin/coverage/`, define what counts as a budget document for a district-year,
> with one example artifact, so a reader can tell what is missing and what to send.
> (4) Add a short explainer on how Vermont differs from states with per-district aid
> (no Chapter 70 equivalent; the Education Fund), linked from the town page. (5) Fix
> `/su/windham-southeast/`: the member-town count contradicts the member-town list,
> and Vernon Elementary's operator `town/vernon` is inconsistent with the other
> eight schools. Report what changed and what is still unverified.
