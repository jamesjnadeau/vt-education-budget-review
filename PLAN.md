# Vermont School Budget Data Pipeline & Merger Modeling Site
## Technical Plan
 
*Draft — July 2026. Companion to the business plan; this is the build spec for the "demonstration asset" in §7.1 of that document.*
 
---
 
## 1. What this system is
 
A statically hosted, git-backed public website that (a) publishes every Vermont supervisory union's released budgets in a normalized, documented form, and (b) lets any resident model what merging or closing schools would do to their town's education spending and homestead tax rate — with every step of the weighted-membership and tax-rate math shown and cited to statute.
 
The architecture is deliberately boring: a git repository is the data warehouse, GitHub Actions is the ETL scheduler, a static site generator produces the pages, and the modeling tool runs entirely in the browser against pre-built JSON. There is no server, no database, and no login for public users. This is not a compromise forced by GitHub Pages — it is the right design for this product, for three reasons:
 
1. **Provenance is the product.** Every number on the site must be traceable to a public source or a hostile school board member will make you regret it. Git gives you an immutable, publicly auditable history of every datum, every transformation, and every formula change for free. When someone asks "where did this number come from and when did it change," the answer is a commit link.
2. **The math must be inspectable.** A client-side modeling engine means anyone can view source. That is a feature. Your credibility position ("independent verification, plainly explained") is strongest when the model itself is open.
3. **Zero infrastructure cost and zero attack surface** while you are a solo operator producing analysis that people will be angry about.
---
 
## 2. System overview
 
```
┌─────────────────────────────────────────────────────────────┐
│  SOURCES                                                     │
│  • AOE Public Data API (SU/district/school/town directory)   │
│  • SU/SD released budgets (PDF, xlsx, web pages — varied)    │
│  • AOE published finance & enrollment reports                │
│  • Tax Dept: CLAs, homestead/non-homestead rates             │
│  • Act 127/170 parameters, yield, statutory weights          │
└──────────────┬──────────────────────────────────────────────┘
               │  collectors (per-SU configs) + manual intake
               ▼
┌─────────────────────────────────────────────────────────────┐
│  GIT REPOSITORY  (= the data warehouse)                      │
│  /registry     entity registry synced from AOE API           │
│  /intake       raw budget artifacts, exactly as released     │
│  /warehouse    normalized data conforming to budget schema   │
│  /schemas      versioned JSON Schemas + budget template      │
│  /model        formula engine (pure TS library, cited)       │
│  /collectors   per-SU acquisition configs & scrapers         │
│  /site         static site generator source                  │
└──────────────┬──────────────────────────────────────────────┘
               │  GitHub Actions: validate → normalize → build
               ▼
┌─────────────────────────────────────────────────────────────┐
│  GITHUB PAGES                                                │
│  • Per-SU source pages (budget lists + provenance)           │
│  • Modeling tool (client-side, reads warehouse JSON)         │
│  • Build-time admin/coverage dashboard (missing budgets)     │
│  • Methodology & statute reference pages                     │
└─────────────────────────────────────────────────────────────┘
```
 
---
 
## 3. The entity registry (foundation layer)
 
Everything keys off a canonical registry of who exists: supervisory unions/districts, member school districts, schools, and towns, with their relationships and effective dates.
 
**Source:** the AOE Public Data API at `datacollection.education.vermont.gov`. Note the `/docs` page is a Swagger UI rendered client-side; the pipeline should consume the underlying OpenAPI spec (linked from that page, typically `openapi.json`) and generate a typed client from it rather than hand-writing calls. First implementation task: pull the spec, enumerate the endpoints for SUs, schools, and towns, and map their ID scheme.
 
**Design rules:**
 
