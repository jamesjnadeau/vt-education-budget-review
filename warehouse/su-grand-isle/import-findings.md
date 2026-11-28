> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/grand-isle (Grand Isle Supervisory Union, SU024) — findings

Retrieved 2026-11-28. Status: partial. No warehouse records written (3 member districts set their own budgets).

## Sites
- SU: https://www.gisu.org/ (budget page https://www.gisu.org/page/budget). Registry http://www.gisu.org/ is current (redirects to https); no mismatch. collectors/config.yaml staged only to replace the bare home-page source with the budget page and the three member board pages.
- Members (documents + SU site): Alburgh Town SD (alburghschool.org), Champlain Islands UUSD #66 (grandisleschool.org; towns Grand Isle, Isle La Motte, North Hero), South Hero Town SD (gofolsom.org). Registry lists only 1 member (CIUUSD); the documents show 3 districts. Registry is incomplete.

## Documents found
| FY | Document | URL | Size | Staged |
|---|---|---|---|---|
| 2027 | GISU Expense Budget (SU's own, 7 pp) | drive id 1nXwv08oT_OqNkD6lq0nd0lWrxncYYVo9 | 94,192 B | yes |
| 2027 | GISU Revenue Budget (1 p) | drive id 1AV2Pv_iNM6QgGjJfQUr8yoM9HxtJzq-O | 31,417 B | yes |
| 2027 | Alburgh annual-meeting warning (Mar 3 2026) | drive id 1aKtf6QzjG1_Cid_rcQLX4fvjg6ptBuA7 | 218,378 B | yes |
| 2027 | South Hero annual-meeting warning (scan) | drive id 1f_v04Jw-KjnixRl6OxcLEoU_U7yxbw17 | 542,229 B | yes |
| 2027 | Alburgh budget revote warning (Jun 2 2026), "Alburgh_Official_Warning_6-2-26 Complete.pdf" | drive id 1ZZbx1iq64rwgMkJvTiY5iPApD_eSSUnk | 254,464 B | no (one doc per district; read, see below) |
| 2027 | GISU / Alburgh / CIUUSD / South Hero budget presentations | Google Slides | n/a | no: Slides are not downloadable originals |
| 2027 | Per-district "Detailed Budget Information" | Drive folders linked from member pages | not listed | no: folders not opened |
| 2026 | GISU FY26 presentation, member FY26 warnings/flyers/folders | linked from budget page | n/a | not downloaded |

Not found: CIUUSD FY27 warning or annual report (its board page no longer shows FY27 links); no AOE "Three Prior Years Comparisons" form for any of the four entities; no combined SU annual report. Not read: Drive folders, slide decks, recordings, flyers, minutes.

## Headline FY27 figures (as printed)
SU office budget (FY27 Exp Budget p. 1-7; Revenue p. 1; the SU assesses this to members):
- General fund total 10,097,514 (section totals sum to 9,827,515 plus a 270,000 "FY25 Deficit Drawdown" line = 10,097,515, off by 1). With "Building based Paraeducators" 2,146,257 the printed total is 12,243,771.
- State and local revenue 5,110,525 (local 26,500; transport aid 316,971; special-ed offsets 4,767,054).
- Computed: 10,097,514 - 5,110,525 = 4,986,989 net to members (my arithmetic, not printed). FY26 budget 8,942,768; FY25 budget 7,828,572.
- No education spending, LTWADM, per pupil, or tax rate for the SU (SU has no AOE form).

Member districts (from warnings):
- Alburgh: Mar 3 2026 Art. 2 expend $8,315,766; per pupil $14,008, +6.9%. Result: FAILED 201-256 (unofficial; https://www.mynbc5.com/article/town-meeting-day-2026-issues-1772578160/70596772). Revote Jun 2 2026: $8,265,766; per pupil $13,917, +6.21% (warning, read but not staged). June 2026 revote result: not found. (A mynbc5 snippet, https://www.mynbc5.com/article/school-budget-votes-tuesday/60714330, reports an Alburgh revote failing 100-136, but it carried no date and is probably an earlier year's revote; not used.) AOE memo of Mar 17 2026 snippet shows Alburgh in its failed-budget table with ed spending 7,700,766 and $14,007.25/LTWADM (snippet only, memo not read in full; https://legislature.vermont.gov/Documents/2026/Workgroups/House%20Ways%20and%20Means/Bills/H.949%20Yield%20Bill/W~Kelly%20Murphy~School%20Budgets%20Update~3-17-2026.pdf).
- South Hero: Mar 3 2026 Art. 1 expend $5,752,407; per pupil $16,469, +5.27%. March 2026 vote result not found.
- CIUUSD: no district document found. Legislature JFO analysis (preliminary, AOE data 2026-03-09): FY27 ed spending $11,148,809, LTWADM 676.77, $16,474/pupil (https://legislature.vermont.gov/Documents/2026/Workgroups/House%20Ways%20and%20Means/Bills/H.949%20Yield%20Bill/W~Julia%20Richter~Excess%20Spending%20Analysis%20Chart~4-30-2026.pdf). Vote: passed 440-417 (unofficial, mynbc5 link above).

## Discrepancies
- Expense budget: FY27 total includes the 270,000 deficit drawdown, but the FY26 printed total (8,942,768) equals the section sum and excludes the 471,000 FY26 drawdown line. The two years are not on the same basis. Not reconciled.
- FY27 section sum + drawdown = 10,097,515 vs printed 10,097,514.
- South Hero file name says 2025; content is the 2026 (FY27) warning.

## needs_decision
No warehouse records written because 3 districts set budgets. Per-district FY27 figures above. Decide: (a) whether the SU office budget (assessed to members, no AOE form) should get its own warehouse record; education_spending would be null. (b) Whether to stage Alburgh's revote warning as a separate record.

## Ask the district
CIUUSD FY27 warning/annual report and the AOE Three Prior Years Comparisons forms for all three districts; the Alburgh and South Hero adopted-budget documents; the SU assessment table per member.
