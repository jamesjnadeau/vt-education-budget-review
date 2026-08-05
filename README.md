# Vermont School Budget Data Pipeline

A git-backed, statically hosted site that publishes every Vermont supervisory union's released
budgets in a normalized, documented form, and lets any resident model what merging or closing
schools would do to their town's education spending and homestead tax rate — with every step of
the arithmetic shown and cited to statute.

The repository *is* the data warehouse. GitHub Actions is the ETL scheduler. There is no server,
no database, and no login.

## Current state

The pipeline is built, tested and running end to end. What it lacks is inputs.

| | |
|---|---|
| Entity registry | **867 entities**, synced from the AOE Public Data API, raw responses archived |
| Collector configs | **54**, one per active supervisory union |
| Budget documents collected | **0** |
| Warehouse records | **0** |
| Statutory parameters verified | **56 of 98**, none of them countersigned by a person |
| Act 170 groupings transcribed | **0** |
| Golden fixtures reproducing a state figure | **0** |
| Small/sparse boundary fixtures | **8**, hand-computed against hypothesis thresholds |
| Schools located in a municipality | **277 of 438** |
| Vermont towns with Census land area | **252 of 256** county subdivisions |
| Site pages built | **325** |
| Tests | **282 passing** |

Three of those gaps are load-bearing and deliberate.

**No statutory parameter is verified by a person.** The values that carry citations were read
from statute text snapshotted verbatim in `model/statute/`, but the retrieval and transcription
were automated and nobody has yet put their name to them — which is why every parameter file is
still `status: draft`. Everything the snapshot does not cover is `null` with `verified: false`,
including the whole small and sparse layer: `legislature.vermont.gov` serves an incomplete TLS
chain to automated clients and `education.vermont.gov` returns 403 to them. Rather than fill
values in from memory or a secondary mirror, they stay null. Vermont's education funding statutes
were amended by Act 127 of 2022, Act 73 of 2025 and Act 170 of 2026, so a recalled weight is
quite likely to be a repealed one. See [docs/parameter-verification.md](docs/parameter-verification.md).

**No Act 170 groupings are transcribed**, for the same reason. Inventing twenty groupings of
district names would put a fabrication in the single place a reader most depends on being told
the truth.

**No school can be screened as small or sparse.** Every threshold in Act 73 Sec. 37 is null and
unverified, so the two statutory screens return nothing for all 438 schools — independently of
how complete the geography behind them is. Separately, and not our doing, the Agency of Education
has published no *by necessity* determinations, because the rules governing them are not yet
written. See [/small-sparse/](site/src/pages/small-sparse/index.astro) and
[docs/small-sparse-verification-worksheet.md](docs/small-sparse-verification-worksheet.md).

None of these gaps can leak into a published figure. The engine refuses to compute from an
unverified parameter — it returns `null`, marks the node `unverified`, and that status propagates
upward. The site renders that refusal explicitly rather than hiding it.

## Getting started

```bash
npm install
npm run registry:sync          # pull the AOE directory, archive the raw responses
npm run validate               # the gatekeeper: schemas, provenance, hashes, references
npm test                       # engine unit tests and golden tests
npm run dev                    # build data and serve the site locally
```

Requires Node 22+. Git LFS is used for intake artifacts.

## Layout

```
registry/      entity registry synced from the AOE API, plus dated raw snapshots
intake/        raw budget artifacts, exactly as released, never edited  (Git LFS)
warehouse/     normalized records conforming to the budget schema
derived/       committed products this pipeline COMPUTED rather than retrieved, each with a
               `kind: derived` provenance record naming the algorithm, its version, the
               pinned inputs and the run
schemas/       versioned JSON Schemas
model/         the formula engine, plus parameter files and golden fixtures
collectors/    per-SU acquisition configs and extraction mappings
tools/         pipeline CLIs
site/          Astro static site generator
docs/          procedures
```

## Commands

| Command | Does |
|---|---|
| `npm run registry:sync` | Fetch the AOE directory, snapshot it, diff, report |
| `npm run registry:sync -- --from DATE` | Rebuild from an archived snapshot, no network |
| `npm run validate` | Schema, provenance, hash, reference and recomputation checks |
| `npm run params` | Parameter verification status |
| `npm run params -- --stale 400` | Citations due for re-reading |
| `npm run census:import` | Fetch Census land area (and population, with a key) into intake and the warehouse |
| `npm run school:municipality` | Resolve each school's coordinates to the town it stands in |
| `npm run collect -- --init` | Scaffold collector configs from the registry |
| `npm run collect -- --check-urls` | Source URL liveness |
| `npm run extract -- --entity X --fy Y --init` | Scaffold an extraction mapping |
| `npm run extract -- --entity X --fy Y` | Emit a warehouse draft from a mapping |
| `npm run build` | Validate, build data, build site |

