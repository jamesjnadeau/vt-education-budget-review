# Design: correcting registry data, and reporting the corrections to AOE

Status: draft, pending review
Date: 2026-07-31

## What this is for

The registry mirrors AOE's organization lists. Some of what AOE publishes is
stale — Addison Central Supervisory District is listed at
`http://www.acsu.k12.vt.us/`, a host that no longer serves the district, whose
site is `https://www.acsdvt.org`. There will be more: names that predate a
merger, `operated_by` relationships that no longer hold, coordinates that land
in the wrong town.

This design does two things that are usually treated as one and should not be:

1. **Assert the correct value locally**, with evidence, so the site and the
   model stop repeating a value we know to be wrong.
2. **Send the correction upstream**, in a form somebody at AOE can act on, and
   then track whether they took it.

The second is the reason the first cannot be a quiet edit. A correction that
only ever lives in this repo makes the repo diverge from the source it claims to
mirror, permanently and invisibly. A correction that is *published as a claim
against a named source* is a different object: it has a premise that can be
checked, a status that can change, and an end state where it disappears because
the source now agrees.

## What already exists, and what is wrong with it

Every `RegistryEntity` carries `manual_overrides: ManualOverride[]`, where a
`ManualOverride` is `{field, reason, set_by, set_date}`. `applyOverrides` in
`tools/src/registry/sync.ts` re-applies them after every sync, under a comment
that states the intent exactly right:

> The API is a convenience layer, not a dependency: a value a human set
> deliberately must survive the next sync.

Three things are missing, and the third is a defect rather than an omission.

**No record of what the source said.** The override stores the human's value.
It does not store the AOE value it replaced, so nothing can later ask "does AOE
still publish the thing we objected to?" — and that question is the entire
lifecycle.

**No evidence.** `reason` is free prose. `docs/parameter-verification.md`
already establishes that this project does not accept prose where a citation is
possible; a structural claim about which district operates a school deserves at
least what a statutory weight deserves.

**The override never retires.** `applyOverrides` pins the field forever. When
AOE eventually corrects the ACSU website upstream, the override still wins, the
registry reports no change, and nobody learns that the correction was accepted.
Worse, if AOE moves the field to some *third* value — a new site, a merger —
that value is silently discarded. This is the one behaviour in the current code
that is actively wrong rather than merely absent.

There are currently **zero** non-empty `manual_overrides` across all nine entity
files, verified by counting them. Nothing needs migrating.

## Constraints established before designing

**The channel is email to a person at AOE.** Not a portal, not an API, not a
pull request against their data. Whatever this produces has to be readable and
actionable by someone who has never seen this repository, and who works in AOE's
systems rather than ours.

That single fact drives more of the design than anything else. It is why
corrections are keyed on **AOE's `OrgID` and organization name** in everything
that leaves the repo, and why repo slugs appear in none of it. `su/addison-central`
is an internal identifier; `SU003 — Addison Central Supervisory District` is a
record the recipient can open.

**Corrections span four very different stakes.** A wrong website is cosmetic. A
wrong `operated_by` changes model output silently, because the whole modeling
tool keys off which districts serve which towns — the sync module header already
says so. A design that treats these identically either over-burdens the cheap
case or under-evidences the expensive one.

**A correction is a claim, and a claim has a premise.** Every correction asserts
"AOE currently publishes X, and X is wrong." If AOE never published X, the
correction is incoherent and should not validate.

## Decisions

### 1. The register is the source of truth; entity overrides become generated

Corrections are authored in one file, `registry/corrections.yaml`. The sync
applies them and *regenerates* each entity's `manual_overrides` from the
register. Entity files stay a faithful mirror of AOE plus a clearly labelled
applied layer; nobody hand-edits an override into an 830 KB JSON file again.

The alternative — enriching the embedded overrides in place — was rejected
because corrections are a workflow whose state outlives any one record.
Scattered across nine entity files, "what is still open with AOE?" is not
answerable, a reviewer cannot see the set in a diff, and both the email report
and the CSV would have to walk every file to reconstruct a list that was never
stored as a list.

### 2. Evidence is tiered by what the field can break

