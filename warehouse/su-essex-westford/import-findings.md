> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/essex-westford (Essex-Westford Supervisory District, SU065) - FY27

- Site: https://www.ewsd.org/ (registry URL matches; no collector change staged). Budget page: https://www.ewsd.org/page/ewsd-budget-fy27 ; archive: https://www.ewsd.org/page/ewsd-budget-archives
- Member district count 1 (Essex Westford Educational Community USD #51; towns essex-junction, essex-town, westford), so warehouse records were written.

## Documents found
| Year | Type | URL | Size | Staged |
|---|---|---|---|---|
| FY27 | Annual report (10-pp Canva flyer-style, image-only) | https://aptg.co/Kh415_ -> https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/3564/Ewsd/1e989930-b9b9-4e83-a8ec-fe2ba28911b3/2026-EWSD-Annual-Report-%28FINAL%29.pdf | 28.8 MB | yes (intake/su-essex-westford/fy2027) |
| FY27 | Budget Book (241 pp, ClearGov, text layer) | https://aptg.co/qZBPDq -> https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/3564/Ewsd/8c982f7d-8efa-43cb-91ff-fade8559801f/FY27-EWSD-Budget-Book.pdf | 25.8 MB | NO - over the 15 MB second-document limit (under 100 MB). Worth a human decision: it holds line items and the 2025 official vote results. Only skimmed (TOC, p. 221 results). |
| FY27 | Annual meeting warning, survey results, slideshow | linked from the budget page | - | not fetched |
| FY26 | Annual report, budget report | https://www.ewsd.org/page/ewsd-budget-fy26 (aptg/5il.co links) | - | not fetched |

## FY27 figures (annual report; image-only, read from renders)
- Budget $102,014,901 (pp. 4, 6) / $102,014,902 (p. 5, warning p. 8); offsetting revenues $21,753,415; net education spending $80,261,486; LTWADM 5,547.36; $14,468 per LTWADM (+2.82%); equalized homestead rate $1.5582 after $0.0768 credit. Town rates after CLA: Essex Junction 2.0838, Essex Town 2.0902, Westford 1.0427 (CLAs not printed).
- FY26 column: budget $94,712,480; revenues $18,142,310; education spending $76,570,170; LTWADM 5,441.46; $14,072.
- Vote (April 14, 2026): Article 2 FY27 budget passed 1,875-1,165 (https://www.ewsd.org/article/2822090). CTE budget $9,747,737 (Art. 4) passed 2,325-708, separate and not included.
- The FY26 vote (April 8, 2025) passed 2,646-1,501 per the budget book p. 221 (not staged).

## Discrepancies / caveats
- No AOE "Three Prior Years Comparisons" form is in the annual report; "Net Education Spending" comes from the district's own table, so FY24/FY25 records could not be written. The budget book may carry the form (not checked).
- $1 differences between $102,014,901 and $102,014,902.
- Westford rate lower than the equalized rate; CLAs not printed. Rates are after the Act 127 credit. Essex Town/Junction rates are pending reappraisal.
- No Content-Disposition from the server; filename from the URL.

## Records staged
warehouse/su-essex-westford/fy2027-warned.yaml, fy2026-approved.yaml. adopted_date null for both (the report doesn't state dates).

## Ask the district for
The AOE education spending form / "Three Prior Years Comparisons" page for FY27 as a text PDF; per-town CLAs.
