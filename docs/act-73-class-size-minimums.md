# Class size minimums: the statute, and AOE's working definitions

Act 73 of 2025, Sec. 6 wrote average class size minimums into the education quality standards
at 16 V.S.A. § 165(a)(9). They take effect **July 1, 2026** and first bind the **2026–2027
school year** — the year FY2027 budgets pay for. The State Board rules that are supposed to
say how they work are not written yet.

Into that gap the Agency of Education issued a memo of **February 6, 2026** with *working
definitions*, developed with a field working group, so districts could build FY2027 budgets
and staffing against something. This file records what the statute requires, what the memo
says, and — the part that matters for this project — exactly how much weight each carries.

## Weight of authority

**The memo is not law and does not pretend to be.** Its own second paragraph says the
definitions "do not supplant the rule-making responsibilities of the State Board of
Education, per Act 73, Section 8(a)," and that AOE wrote it as a response to immediate
requests from SU/SDs.

So, in this repo's terms:

- **16 V.S.A. § 165(a)(9), as amended by Act 73, Sec. 6** is authority for the *rule*. Any
  parameter that ever encodes a class size minimum cites the statute, per
  [parameter-verification.md](parameter-verification.md).
- **The memo** is authority for *how AOE currently intends to measure compliance*, and for
  what districts were told while writing FY2027 budgets. That is a real and citable fact
  about the world. It is not a source for a number the engine computes from.
- **Act 73, Sec. 8(a)(1)(A)** requires the State Board to initiate rulemaking amending the
  Education Quality Standards rule (2000 series, 22-000-003) **on or before August 1, 2026**
  to ensure compliance with these standards. When that rule lands it supersedes the memo, and
  this file needs revisiting.

The memo also flags its own expiry date on one point: definitions for secondary settings "may
require revision once statewide graduation requirements are finalized" — those are due from
the same section, Sec. 8(a)(1)(B), by **July 1, 2027**, effective for the class of 2031.

## Sources

1. **AOE memo, "Working Definitions to Meet the Class Size Minimums Required by Act 73,
   Section 6 for the 2026-2027 School Year,"** Secretary Zoie Saunders, 2026-02-06. Held at
   [`intake/aoe-guidance/2026-02-06-class-size-minimums/`](../intake/aoe-guidance/2026-02-06-class-size-minimums/),
   `sha256:b10058ec…`, retrieved 2026-08-20 from
   <https://education.vermont.gov/documents/edu-sbe-class-size-min-working-definitions-memo>
   by hand, because that host refuses automated clients.
2. **2025 Acts and Resolves No. 73, as enacted**, Secs. 5–8 and Sec. 76(c)(1)–(2).
   <https://legislature.vermont.gov/Documents/2026/Docs/ACTS/ACT073/ACT073%20As%20Enacted.pdf>,
   retrieved 2026-08-20 with `npm run vt:fetch`,
   `sha256:44f0e81743a7f7860b82d81d665edcedc0143902438577b17b0149210deb38f4`. All statutory
   quotations below are from this text.
3. **SCED course codes** (National Center for Education Statistics), the classification the
   memo leans on throughout: <https://nces.ed.gov/scedfinder>.

## What the statute requires

> The school complies with average class size minimum standards; provided, however, that when
> class size minimums apply to content areas, an individual class may be smaller than the
> minimum average. As used in this subdivision, "content area" means a group of courses within
> a specific licensing endorsement area.
> — 16 V.S.A. § 165(a)(9)

| Grades | Average class size minimum | Statutory qualifier |
|---|---|---|
| 1 | **10** students | — |
| 2–5 | **12** students | — |
| 6–8 | **15** students | in all **required** content areas |
| 9–12 | **18** students | in all **required** content area classes |

Two structural rules travel with them:

- **Multiage classrooms** for grades K–8 are limited to **two grade levels per classroom**
  (§ 165(a)(9)(A)(v)).