- **Stable internal IDs.** Assign your own slug per entity (`su/washington-central`, `town/calais`) mapped to the AOE organization ID. AOE IDs and names will churn as mergers close in 2029; your URLs and historical data must not.
- **Bitemporal-lite.** Every registry record carries `effective_from` / `effective_to`. When Act 170 mergers take effect, the old SUs don't disappear — they close, and their history remains queryable. This matters immediately: the modeling tool's whole job is comparing "current structure" to "hypothetical merged structure," and the second wave of your business (2028–29 consolidation work) is served by having clean before/after lineage.
- **Nightly sync via Action.** Diff API responses against the registry; open a PR (never auto-merge) when the directory changes, so every structural change in Vermont education gets a human eyeball and a commit message. The registry sync log becomes, incidentally, a public changelog of district reorganization — content in itself.
- **Snapshot the raw API responses** into `/registry/raw/YYYY-MM-DD/` (compressed). This is your provenance file for the directory layer.
Also fold in the **Act 170 statutory groupings** (the 20 groupings, ~p. 43 of the act) as a first-class registry object: each grouping is a named set of district IDs. These become the default scenarios in the modeling tool.
 
---
 
## 4. Budget acquisition
 
This is the messy layer, and the plan should assume it stays messy. Fifty-two SU/SDs publish budgets as they please: PDFs on district websites, Town Meeting warning documents, occasionally spreadsheets, sometimes only a summary in the annual report. No scraper generalizes across all of them.
 
**Per-SU collector configs.** `/collectors/<su-slug>/config.yaml` declares, per SU: the budget publication URL(s), the document pattern (e.g., "annual report PDF, budget section"), the fiscal years available, the acquisition method (`http-fetch`, `scrape`, `manual`), and any SU-specific extraction notes. A shared runner executes the automatable ones on a schedule; the rest are flagged manual. Expect the initial split to be roughly a third automatable, and don't fight it — for 52 entities × 1 budget/year, manual acquisition is a few hours annually. The automation that matters is *detection* (knowing a new budget exists) more than *retrieval*.
 
**Raw intake is sacred.** Every acquired artifact lands in `/intake/<su-slug>/<fy>/` exactly as released, alongside a `provenance.yaml`: source URL, retrieval date, retrieval method, SHA-256, and who touched it. Raw artifacts are never edited. This directory *is* the §6.2 provenance discipline from the business plan, made mechanical.
 
**Git LFS** for the PDFs (a repo of 52 SUs × several years of budget PDFs will blow past normal Git comfort quickly). If LFS quota becomes annoying, raw artifacts can move to a public release-assets bucket with hashes remaining in git — decide when it hurts.
 
---
 
## 5. The budget template and normalization
 
The warehouse can only be trusted if everything in it conforms to one model. Two layers:
 
**Layer 1 — the canonical budget schema** (`/schemas/budget.schema.json`, versioned). One record per district-fiscal-year, roughly:
 
```yaml
schema_version: "1.0"
entity: su/<slug>                     # registry slug
fiscal_year: 2027
status: proposed|warned|approved|actual
source: intake/<slug>/fy<year>/<file> # the raw artifact this came from
education_spending: …                 # the district's published Education Spending line
adm:                                  # district-STATED ADM by statutory band
  prekindergarten: …
  kindergarten_through_5: …
  grades_6_through_8: …
  grades_9_through_12: …
tax:
  towns: [ { town, homestead_rate_stated, cla } ]  # per member town, as stated
notes: …                              # optional free text
not_published: [ … ]                  # every accountable null accounted for, with who/when
lines_flagged: [ … ]                  # anything that didn't fit cleanly
```
 
Design principles for the schema: **essentials only** (the district's published
education spending, its stated ADM by the four statutory grade bands, and the
per-town stated tax figures — not a chart of accounts), **a null in an
accountable field always means "not published"** (enforced by the
null-accounting rule: every such null is listed in `not_published` or
`lines_flagged`), and **version the schema** so records stay readable as it
evolves. Education spending is captured as the district's published figure, not
recomputed from expenditures and offsetting revenues.

