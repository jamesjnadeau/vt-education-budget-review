> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/winooski (Winooski School District, AOE SU017) — FINDINGS

**Site:** https://www.wsdvt.org/ (budget page https://www.wsdvt.org/school-board/budget/). Registry URL http://www.wsdschools.org/ is stale (403 to curl) -> `collectors/su-winooski/config.yaml` staged.
**Structure:** single budget-setting district (Winooski ID, T249; one town, town/winooski). Warehouse records allowed.

## Documents
| FY | Type | URL | Size | Status |
|---|---|---|---|---|
| 2027 | Annual report (127th, Feb 2026), 22 pp, text PDF | https://www.wsdvt.org/wp-content/uploads/2026/01/127th-Annual-Report.pdf | 1,943,307 B | **staged** (intake/su-winooski/fy2027) |
| 2027 | Budget flyer | .../2026/01/FY-27-Budget-Flyer-flat.pdf | small | not downloaded (same content as report p. 22) |
| 2027 | Board budget presentations V.III / VII | .../2025/12/7b.i_FY-27-Budget-V.III_.pdf, 5b.i_FY-27-Budget-VII.pdf | not checked | not downloaded; drafts |
| older | Annual reports FY14-16, FY20, FY22, FY23 | listed on budget page | — | not downloaded (outside FY27 target) |
| FY25/FY26 | Annual reports | Google Drive links on budget page | — | not identified/fetched |

Note: today's page also lists FY28 budget-cycle meetings (Oct-Dec 2026); no FY28 document fetched.
No Content-Disposition from server; filename = last URL path segment.

## Headline FY27 (warned; AOE form p. 12)
- Form budget $37,048,854 (incl. $2,229,945 federal programs, p. 11); offsetting revenues $4,912,223; **education spending $32,136,631**; LTWADM 2,157.00; per pupil $14,898.76; equalized rate $1.6837; CLA/adj. 137.03%; town homestead rate $1.2287; income cap 2.45%.
- Ballot/operational budget $34,818,909 (+4.59% over $33,289,732) — letter p. 4, flyer p. 22.
- **Vote result:** March 3, 2026, school budget YES 696 / NO 198 (901 ballots) per City Clerk Official Return of Votes https://winooskivt.gov/DocumentCenter/View/10778/ORV-3326-Final (scan; read from extracted text). Record left `warned` because the staged document predates the result.

## Staged records (all from form p. 12, arithmetic re-added)
FY2024 approved ($20,740,015; eqpup 898.24), FY2025 approved ($29,171,428; 2,166.90), FY2026 approved ($30,597,445; 2,005.63), FY2027 warned ($32,136,631; 2,157.00). All four ADM bands null (flagged); adopted_date null.

## Discrepancies (flagged in records, resolution pending)
- Form budget $37,048,854 vs ballot/flyer $34,818,909 (federal budget difference).
- Flyer FY26 rate $1.25, 2005 pupils, $15,262/pupil vs form $1.2403, 2,005.63, $15,255.78. Flyer 4.60% vs letter 4.59% (recomputed 4.594%).
- FY27 form input cells yellow-shaded; "<--See bottom note" with no note; no PRELIMINARY/ESTIMATES stamp.
- CLA printed as "CLA divided by Statewide Adjustment" — recorded as ratio, labelled recorded_as_other.

## needs_decision
- Whether to promote FY2027 to `approved` using the Clerk's return (adopted_date 2026-03-03) — I did not, since it is outside the staged document.
- FY2024 column (offsetting revenue $8.8M, equalized pupils 898.24) looks anomalous; recorded as printed.

## Not read / ask the district
Treasurer's report and audit (pp. 13-21) and program/object/function budget pages (pp. 5-10) not analysed in detail. Ask for FY25/FY26 annual reports as direct PDFs and the FY27 line-item budget.
