# Persona review — a college professor in Norwich

| | |
|---|---|
| **Date walked** | 2026-11-24 |
| **Site as of** | live at https://vermont-school-budgets.org/ |
| **Persona** | professor, teaches at a college in the Upper Valley, lives in Norwich, comfortable with arithmetic, statutes and source criticism, pays a homestead tax bill |
| **Errand** | "Is my town's school spending and tax rate defensible, and can I check your work?" |
| **Path walked** | `/` → `/my/` → `/my/town/norwich/` → `/my/union/school-administrative-unit-70/` → `/su/school-administrative-unit-70/` → `/model/` → `/methodology/` → `/explanations/vt-4-glossary/` → `/admin/coverage/` → GitHub: `README.md`, `docs/act-127-transition.md`, `model/goldens/README.md`, `warehouse/`, `model/parameters/` |
| **Device** | desktop browser. Mobile **not verified** |

---

## In their words

I teach for a living and I read statutes for fun. I moved to Norwich eleven years
ago, my property tax is my largest recurring bill after my mortgage, and when a
stranger tells me a number about it, my first instinct is to check it. This site
invites exactly that, which is why I gave it an evening instead of thirty seconds.

### What I verified, and what it cost me

I began with the claim that matters most: **that the statutory weights are right.**
The methodology page says the Legislature's website "could not be reached," so I
opened 16 V.S.A. § 4010 in my browser. It loaded on the first try. Subsection (d)
gives prekindergarten **−0.54**, grades six through eight **0.36**, nine through
twelve **0.39**, poverty at 185 percent of FPL **1.03**, English learners **2.49**,
density bands **0.15 / 0.12 / 0.07** for under 36, 36–55, and 55–100 persons per
square mile, and small schools **0.21 / 0.07** under a 55-persons ceiling. Every
one of those matches the table on the site. I checked eleven values in about four
minutes.

That reframes the site's largest self-criticism. "Nobody has put their name to
these" is presented as a limit on what the project can claim. It is not a limit on
what you can claim; it is an errand nobody has run. A person can read a section of
statute and countersign it in the time it takes to drink a coffee. The blocker is
labour, not access — and if `legislature.vermont.gov` really does refuse automated
clients, that is an argument for a human pass, published with the reader's name
and the date, not for leaving the layer null.

I also verified, and want to credit, three things that are better than most
government data I use:

- **Suppression is done properly.** The SAU 70 table prints "1 to 10" for English
  learners, tells me one town's count is hidden, and explains the rule — under 11,
  plus complementary suppression so nothing can be recovered by subtraction. Most
  agencies just print a dash and let you wonder.
- **The blanks on the stat cards are labelled.** "the state did not publish a
  homestead rate for this town" is a sentence, not a shrug. It tells me whose fact
  it is.
- **The residuals are published.** `docs/act-127-transition.md` lists the eleven
  districts the engine cannot reproduce and, for each, its best guess at why. That
  is the single most credible page in the project.

Having said that, I found four things I would not sign my name to, and one of them
I think is serious.

### 1. The what-if tool silently replaces the state's pupil count with its own, and gets Milton wrong by 43 percent

This is the one that would end my use of the tool.

The site's own warehouse record for Milton FY2026 (`warehouse/aoe-edspend/fy2026.yaml`)
says the state published **2,417.47** weighted pupils and **$33,266,933** in
education spending, which is **$13,761.05** per weighted pupil. The site holds
those three numbers, transcribed from a hashed AOE workbook.

The tool, with Milton and FY2026 selected, computes its own weighted membership —
**1,921.78**, which is 20.5 percent below the state's figure — divides the same
$33,266,933 by *that*, gets **$17,311** per weighted pupil, and then applies the
§ 5401(12) excess-spending rule because $17,311 exceeds 118 percent of the
statewide average ($15,926). It adds the overage, arriving at $18,695, divides by
the property dollar equivalent yield ($8,596), and prints an equalized rate of
**2.1748**.

The state's published equalized district rate for Milton FY2026 is **1.5239**
(`warehouse/tax-rates/fy2026.yaml`). The billed rate is 1.2462, which is what the
town page shows. The tool's billed rate is **$1.8975**, 52 percent high.

