# Design: importing AOE Average Daily Membership

Status: draft, pending review
Date: 2026-07-29

## What this is for

AOE publishes ten years of Average Daily Membership by resident district. This
design imports that series so it serves two consumers at once, as `PLAN.md`
already anticipates:

1. **Engine input.** `model/src/membership.ts` needs `AdmYear` values to compute
   long-term membership under 16 V.S.A. § 4001(7) and weighted long-term
   membership under § 4010. Today nothing supplies them — only test fixtures and
   a hand-entry form on the site. This would be the engine's first real data
   source — though only ADM-25 is eligible, and a weighted-membership *total*
   stays blocked for reasons set out in decision 5 and the gap register.
2. **Cross-check series.** `PLAN.md` requires AOE-published ADM be kept as a
   separate, labeled series — the state's voice, never merged into the
   district-stated `enrollment.adm` field that budget documents fill. Where the
   two disagree, `budget-1.0.schema.json` records the discrepancy in
   `membership_note` rather than reconciling it.

## Constraints established before designing

### Retrieval is manual, and that is not a limitation to engineer around

`education.vermont.gov` returns HTTP 403 to non-browser clients. This was
re-verified rather than assumed, because `AGENT.md` documents a *different*
Vermont host (`legislature.vermont.gov`) that fails for a TLS reason with a
legitimate repair. That repair does not apply here:

```
--- chain presented by education.vermont.gov ---
  [0] CN=*.vermont.gov  <-  Amazon RSA 2048 M01  <-  Amazon Root CA 1  <-  Starfield G2
  certs in chain: 4
  authorized: true   error: none        <- chain verifies fully, unaided

--- plain fetch ---          HTTP 403, 919 bytes
--- AIA-repaired fetch ---   HTTP 403, 919 bytes   (identical)
```

The chain is complete and verification succeeds. The refusal is a CloudFront WAF
response (`403 ERROR / Request blocked`) after a successful handshake. There is no
missing intermediate to supply, and `AGENT.md` rules out defeating the block.

**Direct file URLs are blocked too.** Tested separately, because it is a
reasonable guess that a WAF might guard pages and not static assets:

```
GET /sites/aoe/files/documents/edu-average-daily-membership-by-resident-district-fy24.xlsx
  -> HTTP 403, content-type: text/html, 919 bytes
     magic 3c21444f ("<!DO"), not 504b0304 (ZIP/xlsx)
```

Byte-identical to the page refusal. Recorded so the experiment is not repeated.

The direct-file pattern is still worth keeping for era-A years, because it gives
the human an unambiguous target and gives provenance a precise `source_url`:

```
https://education.vermont.gov/sites/aoe/files/documents/
    edu-average-daily-membership-by-resident-district-fy<NN>.xlsx
```

which matches the FY25 filename as released. Eras B and C predate that scheme, so
their direct URLs must be read off the page rather than constructed.
There is also no Wayback snapshot of the page, and the AOE Public Data API does
not carry ADM — its OpenAPI spec declares 15 endpoints, all organizational and
contact data, with no membership, enrollment or pupil schema.

So a human downloads the files in a browser. This matches the judgement already
recorded in `tools/src/cli/collect.ts`: *"The automation that pays for itself is
DETECTION — knowing a new budget exists, and knowing when a source URL dies —
rather than retrieval."* Everything after the download is automated; nothing
about the download is faked.

### The published inventory

Ten contiguous years, verified from the page's link markup. `ADM-25` was already
downloaded; the other nine are listed on the page.

| ADM label | Count year | URL slug era |
|---|---|---|
| ADM-25 | 2023-2024 | A |
| ADM-24 | 2022-2023 | A |
| ADM-23 | 2021-2022 | A |
| ADM-22 | 2020-2021 | A |
| ADM-21 | 2019-2020 | A |
| ADM-20 | 2018-2019 | A |
| ADM-19 | 2017-2018 | B |
| ADM-18 | 2016-2017 | B |
| ADM-17 | 2015-2016 | C |
| ADM-16 | 2014-2015 | C |

Only one grain is published — `Resident District Report`. There is no
by-operating-district report, no prekindergarten report and no state-placed
report on this page. The gap register below is therefore structural, not a
matter of locating a different file.

