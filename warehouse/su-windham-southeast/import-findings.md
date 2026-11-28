> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/windham-southeast (SU048) — findings (retrieved 2026-11-28)

**Site:** current site is https://wsesu.org/ (Windham Southeast Supervisory Union). Budget pages: /wsesd-budget-documents/, /wsesd-documents/, /vernon-school-district-budget-documents/, /wsesu-budget-documents/. Registry URL http://www.wssu.k12.vt.us/ is stale (collectors/config.yaml replaces it).

**Member districts that set their own budgets: 2** (registry lists 1). Windham Southeast School District (WSESD; ud/windham-southeast-96; Brattleboro, Dummerston, Guilford, Putney) and Vernon Town School District (town-operated; registry has town/vernon and Vernon Elementary under this SU, but no ud entity). Hence NO warehouse records (per brief); figures below.

## Staged (intake/su-windham-southeast/fy2027/)
| File | Bytes | Source |
|---|---|---|
| 1 WSESD 2026 Annual Report and Proposed FY'27 Budget.pdf (158 pp, text layer) | 17,468,418 | Drive id 1cs8sOLkdy4hzSv9dCcSteE-YzcBQk1dy |
| FY27 WSESD Proposed Budget Summary - updated 1.29.26 prime wPage #s.pdf (47 pp) | 1,923,466 | Drive id 1Oiq-YP3uKfpFS_cNNjJ_HdarwS-hBF47 |
| VTSDfy27 Budget 01.27.2026.pdf (Vernon, 11 pp) | 1,108,045 | Drive id 1myH-Qt-YuSPb8E3fxLINCQ8AuBOyRbv7 |

## needs_decision — FY27 figures per district (all from the district-prepared "Homestead School Tax Rate / School Funding Law Statistics" sheet, NOT an AOE form)
Neither document contains the AOE "Three Prior Years Comparisons" form (heading searched).

**WSESD** (annual report PDF p. 21; warning p. 18; overview p. 20): FY27 total budget $69,874,600 (warned Article 4, Mar 17 2026); offsetting revenues $8,179,093; "Education Spending" $61,695,507 (re-adds); LTWADM 3,863; per pupil printed $15,972 (recomputed $15,970.88); Act 183 equalized homestead rate $1.805; threshold $16,470. Prior columns: FY2026 amd budget $68,101,438, revenue $7,756,276, ed. spending $60,345,162, 3,807 pupils, $15,851, rate $1.844; FY2025 amended $66,992,629, revenue $11,509,994, ed. spending $55,482,635, 3,734 pupils, $14,857 (recomputed $14,858.77), rate $2.075. Estimated town homestead rates FY27 / FY26: Brattleboro 1.955/1.899, Dummerston 1.981/1.893, Guilford 1.557/1.471, Putney 1.346/1.340; town CLAs FY27: .649/.641/.815/.943 (FY26 .703/.705/.907/.996). Sheet is "Preliminary ... as of 1.12.26".
**Vernon** (Vernon PDF p. 2): FY27 budget $7,933,289 (board approved 1/27/26); offsetting revenues $605,628; "Education Spending" $7,327,661; LTWA 465.0; per pupil printed $15,758 (town warning prints $15,762 — see below); equalized rate $1.781, actual homestead $1.484; CLA 81.05%. FY2026: $7,680,453 / $482,428 / $7,198,025 / 457 / $15,743; FY2025amd: $7,840,665 / $577,978 / $7,262,687 / 498 / $14,589.
Decision needed: whether each district gets its own record (no ud entity for Vernon in registry; WSESD record could be filed under ud/windham-southeast-96) and whether the district sheet's "Education Spending" is acceptable in place of an AOE form figure.

## Vote results
- WSESD FY27: report doesn't state it. District's draft minutes (https://drive.google.com/file/d/1p5dx-PBvctiK92XSkW0bXFjsC9mg_6L2/view, linked from https://wsesu.org/wsesd-documents/) say "ARTICLE 4 CARRIED BY VOICE VOTE" (7:54, Mar 17 2026); not staged (marked Draft). The Commons (https://www.commonsnews.org/issue/858/858WSESD_budget) also reports approval.
- WSESD FY26: report's own minutes (PDF pp. 6-13): Article 4 ($67,736,630) carried by voice vote Mar 18, 2025 after a $1M reduction amendment was defeated.
- Vernon FY27: not on district pages; The Commons (https://www.commonsnews.org/issue/855/855ATM_marathon) reports voters approved $7,933,289; town report shows Article 2 voted by Australian ballot Mar 3, 2026. Unverified from a district/town primary source.

## Discrepancies
- WSESD FY26: voted $67,736,630 / revenue $7,391,468 (minutes) vs "FY26 Amd" $68,101,438 / $7,756,276 (p. 21); same education spending $60,345,162. Difference $364,808 consistent with grant-funded amendments; not reconciled.
- WSESD per pupil FY27 $15,972 vs recomputed $15,970.88; FY25 $14,857 vs $14,858.77.
- Vernon per pupil on the sheet $15,758 vs $15,762 in the town warning (per Commons/town report), not checked in the staged file.
- Summary file: FY25 "Actual" expenditures $65,187,180 vs p. 21 FY25 amended total budget $66,992,629 (actual vs budget; expected).
- Rates are estimates ("Preliminary ... as of 1.12.26"); Act 183 rates = equalized rate / (town CLA / statewide CLA).

## Not downloaded / not read
Prior-year annual reports (FY24-FY26, Drive links on /wsesd-budget-documents/), Budget Detail, IBRC report, slideshow, capital plan, WSESU-level budget (/wsesu-budget-documents/; WSESU pages are inside the annual report, ~pp. 42-48) — none read beyond what's cited. FY28 drafts are already posted. Not read: audit pages, school-by-school line items.

## Ask the district
Whether an AOE "Three Prior Years Comparisons" / Education Spending form exists for FY27 (WSESD and Vernon); Vernon's certified March 2026 vote result; adm by grade band.
