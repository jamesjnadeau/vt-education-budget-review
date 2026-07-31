# Where the small/sparse plan landed

This folder holds the plan and its draft artifacts. The drafts were written against an
imagined API and an imagined file format; the implemented versions live in the repository
proper and differ where the repository's own conventions required it. Kept here as the
record of what was designed and why.

| Draft here | Implemented as | What changed |
|---|---|---|
| `small-sparse-integration-plan-v2.md` | — | The plan. Unchanged. |
| `small-sparse-verification-worksheet.md` | `docs/small-sparse-verification-worksheet.md` | Moved, so it sits beside `parameter-verification.md`. |
| `small-sparse.ts` | `model/src/small-sparse.ts` | Rewritten against the real engine API. The draft imported `param` and `node` from `./types`; the engine's constructors are `input`, `mean`, `quotient`, `parameterNode` and `derive`, and its node type is `CalcNode`. Anticipated by the plan's §9 — the `status: "unverified"` flag was kept and the call shape fixed around it. |
| `fy2030-small-sparse.yaml` | `model/parameters/fy2030-small-sparse.yaml` | Converted to the repo's parameter-file shape: a flat `parameters:` map with `value`/`unit`/`description`/`citation`, `status: draft`, and non-empty `citation.statute`. The `statutory:`/`framework:` split survives as key prefixes plus a new `is_law` field, which `parse.ts` enforces. |
| `small-sparse.schema.json` | `schemas/small-sparse-1.0.schema.json` | `urn:` `$id` to match the other schemas; thresholds and comparators made nullable, because every one of them is null; `status` added per screen in the four-kind blank vocabulary; `total` typed `null` rather than nullable. |
| `school.schema.json` | amendments to `schemas/registry-1.0.schema.json` | Schools were already registry entities with coordinates and grade lists, so this became an amendment rather than a new entity — as §0 of the plan predicted. `municipality` gained a `municipality_basis` beside it: the AOE mailing city is a postal designation and cannot decide which town's density governs a school. |

Phases, per the plan's §6:

- **Step 0** — read the enacted acts and fill the parameter file. Not done: it needs a person
  with a browser, and everything downstream produces nothing publishable until it happens.
- **v1** — implemented. Blank taxonomy, screens, registry amendments, census land area, school
  municipality resolution, goldens, the `/small-sparse/` page and its methodology.
- **v1.1** — not started. Pinned OSM extract, routing precompute, distance-to-nearest-same-span.
  The `derived` provenance kind that phase needs is in place and in use.
- **Blocked on closure scenarios** — not started, as the plan says it must be.
