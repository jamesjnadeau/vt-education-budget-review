# AOE town-of-residence counts as the model prefill fallback

Status: draft, 2026-10-22. Approach A, chosen in conversation.

## Why

Picking an entity on `/model/` is meant to fill the eight grade-band ADM
fields (four bands × the two years of the average). It fills nothing today.
The district's budget record carries no band ADM, and the AOE fallback reads
the old `aoe-adm` publication, whose only year (FY2024) does not map to the
Act 127 bands. So every band resolves to `unknown`, and the form keeps its
illustrative defaults or goes blank.

The town-of-residence extract from AOE (request #851, imported as
`aoe-adm-subgroups`, SY24–SY26) has the four Act 127 bands per town. Added up
over an entity's towns, it can be the state's count for the entity, wherever
the towns' cells allow it.

## Goals

- Use the town-of-residence bands as the `aoe` source in `resolveAdm`, so the
  prefill has a state figure wherever the district's own budget gives none.
- Fill a band only with an **exact** sum: every contributing town cell is
  published, or the town has no resident students.
- When any contributing town cell is withheld, leave the band empty and say
  why, in the site's one label for withheld counts: "hidden to protect student
  privacy".
- Fill both slots of the two-year average, including an earlier year that has
  no budget record.

## Non-goals

- **No ranges in the form** (approach B). A band with a withheld town is not
  turned into "at least N" or "N to M". The engine could carry a range only
  with finite bounds, and pair members have no top.
- **No SU-grain file.** `ADM_Sums_by_SU_Across_Years.csv` (delivered
  2026-09-04, never imported) is not used. Checked against summed town
  cells:
  - SY24 (grouped by `SUID`) matches exactly.
  - SY25 and SY26 are grouped by `ADMINID`. 180 bands with every town
    published disagree, by more than one student in 134 of them.
  - In 22 bands the SU figure is smaller than its published towns alone.
  - So SY25 and SY26 do not count residents, and FY2026 needs SY25.
  - Where the two do count the same students (SY24), the SU figure minus the
    published towns gives back the withheld town value exactly. That breaks
    the privacy rule in the 2026-09-04 spec.
- No ELL or NSLELG prefill. The form has no fields for them.
- No change to which entities the picker lists (see Open question).

## Constraints

- **Privacy:** a withheld cell's bound is never used to fill, narrow or
  suggest a value. A sum is published only when it is exact, and an exact sum
  of published cells reveals nothing new.
- **Never present a partial sum as a total.** `sumBands` in
  `tools/src/adm-lookup.ts` skips nulls, so it produces a partial sum. It must
  not be reused for this.
- **Nothing derived is committed.** The sums are computed in
  `tools/src/cli/build-data.ts` and written to the gitignored
  `site/src/generated/resolved-adm.json`, as today.
- **District-first per band** stays as it is: a band the district's budget
  states always wins, and the AOE figure only fills a gap.

## Approaches considered

- **A. Exact town sums, empty band when any town is withheld.** Picked. It is
  honest, needs no new data and no engine change, and fills every band for
  the 66–71 districts (depending on the year) whose towns are all published.
  The cost is that small towns with withheld cells leave bands empty. For
  Addison Central that means preschool and grades 6–8, because of Ripton
  and Weybridge.
- **B. Carry withheld cells as ranges into the form.** Rejected. It needs
  finite bounds the pair members do not have, and a new range input in the
  form. It also shows "the state's count" as a span the reader can easily
  mistake for an estimate.
- **C. SU-grain counts first, town sums for the rest.** Rejected after
  checking the file (see Non-goals). It is the wrong population for SY25–SY26
  and enables subtraction for SY24.

## Design (decided)

### Which towns make up an entity

The mapping is by residence. Each case follows a relation the registry
already has:

| Picked entity | Towns summed |
|---|---|
| `su/*` | towns with `supervisory_union` = the SU, excluding `reporting_only` (the same set the SU page uses) |
| `ud/*` | the UD's `member_towns` |
| a town that runs its own school (district-like) | the town itself |

A town-year marked `not_applicable` (no resident students, or the entity
closed) contributes an exact 0. A town in the set with no row at all for the
year is an error at build time, not a silent zero. The publication already
derives `not_applicable` for every registry town absent from a year, so a
missing row means the registry and the publication disagree.

### Summing one band

- All contributing cells have a `value`: the band is that sum, rounded to 2
  decimal places like the rest of the ADM layer.
- Any cell is withheld (`primary`, `pair_member`, `reporting_floor`, or a
  whole row `below_reporting_floor`): the band is **withheld**. It carries no
  value, no bound and no count of hidden towns.
- No contributing towns at all: no AOE figure for that band (`unknown`, as
  today).

