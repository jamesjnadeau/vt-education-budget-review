# Persona review — a mother of three in Hinesburg

| | |
|---|---|
| **Date walked** | 2026-11-24 |
| **Site as of** | live at https://vermont-school-budgets.org/ |
| **Persona** | 39, three kids at Hinesburg Community School and Champlain Valley Union High, works part-time, owns a house bought in 2019, phone-first, talks to other parents in a group chat |
| **Errand** | "What are my kids' schools costing, and is Hinesburg about to be merged or closed?" |
| **Path walked** | `/` → `/my/` → `/my/town/hinesburg/` → `/my/district/champlain-valley-56/` → `/my/union/champlain-valley/` → `/su/champlain-valley/` → `/combiner/` → `/model/` → `/groupings/` |
| **Device** | desktop browser. Mobile **not verified** — and this persona is the one who would actually be on a phone |

---

## In their words

I have three kids, in second, sixth and tenth grade. I'm in a group chat with
eleven other Hinesburg parents and every March we all try to figure out the school
budget at the same time. I heard we might get merged with the other CVU towns, so I
wanted to know what that means for us.

### What I found out

Our rate is 1.0207, and it's lower than 230 of 258 towns. That surprised me,
because everyone complains. Then I found the district page, and there's a range:
**1.0207 to 1.8777.** Same five towns, same school district, same high school.
I pay the lowest and Shelburne pays the highest.

### What I asked out loud

1. **"Wait — Shelburne pays 84% more than us for the same schools?"** If my house
   were valued at $400,000, I'd pay about $4,083 and my friend in Shelburne would
   pay about $7,511. That's $3,428 a year, for the same high school my daughter
   rides the bus to. **Why?** The district page says the rate "cannot be told"
   because each town sets its own. That's not an answer, that's the question again.
   If I put this in the group chat without an explanation, I will start a fight.
2. **"What do my kids' schools actually cost?"** I can't find a dollar figure for
   Hinesburg Community School or for CVU. Not total, not per student.
3. **"Where are the schools?"** Nothing on my town page. Nothing on the district
   page. I finally found them on a page called "Champlain Valley Supervisory
   District," which is not a place I would have looked. My kids' schools should be
   the second thing on my town's page, after my rate.
4. **"Is Hinesburg getting merged or closed?"** This is the actual reason I opened
   the site. The group page says the Act 170 groups were redrawn and "we cannot see
   how." I understand being honest, but that leaves me with nothing, and the thing I
   am afraid of is my second grader's school.
5. **"Can I model it?"** I tried the combine tool. The year menu says "FY2025 (not
   ready yet)" and the page says it cannot show today's rate or the change. I tried
   the what-if tool with my district and got four lines of "blocked: figure not
   published." So the answer to my question is: no.
6. **"At least 3,954.95 students"?** "At least," and then two decimal places. Is that
   a typo, or does somebody not know? Either way it doesn't read like a number I
   should trust.
7. **"Who is St George?"** It's in our district, it has no school, and nobody says
   what happens to its kids. I assume they tuition in, but I shouldn't have to
   assume.
8. **"When do we vote, and on what?"** No date, no board, no meeting, nothing I
   could put on the calendar.

### The one thing that would have kept me

A box on my town page: **my rate, my example bill, my three schools by name, and one
line on why my neighbor's rate is different.** Four lines. I would have screenshotted
it and sent it to twelve people. Instead I have a number I can't explain and no
schools, and I'm not going to forward something I can't defend in a group chat.

### Where I stopped

The what-if tool, when my district came back completely blocked. Before that I'd
already been let down twice — no schools on my town page, and "cannot be told" on
the district page.

### What would make this better for me

1. **The five towns side by side, in dollars.** Hinesburg / Charlotte / Shelburne /
   St George / Williston, each with its rate, its CLA, and what it means on a
   $400,000 house. One table answers the question every parent in the district
   actually asks.
2. **One sentence explaining the spread** — same spending, different property
   values.
3. **My schools on my town page**, with grades, and a note when a town has no school
   of its own.
4. **Say what happens next** on the merger question: who decides, what the timeline
   is, where the meetings are. "You can ask the people in charge" needs the names
   and dates attached.
5. **Stop writing "at least" next to two decimals** — say "about 3,955, and possibly
   more, because the state hides small counts."

---

## For the builder