**Extraction.** Records are entered through the `budget-normalize` issue form,
which mirrors these fields one-to-one; a bot validates the submission against
the schema and opens a pull request adding the warehouse record. Every warehouse
record links back to its intake artifact; CI rejects any record whose `source`
does not exist or whose schema validation fails.
 
**Enrichment joins.** At normalization time, join in AOE-published ADM, weighted membership, staffing data (educator FTEs and salary reporting, where published), and Tax Department CLA and rate data, each with its own provenance — kept as a separate, labeled series, never merged into the district-stated fields. District-stated ADM now lives in the record itself; the AOE series is resolved district-first, with a cross-check that warns on disagreement but never reconciles. Budget documents are the districts' voice; AOE and Tax data are the state's; the warehouse keeps both and labels which is which.
 
---
 
## 6. The admin problem on a static site
 
"Admin interface with missing-budget list and easy upload" collides slightly with "static hosting, uploads through git." Resolution: the *dashboard* is build-time-generated and public; the *upload path* is git, made friendly.
 
**Coverage dashboard** (`/admin/coverage/`, public — transparency about gaps is on-brand). At build time, compute the expected matrix (every active SU × every fiscal year from FY23 forward × expected statuses) against warehouse contents. Render a grid: green (normalized), yellow (in intake, not yet extracted), red (missing), gray (confirmed not published). Each red cell shows the collector's last-known source URL and two actions:
 
1. **Upload link** — a deep link to GitHub's web upload UI pre-targeted at the right `/intake/<su>/<fy>/` path. Committing through the GitHub web interface *is* a git commit; it satisfies your constraint while being a normal file-picker experience. A PR template prompts for the provenance fields.
2. **Flag link** — opens a pre-filled GitHub Issue ("FY27 budget missing for X — checked <url> on <date>") for tracking without upload.
**Validation as the gatekeeper.** Every PR triggers: schema validation, provenance completeness, hash verification, registry-reference checks, and a recomputation of derived figures. Nothing reaches `main` — and therefore the site — without passing. This replaces the trust function an admin login would serve.
 
**If you later want friendlier-than-GitHub for a part-time assistant:** Decap CMS (formerly Netlify CMS) gives a form-based editing UI that commits to the repo via the GitHub API — still git-native, still no server. Defer until there's a second person.
 
---
 
## 7. The modeling tool
 
The public face of the system, and the demonstration asset the business plan wants published **before October 15, 2026**.
 
### 7.1 What the user does
 
Pick a starting point (their town, SU, or one of the 20 Act 170 groupings), then compose a scenario: merge these districts, close this school, move its students to that one, adjust assumptions. The tool shows, side by side, current vs. scenario:
 
- **combined published education spending**, with a single explicit, user-visible
  consolidation factor (starting at 1.0 — no change) applied to the combined
  total; the tool models the headline delta off published education spending only,
  because districts do not slice their budgets the same way, and shows movement in
  both directions with equal weight;
- membership and **weighted membership**, recomputed for the combined entity;
- education spending per weighted pupil;
- **homestead tax rate per member town**, through CLA, under (a) the current yield-based system and (b) a parameterized foundation-formula stub with sensitivity sliders for the parameters the Legislature hasn't set.
Every scenario is serializable to a URL — shareable, embeddable in a committee packet, reproducible at a public meeting.
 
### 7.2 The formula engine
 
A standalone, dependency-light TypeScript library (`/model`) used by both the build pipeline (to precompute baseline figures) and the browser (to run scenarios). Non-negotiable properties:
 
**Weights and parameters are data, not code.** `/model/parameters/fy2027.yaml` holds the ADM averaging rule, each pupil weight, the yield, statutory rate floors — each entry carrying `value`, `citation` (statute section and, where applicable, session law), `source_url`, and `verified_date`. When the Legislature changes something (the business plan correctly calls this near-certain), you edit a YAML file and every calculation, citation, and explanation updates. The JFO consultant recommendations due December 1, 2026 on special-ed, sparsity, secondary, and CTE weights become a new parameter file the week they land.
 
