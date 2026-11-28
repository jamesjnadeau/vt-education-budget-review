> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/maple-run (SU023, Maple Run Supervisory District) — findings, 2026-11-28

## Sites
- District site: https://www.maplerun.org (Maple Run Unified School District #57; towns St. Albans City, St. Albans Town, Fairfield).
- Annual reports page: https://www.maplerun.org/documents/notices-%26-reports/annual-reports/34988 (old `/o/mrusd/browse/34988` 301-redirects there).
- **Registry mismatch:** registry/collector URL http://www.fcsuvt.org/ (old Franklin Central SU) gave no response. Collector config replaced in `collectors/config.yaml`. Registry `ud/maple-run-57` website also points at fcsuvt.org.
- Member districts: 1 (MRUSD #57; the documents show a single union district budget covering all three towns). Warehouse records written.

## Documents found
| Year | Document | Size | URL path | Staged? |
|---|---|---|---|---|
| FY27 (2026) | 2026 MRUSD Annual Report | 28.1 MB (29,482,563 B) | files-backend.assets.thrillshare.com/.../MRUSD-2025-2026-Annual-Report-.pdf | **yes** (fy2027) |
| FY27 | Notice of Availability 2026 | 174 KB | .../2026-Annual-Report-Notice-of-Availability.pdf | no (no budget content) |
| FY26 (2025) | 2025 MRUSD Annual Report | 45.6 MB | .../MRUSD_2024-2025_Annual_Report__3_.pdf | no (>15 MB, older year; FY26 figures already carried in the FY27 form) |
| FY25 and older | 2024..2017 annual reports (14.1 MB, 1.78 MB, 3.07 MB, ...) | | same page | no |
All are plain downloadable PDFs. No separate detailed line-item budget book was found on the site (the annual report carries a department-level summary).

## Staged
- `intake/su-maple-run/fy2027/MRUSD-2025-2026-Annual-Report-.pdf` + `provenance.yaml`. The server sent no Content-Disposition, so the filename is the URL path segment. sha256 87b39404…c415.
- PDF layout (PDF page = printed page + 1): pp. 4-7 letters (text); p. 14 warning; p. 17 March 2025 certification; pp. 18-19 expenditure summary; p. 20 revenue summary; p. 21 AOE three-year form. **Pages 13-22 are images** — read at 100 dpi (warning, summaries) and 260 dpi crops (p. 21) and re-added.
- Records: `warehouse/su-maple-run/fy2027-warned.yaml`, `fy2026-approved.yaml` (adopted 2025-03-04 per certification), `fy2025-approved.yaml`, `fy2024-approved.yaml`.

## FY27 headline figures (AOE form, PDF p. 21, PRELIMINARY / ESTIMATES ONLY)
- Budget (warned, Article IV): $79,653,912; offsetting revenues $21,700,000; **education spending $57,953,912**.
- Pupils (LTWADM) 3,996.02; per pupil $14,502.91 (warning: $14,503, "3.36% lower").
- Equalized homestead rate $1.6389 -> $1.6129 after $0.026 cent discount; income cap 2.39%. Per-town rates and CLAs not printed.
- Prior columns: FY26 $77,757,499 / $19,006,276 / $58,751,223 / 3,915.92 / $15,003.17; FY25 $76,232,411 / $19,025,059 / $57,207,352 / 4,006.72 / $14,277.85; FY24 $69,422,742 / $18,358,413 / $51,064,329 / 2,426.77 equalized pupils / $21,042.10 (not comparable).
- **Vote result:** district news item "Maple Run FY27 School Budget Approved!" (March 4, 2026) says voters of St. Albans City, St. Albans Town and Fairfield approved the FY27 budget. Seen only in search-result text for https://www.maplerun.org/o/cardev/news and https://www.maplerun.org/o/sacs/news?page_no=2; the item was not on the live page listing I fetched and I did not capture its permalink or vote counts. Treat as district-stated, unverified at the article level.

## Discrepancies (all in lines_flagged, none reconciled)
- Budget total: warning/form/summaries $79,653,912 vs Board Chair letter $79,655,912.
- Per-pupil change: warning says -3.36%; form figures give -3.33% (3.36% matches the $15,007 FY26 per-pupil in the 2025 certification, vs $15,003.17 on the form).
- Expenditure summary shows FY26 adopted $77,757,497 vs $77,757,499 elsewhere; revenue summary total FY27 $79,653,912.06.
- Stale "FY26" headings on the FY27 expense/revenue pages; Article III ($1.2M / $1.25M) wording vs chair letter; tax-impact in cents (superintendent) vs percent (chair).

## needs_decision
None required (single district). Optional: whether FY25/FY24 should be `approved` — no vote dates/certifications for them are in this document (form prints them as adopted budgets).

## Not read / ask the district
- Did not read the text pages (pp. 8-12: school highlights) beyond a skim; did not open the 2025 or older annual reports or the Notice of Availability.
- Ask the district for: the FY27 certified election results (counts) and permalink of the March 4, 2026 news item; town CLAs / per-town homestead rates; a final (non-PRELIMINARY) AOE form.