- **Class sizes shall not exceed** local and State fire code maximum occupancy limits,
  including egress and safety requirements (clause (vii)). The floor has a ceiling.

**Statutory exclusions** (clause (vi)) — prekindergarten, kindergarten, career and technical
education, flexible pathways, terminal courses, advanced placement courses, courses that
require specialized equipment, and driver's education; plus small group services for special
education, supplemental or targeted academic intervention, or English learner instruction.
Most of the memo is an attempt to say what four of those words mean.

**Waivers** (clause (B)) — a school board may ask the State Board for a waiver where a school
cannot comply because of **geographic isolation**, or where it has an implementation plan to
get there that may include consolidation or merger. The State Board defines geographic
isolation in rule; its decision is final. This is the seam where class size meets the
small/sparse work in [`docs/sparse-schools/`](sparse-schools/).

**Consequence** (clause (C)) — if the Secretary finds a school out of compliance **over three
consecutive school years**, the Secretary may recommend State Board action under § 165(b),
whether or not every other quality standard is met.

**And a brake on that consequence** — Act 73, Sec. 7 prohibits the State Board from ordering
district or school consolidation for class size noncompliance where the consolidation would
require school construction costs exceeding the district's capital reserve account, until the
General Assembly establishes new district boundaries and acts further on the consequences of
failing the quality standards.

## The working definitions

### Calculating the average

- **Grades with content areas:** a straight average within a single school, in a single year —
  students enrolled in a content area's non-exempt courses ÷ number of courses in that content
  area.
- **Lower grades:** total students in a grade ÷ total classrooms for that grade.
- **Content area** is standardized to **SCED** codes. Core categories named: **01 Math,
  02 English, 03 Social Studies, 04 Science, 05 Arts**. For elementary grades the memo points
  at the **2300x** codes by grade level as the endorsement area.
- **Multiage classrooms take the lower grade's minimum.** A grade 1–2 classroom is held to 10,
  not 12.
- **Student age is not a factor.** An 8th grader taking algebra at the high school counts
  toward the high school's math average.

### Exemptions, one at a time

| Question | AOE's working answer |
|---|---|
| **Terminal course** | The highest level of a content area offered — last in a sequence — *and* above the district's graduation requirements. Both tests must be met. Districts must **document** which of their courses qualify for 2026–2027, accepting that districts will differ. To be revisited once statewide graduation requirements exist. |
| **Honors courses** | Not terminal as a class. Only terminal if last in sequence *and* above graduation requirements — honors algebra usually is neither. |
| **Combined honors/AP sections** | AP alone is exempt, but AP students sitting in an honors classroom **count** in that class's enrollment for the content area average. |
| **Advisory / homeroom** | Typically SCED 22 or 23, therefore **exempt**. |
| **Specialized equipment** | Highly specialized instructional equipment that is integral to the curriculum (hands-on student use), requires dedicated space or safety protocols, is not standard furniture or basic supplies, and is used only in narrow subject areas. Examples given: industrial CTE machines (welders, CNC, automotive lifts), fabrication tools (3D printers, laser cutters), commercial kitchens and culinary equipment, media production gear, art kilns and ceramics wheels. Districts must **document** their claims. |
| **Flexible pathways** | Uses the EQS definition — CTE, virtual learning, work-based learning, service learning, internships, apprenticeships, community research, civic and community engagement, dual enrollment, early college, under the supervision of an appropriately licensed educator. CTE has its own SCED codes. AOE expects this to change with the statewide graduation requirements it must recommend for ESEA compliance. |
| **Related arts** (music, art, world language, health, PE, SEL/guidance, library) | SCED codes them **outside** the core categories — 05 Music & Art, 24 World Language, 22003 Study Skills, 08 Physical Education, 22999 Miscellaneous–Other for guidance. The memo then says "**the classes will be counted** in the class size minimums," with AOE and LEAs to work through Miscellaneous courses to decide what is exempt. |

### Where the memo does not resolve cleanly

