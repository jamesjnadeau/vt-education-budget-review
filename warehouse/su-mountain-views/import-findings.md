> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/mountain-views (SU051) - findings (retrieved 2026-11-28)

## Sites
- Current: https://mtnviews.org/ (Budget page: https://mtnviews.org/budget-annual-meetings; annual reports: /district-annual-reports).
- Registry URL http://www.wcsu.net/ is STALE (301 -> https://mtnviews.org/). Staged `collectors/config.yaml` replaces it.

## Structure (needs_decision)
- Registry lists 1 member district (Mountain Views SD, ud/mountain-views, 7 towns: Barnard, Bridgewater, Killington, Plymouth, Pomfret, Reading, Woodstock).
- The SU's own site/press release says 8 member towns: the 8th is Pittsfield, which has its own Pittsfield School District / board (https://mtnviews.org/pittsfield-school-board) and sets its own budget (FY26 total $965,270 per its town report, http://www.pittsfieldvt.com/uploads/2/7/3/2/27322481/town_report_fy24.pdf; FY27 not found, not read in detail).
- => 2 budget-setting districts, so NO warehouse records written per brief. Registry should be checked for a Pittsfield school district entity (none found in ud.json by name search; town/pittsfield exists).
- The AOE form and the budget in intake are for MVSD (U076) only, not the SU as a whole.

## Documents
| FY | Doc | URL | Size | Staged |
|---|---|---|---|---|
| 2027 | MVSD FY27 EdSpend prior years AOE 011526.pdf (AOE Three Prior Years form, PRELIMINARY / ESTIMATES ONLY, FY24-FY27) | drive uc?id=1FUl5sEHSUjeVhlDujMenYhPs8nLPjEyN | 500,660 | yes |
| 2027 | MVSD FY27 Budget summary worksheet  011626.pdf (5 pp, by school) | drive uc?id=1v-2fuv5iMjrWbdzVA_R0m6o_4nf7useU | 255,571 | yes |
| 2027 | Warning for print.pdf (Mar 3, 2026 annual meeting warning) | https://mtnviews.org/s/Warning-for-print.pdf | 167,193 | yes |
| 2027 | MVSD FY27 Budget worksheet - Detailed 011626.pdf (47 pp) | drive id=1SBAgWA18gZCRuwRupClJJkcC85uDISdS | 1,202,359 | downloaded to scratch, NOT staged (one good doc + summary is enough; available if wanted) |
| 2027 | Tax Rate Presentation FY26 v FY27, FY27 Budget Revenues, By Object code, Function code summary | drive ids 18vCzv51..., 16CH4xG..., 1JXS4GV..., 1UriFXu... | 95-118 KB each | not staged, not read |
| 2027 | Official ballot results (Google Doc, not PDF) | https://docs.google.com/document/d/18QUbs_2ALONy6k1C9BixM-JYjuJ7gVwe/ | - | not stageable as original; figures below |
| 2026/2025 | MVSU Annual Reports | https://mtnviews.org/s/MVSU-2025-Annual-Report.pdf (10.1 MB), MVSU-2024-Annual-Report.pdf (206 KB) | - | not staged (prior-year, not read) |
No FY27 annual report with the AOE form was found; the AOE form was only published as a separate Drive file.

## MVSD FY27 headline figures (AOE form, 1 page, MVSD U076 only)
- Warned budget (line 1/6): $32,469,506 (FY26 $27,576,954; FY25 $29,756,674; FY24 $25,955,371).
- Offsetting revenues (line 10): $3,730,980. Education spending (line 11): $28,738,526 (= 32,469,506 - 3,730,980, re-added OK).
- Pupils (line 12): 1,486.80 (FY27 LTWADM; FY26 1,465.41; FY25 1,520.47; FY24 918.04 equalized, not comparable).
- Education spending per pupil (line 13): $19,329.11 (re-added OK: 28,738,526 / 1,486.80). Equalized homestead rate $2.1843, $2.1763 after cent discount, same for all 7 towns (CLAs not on this form). Property yield $8,849.
- Vote (official results Google Doc dated Mar 4, 2026, signed attestation by MVSD clerk): Article 1 budget YES 1,471 / NO 742 (passed). By town yes/no: Barnard 232/94, Bridgewater 107/81, Killington 131/185 (failed locally), Plymouth 78/60, Pomfret 279/72, Reading 171/70, Woodstock 473/180. Bonds: wastewater 2,117/576, boilers 2,129/518, new school 1,648/1,047. Read from the Google Doc text export; the original is not a PDF so not staged.

## Discrepancies (record, do not reconcile)
- Warning Art. 1 says LTW per-pupil education spending $18,075.87; AOE form line 13 says $19,329.11. Press release (https://mtnviews.org/press-releases/post/2025/12/16/mvsu-approves-fy27-325m-budget-increasing-just-55-despite-high-healthcare-wage-and-tariff-driven-supplies-costs) gives net education spending $26,875,206 and raw $18,101.56 / $19,083.17 per pupil; the form says $28,738,526 and $19,329.11. $26,875,206 / 1,486.80 = $18,076, so warning and press release use a figure ~$1.86M lower than the form (form revenues $3,730,980 vs implied $5,594,300). Unexplained.
- Press release prints the budget as $32,496,506 and $32.5M; warning and form print $32,469,506 (digit transposition in the press release).
- Form line 14 prints "$686.57" under FY26 and "$964,976.00" under FY27 in the per-pupil construction row (apparent per-pupil vs total mismatch).
- Summary worksheet p. 4 total FY27 requested is $28,886,832 (plus $1,350,873 food service on p. 5) vs $32,469,506 on the form. Not reconciled.
- FY27 vs FY26 total on the form (FY26 $27,576,954) differs from the worksheet FY26 budget total ($27,672,261.38).
- Form is stamped PRELIMINARY / ESTIMATES ONLY; yields based on Dec 1, 2025 forecast.

## Not done / not read
- Detailed worksheet (47 pp), revenue, tax-rate presentation, function-code summary, principal reports, 2024/2025 annual reports were not read or staged.
- Pittsfield School District FY27 budget not found (VT Pittsfield, not NH).
- No warehouse records (2 budget-setting districts). Ask the district for: Pittsfield School District's FY27 budget, and a final (non-PRELIMINARY) AOE form once state yields are set.
