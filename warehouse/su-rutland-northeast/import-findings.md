> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/rutland-northeast (Rutland Northeast SU, SU036): findings

Retrieved 2026-11-28. Worker: Hermes agent (dev profile).

## Sites
- SU site: https://www.rnesu.org/ (registry says http://www.rnesu.org/; it redirects to https, so there is no mismatch and no collector change).
- FY27 budget page: https://www.rnesu.org/page/budget-2627. It sits behind collapsed accordions, so plain fetch shows only headings; the links appear after clicking in a browser.
- Current page (FY28, vote March 2, 2027): https://www.rnesu.org/page/budget.
- The registry's OVUU web value, http://ovuhs.rnesu.org/home, was not checked. The documents came from the SU site.

## Structure (important)
The SU page says there are three budget-setting entities: RNESU (the SU), Barstow UUSD (BUU, towns Chittenden and Mendon), and Otter Valley UUSD (OVUU, towns Brandon, Goshen, Leicester, Pittsford, Sudbury, Whiting). The two districts vote on their own budgets. The SU budget is assessed to them (BUU $1,303,710, OVUU $6,632,296). The registry count of 2 members is correct. **2+ districts, so no warehouse records were written.** Figures are under needs_decision below.

## Documents (all FY2027, all Google Drive downloads linked from the budget page)
Staged in `intake/su-rutland-northeast/fy2027/` (byte-for-byte, server filenames, provenance.yaml covers all 7):
| File | Bytes | Notes |
|---|---|---|
| LOW RES FINAL DRAFT Jan 23 BUU 2026-2027 Annual Report (8.5 x 11 in).pdf | 62,161,687 | BUU annual report, 12 pp, Canva, image-only. p.7 BUU budget, p.9 RNESU budget. |
| Barstow FY27 Ed Spending Prior Yr_AOE From.pdf | 500,705 | AOE Three Prior Years form, U049, FY24-FY27. PRELIMINARY ESTIMATES ONLY. |
| SIGNED - BUUSD Warning 01-22-2026.pdf | 371,068 | BUU warning, Art. 11 $6,631,248. |
| LOW RES FINAL Jan 27 OVUU 2026-2027 Annual Report  (2).pdf | 98,019,487 | OVUU annual report, 20 pp, Canva, image-only. p.7 OVUU budget. Original (defeated) budget. Just under the 100 MB cap. |
| OVU FY27 Ed spending Prior Yr_AOE Form (1).pdf | 500,925 | AOE form, U053, FY24-FY27. PRELIMINARY ESTIMATES ONLY. Original budget. |
| SIGNED - OVUUSD Warning 01-22-2026.pdf | 155,628 | OVUU warning, Art. 11 $28,841,285. Original warning. |
| FY27 Proposed Budget 1_All GE by Function.pdf | 107,182 | RNESU SU ledger by function, Nov 2025 draft, $14,381,029. |

Not staged:
- BUU and OVUU "Annual Report Supplemental Documents" (17.8 MB and 19.7 MB, over the 15 MB extra-document cap).
- RNESU Nov 2025 budget slides (0.66 MB); the function sheet covers the same total.
- Function and Object summaries and detail series for BUU and OVUU, and the OVUU "Proposed Budget by Function/Object & Site" sheets. I did not download or read these.
- Board presentations of March 10 and 17, 2026 (Drive links on the page); not opened.
- Revote materials: warning, ballot, flyer and facts. They are images on the page whose Drive targets I did not download. See "should be asked for".
- The Voting Information and FY26 panels on the budget page were not read, so FY26 documents were not captured.

## Headline FY27 figures (as printed)
**BUU** (AOE form U049, "PRELIMINARY ESTIMATES ONLY", Dec 1 2025 outlook):
- Budget $6,631,248 (annual report p.7 says +6.17%; the form's FY26 is $6,245,598, which agrees).
- Offsetting revenues $73,174.
- Education spending $6,558,074; pupils 442.78 (LTWADM); per pupil $14,811.13 (warning: $14,811, +4.05%).
- Includes SU assessment $1,303,710.
- Equalized homestead rate $1.6738, income cap 2.44%. Chittenden and Mendon both 100% of the district, so each town prints the same rate. Town CLAs are not printed.
- Vote March 3, 2026: **passed 259-183** (district page https://www.rnesu.org/o/bms/article/2745660).

**OVUU** (AOE form U053, same stamp; original budget):
- Budget $28,841,285 (+2.92% per annual report p.7).
- Offsetting revenues $586,356.
- Education spending $28,254,928; pupils 1,981.71; per pupil $14,257.85 (warning: $14,257, +5.5%). The form also shows $297.75 construction deduction per pupil on line 14.
- Includes SU assessment $6,632,296. Equalized rate $1.6112, income cap 2.35%.
- Vote March 3, 2026: **failed 700-868** (district page https://www.rnesu.org/o/bms/article/2745660).
- Revote April 7, 2026: budget cut to **$28,663,285** (per-pupil $14,168, +4.84%, from the revote warning image on https://www.rnesu.org/page/budget-2627). The SU page does not state the result. Newspapers report it passed 672-638: https://mountaintimes.info/2026/04/15/otter-valley-budget-squeaks-by. WCAX also says it passed: https://www.wcax.com/2026/04/08/rutland-northeast-su-passes-school-budget-wolcott-mountain-view-union-districts-vote-down-budgets. I did not find an official district or town page with the revote count.

**RNESU (the SU's own budget)**:
- Annual report p.9: proposed $14,295,001, +$574,045 or 4.18% over FY26 $13,720,956.
- Revenue $6,358,995; net member assessments $7,936,006 = BUU $1,303,710 + OVUU $6,632,296.
- The Nov 2025 ledger draft is $14,381,029 (+4.81%).

## Discrepancies / flags
- OVUU form: $28,841,285 - $586,356 = $28,254,929, but the form prints Education Spending $28,254,928 ($1 rounding).
- RNESU total: the Nov 2025 draft ($14,381,029, 4.81%) differs from the annual report ($14,295,001, 4.18%). The draft was superseded.
- The OVUU AOE form, annual report and Article 11 are for the defeated $28,841,285 budget. The adopted FY27 OVUU budget is the $28,663,285 revote. No staged document carries the revote AOE form.
- The BUU annual report file name says "FINAL DRAFT Jan 23".
- Both AOE forms are PRELIMINARY ESTIMATES ONLY (yield $8,849, not final).
- Both annual reports are image-only (no text layer); I read the budget pages (BUU p.7, p.9; OVUU p.7) from renders at 130 dpi. I did not read the other pages (school profiles, superintendent's report, etc.) in detail.
- I did not cross-check the FY24-FY26 columns of the AOE forms against FY24-FY26 documents.

## needs_decision
- 2 member districts set their own budgets, so no warehouse records were written. If the project wants per-district (ud/barstow-49, ud/otter-valley-53) records, they need a decision on the entity type; the figures are in the section above.
- OVUU FY27: warned $28,841,285 (failed) vs adopted $28,663,285 (revote). Any record needs to treat these as two versions.
- The two annual reports are 62 MB and 98 MB, mostly photos. The lead may prefer to drop them from the PR in favour of the small AOE forms and warnings, which carry the figures. They are staged because the brief prefers the annual report.

## Should be asked for
- The OVUU revote AOE Three Prior Years form (for $28,663,285), the revote warning as a PDF, and the official April 7, 2026 result.
- Final (non-PRELIMINARY) AOE forms for both districts.
- The supplemental documents (line-item function/object detail) if wanted.
