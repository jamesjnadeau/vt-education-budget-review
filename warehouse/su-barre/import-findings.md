> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/barre (Barre Unified Union School District, AOE SU061) - FINDINGS

Retrieved 2026-11-28. Member district count 1; records written for the SU itself.

## Sites
- Registry URL http://bsuvt.org/ -> 301 -> https://www.buusd.org/ (current site). Budget page: https://www.buusd.org/budget. Collector config updated (staged).

## Status of FY27 (important)
- FY27 budget failed 3 times (Mar 3, May 12, Sept 15, 2026), then the 4th version ($56,621,592) was on the Nov 3, 2026 ballot.
- The district site (home, budget page) does NOT state the Nov 3 result as of retrieval. Free press reports say APPROVED, 2,872-1,665 (Barre City 1,287-773; Barre Town 1,599-1,263): wcax.com/2026/11/04/barre-residents-approve-566-million-school-budget/ ; vtdigger.org/2026/11/04/barre-voters-approve-school-district-budget-on-4th-attempt/ ; thebridgevt.org/2026/11/barre-school-district-looks-ahead-after-voters-approve-budget/. Not independently verified from town clerk pages.
- Vote 4 slides say (p. 15) BUUSD was the only budget in the state not yet passed.

## Documents found (all on https://www.buusd.org/budget, via /fs/resource-manager/view/<uuid> -> finalsite PDF)
Staged in intake/su-barre/fy2027/ (all < 1 MB):
- FY27 Budget Summary Revenues 2-17-26 (60 KB) - record source
- FY27 Budget Summary Expenses 2-17-26 (88 KB)
- Warning, March 3 2026 vote (566 KB): $57,829,257
- Warning, Nov 3 2026 vote (149 KB): $56,621,592
- Vote 4 slides (416 KB): history of all four votes, per-pupil, estimated rates
Found, NOT staged:
- FY27 Budget Detail 2-17-26 (Tyler line items, 68 pp, 21,750,440 bytes) - over 15 MB second-doc limit. Text-searched only; no AOE form.
- FY27 Budget Mailer (3.9 MB) and Feb 2026 informational slides (5.8 MB): redundant with staged items (same $57,829,257 figures; mailer has estimated rates BC 1.457 / BT 1.428).
- Warnings for May 12 and Sept 15, 2026 revotes ($57.1M version at Sept), Sept 8 and Oct 27 presentations, FY26/FY25 packets, 2022 annual report: listed on page, not downloaded.
- FY25 audit (BUUSDFS25Final.pdf) on finalsite, not downloaded.
- No FY27 annual report and no AOE "Three Prior Years Comparisons" / Act 130 form for FY27 is linked by the district. This is the main gap: ask the district (or Barre City/Town annual reports) for it. Not found at all, so education spending and per-town rates/CLAs for the approved $56.6M budget are unavailable.

## Records (warehouse/su-barre)
- fy2027-warned: education spending $45,501,740 = the 'EDUCATION SPENDING' line on the revenue summary for the March-vote budget ($57,829,257; revenue lines re-added, sum matches). NOT the AOE form figure. Superseded by later versions. Status warned (not approved) per instruction; approved version is $56,621,592 whose education spending is not printed anywhere staged.
- fy2026-approved: $43,239,188 (same sheet, FY26 column). fy2025-approved: $40,871,402. FY24 column is actuals; no record.
- ADM bands and per-town rates/CLA null with left_null flags (rates for BC/BT appear only as estimates in mailer/slides).

## Headline figures
- Ballot per-pupil: Mar $12,982 (+13.12%); May $12,748; Sept $12,648; Nov $12,503 (+8.95%). LTWADM dropped ~262-263 weighted pupils; the count itself is not printed.
- Budgets: FY26 $55,949,143; Mar $57,829,257 (+3.36%); Sept $57,129,257 (+2.11%); Nov $56,621,592 (+1.20%, +$672,449).
- Vote 4 slide est. rates FY27: Barre City $0.928, Barre Town $1.294 (Barre City reappraisal, CLA change 48.74%).

## Discrepancies / human decisions
- Slide deck says Vote One 'March 5, 2026'; warning says March 3. Slide 'FY27v3' label on the Vote 4 page.
- Revenue and expense workbooks carry internal title 'January 9, 2025' and page heading '12-15-25' though filed 2-17-26.
- Decide whether to record the Nov 3 approval (needs the education spending figure from a district source) and whether the 'EDUCATION SPENDING' revenue line is acceptable as education_spending.
