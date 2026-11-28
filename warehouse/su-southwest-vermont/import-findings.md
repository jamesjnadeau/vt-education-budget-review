> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/southwest-vermont (AOE SU005) — findings, retrieved 2026-11-28

## Sites
- Current: https://www.svsu.org/ (Edlio). FY27 page: https://www.svsu.org/apps/pages/index.jsp?uREC_ID=1572175&type=d&pREC_ID=2641005
- Registry/collector URL http://www.svsu.org/education/district/district.php?sectionid=1 is stale (301 to https, then 403). `collectors/config.yaml` staged with the new source.

## Structure (why there is no warehouse record)
The SU has FIVE budget-setting member districts, not 2 as in the registry: Arlington SD, Mount Anthony UHSD #14 (MAU),
North Bennington Graded SD (NBGSD), Sandgate SD, Southwest Vermont Union Elementary SD (SVUESD), plus the SU shared-services
budget (SVSU). Per the brief: NO warehouse records. Southwest Vermont Regional Technical School District is also on the ballots; its budget was not found.

## Documents (all FY27, all downloadable, all Excel-printed PDFs with text layers, none > 1.7 MB) — staged in intake/su-southwest-vermont/fy2027/
| File | Bytes | Direct URL (4.files.edl.io/...) |
|---|---|---|
| _FY27SVSUAdoptedBudget.pdf | 1,521,058 | 21df/01/30/26/160052-2b456dc9-6364-47d5-ba8f-2d82fb38e7b0.pdf |
| FY27NBGSDAdoptedBudget.pdf | 1,426,087 | 5e5f/01/30/26/160051-b0e4a016-276b-4270-9712-df1c53378b64.pdf |
| FY27MAUAdoptedBudget.pdf | 1,385,787 | f413/01/30/26/160051-3d5bc689-b407-44ab-ae3a-71f07b120c37.pdf |
| FY27ArlingtonAdoptedBudget.pdf | 1,293,797 | 925e/01/30/26/160051-ab334584-2ea5-4553-9b5f-44d53b6b855a.pdf |
| FY27SandgateAdoptedBudget.pdf | 1,271,406 | cec3/01/30/26/160051-78f814a0-3f5a-42e4-9997-906b7b3a20cb.pdf |
| FY27SVUESDAdoptedBudget.pdf (first vote, March) | 1,674,016 | 2727/01/30/26/160052-b4877c93-e15c-4f4a-9b36-f173d4cc4362.pdf |
| FY27SVUESDAdoptedBudgetv220260317.pdf (April revote) | 1,605,710 | d844/04/01/26/162403-e87c3bae-b155-43ee-a863-9e49faf38c21.pdf |
| SVSUFY27LTWADMPreliminaryv152-yrADM.pdf (LTW ADM worksheet) | 358,682 | c199/01/30/26/155907-835898eb-c8cf-4990-b330-7a125755a3da.pdf |

The two SVUESD files are different versions of one district's budget; the ADM worksheet is a small (<15 MB) supporting file.
Filenames are those the server sent (Content-Disposition). Not staged (on the same page, read only for the notes below, not saved): the four "Budget at a
Glance" one-pagers (MAU, Arlington, SVUESD vote 1, SVUESD revote ballot-language explainer), CLA/tax-rate letters, Act PDFs, enrollment projections, SVUESD ballot-language explainer.
Not read in full: every PDF was text-extracted and the totals/tax-rate sections read; line-item pages were not audited. No AOE "Three Prior Years Comparisons" form is in any file; no annual report / town report was found or sought. Pre-FY27 years were not checked.

