> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/hartford (Hartford School District, SU054) findings

**Site:** https://hsdvt.com/ (registry `http://www.hsdvt.com/` is current, not stale). Budget page: https://hsdvt.com/213316_3 (archives: /213317_3). Collector config updated to point at the budget page.
**Member districts:** 1 (town of Hartford; the SU is the budget-setting district). Warehouse records allowed; no needs_decision on district split.

## Documents (all downloadable, hosted at files.smartsites.parentsquare.com/11463/, no Content-Disposition, so filename = URL last segment)
| FY | Doc | Bytes | Staged |
|---|---|---|---|
| 2027 | fy27_proposed_budget_packet.pdf (14 pp, scanned, noisy OCR) | 1,499,556 | yes |
| 2027 | 2026_school_dist_warnings_both.pdf (warning, image only) | 753,400 | yes |
| 2027 | 2026_official_school_dist_results.pdf (certificate of results, image only) | 635,415 | yes |
Not downloaded: per-school budgets (dbs/oqs/wrs/hmms/hhs_by_function_object_fy27.pdf), town warnings/ballots, "Taxes in Hartford" presentation (1-19-26), 2024 Town and School Annual Report on hartford-vt.org (FY26 warning; https://hartford-vt.org/DocumentCenter/View/12050), FY25 audit (hsdvt.com/uploads/AnnualReports/Hartford%20SD%20FS25%20Final.pdf). Not needed; there is no AOE "Three Prior Years Comparisons" form in the packet, just the district's own education tax form (p. 11).

## Headline FY27 (packet; pp. 2, 11)
- Total expenditure budget (all funds) $58,707,341; revenues w/o state ed tax $21,589,444; **education spending $37,117,897** (re-adds); LTWADM 2,099.67; $17,677.97 per weighted pupil (matches warning); homestead rate $1.3924; non-homestead $1.2669; CLA 140.89%.
- FY26 col: $55,095,949 budget, $34,513,512 ed spending, 2,152.34 pupils, $16,035.34, rate $1.2590, CLA 142.92%.
- FY25 col: $47,607,131 budget, $29,464,131 ed spending, 2,117.40 pupils, $13,915.24, rate $2.0585, CLA 66.31%.
- **Vote:** March 3, 2026, Article 2 PASSED, Yes 763 / No 542 (certificate of results attested 4 Mar 2026).

## Discrepancies / needs a human
- FY25 column: line 2 - line 3 = 27,853,257, but line 4 prints 29,464,131 (diff 1,610,874); per-pupil agrees with line 4. FY25 is not labelled adopted (p. 2 calls FY2025 ACTUAL: $49,847,433 expenditure, $49,102,786 revenue); the 2024 annual report snippet put $52,431,376 to voters for FY25. fy2025-approved.yaml status is the brief default; confirm.
- CLA swing 66.31% (FY25) -> 142.92% (FY26) -> 140.89% (FY27) recorded as printed.
- FY27 rate arithmetic (line 6 / $8,849 yield - .036) / CLA not independently reproduced to 1.3924.
- FY27 record is `warned` (source is the pre-vote packet) even though the vote passed; adopted_date null because the packet states no vote date (certificate: 2026-03-03). Lead may upgrade.
- ADM bands left null (only the weighted count is printed; p. 10 has a FY2026 headcount table, 1,515, not transcribed).

## Did not read
Pages 3-9 and 12-14 of the packet (function/object summaries, revenue detail, scholarship funds) were not read line by line; only page 2 and the p. 10-11 pages were read from images. Nothing in the packet is stamped preliminary/estimate on p. 11.

## Ask the district
A clean text PDF of the packet and the AOE Three Prior Years Comparisons form; confirmation of what the FY25 column on p. 11 represents.
