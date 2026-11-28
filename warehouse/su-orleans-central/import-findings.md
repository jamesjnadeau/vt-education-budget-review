> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/orleans-central (Orleans Central SU, AOE SU034) — FY2027

## Sites
- Registry: http://www.ocsu.org/ (current; redirects to https://www.ocsu.org/). No mismatch. Member LRUHS also uses http://www.lruhs.org/.
- Documents page: https://www.ocsu.org/documents/school-boards/board-annual-reports/435544 (FY11..FY27 annual reports + FY27 budget-detail sheets).

## Documents found (all FY27, March 2026 votes)
| Doc | Size | Staged? |
|---|---|---|
| 2025-2026 LRUEMSD Annual Report 2-3-26 | 26.1 MB | yes (intake) |
| 2025-2026 Lake Region Union High School Annual Report | 2.4 MB | yes (intake) |
| OCSU FY27 Budget Detail 2.13.26 (SU central budget, 7 pp.) | 83 KB | yes (intake) |
| LRUEMSD FY27 Budget Detail 2.13.26 (75 KB), LRUHS FY27 Budget Detail 2.13.26 (117 KB) | small | no: brief says one doc per district; line items are in the annual reports' category/function pages. Available at the same documents page if wanted. |
| Older annual reports (FY11-FY26) | — | no |
No Content-Disposition is sent; filenames are the last URL path segment (query `?disposition=inline` dropped). No 2025-26 OCSU (SU-level) annual report is listed; the SU budget is in the Budget Detail sheet. No AOE "Three Prior Years Comparisons" form is in either annual report (searched text of both). Prior-year (FY24-FY26) columns appear on the revenue and category pages instead.

## Member districts that set their own budgets: 2 (registry says 2, confirmed)
No warehouse records written (2+ districts). Staging is intake-only. The SU's own budget (OCSU, $12.9M) is raised by assessments on the two districts; it is part of their budgets, so adding it would double count.

## needs_decision — FY27 figures per district (as printed)
**LRUEMSD** (warning: Albany, Barton, Brownington, Glover, Irasburg, Westmore; annual meeting Mon 2026-03-09, 6 pm) — PDF p. 6 (Art. 8B), p. 53, p. 54
- Budget $18,460,455 (FY26 $18,073,758; +2.14%). Capital reserve add'l $1,000,000 is a separate article (9B).
- Revenue (est.): earnings $70,763; facility rent $4,000; prior-year fund balance $1,000,000; E-rate $65,000; **education spending grant $17,320,692**; total $18,460,455 (re-added: matches).
- LTW ADM FY27 1,347.24 (FY26 1,295.12). Per pupil $17,320,692 / 1,347.24 = $12,856.43 (recomputed 12,856.43); FY26 $12,957.26; -0.78%. Tax rate (ed spending / $9,212 SA yield) 1.3956 vs FY26 1.5074.
- Prior columns (revenue page, FY24/FY25/FY26 est.): total revenue $13,522,012 / $17,012,947 / $17,665,143; ed spending grant $12,368,186 / $15,868,947 / $16,781,202. Category page budgets: FY25 $17,028,799, FY26 $18,073,758.
**LRUHSD** (annual meeting 2026-03-18 per local news; warning Art. 8B) — PDF p. 4 (warning), p. 20 (revenue/LTW), p. 21
- Budget $11,635,978 ($11,635,977.62 on category page; FY26 $10,252,360.45; +13.50%). Revenue page says variance +13.68% / $1,399,890 vs FY26 revenue total $10,236,088 (different base than the 13.50% on the category page).
- Revenue (est.): tuition $470,000; interest $32,770; voc transp $33,000; **education spending grant $10,643,640**; balance carry forward $250,268; tech center $180,000; driver ed $10,000; HS reform $1,300; E-rate $15,000; total $11,635,978 (re-added: matches).
- LTW ADM FY27 687.74 (FY26 682.59). Per pupil $10,643,640 / 687.74 = $15,476.26 (recomputed 15,476.26); FY26 $13,945.41; +10.98%. Tax rate 1.6800 vs 1.6223.
- Prior ed spending grant: FY24 $6,200,077; FY25 $8,959,536; FY26 $9,321,137.55 (est.).
**OCSU (SU central)** — Budget Detail PDF: FY27 proposed $12,911,297.44; FY26 adopted $12,462,568.48; FY25 adopted $11,448,966.00 (+3.60%). Not read in detail beyond totals.

## Discrepancies / notes (recorded, not reconciled)
- Warning text for both districts lists towns Albany, Barton, Brownington, Glover, Irasburg, Westmore; the school-board list adds Orleans (village, former Orleans Incorporated SD). Registry puts Westmore under LRUHSD only and Orleans (as orleans-id) under LRUEMSD only. Needs a human to settle town membership before any tax.towns records.
- Revenue pages are labelled ESTIMATED (FY26 and FY27 columns); the reports are not AOE forms. Per-pupil/ed-spending figures are district-calculated, using 2026 state yield $9,212 (FY26 "updated" yield $8,596).
- FY27 assessment method changed to enrollment-based: ~+$500,000 to LRUHS, ~-$500,000 to LRUEMSD (printed footnote in both reports).
- LRUHS revenue-page variance (13.68%) vs category-page variance (13.50%) differ (different baselines).
- LRUEMSD PDF p. 54-55 repeats the same page content twice (layout artefact). The LRUEMSD page-53 heading shows overlapping text ("Estimated Budget Revenues 2026-27" / "Lake Region..."), extraction only.
- Neither report gives per-town homestead rates or CLAs.
- Orleans Central Unified Union SD merger vote was set for 2026-11-03 (ocsu.org news); result not found; first unified budget would be FY28.

## Vote results (March 2026)
Result not found on ocsu.org or lruhs.org. Local press only previews the votes (Newport Daily Express: LREMS https://www.newportvermontdailyexpress.com/news/lrems-proposes-18-5-million-budget-with-2-14-percent-increase-ahead-of-annual-meeting/article_f9c57679-9285-427c-900b-f9681723744f.html; LR https://www.newportvermontdailyexpress.com/news/lr-board-seeks-approval-for-11-6-million-budget/article_c006f16a-97d3-4a03-b813-1d873fa0c9e3.html). Outcomes unknown; both FY27 budgets would be `warned`, not `approved`, until a source is found.

## Not read
Narrative sections, minutes, school reports, and the full line-item pages of the three PDFs; LRUEMSD/LRUHS standalone budget-detail sheets; AOE-published FY27 forms.

## Ask the district
- The AOE FY27 "Three Prior Years Comparisons" forms for each district and the certified March 2026 vote results.
- Per-town CLAs/homestead rates, and confirmation of which towns belong to each district.
