> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/franklin-northeast (SU020) — FINDINGS

**Site:** https://www.fnesu.org/ (Apptegy). Registry `http://fnesu.net/` redirects 302 -> https://fnesu.org -> 301 -> https://www.fnesu.org/ (200). Not dead, but front page has no budget docs; collector config updated to the FY27 budget page.
**Budget page:** https://www.fnesu.org/o/fnesu/page/fy27budget (short link bit.ly/fy27budget). Annual report article: https://www.fnesu.org/article/2678802 (dated Feb 3, 2026).

## Structure (registry count of 2 is correct, plus the SU itself)
Two budget-setting districts, each with its own warned budget: Enosburgh-Richford UUSD (towns Enosburgh, Richford) and Northern Mountain Valley UUSD (Bakersfield, Berkshire, Montgomery, Sheldon). The SU central office also has its own assessed budget. => **No warehouse records written** (2+ districts); figures below under needs_decision.

## Documents found (all Google Drive, all downloaded OK, all FY2027)
| file | bytes | in intake |
|---|---|---|
| 2026 FNESU Annual Report (Web - Final 01.25.26).pdf (Canva, 20 pp, NO AOE form) | 49,698,878 | yes (single doc covering both districts; > 15 MB but best overview) |
| FY27 ER D1 Budget Overview.pdf | 108,917 | yes |
| FY27 ER J1 Warning.pdf | 76,355 | yes |
| FY27 NMV D1 Budget Overview.pdf | 119,749 | yes |
| FY27 NMV J1 Warning.pdf | 77,272 | yes |
| FNE FY27 K2 Budget Overview.pdf (SU central office) | 92,587 | yes |

Linked on the budget page but NOT downloaded (small, not needed): ER D2 What We Do, D3 What We Buy, F3 Per Pupil Comparison, B1 Enrollment, Capital Reserve Funds (ER, NMV), NMV D4 Budget Detail (8 pp, 191,841 B, line items; downloadable, id 1kF0IKUZR3o7heAuCYE1hR5GgG8cT7y90), NMV per-pupil comparison, Debt Service, FNESU enrollment / function / account sheets, YouTube meeting recordings. Also FY25 budget page /o/fnesu/page/fy25budget exists (not examined).
**No AOE "Three Prior Years Comparisons" form was found** in the annual report or in the pages examined; the budget book is Google-Sheets printouts. The "Projected Tax Rates" block on each D1 page is the district's own calculation, not the AOE form.

## needs_decision — FY2027 per-district figures (source: D1 pages and J1 warnings; PDF p.1 of each)
| | Enosburgh-Richford UUSD | Northern Mountain Valley UUSD |
|---|---|---|
| Total budget (warned, Art. 4) | $25,465,229 | $24,703,107 |
| Local+grant revenue | $6,231,427 | $108,400 |
| Prior-year fund balance used | $336,375 | $0 |
| Education spending (D1, not AOE form) | $18,897,427 | $24,594,707 |
| LTW ADM | 1653.28 | 2123.00 |
| Per pupil | $11,430 (+2.6% vs $11,139) | $11,585 (-1.1% vs $11,718) |
| Dollar yield / equalized rate | $8,849 / $1.2917 | $8,849 / $1.3092 |
| Town CLA -> homestead rate | Enosburgh 86.36% -> $1.4957; Richford 128.55% -> $1.0048 | Bakersfield 85.33% -> $1.5343; Berkshire 86.11% -> $1.5204; Montgomery 78.86% -> $1.6602; Sheldon 93.81% -> $1.3956 |
| FY26 budget / ed. spending / LTWADM | $25,204,787 / $18,300,146 / 1642.87 | $24,293,952 / $24,153,776 / 2061.22 |
| FY25 budget / ed. spending / LTWADM | $23,627,273 / $17,662,148 / 1722.59 | $22,430,013 / $22,204,655 / 2096.57 |
| Capital reserve article (Art. 5) | $336,375 | $18,181 |

SU central office FY27 general fund (K2): expenses $10,322,180; revenue $9,505,180 (assessments $4,793,947; state $4,686,233); plus food service fund $2,421,014 exp / $1,608,000 rev, bill-back $935,010, transportation fund $1,812,500. FY26 budget: $13,133,192 exp / $12,599,290 rev.

Decision for a human: how to represent a multi-district SU (two ud/ entities + the SU's own budget); whether FY25/FY26 columns (above, D1) should be recorded from D1 pages without an AOE form.

## Checks and discrepancies
- Arithmetic re-added: ER 25,465,229 - 6,231,427 - 336,375 = 18,897,427 ✓; /1653.28 = $11,430.26 ✓; NMV 24,703,107 - 108,400 = 24,594,707 ✓; /2123 = $11,584.88 ✓. Rates: 11,430/8,849 = 1.2917 ✓; homestead = rate/CLA reproduces all six printed town rates ✓. FY26 columns also reproduce.
- ER D1 rounding: FY25 actual revenue lines sum to $23,833,322 vs printed $23,833,323; support services lines sum to $11,530,828 vs printed $11,530,827 (both $1).
- ER D1 "General Fund Revenue Total" FY27 ($6,231,427) excludes state education-spending revenue (line 3110 = $0); FY26 total $24,559,172 includes $18,300,146 — columns not like-for-like.
- NMV D1 labels the rate "Equalized Residential School Tax Rate"; ER D1 says "Equalized Homestead Tax Rate" (terminology differs).
- Annual report p.16/17 say spending up 1.0% (ER) / 1.7% (NMV): recomputed 1.03% / 1.68% ✓.
- ER $336,375 equals the "use of prior-year fund balance" and the Art. 5 deposit amount (a coincidence of the document, not reconciled).
- Not AOE-stamped; no PRELIMINARY marking seen. Annual report says "Estimates are based on yield amounts proposed by the Tax Commissioner" (final yields set by the Legislature) — rates are estimates.

## Vote results (March 3, 2026)
- NMV: only the Montgomery town return found: Art. 4 YES 145, NO 42 (town only, 187 ballots) — https://montgomeryvt.us/wp-content/uploads/2026/03/Australian-Ballot-Official-Return-Of-Votes-Montgomery.-NMV-2026.pdf . District-wide NMV result: not found.
- ER: result not found. (Search hits for 425-276 / 259-217 are the FY26 March 2025 votes, not FY27.)

## Not read
Annual report pp. 2-15 and 19-20 skimmed via text only; charts on pp. 16-17 not read. D4 Budget Detail, per-pupil comparison, enrollment sheets, meeting videos, FY25/FY26 budget pages not read/downloaded.

## Ask the district for
The AOE "Three Prior Years Comparisons" forms (or confirm none are published) for each UUSD, and certified district-wide FY27 vote totals.
