> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/windham-central (Windham Central Supervisory Union, SU046) - FINDINGS

Retrieved 2026-11-28. **No warehouse records written**: the SU has 5 budget-setting districts (registry lists 3 members), so per the brief figures are listed below under needs_decision.

## Site
- https://www.windhamcentral.org/ (200; registry URL is current, not stale; no collectors/config.yaml change staged). Budget pages hang off board pages: `/wred-annual-reports`, `/rvusd-annual-reports`, `/rvusd-budgets`, `/marlboro-budgets`, `/stratton-budgets`, `/windham-budgets`, `/wcsu-budget-page` (now FY28 material). Documents are Google Drive files (Uppdok-fed pages); web_extract was needed to list them (page HTML has no links).
- Registry mismatch: registry lists 3 members (River Valleys UD #73, WRVUED #72A, #72B). WRED A/B are one operating district (West River) with two AOE forms; plus Marlboro, Stratton and Windham school districts (DistrictFacts lists 6 AOE districts). So 5 budgets (6 AOE forms).

## Staged (intake/su-windham-central/fy2027/, all byte-for-byte, Content-Disposition names except Stratton)
| file | bytes | what |
|---|---|---|
| 2026 WRED Annual Report.pdf | 13,834,235 | West River annual report, AOE forms A+B pp. 25-26 (PRELIMINARY) |
| ANNUAL REPORT - River Valleys 2026.pdf | 14,239,280 | RVUSD annual report, AOE form p. 24 (PRELIMINARY) |
| WCSU assessments to school districts FY27.pdf | 84,600 | SU assessments by district |
| Summary of FY27 WCSU budgets.xlsx - Google Sheets.pdf | 111,110 | SU General Fund + MTSS budgets |
| Windham proposed budget.pdf | 125,575 | Windham SD FY27 budget sheets |
| Windham Tax Calculation.pdf | 154,916 | Windham FY27 AOE-style calc |
| FY27 Marlboro Non Operating Budget (Budget B)1-6-26.pdf | 158,024 | Marlboro expenditure budget $3,374,499 |
| School Warning 20260303.pdf | 73,613 | Stratton school warning (scanned, no text; read from render). Server sent no Content-Disposition; name is the x-cloud-object-name header |

## Not downloaded
- Marlboro 2025 Municipal Report (town report incl. school budget, tax calc, narrative): https://marlborovt.gov/wp-content/uploads/2026/01/Marlboro_2025_Vermont-Municipal-Report.pdf (old marlborovt.us URL 301s; I only saw search-snippet text, did not fetch it). Best Marlboro document; fetch it.
- Stratton 2026 Town Report (17,989,502 B, school budget probably inside): https://nebula.wsimg.com/8e2b290a2686f111d8a0cc31583dedf4?AccessKeyId=9B7F3003F1C4C4A28A0A&disposition=0&alloworigin=1 . Not downloaded (stayed within call budget); Stratton school-meeting minutes (vote result) at same town page, not read.
- Other Drive files on the district pages (RVSD FY27 draft/revised budget, narrative, Marlboro Budget A and tax calcs, Windham drafts, MTSS/General Fund budget pages) - not fetched.
- Not read: the WRED/RV annual reports beyond the budget, tax and AOE form pages (pp. 15-26 / 13-24).

## FY27 headline figures per district (needs_decision; none verified as final)
**West River MUED (A U072A + B U072B), annual report March 2026** (PDF p. 24-26; forms PRELIMINARY/ESTIMATES ONLY)
- Total budget $15,368,313 (A $7,607,315 + B $7,760,998; ties to p. 17); offsetting revenues $843,939 + $350,000 fund balance; education spending $14,174,374 (A $7,048,378, B $7,125,996); LTWADM 861.22 (428.09 + 433.13); per LTWADM $16,458.48 (A $16,464.71, B $16,452.33); excess threshold $16,470 (none over); equalized homestead rate 1.85993 (A 1.86063, B 1.85923). Per-town CLA: Brookline 152.74%, Jamaica 70.28%, Newfane 84.97%, Townshend 82.61%, Windham 136.57% (p. 24).
- Prior-year columns (A/B): ed spending FY24 6,303,947/6,372,400; FY25 7,034,825/6,878,946; FY26 6,622,912/6,849,304. FY23/24 pupils equalized, not comparable.
- **Vote history differs from this document**: first budget failed; "second budget fails" (Manchester Journal, https://www.manchesterjournal.com/news/state/second-budget-fails-in-west-river-education-district/article_1e7e8b2a-a34d-4662-acec-49890d10e6b6.html). Revote budget $15,062,158 (1.6% over FY26 $14,820,542), $300,000 reserve use, $305,497 lower WCSU assessment; warned per pupil $16,161; **passed June 17, 2026, 362 Yes / 286 No** (Brookline town site: https://brooklinevt.com/event/wred-budget-revote/ ; warning https://brooklinevt.com/wp-content/uploads/2026/06/WRED-2026-ReVote-Warning-3.0-final.pdf). So the staged annual report's $15,368,313 is NOT the adopted budget. Needs the revised AOE form/budget from the district. Flyer states $15,062,658 vs warning $15,062,158 (typo on one).
- Internal inconsistency: p. 17 narrative says per-pupil $16,865 + penalty $240.15 = $17,105 while the p. 24 calculator says $16,458.48 with $0 over threshold (p. 24 rows 5-11); Info Meeting minutes p. 15 are March 2025 (FY26, $14,820,542, $16,029.33).

**River Valleys USD #73 (Dover, Wardsboro), annual report 2026** (pp. 23-24; PRELIMINARY/ESTIMATES ONLY)
- Expenditures $6,852,208; AOE form line 9/10 offsetting revenue **$707,049** -> education spending **$6,145,159** (p. 24, 389.97 LTWADM, $15,758.0 per pupil). But the tax calculation p. 23 shows offsetting revenue **$237,049** -> net ed spending **$6,615,159**, $16,963.25/LTWADM, + $493.25 over threshold = $17,456.50, equalized homestead 1.973. Difference $470,000 (likely reserve use) is unexplained. Also FY26 column: form ed spending $6,397,169 / revenue $523,380 vs p. 23 FY26 $6,637,169 / $283,380 (diff $240,000, = the FY26 reserve offset article).
- Per-town: Dover CLA 76.28% (est. 53.65% x statewide adj), Wardsboro 112.57%; estimated rates Dover 2.586, Wardsboro 1.752 (p. 23); non-homestead 1.785.
- Prior columns: ed spending FY24 6,065,247; FY25 6,659,476; FY26 6,397,169. FY27 budget approved at the April 28, 2026 annual meeting per Reformer (~$6.85M, amended from the floor to add $18,000 for Spanish): https://www.reformer.com/local-news/dover-school-keeps-international-baccalaureate-program/article_cbbde32f-2a32-4732-879d-360e9d260cb1.html (note an $18,000 amendment would change $6,852,208; exact adopted figure not found). Warned figure and BCTV video exist (https://www.brattleborotv.org/river-valleys-unified-school-district/river-valleys-unified-school-district-annual-mtg-4-28-26/), minutes not found.
- p. 13 minutes and the Reformer/DVAL snippet about "FY26 $6,920,549" are the 2025 meeting.

**Marlboro SD** (Budget B, closed-school scenario)
- Warned/ballot Article 5: **$3,374,499**, $15,224 per pupil, 7.06% lower; Article 4 (close school) passed 311-65; Article 5 **passed 316-60** (official results ballot: https://marlborovt.us/wp-content/uploads/2026/01/RESULTS-2026-School-Meeting-Ballot.pdf ; Commons https://www.commonsnews.org/issue/855/855town_mtg_rdp). Not read in full: results PDF seen via search snippet only.
- From search snippet of town report (not staged): expenditures $3,374,499, offsetting revenues $266,515, net education spending $3,107,984.42, LTWADM 204.15 (FY26 219.73, FY25 227.05), $15,224.02.
- Discrepancy: SU-site "FY27 Marlboro Budget updated information" says LTWADM 196.45 (and "219.73 in FY25 and 227.05 in FY25") and Budget B per pupil $15,889; Budget A $3,791,494 / $17,996. Town report says 204.15 / $15,224.

**Stratton SD** (K-6 tuition, no school): Article 7 of the March 3, 2026 warning: **$1,050,583.00**, education spending $11,627.46 per pupil, +0.48% (staged warning, image read). Vote result not found (minutes link on town page, not read).

**Windham SD** (tuition): expenditures $598,130, offsetting revenues $19,800 (revenue sheet shows $8,300 local + $11,500 transport grant), education spending $578,330, LTWADM 37.9 (FY26 30.61), $15,259.37 per LTWADM; homestead 1.7244, combined with WRED B. The proposed-budget PDF's two sheets show different FY26 budget columns ($451,630 revenue sheet vs $506,398 expenditure sheet). Warned Article 5 $598,130 (BCTV https://www.brattleborotv.org/windham-town-meeting/); vote result not found. Windham students are in WRED B.

**WCSU (the SU itself)**: General Fund expense $3,270,343 / revenue $2,970,343 (+10.4%), MTSS expense $9,023,934 / revenue $8,223,934; fund balance use $100,000 + $800,000; local cost from LEAs $2,888,488 (GF) and $4,724,865 (MTSS). Assessments FY27: Marlboro $1,002,639, River Valleys $1,444,791, Stratton $170,783, West River $5,048,641, Windham $100,174. Note the GF "local cost from LEAs" FY26 shows $1,942,700 against revenue/expense that implies a different value; not reconciled. West River's lower revote budget reflects a revised SU budget (-$305,497); the staged SU documents predate that revision (FY27 SU budget adopted Nov 2025 per Manchester Journal).

## Asks of the district
- West River: final revised FY27 AOE form (post-revote, $15,062,158) and the town-level rates.
- River Valleys: adopted FY27 budget amount and a final AOE form; explanation of $707,049 vs $237,049 offsetting revenue.
- Marlboro, Stratton: annual report / town report PDFs (see above), final AOE forms; Windham: final AOE form and vote result.
- WCSU: the revised SU assessments behind the revote.
