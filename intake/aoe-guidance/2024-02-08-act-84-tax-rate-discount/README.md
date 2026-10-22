# AOE worksheet: FY2025–FY2029 Act 127 tax rate discount by district

The Agency of Education's one-page schedule of each district's homestead tax rate decrease under
the Act 127 transition. Nicole Lee of AOE School Finance filed it with House Ways and Means on
**February 8, 2024**, as testimony on H.850, the bill that became Act 84 of 2024.

Read alongside [docs/act-127-transition.md](../../../docs/act-127-transition.md), which sets out
the rule from the session law and how the engine applies it.

**This is evidence for inputs, never for the rule.** The rule comes from 2024 Acts No. 84, Sec. 3,
as amended by 2024 Acts No. 183, Secs. 16–17, snapshotted under
[`model/statute/2026-10-22/`](../../../model/statute/2026-10-22/). What this worksheet supplies is
the one number per district that the law leaves to the Secretary's calculation: the **FY2025
decrease**, in its "FY2025 Tax Rate Discount" column. It is the only published per-district list
of that figure found so far. Golden fixtures cite it row by row as
`act84_transition.fy2025_rate_decrease`.

**Do not use its FY2026–FY2029 columns.** They are 80, 60, 40 and 20 percent of the FY2025 figure,
rounded to cents. They predate Act 183, Sec. 16, which from July 1, 2025 divides the decrease by
the statewide adjustment. The Tax Department's FY2026 rates do not match them.

## What is here

| File | What it is |
|---|---|
| `W~Nicole Lee~Y25 to FY29 Act 127 Tax Rate Discount by District~2-8-2024.pdf` | The worksheet exactly as posted. 1 page, 626,716 bytes, `sha256:2a13e7305f5ac5eb9e13eddee8e49571a701d8453243304af8bc710515844018`. |
| `W~Nicole Lee~Y25 to FY29 Act 127 Tax Rate Discount by District~2-8-2024.txt` | Text extraction, so the rows are greppable without an LFS fetch. 14,527 bytes, `sha256:9f2e6fc4fe8b78cc49548d7e74cd1a2a10d747e8162cdafa37072214f11c9e5b`. Produced by `pdftotext -layout` (poppler 25.03.0). Not authority; the PDF is. |

The PDF's own metadata:

| | |
|---|---|
| Title | FY25 to FY29 Act 127 Tax Rate Discount by District V03.xlsx |
| Author | Lee, Nicole |
| Producer | Microsoft: Print To PDF |
| Created | 2024-02-08 15:50:29 EST |
| Modified | 2024-02-08 15:50:29 EST |

"V03" in the title shows it is a third version of the spreadsheet. The committee page also holds
an earlier worksheet dated 2-6-2024. If a figure ever needs checking against that one, file it
beside this one with its own hash rather than in place of it.

## What the worksheet itself says

These notes are printed on the worksheet. They describe AOE's method; they are not law.

- The FY2025 discount is the percent change in the district's share of statewide weighted pupils,
  pre-Act 127 versus Act 127, converted at one cent per percent and rounded to the nearest cent.
- Unorganized towns and gores are not eligible, and 16 V.S.A. § 4031 sets their equalized
  homestead rate at one.
- A district's rate after the discount cannot fall below $1.00.
- It lists only districts eligible for a discount. A district not on it is taken to have a
  decrease of 0, and every fixture that relies on that says so in its `source`.

The figures are as of February 2024, before Act 84 passed and before Act 183 amended it. Districts
that merged or withdrew afterwards are not listed under their new names. Act 183, Sec. 17 (Act 84,
Sec. 3(g)) governs what they receive.

## Where it came from

`provenance.yaml` records it: fetched on **2026-10-22** with `npm run vt:fetch` from the House Ways
and Means H.850 testimony folder on `legislature.vermont.gov`. The URL is in the provenance file.

`npm run validate` re-verifies the SHA-256 on every pull request. A mismatch means the artifact
was edited, which is never permitted. Work out what changed the file rather than updating the hash.
