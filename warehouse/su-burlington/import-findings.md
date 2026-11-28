> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/burlington (Burlington School District, SU015) — FINDINGS

**Site:** https://www.bsdvt.org/ ; budget page https://www.bsdvt.org/district/budget/ (links FY27 docs, FY26 and older archives).
**Registry mismatch:** none material. Registry URL http://www.bsdvt.org/ is current (kind was `other`, no pattern, fiscal_years_available empty). No collectors/config.yaml staged since the URL is not stale.
**Member districts:** 0 (SU = budget-setting district), so warehouse records are staged.

## Documents (all FY27 / 2026-27, vote March 3, 2026)
| Document | URL | Size | Staged |
|---|---|---|---|
| 2025 Annual Report (Feb 2026), 20 pp, text layer, AOE form p. 18 | https://www.bsdvt.org/wp-content/uploads/2026/02/BSD_AnnualReport_2025.pdf | 1,875,973 B | yes (primary) |
| FY27 Budget Summary by Function (line items) | .../2026/05/FY27-Budget-by-Function.pdf | 42,785 B | yes |
| FY27 Budget Summary by Object | .../2026/05/FY27-Budget-by-Object.pdf | 47,382 B | yes |
| FY27 Board-approved budget recommendation (1/26/26) | .../2026/02/FY27-School-Budget-Budget-Recommendation-20260126-1.pdf | 1,281,021 B | no — duplicates the annual report's summary |
| FY27 Budget One-Pager | .../2026/01/FY27-Budget-One-Pager-Final.pdf | not fetched | no — summary only |
| Older years (FY18-FY26 comprehensive budgets, one-pagers, line items, audits FY16-FY25) | linked from budget page | not fetched | no — outside scope (FY27 preferred) |

No Content-Disposition header was sent; filenames are the URL's last segment.

## Headline FY27 figures (annual report, PDF p. 18 form; pp. 16-17 summary)
- Total budget $140,807,830 (+4.47% over $134,779,831); offsetting revenues $31,729,008; **education spending $109,078,822**.
- LTWADM 6,914.85; per pupil $15,774.58 (+6.40%); equalized homestead rate $1.7124; adjusted CLA 107.14%; town rate $1.5982; income cap 2.48%.
- Prior columns FY24-FY26 staged as `approved` records (FY24 pupils are equalized, not comparable).
- **Vote:** district says approved by "more than two-thirds" (https://www.bsdvt.org/2026/03/05/two-thirds-of-burlington-voters-pass-budget/). Counts 5,900-2,879 (67.2%) come from Burlington Daily News and WCAX, not from a district/city page I read; city official result not found.

## Discrepancies / flags
- FY26 per-pupil printed $14,825.07 on the p. 18 form; $103,360,823 / 6,971.70 = $14,825.77 (district's own history table prints $14,825.77). Flagged, not reconciled.
- Form is labelled PRELIMINARY / ESTIMATES ONLY; relies on a $75M Education Fund buydown assumption (Dec 1, 2025 outlook; yield $9,212).
- Line-item PDFs are titled "FY27 1st Draft Line Item.xlsx" (posted May 2026), yet their grand total equals the voted $140,807,830.
- ADM bands: only one pupil count printed; all four bands null (flagged).
- Per-town rate/CLA only recorded for FY27 (line 33 / line 32); FY24-26 left null.

## Not read / not done
- Did not read the full annual report text beyond pp. 16-18, nor the line-item PDFs beyond headings/grand totals. Did not fetch the Board recommendation, one-pager, or archive documents. Did not verify the vote counts against official results.

## needs_decision
None. Optional: confirm whether the 'preliminary' form pupil/rate figures are final (ask district for the post-vote AOE form).
