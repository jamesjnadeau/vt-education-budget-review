> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# Windham Southwest Supervisory Union (SU049) — findings (retrieved 2026-11-28)

## Sites
- Registry site `http://www.windhamsw.k12.vt.us/` is dead (404, Google Sites "ghs" server). Current SU site: https://www.wswsu49.org (Google Sites). `collectors/su-windham-southwest/config.yaml` staged to replace it.
- Budget material is on per-district board pages: `/Meeting-Calendar/{halifax,readsboro,searsburg,stamford,tvuusd}-board`. Each has "SCHOOL WARNING" and "Proposed FY27 Budget" (Adobe Acrobat share links `acrobat.adobe.com/id/urn:aaid:sc:US:…`, HTML viewer only, not downloadable — not captured) plus an embedded Drive viewer with the district annual report (downloadable, captured via `drive.google.com/uc?export=download&id=<id>`).

## Registry mismatch / member count
- Registry lists 1 member (Twin Valley USD #75). The SU's own site and AOE FY27 LTWADM list show **5 budget-setting districts**: Halifax, Readsboro, Searsburg, Stamford, Twin Valley USD (Whitingham + Wilmington); Somerset appears in the AOE list with suppressed data. Halifax assessment table (TV binder / Halifax report p.15) lists Halifax, Readsboro, Searsburg, Stamford, TVES, TVMHS. => **No warehouse records written** (2+ districts).

## Documents staged (intake/su-windham-southwest/fy2027/, all byte-for-byte, server filename from Content-Disposition)
| file | bytes | form page (PDF) | text layer |
|---|---|---|---|
| Halifax Report 2026 (AutoRecovered).pdf | 1,206,087 | AOE form p.13 | form is IMAGE (pp.6-14 images) |
| Readsboro Report 2026.pdf | 2,792,283 | estimator p.14, form p.15 | yes |
| Town Report 2025 Final.pdf (Stamford town+school) | 11,599,514 | estimator p.54, form p.55 | yes |
| tv binder final.pdf (TVUUSD annual report 2026) | 12,612,614 | form p.25 | pp.22-37 IMAGE |

## Documents found but NOT staged
- Searsburg: `SEARSBURG ANNUAL REPORT 2025.pdf` (3.65 MB, Drive id 1aLsc47GjmMnzUYXbFuczQ4qUB9MwKEDp) is an image-only 46-page report for the year ended 30 June 2024 (cover) — not FY27. Searsburg's FY27 budget exists only as an Adobe share link. **No FY27 Searsburg document captured; ask the district for the PDF.**
- Readsboro `2026 Readsboro Special Report - FINAL.pdf` (1.57 MB): June 29/30 2026 warning (sale of school building to town; tuition to independent elementary schools). Not a budget; not staged.
- Adobe share links for each district's "Proposed FY27 Budget" (5 districts) and "TVUUSD Annual Meeting Minutes": viewer-only, not downloaded. Google Docs warnings/minutes: not downloaded (not byte-for-byte originals).
- Somerset: no page on the SU site; nothing found.

## needs_decision — per-district FY2027 figures (AOE "Three Prior Years" form, read by me)
No records written; figures are as printed in each form's FY2027 column.
| district | budget | offsetting rev | education spending | pupils (LTWADM) | ES/pupil | equalized rate | CLA/SA | vote |
|---|---|---|---|---|---|---|---|---|
| Halifax (T090) | $2,636,178 | $153,556 | $2,482,622 | ~187.98 (see flag) | $13,206.84 | 1.4925 | 100.77% (actual 1.4811) | passed, unanimous voice vote at town/school meeting — https://www.commonsnews.org/issue/856/856TM_results |
| Readsboro (T164) | $1,931,739 | $91,217 | $1,840,522 | 121.17 | $15,189.59 | 1.7165 | 97.26% (actual 1.7649) | passed 122–121 (Vermont Daily Chronicle 2026-03-05 citing Bennington Banner; https://vermontdailychronicle.com/two-towns-close-schools-ice-feared-at-non-citizen-voting-polls-woodstock-votes-new-school/); same vote closed the school, non-operating tuition district from 2026-07-01. Not seen on a district/town site. |
| Stamford | $2,419,079 | $204,000 (local 144,000 + fund balance 60,000) | $2,215,079 | 163.76 | $13,526.38 | 1.5286 | 145.10% (actual 1.0535) | result not found |
| Twin Valley USD (U075; Whitingham T242, Wilmington T245) | $11,647,479 | $1,314,163 | $10,333,316 | 671.91 | $15,379.02 | 1.7379 (both towns) | not printed on form | result not found (FY26 and FY25 budgets passed per Bennington Banner; FY27 not found) |
| Searsburg | not captured | | | | | | | |

Prior-year columns (same forms) — education spending FY24/FY25/FY26: Halifax 1,904,721 / 2,205,945 / 2,274,705; Readsboro 1,352,128 / 1,610,075 / 1,674,935; Stamford 1,686,801 / 1,943,991 / 2,258,291; TVUUSD 8,941,430 / 9,534,096 / 9,786,619. FY23/FY24 pupils are equalized pupils, not comparable with LTWADM (FY25+).
Arithmetic checks: budget − revenue = education spending holds for all four FY27 columns; Readsboro and Stamford per-pupil recomputed from 1,840,522/121.17 and 2,215,079/163.76 match.

Decision for the lead: SU049 has 5+ budget-setting districts, so the entity `su/windham-southwest` cannot carry a single budget record. Consider modelling `ud/twin-valley-75` plus the other districts as their own entities (registry lists only Twin Valley under this SU).

## Discrepancies / flags (recorded, not reconciled)
- Halifax FY27 pupils cell (row 12) is illegible in the image; ~187.98 is implied by 2,482,622 / 13,206.84. AOE FY27 LTWADM list (education.vermont.gov FY27 LTWADM.xlsx) gives Halifax 183.01. Unresolved.
- Stamford form LTWADM 163.76 vs AOE list 163.78; Readsboro 121.17 vs AOE 121.2 (rounding-level).
- TVUUSD form: AOE list gives Twin Valley USD LTWADM 674.65 vs 671.91 on the form. Row 14 FY27 cell shows a small value ("$677.37"?) in the image that I could not interpret; rows 13 and 25 both read $15,379.02. The form footnote still cites the "December 1, 2024 ... FY26 forecast" (stale template text) although the column is FY2027.
- Halifax form footnote correctly cites the December 1, 2025 Outlook/FY27.
- Halifax/TVUUSD forms are image-only; figures read from renders (low source resolution), cross-footed arithmetically.

## What I did not read
Full text of narrative sections, warnings, minutes, and the TVUUSD page-by-page budget detail (PDF pp.12-21 text not examined beyond TOC); Readsboro/Stamford form lines 14-24 and tax-rate-by-town beyond FY27 line 27-33; Halifax Town Report. Searsburg report contents beyond a thumbnail pass.

## Ask the district
Searsburg FY27 proposed budget / annual report PDF (and the Somerset arrangement); text-layer PDFs of Halifax and TVUUSD budget pages; certified March 3, 2026 results for Stamford and TVUUSD (and Halifax certification).
