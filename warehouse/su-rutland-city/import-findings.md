> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/rutland-city (Rutland City Supervisory District, SU040) — FINDINGS

**Site:** https://www.rutlandcitypublicschools.org/ ; budget page https://www.rutlandcitypublicschools.org/central-office/school-finance
**Registry mismatch:** registry/collector URL `http://rutlandcitypublicschools.org/` is only the home page (301 to www); not stale, but the budget page is the useful source. `collectors/su-rutland-city/config.yaml` staged with it.

## Documents found
| FY | Type | URL | Size | Staged |
|---|---|---|---|---|
| 2027 | Board deck, Jan 13 2026 (ratification + ballot language), 3 pp | https://resources.finalsite.net/images/v1769031233/rutlandcitypublicschoolscom/tzhwrlnzxqjykxsdldu7/2026January13_SB_FY27BudgetRatificationandApprovalofFY27BudgetBallotLanguage.pdf | 50,795 B | yes |
| 2027 | Finance Committee deck, Jan 6 2026, 7 pp | https://resources.finalsite.net/images/v1769031298/rutlandcitypublicschoolscom/jdjlctllktmhhztvqvx2/2026January6_FCUpdate_FY27BudgetProposal.pdf | 150,120 B | yes |
| 2026 | Board deck Jan 14 2025; City Aldermen deck Jan 21 2025 (linked on the same page) | resource-manager/view/d2a918b5-cc33-4804-b021-7647a8fad9ca, .../b5f8154f-7970-49c3-abb7-dd2055ed57d9 | not fetched | no (FY26 is covered by the prior-year column of the FY27 decks; not opened) |
| 2025-26 | City of Rutland annual report (rutlandcity.org, city site, not the district's) | https://www.rutlandcity.org/wp-content/uploads/2025/11/WEB_Rutland-City-Annual-Report-7.1.2024-6.30.2025.pdf | not fetched | no (not the district's own site; FY25 report, has a school budget table but not read) |

No annual report or AOE "Three Prior Years Comparisons" form was found on the district site. Filenames: server sent no Content-Disposition, so the last URL path segment was used. Both files were fetched via the Finalsite redirect from the page's "HERE" links.

## Staged
- intake/su-rutland-city/fy2027/ (2 PDFs + provenance.yaml)
- warehouse/su-rutland-city/fy2027-warned.yaml, fy2026-approved.yaml
- collectors/su-rutland-city/config.yaml

## Headline FY27 figures (Jan 13 deck PDF p. 2; Jan 6 deck pp. 3-5; $ thousands, slides are images read from renders)
- Budget (expenses) $69,836 (ballot $69,836,000), +3.9% / +$2,649 vs FY26 $67,187
- Federal & local revenue $26,640 (FY26 $23,831), includes $3,150 working capital
- "State Funded" $43,196 (FY26 $43,356) = expenses − revenue
- LTW ADM 3,410.51 (FY26 3,554.77 in Jan 13 deck); per pupil education spending $12,665.5 (ballot: $12,666, 3.8% higher)
- Vote, March 3 2026 (City of Rutland official results xlsx, https://www.rutlandcity.org/wp-content/uploads/2026/03/Election-Results-March-3-2026.xlsx): Yes 1,688, No 1,520 — passed. The district's own pages state no result.
- FY26 vote, March 4 2025: Yes 2,296, No 1,346 (https://www.rutlandcity.org/wp-content/uploads/2025/03/Election-Results-March-4-2025-3.xlsx)

## Discrepancies / flags
- No AOE form → `education_spending` left null in both records (nearest figure: "State Funded"). Ask the district for the AOE Three Prior Years Comparisons form for FY27.
- FY26 LTW ADM: 3,554.85 (Jan 6, per pupil $12,196.3) vs 3,554.77 (Jan 13, $12,196.6). Not reconciled.
- No per-town homestead rate or CLA printed (single town, town/rutland-city, left null). Jan 6 p. 6 chart shows FY26 rate $1.6058 only (unlabeled whether equalized/town); FY27 rate not printed.
- FY26 record is `approved` because the March 2025 city results show the budget passed; the slides label it only "FY26 Budget".
- No ADM grade bands printed.

## needs_decision
None. Member districts: 1 (the SU is one district). Whether a slide-deck-only source should back a warehouse record without an AOE figure is the lead's call.

## Not read
The FY26 decks, the city annual report, the Jan 20 2026 legislative testimony (states $12,666 per pupil, $69.8M), Herald articles (not used for figures).
