> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/slate-valley — Slate Valley Unified Union School District (AOE SU004)

Retrieved 2026-11-28.

## Sites
- Current: https://www.slatevalleyunified.org/ . Budget hub: https://www.slatevalleyunified.org/o/svusd/page/fy27-budget (the URL now shows the **FY28** page; the FY27 "Resources" list is still on it). Cloudflare blocks plain curl on the HTML (403); web_extract works.
- Registry mismatch: registry/collector URL http://www.arsu.org/ (old Addison-Rutland SU) does not resolve. Collector config staged with the new URL.
- Registry says 1 member district (UD #62, towns benson, castleton, fair-haven, hubbardton, orwell, west-haven). Confirmed from the documents: one budget-setting district (the AOE form is "Slate Valley UUSD, U062", SU "Addison - Rutland"), so warehouse records are allowed.

## Documents found
| Year | Type | URL | Size | Staged |
|---|---|---|---|---|
| FY27 | Annual report + proposed budget (25 spreads) | https://aptg.co/QbpD6L -> https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/1034/Svusd/40109614-4622-4db0-b6e4-3e2f4433dc5e/Web-25-26-Slate-Valley-Annual-Report-and-FY27-Budget.pdf | 42.3 MB | yes |
| FY27 | Detail expenditure budget for the 3/31 REVOTE (46 pp) | https://aptg.co/Zctc0S -> .../d46f1f6d-f78f-41a6-bf7d-730a1cfe4159/Detail-Expenditure-Budget-FY27-for-Re-Vote-3-31-26.pdf | 0.88 MB | yes |
| FY27 | Signed warning, Feb 19 / Mar 3 2026 (2 pp, scanned) | https://aptg.co/bBRCvh -> .../ee590365-2848-4df9-a22e-eb651dc1f623/SVUUSD-Annual-Mtg-Warning-26-27-Signed.pdf | 0.13 MB | yes |
| FY27 | "2-19-2026 SVUUSD Annual Informational Meeting" | Google Drive file 1MGastr83KnnOFw_lXBmTvyU5AgHI2TOG (meeting recording, presumed) | not checked | no |
| FY27 | Budget presentation and Tax Rate Estimates | Google Slides 1A163yLvhNSmYts54hxqWLiuYTadiVtennRYTvAIK_DQ | n/a | no (Slides, no original) |
| FY26 | Annual report | simplebooklet.com/slatevalleyannualreportandf (viewer only) | n/a | no |

Staged under intake/su-slate-valley/fy2027/ with provenance.yaml. The annual report is 42 MB, above the 15 MB add-on guideline but it is the one best document and under 100 MB. No Content-Disposition was sent by the server; filenames are the last URL path segments.

## Headline FY27 (original proposal, defeated 3/3/2026) — annual report, AOE form on PDF p. 10 (image)
- Total union budget $32,509,789 (+2.8%, +$886,779 vs FY26 $31,623,010)
- Offsetting revenues $4,993,758; **education spending $27,516,031**
- LTWADM 2,299.19; per pupil $11,967.71 (+3.48% vs $11,564.69)
- Equalized union rate $1.3524 (yield $8,849), income cap 2.00%. Same rate printed for all six towns; no town CLAs or town rates.
- Arithmetic checks pass for all four columns (budget - revenue = education spending; spending / pupils = printed per pupil).
- Vote 3/3/2026: **defeated 952-1,125** (Mountain Times, https://mountaintimes.info/2026/03/11/voters-approve-a-majority-of-town-meeting-day-school-budgets).

## Revised FY27 (revote 3/31/2026)
- Detail budget total expenditures **$32,307,262.49** (PDF p. 46), $202,526.51 below the original. No revenues, education spending or LTWADM in it; no revised AOE form found.
- Vote 3/31/2026: **approved 778-546** (Mountain Times, https://mountaintimes.info/2026/04/15/otter-valley-budget-squeaks-by). District live feed (https://www.slatevalleyunified.org/live-feed?page_no=8) thanks voters for approving the budget on the revote; I saw this only as a search snippet and did not open the post.

## Records staged (warehouse/su-slate-valley/)
- fy2027-warned.yaml (original, education spending 27,516,031)
- fy2027-approved.yaml (revised revote budget; **education_spending null**, flagged; budget total in notes)
- fy2026-approved.yaml (27,080,580), fy2025-approved.yaml (26,291,291), fy2024-approved.yaml (23,274,925; equalized pupils, not comparable) — from the FY27 form's prior-year columns.
- adm bands, town rates and CLAs are null everywhere, flagged left_null.

## Discrepancies / flags
- FY26: the form shows $31,623,010; the district's earlier FY26 annual report (simplebooklet) proposed $32,086,270, so FY26 was also revised/re-voted. FY26 pre-revote documents not staged.
- FY24 pupil column is equalized pupils (1,285.69), not LTWADM.
- The report (p. 9 text) says town tax rate estimates are not included; the AOE form shows only the prorated union rate. No stale template headings seen on the FY27 form.
- Warning Article 8 ($32,509,789.00; $11,967.71; 3.48%) agrees with the annual report.

## needs_decision
- Whether the revote budget should be a separate fy2027 record with null education spending (done as fy2027-approved.yaml) or held until the district supplies a revised AOE form. File naming allows only one file per status per year, so the original is 'warned' and the revote 'approved'.
- Whether "approved" for FY24-FY26 is acceptable, given the form's column header is "Adopted or warned" and no vote dates are stated.

## Ask the district for
- Revised FY27 AOE Three Prior Years form / revenues for the $32,307,262.49 revote budget; certified March 3 and March 31 results; FY26 pre- and post-revote documents; per-town CLAs and rates (the Google Slides "Tax Rate Estimates").

## Not read
- Most narrative pages of the annual report (principal/director reports, minutes) beyond what is cited; revenue summary and "expenditures by account" chart images; the line items of the 46-page detail budget beyond the grand total and first pages; Google Slides and the 2/19 meeting file.