## Correctness decisions

These are the decisions that make the difference between a plausible import and
a correct one. Each is derived from the real FY25 artifact and the real registry,
not from expectation.

### 1. Match links on link text, never on the URL

The href comes in three incompatible eras:

| Era | Slug shape | Years |
|---|---|---|
| A | `average-daily-membership-by-resident-district-fyNN` | ADM-20…25 |
| B | `YYYY-YYYY-adm-NN-resident-district-report` | ADM-19, 18 |
| C | `data-average-daily-membership-resident-district-admNN` | ADM-17, 16 |

A URL or filename pattern finds five of ten years and silently misses the rest.
The link text is uniform across all ten: `YYYY-YYYY (ADM-NN) Resident District
Report`. That is the matcher.

Link text must be normalized before parsing: `&nbsp;` appears in ADM-16 and
ADM-17, and ADM-16 carries a trailing zero-width space. Normalization strips
NBSP, zero-width, BOM and bidi marks.

The recorded CSS selector for the containing element is:

```
#block-agency-template-content > article:nth-child(1) > div:nth-child(2) >
div:nth-child(1) > details:nth-child(9) > div:nth-child(2)
```

It is recorded because it is the scoping fact and belongs in the repo, but it is
**positional** — AOE adding one accordion section above it moves the match
silently. It is therefore a scope hint and human documentation, not the primary
matcher, consistent with how `collector-1.0.schema.json` describes
`document_pattern` ("Read by a human, not a parser"). Discovery hard-fails if the
selector-scoped link count and the link-text match count disagree.

### 2. Join on org ID, never on name

All 254 data rows in the FY25 file resolve to a registry town on `aoe_org_id`,
with zero unmatched. But 15 rows disagree cosmetically with the registry name:

| Code | Sheet | Registry |
|---|---|---|
| T003 | Alburg | ALBURGH |
| T068 | Enosburg Falls ID | ENOSBURGH |
| T069 | Essex Junction ID | ESSEX JUNCTION |
| T103 | Isle La Motte | ISLE LAMOTTE |
| T123 | Middlebury ID #4 | MIDDLEBURY |
| T126 | Milton ID | MILTON |
| T133 | Mt. Holly | MT HOLLY |
| T134 | Mt. Tabor | MT TABOR |
| T141 | North Bennington ID | NORTH BENNINGTON |
| T176 | St. Albans City | ST ALBANS CITY |
| T177 | St. Albans Town | ST ALBANS TOWN |
| T178 | St. George | ST GEORGE |
| T179 | St. Johnsbury | ST JOHNSBURY |
| T213 | Vergennes ID | VERGENNES |
| T249 | Winooski ID | WINOOSKI |

The published name is retained as `name_as_published` for auditing only. An
unmatched code is a hard failure naming the code — never a skipped row.

### 3. Year labels are recorded, not computed

One row of numbers carries more than one year label, and conflating them misdates
the whole series. Three fields are stored, the first two verbatim from the
artifact:

- `count_year` — the school year pupils were counted, from the title row
  (`2023-2024` for ADM-25).
- `adm_label` — the `(ADM-NN)` label (`25`).
- `fiscal_year` — **2025** for that file. This is the project's single name for
  the year, matching how finance records refer to it and how
  `model/parameters/fy<YEAR>.yaml` is already keyed. There is deliberately no
  second "data terms" label: one name, used everywhere.

Two invariants, verified against all ten years with no exceptions:

```
fiscal_year      == adm_label + 2000
count_year_start == fiscal_year - 2      ( == adm_label + 1998 )
```

The importer asserts both and hard-fails when the title row, the link text and
the filename disagree — which catches a mislabeled or misfiled download.

Note that `fiscal_year` and `count_year` are **two years apart**, and this is
correct: a FY2025 determination is made on pupils counted in SY2023-24. Any code
or page presenting an ADM figure must say which of the two it means, because a
figure labelled only "2025" is ambiguous between them.

`AdmYear.fiscal_year` carries `fiscal_year`, so a year aligns with the parameter
set that governs it. One thing this does **not** settle: whether a FY2025
determination consumes the ADM-24 and ADM-25 files as its two averaged years, or
whether the ADM-25 file is already the figure FY2025 uses. `membership.ts`
averages the last N entries by array order and uses `fiscal_year` only as a
label, so nothing breaks either way — but which files constitute the § 4001(7)
window must be established from the files before `adm_years` is populated. It
belongs with open question 1.

