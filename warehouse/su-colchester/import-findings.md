> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/colchester (Colchester Supervisory District, SU007) — FY2027

**Site:** https://www.csdvt.org/ (budget page https://www.csdvt.org/district/schoolboard/budget.php)
**Registry URL:** csdvt.org root, still valid; replaced in collectors config by the budget page. The page now shows the FY28 cycle (vote March 2, 2027), so FY27 links are no longer on it; the FY27 PDFs are still served under `/district/schoolboard/budget/FY27/BudgetBook/` (found by web search).

## Staged (intake/su-colchester/fy2027/, all byte-for-byte, http-fetch 2026-11-28, no Content-Disposition so names = URL basenames)
| File | Bytes | What |
|---|---|---|
| FY27 Four Year Comparison.pdf | 199,005 | AOE "Three Prior Years Comparisons", FY24-FY27, PRELIMINARY / ESTIMATES ONLY, text layer. Source of all records. |
| FY'27 Tax Rate Calculation.pdf | 158,351 | FY27 homestead/non-residential rate sheet |
| Executive Summary FY'27 Budget.pdf | 81,355 | Board narrative + function table |
| 2026community.pdf | 2,030,291 | Annual report to the community (12 pp). No AOE form in it. |
| Voting Record History.pdf | 65,946 | Vote results 1994-Mar 2026 |

Not downloaded: FY27 budget presentations (Nov 18, Jan 6, 13, 20), revenue/expense line-item PDFs, warning. Not read in full. Not needed for the records; the line-item budget-by-account PDFs would be the best second document if wanted.

## Headline FY27 (Four Year Comparison, PDF p. 1; ties to Tax Rate Calculation sheet)
- Budget $70,167,602 (+8.13%, board-approved Jan 20, 2026); offsetting revenues $13,573,501; education spending $56,594,101
- LTWADM 3,593.90; per pupil $15,747.27 (FY26 $14,382.44); equalized homestead rate $1.7094, $1.6414 after $0.0680 cent discount; actual homestead rate $1.0494 on the form / $1.0495 on the rate sheet (CLA 156.41%) vs FY26 $1.8634
- Vote: March 3, 2026, yes 1,216 / no 1,083 (52.89%), PASSED — Voting Record History (district). No certified-results page checked.
- Re-added every column: budget - revenue = education spending; spending / pupils = per pupil (all four years tie).

## Records written (SU has 0 member districts; town/colchester is the sole town)
warehouse/su-colchester/fy2027-warned, fy2026-approved, fy2025-approved, fy2024-approved. All ADM bands null (form prints one pupil count) and flagged left_null. adopted_date null (form does not state it; vote dates are in notes from the voting record). FY24 pupils are equalized pupils, not comparable with LTWADM.

## Discrepancies (flagged, not reconciled)
1. FY27 yield: form header and line 27 use $9,212; the form's own bottom note and the district's Jan 2026 slides say $8,849.
2. FY27 actual rate: $1.0494 (form line 33) vs $1.0495 (rate sheet, annual report).
3. FY25 budget: form $57,425,957 vs voting record $57,495,907 (diff $69,950).
4. FY24: line 13 per pupil $17,932.20 vs line 25 $12,818 (same as FY25).
5. FY26 income cap line 34 2.36% vs line 35 2.27%.
6. Line 12 label stale ("LTWADM FY25-FY26"); FY27 column is LTWADM. Line 32 CLA basis differs: FY24-26 are CLA / statewide adjuster, FY27 is plain CLA.
7. Form is PRELIMINARY / ESTIMATES ONLY; the district's earlier slides show $16,042 per pupil before $1,077,007 of reductions.

## Needs a human decision
None required. Optional: ask the district for the final (non-"PRELIMINARY") AOE form and the certified FY27 vote result; the voting record is a district table, not certified results.