Three things follow, and each is checkable without trusting me:

1. The state's published per-pupil figure ($13,761) is **below** the excess-spending
   threshold. The tool's ($17,311) is **above** it. The tool applies a statutory
   penalty to Milton that Milton does not owe, because its own denominator is wrong.
2. The tool's field label reads "from the state AOE figure (2,417.47 long-term
   weighted pupils)" — so the program knows the correct denominator and displays it,
   while dividing by a different one.
3. `model/goldens/README.md` says plainly: "All six fixtures take AOE's published
   long-term weighted ADM as an input rather than recomputing it from raw ADM. They
   therefore test the tax chain from the State's pupil count onward and say nothing
   about the membership engine." The tool therefore runs on precisely the half of
   the engine the goldens do not test.

A reader cannot see any of this. The screen says "computed," with a green light,
and four numbers that are internally consistent with each other and wrong about
my town. If I had quoted $1.8975 at a school board meeting I would have been
confidently wrong in public — which is the exact failure mode this project says it
exists to prevent.

### 2. Norwich is one of your eleven known failures, and its page does not say so

`docs/act-127-transition.md` lists Norwich in the residual table: chain 2.4038,
published 1.9183, attributed to a bond or other § 5401(12) exclusion that has not
been entered. That is admirably candid — in a file I had to know to look for.

`/my/town/norwich/` prints **1.4095** with no caveat, no source line, and no
indication that the district behind it is one the project's own arithmetic cannot
reproduce. The number is right: it is the state's published billed rate, and the
site transcribed it faithfully. But a page whose thesis is "every number can be
traced" shows its headline figure with **no visible citation at all** — I checked,
there is not one link to `tax.vermont.gov` or any other source host on that page.
Whatever else is true, that inverts the claim: the number with the least support on
the site is the one at the top of every town page.

### 3. Norwich is an interstate district, and the site does not know it

The town page never mentions Dresden, Hanover, or New Hampshire. `/su/school-administrative-unit-70/`
names a "Dresden Interstate Union School" (shown as the slug `ud/dresden-interstate-union-school`,
with no page I could reach) and lists two schools:

| School | Grades | Operated by |
|---|---|---|
| Marion W. Cross School | K–6 | `town/norwich` |
| Orford Schools | K–5 | — |

Orford is a town in New Hampshire, twenty miles up the river. It is not a Norwich
school, and nothing on the page says what it is doing there; the operator column is
an em dash. Meanwhile Norwich's **183 pupils in grades 9–12** — visible in the same
page's ADM table — attend a high school in another state, and no page in this site
says so. The only occurrence of "Hanover" anywhere in the Norwich journey is inside
a raw URL, `http://sau70.hanovernorwichschools.org//`, with a doubled trailing
slash and no TLS.

For a Norwich reader this is not a footnote. The thing that makes our finances hard
to compare with any other Vermont town is that our secondary students are educated
under a New Hampshire compact. A model that cannot represent that will keep
producing a Norwich number that does not reconcile, and the residual table will keep
saying "consistent with a bond or other exclusion" when the likelier explanation is
structural.

### 4. The comparison is composed of three different populations and never says so

On one screen I am told my rate is "lower than 146 of 258 towns," my student count
"higher than 140 of 176 towns," and my population "higher than 211 of 254 towns."
Three denominators, no explanation, and no note of which towns are missing from
each. The rate line compares a **median**; the other two compare an "avg per town,"
printed to four decimal places — 2,531.7913 people — which is false precision on a
mean of 254 skewed observations.

Worse, the ranking compares raw billed rates across towns without a word about
CLAs, while the site's own glossary says: "Reappraisal… resets the CLA, which
changes your tax rate whether or not the school did anything." So the glossary
supplies the caveat the comparison page omits — and the CLA itself is never
published for any town, even though the tool requires me to type one in, defaults
it to 0.8, and the warehouse holds the real value (Norwich 0.9848).

### 5. "No group yet for your district" is a fifth kind of blank

The site's four-blank taxonomy is the best idea in the project. Norwich's journey
ends with something that is not one of the four: *"Your school district is not in
any of the study's groups right now… The study is still arranging some districts;
you can ask the people in charge where yours stands."*

