> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/franklin-west — Franklin West Supervisory Union (AOE SU022) — FINDINGS (retrieved 2026-11-28)

## Sites
- Current site: https://www.fwsu.org/ (Apptegy). Budget page: https://www.fwsu.org/page/budget-info
- Registry URL http://www.franklinwestsu.org/ is STALE: returns HTTP 502 Bad Gateway. Staged `collectors/config.yaml` replaces it with fwsu.org.
- Registry lists 0 member towns on the SU; the school/town registry rows put Fairfax, Fletcher and Georgia in the SU. Documents confirm **3 member districts that each set their own budget** (Fairfax Town SD / BFA, Fletcher Town SD / FES, Georgia Town SD / GEMS), plus the SU's own assessed budget. => **No warehouse records written.**

## Documents found (FY27, 2026-27)
Budget page is an accordion; links only appear in the embedded page JSON. All are `aptg.co/<code>` short links redirecting to PDFs on files-backend.assets.thrillshare.com (no Content-Disposition; filename = last URL path segment).
| Doc | Size | Staged |
|---|---|---|
| Georgia FY27 Budget Guide (first attempt) `78765_FWSU_AnnualBudget-Georgia_PROOF-(1).pdf` | 6.7 MB | yes |
| Fairfax FY27 Budget Guide `78786_FWSU_AnnualBudget-Fairfax_lowrezPROOF.pdf` | 10.4 MB | yes |
| Fletcher FY27 Budget Guide `78768_FWSU_AnnualBudget-Fletcher_PROOF.pdf` | 7.8 MB | yes |
| FWSU (SU) FY27 Proposed Budget `FY27-FWSU-Proposed-Budget.pdf` | 249 KB | yes |
| Georgia 2nd-attempt (revote) budget `FY27-Georgia-...-2nd-Budget-Attempt---Google-Sheets.pdf` | 294 KB | yes |
Not staged (small, available, not needed or image-only): Georgia revote warning (doc00864520260316115531.pdf), Georgia revote tax impact sheet, Georgia/Fairfax/Fletcher FY27 warnings, Georgia/Fairfax/Fletcher board-approved line-item budgets (Jan 2026), Fairfax sample ballot, "Budget Context" / "DRAFT FY27" decks, Google Slides presentations (not downloadable originals), FY21–FY26 budgets and warnings per district (FY24 on core-docs.s3.amazonaws.com; FY25/FY26 mostly Drive). Also FWSU AOE Report Card (Drive, not a budget).
None of the staged documents is the AOE education-spending form / "Three Prior Years Comparisons" table; the Georgia FY25 "Three Prior Years Comparison - AOE" Drive file exists on the page for FY25 only. Ask the district for the FY27 Three Prior Years Comparisons forms (and the Fairfax/Fletcher warnings).

## needs_decision (multi-district SU: figures per district, as printed in the budget guides)
All three guides print FY26 and FY27 columns; pupil counts = LTWADM and match the AOE FY27 LTWADM file (Fairfax 1,369.37; Fletcher 348.42; Georgia 1,163.42; SU total 2,881.21).
| | Fairfax (guide p.3) | Fletcher (guide p.3) | Georgia first attempt (guide p.3) | Georgia revote (tax-impact sheet / warning) |
|---|---|---|---|---|
| Total expenditures FY27 | $22,822,478 | $4,861,727 | $18,869,484 | $18,741,372 |
| Offsetting revenues | $3,160,500 | $412,000 | $452,500 | $452,500 |
| Education spending | $19,661,978 | $4,449,727 | $18,416,984 | $18,288,872 |
| Pupil count (LTWADM) | 1,369.37 | 348.42 | 1,163.42 | 1,163.42 |
| Ed spending per pupil | $14,358.41 (-1.08%) | $12,771.16 (+3.81%) | $15,830.04 (+6.77%) | $15,719.92 (+6.03%) |
| Property yield | $8,849 | $8,849 | $8,849 | $9,373 |
| Equalized homestead rate | 1.6226 | 1.4432 | 1.7889 | 1.6771 |
| CLA | 107.37% | 126.33% | 83.72% | 83.72% |
| Actual homestead rate | 1.4004 | 1.1424 | 2.0041 | 1.8706 |
FY26 column (as printed): Fairfax $21,338,038 exp / $17,874,638 ed spending / 1,231.45 pupils / $14,515.11; Fletcher $4,665,053 / $4,357,957 / 354.22 / $12,302.97; Georgia $18,405,403 / $17,799,256 / 1,200.54 / $14,826.04.
SU budget (FWSU proposed, Dec 17 2025): expenditures $16,761,043; general fund revenues $16,761,434 (printed totals differ by $391); funded by assessments to member districts.
Decision for the lead: whether to model the three member districts as separate entities (ud/town) rather than su/franklin-west; no record was written here.

## Discrepancies / flags
- Georgia revote budget PDF: every page header says "FY27 Board Approved Budget 1/6/2026" (stale from the first attempt), but its totals ($18,741,372) are the revote's, confirmed by the revote warning (Article 1 $18,741,372; per pupil $15,719.92, "6.03% higher") and tax-impact sheet.
- Georgia tax-impact sheet (revote) home-value table headers read "FY25 Est / FY26 Est" (stale template); the figures are FY26 vs FY27. Not staged.
- Georgia revote tax-impact sheet shows ed spending per pupil +6.03% and the warning says 6.03%; consistent. (Georgia first-attempt guide: 6.77%.)
- SU budget: link labelled "Approved FY27 SU Budget" on the page but the document says "FY27 Proposed Budget"; expenditures and revenues totals differ by $391.
- Fairfax guide: text layer garbled; Fletcher guide: image-only. Both read from 110-dpi renders of p.3 and re-checked (ed spending / pupils reproduces printed per-pupil).
- Not read: pages 1, 2, 4, 5 of the Fairfax and Fletcher guides (articles/amount per warning, enrollment, school-choice tables); Georgia guide read in full via text layer; SU budget read only pp. 1–2 of 9; Georgia revote budget read pp. 1–4 (summary + detail), rest unread.

## Vote results (FY27)
- Georgia: original $18,869,484 budget FAILED on Town Meeting Day (March 3, 2026); revised budget passed the March 31, 2026 revote, 438 yes – 386 no. Sources: https://www.mynbc5.com/article/georgia-vermont-school-budget-vote/70904740 and https://www.samessenger.com/news/schools/georgia-voters-approve-gems-budget-during-re-vote/article_ee22a777-0c46-4f13-9fc2-ec582da8666b.html (newspaper/TV, not district source; the mynbc5 snippet says the board cut about $100,000, while the district's own figures show a ~$128,112 reduction). Not independently verified against the town clerk.
- Fairfax FY27 and Fletcher FY27: result not found. (Search returns only FY26 results for Fairfax: failed March 2025, passed April 8 2025 revote.)

## Not done
- No warehouse records (3 budget-setting districts). No FY26 or earlier documents downloaded. No Google Slides/Docs fetched.
