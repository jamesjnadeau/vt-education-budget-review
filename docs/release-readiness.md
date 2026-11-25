# General release readiness

What has to change on the public site before it is announced to Vermont residents
generally. The list comes from the six persona walks in [`docs/feedback/`](feedback/),
each of which names the page, the words on it, and where known the `file:line`
behind the problem. Follow the links for the evidence; this file only orders the work.

Two tiers must close before release:

- **Must fix** — the site says something wrong or misleading, or a careful reader
  would catch it contradicting itself. Each one costs trust that is hard to win back.
- **Should fix** — nothing is wrong, but a resident cannot finish the errand they came
  for, or cannot tell whose work they are reading.

**After release** is real work that needs new data, new modelling, or is polish.

Check an item only when the thing it names is live and `npm run validate` still passes.

## Must fix before release

- [ ] **What-if tool: source or refuse the four placeholder inputs.** `econ`, `el`,
  `density` and `cla` in [`site/src/pages/model/index.astro`](../site/src/pages/model/index.astro)
  keep demo values (40, 8, 30, 0.8) when a district is loaded, so the engine's weighted
  membership comes out low and the rate high: Milton FY2026 prints $1.8975 against the
  published $1.2462 and trips the excess-spending rule it does not owe. Fill each field
  from a held source or refuse the rate and name the missing field. Show AOE's published
  weighted ADM beside the engine's own count, so a gap is visible rather than silently
  used. Add a test that every district + year either sources or refuses all four.
  Evidence: [Norwich professor](feedback/2026-11-24-norwich-college-professor.md) #1,
  [Milton 5th grader](feedback/2026-11-24-milton-fifth-grader.md) #1.

- [ ] **What-if tool: find out why Champlain Valley #56 is fully blocked.** All four
  results read "blocked: figure not published", yet
  `model/goldens/ud-champlain-valley-56-fy2026.yaml` reproduces its rate. Fix it, or say
  on screen why it cannot run. [Hinesburg parent](feedback/2026-11-24-hinesburg-parent-of-three.md) #3.

- [ ] **Replace "each town sets its own".** The rate blank on the district, union and
  grouping pages (`site/src/pages/my/district/[slug].astro:50` and siblings) attributes
  the rate to the town, which is wrong and sends residents to the wrong office. Say that
  voters approve the district budget and the rate is computed from it, and name the CLA as
  why towns in one district differ. [Barre plumber](feedback/2026-11-24-barre-plumber.md) #1–2.

- [ ] **Unit and dollar line under every homestead rate.** "$1.2462 per $100 of value
  ($12.46 per $1,000); about $3,116 a year on a $250,000 house", derived from the
  published rate with the house value labelled as an example. Say it is the school share
  only and is before the property tax credit, with a link to the glossary entry.
  [Brattleboro teacher](feedback/2026-11-24-brattleboro-retired-teacher.md) #1–2.

- [ ] **Source line under the headline figure on every town page.** Publisher, document,
  date, link. No town page links to any source host today.
  [Norwich professor](feedback/2026-11-24-norwich-college-professor.md) #3.

- [ ] **Flag the eleven districts the engine cannot reproduce** wherever their rate is
  shown, linking to the residual table in [`act-127-transition.md`](act-127-transition.md).
  [Norwich professor](feedback/2026-11-24-norwich-college-professor.md) #2.

- [ ] **Keep every blank inside the four-blank taxonomy.**
  - `not_published` renders as "not usable" with class `not-computable`
    (`site/src/pages/town/[slug].astro:125`, `site/src/pages/su/[slug].astro:244`).
  - "No group yet for your district" (`site/src/pages/my/town/[slug].astro:149`) needs a
    committed reason and names who holds the answer.
  - "send in" on `/admin/coverage/` reads as an instruction to the reader; say "we have
    not collected it yet".

- [ ] **Fix registry errors visible to readers.** Orford NH as a Vermont town page and as
  an SAU 70 school with an em-dash operator; "Member districts (0)" beside a district's
  schools; Windham Southeast's member-town count (4) against its list (5); raw ids such as
  `town/milton` and `ud/champlain-valley-56` in operator columns; title-casing such as
  "Orford Nh", "Barton Id".

- [ ] **Sign off the FY2026 parameters against the statute.** A person reads 16 V.S.A.
  § 4010(d) and the yield act and countersigns
  [`model/parameters/fy2026.yaml`](../model/parameters/fy2026.yaml) with a name and date,
  per [`parameter-verification.md`](parameter-verification.md). The Norwich walk checked
  all eleven weights live in about four minutes; the blocker is labour, not access. Also
  correct `/methodology/` where it says the Legislature's site "could not be reached".

- [ ] **Verify the phone layout.** No walk could test it, and the Hinesburg parent and the
  Milton reader are the readers most likely to be on a phone.

## Should fix before release

- [ ] **"Who made this" page.** Who runs the site, who funds it, how to contact you, how to
  report an error. Link it from the footer. [Milton adult](feedback/2026-11-24-milton-adult-fifth-grade-reading-level.md) #4.

- [ ] **Schools on the town and district pages**, with grades, from the registry. Say so
  when a member town has no school of its own (St George).

- [ ] **Multi-town district table** on the district and town pages: town / CLA / district
  rate / billed rate / example bill. Data is in `warehouse/tax-rates/fy2026.yaml`.

- [ ] **Show each town's CLA and non-homestead rate** on the town page. Both are held in
  `warehouse/tax-rates/fy2026.yaml` and shown nowhere; the what-if tool asks for a CLA the
  reader cannot find.

- [ ] **Per-pupil spending on the resident pages**, from AOE EdSpend, labelled with its
  source. Reconcile first with `/su/[slug]`, which says no spending year is normalized yet
  while `/model/` prints a per-pupil figure from the same data.

- [ ] **Explain counts where they appear.** Why ADM has decimals; "at least 3,954.95"
  becomes plain words about the state hiding small counts.

- [ ] **Comparison wording.** "Lower than 182 of the 258 towns with a published rate";
  drop the four decimal places on per-town averages.

- [ ] **Plain definitions above the numbers.** Replace the 50-word semicolon sentence on
  the town page with short one-line definitions, and link figures to the glossary.

- [ ] **One year label.** The town page says "school year 2025" where the SU table says
  "2024-2025" for the same column; say what "FY2026" means where it first appears.

- [ ] **Define "budget document"** on `/admin/coverage/`, with one example, so a reader
  can tell what is missing and what to send.

- [ ] **What-if tool: say when choosing a district does nothing** because no year is
  chosen.

- [ ] **Carry the combiner's explanation** of which inputs the state does not publish onto
  the SU and district pages.

- [ ] **More persona walks before release**, using
  [`feedback/persona-review-template.md`](feedback/persona-review-template.md): on a
  phone, a reporter on deadline, a school board member. Rerun after the must-fix tier
  closes.

## After release

- [ ] Prior-year rates and a trend (the warehouse holds FY2026 only).
- [ ] Vote dates, board meetings and district site links on the town page (new sourced data).
- [ ] Norwich's interstate arrangement: model it, or say plainly it is not modelled.
- [ ] A "how Vermont differs from other states" explainer, linked from the town page.
- [ ] Name Act 170 groups by their towns, not a number.
- [ ] Staff (FTE) counts.
