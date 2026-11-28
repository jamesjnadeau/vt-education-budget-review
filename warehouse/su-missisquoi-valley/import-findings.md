> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/missisquoi-valley (Missisquoi Valley School District, AOE SU021) — findings

Retrieved 2026-11-28.

## Sites
- Current: https://www.mvsdschools.org/ (Budget Information: `.../index.jsp?uREC_ID=3916577&type=d&pREC_ID=2531584`; Meeting Agendas & Minutes: `...&pREC_ID=2480823`).
- Registry URL http://www.fnwsu.org/ is stale (no response). `collectors/config.yaml` staged with the new sources.
- One budget-setting district (MVSD; Franklin, Highgate, Swanton). Registry count of 1 confirmed, so warehouse records are allowed.

## Documents found
| FY | Document | URL | Size | Staged |
|---|---|---|---|---|
| 2027 | Revenue & tax-rate summary (JPEG, revote version) | https://stories.opengov.com/mvsdschools/uploads/735866f921ba-FY27_MVSD_Revenue_and_Tax_Rate_Page_REVOTE_1.jpg | 1.45 MB | yes |
| 2027 | Official revote result 4/14/2026 (PDF) | drive id 1-VwEZqjUiMfOXkWK_pR-h394BJB6delD | 56 KB | yes |
| 2027 | Revote warning (scan, 3/18/2026) | drive id 1LlAf-AHyCo58eXcD_JqNfLZECXkxkQCy | 74 KB | yes |
| 2027 | March 3 annual meeting warning (scan, 1/27/2026) | drive id 15u7Z9k8j5510glQ7mwLfwHUG6hYC2qtW | 191 KB | yes |
| 2027 | OpenGov story "FY2027 MVSD Budget" (line-item function table, FY25 budget / FY26 budget / FY26 anticipated / FY27 budget; operating total $52,153,854) | stories.opengov.com/mvsdschools/67655dad-e683-46b9-a398-0230c7df3f18/published/em61MFO05 | web page, no file | no (HTML, not a downloadable original; read via web_extract) |
| 2027 | March (first-vote) summary image | https://3.files.edl.io/0ba1/26/02/03/193256-5437ff5e-5b77-4b17-857b-67ba6a1fb74c.png | 46 KB | no (small screenshot of the budget heading; not read for figures) |
| 2026 | FY26 passed news (782 Y / 674 N) | https://www.mvsdschools.org/apps/news/article/2042103 | web page | cited only |

No annual report, no AOE "Three Prior Years Comparisons" form and no FY27 budget book PDF was found on the district site or by search. Board agendas/minutes (Drive/Docs) and the Feb 17 / Apr 7 informational-meeting agendas (1-page agendas, no figures) were not mined for budget material. The Apr 7 revote presentation exists only as a video (transcript read) — slides not located.

## Headline FY27 (revote version, approved) — from the staged JPEG
- Operating budget $52,153,854; projected revenues $12,855,806; education spending $39,298,048 (re-added, matches).
- LTWADM 3,228.17; $12,173 per pupil (0.1% below FY26's $12,190); equalized rate $1.2988.
- Projected homestead rates after CLA: Franklin $1.5451 (CLA 84.06%), Highgate $1.3615 (95.39%), Swanton $1.4575 (89.11%).
- FY26 column: $50,956,879 budget; revenue $11,273,834; education spending $39,683,045; LTWADM 3,255.49; rate $1.4181.
- Vote: first budget $52,440,854 (per pupil $12,351) defeated March 3, 2026 (district page). Revote April 14, 2026 approved 601–374 (certified result PDF staged; WCAX corroborates).

## Records staged
- `warehouse/su-missisquoi-valley/fy2027-approved.yaml` (adopted_date 2026-04-14, from the certified result)
- `warehouse/su-missisquoi-valley/fy2026-approved.yaml` (FY26 column of the same image; adopted_date null)

## Discrepancies / flags
- The summary image is the district's own estimate, not the AOE form: "Statewide Adjustment ... FY27 TBD" in the yield label while formulas use 70.33%; footer says rates are estimates pending legislative action.
- March-version education spending is not on any document read. AOE's 3/17/2026 memo lists $39,870,048 for MVSD (= $39,298,048 + $572,000, the cut the district states). No record written for the defeated version.
- The FY26 per-pupil printed $12,190 vs recomputed $12,189.58 (rounding). FY26 Franklin rate recomputes to 1.5731 vs 1.5730 printed.
- ADM bands null (single LTWADM total printed).
- The two warnings are scans (image only); read visually.

## needs_decision
- Whether a JPEG summary (not a PDF/AOE form) is an acceptable source for warehouse records. If not, delete the two records and keep intake.

## Ask the district for
- The FY27 annual report / AOE Three Prior Years Comparisons form (and FY26's), or the AOE "Education Spending" form for the revote budget.
- The March 3 first-vote summary and result (education spending for the $52,440,854 version).
