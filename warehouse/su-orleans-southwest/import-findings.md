> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/orleans-southwest (SU035) - FINDINGS

**Site:** https://www.ossu.org/ (registry `http://www.ossu.org/` 301/307s to `https://www.ossu.org/en-US`; works, but it is only the homepage).
Budget pages: https://www.ossu.org/en-US/budgets-reports/budgets (FY23-FY27 per district) and
https://www.ossu.org/en-US/budgets-reports/annual-reports (2022-2026 per district). Vote results: https://www.ossu.org/en-US/annual-school-district-meeting-warnings
Collector config updated (staged) to point at those pages. Registry lists 2 member districts; the SU actually has **5** that each set their own budget
(Craftsbury, Hazen Union, Mountain View Union, Stannard, Wolcott; confirmed by the 2026 annual reports and Annie Houston's 2026-04-30 legislative testimony).
=> **No warehouse records written** (2+ budget-setting districts). All documents are Google Drive PDFs with a text layer, all downloaded.

## Staged (intake/su-orleans-southwest/fy2027/, all from drive.google.com/uc?export=download, filenames from Content-Disposition)
| file | bytes |
|---|---|
| OSSU Annual Report 2026-Web-FINAL.pdf (SU's own; 27 pp.) | 10,595,390 |
| FY27 OSSU Budget - Website.pdf (SU line items; 10 pp.) | 860,760 |
| Craftsbury Annual Report-2026-Web-FINAL.pdf | 17,046,346 |
| Hazen Annual Report-2026-Web-FINAL.pdf | 19,402,642 |
| MVU Annual Report 2026-Web-FINAL.pdf | 16,654,595 |
| Stannard Annual Report 2026-Web-FINAL.pdf | 21,424,032 |
| Wolcott Annual Report-2026-Web-FINAL.pdf | 17,615,060 |

Not downloaded: the FY23-FY26 budgets/annual reports, per-district FY27 "Budget" files (Drive, same page), warnings, audit reports.
I did not read the OSSU treasurer/grants/compensation pages, nor any page of the district reports beyond the AOE form and tax-impact summary.

## needs_decision: per-district FY27 figures (AOE form "Three Prior Years Comparisons", all stamped PRELIMINARY / ESTIMATES ONLY; LTWADM for FY25-27)
| district | AOE form pg | budget | revenue | education spending | LTWADM | per pupil | FY26 ed. spending |
|---|---|---|---|---|---|---|---|
| Craftsbury (T055) | 29 | 6,368,638 | 682,324 | 5,686,314 | 357.10 | 15,923.59 | 5,269,535 |
| Hazen Union (U026) | 20 | 9,178,952 | 786,838 | 8,392,114 | 524.79 | 15,991.38 | 8,158,555 |
| Mountain View Union (U094) | 22 | 9,173,292 | 108,401 | 9,064,891 | 548.53 | 16,525.79 | 8,458,750 (form) / 8,458,751 (p.20 summary) |
| Stannard (T195) | 15 | 275,354 (summary p.13: 275,353.50) | 25,064 | 250,290 | 15.89 | 15,751.38 | 223,184 |
| Wolcott (T250) | 20 | 6,364,330 | 158,137 | 6,206,193 | 431.52 | 14,382.17 | 5,926,711 |

Decision needed: confirm member districts are modelled as separate `ud/*` / `town/*` entities (registry shows only Hazen Union and MVU as members; Craftsbury, Stannard, Wolcott are town school districts) and which entity each of these records belongs to. Per-town rates are in each form (Hazen: Greensboro/Hardwick/Woodbury prorated 1.1661/0.8909/0.7922; MVU: Greensboro/Hardwick/Stannard/Woodbury 0.6624/0.9468/1.1285/1.0488) - not transcribed.

## Vote results (https://www.ossu.org/en-US/annual-school-district-meeting-warnings)
- Mar 3, 2026: Craftsbury passed 101-29; Hazen Union passed 396-352; Stannard 7-12 passed unanimously from the floor; **MVU failed 377-389; Wolcott failed 108-143**.
- Apr 7 revote: MVU failed 282-315; Wolcott failed 121-149. May 20 revote: **MVU passed 361-251; Wolcott passed 165-158 (unofficial)**.
- The staged MVU ($9,173,292) and Wolcott ($6,364,330) annual reports are the FIRST-vote budgets and do not mention the revotes. Legislative testimony (legislature.vermont.gov, W~Annie Houston~Written Testimony~4-30-2026.pdf) lists the pending May-20 budgets as MVU $9,065,204 and Wolcott $6,298,447 - lower than the reports. Adopted revote budgets are not in staged documents; ask the district for the revote warning/budget (Drive links on the warnings page, "Warning - Vote on May 20").

## OSSU (SU) own budget (FY27 proposed)
Total $13,634,768.71 = assessment $12,663,731.52 (+3.00%) + purchased services $971,037.18; SU assessment revenue $8,894,280; ("FY27 OSSU Budget - Website.pdf" Revenue Budget sheet and Grand Total lines).

## Discrepancies noted
- OSSU AR p.9 says "FY26 assessments to districts total $8,894,280, an increase of $643,799"; the budget file shows $8,894,280 is the FY27 proposed assessment (FY26 budget $8,250,481). Likely a stale label.
- MVU FY26 education spending: $8,458,750 on the AOE form vs $8,458,751 in the tax-impact summary (rounding).
- Wolcott FY26 per-pupil: form p.20 $13,381.30 vs summary p.18 $13,415.33.
- Stannard FY26 per pupil $15,750.46 (form) vs $15,750.45 (summary).

## Ask the district for
Revote (May 20) budget documents for MVU and Wolcott; confirmation of final adopted FY27 education spending per district.
