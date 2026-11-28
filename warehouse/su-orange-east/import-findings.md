> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/orange-east (Orange East Supervisory Union, SU027) - FINDINGS

Retrieved 2026-11-28. FY27 (2026-27) documents found and staged under `intake/su-orange-east/fy2027/`.

## Sites
- SU site: https://www.oesu.org/ (registry URL OK, but home page has no documents). Finance: https://www.oesu.org/about-us/finance ; Budgets: https://www.oesu.org/about-us/finance/budgets-audit-reports
- District board pages (each links Budgets / Reports Google Drive folders): Blue Mountain https://www.oesu.org/fs/pages/359 ; Oxbow https://www.oesu.org/fs/pages/714 ; Thetford https://www.oesu.org/fs/pages/712 ; Waits River Valley https://www.oesu.org/fs/pages/713
- Registry mismatch: registry lists 3 member districts (Blue Mountain 21, Oxbow 91, Waits River Union High District 36). The SU's own pages list **4 budget-setting districts**: Blue Mountain Union, Oxbow Unified Union, **Thetford Town School District** (not in the registry's member list, one town: Thetford), Waits River Valley (Unified #36 Elementary). Registry `web` for bmu is bmuschool.org, wrv is wrvschool.org (not checked; the budgets are on oesu.org). Collector config updated.

## Documents staged (all downloaded from Google Drive, direct URLs in provenance.yaml; all < 15 MB)
| file | bytes | what |
|---|---|---|
| 2026 BMU Annual Report.pdf | 2,741,891 | BMU annual report, FY27 original warned budget; AOE form p18, worksheet p16 |
| 2026 OUUSD Annual Report.pdf | 6,595,969 | OUUSD annual report, AOE form p20, worksheet p19 |
| 2026 TTSD Annual Report.pdf | 1,737,455 | Thetford annual report; comparison p10, tax rate estimate p11 (no AOE form) |
| 2025-2026 WRVS Annual Report.pdf | 14,932,178 | WRV annual report for May 4 2026 meeting (proposes FY27); AOE form p27, worksheet p28 |
| FY27 TTSD 3 Year Prior Tax Ed Spending Comparisons by AOE.pdf | 517,205 | Thetford AOE form |
| FY27 Revised Budget Snapshot.pdf | 485,941 | BMU revised budget for the March 25 revote |
| 2026 BMU 2nd Budget Vote Results.pdf | 144,800 | scanned tally, image only |
| Town of Thetford Local Election 3March2026.pdf | 34,589 | scanned results, image only |
| FY27 OESU Budget.pdf | 454,583 | SU central-office expense budget |

Not downloaded (available in the same Drive folders): district Budget sub-folders (OUUSD detail by school, tax worksheets, LTWADM files; TTSD proposed/detailed budget; WRVS budget summary / "FY27 WRVS Three Year Comparision.pdf"), "1st Budget Vote" sub-folders, BMU "FY27 Tax Worksheet for Re-Vote", OUUSD revote warning/minutes/flyer, OESU assessment PDFs, older annual reports (BMU 2019-2025, OUUSD 2022-2025, TTSD 2021-2025, WRVS 2021-2025), audits, FY28 first drafts. No Issuu/flipbook-only documents.

## Headline FY27 figures, per district (AOE form figures as printed; all AOE forms are PRELIMINARY / ESTIMATES ONLY)
| district | warned budget | offsetting revenue | education spending | pupils (LTWADM) | per pupil | equalized homestead rate |
|---|---|---|---|---|---|---|
| Blue Mountain (BMU) - Groton, Ryegate, Wells River | $12,856,291 (orig.) | $858,918 | $11,997,374 | 749.67 | $16,003.54 | $1.8085 |
| Oxbow UUSD - Bradford(-id), Newbury | $23,339,333 (orig.) | $5,473,287 | $17,866,046 | 1,157.26 | $15,438.23 (form line 13); $15,410.35 net of $27.88 debt exclusion (line 25) | $1.7415 |
| Thetford TSD - Thetford | $11,203,688 | $728,500 | $10,475,188 | 563.62 | $18,535.00 (form); annual report p11 shows $18,586 gross, $18,535 net of $50.59 construction debt | $2.3279 (form line 27; annual report p11 shows $2.0462 before a $2,065/pupil excess-spending penalty line) |
| Waits River Valley - Corinth, Topsham | $10,065,244 | $405,800 | $9,659,444 | 774.25 | $12,475.87 | $1.4099 |

Page refs: BMU PDF p16/p18; OUUSD p19/p20; Thetford AOE PDF p1, annual report p10-11; WRV p27 (printed 25) / p28. Prior-year columns (FY24-FY26) are on the same forms; not transcribed (no warehouse records, see below).
FY27 OESU central budget (expenses only): total general fund $13,864,650.88 vs FY26 $12,193,327.56 (+13.71%); central admin $2,429,903.65; special ed & ECSE $10,365,632.53 (p1-3).

## Vote results (FY27)
- BMU: original budget; first-vote result not read (the Drive "1st Budget Vote" folder was not opened). Revised budget ($12,756,291) revote March 25, 2026: yes 319, no 317, blank/spoiled 1 (clerk tally in staged PDF, p1 only read); also OESU newsletter https://app.smore.com/n/59jba-orange-east-supervisory-union says it passed 319-317.
- Thetford: March 3, 2026 "School Article IV School Budget" yes 271, no 123, blank 3 (staged scan; article amount not printed on sheet, assumed to be the $11,203,688 budget - verify).
- Oxbow: original $23,339,333 REJECTED April 28 2026, 145-119 (https://vnews.com/2026/04/29/oxbow-voters-reject-budget/ , https://jonews.com/bradford-newbury-to-vote-on-school-budget). Reduced budget (amended to restore $300,000 cut) approved June 16 2026, 205-141 (https://vnews.com/2026/06/17/oxbow-school-budget-approved); final dollar amount not read. Newspaper sources, not district documents.
- Waits River Valley: approved May 4 2026 per OESU newsletter https://app.smore.com/n/x3t19-orange-east-supervisory-union (no counts found).

## Discrepancies / flags
- BMU annual report: revenues $858,918; revised snapshot says $858,185 in revenues (original budget column). Education spending $11,997,374 on form vs 12,856,291 - 858,918 = 11,997,373 ($1 rounding). Snapshot cost per weighted pupil $15,871.12 for the revised budget (recomputes: (12,756,291-858,185)/749.67). BMU p18 AOE text layer is overlaid/jumbled; figures cross-checked to p16.
- OUUSD: form line 13 $15,438.23 vs line 25 $15,410.35 (debt exclusion). Annual report minutes p15 print prior-year articles (FY26 $21,454,611, $13,151.64/pupil) - old.
- Thetford: AOE form line 13 is $18,535.00 while the annual report's gross figure is $18,586; form revenue $728,500 matches the annual report receipts + surplus. Thetford AOE form revenues for FY24 ($59,634) differ from the annual report FY23-24 column ($127,634 + $50,000), so FY24 education spending is $9,278,115 (form) vs $9,160,114 (annual report): not reconciled.
- WRV: title says 2025-2026 but content is the FY27 proposal; FY27 pupil row labeled "Equalized Pupils/LTWADM".
- Statewide yields are Dec 2025 estimates; final rates differ.

## needs_decision
- 4 districts set their own budgets (registry lists 3) -> NO warehouse records written. Per-district figures above. Decide how Thetford (not in registry SU member list) and the SU assessment budget should be modeled; how to record BMU/Oxbow revotes (different budget amounts from the annual-report versions, with different statuses: rejected/revised/approved).

## Ask the district for
- Final adopted FY27 amounts for BMU (revised), Oxbow (June 16 version) with revised AOE forms / tax worksheets; WRV and Thetford certified vote counts; whether the "FY27 WRVS Three Year Comparision.pdf" is a later version than the annual report's.

## Not read
Pages of the annual reports outside the budget/AOE/worksheet pages; BMU tally page 2; all non-downloaded Drive files; prior-year columns were not transcribed.