Is that *undetermined* (the facilitators have not decided), *missing_input* (we
have not transcribed the new rosters), or a failed join? The sentence reads like a
shrug, and a shrug is the one thing the project promises never to produce. For
Norwich this is the live question — merger is the reason a resident opens this site
— and the answer given is "ask someone else."

### Where I stopped

I did not stop; I finished, because the project earned the effort. But I stopped
trusting the what-if tool at the point I divided $33,266,933 by 1,921.78 and got a
number the page had already told me was $13,761. Everything after that was audit.

### What would make this better for me

1. **Show which pupil count is in the denominator, and prefer the state's.** If the
   engine's membership disagrees with AOE's published weighted ADM, say so on screen
   and refuse the rate, or use AOE's. The goldens already concede the membership
   engine is untested; the tool should not bet a tax rate on it.
2. **Put a source line under the headline number on every town page** — publisher,
   table, date, link. One line, same place, always.
3. **Flag the eleven.** If a district is in the residual table, say so where its
   rate is displayed, with a link to the explanation.
4. **Say what a blank is, including the fifth one.** "No group yet" needs a
   sentence that commits to a reason and names who holds the answer.
5. **Publish the CLA on the town page.** You hold it; the tool demands it; not
   showing it makes the tool unusable for anyone who does not already have the
   Tax Department's spreadsheet.
6. **Say what the comparison set is** — "of the 258 towns with a published rate" —
   and drop the four decimal places on town means.
7. **Countersign the parameters.** Open the statute in a browser, read eleven
   numbers, put a name and a date on the file. I did it in four minutes; it is the
   single largest credibility gain available to you, and it costs one afternoon for
   the whole layer.

---

## For the builder

| # | Status | Finding | Evidence |
|---|---|---|---|
| 1 | **Defect (critical)** | **The what-if tool divides AOE's published education spending by its own computed weighted membership instead of AOE's published weighted ADM, and the error flips a statutory test.** Milton FY2026: AOE pupils 2,417.47, spending $33,266,933, per pupil $13,761.05. Tool: membership 1,921.78 (−20.5%), per pupil $17,311, over the 118% excess-spending threshold ($15,926.46), +$1,385 → $18,695 → equalized 2.1748 → billed $1.8975. Published: district 1.5239, billed 1.2462. AOE's per-pupil figure is **below** the threshold; the tool's is **above** it. | `warehouse/aoe-edspend/fy2026.yaml` (Milton row, `pupils: 2417.47`, `spending_per_pupil: 13761.05`); `warehouse/tax-rates/fy2026.yaml` (Milton: `district_rate: 1.5239`, `homestead_rate: 1.2462`); `/model/` with Milton + FY2026, step tree "Per pupil education spending $17,311" → "plus excess spending $18,695" |
| 2 | **Defect (high)** | **A district the project knows it cannot reproduce is displayed with no caveat.** Norwich: chain 2.4038 vs published 1.9183. `/my/town/norwich/` shows 1.4095 (the correct published billed rate) with no note and no source. | `docs/act-127-transition.md` residual table; `/my/town/norwich/` |
| 3 | **Defect (high)** | **No headline figure on a town page carries a citation.** The `.journey-stat` markup is an `h3`, a bare number, and a comparison line; there is no link to any source host on `/my/town/norwich/`. | DOM of `.journey-stat`; a selector for `main a[href*=vermont.gov]` returns none |
| 4 | **Defect (high)** | **Norwich's interstate structure is unrepresented, and the registry substitutes an unrelated New Hampshire school.** `/su/school-administrative-unit-70/` lists "Orford Schools, K–5, operated by —" under Norwich's unit; Marion Cross is K–6; 183 grade 9–12 pupils appear in ADM with no school; "Hanover" occurs only inside `http://sau70.hanovernorwichschools.org//`; the member district is shown as the slug `ud/dresden-interstate-union-school`. | `/su/school-administrative-unit-70/`, `/my/town/norwich/` |
| 5 | **Defect (medium)** | **"No group yet for your district" is a fifth blank kind**, contradicting the taxonomy: "you can ask the people in charge where yours stands" does not say whether the cause is *undetermined*, *missing_input*, or a failed join. | `/my/town/norwich/`, `/my/union/school-administrative-unit-70/` |
| 6 | **Defect (medium)** | **The comparison cards mix populations and precision.** 258 / 176 / 254 denominators, unexplained; medians for rates and "avg per town" to four decimals for counts; raw billed rates ranked across towns with no CLA caveat, while the glossary states that reappraisal "resets the CLA, which changes your tax rate whether or not the school did anything." | `/my/town/norwich/`; `/explanations/vt-4-glossary/` |
| 7 | **Gap** | **CLAs are held but never published.** `warehouse/tax-rates/fy2026.yaml` carries `cla` per town (Norwich 0.9848, Milton 0.8848); the tool requires one and defaults to 0.8; no page shows it. | warehouse vs `/model/` |
| 8 | **Gap** | **The parameter layer is blocked on labour, not access.** `legislature.vermont.gov` loads in a browser; 16 V.S.A. § 4010(d) confirms all eleven weights the site lists. "Could not be reached" is true of automated clients only, and is stated as if it were a fact about the world. | § 4010(d) read live; `/methodology/` |
| 9 | **Gap** | **A non-Vermont municipality is in the registry.** `/my/town/orford-nh/` renders "Your town: Orford Nh", 0 students, "people are not published for this town" — and its schools hang off SAU 70. | live page |
| 10 | **Taste** | Title-casing mangles proper nouns and abbreviations: "Orford Nh", "Barton Id", "Bennington Id", "Mt Holly". | town index |

