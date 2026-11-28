> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/windsor-southeast (SU052) — findings, retrieved 2026-11-28

**Status: partial.** 3 member districts set their own budgets (Hartland, Mt. Ascutney, Weathersfield; confirmed by the
SU budget book and the AOE FY27 LTWADM file; registry listed 1 member, Mount Ascutney, which is incomplete). **No warehouse
records written.** Raw documents staged for Hartland, Weathersfield and the SU-wide FY28 book. Mt. Ascutney FY27 AOE form not found.

## Sites
- Registry: http://www.wsesu.net/ → current (redirects to https://www.wsesu.net/en-US, JS-rendered SchoolBlocks). Not stale, but links no budget PDFs.
- Budget book site: https://budget.wsesu.net/ (FY28 live draft; entire-book PDF https://budget.wsesu.net/pdf/wsesu-fy28-budget-book.pdf).
- School Boards page: https://www.wsesu.net/en-US/pages/4e29b4d1-c4ad-44c1-97d8-1e3f5ef30974 (only Google Drive folders of agendas/board docs; not browsed).
- collectors/config.yaml updated (registry entry had kind other, no years).

## Documents
| Year | Document | URL | Size | Staged |
|---|---|---|---|---|
| FY27 | Hartland 2026 Town Report (embeds WSESU 2026-2027 Budget Book, Hartland edition; AOE 3-yr form PDF p.153) | https://hartlandvt.gov/vertical/sites/%7B47DC8B4F-778B-408C-BB00-EA7AC4E090E5%7D/uploads/Hartland_Town_Report_2026(1).pdf | 11.2 MB | yes, intake/…/fy2027 |
| FY27 | Weathersfield "FY2025 Town Report" (Feb 2026; embeds budget book, Weathersfield edition; AOE 3-yr form PDF p.110) | https://www.weathersfieldvt.org/DocumentCenter/View/419/FY2025-Town-Report | 32.8 MB | yes, intake/…/fy2027 |
| FY28 | WSESU FY28 Budget Book (live draft, all 3 districts, FY27 budget columns, no AOE form) | https://budget.wsesu.net/pdf/wsesu-fy28-budget-book.pdf | 12.0 MB | yes, intake/…/fy2028 |
| FY27 | Mt. Ascutney SD (Windsor / West Windsor) annual report or budget book | NOT FOUND. Windsor's town-report page lists only through FY2024 (printed Mar 2025); West Windsor's 2025 report (Feb 2026, 3.9 MB) has no school budget; Drive folders not browsed | – | no |

Not read: the FY28 book beyond targeted pages (172 pp. text layer searched, not read in full); Hartland/Weathersfield pp. other than the tax calc and AOE form pages; Hartland warning (p.154, image) and Weathersfield warning.

## needs_decision (per-district FY27 figures; no records because 2+ budget-setting districts)
Both AOE forms are stamped **PRELIMINARY / ESTIMATES ONLY**, read from images (Hartland 260 dpi, Weathersfield 200 dpi); columns re-added.
FY2027 columns are the proposal printed pre-vote. FY23-FY24 pupils are equalized pupils, FY25+ LTWADM (not comparable).

**Hartland SD** (T094; Hartland PDF p.153, p.151 agrees):
| | FY24 | FY25 | FY26 | FY27 |
|---|---|---|---|---|
| Budget | 9,991,128 | 10,950,028 | 11,225,926 | 11,814,613 |
| Offsetting revenue | 429,319 | 232,364 | – | 200,000 (FY25 surplus) |
| Education spending | 9,561,809 | 10,717,664 | 11,225,926 | 11,614,613 |
| Pupils | 418.61 | 660.71 | 641.19 | 645.85 |
| Per pupil | 22,841.81 | 16,221.43 | 17,507.96 | 17,983.45 |
FY27: excess-spending threshold 16,470, over by 1,513.45 → 19,496.91; yield 9,212; equalized rate 2.1165, 2.0735 after 0.043 discount; CLA 81.00%; homestead rate 2.5599 (FY26 2.4324, +5.2%).
Vote result: **not found** (Hartland ballot/results page not located).

**Weathersfield SD** (T227; Weathersfield PDF p.110):
| | FY24 | FY25 | FY26 | FY27 |
|---|---|---|---|---|
| Budget | 7,487,050 | 8,363,626 | 8,891,228 | 9,953,590 |
| Offsetting revenue | 98,292 | 449,919 | – | – |
| Education spending | 7,388,758 | 7,913,707 | 8,891,228 | 9,953,590 |
| Pupils | 355.00 | 590.57 | 566.36 | 574.42 |
| Per pupil | 20,813.40 | 13,400.12 | 15,698.90 | 17,328.07 |
FY27: threshold 16,470, excess 449.61 → 17,777.68; yield 9,212; eq rate 1.9298, 1.8868 after 0.043 discount; CLA 86.00%; homestead 2.1940.
**Vote:** this $9,953,590 budget was defeated 440–268 on 2026-03-03 (https://vnews.com/2026/03/04/weathersfield-voters-reject-town-and-school-budgets/); a revised ~$9.8M budget passed 363–221 on 2026-04-14 (https://vnews.com/2026/04/15/weathersfield-school-budget-approved). The printed form is therefore not the adopted budget. AOE March memo lists Weathersfield at 9,953,590 / LTWADM 574.42-ish (per-pupil 17,327.47); the AOE excess-spending file of 5/18/26 shows 9,807,090 net of exclusions 234,625 (different basis; not reconciled).

**Mt. Ascutney SD** (U086; towns Windsor, West Windsor): no AOE form found. From the FY28 book (p. ~132): FY27 general fund budget $16,624,852 (all state/local revenue lines: local $1,526,474, state $15,098,378). Implied education spending 15,098,378 (= budget − 1,526,474) matches AOE's 5/18/26 excess-spending file; FY27 LTWADM 886.91 (AOE file). Per pupil 17,024 in the FY28 book table (p.25-26). Vote result not found. Not an AOE-form figure.

## Discrepancies / flags
- Registry lists 1 member district; actual 3 (AOE FY27 LTWADM file lists Hartland, Weathersfield, Mount Ascutney USD).
- Hartland CLA 81.00% (AOE form p.151/153) vs 0.8007 "CLA ÷ SA" in FY28 book table (p.25-26) — different basis, not reconciled.
- Hartland FY27 offsetting revenue is a one-time $200,000 surplus (FY28 book says so).
- Weathersfield printed form is the defeated proposal (see above).
- FY28 book is a live draft regenerated from the site; hash will change.

## Ask the district
1. Mt. Ascutney SD: FY27 annual report / AOE three-year form and warning (Windsor and West Windsor town reports).
2. A standalone FY27 SU budget book PDF (all three editions) and certified March/April 2026 vote results for each district (Hartland, Mt. Ascutney, Weathersfield revote).
3. Revised Weathersfield April 2026 budget AOE form.
