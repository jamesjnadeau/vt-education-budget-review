> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/saint-johnsbury (SU011) — FINDINGS (retrieved 2026-11-28)

**Site:** https://www.stjsd.org/en-US/budget (registry/collector URL http://district.stjsd.org/ is stale; the district now runs on www.stjsd.org). Single budget-setting district (St. Johnsbury School District; one town, town/st-johnsbury; school/st-johnsbury-school) -> warehouse records allowed.

## Documents found
- FY2027, 2026 Annual Report (20 pp, 1,458,608 B, Drive PDF, downloadable): https://drive.google.com/uc?export=download&id=1OlfVZONmzUirdqhblZ55zzaGP_JLoZAj (linked from https://www.stjsd.org/en-US/budget/2026-annual-report-b63b8dbe). **Staged** as `2026 Annual Report.pdf` (server Content-Disposition). Has text layer.
- 2025 Annual Report `St_Johnsbury_2025_WEB_Feb11.pdf` (FY2026 proposal): listed on https://www.stjsd.org/en-US/budget/annual-reports-2ac377d2 (page https://www.stjsd.org/pages/a88fd63e-3c05-496e-b11b-209bfc7e8ca4). NOT downloaded (second document; FY2026 figures already appear as the prior-year column of the 2026 report).
- FY2027 Budget Information page = Smore newsletter (https://www.stjsd.org/en-US/budget/current-year-budget-information-5eda1469); no downloadable original; not read beyond the page shell.
- Annual Warning and Auditor Reports pages: pages opened, no document links captured by the extractor; not read.
- Town of St. Johnsbury site (docs.stjvt.com) has the March 3, 2026 warning and ballot (same $31,830,266 article) and the town report reprinting the school section; not downloaded.

## Staged
intake/su-saint-johnsbury/fy2027/{2026 Annual Report.pdf, provenance.yaml}; warehouse/su-saint-johnsbury/{fy2027-warned, fy2026-approved, fy2025-approved}.yaml; collectors/config.yaml (registry URL stale). check_su.sh: 0 errors, no warning naming this SU.

## FY2027 headline figures (2026 Annual Report; no AOE form in the document)
- Total expenditures $31,830,266 (+5.34% vs FY26 $30,217,239) — pp. 9-12
- Total revenues $5,484,947 (incl. $250,000 anticipated FY2025 surplus) — p. 11
- "Net Education Spending" $26,345,319 (district table, p. 11) — NOT the AOE form figure; education_spending left null in all records
- LTW ADM 1,820 (FY26 1,869); per pupil $14,479 (+8.39%); yield $9,212; school district tax rate $1.5627; statewide CLA adjustment 1.3744; est. homestead rate $1.1370 (p. 9 rounds to $1.14), preliminary, includes anticipated state buy-down
- FY26 column: net ed spending $24,967,147; LTW ADM 1,869; $13,359/pupil; homestead $1.0631
- Vote: Article 1 reported passed 627-606 by News7 (https://www.news7newslinc.net/index.php/around-the-nek/st-johnsbury); no district/town page with the result found. Article 2 (capital reserve from up to 50% of FY25 surplus) result not found.

## Discrepancies
- Printed per pupil $14,479 vs recomputed $26,345,319/1,820 = $14,475.45 (flagged in fy2027 record). FY26 column recomputes fine.
- Report says 'education for over 1,000 students' (p. 11) while LTW ADM is 1,820 (weighted; not comparable).
- Revenue summary p. 10 sums to $31,830,266 (checked).

## needs_decision
- Whether the district's "Net Education Spending" ($26,345,319 FY27; $24,967,147 FY26) may be used as education_spending in lieu of the AOE form (left null per brief).
- FY2026/FY2025 records are 'approved' on the strength of being the printed prior-year budget; the report states no adoption date.

## Ask the district for
The AOE Education Spending / Three Prior Years Comparisons form for FY2027 (and the final vote tally), plus the town CLA used.

## Not read
Page-by-page review of pp. 1-8 and 14-19 (narrative, line-by-line detail) was text-grepped only for budget/ADM/CLA keywords; the line-by-line budget (pp. 13-19) was not transcribed.