**Every calculation step is a narratable node.** The engine's output is not a number but a computation tree: each node has inputs, an operation, a result, a plain-language explanation template, and the citation of the parameter(s) applied. The UI renders this as the "show your work" walkthrough — for the weighted-membership (LTWADM) calculation, that means the user can expand: raw ADM by grade and category → the multi-year averaging rule → each weight applied (grade-level, economically disadvantaged, English learner, sparsity, and companion special-ed funding treatment) → total weighted membership → spending per weighted pupil → yield/rate math → CLA adjustment → their town's rate. The relevant provisions live principally in 16 V.S.A. chapter 133 (§ 4001 definitions, § 4010 membership and weights as amended by Act 127 of 2022) and 32 V.S.A. chapter 135 for the property-tax mechanics — but **treat every citation as a datum to verify against the current statute text on the Legislature's site during the parameter-file build, not something to trust from memory** (mine included). Statutory section numbers in this area have been amended repeatedly since 2022 and will be again.
 
**Golden tests against published reality.** Before launch, the engine must reproduce AOE's published weighted membership and the actual FY26/FY27 announced rates for a sample of districts to within rounding. Those test fixtures live in the repo, publicly. "Our model reproduces the state's published figures — here are the tests" is the single strongest credibility statement the site can make, and it is exactly the independent-verification positioning from the business plan.
 
**The foundation formula is a stub with honest error bars.** Until the Legislature acts, model it as a parameterized structure (base amount × weighted need, categorical adds, transition provisions) with ranges, and label it loudly as contingent. Showing sensitivity honestly — "under these three plausible parameter sets, your town's rate lands between X and Y" — is more credible than false precision, and it's the analysis the official process is least likely to supply.
 
### 7.3 What the tool must visibly *not* do
 
Consistent with the neutrality position: the tool computes and explains; it never scores, ranks, or recommends scenarios. No "savings" headline framing — show deltas in both directions with the assumptions that drive them adjustable and visible. Publish the methodology page and the assumptions register with the same prominence as the results.
 
---
 
## 8. Site structure
 
Static site generator: **Astro** (islands architecture fits this exactly — fully static content pages, one interactive island for the modeling tool; ships near-zero JS on the source pages). Eleventy is a fine alternative if you prefer minimalism.
 
```
/                          landing: what this is, who built it, neutrality statement
/model/                    the modeling tool
/su/<slug>/                one page per SU/SD:
                             profile from registry (member districts, schools, towns)
                             budget list by FY with status, links to raw artifact,
                               normalized data, and provenance record
                             baseline figures (ADM, weighted membership, per-pupil,
                               town rates) precomputed by the engine
                             "model this SU" → deep link into the tool
/town/<slug>/              thin town pages: which SU, which grouping, rate history
/groupings/<n>/            the 20 Act 170 groupings, pre-loaded as scenarios
/methodology/              schema docs, engine docs, parameter files rendered
                             with citations, golden-test results, data dictionary
/admin/coverage/           the build-time coverage dashboard (§6)
/changelog/                rendered from registry-sync and parameter-file commits
```
 
Warehouse data is emitted at build time as static JSON under `/data/` — per-SU files plus one compact index for the tool — so the modeling island fetches only what a scenario needs. At Vermont scale (52 SUs, ~119 districts, ~250 towns) the entire dataset is a few megabytes; there is no performance problem to solve.
 
Hosting: GitHub Pages from the Actions build, custom domain, HTTPS. Everything MIT/CC-BY licensed — open data and open methodology are the moat here, not the liability.
 
---
 
## 9. CI/CD pipeline summary
 
