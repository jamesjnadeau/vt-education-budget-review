> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/lamoille-south (SU026) - FY27 findings

Retrieved 2026-11-28.

## Sites
- SU: https://www.lamoillesouth.org/ (registry says https://lamoillesouth.org/, which redirects here; 200). Budget page: https://www.lamoillesouth.org/budgets
- Registry member list shows only ud/elmore-morristown-90 (web http://www.lamoillesouthsu.org/, old domain). The documents show THREE budget-setting entities: the SU (assessed to districts), Elmore-Morristown UUSD (EMUU, towns Elmore + Morristown) and Stowe School District (SSD, town Stowe; school/* entities for Stowe are registry-assigned to this SU). Registry's member count of 1 is incomplete.

## Documents found (all Google Drive, all downloadable, all < 3.4 MB)
The /budgets page lists logo-image links (no text). Seven top-level files: FY27 and FY26 index PDFs for each of LSSU, EMUU, SSD, plus the statewide "FY27 School District Budgeting Resource" (VSA/VSBA/VASBO memo, 8 pp, not a district budget; not staged). The FY27 index PDFs are one-page link lists; the real documents are their embedded hyperlinks (all 27 downloaded and read).
- SU FY27 (adopted Dec 16, 2025 per index): Budget Summary, Estimated Assessments, 12.16.25 Presentation (staged); Spending and Budget Impact, Budget Drivers, Budget Overview, DRAFT presentation (1.2 MB) (not staged).
- EMUU FY27 (vote March 3, 2026): Signed Warning (image), Public Information Meeting notice, Executive Summary, Timeline, Cost Drivers, Fast Facts, General/Capital fund, Revenues, Expenditures by Object, Budget Review presentation (staged), Information Packet (staged).
- SSD FY27 (vote March 3, 2026): same set; Write Up, Expenses, Presentation staged.
- FY26 index PDFs for the three entities were NOT downloaded (FY27 is available).
- No AOE education-spending form or "Three Prior Years Comparisons" table was found in any FY27 document, and no annual report for FY27. The 2023 annual report (https://elmorevt.org/wp-content/uploads/LSSU-Annual-Report-2023.pdf) exists but is FY24/FY25-era and was not staged.

## Staged (intake/su-lamoille-south/fy2027/, 8 PDFs + provenance.yaml)
SU: Budget Summary for Website.pdf; Estimated Assessments for Website.pdf; 12.16.25 Presentation.pdf.
EMUU: Budget Information Packet - January 13, 2026.pdf (image-only); EMUU FY27 Budget Review - January, 2026.pdf (image-only).
SSD: 01.06 Write Up.pdf; 01.06 Expenses.pdf; FY27 January 6 Presentation.pdf (image-only).
More than one per district was staged because no single document holds the budget, and each is < 3 MB.
No warehouse records: 2 member districts set their own budgets (brief rule). Collector config replaced (registry URL was the root page; budget page is /budgets).

## FY27 figures as printed (needs_decision: per district; no records written)
Figures are from district documents, not the AOE form. Their status label ("proposed", "estimated") is the district's.
| | EMUU | SSD | SU |
|---|---|---|---|
| Total budget FY27 | $19,316,076 (FY26 approved $18,467,678) | $18,344,596 (FY26 $17,762,196) | $15,821,588 (FY26 $14,872,432) |
| Offsetting revenue | $2,012,500 (FY26 $1,689,000) | $905,000 (FY26 $786,000) | $5,245,664 (FY26 $4,698,255) |
| Education spending | $17,303,576 (FY26 $16,778,678) | $17,439,596 (FY26 $16,976,196) | n/a (SU assessment $10,575,925) |
| LTWADM | 1,349.40 (FY26 1,381.80) | 1,100.30 (-0.13%) | n/a |
| Per pupil | $12,823 (FY26 $12,179 in packet; Fast Facts says FY26 $12,130) | $15,850 (+2.56%; threshold $16,470) | n/a |
| SU assessment | $5,393,721 (Assessments sheet) / $5,460,021 (EMUU expenditures-by-object) | $5,182,203 (Assessments sheet) / $5,245,903 (SSD expenses) | $10,575,925 |
| CLA (estimate) | Elmore 144.43%, Morristown 126.48% | Stowe 138.03% | |
| FY27 tax (est.) | Elmore $1.0033 ($0.9533 w/ buydown); Morristown $1.1457 ($1.0957) | Stowe $1.2498 ($1.1998) | |
Sources: EMUU packet pp. 1-3, presentation slides 13-16; SSD Write Up, Expenses, presentation slides 14-16; SU Budget Summary and Assessments (1 page each). Tax rates are district estimates from presentations; the rate tables were read from renders.
Votes: SSD budget $18,344,596 passed 567 yes / 190 no on March 3, 2026 (Stowe official results, hosted on legislature.vermont.gov: http://legislature.vt.gov/Documents/2026/Workgroups/House%20Government%20Operations/Bills/H.954/Witness%20Documents/H.954~Charles%20Safford~Official%20Results%20Annual%20Town%20and%20School%20Meeting%20-%20March%203%202026~4-8-2026.pdf; read in a search snippet only). EMUU result: not found. SU budget is not voted on by residents.

## Discrepancies (recorded, not reconciled)
1. SU expenditures: Dec 16, 2025 presentation $16,196,588 / assessment $10,950,925 (or $10,705,925 after $245,000 potential reductions) vs Budget Summary and Assessments $15,821,588 / $10,575,925. Salaries differ too ($7,139,176 vs $6,907,533). Which is the adopted budget is unclear; the index says "Adopted December 16, 2025". A news report (vtcng.com) says $16.7M (a different year or a different figure; not checked).
2. SU Assessment per district: Assessments sheet EMUU $5,393,721 + SSD $5,182,203 = $10,575,924 (printed total, $1 below the Budget Summary's $10,575,925), but the districts' own expenditure sheets show $5,460,021 (EMUU) and $5,245,903 (SSD), $130,000 more together; each is $63,700-$66,300 over the Assessments sheet.
3. SU Budget Summary FY26 column lines sum to $14,872,431 vs printed total $14,872,432 ($1).
4. SSD Expenses: lines minus $650,000 reductions sum to $18,344,545 vs printed $18,344,596 (and increase $582,350 vs $582,400).
5. SSD Fast Facts says education spending +2.6%; Write Up says +2.7% (printed $17,439,596 vs $16,976,196 = 2.73%).
6. EMUU FY26 per-pupil: packet $12,179 vs Fast Facts "$12,130" (and $12,823 - $644 = $12,179). Slide 14 says state average $26,500 / 16% less; Fast Facts says $25,606 / 13% less.
7. EMUU Expenditures-by-Object includes -$525,000 potential reductions; packet cost-drivers table shows budget $19,841,076 before reduction.
8. Stowe slide 16 footnote says "$75M Buydown"; EMUU documents and Fast Facts cite a $105M buydown.

## Not read / not done
- Signed warnings (image PDFs) and Public Information Meeting notices not read. SU "DRAFT" presentation (13 pp) only skimmed for size. Image-only presentations viewed as contact sheets; only tax and per-pupil slides read at higher resolution.
- No FY24-FY26 prior-year columns from an AOE form exist in these documents, so no approved-year data was captured. The FY26 index PDFs were not downloaded.

## Ask the district for
The AOE "Three Prior Years Comparisons" / education spending form (FY27) for EMUU and SSD, the FY27 annual report/town meeting booklet, the certified EMUU vote result, and a text version of the image-only presentations. Clarify which SU budget total ($16.2M vs $15.8M) was adopted.
