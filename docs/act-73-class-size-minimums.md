# Class size minimums: the statute, and AOE's working definitions

Act 73 of 2025, Sec. 6 wrote average class size minimums into the education quality standards
at 16 V.S.A. § 165(a)(9). They take effect **July 1, 2026** and first bind the **2026–2027
school year** — the year FY2027 budgets pay for. The State Board rules that are supposed to
say how they work are not written yet.

Into that gap the Agency of Education issued a memo of **February 6, 2026** with *working
definitions*, developed with a field working group, so districts could build FY2027 budgets
and staffing against something. Four months later **Act 170 of 2026 (H.955) changed the ground
under it**: Secs. 29a–29e put eight definitions into statute, paused enforcement, and told the
State Board it may define the same terms differently in rule.

This file records what the statute requires, what the memo says, where Act 170 overtook the
memo, and — the part that matters for this project — exactly how much weight each carries.

**Read the [Act 170 section](#what-act-170-of-2026-changed) before relying on any definition in
the memo.** The memo is still the only account of *how AOE intends to measure*, and districts
built FY2027 budgets on it, so it is not obsolete. But on the meaning of "average class size,"
"content area," "class" and "student," the memo is a February reading and statute is the
June answer.

## Weight of authority

**The memo is not law and does not pretend to be.** Its own second paragraph says the
definitions "do not supplant the rule-making responsibilities of the State Board of
Education, per Act 73, Section 8(a)," and that AOE wrote it as a response to immediate
requests from SU/SDs.

So, in this repo's terms:

- **16 V.S.A. § 165(a)(9) (Act 73, Sec. 6) and § 11(a)(36)–(43) (Act 170, Sec. 29c)** are
  authority for the *rule*. Any parameter that ever encodes a class size minimum or a counting
  definition cites the statute, per [parameter-verification.md](parameter-verification.md).
- **The memo** is authority for *how AOE intends to measure compliance*, and for what districts
  were told while writing FY2027 budgets. That is a real and citable fact about the world. It
  is not a source for a number the engine computes from, and where it and Act 170 disagree,
  the act wins.
- **The State Board's rules, when they exist**, will be authority for both — and under Act 170,
  Sec. 29d the Board may write definitions that *differ from the statutory ones*, which then
  repeal. Act 73, Sec. 8(a)(1)(A) requires the Board to initiate that rulemaking (EQS rule 2000
  series, 22-000-003) **on or before August 1, 2026**; the Board's own committee is working to
  rules effective **July 2027**. When they land, this file needs rewriting, not amending.

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
3. **2026 Acts and Resolves No. 170 (H.955), as enacted**, Secs. 29a–29e and Sec. 86.
   <https://legislature.vermont.gov/Documents/2026/Docs/ACTS/ACT170/ACT170%20As%20Enacted.pdf>,
   retrieved 2026-08-20 with `npm run vt:fetch`,
   `sha256:d3f70eb8c88506f030d5b5d2069d126ef6643baabacb788ac562c3c295322925`.
4. **SBE Small Class Size Committee, "Charge and Work Ahead,"** Sarah Buxton, General Counsel
   to the State Board, 2026-06-01. Held at
   [`intake/sbe/2026-06-01-small-class-size-committee/`](../intake/sbe/2026-06-01-small-class-size-committee/),
   `sha256:823cc1f8…`. Counsel's summary of the acts and the rulemaking calendar — evidence of
   how the Board reads its charge, not authority for the law. Every legal claim it makes is
   cited below to the acts themselves.
5. **SCED course codes** (National Center for Education Statistics), the classification the
   memo leans on throughout: <https://nces.ed.gov/scedfinder>.

The statutes site has not yet published the amended § 11 — its § 11 page still shows 2015, No.
48 as the last amendment — so **the enacted text of Act 170 is the citation of record** for the
definitions below, not the compiled section.

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
whether or not every other quality standard is met. **Act 170 paused the clock that feeds this**
— see below.

**And a brake on that consequence** — Act 73, Sec. 7 (now Sec. 7(a), as amended by Act 170,
Sec. 29a) prohibits the State Board from ordering district or school consolidation for class
size noncompliance where the consolidation would require school construction costs exceeding
the district's capital reserve account, until the General Assembly establishes new district
boundaries and acts further on the consequences of failing the quality standards.

<a id="what-act-170-of-2026-changed"></a>
## What Act 170 of 2026 changed

Act 170 (H.955) took effect **July 1, 2026** — the same day as the minimums themselves; its
Secs. 29a–29e are not among the exceptions in Sec. 86. It leaves the 10 / 12 / 15 / 18 table
untouched and changes almost everything around it.

### 1. Enforcement is paused (Sec. 29a(b))

> a school's failure to comply with the class size minimum requirements contained in 16 V.S.A.
> § 165(a)(9) shall not count towards the three consecutive school years of noncompliance that
> enables the Secretary to recommend action to the State Board until the State Board adopts
> updates to the Education Quality Standards rule 2000 series … or July 1, 2027, whichever date
> shall come first.

So the three-year clock does not start with the 2026–2027 school year. It starts when the EQS
rule is updated, or on **July 1, 2027** if the Board has not finished — whichever comes first.
The minimums are in force; the consequence is deferred.

### 2. Eight terms are now defined in statute (Sec. 29c, adding 16 V.S.A. § 11(a)(36)–(43))

These are the operative counting rules, and several of them answer questions the memo answered
differently four months earlier.

| Term | Statutory definition (§ 11(a)) |
|---|---|
| **Average class size** (36) | Total students enrolled across all classes in a grade band or content area ÷ total individual classes in that grade band or content area, **calculated separately for each school and each grade band or content area**. |
| **Class** (37) | A group of students taught by a single teacher or team, organized for instruction in specific subjects or grade levels, for a defined period during the regular school day. **Each course section counts as a separate class; a class with more than one teacher of record counts as one class.** |
| **Content area** (38) | A grouping of courses aligned to a **single educator endorsement area as defined by the Vermont Standards Board for Professional Educators**. |
| **Full-time equivalent class** (39) | The proportion of instructional time relative to a full school year. |
| **School** (40) | A public or independent institution with assigned staff, serving students in a dedicated building, identified by a **unique NCES state school ID**. |
| **School day** (41) | From the latest non-late arrival time to dismissal, on a student attendance day. |
| **Student** (42) | A pupil **enrolled in and assigned to a school as of October 1**. |
| **Teacher of record** (43) | The educator primarily responsible for delivering instruction, assessing learning and assigning grades for a class, **as designated in the district's student information system**. |

The exclusions ride along inside the "average class size" definition: (A) the § 165(a)(9)(vi)
list (pre-K, K, CTE, flexible pathways, terminal courses, AP, specialized-equipment courses,
driver's education); (B) small group special education, supplemental or targeted academic
intervention, and English learner instruction; and **(C) "specialized or targeted academic
opportunities"** — a third category that appears in neither Act 73 nor the memo, and is
undefined.

### 3. The Board may define the same terms differently, and then the statute repeals

Sec. 29d directs the State Board to adopt rules establishing definitions for § 11(a)(36)–(43),
and says plainly that the Board "may adopt rules pursuant to this section with definitions for
the terms that differ from the definitions contained in statute." Sec. 29e(a) then repeals
§ 11(a)(36)–(43) **on the July 1 following the effective date of those rules**.

Which means: the definitions above are a placeholder the Legislature expects to be replaced,
with a repeal date that nobody can state yet because it depends on when the Board finishes.
Anything built on them should be built to be re-read.

### 4. Approved independent schools taking public tuition (Sec. 29b, amending 16 V.S.A. § 828)

Tuition eligibility now requires compliance with § 165(a)(9)**(A)** — the numeric standards —
"and State Board rule," with the same geographic-isolation and implementation-plan waiver
route, the Board's decision final. Act 73, Sec. 8(a)(2) separately requires Rule 2200
(22-000-004) rulemaking on the same August 1, 2026 timetable.

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

### Where the memo is now behind the statute

Act 170 postdates the memo by four months, and on three points it does not say the same thing:

1. **Content area is an endorsement area, not a SCED category.** § 11(a)(38) keys it to "a
   single educator endorsement area as defined by the Vermont Standards Board for Professional
   Educators" — which is what § 165(a)(9) said all along ("a group of courses within a specific
   licensing endorsement area"). The memo's SCED 01–05 core is a **proxy** AOE picked for
   standardization against an existing collection, not the statutory unit. Where a SCED
   category and an endorsement area do not line up, the endorsement area is the one in law.
2. **A "student" is an October 1 count.** § 11(a)(42) fixes enrollment to a single date. The
   memo's averaging language ("# of students enrolled in a content area course") names no date.
   For anyone recomputing an average, that is the difference between one census and a year's
   worth of movement — and note it is *not* ADM, which is what this repo's other membership
   figures use.
3. **A third exclusion exists.** § 11(a)(36)(C) excludes "specialized or targeted academic
   opportunities," undefined and absent from both Act 73's clause (vi) list and the memo's
   catalogue of exemptions. Whatever it turns out to mean, it is not in the memo's answers.

Also new in statute and not in the memo: **each course section is a separate class**, and a
**co-taught class counts once** (§ 11(a)(37)) — the denominators of every average.

### Where the memo does not resolve cleanly

Worth knowing before anyone builds anything on these definitions:

1. **Related arts: counted or not?** Three answers pull against each other. Content area is
   defined as the SCED core (01–05); advisory coded 22/23 is called exempt; and the related
   arts answer says these classes "will be counted." A class coded 22003 (library) cannot be
   both exempt-because-22 and counted. The memo's own escape hatch — AOE and LEAs working
   through Miscellaneous courses — is an admission that this is unsettled. Act 170 does not
   fix this: an endorsement-area test moves the question rather than answering it.
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
| July 1, 2026 | Act 73 Secs. 6 and 7 take effect (Act 73, Sec. 76(c)(1)–(2)); Act 170 takes effect, including Secs. 29a–29e (Act 170, Sec. 86). |
| On or before Aug 1, 2026 | State Board must **initiate** rulemaking on class size for EQS rule 2000 and independent school rule 2200 (Act 73, Sec. 8(a)(1)(A), (a)(2)). |
| Summer 2026 | Board committee's pre-rulemaking and drafting phase (counsel's timeline). |
| **Fall 2026** | AOE intends to give districts **baseline class size averages from 2025–2026**, computed on the memo's working definitions, to support FY2028 budget building. Board committee finalizes recommendations to the Board. |
| 2026–2027 | First school year the minimums bind — with the noncompliance clock paused. |
| Winter 2027 | ICAR filing and public hearings (counsel's timeline). |
| Spring 2027 | First actual collection, through the **End of Year collection (DC04)**. Rules finalized and sent to LCAR. |
| **July 1, 2027** | Backstop: the enforcement pause ends here if the EQS rule is not updated sooner (Act 170, Sec. 29a(b)). Statewide graduation requirements rulemaking must also be initiated by this date (Act 73, Sec. 8(a)(1)(B)). |
| July 2027 | New rules expected to take effect (counsel's timeline). |
| Fall 2027 | First reporting of collected class size data. |
| The July 1 after the rules take effect | § 11(a)(36)–(43) repeal (Act 170, Sec. 29e(a)) — date not yet knowable. |

Note what that timeline means: **compliance data for the first binding year does not exist
until fall 2027**, and Act 170, Sec. 29a(b) independently keeps 2026–2027 noncompliance out of
the three-year count unless the EQS rule lands first. Anyone claiming a district is or is not
"in compliance" during FY2027 is working from projections, not measurements — and even a real
measurement would not start a clock.

## What this means for this repo

- **No parameters are derived from this memo.** Nothing here feeds the engine today. If class
  size minimums are ever encoded, the values come from § 165(a)(9) — 10 / 12 / 15 / 18 — cited
  to statute and marked `verified: true` only against the operative sentence, never from this
  file or from the memo.
- **The memo is the citation for method, not for law.** Use it when explaining how averages
  would be measured, or what districts were told during FY2027 budget season. Say plainly that
  it is guidance predating both the rule and Act 170.
- **Anything encoded from § 11(a)(36)–(43) carries a repeal date nobody can state.** Sec. 29e(a)
  repeals them on the July 1 after rules take effect, and Sec. 29d lets the Board write
  different ones. A parameter drawn from them needs a citation note saying so, or it will read
  as settled law when it is a placeholder — exactly the failure
  [parameter-verification.md](parameter-verification.md) exists to prevent.
- **Do not reuse this repo's ADM figures as class size enrollment.** § 11(a)(42) counts students
  enrolled and assigned as of **October 1**; average daily membership is a different measure
  built for a different purpose. Mixing them would produce averages that look right and are not.
- **Expect the fall 2026 baseline to be publishable data.** AOE's 2025–2026 baseline averages,
  when they reach districts, would be an intake artifact of real value — the first numbers
  attached to these definitions.
- **The waiver path links to the small/sparse work.** Geographic isolation waivers under clause
  (B) and the "small by necessity / sparse by necessity" framework in
  [`docs/sparse-schools/`](sparse-schools/) are aimed at overlapping populations of schools and
  are decided by the same Board; neither defines the other.
- **The excluded-courses attachment is missing** from the copy we hold. It is the operative
  list for what drops out of the averages. See the intake README.
