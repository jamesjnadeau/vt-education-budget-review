> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/mill-river-unified-union (SU033) — Mill River Unified Union School District #52

## Sites
- Current site: https://www.mruusd.org/ (homepage links "2026 Annual Report" (Drive) and "2027 Budget Presentation" (Google Slides)). Also millriverschools.org is cited in town reports.
- **Registry mismatch:** registry/collector URL http://www.rssu.org/ returns 200 but is now an unrelated personal site (a trombonist). Staged `collectors/config.yaml` replaces it. mruusd.org has no /budget or /annual-report page (404).
- One budget-setting district (4 towns: Clarendon, Shrewsbury, Tinmouth, Wallingford; single budget, single tax rate), so warehouse records are written.

## Documents found
| Year | Doc | URL | Size | Staged? |
|---|---|---|---|---|
| FY27 | 2026 Annual Report (31 pp.) | https://drive.google.com/uc?export=download&id=1tySVA-EyznkojFjVTfwjplzL-ZW5G5Qd (linked from mruusd.org) | 2,927,006 B | **yes** (`2026 Annual Report .pdf`, filename from Content-Disposition) |
| FY27 | Copy on Wallingford site | https://www.wallingfordvt.com/wp-content/uploads/2026/02/MRUUSD-2026-Annual-Report.pdf | 2,923,038 B | no — different build (sha256 0f653033…; differs in board term lengths on p. 2); one doc per SU is enough. A "-Rev.pdf" copy also exists on that site (not fetched). |
| FY27 | 2027 Budget Presentation (Google Slides) | https://docs.google.com/presentation/d/16Zz8hhdVJnCrg55XR4Ki07oykw-nI_nw_lGyCEXx3WE | — | no — Slides, no downloadable original; not read |
| FY27 | Town report copy (Tinmouth) | https://tinmouthvt.gov/wp-content/uploads/2026/02/Town-Report-2025-FINAL.pdf | — | no |

## Staged
- intake/su-mill-river-unified-union/fy2027/{2026 Annual Report .pdf, provenance.yaml}
- warehouse: fy2027-warned, fy2026-approved, fy2025-approved, fy2024-approved (all from the p. 25 AOE form)
- collectors/config.yaml

## Headline FY27 figures (annual report)
- Total budget $22,817,989 (+3.52% vs FY26) — p. 14, p. 25 line 1, warning Art. 4 (p. 31)
- Offsetting union revenues $5,579,558; **education spending $17,238,431** — p. 25 lines 10-11
- LTWADM 1,219.80; per pupil $14,132.18 (form) — p. 25; warning says $14,132.29 (+4.10%)
- Equalized union homestead rate $1.5970 (yield $8,849); income cap 2.33%
- Operating fund p. 15: total revenue $21,567,989 + $1,250,000 surplus applied = $22,817,989
- Art. 5: $1,000,000 surplus to building sinking fund
- **Vote result:** not in the district documents I read. Rutland Herald, Mar 4, 2026: budget approved 515-469; transfer approved 625-352 (https://www.rutlandherald.com/news/local/rutland-county-sees-only-two-school-budgets-fail-this-town-meeting-day/article_5bf79bf2-e1a1-44b7-b34d-24d5a09a824f.html). Newspaper count; not checked against town clerks. FY26's March 4, 2025 tally is in the report (p. 30): Art. 4 576-434.

## Prior years from the form (p. 25)
| FY | budget | revenue | ed spending | pupils | per pupil | rate |
|---|---|---|---|---|---|---|
| 2024 | 19,826,555 | 4,698,521 | 15,128,034 | 717.75 (equalized) | 21,077.02 | 1.3648 |
| 2025 | 21,333,576 | 4,401,817 | 16,931,759 | 1,311.59 | 12,909.34 | 1.3649 |
| 2026 | 22,042,475 | 4,754,600 | 17,287,875 | 1,273.42 | 13,575.94 | 1.5793 |
| 2027 | 22,817,989 | 5,579,558 | 17,238,431 | 1,219.80 | 14,132.18 | 1.5970 |
Every column re-added: budget − revenue = spending; spending / pupils = per pupil (all match).

## Discrepancies / flags (also in the records)
- p. 25 form is stamped PRELIMINARY / ESTIMATES ONLY (Dec 1, 2025 yield outlook) and is a 575×729-px image; figures read from enlargements.
- Per pupil FY27: $14,132.18 (form, p. 14) vs $14,132.29 (warning p. 31, legal notice). FY26: $13,575.94 (form) vs $13,570.29 (2025 warning in report).
- FY25 pupil count reads 1,311.69 or 1,311.59 in the image; 1,311.59 reproduces the printed per pupil.
- FY24 pupils are equalized (717.75), not comparable to LTWADM; FY24 per-pupil $21,077 vs FY25 $12,909 is a pupil-basis change, not a real drop.
- Form's per-town "prorated" rates all equal the union rate (no CLA applied); p. 14 says not CLA-adjusted. Town rates/CLAs left null.
- p. 14 non-resident tuition rates are labelled 2024-2025; the cost-effectiveness chart "was not available at press time".
- ADM bands not printed on the form; enrollment pp. 12-13 not read for bands.

## Not read
Pages 16-23 (line-item expenditures, images), 24 (balance sheet), 26 (grants), 27-29 (minutes) beyond text-layer grep; principals' reports, staff lists; the Slides presentation.

## Needs a human / ask the district
- Ask for the FY27 AOE form as a native spreadsheet/PDF and the certified Mar 3, 2026 results (town clerks).
- Decide whether to stage the Wallingford copy (differs from the Drive "FINAL").
