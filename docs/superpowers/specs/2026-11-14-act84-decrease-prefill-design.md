# Act 84 decrease in the model prefill

Status: approved in conversation, 2026-11-14. Short design (a small change).

## Why

Loading a district on `/model/` fills its grade counts and education spending,
but leaves the "Act 84 transition decrease" field blank. Every parameter year
the form can load (FY2025–FY2027) carries `tax.transition.phase_out_share`, so
a blank field makes the engine return "not computable" for the district's
rate. A reader who loads a district and sees no rate has no clue that this
one field is why. AOE's 2024-02-08 worksheet
(`intake/aoe-guidance/2024-02-08-act-84-tax-rate-discount/`) has the figure
for every district that has one.

## Goals

- Picking a district fills `act84-decrease` with its FY2025 decrease from the
  worksheet, and the note under the field says where the number came from.
- A district the worksheet does not list gets 0. This is the worksheet
  README's rule, and the one behind 86 of 97 FY2026 rates reproducing in
  `docs/act-127-transition.md`.
- A pick with no figure (a supervisory union, or a district AOE did not count
  in FY2024) clears the field and says so. A previous pick's figure is never
  left behind.
- A value the reader typed is never overwritten, the same as the other
  prefilled fields.

## Non-goals

- The worksheet's FY2026–FY2029 columns. They predate Act 183 and are not
  divided by the statewide adjustment. Only the FY2025 column is read.
- Applying Sec. 3(g) (mergers and withdrawals) as a rule. No district in the
  picker formed after February 2024 (below), so none needs it yet.
- Changing the engine, the share link (`act84_decrease` is already a share
  field), or the income-sensitized rate gap.

## Constraints

- The intake artifact is never edited. The import checks the PDF's sha256
  against its provenance before reading the `.txt` beside it (pdftotext
  `-layout` output of that PDF).
- Nothing derived is committed except the warehouse record, which the import
  writes and nobody hand-edits (the `edspend:import` pattern).
- Public text is plain, at about a 5th-grade reading level (AGENT.md).

## Findings that shape it

- All 39 worksheet rows resolve to a registry district by AOE's own FY2024
  EdSpend names (`warehouse/aoe-edspend/fy2024.yaml`, district rows). The
  worksheet dates from February 2024, so FY2024 is the year whose names it
  uses.
  - 32 match `name_as_published` exactly. That includes "Windsor Central
    UUSD", which AOE files under code U076. U076 is `ud/mountain-views`
    today, so Mountain Views gets 0.01 with no special case.
  - 7 differ only by abbreviation. A checked-in alias list covers them:
    - Granville-Hancock USD → Granville-Hancock Unified District
    - Essex-Westford EC USD → Essex-Westford ECUUSD
    - Quarry Valley USD → Quarry Valley UUSD
    - Barre USD → Barre UUSD
    - Harwood USD → Harwood UUSD
    - Montpelier-Roxbury USD → Montpelier Roxbury School District
    - Mount Ascutney USD → Mount Ascutney School District
- Every non-SU district in the picker (122) is in AOE's FY2024 district list
  under the same slug. So the "not listed → 0" rule applies to all of them.

## Approaches

- **A. Import to a warehouse record, then build.** An `act84:import` CLI
  parses the worksheet into `warehouse/aoe-act84/fy2025.yaml`, one row per
  district with its source line. `build-data` reads that record. **Picked:**
  it follows the existing intake → import → warehouse → build path, and it
  leaves a reviewable record.
- **B. Parse the `.txt` inside `build-data`.** Fewer files, but every build
  then depends on a layout parser, and no record is left to review.
- **C. Hand-type the 39 rows into YAML.** The simplest, but typed numbers can
  carry typos that only a cross-check test would catch.

## Design

1. **Parser** (`tools/src/aoe/act84/parse.ts`, tested). Reads the `.txt`
   rows into `{ line, su, name, county, pre_act127_ltw_adm, fy2025_decrease }`.
   It checks that the rows' pre-Act 127 ADM adds up to the Total line
   (43,781.32), so a missed or garbled row fails the import.
2. **Resolver** (same module, tested). Maps each row name, through the alias
   list, to a district row in the FY2024 EdSpend record, giving `entity` and
   `aoe_org_id`. A name with no match, or with more than one, fails the
   import. Nothing is ever skipped.
3. **Import CLI** (`tools/src/cli/act84-import.ts`, `npm run act84:import`,
   with `--check`). Verifies the PDF hash, then writes
   `warehouse/aoe-act84/fy2025.yaml`: the source, the rule that unlisted
   districts are 0, and the 39 rows.
4. **Build** (`build-data.ts`, using a tested pure helper). Adds
   `act84: Record<slug, { value: number; listed_as: string | null }>` to
   `resolved-adm.json` for every picker slug in AOE's FY2024 district list:
   - a listed district gets its worksheet value and `listed_as`
   - any other district gets `{ value: 0, listed_as: null }`
   - supervisory unions get no entry
5. **Form** (`adm-prefill.ts` `act84Fill`, tested; wired in `model-tool.ts`).
   On a `fill` plan, unless the reader edited the field:
   - listed → the value, with the note "from the state AOE worksheet (listed
     as Harwood USD)"
   - 0 → the value 0, with the note "not on the state AOE worksheet, so 0"
   - no entry → a blank field, with the note "no AOE figure for this pick;
     field left blank"
   - a parameter set without `phase_out_share` → a blank field, with the
     note "does not apply in FY20xx"

   `act84-decrease` joins the user-edited guard. The note goes in a
   `<small class="adm-source" data-act84-source>` under the field, like the
   spending note.

## Calls made without asking

- Mountain Views takes Windsor Central UUSD's 0.01, because AOE uses the same
  code (U076) for both names. `docs/act-127-transition.md` had listed it as
  "not on the worksheet". That doc's line is updated to match.
- FY2024 names, not FY2025, are the join. FY2024 is the worksheet's own year.
- Exact note wording is the builder's, within the reading-level rule.
