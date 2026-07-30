# Small / Sparse Layer — Integration Plan, v2

*Revised July 2026 against `jamesjnadeau/vt-education-budget-review` @ main (6 commits). Supersedes v1, which was written against `vt-budget-pipeline-plan.md` and got several things wrong.*

---

## 0. What v1 got wrong

Reading the repo changed four things. The first is a straight error on my part.

**The parameter file violated the project's central rule.** `docs/parameter-verification.md` says a parameter may be marked verified only by a person who has read the operative sentence in current statute and pasted it into the `quote` field — "not a table on an agency page… not a language model's recollection, including the one that drafted the file." It then explains why the FY2027 file is all nulls: a *plausible* value with an unverified citation is one careless edit from publication, so there is deliberately nothing there to promote.

My v1 parameter file put 3,157 / 1,954 / 100 / 55 straight into `value:` fields with a custom `verification_status: secondary_source_only`. Those came from an AOE summary page and a JFO briefing — the sources ranked fourth in the authority list, explicitly never the citation of record. I built exactly the artifact the doc exists to prevent, and I invented a parallel verification vocabulary to make it feel acceptable.

Rewritten. `model/parameters/fy2030-small-sparse.yaml` is now all nulls in the repo's own citation shape. The secondary readings moved to `docs/small-sparse-verification-worksheet.md`, which no code reads.

**Schools already exist in the registry.** 867 entities are synced, and the `ParentOrg`/`OperatedBy` note confirms schools are among them. `school.schema.json` is therefore an *amendment* adding location, grade span and municipality — not a new entity. Smaller change than v1 claimed.

**Closure scenarios don't exist yet.** "Scenario support covers mergers. School closure with student reassignment is not yet implemented." The entire point of this layer is that closure drops grant lines while merger alone doesn't. So v1's phase 3 has a hard prerequisite v1 didn't know about.

**Two of my "new" ideas were already there.** The engine already distinguishes `unverified` from `missing_input` and propagates status upward; consolidation assumptions already default to no reduction; transportation can already rise. My no-default `capital_cost_basis` isn't a new principle, it's the existing one applied to a new input — which is a better argument for it than novelty was.

---

## 1. The blank taxonomy goes from two to four

README rule 1 is the project's load-bearing invariant: a blank always means one specific thing, and there are exactly two. This layer adds two more, and they are genuinely different in kind:

| Kind | Means | Whose problem |
|---|---|---|
| `missing_input` | The district did not publish it | The district's |
| `unverified` | A statutory value isn't verified against current law | Ours |
| **`undetermined`** | The State has not made a decision that does not yet exist | Nobody's yet |
| **`not_computable`** | The question can't be answered from public data at all | Nobody's ever |

`undetermined` is not a gap anyone failed to fill. AOE has published no necessity determinations because the rules governing them aren't written. Rendering that as `missing_input` would imply AOE failed to publish something, which is false and unfair to them. And `not_computable` is terminal by design — `requires_certification`, `requires_local_model`, `requires_projection` are correct final answers, not to-do items, and a coverage dashboard that shows them as red would be lying about what completion looks like.

Both need adding to `validate`, to the site's blank legend, and to README rule 1. This is the change I'd make first, because getting it wrong contaminates the layer's whole presentation.

`model/src/small-sparse.ts` now carries two distinct suppression constants for the two cases rather than one, so they can't collapse downstream.

---

## 2. Statutory versus framework parameters

The parameter file needed a distinction the existing files don't have, because this layer draws on two sources with incompatible verification rules:

- **`statutory:`** — Act 73 Sec. 37 as amended. All null. Citation of record is the **Act as enacted**, not the codified section, because these provisions are contingently effective and Vermont Statutes Online may not reflect them yet (authority list, item 2).
- **`framework:`** — thresholds proposed by the State Board committee on 2025‑12‑17. Values present, every entry `is_law: false`. The committee report is the primary source for what the committee proposed; quoting it is not the same act as quoting a statute.

Conflating these would be the verification doc's error in reverse — treating a proposal as law rather than a summary as statute. The 45/60‑minute thresholds and the 10–15 mile range are in the second category, which is why they carry values while the grant amounts don't.