### Years

The publication's own `school_year` → `fiscal_year` map is used: SY24 →
FY2025, SY25 → FY2026, SY26 → FY2027. FY2027 is marked `preliminary` in the
publication.

### Resolution and sources

`resolveAdm` gains a fourth source, `withheld`, used when the district has no
figure and the AOE band is withheld. A district figure still wins over a
withheld AOE band. `ResolvedBand` gains an optional `preliminary: true` on
`aoe` bands from a preliminary year.

**Homestead comparison stays on district figures (decided by the user).** The
build today hands `resolvedAdmByEntity` both to `resolved-adm.json` and to
`buildHomesteadComparison`. After this change they are two maps:

- the prefill map (district first, then town sums), written to
  `resolved-adm.json`;
- a district-only map for the homestead comparison, with the same rows that
  comparison sees today.

That way no state-derived count reaches the published rate comparison, and
neither do the extra fiscal-year rows. A test asserts the homestead output is
unchanged by this build.

The old `aoeBandsFor` stops feeding `resolveAdm`. `adm.json` and its other
consumers are left alone.

### Rows written to resolved-adm.json

The entities stay as today: those with a budget record. For each one, rows
are written for the union of:

- the fiscal years its budget records cover, and
- the fiscal years the town publication covers.

So FY2026's earlier slot (FY2025) has a row even with no FY2025 budget. Every
row's year then appears in the year picker, which already lists the row keys.

### What the form shows

Each field's source note:

| Source | Note |
|---|---|
| `district` | from the district’s budget (unchanged) |
| `aoe` | from the state AOE count |
| `aoe`, preliminary | from the state AOE count (preliminary) |
| `withheld` | hidden to protect student privacy; field left blank |
| `unknown` | not available (unchanged) |

A field the user has typed in is never touched (unchanged).

### Keeping the two year controls in step (my call)

The prefill fills its slots from the "Budget year" picker (`load-year`). The
slot labels and the engine's `adm_years`, though, come from the mode
selector, which defaults to the newest parameter year. The two can disagree:
picking FY2026 while the mode stays FY2027 would put FY2025 and FY2026 counts
under fields labelled FY2026 and FY2027.

So when a year is picked in the prefill and a parameter set for that fiscal
year exists, the mode selector moves to it before the fields are filled. When
no parameter set exists for that year, the prefill does nothing and says so,
rather than fill fields labelled with other years. A test covers both cases.

### Worked example (expected test values)

Addison Central, FY2026, no district figures:

| Band | Slot 1, FY2025 (SY24) | Slot 2, FY2026 (SY25) |
|---|---|---|
| Preschool | withheld (Ripton) | withheld (Ripton) |
| K–5 | 708 | 677.27* |
| 6–8 | withheld (Ripton) | withheld (Ripton) |
| 9–12 | 451.31 | 482.63 |

\* Take the exact figures for the fixture from the warehouse sums at build
time; the table rounds them.

## Follow-up with AOE (not part of this build)

Ask AOE for **district-of-residence band counts** (by UD or town school
district, grouped on `ADMTDIST` → district, not `ADMINID`). The point is that
counts suppressed at the larger grain would leave fewer bands empty. The ask
also needs to say:

- **Suppress the two files jointly.** The suppression should account for the
  town file already delivered, so that subtracting one file from the other
  cannot recover a withheld town cell. Doing that is AOE's job and has to be
  in the request. A district file suppressed on its own would recreate the
  SY24 subtraction problem above.
- **Fix the SU grouping.** The SU-grain file's SY25/SY26 grouping (`ADMINID`)
  does not count residents, and the ask should say so.
- **No district total.** The district `adm_total` the #851 query asked for
  is dropped from this ask. Combined with exact bands it narrows or solves
  withheld bands, which the privacy rule forbids using. It should not be
  requested for this purpose.

## Left to the builder

- Where the band-sum function lives. Mirror the cell semantics of
  `site/src/lib/residents.ts` `sumCells`, with the exact-only rule.
- Whether to delete `aoeBandsFor` once nothing calls it.
- Test layout. At minimum:
  - the Addison Central example;
  - a `not_applicable` town counted as 0;
  - a `below_reporting_floor` row making every band withheld;
  - a district figure beating a withheld band;
  - a missing town-year failing the build;
  - the FY2025 earlier-slot row existing without an FY2025 budget.

## Open question

The picker lists only entities with a budget record, which today is
`su/addison-central` alone. With this source, every SU and district could be
prefilled.

Widening the picker is outside the fallback as requested, so this build keeps
the picker as it is. If it is widened later, one registry gap needs settling
first: `town/halifax` is a member of `ud/southern-valley` but has no
`supervisory_union`.