### Credits worth keeping

- Suppression handled with ranges, a hidden-town list, and the actual rule stated
  ("The state hides any count under 11… complementary suppression").
- Blanks on stat cards are sentences that name the responsible party.
- The residual table and the goldens README say, in public, what the model does not
  prove. That is rarer than the site's own copy claims.

### Not verified

- Whether the engine's 86-of-97 claim holds; I did not run the test suite.
- Whether the excess-spending threshold I used ($13,497 × 1.18) is the FY2026
  statewide average — I took it from the tool's own input field.
- Mobile layout (emulation did not apply), screen-reader behaviour, contrast.
- Real-world correctness of the AOE workbook figures themselves.

### Fix order

1. Denominator: use AOE's published weighted ADM for the rate chain, or block the
   rate when the engine's membership disagrees; add a test that any district whose
   computed membership differs from AOE's by more than a set tolerance cannot
   produce a rate.
2. Source line on every town page.
3. Residual flag on the eleven.
4. Name the fifth blank.
5. Publish CLA per town.
6. Comparison set wording and precision.
7. Interstate districts: model the out-of-state arrangement or say you do not.
8. Countersign the FY2026 parameter file against § 4010 and the yield act, with a
   name and date.

### Copy-paste prompt

> For a fresh session: in jamesjnadeau/vt-education-budget-review, fix the
> denominator defect first. (1) `/model/` divides AOE's published education
> spending by the engine's computed weighted membership (Milton FY2026: 1,921.78)
> instead of AOE's published weighted ADM (2,417.47, in
> `warehouse/aoe-edspend/fy2026.yaml`), which inflates per-pupil spending from
> $13,761 to $17,311, trips the § 5401(12) excess-spending rule Milton does not
> owe, and prints a billed rate of $1.8975 against the published $1.2462. Use the
> published weighted ADM for the tax chain, surface the engine's own membership
> separately, and refuse the rate when the two disagree beyond a stated tolerance;
> add a test over every district AOE publishes. (2) Put a source line (publisher,
> document, date, link) under the headline figure on `/my/town/[slug]`. (3) Flag
> districts listed in `docs/act-127-transition.md` where their rate is displayed.
> (4) Give "No group yet for your district" a committed reason from the four-blank
> taxonomy. (5) Publish each town's CLA from `warehouse/tax-rates/`. (6) Fix the
> Orford NH / SAU 70 records: no out-of-state town as a Vermont town page, no
> schools with an em-dash operator, and say plainly that Norwich's secondary
> students are educated out of state. Report what changed and what remains
> unverified.