| Field class | Fields | Required evidence |
|---|---|---|
| `contact` | `website`, `mailing_city` | `retrieved_url` |
| `identity` | `name` | `cited_document` |
| `structural` | `supervisory_union`, `operated_by`, `member_towns` | `cited_document` |
| `spatial` | `latitude`, `longitude`, `municipality` | `cited_document` or `derived_artifact` |

This table *is* the correctable-field whitelist. A field not listed here cannot
be corrected, and adding one is a deliberate edit to the tier table rather than
a side effect of writing a correction. Correcting `municipality` also sets
`municipality_basis` to `manual`, or to
`census_geocoder_point_in_polygon` when the evidence class is
`derived_artifact` — the basis must never continue to claim a provenance the
value no longer has.

The three evidence classes:

- **`retrieved_url`** — `url`, `retrieved` (date), `observation` (what you saw).
  Sufficient for contact fields because the claim is directly checkable by the
  recipient in one click.
- **`cited_document`** — `document` (title), `document_url` or an `intake/`
  path, `retrieved`, and `quote`: the operative sentence, not a summary. This is
  deliberately the standard `docs/parameter-verification.md` sets for a
  statutory parameter. A wrong `operated_by` propagates into every scenario the
  same way a wrong weight does, so it earns the same burden of proof.
- **`derived_artifact`** — a path into `derived/` plus the provenance hash of
  the record relied on. Exists because `derived/school-municipality/` already
  produces point-in-polygon municipality assignments with their own provenance;
  a spatial correction should be able to cite that computation rather than
  re-argue it in prose.

### 3. Human-authored status is three values; the rest is computed

Authored: `open`, `sent`, `withdrawn`. Nothing else. Storing "adopted" by hand
would mean maintaining a fact about AOE's data inside a file AOE never touches.

Each sync computes upstream state by comparing the value AOE now publishes
against the two values on the correction:

| AOE now publishes | Computed state | Behaviour |
|---|---|---|
| `our_value` | **adopted** | Override retires itself. **No entity value changes** — the two values are equal — we simply stop asserting it. Reported as adopted. |
| `aoe_value` (unchanged) | **outstanding** | Correction keeps applying. Nothing to report beyond "still open." |
| anything else | **diverged** | Correction keeps applying, and the sync raises an **error**. `npm run validate` fails until a human resolves it. |

Divergence deliberately fails safe in both directions: the evidence-backed value
stands rather than being silently replaced, *and* the build stops rather than
letting the divergence sit unnoticed. Resolution is a human editing the
correction — updating `aoe_value` and re-checking, or setting `withdrawn`.

### 4. Both figures are kept, never reconciled

The entity gains an `aoe_published` map: field name to the value AOE publishes,
for exactly the fields under correction. This mirrors what `CONTRIBUTING.md`
requires of budget records — where a district's number and ours disagree, the
schema keeps both figures deliberately rather than picking one.

## Components

### `registry/corrections.yaml`

Validated against `schemas/corrections-1.0.schema.json`, id
`urn:vt-budget:schema:corrections:1.0`.

```yaml
schema_version: "1.0"
corrections:
  - slug: su/addison-central
    field: website
    aoe_value: "http://www.acsu.k12.vt.us/"
    aoe_value_observed: "2026-07-29"
    our_value: "https://www.acsdvt.org"
    evidence:
      class: retrieved_url
      url: "https://www.acsdvt.org"
      retrieved: "2026-07-31"
      observation: >-
        Serves the live Addison Central School District site. The
        acsu.k12.vt.us host AOE publishes does not resolve.
    submitted_by: "James Nadeau"
    submitted_date: "2026-07-31"
    status: open
    sent_date: null
    note: null
```

`aoe_value_observed` names the snapshot the premise was read from, so a stale
correction is distinguishable from a wrong one.

### `tools/src/registry/corrections.ts`

Loads and parses the register; exposes `applyCorrections(entity, register)`,
which replaces `applyOverrides` in `sync.ts`. It applies `our_value` for every
correction that is neither `withdrawn` nor computed-`adopted`, regenerates
`manual_overrides` as output, and populates `aoe_published`. It also exposes
`upstreamState(correction, aoeValue)` returning `adopted | outstanding | diverged`,
which is a pure function and is where most of the tests point.

