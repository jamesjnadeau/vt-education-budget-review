> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/two-rivers (Two Rivers Supervisory Union, SU063) — FINDINGS

**Status: partial.** FY27 documents staged; no warehouse records (2 member districts set their own budgets).

## Sites
- Registry/collector URL `http://su.trsu.org/` is stale: 301 to `https://su.trsu.org/`, then redirects to a Google sign-in. Live site: **https://www.trsu.org/home** (Google Sites). `collectors/config.yaml` staged with the new URL.
- Annual-report index: https://www.trsu.org/boards/annual-reports (subpages `gmusd-annual-reports`, `lmhuusd-annual-reports` not read).

## Documents (FY2027 = 2026-27, vote March 3, 2026)
Downloaded and staged in `intake/su-two-rivers/fy2027/` (Drive `uc?export=download&id=`, filenames from Content-Disposition):
| File | Bytes | Notes |
|---|---|---|
| 2025-26 GMUSD Annual Report.pdf | 2,802,784 | GMUSD annual report + FY27 budget; text layer; AOE form PDF p.58 |
| 2025-26 LMHUUSD Annual Report.pdf | 21,309,456 | LMHUUSD annual report + FY27 budget; text layer; AOE form PDF p.43 (over 15 MB but it is the district's primary document) |
| TRSU FY27 Central Office Board Approved Budget 1-8-26.pdf | 33,264 | SU's own central-office line items, 10 pp |

Seen, NOT downloaded (links on the district page's Drive folders; all small): GMUSD folder (`1DjmNk49JgjCOqZKJmS3qegWC4ucMZDEO`): Detailed Board Approved Budget.pdf, EdSpend prior years v05.pdf, Budget Warning/Annual Meeting Warning PDFs, three xlsx. LMHUUSD folder (`18N5fXxBJNHsO4bkPTp9yt5BEDeeuf1qi`): FY27 LMHUUSD Detailed Board Approved Budget.pdf, EdSpend prior years v05.pdf, Budget Warning, Annual Meeting Warning, xlsx. TRSU folder (`1EuqWAaOQqtvt5oiNcIoq0QNTQLW1T1RL`): Special Education and Transportation board-approved budget PDFs, 3 xlsx. Candidates for a follow-up pass (the Detailed Budget PDFs add line items).
Also not read: GMUSD Tax Rate Information 3/2/26 (Drive file `1pDeuiPVJy6CiYkxpyDOjgFY6TSiBWE1N`), LMHUUSD Budget Fact Sheet, FY26 and earlier annual reports.

## needs_decision
Two member districts set their own budgets, so **no warehouse records were written**. Is a TRSU-level record wanted, and how should the districts roll up? Figures as printed on each district's AOE "Three Prior Years Comparisons" form (stamped **PRELIMINARY / ESTIMATES ONLY**), FY2027 column:

| | GMUSD #77 (PDF p.58) | LMHUUSD #83 (PDF p.43) |
|---|---|---|
| Warned budget (line 1/6) | $19,341,997 | $10,455,017 |
| Offsetting revenues (line 10) | $806,229 | $416,541 |
| **Education spending (line 11)** | **$18,535,768** | **$10,038,476** |
| Pupils, LTWADM (line 12) | 1,154.11 | 611.32 |
| Ed spending per pupil (line 13) | $16,060.66 | $16,420.98 |
| Equalized homestead rate (line 27) | $1.8150 | $1.8557 |
| Income cap % (line 30) | 2.64% | 2.70% |
| Towns (FY27 rate, all 100%) | Andover, Baltimore, Cavendish, Chester | Ludlow, Mt. Holly |

Prior-year columns on the same forms (FY24 / FY25 / FY26 education spending): GMUSD $13,859,578 / $14,871,955 / $17,293,122; LMHUUSD $7,289,501 / $8,211,241 / $9,828,315. FY24 pupil counts (668.16; 328.29) are equalized pupils, not LTWADM; FY25+ are LTWADM.
Arithmetic re-checked: budget − revenue = education spending, and education spending ÷ pupils = per-pupil, for both districts' FY27 columns. Both reconcile.

TRSU central office (SU's own budget): FY27 proposed $2,142,151 (revenue = expense), vs FY26 $1,961,098; SU assessments $1,679,497 regular + $421,654 tech support (p.1). Line 7 ("S.U. assessment") is blank on both districts' AOE forms.

## Vote results
- **GMUSD: FY27 level-service budget FAILED on March 3, 2026.** Superintendent letter "GMUSD Budget 3/6/26": https://docs.google.com/document/d/1BqAhYGkTuRY2rkM-ZcOopW6dC5z_gUr0M0Wx1Qkx69s (board to meet March 19 on how to proceed). A later letter, "GMUSD Thank You 5/12/26" (https://docs.google.com/document/d/1OPuNIt7zFyK-ZvIUrM8-gCdir9heOpLj0k0Kux7JgM8), says "The school budget passed, 427 to 279." The revote date, the revised budget amount and any re-warned figures are not stated in anything I read. The $19,341,997 in the annual report is therefore NOT the adopted amount. A revised-budget document is needed.
- **LMHUUSD: passed.** "LMHUUSD Thank You 3/6/26" (https://docs.google.com/document/d/1vqDiecps-j1FSSc1D8CNz7YNpyrVRmR_YiDGtwMyRLI) thanks voters for "its successful passage" of the level-service budget; no counts given, vote date not stated in the letter (the report gives March 3, 2026).

## Discrepancies inside the documents (not reconciled)
- GMUSD: budget increase printed as **3.84%** (narrative, PDF p.17) vs **3.83%** (budget summary, PDF pp.56-57). Recomputed $714,319 / $18,627,678 = 3.835%.
- GMUSD: AOE form line 15 shows $162.74 for FY27 SpEd excess, but line 25 equals line 13 ($16,060.66), so it was not subtracted; LMHUUSD line 15 shows $62.74, same pattern. Not investigated further.
- Both forms: stamped PRELIMINARY / ESTIMATES ONLY; the 2025 hearing minutes in the GMUSD report carry an "unapproved" header.
- LTWADM vs AOE FY27 LTWADM file (education.vermont.gov, FY27 LTWADM.xlsx): GMUSD 1,154.19 (report 1,154.11), LMHUUSD 611.36 (report 611.32). Second source seen only in a search snippet; not downloaded.

## Not read
Only the AOE form pages, budget summary pages and the superintendent's budget narratives were read. Board minutes, reports, audits and the town-meeting warnings were not. The warnings (Drive PDFs) would give the exact warned article amounts.

## Ask the district
1. GMUSD revote date and the re-warned/revised FY27 budget.
2. Board-approved final budget documents and the post-vote AOE form.
