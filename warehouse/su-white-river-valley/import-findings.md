> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/white-river-valley (SU030) — FINDINGS

**Site:** https://wrvsu.org/en-US (SchoolBlocks). Registry URL http://www.owsu.org/ is stale (host does not resolve). Collector config replaced.
**Budget docs:** home page quick link "Budgets & Audits" -> Drive folder 1FhKgUd5gZXiq8v9mtNnuciIZYnWTuf8X, one subfolder per district. The wrvsu.org /budgets page itself renders empty.

## Member districts: SIX, not four
Registry lists 4 (First Branch #82, Granville-Hancock, Rochester-Stockbridge #81, White River #79). The SU's own site and the superintendent's testimony (Jan 13, 2026) list six: those four plus **Sharon** (PreK-6) and **Strafford** (K-8, Newton School). Each sets its own budget -> **no warehouse records** staged.

## Staged (intake/su-white-river-valley/fy2027/, all FY2027, Drive downloads, filenames as sent)
| File | Bytes | AOE form (PDF p.) |
|---|---|---|
| FBUD ANNUAL REPORT & FY27 BUDGET.pdf | 21,915,397 | p.27 |
| GHUD 2026 Annual Mailer.pdf | 1,829,542 | p.15 |
| Town of Strafford & Newton School Annual Report FY27 Budget.pdf | 8,532,006 | p.43 |
| RSUD 2026 Annual Mailer.pdf | 17,936,302 | p.35 |
| Sharon Annual Report & FY27 Budget.pdf | 2,678,532 | p.26 |
| WRUD ANNUAL REPORT & FY27 BUDGET MAILER.pdf | 5,125,610 | p.40 |
All are text-based PDFs (no OCR needed). Every AOE form is stamped **PRELIMINARY / ESTIMATES ONLY** (Dec 1, 2025 Ed Fund Outlook: property yield $8,849 Windsor/Orange, $9,170 Addison; income yield $12,154). FBUD is 21.9 MB (over the 15 MB extra-doc guideline) but is the district's one document.

## needs_decision — FY27 per-district figures (AOE form, as printed)
| District | Budget | Offsetting rev | Education spending | Pupils (LTWADM) | Per pupil | Equalized rate (pre-CLA) | Vote |
|---|---|---|---|---|---|---|---|
| First Branch USD (Chelsea, Tunbridge) | $9,214,081 | $552,468 | $8,661,613 | 615.32 | $14,076.60 | 1.5908 | not found |
| Granville-Hancock USD | $2,298,502 | $24,501 | $2,274,001 | 181.53 | $12,526.86 | 1.3661 (cent-discount 1.3571) | not found |
| Rochester-Stockbridge USD | $5,536,267 | $900,366 | $4,635,901 | 353.16 | $13,126.91 | 1.4315 | doc says floor vote May 5, 2026; result not found |
| White River USD (Bethel, Royalton) | $16,358,176 | $2,134,542 | $14,223,634 | 1,109.64 | $12,818.24 | 1.4486 | approved 176-103, Mar 2, 2026 (https://vnews.com/2026/03/03/bethel-royalton-approve-school-budget/) |
| Sharon | $7,250,420 | $608,629 | $6,641,791 | 482.71 | $13,759.38 | 1.5549 (cent-discount 1.5379) | not found |
| Strafford (Newton School) | $4,596,531 | $211,673 | $4,384,858 | 298.50 | $14,689.64 | not extracted | school budget ~$4.6M approved by Australian ballot Mar 3, 2026 (https://vnews.com/2026/03/04/strafford-voters-approve-budget/); count not read |
Prior-year columns (FY24-FY26) are on each form. FY24 columns use equalized pupils (not comparable to LTWADM FY25+). Town CLAs / per-town homestead rates after CLA appear in the narrative pages of some mailers (e.g. RSUD: Rochester CLA 74.01%, Stockbridge 76.67%) — not transcribed. These are read from pdftotext; not independently re-added.

## Discrepancies / flags
- Forms are PRELIMINARY / ESTIMATES ONLY; final yields set by Legislature.
- RSUD mailer (created 2026-03-30) speaks of a "revised budget" and a May 5, 2026 floor vote; GHUD file created 2026-04-06. Possible reissued/revised versions — which budget was warned vs. voted not verified.
- Registry member count (4) vs actual (6).
- Strafford's file is the Town report + school report combined (156 pp.).

## Not found / not done
- No separate WRVSU (SU office) FY27 budget file; an SU FY27 budget section sits inside the RSUD mailer (its pp. 36-48; not read in detail). Drive also holds SU audits FY18-FY25 (not downloaded).
- Older annual reports/mailers FY18-FY26 and audits in Drive were not downloaded.
- Only White River USD and Strafford vote results found (Valley News). ourherald.com (WRVSU budgets article) returned 403.
- Did not read narrative pages beyond the AOE forms and grep hits.

## Ask the district
Certified results for all six districts' FY27 budgets (and RSUD/GHUD revote status); a standalone WRVSU FY27 budget; whether the Apr 2026 GHUD and Mar 2026 RSUD files supersede earlier mailers.
