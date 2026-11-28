> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/addison-central (Addison Central School District, AOE SU003) — FY26, FY27

Retrieved 2026-11-28. Existing FY23-FY25 left untouched. 1 member district (ud/addison-central-55, 7 towns), so warehouse records are allowed.

## Sites
- Current: https://www.acsdvt.org (Budget Development: /district-link/budget-development; FY27: /fy27-budget; FY26: /fy26budget; FY28 process page already live).
- Registry/collector URL http://www.acsu.k12.vt.us/ is the old SU domain and does not respond. Updated in staged `collectors/config.yaml`.

## Documents
| FY | Document | URL | Size | Staged |
|---|---|---|---|---|
| 2027 | Annual Report & FY27 Budget Book (60 pp.) | https://resources.finalsite.net/images/v1771270530/acsdvtorg/acsdvtorg/acsdvtorg/atszblvlqgtwlktou8kv/FY27BudgetBookMaster.pdf | 4.2 MB | yes |
| 2027 | FY27 Budget Overview (4 pp., Canva) | https://resources.finalsite.net/images/v1769024049/acsdvtorg/glhm76snml4rarfrrino/FY27ACSDBudgetOverview.pdf | 5.3 MB | yes |
| 2027 | Earlier version of the budget book (v1770662045) | .../images/v1770662045/acsdvtorg/atszblvlqgtwlktou8kv/FY27BudgetBookMaster.pdf | 4.2 MB | no (superseded; its superintendent message still has FY26 text; sha256 in provenance note) |
| 2027 | Google Doc budget doc / Slides (links on FY27 page) | docs.google.com (document 1p8ReoVG..., presentation 1T_lHVKW...) | n/a | no (Google export, not an original) |
| 2026 | FY26 Voter Overview / Annual Report summary (4 pp., Canva) | https://resources.finalsite.net/images/v1738591692/acsdvtorg/but9z62ierynbxngt5pf/ACSDFY26VoterOverviewAnnualReportFY26Budget5.pdf | 10.5 MB | yes |
| 2026 | FY26 Budget Book Master | Drive id 1JZdB6HYFW2IjpVRNm-4wF2d1OhGlxttxnm0WG_SsowI (viewable embed) | unknown | NO — download endpoints (uc, drive.usercontent, confirm=t) return 404 |
| 2026 | Warnings (Annual Meeting 2025, Australian Ballot 2025) | Drive ids 1Ijgzk-..., 1-rZ7Q3... (78-93 KB, downloadable) | small | no (not needed; no budget figures read) |

## FY27 headline figures (budget book, PDF page refs)
- Warned budget (p. 8, Article 1): $52,999,495; vote March 3, 2026. Total revenues $10,423,357; education spending $42,576,137 (+2.91%) (p. 24).
- LTWADM 2,722.55 (p. 32; 2,722.6 on p. 29 table); per pupil $15,638 (+3.58%), $693 / 4% below $16,331 threshold (p. 32).
- Projected adjusted equalized district rate $1.65 (+2.19%), yield $8,849; income yield $12,154, 2.6% (pp. 32-33).
- Preliminary town rates (p. 35, image): Bridport 1.17 (CLA 141%), Cornwall 1.06 (156%), Middlebury 1.67 (99%), Ripton 1.15 (144%), Salisbury 1.30 (127%), Shoreham 1.19 (139%), Weybridge 1.11 (149%).
- Vote result: district home page (https://www.acsdvt.org/, "Town Meeting 2026 Results") says "overwhelming support" for the FY2027 budget and approval of Ripton Elementary closure. No tally found on district/town sites read; Addison Independent town result pages exist (not read, not relied on).

## FY26 (overview only)
Total expense incl. fund balance $51,719,284; offsetting revenue $10,346,674; ed spending $41,372,610 vs FY25 $40,041,512 (+$1,331,098, 3.32%) (p. 3). Agrees with the FY2026 column of the AOE form in the FY27 book. FY26 vote result: not found. No LTWADM, per-pupil or town rates in the overview.

## Records staged
- warehouse/su-addison-central/fy2027-warned.yaml (towns from p. 35 projection; ADM bands null/left_null).
- warehouse/su-addison-central/fy2026-warned.yaml (towns null with flags; ADM left_null).
- No FY2026 `approved` record written (FY26 is covered by the warned record; the FY27 book's FY2026 column is cross-referenced in its notes).

## Discrepancies (all flagged in the records, none reconciled)
- AOE form (FY27 book p. 11, image) is stale: PRELIMINARY / ESTIMATES ONLY, FY2024-FY2026 columns only, no FY2027 column; district id U055; its FY2026 pupils 2,743.20 / $15,081.88 vs p. 32's 2,740.36 / $15,098.
- Book total expense $52,999,495 vs overview PDF $52,995,189 ($4,306 apart); book total minus revenue is $42,576,138 vs printed $42,576,137 (the overview's figures do not add to its printed ed spending).
- p. 33 income calc uses $15,849 per pupil vs $15,638 elsewhere.
- Running head still reads "FY26 Annual Report and Budget Book".

## Not read / not done
- Book pages other than 5-11, 24-35 and the appendix lists were not read in detail (cost-center sections pp. 36-50, Appendix C/D charts pp. 53-54 are images, Appendix E enrollment tables). No grade-band ADM exists in the book.
- Full FY26 budget book not captured (Drive download disabled). Warehouse FY26 therefore lacks town rates and LTWADM.
- Per-town vote tallies and the Addison Independent results pages were not read.

## Ask the district
- A downloadable PDF of the FY26 Budget Book Master (Drive file has downloads disabled).
- An updated AOE Three Prior Years form with an FY2027 column, and final (non-preliminary) FY27 town rates / CLAs.
- Official FY27 and FY26 vote tallies; clarify the $52,999,495 vs $52,995,189 total.

## needs_decision
None required (single member district). Existing fy2025 record's pending nulls were not touched, per instructions.
