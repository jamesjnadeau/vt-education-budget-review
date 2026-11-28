> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/lincoln (Lincoln School District / Supervisory District, AOE SU070) - FINDINGS

**Site:** https://lincolnsd.org/ (budget page https://lincolnsd.org/budget-1). Registry URL is the bare home page (200, no budget links); collector config updated to the budget page.
**Members:** 0. Lincoln School District is itself the budget-setting district (K-6 Lincoln Community School; 7-12 by school choice/tuition). Warehouse records written.

## Documents found (all on lincolnsd.org, Squarespace /s/ links that redirect to static1.squarespace.com; no Content-Disposition, filename = decoded last URL segment)
| Year | Document | Size | Staged |
|---|---|---|---|
| FY27 | School pages of the Town Report (annual report, 32 PDF pages) | 2.95 MB | yes |
| FY27 | "3 Prior years.pdf" - AOE Three Prior Years Comparisons form FY24-FY27 (PRELIMINARY / ESTIMATES ONLY) | 0.52 MB | yes |
| FY27 | Draft minutes of Feb 28, 2026 annual meeting (vote result) | 0.19 MB | yes |
| FY27 | "FY27 Adopted Budget 01-13-27.pdf" (4 pages, image only; board-adopted line budget) | 3.88 MB | no - redundant with the line detail in the annual report; image-only |
| FY27 | Warning, Feb 17 slide deck, brochures (Dec 15 / Feb 10, 10.9 MB), capital plan, tax-rate statement (Drive, 3 pp.) | various | no |
| FY24-FY26 | Prior budgets, audits, FY26 3-year comparison at /prior-years-budget-info, /financial-documents | various | no (not read) |

All staged files are under intake/su-lincoln/fy2027/. Not read: brochures, slide decks, capital plan, audits, FY24/FY25/FY26 budget books, the image-only adopted budget PDF.

## Headline FY27 (AOE form, "3 Prior years.pdf" p. 1; annual report PDF pp. 12-19, 21, 24)
- Warned budget $5,407,140 (warning says $5,407,140.12; report $5,407,140.13); offsetting revenues $869,544; **education spending $4,537,596**; LTWADM 330.98; per pupil $13,709.58 (+1.89% vs FY26 $13,455.51).
- Homestead rate (form, estimate): $1.1398 (CLA 134.00%); annual report: $1.1326. District's later statement: $1.0653 (updated, not staged).
- **Vote: passed 137 yes / 17 no** (clicker vote, Article 6, Feb 28, 2026 annual meeting). Source: DRAFT minutes (unapproved), https://lincolnsd.org/s/2026-Feb-28-LSD-Minutes-DRAFT-1.pdf p. 2. Board adopted the warned budget Jan 13, 2026 (district page label).
- Records: fy2027-warned, fy2026-approved (adopted 2025-03-03 per March 2025 minutes in annual report), fy2025-approved, fy2024-approved. FY24 pupils are equalized pupils, not comparable.

## Discrepancies (also in lines_flagged, all `pending`)
- Form vs annual report FY27 homestead rate: $1.1398 (CLA 134%, discount $0.022, adjuster 72.36%) vs $1.1326 (CLA 95.15%/70.33% = 1.3529, discount $0.017). Report text says CLA 106% -> 95%; form says 146.72% (FY26) -> 134.00% (FY27).
- Budget total .12 (warning) vs .13 (report); per-pupil change 1.89% vs 1.87% (report p. 19).
- Report revenue table has an "Education Spending" line $4,468,787.29 (FY27) differing from the AOE $4,537,596.13 by the $68,808.84 State-on-behalf tech center payment.
- FY25 report total $4,927,942 vs form $4,927,940.
- All four ADM bands null (single weighted count printed).

## needs_decision
None blocking. Human should confirm which FY27 rate estimate (form $1.1398 vs report $1.1326) to treat as authoritative, and whether the DRAFT minutes suffice for vote status.

## Ask the district
Approved (final) minutes of the Feb 28, 2026 meeting; text-layer version of the FY27 adopted budget; the final FY27 AOE form.
