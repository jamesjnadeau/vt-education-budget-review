> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/bennington-rutland — Bennington-Rutland Supervisory Union (AOE SU006)

Retrieved 2026-11-28. Site: https://www.brsu.org/ (registry URL is correct; no collectors/config.yaml change staged; the collector config lists kind `other`, no fiscal_years_available — lead may want `annual_report_page` with page https://www.brsu.org/page/annual-and-town-reports, FY2027 available).

## Documents (page: https://www.brsu.org/page/annual-and-town-reports, "Annual and Town Reports – March 2026")
All three are Google Drive PDFs, all downloaded byte-for-byte, FY27 (March 2026 meeting). Filenames say "2025" for two of them but content is FY27. All have a text layer; read with pdftotext.
| District | file | bytes | PDF page of AOE form |
|---|---|---|---|
| Mettawee SD (U084) | Mettawee Annual Report 2025.pdf | 15,787,552 | 45 |
| Taconic & Green RUSD (U063) | T&G Annual Report 2025 v2.pdf | 24,883,673 | 59 |
| Winhall TSD (T248) | Winhall FY27 Budget Info Report.pdf | 14,864,724 | 29 |
Brief says add extra docs only if < 15 MB; Mettawee (15.8 MB) and T&G (24.9 MB) exceed that, but they are the two registry member districts and each is a different district's own budget, so all three are staged. Lead may drop any for repo size.
Not downloaded: prior-year ("PRIOR YEARS DATA BELOW") reports and election-result docs on the site (not needed for FY27). Election results are on https://www.brsu.org/o/brsu/page/election-reports (read as page text).

