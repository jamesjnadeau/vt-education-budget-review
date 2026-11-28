> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# SAU #70 (su/school-administrative-unit-70, AOE SU055) — FY2027 findings

## Structure (read this first)
SAU #70 is a **New Hampshire** administrative unit, not a Vermont SU with its own budget. It serves three districts that each set their own budget:
- **Hanover School District** (NH) — $16,956,054 (Art. 5).
- **Norwich School District** (VT, Marion Cross, PreK-6) — $8,888,877 (Art. 5).
- **Dresden School District** (NH/VT interstate compact of 1963; Richmond Middle + Hanover High; Norwich grades 7-12, Hanover 6-12) — $33,705,109 base (Art. 4), $33,822,795 with all articles. Its board = Hanover board + 4 of 5 Norwich board members.
- The SAU's own budget ($2,740,626 expenditure; assessed $2,883,967 across Dresden/Hanover/Norwich) is not voted on separately. The registry lists only 1 member (ud/dresden-interstate-union-school, towns=norwich); the documents show 3 budget-setting districts (2 + the interstate one) => **no warehouse records written**.

## Site / registry mismatch
Registry URL http://sau70.hanovernorwichschools.org// now redirects to a Google sign-in page (stale). Current site: https://www.sau70.org (Budgets: https://www.sau70.org/departments/business-finance/budgets). Staged collectors/config.yaml with the new URL.

## Documents
Staged (intake/su-school-administrative-unit-70/fy2027/, both text-layer PDFs, no Content-Disposition, filenames from URL):
1. SAU70AnnualReport2025-26_FINALUP02192026.pdf — 6,418,515 B, 63 pp. Dresden + Hanover annual report and FY27 proposed budgets.
2. 89589_Norwich_final-fromRCBrayshaw.pdf — 543,075 B, 8 pp. Norwich/Dresden voter brochure (Norwich school budget).

Found but NOT downloaded: FY27 Budget Books with Exhibits for Dresden/Hanover/Norwich and SAU (Simbli/eboardsolutions links on the Budgets page, not direct file URLs); Hanover voter brochure (https://resources.finalsite.net/images/v1770209795/hanovernorwichschoolsorg/jwwithwgodztmdggfizn/89589_Hanover-final-fromRCBrayshaw.pdf, NH-only); older annual reports/brochures FY23-FY26 on the same page. Norwich ballot tally scan: https://norwich.vt.us/wp-content/uploads/2026/03/20260303210433.pdf (image scan, handwritten tallies, not read).

## Vermont (Norwich) share, FY27, as printed — needs_decision
Norwich brochure (PDF pp. 1-2, 6-7):
- Norwich School District budget (Marion Cross, direct): $8,888,877 (+$614,797 / +7.43%; brochure text also says +$614,798).
- Norwich assessment share of Dresden BASE budget: $9,080,715 (+$475,735 stated in text, 5.53%; annual report PDF p. 50 prints +$475,753). Sum of both = $17,969,592 (+$1,090,533, 6.46%); after offsetting revenues +$967,717 (6.51%).
- With all Dresden articles: total expenditures $18,002,799 (+6.66%); total education spending after offsetting revenues $15,935,268 (+7.14%).
- Annual report Exh. 2B (PDF p. 47) with all articles: Norwich share 30.162% of $30,221,684 net assessment = $9,111,422 (+$506,460, 5.89%). $9,111,422 - $9,080,715 = $30,707 = the Service Staff article (Art. 3) share the brochure states.
- SAU assessment to Norwich: $505,612 (+$35,413/35,414); inside the $8,888,877 (the "SAU Assessment" line, brochure p. 2).
- LTWADM 816.35 -> 833.35 (+2.08%, as of Jan 13, 2026; brochure p. 1). Per-pupil education spending $19,082 (+4.30% in Art. 5 note; the narrative text says 4.95%, "$902 higher").
- Projected Norwich homestead rate $2.0469 (+$0.1286, +6.71%), yield $8,849 (Dec 1, 2025 letter), CLA 142.51% "includes state adjustments", Year-3 discount $0.114. Projection by the district, not Tax Dept.
- Dresden ADM allocation (Exh. 9, p. 38): Norwich 273.1 / 905.4 = 30.162% for 2026-27.
- No AOE "Three Prior Years Comparisons" form is printed in either document. FY24-FY26 columns not available in AOE form; Norwich budget by function gives 2024-25 $7,946,835 and 2025-26 $8,274,080 (brochure p. 2).

## Dresden FY27 (annual report)
Total revenues = expenditures $33,822,795 (all articles); net assessment $30,221,684 (Hanover $21,110,262; Norwich $9,111,422); tuition revenue $3,316,317; Dresden base 33,705,109 (Art. 4).

## Discrepancies seen (recorded, not reconciled)
- Dresden base budget increase: $1,937,530 / 6.10% (warrant text) vs $1,921,653 / 6.05% (budget recap table, p. 6 of brochure). "Total expenditure budget $33,720,986" (district-wide chart) differs from $33,705,109 (Art. 4) by $15,877 (= Art. 2 officer salaries).
- Norwich Dresden-share increase $475,735 (brochure) vs $475,753 (annual report text); SAU assessment Hanover +$110,362 vs +$110,361; Norwich +$35,413 vs +$35,414. Printed "$1.647,195" (typo) for Dresden SAU assessment.
- Annual report Exh. 3B total revenue change "$2,439,339, 7.8%" vs $2,039,339 / 6.42% elsewhere.
- Per-pupil growth for Norwich: 4.30% (Art. 5 note) vs 4.95% (narrative).
- Dresden warrant says net assessment +$1,937,186 / 6.87% (HFC page) vs Exh. 2B +$2,038,995 / 7.23% (the latter includes Art. 3).

## Vote result (news; not paywalled text read)
- Norwich School District budget $8.89M (Art. 5, $8,888,877) approved March 3, 2026: https://vnews.com/2026/03/04/norwich-votes-approve-budget/
- Dresden $33.71M budget and all articles approved by Norwich and Hanover voters March 3, 2026: https://vnews.com/2026/03/04/dresden-school-district-budget-approved/
- Margins/counts not recorded (town ballot-tally scan at norwich.vt.us not read). Newspaper reports only; not used as adopted_date.

## Needs a human decision
- Which entity represents Norwich's Vermont education spending in the warehouse: the registry has su/school-administrative-unit-70 plus ud/dresden-interstate-union-school (towns=norwich), but Norwich also sets its own elementary budget (Marion Cross). No Vermont AOE form was found. Suggest asking the district for the AOE Three Prior Years Comparisons / Education Spending form (Norwich files with Vermont AOE) and the FY27 Budget Books with Exhibits as files.

## Not read
Hanover pages in the annual report (beyond keyword hits), audit/other narrative, the Norwich tally scan, all Simbli/BoardDocs documents, older-year documents.
