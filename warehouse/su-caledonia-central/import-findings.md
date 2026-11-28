> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/caledonia-central — Caledonia Central Supervisory Union (AOE SU009) — FY2027

Retrieved 2026-11-28. **No warehouse records written** (2 member districts set their own budgets; the SU budget is assessment-funded and has no AOE education-spending form).

## Sites
- Current SU site: https://www.ccsuvt.net/ (budget: /budget; Caledonia Coop budgets: /188132_3)
- Twinfield: https://www.twinfield.net/141363_3
- **Registry mismatch:** http://www.ccsuonline.org/ does not resolve (DNS failure). Twinfield registry URL washnesu.org/twinfield also stale. Wrote collectors/config.yaml with the three working pages.

## Documents (all staged in intake/su-caledonia-central/fy2027/, all downloaded byte-for-byte, all < 8 MB)
| Doc | Size | Notes |
|---|---|---|
| CalCoop 2025-26 Annual Report.pdf (Drive 13PAdQ…) | 7.5 MB | CCSD annual report, FY27 3-year comparison PDF p.27, tax impact p.28, revenue p.35 |
| FY27 CCSD APPROVED Budget.pdf (Drive 1JLi_4…) | 1.2 MB | same budget pages (p.2 3-year comparison, p.3 tax impact); still labelled PROPOSED |
| CCSD Election 2026 Results.pdf | 135 KB | March 3, 2026 certified results |
| ccsu_fy27_budget.pdf | 32 KB | SU-office budget: revenue FY24-FY27 + assessments by district |
| TWINFIELD Annual Report FINAL.pdf | 6.7 MB | Twinfield annual report (49 pp) |
| Twinfield Union School District Proposed FY27 Budget.pdf | 1.9 MB | Twinfield 3-year comparison p.2, tax impact p.3 |
| Twinfield Union School Board Annual Meeting Minutes 2_10_26.pdf | 98 KB | includes March 3 ballot results |

Not downloaded: Caledonia Coop signed warning (Drive 1gJJxJ…, 2.9 MB, image-only scan; read by eye for the Article 8 text only), sample ballots, postcard notice, notice to voters; Twinfield warning/notice/sample ballot; "A Visual Walk Through the FY27 SU Budget" (220 KB slides, adds nothing beyond the SU budget); prior-year (FY22-FY26) documents on the same pages.

## SU's own budget (ccsu_fy27_budget.pdf)
- FY27 revenue estimates $14,976,385 (local $8,607,051 incl. special-ed assessment $4,662,733 and general assessment $1,600,132; state/other $6,369,334). FY26 $13,893,034; FY25 revised $13,511,547; FY24 budget $12,540,329. Page 1.
- Assessments to districts, FY27 (Funds 1 and 6): Caledonia Coop $2,789,792.19; Danville $2,563,030.57; Peacham $485,679.59; Cabot $1,359,717.86; Twinfield $2,021,819.80; total $9,220,040. Page 2.
- SU serves five districts (three beyond the registry's two members: Danville, Peacham, Cabot). **Needs decision** whether the SU's own budget (revenue only printed; no expenditure total) should get a record, and under which schema fields.
- Page 1 includes a stray "0.7142857" and an FTE row (135.7 / 129.7 / 114.7) with a "($114.65)" change; not reconciled.

## needs_decision — per-district FY27 figures (as printed, not recomputed into records)
**Caledonia Cooperative SD #78 (ud/caledonia-cooperative-78; Barnet, Walden, Waterford)** — Annual report PDF p.27-28 = approved-budget extract p.2-3
- Warned (Article 8, March 3, 2026): expend $16,854,093; per-pupil education spending $16,120, "5.9% higher" than current year (warning, image scan). 16,120/15,223 = 5.89%.
- FY27 total budgeted expenditures $16,854,093; offsetting local revenues $288,877; education spending $16,565,216; LTWADM 1,027.60; per pupil $16,120; excess threshold $16,472. Arithmetic checks.
- FY26 (voter approved): $16,336,206 − $447,500 = $15,888,706; 1,043.74; $15,223. FY25 (voter approved): $15,777,842 − $833,500 = $14,944,342; 1,033.89; $14,454.
- Equalized homestead rate pre-CLA FY27 1.82 (FY26 1.77, FY25 1.46). Per-town homestead rate / CLA (FY27): Barnet 1.91 / 67.24%; Walden 1.96 / 65.50%; Waterford 1.27 / 100.79%. FY26: 1.81/70.80%, 1.61/79.72%, 1.65/77.68%. FY25: 1.79/81.58%, 1.64/89.26%, 1.73/84.39%.
- Vote: Article 8 passed 302-201 (Barnet 125-82, Walden 58-63, Waterford 119-56), certified results in intake (CCSD Election 2026 Results.pdf).
- Discrepancies: FY27 columns labelled PROPOSED even in the "APPROVED" file; Waterford CLA jumps 77.68% → 100.79% (printed as is; rate falls $0.38); printed Barnet 1.91 vs 1.82/0.9561 = 1.90 (rounding); education-fund-sources page is headed "FY26" and totals $15,851,124 (not FY27 education spending); election-results footer says "2025"; annual report p.43 minutes are Feb 2025 (prior year); FY23/FY24 columns not in this document.

**Twinfield Union SD #33 (ud/twinfield-33; Marshfield, Plainfield)** — budget extract p.2-3; annual report printed pp.24-25
- FY27 total budgeted expenditures $8,756,753; education spending $8,678,346; LTWADM 580.84; per pupil $14,941; threshold $16,470. 8,678,346/580.84 = 14,941.
- FY26 voter approved education spending $8,239,777; 596.48; $13,814. FY25 $7,792,644; 595.76; $13,080.
- Homestead rate / CLA FY27: Plainfield 1.0786 / 110.09%; Marshfield 1.9000 (p.3; 1.9048 on p.2) / 62.34%. FY26: Plainfield 0.9868/117.84%, Marshfield 1.57 (p.3; 1.5660 on p.2) / 74.26%. FY25: 1.89 (p.3; 1.90 on p.2) / 69.86%; 1.52 / 87.02%.
- Vote: Article Five ($8,756,753) passed 350-238 on March 3, 2026 (minutes PDF).
- Discrepancies: p.2 "less offsetting local revenues" shows $84,393 (the change column), while 8,756,753 − 8,678,346 = $78,407 offset; total budget change printed $354,176 on p.2 but 344,176 on the revenue page (8,756,753 − 8,412,577); FY25/FY26 columns blank on p.2; FY25 Plainfield rate 1.90 vs 1.89 between pages; FY27 headed PROPOSED.

## Not read / not done
- Did not read the full line-item pages of either annual report, nor the Twinfield annual report beyond its tax and funding pages.
- Did not read the Twinfield warning, sample ballots or notices.
- No Danville/Peacham/Cabot figures (those districts are not members per the registry; assessments only, from the SU budget).
- The SU's own annual report or an SU expenditure budget was not found; ask the SU office for the full FY27 SU expenditure budget if a record is wanted.
