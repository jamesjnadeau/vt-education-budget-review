> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/essex-north (Essex North Supervisory Union, SU019) — findings, 2026-11-28

## Sites
- Current site: https://www.ensuvt.org/ (Apptegy). Board pages with budget links: https://www.ensuvt.org/page/canaan-school-distrtict-board and https://www.ensuvt.org/o/nek/page/nek-choice-board. Links are injected by JavaScript (curl shows none; found with a browser).
- Registry URL http://www.essexnorth.org/ is dead (no response). `collectors/config.yaml` staged to replace it.
- Member districts: Canaan School District (own site canaanschools.org) and NEK Choice School District (10 towns, ensuvt.org/o/nek). The registry lists only NEK Choice as a member; Canaan is also a member (see needs_decision).

## Documents found (all FY27 = 2026-27; all downloadable PDFs)
| Doc | URL | Size | Staged |
|---|---|---|---|
| Canaan School District annual report, year ending 12/31/2025 (48 pp, text layer) | https://aptg.co/N8FH9X | 4.2 MB | yes |
| NEK Choice Proposed Budget FY27 (2 pp) | https://aptg.co/Dx_Jqz | 158 KB | yes |
| CSD FY27 Proposed Budget (11 pp) | https://aptg.co/0srKN6 | 362 KB | yes |
| Canaan School District Warning, March 2, 2026 (1 p, image-only) | https://aptg.co/zLD3Z3 | 56 KB | yes |
Not downloaded: older years on the same pages (FY20-FY26 budgets/warrants/annual reports, 5il.co links) and the NEK Choice annual report FY20; the brief asks for FY27. There is no separate SU annual report or budget page on ensuvt.org. The ENSU budget exists only as an appendix to the district reports.
All staged under `intake/su-essex-north/fy2027/` with `provenance.yaml`. No warehouse records written (2 member districts set their own budgets).

## ENSU's own FY27 budget (annual report PDF pp. 44-46)
Printed as "Essex North Supervisory Union 2026-2027 (FY27) Proposed Budget", split NEK Choice / Canaan / Ferdinand / SAU 7. Grand Total of All Expenditures FY27 $4,367,477 vs FY26 $4,533,000 (-$165,523): NEK Choice $2,117,668, Canaan $2,232,010, Ferdinand $0, SAU 7 $17,800. Components read: special education $2,979,373 (p. 45, FY26 $3,132,813); grants/Medicaid $359,157 (FY26 $389,571). Revenue statement (pp. 45-46) read only as far as the transportation aid line. Superintendent's office assessments: Canaan $311,659 (this page; Canaan's own budget line 593 shows $306,533 — differ), NEK Choice $320,033 (NEK Choice budget page shows $314,409). I did not reconcile these. The SU budget is a set of assessments charged to districts; it prints no education spending, pupils or tax rate, so no SU record was written.

## needs_decision
1. Whether to write a warehouse record for su/essex-north at all. Recommendation: no; the SU's $4,367,477 is funded through the two districts' budgets (already inside their totals), so a record would double count. If the repo wants per-district records, the entities are `ud/northeast-kingdom-choice` and the Canaan School District (check its slug in registry; it was not in the registry's member list for this SU).
2. Per-district FY27 figures (proposed; March 2026 result not found):
   - **Canaan School District** (annual report pp. 37-38; warning): total budget $5,530,704; offsetting revenues $1,152,800; education spending $4,377,904; LTWADM 256.03; per pupil $17,099 ($17,099.18 on the AOE form); CLA 107.15%; equalized homestead rate $1.9744 on form line 27 (the narrative computes $1.9323 = 17,099 / 8,849 and an actual rate $1.8033; the tax-rate table prints $1.8427 including a $94,644.50 excess-spending penalty, $.0394); yield $8,849. Prior columns on the AOE form (p. 38): FY24 budget $5,000,648, revenue $1,851,056, ed spending $3,149,592, 146.85 pupils (equalized), $21,447.68; FY25 $5,234,915 / $1,640,758 / $3,594,157 / 273.60 (equalized) / $13,029.73; FY26 $5,459,384 / $1,076,830 / $4,382,554 / 258.37 LTWADM / $16,962.32. The form's pupil row label reads 'eqpup FY23 - FY24, LTWADM FY25 - FY26' and a side note says equalized pupils are shown for FY23 and FY24, but the columns are FY24-FY27: stale template labels, so which columns are LTWADM is unclear (FY24 and FY25 are not comparable to FY26/FY27 either way). Read from the text layer, not re-added line by line against the image.
   - **NEK Choice School District** (budget PDF pp. 1-2; equalized-pupil figures are from the Guildhall town report, not a district document): total budget $7,594,091 (FY26 $7,630,243); revenue statement: education fund $7,473,091 + $120,000 prior-year surplus + $1,000 interest; so education spending $7,473,091 as printed on that statement, local revenues $121,000. Guildhall report (guildhallvt.org 2025 municipal report) prints equalized pupils 586.75 (FY26 539.03), per pupil $12,736 (FY26 $14,154), equalized rate $1.4393 (FY26 $1.6465), yield $8,849. NEK Choice's own PDF prints no pupil count. Towns: bloomfield, brunswick, east-haven, granby, guildhall, kirby, lemington, maidstone, norton, victory.

## Discrepancies inside the documents (recorded, not reconciled)
- Canaan FY26 total budget: $5,459,394 (tax-rate table p. 37) vs $5,459,384 (AOE form, line items) ; FY26 education spending $4,382,564 (p. 37) vs $4,382,554 (form p. 38).
- Warning says $17,099 is ".082% higher" than the current year; $17,099 / $16,962 is +0.8%.
- Annual report includes FY26-era minutes (March 3, 2025: $5,459,384, which passed) alongside FY27 proposed material. The FY26 article text said $17,099 per pupil, the same number as FY27, probably carried over.
- The AOE form is headed PRELIMINARY / ESTIMATES.
- NEK Choice PDF: file name says "Board approved 12/18/25", pages say "Preliminary"; column header "Approved Budget (FY29)" is a typo for FY26. Arithmetic check: tuition 6,876,836 + non-special-ed 33,183 + special ed 332,833 + SU assessment/board/treasurer 351,239 = 7,594,091, matches. Revenue column total prints (156,152) as the increase but the revenue total change is (36,152): printed variance error.

## Vote results
Canaan (March 2-3, 2026) and NEK Choice (Australian ballot, March 2026): result not found on ensuvt.org, canaan-vt.org or guildhallvt.org.

## Not read
Pages of the annual report outside the budget/tax/ENSU sections (reports, audit, staff); the FY27 Canaan line items beyond the totals; ENSU revenue statement beyond the transport line.

## Ask the district
The certified March 2026 results for both districts; the FY27 AOE Three Prior Years Comparisons form for NEK Choice (not published on its page); an ENSU annual report if one exists separately.