| # | Status | Finding | Evidence |
|---|---|---|---|
| 1 | **Defect (high)** | **A single district's five towns carry rates from 1.0207 to 1.8777 (an 84% spread), shown as a range with no cause and then declared "cannot be told."** The cause is the CLA, held in the warehouse: Hinesburg 1.1480, Charlotte 0.9320, St George 0.6503, Shelburne 0.6240, Williston 0.6289, against one district rate of 1.6193. | `warehouse/tax-rates/fy2026.yaml`; `model/goldens/ud-champlain-valley-56-fy2026.yaml`; `/my/district/champlain-valley-56/` |
| 2 | **Defect (high)** | **Schools are absent from the journey.** Hinesburg Community School (K–8) and Champlain Valley Union High (9–12) appear only on `/su/champlain-valley/`, never on the town or district page. | `/my/town/hinesburg/`, `/my/district/champlain-valley-56/` vs `/su/champlain-valley/` |
| 3 | **Defect** | **The what-if tool returns nothing for this district**, while the site elsewhere reproduces its FY2026 rate to four places. CVU: all four results "blocked: figure not published"; the golden fixture pins 1.6193 and four town rates. | `/model/` with Champlain Valley #56 + FY2026; `model/goldens/ud-champlain-valley-56-fy2026.yaml` |
| 4 | **Defect** | **"At least 3,954.95 students"** — a lower bound printed to two decimals with no explanation of the suppression behind it, on the district page. | `/my/district/champlain-valley-56/` |
| 5 | **Gap** | **The combiner, the one tool built for her question, is a stub.** Year select reads "FY2025 (not ready yet)"; the page states it "cannot show the rate today, or the change, yet." | `/combiner/` |
| 6 | **Gap** | **The merger question ends with a shrug.** Act 170 groups were redrawn and the site cannot see the new rosters; the group page offers "you can ask the people in charge" with no names, body or dates. | `/my/grouping/19/` and equivalents; `/groupings/` |
| 7 | **Defect** | **St George is listed as a member town with no school and no note.** Parents in four other towns will ask; the page does not say its pupils are tuitioned. | `/su/champlain-valley/` |
| 8 | **Gap** | **No vote date, no board, no calendar event** anywhere in the journey. | any page |
| 9 | **Defect** | **Schools are attributed to raw slugs** (`ud/champlain-valley-56`) in the only table that names them. | `/su/champlain-valley/` |

### Credit where it is due

`/combiner/` carries the clearest explanation on the entire site of *why* the rate
cannot be computed: the state does not publish each district's density, state-placed
pupils, poverty count or English learners. That paragraph is plain, specific, and
blames nobody. It is on the least-visited page in the project. It belongs on every
SU and district page, in the same words.

### Not verified

- Mobile layout — the emulation did not apply in the test session, and this is the
  persona most likely to be reading on a phone. **This is the largest untested risk
  in the whole set of reviews.**
- Whether St George pupils are in fact tuitioned into Williston.

### Fix order

1. The five-town table with CLA and dollars, on the district and town pages.
2. Schools on the town and district pages.
3. "At least X" → plain words about suppression.
4. St George and any other no-school town: one sentence.
5. Vote date and board link.
6. Lift the combiner's explanation onto the SU and district pages.
7. Unblock the tool for union districts, or say plainly why it cannot run and what
   would unblock it.

### Copy-paste prompt

> For a fresh session: in jamesjnadeau/vt-education-budget-review, make the
> multi-town district legible, because that is where residents actually live. (1) On
> `/my/district/[slug]` and `/my/town/[slug]`, when a district has several towns,
> render a table of town / CLA / district rate / billed rate / annual bill on a
> $400,000 house, and one plain sentence naming the CLA as the reason the rates
> differ (CVU #56 spans 1.0207 to 1.8777 across five towns on a single district rate
> of 1.6193; data is in `warehouse/tax-rates/fy2026.yaml` and pinned by
> `model/goldens/ud-champlain-valley-56-fy2026.yaml`). (2) Put each town's schools,
> with grades, on the town and district pages, sourced from the registry, and note
> when a member town has no school of its own. (3) Replace "at least 3,954.95" with
> plain wording that explains the state's suppression of small counts. (4) Move the
> `/combiner/` explanation of which inputs the state does not publish onto the SU and
> district pages verbatim. (5) Investigate why CVU #56 returns "blocked: figure not
> published" in `/model/` when the golden fixture reproduces its rate; state the
> reason on screen. Report what changed and what is still unverified.