| Trigger | Job |
|---|---|
| Nightly | Registry sync vs. AOE API → PR on diff; collector runs → PRs with new intake artifacts |
| Every PR | Schema validation, provenance checks, engine unit + golden tests, link checks, build |
| Merge to `main` | Full build (normalize → precompute baselines → generate site) → deploy to Pages |
| Weekly | Source-URL liveness check across collector configs → issues for dead links |
| Manual dispatch | Re-extraction runs, parameter-file releases |
 
One repo to start. Split `/model` into its own published package only if others start consuming it (which would be a good problem — a facilitator's analyst importing your engine is a sales channel).
 
---
 
## 10. Build sequence (aligned to the business-plan calendar)
 
**Phase 1 — Weeks 1–2 (early–mid Aug):** Pull the OpenAPI spec; generate the client; build registry sync with snapshots; hand-enter the Act 170 groupings; scaffold repo, schemas v1.0, CI validation; start the engine with the FY27 parameter file, verifying each citation against current statute text as it's entered.
 
**Phase 2 — Weeks 3–5 (mid Aug–early Sep):** Engine golden tests passing against published FY26/FY27 figures for 5+ districts. Collector configs and intake for your **top 15 warm-list SUs** (the business plan's ranked list drives coverage order — don't sequence alphabetically). First `budget-normalize` submissions for those SUs. Coverage dashboard.
 
**Phase 3 — Weeks 6–8 (Sep):** Astro site: SU pages, methodology, coverage. Modeling tool v1: merge scenarios and town rate impacts under the current system for the 20 statutory groupings. Private links to 3–5 trusted business managers from the warm list — they will find your extraction errors faster than any test suite, and previewing to them is itself business development.
 
**Phase 4 — Weeks 9–10 (early Oct):** School-closure scenario support; foundation-formula stub with sensitivity ranges; shareable scenario URLs; polish the walkthrough narration. **Publish before Oct 15**, per the business plan, timed to the merger committees' first meetings.
 
**Ongoing:** Backfill remaining SUs opportunistically (each new client's region first). December: JFO recommendations land → new parameter file + the explainer piece the business plan calls for. Each legislative change → parameter release + changelog entry.
 
Scoping discipline: v1 covers the current funding system rigorously and the foundation formula honestly-approximately. Resist modeling construction aid, legacy debt incentives, or transportation routing in v1 — note them as assumptions, add later. The Oct 15 date is worth more than any single feature.
 
---
 
## 11. Risks specific to this system
 
| Risk | Mitigation |
|---|---|
| AOE API changes or lacks needed fields | Snapshot everything; registry tolerates gaps via manual overrides; the API is a convenience layer, not a dependency — the site must be able to build from snapshots alone |
| Extraction errors become public errors | Golden tests, stated-vs-computed dual recording, per-record provenance, visible corrections policy in the changelog. When you're wrong, the commit history shows you fixing it in the open — that's an asset |
| "He's republishing the state's model" attack | Clean-room discipline: engine built from statute text and published parameters only, cited line by line; provenance records on every artifact (business plan §6.2 made mechanical) |
| Statute citations drift as law changes | Citations live in parameter files with `verified_date`; a legislative-session checklist item to re-verify each session |
| Scenario tool misread as advocacy | No rankings or recommendations; symmetric presentation; assumptions register; neutrality statement on the landing page and in the tool footer |
| LFS/Pages size limits as intake grows | Coarse warehouse JSON stays small; raw artifacts can migrate to release assets with hashes in git if needed |
| Solo bus factor | Everything-as-code in one repo means a subcontract analyst can be productive in a day; the `budget-normalize` issue form and schema validation encode the process so it isn't only in your head |
 
---
 
*Statutory references above (16 V.S.A. §§ 4001, 4010; 32 V.S.A. ch. 135; Acts 127, 173, 73, 170) indicate where the relevant law lives but must be verified against current text when building the parameter files — this area has been amended every session and the plan assumes that continues.*
