> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/montpelier-roxbury (SU069) — FINDINGS

**Site:** https://www.mrpsvt.org/ (budget page https://www.mrpsvt.org/budget). Registry URL is the right domain (home page, not the budget page); collector config updated to /budget.

**Structure:** one member district (Montpelier Roxbury Unified Union SD #71: Montpelier + Roxbury), SU and district are the same budget-setting body -> warehouse records allowed. Counted from the documents: one budget, one warning.

## Documents (all on Drive, linked from /budget under "FY'27 Budget")
| Year | Doc | Direct URL (uc?export=download&id=) | Size | Staged |
|---|---|---|---|---|
| FY27 | Informational Meeting March 2, 2026 (34 slides) | 1gmaGvtwXyBaxvAEHTRJ3PdBXQDNTLj1G | 3,980,218 | yes |
| FY27 | MRSD Warning of 2026 Annual Meeting (1 p.) | 18YV6kd9MhH8VdUMCfOCMLP5jp7V1Uqyl | 103,439 | yes |
| FY27 | FY27 Budget Flyer (1 p.) | 1dsRxUUBKIZdbw4NgWyEMEJ_0K20cgyxB | 190,039 | no (read, duplicates deck slide 30) |
| FY27 | 01-21-2026 FY27 Budget Presentation (38 p., draft figures) | 12llX0p3BI7lgf7edygPYjaORUlBNO9JK | 5,617,828 | no (superseded draft; read only for discrepancy) |
| FY27 | Earlier drafts 11/5, 11/19, 12/3, 12/17, 1/7; Budget Meeting Summary (Google Doc) | linked on /budget | — | not fetched |
| FY26, FY25 ... | warnings and presentations back to FY21 | linked on /budget | — | not fetched (budget limit; FY26 figures come from the FY26 column of the FY27 deck) |

**No annual report and no AOE "Three Prior Years Comparisons" form on the district's site.** The district says (via a third-party analysis, hungermountaini.com, not authoritative) that the AOE block is printed in the City of Montpelier 2026 Annual Report (montpelier-vt.org, ~104 pp.); I did not locate or download that PDF. Ask the district/City for it, or fetch it from the city's Finance news flash.

## Headline FY27 (deck p. 30; warning Art. 3)
- Total budget $34,754,275 (general $34,469,275 + capital plan $285,000); non-tax revenues $6,039,745; **education spending $28,714,530** (re-added OK); LTW ADM 1,909.88; **per LTW ADM $15,034.73** (matches warning: "$15,034.73, 1.61% higher").
- Equalized residential rate $1.699 / adjusted $1.614; Montpelier $1.320 (CLA 122.26%), Roxbury $1.702 (CLA 94.8%).
- **Vote:** passed 3/3/26, yes 1,608 / no 759 (district budget page https://www.mrpsvt.org/budget).
- FY26 column (deck p. 30): total $32,634,264; revenues $4,908,597; ed spending $27,725,667; LTW ADM 1,873.76; $14,796.81. FY26 vote passed 3/4/25 (1,637/788) per the budget page.

## Discrepancies (recorded in lines_flagged, not reconciled)
- 1/21/26 "Final FY27 Draft" deck: total $34,469,275 (capital plan $0), ed spending $28,429,530, $14,885.51/LTW ADM — differs from the warning approved the same night ($34,754,275, +$285,000 capital plan).
- Montpelier CLA 122.26% (deck p. 30) vs 122.27% (p. 31, flyer, 1/21 deck); Montpelier rate $1.320 (p. 30) vs $1.319 (flyer).
- Flyer says non-tax revenues +24.04%; deck and recompute say +23.04%.
- Figures are district estimates (yield $8,849 "not set into law until spring"), not AOE-form or Tax Department figures.

## Not done / not read
- Slides 4-23 of the March 2 deck (enrollment, revenue and expense by program/category) were not transcribed into records. FY25 and earlier columns not extracted. ADM bands left null (only LTW ADM printed).
- No FY25 or older district documents downloaded. FY28 budget page links only a Google Doc.

## Needs decision
- Whether a deck-sourced education_spending (not an AOE form) is acceptable in the warehouse, or whether to wait for the City of Montpelier annual report containing the AOE form.
