# Persona review — an adult who reads at a 5th-grade level, Milton

| | |
|---|---|
| **Date walked** | 2026-11-24 |
| **Site as of** | live at https://vermont-school-budgets.org/ |
| **Persona** | 41, homeowner in Milton, two kids at Milton Elementary, reads at about a 5th-grade level — reads the first line of a block and skips the rest |
| **Errand** | "Is my school bill going up, and is my school closing?" |
| **Path walked** | `/` → `/my/` → `/my/town/milton/` → `/my/union/milton/` → `/my/grouping/19/` → `/su/milton/` → `/model/` → `/admin/coverage/` |
| **Device** | desktop browser. Mobile **not verified** — device emulation did not take in the test session |

The difference from the 10-year-old review: a kid asks out loud and gets help. An
adult who reads slowly does not ask. She decides the site is not for her, and she
leaves without telling anyone. Every question below is one she thought and did
not say.

---

## In their words

I own a house in Milton. My school tax was about $3,700 last year. I heard the
school budget might change and somebody might merge us with another town, so I
looked it up. I can read fine. What I can't do is hold a long sentence in my head
while I figure out a word I don't know, so I read the first line of everything
and skip the rest.

### What I found out

Milton's school tax rate is 1.2462. That's lower than 182 towns. I got that far.
After that I mostly got numbers I couldn't use and words I didn't know.

### What I asked out loud

1. **"Is 1.2462 high or low, and what does it do to my bill?"** The site says
   "lower than 182 of 258 towns," which is the best sentence on the whole site —
   I understood that in one read. But it never turns the number into dollars. I
   do not know if 1.2462 means my $3,700, or double that, or a tenth of it.
2. **"Is this the school part of my bill or the whole thing?"** My tax bill has
   the town, the school, and the fire department on it. Nothing on that page says
   the rate is only the school share.
3. **"What's a homestead?"** I own the house I live in, so I think that's me. But
   I had to guess, and I guessed after I read the number.
4. **"Where's the budget?"** I want one line: what Milton's schools spend in
   total, and what that is per kid. There is no dollar figure for Milton anywhere
   I could find. That's the thing I came for.
5. **"Is my school closing?"** I heard about mergers. The site's answer is three
   clicks deep, and then it says the groups were redrawn and "we cannot see how."
   So the one thing I'm actually scared about is the one thing it can't tell me.
6. **"Who are you, and who pays you?"** There's no name, no phone number, no
   email, no "about." Just a copyright line at the bottom. If I'm going to repeat
   a number at town meeting, I need to know who made it.
7. **"What am I supposed to do about it?"** No vote date, no board meeting, no
   link to Milton's own website where the budget document lives. I read the whole
   thing and I still don't know what happens next.
8. **"Why does it say 'send in' next to Milton?"** On the "what we have" page,
   every year next to Milton says "send in." I thought I was supposed to send
   something. I don't have anything to send. I closed it.
9. **"Why does it say 'not usable'?"** Next to English learners and free lunch.
   That sounds like a broken page.
10. **"What's a common level of appraisal?"** The what-if tool asked me for one.
    It already had `0.8` in the box. I don't know if that's my town's number or a
    made-up one, and there's no way for me to find out, so I stopped.
11. **"Why does one page say 1.2462 and the other says 1.89?"** The Milton page
    says 1.2462. The what-if tool, with Milton picked and the same year, says
    $1.8975. I don't know which one is right. If I'd repeated either one at a
    meeting I'd have been wrong or right by luck.

### Where I stopped

Twice. First on Milton's page, at the paragraph under the numbers — one sentence,
fifty words, three semicolons, and it's the only place the words are explained.
Then on the what-if tool, at "common level of appraisal," with 0.8 already in the
box and no idea whose number that is.

### What would make this better for me

1. **A dollar line under the rate.** "Milton: $1.2462 per $100 of house value.
   On a $300,000 house that's $3,739 a year. Vermont's median is $4,544." I'd
   understand the entire site from that one line, and I'd tell my neighbor.
2. **Three short definitions above the numbers instead of one long sentence
   below.** One line each, no semicolons: "Homestead: the house you live in. This
   is only the school part of your tax bill. Supervisory union: the office that
   runs the business for nearby districts."
3. **One box that says what this means for me:** my rate, my bill, my school, my
   vote date. Four lines, no more.
4. **Put the schools back on my town page** — Milton Elementary, Middle, High.
5. **Say "we don't have it yet" instead of "send in."** And tell me where the real
   document is so I can go get it myself.
6. **A one-page "who runs this."** Name, contact, who pays for it, and how to tell
   you I found a mistake.
7. **Don't show me a rate you made up.** If a box is a guess, say so in the box,
   or give me a blank. I'd rather have a blank than a number I can't trust.

---

## For the builder

