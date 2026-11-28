> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/lamoille-north (SU025) — Lamoille North Supervisory Union

**Site:** https://www.lnsd.org/ (Finalsite). Budget index: https://www.lnsd.org/community/finance-information ;
FY27 page: https://www.lnsd.org/community/finance-information/lnmuusd-fy27-budget-information-resource-page
**Registry mismatch:** registry/collector URL http://lnsu.cloudaccess.net/ is stale (does not resolve). Staged a corrected `collectors/config.yaml`.

## Structure (counted from the documents)
Registry lists 2 member districts; the documents confirm 2 budget-setting districts, plus the GMTCC tech-center budget:
- LNMUUSD #058A (PreK-6 elementary): Belvidere, Eden, Hyde Park, Johnson, Waterville
- LNMUUSD #058B (7-12, plus GMTCC): Belvidere, Cambridge, Eden, Hyde Park, Johnson, Waterville
Both have separate AOE forms and separate votes. => **No warehouse records staged** (2+ budget-setting districts).

## Documents found
| Year | Doc | URL | Size | Staged |
|---|---|---|---|---|
| FY27 | 2026 Annual Report (50 pp, Canva) | https://resources.finalsite.net/images/v1770388071/lnsuorg/c9dcrhigjjx4a1x9q0lo/LNMUUSD2026AnnualReport.pdf | 34.2 MB | yes |
| FY27 | Annual Warning | https://resources.finalsite.net/images/v1769014426/lnsuorg/e7ozfhyfthfntn2bu0ic/LNMUUSDFY27AnnualWarning.pdf | 1.1 MB | yes |
| FY27 | Annual Meeting minutes 2/16/26 (incl. 3/3/26 vote results) | https://resources.finalsite.net/images/v1773071133/lnsuorg/culmmokosj4p27oxmc85/LNMUUSDAnnualMeeting2-16-26.pdf | 148 KB | yes |
| FY27 | Per-district budget/revenue/ed-spending tables, pie charts, SU Shared Services (PDFs on the FY27 page); Canva presentation | on FY27 page | small | no (annual report already reproduces the tables; not downloaded) |
| FY27 | Prelim. budget presentation (Board minutes 1/12/26) | https://resources.finalsite.net/images/v1768920396/lnsuorg/lui9ef1yinozeiizl05x/LNSU-LNMUUSDBoardMeetingMinutes01-12-2026post.pdf | n/r | no (preliminary numbers; superseded) |
| FY20–FY26 | Prior annual reports listed under "Previous Budgets & Annual Reports" | lnsd.org/community/finance-information | – | not fetched (out of scope: latest year preferred) |

No Content-Disposition from server; filenames are URL last path segments. Staged under `intake/su-lamoille-north/fy2027/` with `provenance.yaml`.

## Headline FY27 figures (AOE "Three Prior Years Comparisons", annual report PDF p. 38 = #058A, p. 43 = #058B; read from 200-dpi renders, all columns re-added)
Both forms are stamped **PRELIMINARY / ESTIMATES ONLY** (Dec 1, 2025 Education Fund Outlook; yield $8,849 / income yield $12,154).

| | #058A elementary | #058B 7-12 + GMTCC |
|---|---|---|
| Warned budget (row 1) | $19,154,689 | $26,512,055 (= $21,956,152 secondary + $4,555,903 GMTCC) |
| Offsetting revenues (row 10) | $1,943,936 | $6,444,722 |
| Education spending (row 11) | $17,210,753 | $20,067,333 |
| LTWADM (row 12) | 1,156.51 | 1,547.81 |
| Ed spending per pupil (row 13/25) | $14,881.63 | $12,964.98 |
| Warning text per LT ADM / % change | $14,882 / +4.31% | $12,965 / +5.74% |
| Union equalized homestead rate (row 27) | 1.6817 | 1.4651 |
| Prorated union homestead rate (Belvidere, Eden, Hyde Park, Johnson, Waterville) | 0.8600 each | 0.7158 each; Cambridge 0.6887 |
| Prorated union income cap % | 1.25% each (union 2.45%) | 1.04% each; Cambridge 1.00% (union 2.13%) |

