> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/milton (Milton Town School District, SU010) — FY27 findings

**Site:** https://www.mtsd-vt.org/ (registry URL matches; collector config not stale, none staged).
Budget pages: https://www.mtsd-vt.org/page/fy27 (current, "Revised FY27 Budget") and
https://www.mtsd-vt.org/page/fy27-copy-old/ (original FY27 page). Apptegy site; the current page is JS-rendered
(plain fetch returns an empty shell; I read it in a browser). One budget-setting district (MTSD), so a warehouse record is allowed.

## Budget history FY27
- Dec 2025 proposal $42,236,319 (+7.49%), per pupil $14,837.
- Warning dated 2026-01-22, March 3, 2026 vote: $40,895,465, per-pupil $14,137.22 (+2.73%). Result not stated in any document I read; a revote followed, implying it did not pass.
- Revote May 19, 2026: $40,812,465 (+3.87% over FY26 $39,291,626), ballot per-pupil $14,103.15 (+2.48%). District site says PASSED (banner + May 20 article). WCAX/WPTZ report 972-851.

## Documents
Staged in intake/su-milton/fy2027/ (all Drive, downloaded byte-for-byte, filenames as sent):
1. Revised FY27 Proposed Budget .pdf — 270,223 B, 43 pp line-item sheet, Grand Total p. 43 (primary).
2. Final FY27 Budget Revote Informational Presentation.pdf — 1,216,425 B, 12 slides.
3. FY27 Warn Ballot (1).pdf — 644,725 B, scanned 1-page March warning (original $40,895,465).

Found, NOT staged:
- FY27 Proposed Budget - Town Report.pdf (original March line-item sheet, 24 pp, 237,546 B, Grand Total $40,895,465; Drive id 1Yb9Zma23lu_KUbKT7lQ5aiTv5fKRl9yf) — superseded by the revised sheet.
- Revised Budget Flyer.pdf (2,648,168 B, image flyer, ballot text) — duplicates presentation p. 8.
- Revised-page links not downloaded: "FY27 Budget Warning" (Google Doc, edit link, id 1p-rR1sXZxknMOKhhCHvnFprwWFJz8OWjCY7Ni5mLl1o; no original file), published Google-Doc Budget Book (no AOE form; demographics/FAQ only), FY25 audit (aptg.co/P1xFVP, not fetched), Mar 12 2026 update, Jan 8 scenarios, other presentations (Drive/5il.co; not fetched).

## Record
warehouse/su-milton/fy2027-approved.yaml: total budget and per-pupil in notes; **education_spending null** (no AOE form; nearest printed: $40,812,465 total, $14,103.15 per pupil). ADM, town rate, CLA null and flagged. adopted_date 2026-05-19 = revote date printed in the presentation/flyer; passage per district site. No FY26 or earlier record: the documents print no education-spending figures for prior years.

## Discrepancies
- Presentation: March 3 tax impact 9.80% (p. 4) vs 9.88% (p. 6 table, same row). District's May 4 article says 9.80%.

## Needs decision / ask the district
- Ask MTSD for the AOE Three Prior Years Comparisons form (FY24-FY27 columns, LTWADM, education spending) and the Act 127 homestead rate sheet for FY27; none is on the site.
- Whether to add a separate record for the first (March 3) $40,895,465 budget; its result is not stated in any staged document. Confirm March 3 vote result with the Town Clerk/district.
- The district's own March 12, 2026 update presentation and the Budget Book Google Doc were not read in full.