### 4. Prekindergarten is `null`, and the `null` is documented

The FY25 file's bands are `Elem ( K - 5)`, `Middle ( 6 - 8)`, `SEC ( 9 - 12)`.
These map exactly onto § 4010(d)(1), so no band reconciliation is needed for that
year. There is **no prekindergarten column at all**.

`AdmYear.prekindergarten` is therefore `null`, never `0`. A `not_published` entry
records that the AOE resident-district report publishes no prekindergarten ADM,
confirmed by file and date. This applies to a new source the discipline
`tools/src/cli/extract.ts` already enforces for budget documents: a null must
always mean "the source did not publish this" and never "we did not look".

This is independently correct for FY2027 modeling, because
`model/src/membership.ts` already declines to produce a total while the
prekindergarten weight is unverifiable under the Act 73 contingency.

### 5. Grade bands are recorded per year and never coerced

Act 127 of 2022 amended § 4010 **effective July 1, 2024** — the first day of
FY2025 — per the amendment history in
`model/statute/2026-07-29/16-vsa-4010.txt`: `2021, No. 127 (Adj. Sess.), § 4,
eff. July 1, 2024`. Section 4001 carries the same date (`No. 127, § 24`). Before
that, the grade bands differed and there were fewer weighting categories
altogether.

So ADM-25 is the first file under the current regime, and **ADM-16 through ADM-24
are all pre-Act-127**.

Note what this implies about which year governs a file's structure. The ADM-25
file counts pupils in SY2023-24 — before Act 127 took effect — yet publishes the
new K-5 / 6-8 / 9-12 bands, because it is used for FY2025 determinations. **Bands
follow the determination year, not the count year**, and therefore track
`adm_label`.

Each year's record carries `bands_as_published` verbatim, and the mapping to
§ 4010 bands is explicit per year. Where a year's bands do not correspond to
§ 4010's, that year
is importable as a labeled series but **must not** feed the engine, and the
record says so. Bands are never silently remapped to make a year usable.

The consequence is large and worth stating plainly rather than discovering during
implementation:

**Only ADM-25 is a candidate for engine input.** The repo holds parameter sets for
FY2025, FY2026 and FY2027 only, all post-Act-127. Computing weighted membership
for ADM-24 or earlier would require parameter sets encoding the repealed
pre-Act-127 categories, which `docs/parameter-verification.md` and `AGENT.md`
treat as a hazard rather than a gap to fill casually. The nine older years are a
historical and trend series; they are not engine input.

**And the two-year average straddles the boundary. This has been checked, and it
does not work.** Section 4001(7) defines long-term membership as the average of
the two most recently completed years, so a FY2025 determination needs SY2022-23
*and* SY2023-24 — the ADM-24 and ADM-25 files. Both were opened:

| | ADM-24 | ADM-25 |
|---|---|---|
| Title row count year | 2022-2023 | 2023-2024 |
| Bands | **2** — `Elem ( K - 6)`, `SEC ( 7 - 12)` | **3** — `Elem ( K - 5)`, `Middle ( 6 - 8)`, `SEC ( 9 - 12)` |
| Data rows | 254 | 254 |
| Unmatched against registry | 0 | 0 |
| Statewide total | 83,987.27 | 83,368.11 |

The bands are not merely different, they are **irrecoverably** different:

- Grade 6 falls inside ADM-24's `Elem ( K - 6)` but inside ADM-25's `Middle ( 6 - 8)`.
- Grades 7 and 8 fall inside ADM-24's `SEC ( 7 - 12)` but inside ADM-25's `Middle ( 6 - 8)`.

No arithmetic recovers that split, because neither file publishes grade-level
detail. Any attempt to apportion grade 6 out of a K-6 total would be an invention,
and § 4010's weights differ across exactly the boundary being invented.

**Therefore no § 4001(7) two-year average is formable from this page, for any
year.** A weighted-membership total is blocked from this source — definitively by
the band boundary, and independently by the gap register and the unverifiable
prekindergarten weight. The import's honest deliverable is a ten-year cross-check
and trend series plus one year of single-year ADM in current bands, and the spec
says so rather than implying a total is one step away.

