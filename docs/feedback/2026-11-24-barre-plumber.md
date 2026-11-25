# Persona review — a plumber in Barre City

| | |
|---|---|
| **Date walked** | 2026-11-24 |
| **Site as of** | live at https://vermont-school-budgets.org/ |
| **Persona** | 50, master plumber, owns his house and a two-unit rental in Barre City, two kids through the city schools, one at Spaulding. Reads fine, doesn't read long. Does arithmetic in his head and checks it. |
| **Errand** | "Why is my school tax higher than my brother's in Barre Town, and where does the money go?" |
| **Path walked** | `/` → `/my/` → `/my/town/barre-city/` → `/my/district/barre-97/` → `/my/union/barre/` → `/su/barre/` → `/model/` → `/admin/coverage/` |
| **Device** | desktop browser. Mobile **not verified** |

---

## In their words

I've been in Barre my whole life. My brother built in Barre Town. Same school
district, same high school, and he pays less than I do — I've believed that for
years and I wanted a number for it before the next vote.

### What I found out

Barre City: 1.3933. Barre Town: 1.1999. So I was right, and now I can say it: I
pay 19.4 cents more per hundred than he does.

### What I asked out loud

1. **"Why?"** This is the whole reason I came. The district page says the rate runs
   "from 1.1999 to 1.3933 across 2 of 2 towns," and then a box says the rate
   **"cannot be told"** because "a district does not have one tax rate: each town
   sets its own." That's it. Two rates, no reason. If the answer is on this site I
   didn't find it, and I looked at six pages.
2. **"Each town sets its own?"** Last I knew, nobody in Barre City voted on a rate.
   We vote on the school budget in March; the rate comes out of Montpelier. If the
   city set my rate, I'd be calling the city — and I'd be calling the wrong place.
3. **"What's it cost me?"** Nobody on this site will do the one calculation I
   actually want. On a $250,000 house I'm paying about $3,483 and my brother's
   paying about $3,000. I did that on my phone in ten seconds. The site has both
   numbers and won't multiply them.
4. **"Where does the money go?"** Six pages and I still don't know what the Barre
   district spends. Not the total. Not per kid. Not how much is administration,
   which is what everyone at the counter argues about. The "what we have" page says
   there are no budget documents for Barre at all.
5. **"1,008.8 students?"** Eight-tenths of a kid? Someone's going to have to tell me
   why that's not a typo. (I found the answer two pages later, on the supervisory
   union page — it wasn't on the page with the number on it.)
6. **"I rent out the other half of my building. What's my rate on that?"** The site
   shows one rate per town. I know from my tax bill that rented property is taxed
   differently. There's nothing here about it.
7. **"Is this going up or down?"** One year, FY2026, everywhere. No last year, no
   graph, no trend. I can't tell if 1.3933 is normal for us or a bad year.
8. **"Who do I talk to?"** No phone number, no email, no name on this thing except a
   copyright at the bottom. If I'm going to bring a printout to a meeting I want to
   know whose work it is.

### What I'd keep

The comparison line is good. "Lower than 151 of 258 towns" and "Washington County
median 1.8929" told me something in one read: my rate is below my county's middle,
and my county is expensive. That's the kind of sentence I can use. And the totals
reconcile — 1,008.8 plus 1,147.63 is 2,156.43, which is exactly what the district
page says — so I trust the adding.

### Where I stopped

The district page, at the box that says the rate "cannot be told." A number was
just told to me and then I was told it can't be told. That's where I'd close the
tab, and it's a shame, because the two numbers above it were right.

### What would make this better for me

1. **Answer the question the page raises.** One sentence on the district page:
   "Same budget, different bill. Barre City's rate is higher because its CLA is
   0.6762 against Barre Town's 0.7852 — the same school spending spread over a
   different share of property value." Then show both towns side by side in dollars.
2. **A dollar line on every rate.** "$1.3933 per $100 of value — about $3,483 on a
   $250,000 house."