Worth knowing before anyone builds anything on these definitions:

1. **Related arts: counted or not?** Three answers pull against each other. Content area is
   defined as the SCED core (01–05); advisory coded 22/23 is called exempt; and the related
   arts answer says these classes "will be counted." A class coded 22003 (library) cannot be
   both exempt-because-22 and counted. The memo's own escape hatch — AOE and LEAs working
   through Miscellaneous courses — is an admission that this is unsettled.
2. **"Required" content areas have no definition.** The statute limits the grade 6–8 and 9–12
   minimums to *required* content areas and classes. The memo never defines "required," and
   defers the graduation requirements that would settle it to Sec. 8(a)(1)(B) rulemaking, due
   July 1, 2027 — after the first year these minimums bind.
3. **Kindergarten in a multiage classroom.** The memo's multiage question offers "K and 1st
   grade" as an example, and answers that the minimum becomes the lower grade's value. But
   kindergarten is *excluded* from the minimums by clause (vi), and has no value to be the
   lower of. A K–1 classroom's treatment is genuinely unclear on this text.
4. **Documentation is district-by-district by design.** For both "terminal" and "specialized
   equipment," the memo asks districts to document their own determinations and says
   explicitly there "will be some differences between districts." Whatever AOE publishes from
   the first collection will therefore be comparable across districts only as far as those
   local judgments were.

## Compliance and the collection timeline

Act 73, Secs. 6(b)–(c) set a multi-year accountability process — annual AOE data collection,
a corrective action plan with AOE technical assistance for districts out of compliance,
recommendations to the State Board, and the Board's own duty to ensure the standards are met.
AOE says it will publish the data collection, reporting and accountability framework **after**
the State Board finishes the Sec. 8(a) rulemaking.

| When | What |
|---|---|
| July 1, 2026 | Sec. 6 and Sec. 7 take effect (Act 73, Sec. 76(c)(1)–(2)). |
| On or before Aug 1, 2026 | State Board must **initiate** EQS rulemaking on class size (Sec. 8(a)(1)(A)). |
| **Fall 2026** | AOE intends to give districts **baseline class size averages from 2025–2026**, computed on these working definitions, to support FY2028 budget building. |
| 2026–2027 | First school year the minimums bind. |
| Spring 2027 | First actual collection, through the **End of Year collection (DC04)**. |
| Fall 2027 | First reporting of collected class size data. |
| On or before July 1, 2027 | Statewide graduation requirements rulemaking initiated (Sec. 8(a)(1)(B)), which the memo expects to move the "terminal course" and flexible pathways definitions. |

Note what that timeline means: **compliance data for the first binding year does not exist
until fall 2027**, and the three-consecutive-year clock in clause (C) cannot expire before
then. Anyone claiming a district is or is not "in compliance" during FY2027 is working from
projections, not measurements.

## What this means for this repo

- **No parameters are derived from this memo.** Nothing here feeds the engine today. If class
  size minimums are ever encoded, the values come from § 165(a)(9) — 10 / 12 / 15 / 18 — cited
  to statute and marked `verified: true` only against the operative sentence, never from this
  file or from the memo.
- **The memo is the citation for method, not for law.** Use it when explaining how averages
  would be measured, or what districts were told during FY2027 budget season. Say plainly that
  it is guidance predating the rule.
- **Expect the fall 2026 baseline to be publishable data.** AOE's 2025–2026 baseline averages,
  when they reach districts, would be an intake artifact of real value — the first numbers
  attached to these definitions.
- **The waiver path links to the small/sparse work.** Geographic isolation waivers under clause
  (B) and the "small by necessity / sparse by necessity" framework in
  [`docs/sparse-schools/`](sparse-schools/) are aimed at overlapping populations of schools and
  are decided by the same Board; neither defines the other.
- **The excluded-courses attachment is missing** from the copy we hold. It is the operative
  list for what drops out of the averages. See the intake README.