Prior-year columns (#058A / #058B): 
- FY26: budget 17,307,730 / 24,378,609; revenue 1,518,048 / 4,925,939; ed spending 15,789,682 / 19,452,670; pupils 1,106.72 / 1,586.58; per pupil 14,267.10 / 12,260.76.
- FY25: 16,738,061 / 23,853,283; 1,257,547 / 4,580,065; 15,480,514 / 19,273,218; 1,079.94 / 1,583.89; 14,334.61 / 12,168.28.
- FY24: 15,877,742 / 20,368,235; 2,217,599 / 4,925,786; 13,660,143 / 15,442,449; 586.04 / 857.09 (equalized pupils, not comparable); 23,309.23 / 18,017.30.
Arithmetic checks: budget − revenue = ed spending and spending ÷ pupils = per-pupil both reproduce for every column.

**Vote (March 3, 2026, per annual-meeting minutes):** Art. XII #058A passed 482–340 (1 blank); Art. XIII #058B passed 678–452 (2 blank, 1 spoiled); Art. XIV GMTCC passed 828–299 (6 blank). The FY27 page shows a "Budget Approved" banner image.

## needs_decision (2 budget-setting districts → no warehouse records)
Whether to model #058A and #058B as `ud/lamoille-north-modified-a-058` / `-b-058` records (figures above), and how to treat the tax rates: the printed town rates are *prorated union rates* (A rate 0.8600 = 1.6817 × 51.14% share), not combined town rates, and no CLA is printed. Also the registry has the SU `towns=[]`.

## Discrepancies / oddities
- AOE forms are PRELIMINARY/ESTIMATES ONLY (annual report issued before the legislature set yields).
- Row 14 ("less net eligible construction costs per pupil") shows $722.24 (A) / $95.47 (B) for FY27 and $771.48 / $345.13 for FY26, yet row 13 already equals row 25 (14,881.63 / 12,964.98), i.e. not netted on the form as printed. Not reconciled.
- Warning page: the #058B budget article ($21,956,152) differs from the form's row 1 ($26,512,055) by the GMTCC budget; consistent, not a conflict.
- Minutes' Feb 16 text says elementary "6.9% general fund increase"; form shows 10.7% (19,154,689 / 17,307,730) total. Not reconciled (different bases).
- Per-town table right-hand column ("FY27 Pe…", 51.14% / 48.86% / 47.01%) is clipped; read as each district's share, interpretation is inferred.

## Not read
PDF pp. 33–37, 39–42, 44–48 (budget charts, line-item tables, GMTCC, treasurer, reserves) viewed only as a thumbnail contact sheet; the narrative pp. 1–32, 49 only skimmed via text layer. Prior-year annual reports and the Canva presentation not opened.

## Ask the district for
Nothing essential. Optionally: the final (post-legislature) AOE forms, and per-town combined homestead rates with CLA.

## Large files (over 30 MB)

These were first held back from the import for size and were then added to the PR. They are in `intake/` as received. Notes below are the provenance notes for each file, with the records that cite it.

### LNMUUSD2026AnnualReport.pdf

- **Path:** `intake/su-lamoille-north/fy2027/LNMUUSD2026AnnualReport.pdf`
- **Size:** 34,174,962 bytes (34 MB)
- **sha256:** `bf4989cd8a6f9c018d2a86dbbf5386f881f6e766b5b25b873ec6a1ac8e8f5a20`
- **Source:** https://resources.finalsite.net/images/v1770388071/lnsuorg/c9dcrhigjjx4a1x9q0lo/LNMUUSD2026AnnualReport.pdf
- **Records citing it:** none (no records for this SU: see the status above)
- **Provenance note:** Annual report for the March 2026 vote on the FY2027 budgets (50 pages, created in Canva 2026-02-05; internal title "FINAL FOR PRINTING- 2026 Annual Report", author Rene Thibault). Carries the AOE "Three Prior Years Comparisons" forms for district #058A (PDF p. 38) and #058B (PDF p. 43), FY2024-FY2027 columns, both stamped PRELIMINARY / ESTIMATES ONLY. Pages 33-48 (budget charts, line-item tables, the two AOE forms, GMTCC tables, treasurer's and reserves reports) are images with no text layer, so figures were read from 200-dpi renders. The server sent no Content-Disposition header; the filename is the URL's last path segment. Saved byte-for-byte as downloaded.
