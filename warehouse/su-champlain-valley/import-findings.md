> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/champlain-valley (Champlain Valley School District, AOE SU014 / UD U056)

**Site:** https://www.cvsdvt.org (budget: /budget-district/budget-home; annual report: /budget-district/fy27-annual-report).
**Registry mismatch:** registry/collector URL http://www.cssu.org is the old SU domain; it did not respond on 2026-11-28. Collector config replaced. Member count 1 (Champlain Valley USD #56, towns Charlotte, Hinesburg, Shelburne, St. George, Williston), so warehouse records are written.

## Documents
| Year | Type | URL | Size | Staged |
|---|---|---|---|---|
| FY27 | Full annual report (170 pp, text layer) | https://drive.google.com/uc?export=download&id=1x6ASsbzUEkxYrR82c2YfAveU0sCigFeN | 33.7 MB | yes, `FY27 Annual Report - FULL PDF.pdf` |
| FY27 | Three Prior Years form alone ("23.FY27 3yr prior CVSD.pdf", 1 p) | drive id 1nW0GaYCTBldovBell77khtiSvk_GGV2K | 0.5 MB | no, identical to p. 31 of the full report |
| FY27 | Budget book ("FY27 Budget Book - FIN.pdf", 8 pp) | drive id 1p-AMs7IbJTOg3Y17Fcu6vSz2f4-uby4M | 25.2 MB | no, over the 15 MB add-on limit; only file-level info read |
| FY27 | Proposed Budget and Tax Implications (2 pp) | drive id 1YZIdie2Fd16OQfAMwsOvE3O17Zh36nC9 | 0.8 MB | no, duplicates the report's pp. 27/61-62 |
| FY27 | Budget presentations, revenue/expense summaries, warning, tuition rates | linked from the annual report page | not fetched | no |
| FY22-FY26 | Older annual reports | /fs/pages/2092, 2430, 2082, 2086; FY22 on Drive | not fetched | no |

## Headline FY27 figures (warned; AOE form p. 31, PRELIMINARY / ESTIMATES ONLY)
- Budget $107,860,285 (matches warning Art. VII); offsetting revenue $16,485,405 (p. 28; incl. $1,000,000 fund balance); education spending $91,374,880; LTWADM 5,724.51; per pupil $15,962.04; equalized rate $1.8038, or $1.6588 after the $0.145 cent discount.
- Town rates after CLA (pp. 27, 61-62): Charlotte $1.43 (116%), Hinesburg $1.09 (153%), Shelburne $2.15 (77%), St. George $2.10 (79%), Williston $2.03 (82%).
- Vote: passed 4,085-2,210 across the five towns, per the Hinesburg Record (https://www.hinesburgrecord.org/p/voters-approve-municipal-budgets, 2026-03-04). This is a newspaper, not a district or town page, so adopted_date stays null. Not confirmed on a district or town page.
- Records written: FY27 warned, FY26/FY25/FY24 approved (prior-year columns). FY24 pupils are equalized pupils, not comparable.

## Discrepancies (flagged in records, not reconciled)
- FY26 cost per weighted pupil: p. 27 prints $15,532, the AOE form prints $15,535.13.
- FY26 income cap: 2.55% on the form line vs 2.36% in the per-town table.
- Printed FY27 town rates are rounded; $1.66 / printed whole-percent CLAs gives Hinesburg $1.08 and Williston $2.02, versus printed $1.09 and $2.03.
- Form is marked PRELIMINARY / ESTIMATES ONLY (Dec 1, 2025 outlook); auditor's reports "not yet available".

## Not done / not read
- Grade-band ADM is not printed; the enrollment component was not read (adm left null, flagged).
- FY24/FY25 per-town rates and CLAs are not printed (left null, flagged).
- Budget book (25 MB) and the line-item function sections were not analysed. The text layer exists, so a later pass could add line-item records.
- Per-town vote counts do not exist (commingled ballots, per the district FAQ).

## needs_decision
None; single-district SU, so records written.
