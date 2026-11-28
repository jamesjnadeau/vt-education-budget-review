> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/south-burlington (SU016) — FINDINGS (retrieved 2026-11-28)

**Sites:** district https://www.sbschools.net/ (FY27 page https://www.sbschools.net/page/fy27-budget-information/); city site https://www.southburlingtonvt.gov/.
**Registry mismatch:** registry/collector URL `http://www.district.sf.sbschools.net/` is stale; replaced in `collectors/config.yaml`. SU is a single district (South Burlington School District, 1 town), so warehouse records were written.

## Documents found
| FY | Document | URL | Size | Staged |
|---|---|---|---|---|
| 2027 | Budget Book (city + school, 87 pp, text layer) `Budget Book - Fiscal Year 2027-2028.pdf` | https://drive.google.com/uc?export=download&id=1ozJSc24SbssJX5vapDZV8PMdwBVenVtq | 4,878,433 | yes |
| 2027 | 2026 Annual Meeting Notice (warning, 2 pp, image-only) | https://drive.google.com/uc?export=download&id=1RXvM17U7al_Gk9t0FE1yBSIvn2ofeGps | 111,858 | yes |
| 2027 | "FY27 Approved Budget Proposal" slides (Steering Committee 1/21/2026, 6 pp; server filename `Steering Committee Budget Presentation 1_21_25.pdf`, stale name) | https://drive.google.com/uc?export=download&id=1IoHsjmYjNkJyXxPrQb7VoasVC_-QqTJA | 522,579 | no (adds nothing beyond the book) |
| 2027 | Budget book also on city site | https://www.southburlingtonvt.gov/DocumentCenter/View/5368/ | not fetched | no |
Also linked, not read: tax-calculator Google Sheet, survey summary Google Doc, school budget allocations (5 Drive PDFs), YouTube videos, the "Three Years Prior AOE File" PDF referenced in the book (the book embeds an image of the form).

## FY27 headline figures (AOE form, book PDF p. 27 / printed p. 24; stamped PRELIMINARY / ESTIMATES ONLY)
- Budget $73,939,121; offsetting revenues $12,405,938; **education spending $61,533,183**; LTWADM 3,920.28; per pupil $15,696.12 (+8.52% vs FY26 $14,464.02); equalized homestead rate $1.7738 ($1.7228 after cent discount); town homestead rate $1.7078 at CLA 100.88%; income cap 2.58%. Yield $8,849 (Dec 1, 2025 outlook).
- Prior columns recorded: FY26 ($71,507,854 / ed spend $58,770,072), FY25 ($68,082,002 / $51,601,834), FY24 ($62,528,029 / $49,616,074; equalized pupils, not comparable).
- **Vote:** approved March 3, 2026, School Article II Yes 1,915 / No 1,777 (https://www.southburlingtonvt.gov/697/March-3-2026-Town-Meeting-Day-Results; district page confirms approval). Article III (capital reserve, $2,554,157.57) Yes 2,629 / No 1,016.

## Discrepancies (all flagged in records, not reconciled)
- Per pupil: ballot text $15,696.08 vs form $15,696.12. Total budget $73,939,121 (form, ballot) vs $73,939,121.04 (overview narrative).
- Town homestead rate $1.7078 (form line 33) vs $1.7076 (estimator PDF p. 24 and cover); cent discount rounding 0.036/0.051.
- FY24 uses equalized pupils; FY25 LTWADM; line 25 prints $12,514 for both FY24 and FY25.
- Budget book filename says "2027-2028" but it is the FY2027 (2026-27) book. Slides file name says "1_21_25" but dated Jan 21, 2026.

## needs_decision
- FY2027 record is `warned` (the book predates the vote). District and city sites say the budget passed; a human may promote it to `approved` with adopted_date 2026-03-03.
- Rates/CLAs recorded from the preliminary form (CLA as printed "CLA / statewide adjustment"), not Tax Department figures.

## Not done / not read
ADM grade bands are not printed (left null, flagged). Budget-book line-item pages (revenue/expenditure detail, PDF pp. 25-48) and non-school city sections were not read. FY24-FY26 vote dates not stated in the document (adopted_date null). Nothing larger than 100 MB encountered.
