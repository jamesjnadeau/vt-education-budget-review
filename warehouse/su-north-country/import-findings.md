> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# North Country Supervisory Union (su/north-country, SU031) — findings

**Status: partial.** One raw document staged; NO warehouse records (the SU has ~12 budget-setting member districts, not 3).

## Sites
- SU: https://www.ncsuvt.org/ (registry http://www.ncsuvt.org/ is current, redirects to https; no collector change made). Annual-report index: https://www.ncsuvt.org/34701
- Member sites: https://bes.ncsuvt.org/ (Brighton Elementary), ncuhs.ncsuvt.org, ncujhs.ncsuvt.org.
- Registry lists 3 members (Jay/Westfield joint elementary, NCUHS union HS, NCUJHS union JHS). The documents show more: the NCUHS warning names Brighton, Charleston, Derby, Holland, Jay, Lowell, Morgan, Newport (city and town), Troy, Westfield; the NCSU calendar also lists Coventry. About 12 districts set their own budgets (10 elementary/town districts + NCUHS + NCUJHS). => no warehouse records.

## Documents found
| Year | Doc | URL | Size | Downloadable |
|---|---|---|---|---|
| FY2027 (2026 report) | "NCSU Annual Report 2026" (52 pp, Adobe Acrobat share link; title "Copy of NCSU ANNUAL REPORT 2026 (1)") | https://acrobat.adobe.com/id/urn:aaid:sc:US:236a4087-4705-49cc-ad06-9de677ed0544 | **222.9 MB** original (Adobe also offers an 8.9 MB "compressed" re-render, which is not the original) | Not staged: > 100 MB limit |
| FY2025 (2024 report) | Annual Report 2024 FINAL (VT).pdf (Canva, 56 pp), Drive id 1ULfSQjv0PmGc5tDcjOTDouDAnUftyX0d | https://drive.usercontent.google.com/download?id=1ULfSQjv0PmGc5tDcjOTDouDAnUftyX0d&export=download&confirm=t | **142.2 MB** (Content-Length) | Not staged: > 100 MB; I fetched it by mistake into /tmp and deleted it unread |
| FY2027 | Brighton Town School District 2025 Annual Report.pdf (48 pp, scan) | https://drive.google.com/uc?export=download&id=1IIHSIRnTceK0865TaUSNgrvbhuHWG1aF | 31.4 MB | **Staged** (intake/su-north-country/fy2027) |
- 2023..2017 annual reports (Drive links on the /34701 page) were not checked.
- Other member districts' own FY27 annual reports (Charleston, Coventry, Derby, Holland, Jay/Westfield, Lowell, Morgan, Newport City, Newport Town, Troy, NCUHS/NCUJHS) were NOT looked for in this pass (budget of ~40 calls; they are on each school's site under ncsuvt.org). The staged Brighton report is an only partial substitute. Note: the 2026 NCSU report is likely the combined book of those, but is too large to stage.

## Headline FY27 figures (read from image-only pages; PDF page = printed page + 2)
**Brighton Town School District** (PDF p.5 warning; p.27 "Estimated Homestead Tax Rates FY2027", the page is printed upside-down/rotated; PDF pp.17-26 line items):
- Budget to voters $3,767,717 (Art. 5; vote Mar 3, 2026 by Australian ballot, warning also says meeting Mar 2). Per pupil $14,068, "16.89% higher". Local revenues $304,935; education spending $3,462,782 (p.27; 3,767,717 − 304,935 ✓). Equalized pupils/LTW ADM 246.15 (FY26 252.42, FY25 253.44). 3,462,782 / 246.15 = 14,068 ✓.
- Estimated rates (p.27): Brighton school 1.0160 + NCUHS 0.4801 (equalized pupils 123.84 @ NCUHS) = total 1.4961; common level of appraisal 137.40%; homestead rate 1.0888 (FY26 1.0038; FY25 1.5436). Page is titled ESTIMATED; CLA values swing 74.56% → 141.97% → 137.40% (FY25 → FY26 → FY27), so FY25 CLA looks stale; not reconciled.
- Also: Art. 6 closes Tax Stabilization Fund, transfers $129,000 to the Capital Improvement Fund. FY27 expenditure total on p.26: $3,767,717 (FY26 budget $3,231,162; FY25 actual $3,510,282).
- This is a district-level estimate page, **not the AOE Three Prior Years form**; none in this PDF.

