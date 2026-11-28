> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/windham-northeast (SU047) — FINDINGS

**Site:** https://www.wnesu.org/ (Finalsite). Budgets page: https://www.wnesu.org/school-boards/budgets
**Registry URL mismatch:** registry/collector URL `http://www.wnesu.org/Pages/index` returns 404; replaced in staged `collectors/config.yaml`.

## Documents
| FY | Doc | URL | Size | Staged |
|---|---|---|---|---|
| 2027 | WNESU Annual Report 2026-2027 (combined, 105 pp.) | https://resources.finalsite.net/images/v1770236753/wnesuorg/x5eo3qypmry1kudzzxch/01AnnualReport_final.pdf | 16,458,468 B | yes -> intake/su-windham-northeast/fy2027/ |
| 2026 | WNESU Annual Report 2025-2026 | https://resources.finalsite.net/images/v1739808884/wnesuorg/kiw5isbyu2leoawovhap/FY26AnnualReport_22025_org.pdf | not checked | no (FY27 preferred; link seen on budgets page, not downloaded) |
| 2027 | Per-board budget summaries and full Excel budgets (SU, BFUHS, Rockingham, Westminster) and AOE Three Prior Years PDFs | https://www.wnesu.org/school-boards/budgets (links under /fs/resource-manager/view/<uuid>) | not downloaded | no (annual report already contains the same summaries and AOE forms; Excel files not read) |

No Content-Disposition was sent; filename = last URL path segment. The PDF has a text layer (Acrobat image-conversion output), so no vision reading was needed. All AOE forms in it are stamped PRELIMINARY.

## Warehouse records: NONE (needs_decision)
The SU has 4 budget-setting districts (registry lists only 2 members) plus the SU's own budget, so per the brief no records were written. Per-district FY27 figures (AOE form, PDF page; FY24..FY27 columns as printed):

| District (AOE id) | Form p. | Budget FY27 | Offsetting rev | Education spending FY27 | Pupils (LTWADM) | Per pupil |
|---|---|---|---|---|---|---|
| Bellows Falls UHSD #27 (U027), towns Athens, Grafton, Rockingham, Westminster | 43 | $9,192,421 | $259,352 | $8,933,069 | 688.68 | $12,971.29 |
| Rockingham TSD (T169) | 76 | $11,483,243 | $1,365,400 | $10,117,843 | 813.98 | $12,430.09 |
| Westminster TSD (T234) | 91 | $5,145,255 | $115,000 | $5,030,255 | 328.40 | $15,317.46 |
| Athens Grafton SD / Windham Northeast UESD (U095), towns Athens, Grafton | 104 | $1,676,464 | $337,630 | $1,338,834 | 98.69 | $13,566.06 |
| WNESU (the SU itself; general fund) | 21 | $11,344,311 (revenue = expenditure; SU assessments $6,775,978) | - | no AOE form | - | - |

Prior-year columns on the same pages: BFUHS ed. spending FY24 $7,572,000 / FY25 $7,841,496 / FY26 $8,317,622; Rockingham $8,512,454 / $9,359,247 / $9,889,089; Westminster $4,849,731 / $5,216,000 / $5,208,124; Athens Grafton $1,575,788 / $1,572,000 / $1,382,325. FY24 pupils are equalized (not comparable with FY25+ LTWADM).
Prorated union homestead rates (FY27, per $100; BFUHS p. 43): Athens 0.5891, Grafton 0.6152, Rockingham 0.5145, Westminster 0.5088. Athens Grafton (p. 104): Athens 0.9169, Grafton 0.8897. District-level rates for Rockingham/Westminster: p. 76 / p. 91 lines 27, 31 (Rockingham 1.4047, portion by town 0.9105; Westminster 1.7310 / 1.0976). CLA/SA line 32: Rockingham 140.01%, Westminster 88.67% (ratio semantics not verified).

## Vote results (all FY27 budgets, Australian ballot March 3, 2026)
Passed, per Vermont Journal town-meeting results (vote counts not found): https://vermontjournal.com/featured-articles/town-meeting-2026-results/ — Rockingham $11,483,243; Westminster $5,145,255; Athens Grafton $1,676,464; BFUHS $9,192,421. WNESU SU budget: result not found (SU budget is not voted by article in this document).

## Discrepancies inside the document (not reconciled)
- BFUHS p. 42 budget summary: revenue total $9,192,321 vs expenditure $9,192,421, difference column 655,437 vs 655,537 (the $100 mismatch); AOE form p. 43 and warning use $9,192,421.
- BFUHS warning Art. 8 (p. 32) states per-pupil $12,970.91 ("$378.07 lower"); AOE form p. 43 says $12,971.29 (FY26 $12,722.55; $12,971.29 - $12,722.55 is +$248.74, so "lower" is also inconsistent). Rockingham warning (p. 59) says $12,429.78, "$403.66 lower"; form p. 76 says $12,430.09 vs FY26 $12,833.47 (-$403.38).
- Westminster warning (p. 83) says per-pupil $15,317 "2% higher" — consistent with form.
- All four AOE forms stamped PRELIMINARY; yields assumed $8,849 / $12,154 (Dec 2025 forecast).
- Registry lists 2 members; document shows 4 budget-setting districts + SU.
Arithmetic re-check: budget - offsetting revenue = education spending, and spending / pupils = per pupil, hold on all four forms.

## Not read / not done
Full 105 pp. not read line by line; only budget summaries, warnings, AOE forms and tax-rate tables were extracted. Excel budgets and FY26 report not downloaded. Warehouse records not written (multi-district SU). Ask town clerks for certified vote tallies.