One piece of good news from the comparison: the town code sets are **identical**
across the two years, and both join to the registry with zero unmatched. The join
is stable across the band change, so `join.ts` does not need per-year handling.

### 6. Towns are four different things, and `operated_by: null` is ambiguous

AOE publishes by resident district (town); § 4010 weights a *school district's*
membership. The obvious rollup — group towns by `operated_by` — is wrong and
fails silently. **58 of 268 registry towns have `operated_by: null`**, including
Burlington, Rutland City, South Burlington, Winooski, Springfield, St Johnsbury,
Colchester, Milton, Hartford and Stowe.

| Class | Examples | Real place? | Earns VT ADM? | In the FY25 file? |
|---|---|---|---|---|
| Town belongs to a union district | Addison (`op: ud/addison-northwest-54`) | yes | yes, via its UD | yes |
| Town **is** its own supervisory district | Burlington (`SU015 Burlington Supervisory District`; Burlington High School carries `op: town/burlington`) | yes | yes, as its own district | yes |
| Town operates a town school district inside a multi-town SU | Alburgh, Arlington, Cabot, Georgia, Thetford, Vernon, Westminster | yes | yes, as its own district | yes |
| Unpopulated or tuitioning place | Averys Gore, Glastenbury, Lewis, Warners/Warrens Grant, Averill, Ferdinand, Somerset; **Buels Gore reports 1/3/0** | yes | no operating district | mostly absent; Buels Gore present |
| Out-of-state member town | `T999` Orford NH (`su/rivendell-interstate`) | yes | no — its pupils are New Hampshire's | never |
| Residency reporting bucket | `901`–`906`, `T000 UNKNOWN` | **no** | **no** | never |

Note `registry/entities/sd.json` holds exactly one record (Jay/Westfield), so the
town school districts in class three have no separate registry entity.

The rule *"a town with no separate operating district is its own district"* is an
inference from `SU015 Burlington Supervisory District` and from Burlington High
School's `op: town/burlington`. Per `AGENT.md`'s closing rule it is a **hypothesis
to verify against AOE's own organizations data and the statute**, not something to
encode from inference. See Open questions.

### 7. A conservation invariant makes silent loss impossible

Town-level ADM-25 totals, computed from the artifact: K-5 41,392.21, 6-8
17,421.31, 9-12 24,554.59, **total 83,368.11** across 254 rows, no null cells.

The rollup must satisfy, per year and per band:

```
sum(district-level ADM) + sum(enumerated exclusions) == town-level total
```

Every exclusion is named individually with a justification. Buels Gore's four
pupils are the live case: a town with real ADM and no operating district. They
must appear as a justified exclusion, never vanish. This invariant is what would
have caught the `operated_by` rollup bug immediately, and it is the primary
regression guard for the whole import.

### 8. Values round to two decimals at ingest

The file's real precision is two decimals; the raw XML carries float artifacts
such as `79.509999999999991` for `79.51`. Rounding happens once, at ingest.

### 9. Reporting buckets are excluded structurally, not by name

`isReportingBucket(name)` in `tools/src/registry/placeholder.ts` matches whole
normalized names against a set containing `out of state` and `other`. The six
900-range records are compounds — `Other State -Massachusetts`, `Other Out of
Country` — so none match, and all six currently carry `reporting_only: false`
despite being the same class as `T000 UNKNOWN`.

The fix is structural: change the signature to `isReportingBucket({id, name})` and
add a conservative bare-numeric `^9\d\d$` rule alongside the existing
`PLACEHOLDER_ID_PREFIX`. Verified safe — those six are the only bare-numeric org
IDs anywhere in the registry across all nine entity files, and `T999` is the only
`T9xx` code, so the `T` prefix correctly excludes Orford NH. The existing guard at
`tools/src/registry/sync.ts:254` then drops them from `member_towns` for free.

`T999 ORFORD NH` keeps `reporting_only: false`. It is a real town and a real
member of the Rivendell Interstate district; its `operated_by: null`, while
Vermont siblings Fairlee, Vershire and West Fairlee all carry
`op: ud/rivendell-interstate`, is correct and load-bearing.