New findings here, plus the ones already in the 5th-grader review (defects 1–5
there: placeholder inputs driving the tool's rate, `not usable`, `Member
districts (0)` / `town/milton`, the year-label mismatch, the silent no-op on
district selection). Repeated here only where this persona hits them harder.

| # | Status | Finding | Evidence |
|---|---|---|---|
| 1 | **Defect** | **The only explanation of the numbers on Milton's page is one 50-word sentence with three semicolons, placed after the numbers.** Reading-level estimate for the page is around grade 12–13 (approximate; headings inflate the formula), against a 5th-grade target. | "In the figures below, the homestead tax rate is the school tax rate for the home you live in; students counted by the state (ADM) are the public school students who live here; and a supervisory union is a group of nearby school districts that run their schools' business together." — counts to 50 words. |
| 2 | **Defect** | **The tool invents inputs that `/su/milton/` says the site does not hold, and divides by the wrong denominator.** The SU page lists `poverty_185_fpl`, `english_learners` and `persons_per_square_mile` as "not yet held for any district" — and `/model/` fills them with 40 / 8 / 30 from the demo, plus a CLA of 0.8 the site does not hold at all. Underneath that, it divides AOE's published spending by its own computed membership (1,921.78) rather than AOE's published weighted ADM (2,417.47), so per-pupil spending reads $17,311 instead of $13,761 and the excess-spending rule fires. One page says the number cannot exist; another prints it, 43 percent high. | `/su/milton/` open "Weighted long-term membership — missing inputs"; `site/src/pages/model/index.astro:183,186,202,231`; `warehouse/aoe-edspend/fy2026.yaml` (Milton) — see finding 1 in `2026-11-24-norwich-college-professor.md` |
| 3 | **Defect** | **Two surfaces disagree about whether Milton's spending-per-pupil exists.** `/su/milton/` says "Spending per weighted pupil — needs education spending… none of the 6 fiscal years tracked here are normalized yet." `/model/` shows **$17,311** for the same district and year, sourced to "the state AOE figure." If the AOE figure is usable, say so on the SU page; if it is not, the tool should not print a number derived from it. | live `/su/milton/` (open the details) vs `/model/` with Milton + FY2026 |
| 4 | **Gap** | **No "who runs this" page and no way to report an error.** Nav and footer links are content pages plus "Official AOE site"; the only attribution is `© 2026 James Nadeau · Not affiliated with the State of Vermont`. No contact, no funding statement, no "last updated" on the figures. | link inventory of `header`, `nav`, `footer` on any page |
| 5 | **Gap** | **No next step.** Nothing names the vote date, the school board meeting, or the district's own site (`https://www.mtsd-vt.org/` is on `/su/milton/` as "Website", not on the town page). A resident finishes the journey with no action available. | `/my/town/milton/`, `/my/grouping/19/` |
| 6 | **Gap** | **"send in" reads as an instruction to the reader.** On `/admin/coverage/`, Milton's six cells all say "send in", under a headline of "Missing (309)". The honest meaning is "we have not collected it," and the fix is that wording plus a pointer to where the document probably lives. | live `/admin/coverage/` |
| 7 | **Gap** | **The honest blocker is behind a disclosure, and the summary line reads as the site's fault.** "Weighted long-term membership — missing inputs" collapses open to the real reason: the published reports changed grade bands at the Act 127 boundary in July 2024, so no two consecutive years share a band regime. The one-sentence version of that belongs on the page. | `/su/milton/` details |
| 8 | **Gap** | **The journey is organised by government structure, not by the reader's question.** For Milton, stops 2 and 3 return nothing: the SU page is three school names and a note that everything else is blocked; the group page says the groups were redrawn and cannot be seen. Two of three clicks produced no answer for this persona. | `/my/union/milton/`, `/my/grouping/19/` |
| 9 | **Taste** | Nav labels "Modeling" and "Explanations" sit above "What-if tool" and "Words to know" in collapsed dropdowns. For a reader who scans rather than reads, the words that would get her there are hidden behind the words that would not. | `header` markup: `<details class="nav-group"><summary>Modeling</summary>` |

### The one thing to keep

"**lower than 182 of 258 towns**" is the single most usable sentence on the site
for this reader: a comparison, in plain words, with no vocabulary. That pattern
— *plain comparison, then the number* — is the model for every other figure.

### Not verified

- Mobile / phone layout (emulation did not apply; `window.innerWidth` stayed at
  desktop width). This persona is likelier than not to be on a phone.
- Screen-reader behaviour, contrast, chart accessibility names.
- How she would react to the `Explanations` series — she would have to find it
  first, which the review suggests she would not.

### Fix order

1. Dollar line under the rate, with one worked house example.
2. Three one-line definitions above the numbers; delete the 50-word sentence.
3. Source or refuse the four placeholder inputs in `/model/`.
4. "What this means for you" box: rate, bill, schools, vote date.
5. "we don't have it yet" + where the document lives, replacing "send in".
6. A one-page "who runs this," with a contact and an error-report path.
7. Reconcile `/su/[slug]` and `/model/` on whether AOE spending is usable.
8. Plain-language one-liner on the SU page that says *why* the state's reports
   can't be reduced to the statutory figure.

### Copy-paste prompt

> For a fresh session: in jamesjnadeau/vt-education-budget-review, add a
> plain-language layer for readers at a 5th-grade level, without weakening the
> provenance rules. (1) On `/my/town/[slug]`, print a dollar line under every
> homestead rate using the site's own published rate — "$1.2462 per $100 of value;
> on a $300,000 house, $3,739 a year; Vermont median $4,544" — derived, not
> hardcoded, with the house value clearly labelled as an example. (2) Replace the
> 50-word semicolon sentence above the comparison charts with three one-line
> definitions of homestead, ADM and supervisory union. (3) Add a "what this means
> for you" block on the town page: your rate, an example bill, your schools by
> name, and the date of the next budget vote, sourced. (4) In `/model/`, source or
> refuse `econ`, `el`, `density`, `cla` — `/su/[slug]` already states that poverty,
> EL and density are not held for any district, so the tool must not compute from
> defaults; add a test. (5) On `/admin/coverage/`, replace "send in" with "we have
> not collected it yet" and link each row to the district site and the AOE
> document index. (6) Add `/about/`: who runs the site, who funds it, how to report
> an error. Keep every new string at or below a 6th-grade reading level, and add a
> test that fails if the town page's reading level regresses.