**North Country Supervisory Union FY2027 Board Approved Assessment Budget** (PDF pp.37-41; heading FY2027, TOC says FY2026):
- Total expenditures $3,342,661 (FY26 $3,111,832); revenue $3,342,661 incl. town assessments $2,924,161 (FY26 $2,935,332), interest $101,500, indirect costs $100,000, fund balance $217,000. Pie (p.41) categories sum to $3,342,661 ✓ (re-added). Not an AOE education-spending figure; SU budget is assessed to members.

**NCUHS** (PDF p.42): Art. IV $24,273,900, per pupil $13,213, "+3.44%" (matches Brighton p.27 NCUHS figure 13,213, +3.44%); vote Mar 3, 2026. **NCUJHS** Art. VI $7,169,400, per pupil $13,594, "+1.58%". Other pages of these two districts not read.

## Vote results (newspaper, not a district page — not entered in any record)
Newport Vermont Daily Express, Mar 5, 2026 (https://www.newportvermontdailyexpress.com/news/north-country-union-high-school-and-junior-high-school-budgets-pass/article_f143bcba-e25f-41ed-80ed-7b0f12092341.html), from search snippet only: NCUHS+NCCC passed 923–720; NCUJHS passed 728–475; elementary budgets passed in Brighton, Charleston, Derby, Holland, Morgan, Newport Town, Troy, Jay, Westfield; **failed**: Coventry 111–128, Newport City 306–312. No district-site result found.

## needs_decision
- Per-district records (Brighton, NCUHS, NCUJHS, each elementary) need a modelling decision: this SU has ~12 budget-setting districts, so none staged. Brighton's FY27 and prior columns are above if the lead wants them as a district entity.
- The 222.9 MB 2026 report and 142 MB 2024 report exceed the limit; decide whether to ask the SU for a smaller PDF or a lead-approved exception.

## Ask the district for
A downloadable (<100 MB) PDF of the 2026 NCSU Annual Report, plus the AOE "Three Prior Years Comparisons" forms for NCUHS/NCUJHS and each elementary district, and the Mar 2026 certified vote results (Coventry and Newport City defeated; revote status unknown).

## Not done
No warehouse records, no collector change. Brighton PDF pp. 6-16, 17-25 (line items except two spot-checked), 28-36, 43-48 were not read in detail; pp.1-48 were only skimmed as thumbnails.

## Large files (over 30 MB)

These were first held back from the import for size and were then added to the PR. They are in `intake/` as received. Notes below are the provenance notes for each file, with the records that cite it.

### Brighton Town School District 2025 Annual Report.pdf

- **Path:** `intake/su-north-country/fy2027/Brighton Town School District 2025 Annual Report.pdf`
- **Size:** 31,373,858 bytes (31 MB)
- **sha256:** `933e9933aba32833ca99660c59ce5a9a433ab2d5574fbd18306db9ffe950f8b3`
- **Source:** https://drive.google.com/uc?export=download&id=1IIHSIRnTceK0865TaUSNgrvbhuHWG1aF
- **Records citing it:** none (no records for this SU: see the status above)
- **Provenance note:** Annual report for the year ended June 30, 2025, issued ahead of the March 2026 meeting; it warns and prints the FY2027 proposed budget of the Brighton Town School District (one of the supervisory union's member districts), so it is filed under fy2027. It also reproduces the North Country Supervisory Union's FY2027 Board Approved Assessment Budget (PDF pp. 37-41; the table of contents mislabels it FY2026) and the NCUHS / NCUJHS warning (PDF pp. 42-43). It carries no AOE Three Prior Years Comparisons form. The whole file is a scan with no text layer (created on a Toshiba e-STUDIO copier, 2026-02-02), and PDF page n is printed page n-2. Saved under the filename the server sent (Content-Disposition), byte-for-byte. The district's publication date is not stated.