The 10–15 mile range uses a `range` block with `basis: terrain, basis_defined: false`, which is the same treatment the checklist already prescribes for the JFO ranges landing in December. Good precedent to reuse rather than a new pattern.

One outstanding item: the framework PDF needs a manual save into `intake/sbe/2025-12-17-small-sparse-framework/` with a hash. `education.vermont.gov` 403s automated clients, and the reading currently in the parameter file came from a copy supplied in conversation — not a hashed intake artifact. Under rule 2 that distinction is the whole point.

---

## 3. Parameter verification is a manual afternoon, not a blocker

Worth stating plainly because it changes the critical path. The reason 0 of 14 parameters are verified is environmental: TLS chain failure on `legislature.vermont.gov`, HTTP 403 from `education.vermont.gov`. Neither obstructs a person with a browser.

So the top of the queue isn't code. It's you, the enacted acts, and an afternoon. Adding this layer takes the denominator from 14 to roughly 30, and the README's headline number gets worse before it gets better — which is the right trade only if the reading actually happens. If it doesn't, this layer adds thirty nulls to a project that already can't compute.

Two structural questions matter more than any number:

1. **Grant stacking.** Additive versus greater‑of is roughly a 60% spread on the line item under the secondary readings, concentrated in the schools most exposed in March 2028.
2. **Density geography.** School's own town versus district's member towns. If it's the latter, a school‑level model is the wrong shape and most of this layer needs rebuilding.

Read those two before building the screens.

---

## 4. `savings` — the naming collision, resolved

README rule 3: there is no `savings` field in the codebase and there will not be one.

The framework's language is "costs of renovation or addition at receiving schools exceed **projected savings from closure**." That phrase appears in this layer only inside quoted framework text, rendered as a quotation. The engine's field is a signed `closureCostDelta`, presented in both directions like every other scenario delta. Recorded in the parameter file's `naming_note` and the module header so nobody later "simplifies" it.

---

## 5. The capital-cost question, and why it's the highest-value item here

Two of the five criteria turn on whether renovation costs at a receiving school exceed the savings from closure. Act 170 pays up to 75% of construction costs for merged districts against 30% otherwise.

On a **net-of-aid** basis, merging shrinks the district's cost of expanding a receiving school, makes the closure look cheaper, and thereby weakens the case that the district's own small schools exist by necessity. On a **gross** basis the merger decision doesn't touch the test. Same school, same numbers, opposite answer.

The framework doesn't say which. So `capital_cost_basis` is a required scenario input with no default, displayed with the result, recorded on the record — exactly the treatment consolidation assumptions already get.

It's also the best rulemaking comment available: public, technical, on the record, and requiring no position on whether any district should merge. Rules are due around 2027‑03‑31, which collides with FY28 budget season and Town Meeting Day. Drafted in the business plan §10 for December, filed when the docket opens.

---

## 6. Sequencing, revised

v1 assumed closure scenarios existed. They don't, and that reorders everything.

**Step 0 — before any code.** Read the two enacted acts and fill the parameter file. Nothing below produces a publishable figure until this happens, and it's the one task that can't be delegated to a subcontract analyst.

**Into v1, before Oct 15 — 3 to 4 days after step 0**
- Amend the school registry records: location, normalized grade span, municipality
- Extend `validate` and the blank legend for `undetermined` and `not_computable`
- Enrollment and density screens; school-level enrollment ingest
- `/small-sparse/` read-only candidate page, heavily labelled: statutory screens only, necessity undetermined for every school in Vermont
- Both enrollment bases and both population series computed, with the schools that differ called out
- Goldens in `model/goldens/small-sparse/`: boundary fixtures, the land-versus-total-area regression, and the property test asserting no non-null grant while the eligibility assumption is `none`
- No routing. No scenario integration. No dollar figures.

**v1.1, late Oct to Nov — 3 days**
- Pinned OSM extract into `intake/`; routing precompute in `tools/`, never in `model/`, so the engine stays filesystem- and network-free
- `derived` provenance kind (§7)
- Distance-to-nearest-same-grade-span column
- Travel-time estimate only if the block weighting holds up; drop it rather than ship a soft number

