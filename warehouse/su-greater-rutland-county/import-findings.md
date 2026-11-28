> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# FINDINGS: su/greater-rutland-county (SU066), retrieved 2026-11-28

**Site:** https://grcsu.org/ (registry says http://wp.grcsu.org/, which 301-redirects to grcsu.org; `ud/wells-spring-69` has registry web http://www.rswsu.org/home, an old domain, not checked, the fetch tool blocked it).
Budget hub: https://grcsu.org/budget-information-27/ ; per-district pages below. `collectors/config.yaml` staged with the corrected source.

## Member districts: 4, not 2 (registry lists only Quarry Valley and Wells Spring)
The SU's own budget page lists Quarry Valley, Wells Springs, **Rutland Town** and **Ira**. Each sets its own budget (a separate vote each). **No warehouse records written** (2+ districts).

## Documents (all Google Drive, direct download works; all FY2027 = 2026-27)
| District | Document | Bytes | Staged |
|---|---|---|---|
| Quarry Valley UUSD | QVCombinedFY27-final2.pdf (annual report 2026, 50 pp, text layer) | 23,765,173 | yes |
| Wells Springs UUSD | WSCombinedFY27-final2.pdf (annual report 2026, 40 pp, text layer) | 24,533,132 | yes |
| Rutland Town SD | FY27 Rutland Town Budget - Board Approved.pdf (5 pp line items) | 155,149 | yes |
| Ira SD | Ira FY27 Budget Final Approved.pdf (1 p line items) | 58,835 | yes |
Pages: https://grcsu.org/fy27-budget-information-qvuusd/ , /fy27-budget-information-wsuusd/ , /fy27-budget-information-rts/ , /fy26-budget-information-ira-district/ .
Not downloaded (small, linked on the same pages, one-per-district rule): budget presentations (QV, WS, RT), "Board Approved Summary/Detail" and "Final Tax Rate" files, cost-driver sheets, letters, brochures, RT "Budget Summary" (1 p), Ira "Town Report Tax Rate & Tuition" (1 p, downloadable, not read). Also FY26 annual reports and prior-year files exist. Rutland Town and Ira have no annual report or AOE form on the page.

## needs_decision: per-district FY27 figures (AOE form = QV PDF p.36, WS PDF p.20; both stamped PRELIMINARY / ESTIMATES ONLY)
**Quarry Valley UUSD** (Poultney, Proctor, West Rutland): adopted/warned budget $21,927,468; offsetting revenues $1,959,864; education spending $19,967,604; pupils (LTWADM) 1,700.83; per pupil $11,739.92; equalized union rate $1.3017 (after $0.025 cent discount; $1.3267 before). Re-added: 21,927,468-1,959,864=19,967,604 and 19,967,604/1,700.83=11,739.9, both match.
Prior columns (budget / revenue / ed spending / pupils / per pupil): FY26 21,593,097 / 2,299,114 / 19,293,983 / 1,724.09 / 11,190.82; FY25 20,400,848 / 2,169,544 / 18,231,304 / 1,706.04 / 10,686.33; FY24 19,887,185 / 1,872,258 / 18,014,927 / 1,012.63 (equalized pupils, not comparable) / 17,790.24.
Town rates (p.35, estimated, using FY27 CLA): Poultney CLA 86.93% rate 1.4974; Proctor 86.17% / 1.5106; West Rutland 92.75% / 1.4034.
**Wells Springs UUSD** (Middletown Springs, Wells): budget $6,475,972; revenues $191,938; education spending $6,284,034; LTWADM 498.08; per pupil $12,616.52; equalized rate $1.4258 (no cent discount shown). Re-added: 6,475,972-191,938=6,284,034; 6,284,034/498.08=12,616.5, match.
Prior: FY26 6,390,447 / 267,429 / 6,123,018 / 477.66 / 12,818.78; FY25 6,043,373 / 100,954 / 5,942,419 / 490.91 / 12,104.91; FY24 5,782,862 / 283,678 / 5,499,184 / 266.20 (equalized) / 20,658.09.
Town rates (p.19): Middletown Springs CLA 88.34% rate 1.6139; Wells CLA 116.01% rate 1.2290.
**Rutland Town SD** (RT board approved 1/20/26, p.1-5): FY27 total expense $11,508,760.44 (FY26 $11,468,468.35); revenue $11,508,760.44 (state support $11,066,840.57 incl. general support grant $10,835,626.57). No AOE education-spending form read; not found in the staged file.
**Ira SD** (board approved 1/7/26): total expense $852,788.14; total revenue $852,788.14; "Total Educational Expense" $845,811.43. No AOE form in the staged file. Ira is a tuition district.
Decision for the lead: how to model a 4-district SU (member districts Rutland Town and Ira are not `ud` entities in the registry; QV and WS are `ud/quarry-valley-70` and `ud/wells-spring-69`). The staged QV/WS documents are the UUSDs' own budgets and could back `ud/` records instead of `su/` records.

## Discrepancies / flags
- Both AOE forms carry "PRELIMINARY / ESTIMATES ONLY" and the Dec. 1, 2025 yield assumptions ($8,849 property yield); the legislature later changed yields (not checked).
- QV p.36 FY24 shows 1,012.63 pupils and $17,790 per pupil: FY23/FY24 are equalized pupils, not comparable to LTWADM (same for WS FY24 266.20).
- QV annual report minutes (pp.44-45) are the Feb 25, 2025 informational meeting (FY26 cycle). The FY27 warning is not in the file. The WS file has 2025 meeting minutes/election results (pp.32-36), also not FY27.
- Not read in detail: QV pp.1-34 narrative, SU assessment pages (QV 38-42, WS 27-30), WS line-item pages 21-26 (seen only as text length), RT pp.2-5 beyond summary check.

## Vote results (March 3, 2026)
- Quarry Valley: $21.9M budget approved 434-411; Wells Springs: $6.5M budget approved 238-137 (Rutland Herald, 2026-03-04, https://www.rutlandherald.com/news/local/rutland-county-sees-only-two-school-budgets-fail-this-town-meeting-day/article_5bf79bf2-e1a1-44b7-b34d-24d5a09a824f.html; the search snippet was read, the full page not fetched).
- Ira: yes 48-29; Rutland Town: yes 452-358 (Vermont Daily Chronicle tally, secondary, https://vermontdailychronicle.com/two-towns-close-schools-ice-feared-at-non-citizen-voting-polls-woodstock-votes-new-school/comment-page-1/). Neither on a district site; result not found on grcsu.org.

## Ask the district
Rutland Town and Ira annual reports (AOE form, warned articles); certified FY27 warnings and election results; final (post-legislature) AOE forms.