3. **Say who actually sets the rate.** "Voters approve the district budget; the rate
   is then computed from it and from your town's assessed values." Right now the page
   says the town sets it, which is wrong and sends people to the wrong office.
4. **Show the spending even when the document is missing.** If you have the state's
   per-pupil figure, show it and label where it came from. Something beats nothing.
5. **Put the non-homestead rate on the town page.** I own a rental; I'm not the only
   one; you have the number.
6. **Two years, at least.** A rate with no last year can't tell me anything about
   next year.

---

## For the builder

| # | Status | Finding | Evidence |
|---|---|---|---|
| 1 | **Defect** | **"Each town sets its own" rate is factually wrong.** Voters approve the district budget; the homestead rate is computed from district spending, the yield, the statewide adjustment and the town's CLA. The sentence attributes the rate to the town and sends residents to the wrong office. | `/my/district/barre-97/`, `/my/union/barre/` |
| 2 | **Defect (high)** | **The two-town rate difference is displayed and never explained, though the warehouse holds the cause.** Barre City 1.3933 (CLA 0.6762) vs Barre Town 1.1999 (CLA 0.7852), same district rate 1.302. The page shows the range and then "cannot be told." | `warehouse/tax-rates/fy2026.yaml` (Barre City / Barre Town rows); `/my/district/barre-97/` |
| 3 | **Gap** | **No spending figure for the district.** "No budget documents held for this supervisory union"; no per-pupil, no administration, no transportation, from any page in the journey. | `/su/barre/`; `/admin/coverage/` |
| 4 | **Gap** | **Non-homestead rates are held and never displayed.** Barre City 1.8224, Barre Town 1.5694. A landlord cannot find his own rate. | `warehouse/tax-rates/fy2026.yaml`; no page shows it |
| 5 | **Gap** | **One year only.** No prior-year rate, no trend, anywhere in the journey. | `/my/town/barre-city/`; `warehouse/tax-rates/` holds FY2026 alone |
| 6 | **Defect** | **The decimal on the student count is unexplained where it appears.** "1,008.8" on the town page; the explanation is on the SU page. | `/my/town/barre-city/` vs `/my/union/barre/` |
| 7 | **Defect** | **Schools never appear in the journey.** Barre City Elementary/Middle, Barre Town Elementary & Middle and Spaulding High exist only on the registry page, and the operator column reads `ud/barre-97`. | `/su/barre/` vs `/my/district/barre-97/` |
| 8 | **Gap** | **No next step and no contact.** No vote date, no board meeting, no email, no name beyond the footer copyright. | any page |

### Credit

- "Lower than 151 of 258 towns," with the county median, is the most usable line on
  the site for this reader.
- The arithmetic reconciles: the two town counts sum exactly to the district total.

### Not verified

- Mobile layout (emulation did not apply in the test session).
- Whether the FY2026 non-homestead rate applies to the rental exactly as I assumed.

### Fix order

1. Explain the within-district spread with the CLA, in one sentence, on the district
   page and on every town page.
2. Fix "each town sets its own."
3. Dollar line per rate.
4. Show held spending even when the document is missing, labelled.
5. Non-homestead rate on the town page.
6. Prior-year rate.

### Copy-paste prompt

> For a fresh session: in jamesjnadeau/vt-education-budget-review, fix the
> within-district rate spread, which is the site's most common resident question and
> is currently answered with "cannot be told." (1) On `/my/district/[slug]` and
> `/my/town/[slug]`, when towns in one district carry different billed rates, show a
> table of town / CLA / district rate / billed rate / example bill on a $250,000
> house, and one sentence naming the CLA as the cause. Data is already in
> `warehouse/tax-rates/fy2026.yaml`. (2) Replace "each town sets its own" with an
> accurate sentence: voters approve the district budget; the rate is computed from
> district spending, the yield, the statewide adjustment and the town's CLA. (3) Add
> the non-homestead rate to the town page. (4) Explain the student-count decimal on
> the town page where the number is, not one page later. (5) Link the town and
> district journey pages to their schools. Report what changed and what is still
> unverified.