**Blocked until closure scenarios land**
- Grant lines dropping on closure, the `capital_cost_basis` toggle, the merger-versus-closure contrast

That last item is the layer's most interesting output — it shows cleanly that governance consolidation and school closure do entirely different things to this line, which is the distinction the July 2026 VTDigger criticism turns on. It's worth pulling closure scenarios forward for. But it's a separate piece of work with its own scope, and pretending otherwise is how October 15 gets missed.

---

## 7. Provenance needs a `derived` kind

Every provenance record today answers *where did you get this and when*. Routing output has no source URL; it answers *what did you run, on what inputs, at what version*.

```yaml
kind: derived
algorithm: routing/nearest-same-grade-span
algorithm_version: 1.0.0
engine: valhalla 3.4.0
inputs:
  - registry/schools@<git-sha>
  - intake/osm/vermont-2026-07-15.osm.pbf   # sha256 …
parameters: { costing: bus, block_weighting: census_2020_blocks }
run_id: 2026-08-04T14:22:11Z/a91f3c
output_sha256: …
```

Worth doing properly rather than forcing it into the `sourced` shape, because when someone challenges a distance the answer has to be "here is the extract, the engine version, and the run — re-run it yourself," and that answer only exists if the record was built to give it. It generalizes to the recomputed per-pupil figures too.

Also: the FY2029/FY2030 hedge from v1 is dropped. Creating two files with the same values is carrying a value forward, which the checklist prohibits for the yield. The correct fiscal year is a finding.

---

## 8. Repository changes

```
schemas/
  school.schema.json                    AMEND  → +location, +grade_span, +municipality
  small-sparse.schema.json              NEW
  provenance.schema.json                AMEND  → kind: sourced | derived

model/
  parameters/fy2030-small-sparse.yaml   NEW    → all statutory values null
  src/small-sparse.ts                   NEW
  src/node.ts                           AMEND  → undetermined, not_computable statuses
  src/eop.ts                            AMEND  → + school-grant rollup
  goldens/small-sparse/                 NEW

registry/                                AMEND  → school records gain geo fields
intake/
  census/                                NEW    → TIGER ALAND + population series
  osm/                                   NEW    → pinned extract (LFS)
  sbe/2025-12-17-small-sparse-framework/ NEW    → manual save + hash
derived/routing/                         NEW    → committed matrix + derived provenance
tools/src/routing/                       NEW    → precompute CLI (NOT in model/)
site/
  small-sparse/                           NEW
  methodology/small-sparse.md             NEW
docs/
  small-sparse-verification-worksheet.md  NEW
  parameter-verification.md               AMEND  → + March 2027 rulemaking checklist item
README.md                                 AMEND  → rule 1 covers four blank kinds
.github/workflows/routing-precompute.yml  NEW    → manual dispatch only
```

---

## 9. Two things I'm still guessing at

`node()`'s signature. I've passed `status: "unverified"` on the unverified-screen node because `parameter-verification.md` says node.ts marks nodes that way, but I haven't seen the type. If the field is named differently, fix it rather than dropping the flag.

Whether `model/parameters/` tolerates a non-`fyNNNN.yaml` filename. The checklist says the December JFO recommendations become a new parameter file rather than an edit, so domain-scoped files seem intended; `fy2030-small-sparse.yaml` keeps the year prefix sortable. If `parse.ts` globs strictly on `fy####.yaml`, either the glob or the name has to give.

---

## 10. One lead worth ten minutes

Vermont pays a small schools support grant under the *current* system and AOE publishes the annual awards. The Act 73 grant is a different structure with different amounts, so those awards aren't a golden for this layer's values.

But they may be a structural cross-check on how a per-pupil support grant is applied against a two-year enrollment average — and more useful, they'd show which enrollment series AOE actually uses in practice, which is one of the open questions. If the published awards are reconstructable, that's a legitimate golden for the *mechanism* even though the parameters differ. It would also be the only golden in this layer that reproduces a real state figure, which matters given that the project's strongest credibility claim is otherwise unavailable here.
