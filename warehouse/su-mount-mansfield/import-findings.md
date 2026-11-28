> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# FINDINGS: su/mount-mansfield (Mount Mansfield Unified Union School District #401, AOE SU012)

**Site:** https://www.mmuusd.org/ (budget page: /school_board/budget_and_annual_report_info). Registry URL
`http://mmuusd.org/` returns 409 Conflict (no `www`); collector config replaced (`collectors/config.yaml`).
One budget-setting district (Bolton, Huntington, Jericho, Richmond, Underhill); warehouse record allowed.

## Documents found (all Google Drive links on the budget page)
| Item | FY | Size | Staged? |
|---|---|---|---|
| 2025-26 MMUUSD Annual Report (`Annual Report 25-26 Final Final.pdf`), id 1o3875c0xsbkoxfqqTSveWu3K4Rykzjnr | FY27 | 51,536,480 B | yes |
| Budget Vote Results (`Budget Vote Results.pdf`, letter 2026-03-04), id 1wMwVtKQc5r1Vpw5XSPj0YvRAi2kbIkij | FY27 | 619,835 B | yes |
| Official Warning (`Budget-Official-Warning (1).pdf`, 762 KB) id 16V0zgLOwwTSLmzye05QiCp9sGF63UMK2 | FY27 | | no; same warning is in the annual report |
| FY27 Budget Fact Sheet (`FY27_Budget_Fact_Sheet_Final.pdf`, 123 KB) id 156CLka5mAprxJYD7Hqr2wm4icncnd_xy | FY27 | | no |
| FY27 Proposed Budget Draft 2 (`FY27 Proposed Budget - Draft 2 - 12.8.25.pdf`, 566 KB, 3 pp) id 1q9LfUjgssiDCWIU3jMcElChgvzGF7jsP | FY27 | | no; superseded by the detail in the annual report |
| Budget flyer, presentation slides (Google Slides), FY26 Budget Archive page | | | not downloaded / not read |

## FY27 figures (annual report; PDF page = printed + 1)
- Total budget $64,963,496 (p. 43; warning Art. 4 same); +$3,673,449/5.99% over FY26 $61,290,047.
- Education spending: **no AOE form in the report**. District's own estimate $55,066,098 (p. 33 chart, p. 32 five-year chart),
  FY26 $50,496,414 (matches AOE FY26 cash-flow report). Record leaves education_spending null (flagged).
  Implied offsetting revenue $9,897,398 (computed, not printed).
- Pupils: estimated equalized pupils 3,491.64 (FY26 3,515.00); fact sheet says LTW ADM 3,490. Per pupil $15,771 (+9.78%; warning says 9.79%).
- Estimated equalized homestead rate $1.6713 (FY26 $1.5268). Town rates: Bolton 1.4622, Huntington 1.0815, Jericho 2.1218,
  Richmond 1.3779, Underhill 1.5588 (CLAs p. 34). Jericho CLA pending reappraisal (July).
- Vote: approved 2,251-1,290 (64%) per the district's letter of 2026-03-04 (not a certified result).

## Discrepancies (also in record lines_flagged)
- FY25/FY26 totals: $2/$1 differences between the p. 32 chart and p. 43 detail; fact sheet FY22-FY27 district rates ($1.6716 FY27)
  differ in the 4th decimal from the report's $1.6713; fact sheet town CLAs/rates differ from the report's.

## Staged
intake/su-mount-mansfield/fy2027/{Annual Report 25-26 Final Final.pdf, Budget Vote Results.pdf, provenance.yaml};
warehouse/su-mount-mansfield/fy2027-warned.yaml; collectors/config.yaml.

## needs_decision
- Should FY27 be recorded as `approved` (vote letter) rather than `warned`? Left `warned`, adopted_date null.
- Education spending left null: AOE's FY27 figure not in any document read. Ask the district for the AOE
  'Three Prior Years Comparisons' form, or take it from AOE's FY27 certified data.
- No FY26/FY25 records written (no AOE form/prior-year columns; chart only).

## Not read
Annual report pp. 3-31 school narratives (only skimmed text layer for finance terms), p. 35-37 charts, minutes (pp. 47-50),
fact sheet beyond text, FY26 archive page, flyer, slides.