### `checkCorrections` in `tools/src/validate/rules.ts`

Sits beside the existing `checkRegistryRefs` and `checkPlaceholderEntities`.

- schema validation via ajv; `corrections` added to `SchemaName` in `schemas.ts`
- every `slug` resolves to a registry entity
- every `field` is on the correctable whitelist. Identity keys (`slug`,
  `aoe_org_id`, `type`) and generated fields are refused: you cannot correct the
  thing that identifies the record.
- the evidence class matches the field's tier, and a `cited_document` carries a
  substantive `quote` rather than a stub
- `aoe_value` matches what the snapshot named by `aoe_value_observed` actually
  published — a correction whose premise was never true fails here. This is
  implemented for the fields that map straight onto a raw API key (`website`,
  `name`, `mailing_city`, `latitude`, `longitude`) and deliberately **not
  attempted** for `operated_by`, `supervisory_union`, `member_towns` or
  `municipality`: the first three would require re-implementing the
  type-dependent `ParentOrg`/`OperatedBy` decoding that `sync.ts`'s header warns
  against, where a copy that drifted would report false premises against true
  claims, and the fourth has no raw source at all. Naming a snapshot that is not
  in the repository fails here too. For the four unchecked fields
  `correction-diverged` remains the only signal, which is why its message names
  both possible causes rather than asserting one.
- **diverged** corrections are errors

### `tools/src/cli/registry-corrections.ts`

Registered as `npm run registry:corrections`.

- `--report` writes `derived/corrections/report-YYYY-MM-DD.md`, the email body
- `--csv` writes `derived/corrections/corrections-YYYY-MM-DD.csv`

Both read the same register and apply the same filters. Neither emits a repo
slug.

**The markdown report** groups by entity type then organization. Each item gives
the OrgID, the organization name, the field, what AOE publishes, what it should
be, the evidence, and the date checked. It closes with a section listing
corrections AOE has adopted since the previous report — telling a data steward
"these six landed, thank you" is most of what makes the next email get read.

**The CSV** is RFC 4180, eight columns:

```csv
org_id,org_name,field_name,old_value,new_value,evidence,checked_date,status
SU003,Addison Central Supervisory District,website,http://www.acsu.k12.vt.us/,https://www.acsdvt.org,"Live district site; acsu.k12.vt.us does not resolve",2026-07-31,open
```

`field_name`, `old_value` and `new_value` are the requested core. `org_id` and
`org_name` precede them because a row that does not identify its organization
cannot be acted on. `evidence`, `checked_date` and `status` trail them so a
steward can triage the file without returning to the email.

## Testing

Test-first, per repo convention. The cases that carry weight:

- `upstreamState` returns each of the three states for the three inputs
- a correction applies; a `withdrawn` one does not
- **adoption retires the override without changing any entity value** — asserted
  by comparing the serialized entity before and after. This is the central
  claim of decision 3 and the one most likely to regress.
- divergence keeps the corrected value *and* produces an error finding
- two syncs in a row leave corrections intact and `manual_overrides` regenerated
  identically
- each evidence tier rejects the wrong evidence class
- a correction whose `aoe_value` does not match the named snapshot fails validation
- the report and the CSV both contain the OrgID and contain no repo slug
- CSV quoting round-trips a value containing a comma and one containing a quote

## Worked example, shipped with the implementation

The ACSU website correction above is authored as the first record in the
register, its evidence gathered by actually retrieving both URLs and recording
what each returned. It exercises the `contact` tier, the `retrieved_url`
evidence class, the report, and the CSV end to end.

## Out of scope

- **A site page for the register.** `tools/src/aoe/adm/gaps.ts` establishes the
  pattern for publishing a register of this kind, so adding one later is cheap.
  Nothing needs it yet.
- **An authoring CLI.** The register is hand-edited YAML; the validator catches
  mistakes. A wizard would be machinery around a file edited a few times a year.
- **Automated submission to AOE.** There is no intake endpoint. A human sends
  the email.
