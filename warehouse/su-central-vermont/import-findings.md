> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/central-vermont (Central Vermont SU, SU068) — FY2027 findings

## Sites
- Registry/collector URL: https://www.cvsu.org/ (200; Finalsite home page). Not stale, but `kind: other` with no pattern; replaced in staged `collectors/config.yaml` by the budget page.
- Budget pages: https://www.cvsu.org/central-office/business-office/fy27-budget-page (also fy26-budget-page). Board pages: /school-boards/{central-vermont-supervisory-union-board, paine-mountain-school-district, echo-valley-community-school-district-board}.
- Members: Echo Valley Community SD #67 (Orange, Washington) and Paine Mountain SD #68 (Northfield, Williamstown). Both set their own budgets; CVSU sets a shared-services budget funded by assessments on them.

## What was staged (intake/su-central-vermont/fy2027/, 15 PDFs, 2.4 MB, all text-layer, byte-for-byte, Drive uc?export=download)
- CVSU (the SU's own budget): `FY27 CVSU Expenditures.pdf`, `FY27 CVSU Revenue.pdf` (board approved 12/18/25), `FY27 CVSU Budget Expenditure REVISIONS MARCH 2026 V.1.1 Reductions.pdf` (3/25/26 revision).
- PMSD: original board-approved (1/21/26) expenditures, revenue, tax-rate pages; revote (3/18/26) expenditures and revenue.
- EVCSD: original board-approved (1/19/26) expenditures, revenue, tax-rate; first revision (Mar/Apr 2026) expenditures + revenue; second revision (5/13/26, for the 6/3 revote) expenditures (includes tax comparison) + a "June" revenue file.
- Not downloaded: Google Slides presentations (EVCSD 2nd revote, CVSU revote revision; not downloadable originals), video recordings, the PMSD "FY27 School Budget & Annual Report" (only linked from a Smore newsletter https://app.smore.com/n/xdfu8-pmsd-budget-newsletter; not fetched), Drive folders of agendas/minutes/audits (not read), older annual reports FY21-FY24 in the "Past Annual Budget Reports" folders (outside FY27 scope).
- No AOE "Three Prior Years Comparisons" form or annual report for the SU was found. The PDFs here are district-built Excel exports. No warehouse records written (2 member districts).

## CVSU's own FY27 budget (shared services)
- Original (board approved 12/18/25): expenditures $15,891,401 (+$576,127, +3.76% vs FY26 $15,315,274); revenue $15,891,401 = local assessments $9,624,300 (EVCSD $1,563,949; PMSD $8,060,352) + state/federal $6,063,798 + other $203,303.
- Revision 3/25/26: expenditures $15,729,229 (+2.70%, -$162,172). No revised revenue sheet found (the "Revote Revenue" link is the same expenditures file).
- Votes: the CVSU budget is approved by the SU board, not voters.

## needs_decision — per-district figures (no warehouse record written)
All from the district PDFs above (not the AOE form). Education spending = expenditures - offsetting revenue (re-added).
| District | Version | Expenditures | Revenue | Ed spending | LTWADM | $/LTWADM | Result |
|---|---|---|---|---|---|---|---|
| PMSD | orig 1/21/26 | 27,342,863 | 1,624,323 | 25,718,540 | 1,706.20 | 15,074 (printed) | failed 3/3/26: 593 yes / 943 no (district page) |
| PMSD | revote 3/18/26 | 26,628,238 | 1,751,840 | 24,876,398 (computed) | not printed in revote files | ~14,580 (computed, using 1,706.20) | passed 4/28/26: 498 yes / 416 no (district page) |
| EVCSD | orig 1/19/26 | 7,476,262 | 316,897 | 7,159,365 | 555.97 | 12,877 (printed) | failed 3/2/26 floor vote 30-33 (EVCSD forum slides, orangevt.org) |
| EVCSD | rev 1 (Mar/Apr) | 7,409,032 | 356,642 | 7,052,390 (computed) | 555.97 | ~12,685 computed | failed 4/28/26: 96 yes / 112 no (district page) |
| EVCSD | rev 2 (5/13/26) | 7,331,175 | 356,642 | 6,974,533 (printed) | 555.97 | 12,545 (printed) | 6/3/26 revote: not on the district page. A mynbc5.com article (https://www.mynbc5.com/article/echo-valley-budget-revote-results/71496074) says it passed 136-118; news only, not verified against a town/district record |
FY26 comparison columns printed: PMSD exp 25,627,305, ed spending 23,349,391, LTWADM 1,704.61, $13,698; EVCSD exp 7,363,338, ed spending 6,678,712, LTWADM 584.31, $11,430. FY25: PMSD 22,529,808 / 20,680,285 / 1,776.51 / 11,641; EVCSD 6,757,517 / 6,252,837 / 597.41 / 10,467.
Homestead rates (rate, CLA) printed in original tax pages: Northfield 2.2854 (CLA 52.42%), Williamstown 1.7659 (67.84%), Washington 1.8266 (56.03%), Orange 1.6079 (63.65%). EVCSD rev 2 (5/13/26): Washington 1.7172, Orange 1.5116 (same CLAs). District page also states revised PMSD rates Northfield $2.13, Williamstown $1.65 (not checked against a PMSD revote tax page; none was published among the files read).
Decision for the human: whether a record per member district (ud/echo-valley-community-67, ud/paine-mountain-68) should be created instead, and which version is the "adopted" FY27 for each (PMSD revote 3/18/26; EVCSD rev 2 if the 6/3 vote passed).

## Discrepancies / oddities
- CVSU revenue sheet: line "Paine Mountain School District (73.75%)" vs footer "PMSD 83.75%"; 83.75% (+16.25% = 100%) matches the dollars. Local assessments print $9,624,300 while the two lines sum to $9,624,301.
- CVSU revenue sheet shows FY26 revenue $15,315,273 vs expenditures $15,315,274; FY25 revenue $13,598,785 vs expenditures $13,415,020 (printed as is).
- CVSU expenditure summary has two columns both headed "FY2025 (2024-2025)" ($13,415,020 and $13,418,496).
- Link labels are swapped/duplicated on the district page: "FY27 CVSU Revote Expenditures" and "...Revenue" both point to the same file; PMSD "Revote Proposed Expenditures" is a 3-page summary and "Revote Proposed Revenue" is a 30-page line-detail file; EVCSD "2nd Revote Proposed Revenue" (JUNE 2026 Revenue.pdf, created 4/10/26) still shows $7,409,032 expenditures, while the 5/13/26 expenditures file contains the $7,331,175 version. PMSD summary cells print #NAME? in the 1/21/26 file.
- EVCSD forum slides (orangevt.org, 6/1/26) give $12,669 per pupil for the April revision; recomputed from the revision PDFs it is ~$12,685 ($7,052,390 / 555.97). Not reconciled.
- Registry `web` for both member districts is the SU site, https://www.cvsu.org/.

## Ask the district for
- The AOE-form annual report / "Three Prior Years Comparisons" for each district (PMSD FY27 annual report is only in a Smore link) and certified results for the 6/3/26 EVCSD vote; the revised PMSD tax-rate page; the CVSU revised revenue sheet and the amended assessments after the 3/25/26 reduction.