## needs_decision (per-district FY27 figures, as printed; these are district-prepared ESTIMATES on AOE FY27 Prelim v15 of 12/31/2025, not the AOE form)
| District | Expenditures | Education spending | LTW ADM | Ed spend / LTW ADM | Source pages (PDF) |
|---|---|---|---|---|---|
| Arlington | $10,046,574 (FY26 $9,803,830, +2.48%) | $9,061,212 (offsetting rev. $985,362) | 598.97 | $15,127.99 | p. 5 (also Total Revenues $10,046,574, p. 4) |
| MAU #14 | $37,086,761 (FY26 $35,672,429, +4.0%) | $34,920,208 (local revenue $2,166,553) | 2,849.38 | $12,255 | p. 5 (town LTW ADM table: 5,306.37 total, elementary + secondary) |
| NBGSD | $3,222,388 (FY26 $3,244,181, -0.67%) | $2,808,347 (local revenue $414,041) | 236.12 | $11,894 | p. 5 |
| Sandgate | $1,382,235 (FY26 $1,325,555, +4.28%) | $1,329,263 (offsetting rev. $52,972) | 137.19 | $9,689 | p. 4 |
| SVUESD, first vote (March) | $33,499,825 (FY26 $33,128,598, +1.1%) | $31,204,892 (local revenue $2,294,933) | 2,220.87 | $14,051 | p. 5 |
| SVUESD, revote (April 14) | $33,128,598 (0.0%) | $30,833,665 (local revenue $2,294,933) | 2,220.87 | $13,884 | p. 5 |
| SVSU shared services | $38,079,870 (FY26 $37,153,157, +2.5%) | n/a (no AOE form; assessed to members) | n/a | n/a | p. 1 (Grand Total also pp. 5, 11) |

Arlington and Sandgate print FY24-FY26 comparison columns (Arlington education spending FY26 $8,527,491, FY25 $7,860,658, FY24 $7,226,961; Sandgate FY26 $1,245,463, FY25 $1,511,603, FY24 $1,300,340; "recalculated" labels) — not transcribed to records.
Decision for a human: whether to record these as per-district warehouse entities (ud/school entities) rather than su/southwest-vermont; and whether the estimated education-spending figures are acceptable stand-ins for the AOE form.

## Votes (Town Meeting Day March 2026 — district post, undated on the page; counts consistent with Banner report below)
- https://www.svsu.org/apps/news/article/2174892?categoryId=14734 : Arlington budget Yes 224 / No 167; MAU budget Yes 1,197 / No 1,048; SVUESD budget Yes 1,002 / No 1,020 (defeated); NBGSD budget Yes 165 / No 30; Sandgate budget passed by unanimous voice vote at town meeting.
- SVUESD revote April 14, 2026 at $33,128,598 (0% increase) passed per Bennington Banner, 2026-11-17: https://www.benningtonbanner.com/local-news/elementary-district-looks-to-boost-achievement-but-also-contain-costs/5678271 (no vote count found). Revote date from the district's ballot explainer.
- The first SVUESD file therefore was a defeated proposal, not an adopted budget; "Adopted" in the filenames means board-adopted for the warning.

## Discrepancies / flags
- SVUESD file labelled "Adopted Budget_VOTE1" on the web page, "Adopted" in file name; revote file title says v2 dated 2026 03 17 but PDF created 2026-03-25.
- District budget PDFs state education spending of $34,920,208 for MAU on the SVUESD sheets too (MAU column), consistent across files.
- SVSU FY26 total here is $37,153,157; the Bennington Banner (Dec 2024) reported $37,153,179 for the FY26 SVSU budget ($22 difference); not reconciled.
- Tax-rate calculations in all district PDFs are labelled ESTIMATES (prelim v15, yield $8,849, statewide adjustment 70.33%). Town CLA/rates appear on the Budget at a Glance sheets (e.g. Bennington CLA 59.18%, adjusted 84.15%, est. rate $1.7513) — those PDFs not staged.

## Ask the district
- AOE education-spending (Three Prior Years Comparisons) forms or the town/annual report with them for FY27 and prior years; prior-year budget books; SW Vermont Regional Technical School District FY27 budget.
