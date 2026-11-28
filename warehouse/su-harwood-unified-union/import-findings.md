> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/harwood-unified-union (AOE SU042) — findings, 2026-11-28

**Sites.** District site: https://huusd.org (budget index https://huusd.org/budget-annual-reports; FY27 page https://huusd.org/budget-fy2027).
Registry/collector URL http://www.wwsu.org/ is the old Washington West SU domain (still 200, stale); replaced in `collectors/config.yaml`.

**Member districts.** One: Harwood Unified Union School District #60 (ud/harwood-60; Duxbury, Fayston, Moretown, Waitsfield, Warren, Waterbury). The annual report confirms a single budget for all six towns, so warehouse records are allowed.

## Documents
| FY | Document | URL | Size | Staged |
|---|---|---|---|---|
| 2027 | FY2027 Budget and Annual Report (24 pp, text layer; AOE form p. 22) | https://drive.google.com/uc?export=download&id=1kaF9WGFx1F7attxtYUkLKPsrPHMOsWop | 5,327,518 | yes |
| 2027 | Annual Meeting Warning and Sample Ballot (4-page image-only scan) | https://drive.google.com/uc?export=download&id=10HDDRx1BhPCMpWh5GXLDyMaP76AyguIj | 2,600,261 | yes (only p. 1 read) |
| 2027 | Budget presentations Nov 19 2025 – Feb 4 2026, other Google Slides/Docs, HUUSD Voting Record (Google Sheet) | linked from the FY27 page | not checked | no |
| 2018–2026 | Earlier annual reports | listed on https://huusd.org/budget-annual-reports | not checked | no (FY26 report was not opened) |

Not read: warning PDF pp. 2–4 (budget and maintenance-reserve articles, sample ballot); the voting-record sheet; the FY2028 page that already appears on the budget index; report pages other than 19, 22, 23 (page 18 and the p. 22 text were skimmed).

## Headline FY27 figures (annual report, preliminary AOE form p. 22; summary p. 19)
- Budget $51,884,847 (+5.44% over FY26 $49,209,927). Offsetting revenues $9,283,479. **Education spending $42,601,368.**
- LTWADM 2,625.05 (raw enrollment 1,787). Per pupil $16,228.78 (+4.80%). Threshold $16,470.
- Equalized homestead rate $1.8340; $1.7570 after $0.077 cent discount; same for all six towns. Income cap 2.67%.
- Vote: Australian ballot March 3, 2026 (warning p. 1). District blog "FY27 Budget Passes" (https://huusd.org/blog/fy27-budget-passes) gives no count. Waterbury Roundabout: passed 2,104–1,343; $500,000 maintenance reserve 2,687–736 (https://www.waterburyroundabout.org/news-archive/by-a-wide-margin-voters-approve-519m-harwood-budget-4t3x2). Not verified against the town/district voting record sheet.

Prior-year columns (p. 22): education spending FY24 $38,511,662 (1,720.16 *equalized* pupils, $22,388.42), FY25 $40,376,282 (2,647.61 LTWADM, $15,250.09), FY26 $41,188,115 (2,659.72, $15,485.88). All columns re-added: budget − revenue = education spending; spending/pupils = printed per-pupil.

## Staged
- `intake/su-harwood-unified-union/fy2027/` both PDFs (server filenames, byte-for-byte) + provenance.yaml
- `warehouse/su-harwood-unified-union/fy2027-warned.yaml`, `fy2026-approved.yaml`, `fy2025-approved.yaml`, `fy2024-approved.yaml` (all sourced from the FY27 annual report)
- `collectors/config.yaml`
- `check_su.sh`: 0 errors, no warning naming this SU.

## Discrepancies / flags (recorded, not reconciled)
- p. 23 ballot explainer is headed "MARCH 4, 2025" (should be 2026) and its callout reads $51,844,847; Article V, p. 19 and p. 22 say $51,884,847.
- p. 22 form stamped PRELIMINARY; uses Dec 1, 2025 Education Fund Outlook (yield $8,849; income yield $12,154).
- FY26 income cap percent is 2.54% on line 30 but 2.44% in each town row of the p. 22 table.
- Line 28 describes the cent discount as adjusted by a "70.33%" statewide adjuster; $1.8340 − $0.077 = $1.7570 agrees with line 29.
- FY27 status is `warned` even though the vote passed (document-based; adopted_date null).
- FY25 "approved" column is the revised budget per a third-party site (first proposal defeated Mar 2024); the report itself does not say so.

## needs_decision
- Town homestead rates and CLAs left null: the report prints only the equalized union rate (same for all six towns, no CLA), not town rates. Decide whether to join the Tax Department's CLAs/rates.
- ADM bands null (the report prints only weighted totals).
- Whether FY27 should be recorded as `approved` with adopted_date 2026-03-03 now that the district blog says it passed.

## Ask the district for
Final (post-legislature) AOE form with town CLAs/rates, the March 3, 2026 certified results, and ADM by grade band.