## Architecture

```
(human, browser)   education.vermont.gov ADM page          403 to scripts
        |  manual download, 10 files
        v
intake/aoe-adm/fy<YEAR>/<file>.xlsx   raw, LFS (.gitattributes already routes it)
intake/aoe-adm/fy<YEAR>/provenance.yaml
                                      sha256 / source_url / retrieved_by+date
                                      retrieval_method: manual-download
                                      document_type: aoe_report
intake/aoe-adm/page-2026-07-29.html   saved page snapshot, normal git object
intake/aoe-adm/source.yaml            page URL, selector, inventory of 10 years
        |  npm run adm:import
        v
warehouse/aoe-adm/adm<NN>.yaml        town x band, verbatim. Committed, diffable.
warehouse/aoe-adm/gaps.yaml           what § 4010 still needs
        |  derived at build time, NOT committed
        v
build/ + site/src/generated/adm.json  district rollup -> MembershipInput.adm_years
```

The split follows the rule already stated in `.gitignore`: *"Nothing derived is
committed — the git history should only ever show source data changing."* A
transcription of a hashed artifact is source data and is committed, exactly as
`extract.ts` does for budget PDFs. The town-to-district rollup is a pure function
of warehouse plus registry, so it is derived and regenerated.

`source.yaml` needs its own schema rather than reusing `collector-1.0`, because
collector configs are keyed by an `entity` slug and
`tools/src/validate/rules.ts:261` requires every slug to resolve to a registry
entity. AOE has no org record for itself — the only `state/` entity is Woodside,
closed 2020 — so reusing the collector schema would mean inventing a fake
registry entity.

### Modules

Each is a pure function, separately testable; only the CLI touches disk.

| Module | Responsibility |
|---|---|
| `tools/src/aoe/adm/discover.ts` | Reads the saved page snapshot, matches links by text, reports which years exist upstream that intake lacks. |
| `tools/src/aoe/adm/parse.ts` | File bytes to rows. Recognizes header shapes; hard-fails on an unrecognized one, listing the headers found. |
| `tools/src/aoe/adm/year.ts` | Parses and cross-checks every year label; asserts the `adm_label + 1998` invariant. |
| `tools/src/aoe/adm/join.ts` | Town code to registry slug by `aoe_org_id` only; hard-fails on unmatched. |
| `tools/src/aoe/adm/classify.ts` | The six-class town taxonomy, and which classes earn ADM. |
| `tools/src/aoe/adm/aggregate.ts` | Town to district rollup, enforcing the conservation invariant. |
| `tools/src/aoe/adm/gaps.ts` | The § 4010 gap register. |
| `tools/src/cli/adm-import.ts` | CLI: `npm run adm:import` |

### Schemas

Two new schemas, both wired into `SchemaName` and `SCHEMA_IDS` in
`tools/src/validate/schemas.ts` and into `npm run validate`:

- `schemas/aoe-source-1.0.schema.json` — the page, selector, and year inventory.
- `schemas/adm-1.0.schema.json` — a year's town-level series, its
  `bands_as_published`, its year labels, and its `not_published` entries.

### Spreadsheet parsing

Use a maintained library rather than hand-rolled ZIP/XML parsing.
`read-excel-file` is the recommendation on the evidence gathered: version 9.3.5
published 2026-07-28, MIT, read-only by design, four small dependencies
(`fflate`, `saxen`). The alternatives were worse for this repo — `exceljs` 4.4.0
is nineteen months stale with a nine-package tree including `archiver` and
`unzipper@0.10` we would never use; `node-xlsx` resolves SheetJS from a CDN
tarball URL, defeating lockfile-verified installs; npm `xlsx` 0.18.5 is the
abandoned community build with unfixed advisories.

**This is a gate, not a settled choice.** A trial install could not be completed
in the design environment, so the first implementation step verifies
`read-excel-file` parses all ten years correctly — including the older `.xls`
files if any turn out not to be `.xlsx`. If it mis-parses any year, the choice is
revisited before anything is built on it.

## Validation integration

`npm run validate` makes three assumptions that a statewide AOE source violates.
All three were confirmed by running the validator against real files rather than
read off the code, and each needs an explicit decision in change 3.