## Member-district mismatch
Task context lists 2 member districts (Mettawee #84, T&G #63). The BRSU documents (Mettawee PDF p. 46 FAQ) list THREE: Mettawee, T&G, and Winhall Town School District (T248; town winhall). Winhall is not in the member list given. Per the brief (2+ districts) NO warehouse records written.

## needs_decision — per-district FY27 figures (AOE "Three Prior Years Comparisons", all marked PRELIMINARY / ESTIMATES ONLY)
LTWADM pupils for FY25-FY27 (FY24 column = equalized pupils, not comparable). Education spending = total expenditures − offsetting revenues (re-added below; matches printed).
| | FY24 | FY25 | FY26 | FY27 |
|---|---|---|---|---|
| **Mettawee** warned budget (line 1) | 6,442,338 | 6,793,235 | 6,933,338 | 6,935,806 |
| + articles ($40,000 reserve) / total expenditures | 6,482,338 | 6,833,235 | 6,973,338 | 6,975,806 |
| union revenues | 308,571 | 550,291 | 352,958 | 468,850 |
| **education spending** | 6,173,767 | 6,282,944 | 6,620,380 | **6,506,956** |
| pupils | 301.38 (eq) | 495.80 | 502.90 | 499.54 |
| per pupil | 20,484.99 | 12,672.34 | 13,164.41 | 13,025.90 |
| equalized union rate (line 27) | 1.3265 | 1.2809 | 1.5315 | 1.4720; after cent discount 1.4635 |
| **T&G** warned budget | 36,829,647 | 38,918,851 | 39,761,652 | 41,042,088 |
| + articles / total expenditures | 37,254,647 | 39,593,851 | 40,361,652 | 41,467,088 |
| revenues | 2,576,618 | 3,607,050 | 3,552,169 | 3,252,180 |
| **education spending** | 34,678,029 | 35,986,801 | 36,809,483 | **38,214,908** |
| pupils | 1,662.47 (eq) | 2,692.36 | 2,902.53 | 2,912.26 |
| per pupil | 20,859.34 | 13,366.27 | 12,681.86 | 13,122.08 |
| equalized union rate | 1.3507 | 1.3511 | 1.4753 | 1.4829; after cent discount 1.4489 |
| **Winhall** warned budget | 4,523,694 | 4,566,869 | 4,788,598 | 4,630,215 |
| + articles / total expenditures | 4,543,694 | 4,591,869 | 4,859,851 (incl. $41,253 deficit repayment) | 4,665,215 |
| **education spending** | 4,387,361 | 4,136,326 | 4,611,951 | **4,158,568** |
| pupils | 229.15 (eq) | 317.61 | 327.67 | 319.93 |
| per pupil | 19,146.24 | 13,023.29 | 14,098.88 | 12,998.37 |
| district eq. homestead rate | 1.2398 | 1.3164 | 1.6402 | 1.4689; cent-discount 1.3579; CLA/adj 73.92% → actual 1.8370 |
Sums checked: Mettawee 6,975,806−468,850=6,506,956; T&G 41,467,088−3,252,180=38,214,908; Winhall 4,665,215−4,158,568 → implies 506,647 revenue (revenue line not read separately). FY27 FY26-vs-FY27 spending change printed in text: Mettawee −1.7%, T&G +3.8%, Winhall −10.0% (Winhall FAQ).

T&G town homestead rates FY27 projected (PDF p. 40, printed 38; CLA with statewide adjustment 70.33%) — columns as printed: Danby 1.0746/134.82%, Dorset 0.9860/146.94%, Landgrove 1.3693/105.80%, Londonderry 1.7857/81.13%, Manchester 1.1598/124.91%, Mt. Tabor 1.5236/95.09%, Peru 2.0585/70.38%, Sunderland 1.7625/82.20%, Weston 1.0436/138.82%. NOTE: header lists 9 towns but rows 1-13 print 10 values (first is probably an overall/blank column) — pairing with towns should be verified against the page image before use. Mettawee town rates (Pawlet, Rupert) and Winhall town page not read in detail.

## Discrepancies inside the documents (recorded, not reconciled)
- Warrant per-pupil estimate vs AOE form: Mettawee warning $13,007 (−1.2%) vs form $13,025.90; T&G warning $13,133 (+3.6%) vs form $13,122.08; Winhall warning $12,998 = form $12,998.37 (−7.8%).
- All three AOE forms stamped PRELIMINARY / ESTIMATES ONLY (yield $8,849, income yield $12,154, nonresidential $1.785 from Dec-1-2025 outlook).
- Mettawee BRSU general assessment page: assessment after surplus total $3,164,284 vs FY26 $2,939,397 (+224,887, +7.7%) and "before surplus" FY26 listed as $3,089,397 — differs by $500 from the budget page FY26 subtotal $3,089,897 (assessment page $3,089,397).

## Supervisory union's own budget (informational; Mettawee PDF pp. 49-53, same pages in T&G/Winhall PDFs)
- BRSU General FY27 budget: expenditures $3,469,784 (FY26 $3,239,897; +7.1%); local revenue $155,500; assessments net of surplus $3,164,284; surplus used $150,000. (PDF p. 50)
- BRSU Special Education FY27: expenditures $13,729,937 (FY26 $13,144,746; +4.5%); assessments net of surplus $4,477,688; surplus used $600,000. (PDF p. 53)
- Assessments to districts (general, after surplus): Mettawee $350,139; T&G $2,691,267; Winhall $122,878. (PDF p. 52)
The SU does not put its own budget to voters; it is embedded in member district budgets via assessments. No SU-level warehouse record written (3 districts).

## Vote results (https://www.brsu.org/o/brsu/page/election-reports, March 2026)
- Mettawee budget $6,935,806: PASSED, Yes 323 / No 166.
- T&G budget $41,042,088: PASSED, Yes 1,155 / No 422.
- Winhall budget $4,630,215: PASSED (no counts shown on the page).

## Not read / to ask the district
Not read: FY25/FY26 detail beyond the AOE form columns, line-item district budgets, treasurer/audit pages (other than BRSU summaries), Winhall town rate page, the individual prior-year reports. Ask district for any final (non-PRELIMINARY) AOE form and Winhall's vote counts. Decision needed: whether to write district-level records (ud/mettawee-84, ud/taconic-and-green-regional-63, plus Winhall's entity) from these documents instead of an SU record.
