> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/orange-southwest (SU028) — FY2027

**Site:** https://www.orangesouthwest.org/ (registry URL matches; collector config updated to the two real pages).
Pages: /central-office/annual-report, /central-office/financial-budget-data. Plain HTML hides the links; web_extract shows them.

**Members:** 1 budget-setting district (Orange Southwest Unified Union SD #59 = Orange Southwest School District; Braintree, Brookfield, Randolph). Warehouse record allowed.

## Documents
| Year | Doc | URL | Size | Staged |
|---|---|---|---|---|
| FY27 | OSSD Annual Report 2026 (28 pp) | https://resources.finalsite.net/images/v1770299462/orangesouthwestorg/f3a29qifrkhx2op99k4p/OSSD2026AnnualReport.pdf | 9.1 MB | yes |
| FY27 | 2026 OSSD Voting Results (3 pp scan) | https://resources.finalsite.net/images/v1773265686/orangesouthwestorg/e8rclzfztxjzyhsxvzma/21BudgetResults.pdf | 1.6 MB | yes |
| FY27 | 2026 Budget Informational Meeting Minutes, 2026 Annual Meeting Minutes | resource-manager links on financial-budget-data page | 97 KB (minutes) | no (not budget figures) |
| FY27 | Board packet with line items (Finalsite, BoardPacketfullandrevised.pdf) | found via search | not fetched | no |
| FY22-FY26 | Annual reports 2022-2025, voting results 2024-2025 | same pages | not fetched | no (older years) |
Filenames: server sent no Content-Disposition; last URL path segment used.

## FY27 headline figures (annual report, "Proposed Draft 3")
- Budget $27,976,946 (p. 24 SCHOOL TOTAL = p. 25); categorical grant revenue $6,031,875; **education spending $21,945,071** (p. 25).
- Equalized LTW pupils 1,412.22 (p. 25, labelled "2025-26 (Projection 1/05/26)"); per pupil $15,539.41; equalized homestead rate $1.7561.
- Ballot / total voter approval $29,159,606 = school total + $1,182,660 federal (p. 24).
- Town rates: Braintree $1.9644, Brookfield $1.6123, Randolph $1.3010.
- **Vote (3/3/2026): passed, YES 836 / NO 407** (clerk-attested 3-6-2026). Surplus transfer $1,887,000 to Building Reserve Fund passed 884/354.

## Discrepancies (all in lines_flagged, none reconciled)
- Ballot language per pupil $15,339.41 (p. 5 and certified ballot) vs $15,539.41 (p. 5 / p. 25; math supports 15,539.41).
- "Down 4.22%" (p. 5) vs recomputed -4.04% from $1.8301.
- Braintree rate 1.9644 printed vs 1.9645 recomputed.
- Form is the district's estimate on a draft budget ("State Estimates"), not an AOE-certified form; pupil label says 2025-26.

## Not done / needs a human
- The report has no AOE "Three Prior Years Comparisons" table; FY24-FY26 education spending is not printed, so only FY2027 record written (status warned, vote result in notes; not marked approved).
- ADM grade bands left null (one weighted total printed).
- Not read: pp. 1-4, 6-23 narrative and line items (only skimmed via text layer), 26-28 beyond skim; minutes and board packet not opened.
- Ask the district for: the AOE form / certified FY27 education spending, and the FY24-FY26 prior-year comparisons.
- needs_decision: whether to record FY27 as approved given the passed vote.