**1. Intake paths are per-SU and per-fiscal-year.** `budget-1.0.schema.json`
constrains `source` to `^intake/[a-z0-9-]+/fy[0-9]{4}/[^\s]+$`. The design
originally proposed `intake/aoe/adm/<file>`, which does not match. Resolved by
adopting the existing convention instead of relaxing the rule: **`intake/aoe-adm/
fy<YEAR>/`**, where `aoe-adm` plays the same role `su-burlington` does under
`collectors/`. This is already in place for ADM-24 and verified to match the
pattern, and `.gitattributes` routes it to LFS.

**2. Provenance `entity` must resolve to a registry entity.** Confirmed:

```
ERROR intake/aoe/adm/provenance.yaml [registry-reference]
      "state/agency-of-education" is not a known registry entity.
```

The hash and byte checks passed — only the entity reference failed. AOE's API
publishes no organization record for the Agency itself, and the only `state/`
entity is Woodside, closed 2020. Two ways out, and the recommendation is the
first:

- Extend `common-1.0`'s `entity_ref` with a `source/` prefix (`source/aoe-adm`)
  and exempt it in `checkRegistryRefs`. Keeps the registry purely synced from
  upstream, which is the property that makes `registry:sync` safe to re-run.
- Hand-author a registry entity for AOE. Rejected: the registry is generated, and
  a hand-made record would be at the mercy of the next sync.

Until that lands, retrieval facts for ADM-24 live in
`intake/aoe-adm/fy2024/NOTES.md` — Markdown, so the validator ignores it — rather
than in a `provenance.yaml` that would fail the build. The note says why.

**3. Every warehouse YAML is validated as a budget record.** The walk is
unconditional, so an ADM series file produces a cascade of spurious errors:

```
ERROR warehouse/aoe/adm/adm24.yaml [schema:budget]
      / must have required property 'status'
      / must have required property 'revenues'
      ... 10 more
```

Change 3 must make the warehouse walk discriminate before writing anything there
— dispatching on a path prefix or on the record's own `schema_version`/kind — or
the first ADM file committed breaks `npm run validate` for everyone.

## The gap register

`warehouse/aoe-adm/gaps.yaml` states, per § 4010 input, whether this source
supplies it:

| § 4010 input | Supplied by this source? |
|---|---|
| ADM, K-5 / 6-8 / 9-12 | yes |
| ADM, prekindergarten | no — not published in this report |
| `state_placed_fte` (§ 4001(7)(B)) | no |
| `poverty_185_fpl` | no |
| `english_learners` | no |
| `persons_per_square_mile` | no |
| small school two-year enrollment | no |

The site reads this so a `null` in the "show your work" walkthrough can say *why*
it is null rather than rendering blank. Importing ADM alone does **not** unblock a
weighted-membership total, and this file is what makes that an explicit,
documented fact instead of a mystery.

## Change sequencing

Three separate changes, landing in this order. Each stands alone and is
independently reviewable; the two repairs are prerequisites of the import rather
than part of it.

1. **Registry: 900-range records are reporting buckets.** `placeholder.ts`,
   its tests, and the resulting registry output. Reviewable on its own merits
   without reference to ADM.
2. **Typecheck `site/`, and fix the drift it exposes.** `site/tsconfig.json`, the
   root reference, and `model-tool.ts`. Ordered second because it is the change
   most likely to surface further drift, and better to see that in isolation than
   tangled with new code.
3. **The ADM import.** Schemas, `tools/src/aoe/adm/*`, the CLI, intake and
   provenance, warehouse output, the gap register, and the build-time rollup —
   including the three validator changes in "Validation integration", which must
   land before or with the first warehouse file rather than after it.

## Prerequisite repair: site is not typechecked

`tsconfig.json` references `./model` and `./tools` only, and there is no
`site/tsconfig.json`, so `site/` is excluded from `npm run typecheck`. As a
result `site/src/scripts/model-tool.ts:311` still calls
`computeWeightedMembership` with the pre-correction shape it had before commits
27ac20c and c240af0:

| model-tool.ts passes | `membership.ts` expects |
|---|---|
| `prek`, `elementary`, `secondary` | `prekindergarten`, `kindergarten_through_5`, `grades_6_through_8`, `grades_9_through_12` |
| `economically_deprived` | `poverty_185_fpl` |
| `english_learners: [{category, count}]` | `english_learners: number \| null` |
| `sparsity_eligible: boolean` | `persons_per_square_mile: number` |
| `small_school_eligible: boolean` | `small_schools: SmallSchool[]` |

Every field the importer populates is a field the site currently gets wrong, so
the import has no correct consumer until this is fixed. Scope: add
`site/tsconfig.json` and a root reference, then correct `model-tool.ts`.

## Testing

- **Parse fixtures.** Tests read the real artifacts from `intake/` directly rather
  than from a copied fixtures directory, so what the tests validate is the same
  bytes provenance hashes. The series is small — ADM-25 is 28 KB — so this costs
  an LFS fetch and nothing else. Tests skip with a clear message, rather than
  fail, when the artifacts are not present locally.
- **Golden totals.** Town-level, per year, pinned as parsed:

  | Year | Bands | Totals | Grand total |
  |---|---|---|---|
  | ADM-25 | K-5 / 6-8 / 9-12 | 41,392.21 / 17,421.31 / 24,554.59 | 83,368.11 |
  | ADM-24 | K-6 / 7-12 | 47,301.13 / 36,686.14 | 83,987.27 |

  Any parser change that moves a total fails. The two grand totals are *not*
  expected to match — they are different school years — but a year-over-year swing
  beyond a few percent should be treated as a parse failure rather than a
  demographic finding until checked. The observed change is -619.16, or -0.74%.
- **Band-regime coverage.** One golden per distinct `bands_as_published` value, so
  adding a year with a new header shape forces an explicit test rather than
  quietly reusing another year's expectations.
- **Conservation.** District rollup plus enumerated exclusions equals the
  town-level total, per year and per band.
- **Join.** All rows resolve; an injected unknown code fails the run.
- **Year invariant.** `count_year_start == adm_label + 1998` across all ten
  years; contradictory title/link/filename fails.
- **Classification.** 900-range are buckets; `T999` is not; Buels Gore is an
  excluded-with-ADM case; `T000` stays `reporting_only`.
- **Link text normalization.** ADM-16's trailing zero-width space and ADM-16/17
  NBSP parse correctly.
- **Registry.** The 900-range records gain `reporting_only: true` and leave
  `member_towns`.

## Error handling

Hard failure, naming the offender: unmatched town code; unrecognized header
shape; sha256 mismatch; disagreement among title row, link text and filename;
conservation invariant violation; discovery count mismatch between selector scope
and link-text matches.

Recorded rather than failed: absent prekindergarten column; a year whose
`bands_as_published` do not map to § 4010 bands (imported as series, withheld
from the engine); towns absent from a year's file (a genuine zero, not missing
data).

## Open questions

1. **The town-to-district rule.** Verify *"a town with no separate operating
   district is its own district"* against AOE's `organizations` data and the
   statute before implementing `aggregate.ts`. The conservation invariant
   protects against getting it wrong silently, but the rule itself must be
   established, not inferred.
2. **`read-excel-file` verification** across all ten years, including any `.xls`.
3. **How many distinct band regimes the ten years contain.** ADM-24 and ADM-25
   differ; ADM-16 through ADM-23 are unopened. Each distinct regime is a header
   shape `parse.ts` must recognize and a `bands_as_published` value, so this sets
   the parser's real surface area. It does not block the design — the parser
   hard-fails on an unrecognized shape rather than guessing — but it sizes the
   work.

**Resolved during design:** whether ADM-24 reports current bands. It does not —
it publishes two bands (`K-6`, `7-12`) against ADM-25's three, irrecoverably. See
decision 5.

## Out of scope

- Importing poverty, English learner, state-placed or density data. Each is a
  separate source with its own provenance; the gap register names them so the
  absence is documented rather than forgotten.
- Any attempt to automate retrieval from `education.vermont.gov`.
- Backfilling `enrollment.adm` in budget records. That field is the district's
  voice and is filled from budget documents; this series stays separate.
- Reconciling AOE ADM against district-stated ADM. That comparison becomes
  possible once budget records exist, and belongs with `membership_note`.
