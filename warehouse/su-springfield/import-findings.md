> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/springfield (Springfield Supervisory District, AOE SU056) — FINDINGS

## Sites
- District site: https://www.ssdvt.org (Springfield School District 56, Edlio). Registry URL http://www.ssdvt.org redirects to https and returns 200: **not stale**, but it is the home page only; collector config replaced with the Annual Reports and FY27 Budget Information pages.
- Annual Reports page: https://www.ssdvt.org/apps/pages/index.jsp?uREC_ID=1549987&type=d&pREC_ID=1676375
- FY27 Budget page: https://www.ssdvt.org/apps/pages/index.jsp?uREC_ID=1549987&type=d&pREC_ID=2717083
- One budget-setting district (Springfield Town School District; AOE form lists District = SU = Springfield, 100% of pupils). Warehouse records allowed.

## Documents found
| FY | Document | Direct URL | Size | Staged |
|---|---|---|---|---|
| 2027 | SSD FY 2027 Budget Book (`SSDFY2027BudgetBook.pdf`) | https://4.files.edl.io/1eb7/02/12/26/213949-3086f204-810c-480d-b2a5-378e3b6ab473.pdf | 9,695,813 | yes |
| 2027 | Annual Town Meeting warning, Mar 3 2026 (scanned) | https://4.files.edl.io/584c/03/02/26/232646-07119148-fa48-4eff-ac7c-917cd304c92d.pdf | 241,824 | yes |
| 2027 | Board letter 4-21-26 (revote) | https://4.files.edl.io/373b/04/21/26/212531-30650297-dbb5-4b68-a729-8f9013768374.pdf | 70,236 | yes |
| 2027 | "Budget Version 3" (revote budget; page lists it as "Budget Version 2") `BudgetVersion3.pdf` | https://4.files.edl.io/ebb6/04/17/26/123037-9cdd83e7-f160-4ee1-a7da-8a6fae28dd9a.pdf | 15,869,185 | **no**: just over the 15 MB extra-document limit; read in a scratch copy, then deleted |
| 2027 | Revote Trifold `RevoteTrifold.pdf` | https://4.files.edl.io/42d2/04/21/26/205815-ca8044df-dcaa-4a2b-ba89-d1d9a803aceb.pdf | 15,364,863 | no: over 15 MB; not read |
| 2027 | FY27 Proposed V1 / Draft V2 / Adopted V2.3, FAQ, flyer, Oct 2025 context + PPTX | listed on the FY27 Budget page | not checked | no; not read |
| 2018-2025 | School reports (FY24, FY25 etc.) | Annual Reports page | not checked | no; not read |

## Staged
- `intake/su-springfield/fy2027/`: Budget Book, warning, board letter + provenance.yaml (all byte-for-byte, server filenames).
- `warehouse/su-springfield/`: fy2027-warned, fy2026-approved, fy2025-approved, fy2024-approved (all from the Budget Book AOE form, PDF p. 24, printed p. 46).
- `collectors/config.yaml` (new source URLs).

## Headline FY27 figures (March 2026 version, Budget Book AOE form, PDF p. 24; stamped PRELIMINARY / ESTIMATES ONLY)
- Budget $42,654,251; offsetting revenues $10,290,460; **education spending $32,363,791**; LTWADM 2,130.75; per pupil $15,188.92 (up 9.26% per the warning); equalized homestead rate $1.6488; town rate $1.7200 (CLA/adjuster 95.86%); property yield $9,212. Re-added: 42,654,251 − 10,290,460 = 32,363,791; 32,363,791 / 2,130.75 = 15,188.9.
- Prior columns: FY26 budget $41,836,271, ed spending $31,380,696 (2,257.40 LTWADM, $13,901.26); FY25 $40,479,702 / $30,332,069 (2,266.10, $13,385.14); FY24 $36,575,247 / $27,218,747 (1,247.09 equalized pupils, $21,825.81).
- Warning Article 13 (local article): $41,458,651 (excludes the $1,195,600 RVTC obligation listed separately in the book).

## Vote results (newspapers; not the district's own site)
- Mar 3, 2026: **rejected** 741-599 (WCAX https://www.wcax.com/2026/03/04/vermonts-larger-communities-approve-school-budgets/; Vermont Journal Mar 11 2026 also "Did not pass"). The board letter confirms the town voted no.
- May 5, 2026 revote: **passed** 544-468 (WCAX https://www.wcax.com/2026/05/06/springfield-passes-school-budget/). AOE memo of Apr 29 2026 lists Springfield revote May 6.
- Other search hits (mynbc5 "fails for second time", Vermont Journal "496-403") describe the **2025** FY26 revotes, not FY27. Ignored.
- Town/district results page not checked on springfieldvt.gov.

## Revote (passed) budget: no record written
- From the scratch read of Budget Version 3 (browser-printed workbook, no AOE form): total expenditures $42,859,085; revenue $42,859,085; education spending $31,978,625 (= 31,978,625 / 2,130.75 = $15,008, matching the board letter); equalized rate $1.6358; actual homestead rate $1.7064. The board letter's arithmetic ($42,654,251 + $207,861 = $42,862,112) differs from V3's $42,859,085 by $3,027. Unresolved.
- The passed version is the budget that took effect, but I could not stage a document with the AOE form for it (V3 is 0.87 MB over the extra-doc cap and is not the AOE form). **Needs human decision:** stage V3 anyway and add fy2027-approved from it, or ask the district for the AOE form of the revote version.

## Discrepancies (also in lines_flagged)
- FY24 form budget $36,575,247 vs the book's expenditure summary "voted articles" $40,586,993 (PDF p. 18).
- FY25 education spending: form $30,332,069 vs revenue page $30,364,573 (PDF p. 23).
- FY24 pupils 1,247.09 (equalized) vs FY25 2,266.10 (LTWADM): not comparable; FY24 per pupil $21,825.81.
- Warning Article 13 $41,458,651 vs form budget $42,654,251 (RVTC $1,195,600).
- The book's own text says "adopted a budget" (board adoption) though voters later rejected it.

## Not done / not read
- ADM grade bands: none printed; all four left null. Enrollment pages (PDF pp. 12-13) not read for bands.
- Read: the AOE form (PDF p. 24), expenditure/revenue summaries (pp. 18, 22, 23). Not read: the "How education funding works" page (searched by keyword only), the audit (pp. 24-28 of the book) and the narrative pages.
- Warning pages 1 and 3 read from renders; the other warning articles were only skimmed.

## Ask the district for
- The AOE Three Prior Years form for the revote (passed) FY27 budget, and the certified March 3 and May 5 results.