## The three rules everything else follows from

### 1. A blank always means one specific thing, and the site says which

There are exactly four reasons a figure is absent, they belong to different parties, and they
are never shown as the same thing:

- **The district did not publish it** — `missing_input`. Recorded in the warehouse record's
  `not_published` list with who confirmed it and on what date. Validation rejects any
  unexplained null in a money field, so this cannot be skipped.
- **A statutory value has not been verified against current law** — `unverified`. Tracked in
  the parameter file's citation block. The engine will not compute with it.
- **The State has not made a decision that does not yet exist** — `undetermined`. The Agency of
  Education has published no small or sparse by necessity determinations, because the rules
  that would govern them are unwritten. Showing that as a missing document would imply the
  Agency failed to publish something, which is false and unfair to them.
- **The question cannot be answered from public data at all** — `not_computable`. Whether a
  mountain gap makes a bus route unsafe is a certification the supervisory union makes; whether
  a receiving school could absorb the students needs unpublished local capacity figures. These
  are terminal by design and are correct final answers, not to-do items — a coverage dashboard
  that painted them red would be lying about what completion looks like.

The first is a fact about a document. The second is outstanding work on our side. The third is
somebody's future decision, and the fourth is nobody's, ever. The extraction tooling makes "we
did not look" literally unrepresentable: a mapping file must declare where the document states
salaries, health insurance and FTEs, or record that it does not, and the extractor refuses to
run until it does.

### 2. Provenance is mechanical, not aspirational

Raw artifacts land in `intake/` exactly as released and are never edited. Each carries a
`provenance.yaml` recording the source URL, retrieval date and method, SHA-256 and who fetched
it. CI re-verifies those hashes on every pull request; a mismatch is always an error and never a
prompt to update the hash.

Every warehouse record points at the intake artifact it came from. CI rejects any record whose
source does not exist.

### 3. The tool computes and explains — it does not score, rank, or recommend

There is no `savings` field anywhere in the codebase and there will not be one. Scenario results
are signed deltas, presented in both directions with equal weight, and every assumption is
exposed with its own written rationale. Consolidation assumptions default to *no* reduction, so
any reduction shown is one the user chose and can see. Transportation costs can be set to rise
as well as fall, because consolidation frequently lengthens bus routes — a tool that only let
that figure fall would be modelling a conclusion rather than a system.

## Architecture notes worth knowing before changing anything

**The AOE API's relationship fields mean opposite things for towns and schools.** For a town,
`ParentOrg` is its union district and `OperatedBy` is its supervisory union. For a school it is
the reverse. Reading `ParentOrg` uniformly as "the parent" produces a registry that looks
entirely plausible and is wrong about who operates what. `tools/src/registry/sync.ts` untangles
this; nothing downstream reads the raw fields.

**Slugs are assigned once and never recomputed from names.** AOE names will churn as the 2029
reorganization proceeds. A URL cited in a committee packet has to keep resolving afterwards.

**Entities close, they are never deleted.** Closed supervisory unions stay in the registry with
their close date, which is what before-and-after merger comparisons depend on.

**Registry snapshots are stored uncompressed**, deviating from the original plan. Gzip embeds a
timestamp, so an unchanged nightly response would produce different bytes and a fresh git blob
every night; uncompressed it is byte-identical and free to keep. Git deltas and compresses its
own objects anyway.

**The engine never touches the filesystem or network**, so the same code runs in the build
pipeline and in the browser. Node-only parameter loading lives in a separate module that the
main entry point does not import.

## Known gaps

- No budget documents collected. The coverage dashboard shows all 324 expected district-years as
  missing, which is accurate.
- No statutory parameter verified; the calculation's *structure* needs verifying alongside its
  values, since correct numbers in a wrong structure produce confident wrong answers.
- Act 170 groupings not transcribed.
- No golden fixtures. A test gate prevents any parameter file from claiming verified status
  while `model/goldens/` is empty — checking citations by eye and reproducing the state's
  published figures are different claims, and the second is the one that matters.
- Scenario support covers mergers. School closure with student reassignment is not yet
  implemented.
- The foundation formula is structural only; its parameters are marked contingent and hold no
  values, because the Legislature has not set them.

## Web analytics

The published site loads [Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/),
which is cookieless and collects no personal data — consistent with the site's "no server, no
database, no login" design. The beacon is emitted **only** by the production GitHub Pages deploy:
`site/src/lib/analytics.ts` renders it solely when the build sets `PUBLIC_CF_ANALYTICS=1`, and that
flag is set exclusively in the merge-to-main `Deploy` workflow. Local development (`npm run dev`),
local builds, and PR previews never load it.

## Licence

Code MIT, data and documentation CC-BY-4.0. See [LICENSE](LICENSE) and [LICENSE-DATA](LICENSE-DATA).
