> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/washington-central (AOE SU032) — findings, 2026-11-28

**Single budget-setting district:** Washington Central Unified Union School District (WCUUSD, U092; Berlin, Calais, East Montpelier, Middlesex, Worcester). The SU has 1 member and it is the budget-setting body, so warehouse records are allowed.

## Sites
- Current: https://www.wcuusd.org/ (budget page https://www.wcuusd.org/budget-info ; annual reports https://www.wcuusd.org/budget-info/annual-reports ; votes https://www.wcuusd.org/school-board/vote-results)
- Registry URL http://www.wcsuonline.org/ is stale: it did not respond on 2026-11-28. `collectors/config.yaml` staged to replace it.

## Documents found
| FY | Document | URL | Size | Staged |
|---|---|---|---|---|
| 2027 | WCUUSD Annual Report 2026 (36 pp., AOE form p. 31) | https://cdnm.heyzine.com/files/uploaded/46f4928c9c8eee7638f458e92d07180fc50d5d1a.pdf (source PDF behind the Heyzine flipbook https://heyzine.com/flip-book/46f4928c9c.html, which is what the district links) | 3.28 MB | yes |
| 2027 | FY 27 Final Warned Budget (6 pp. Excel; 3-school version) | https://resources.finalsite.net/images/v1769802816/wcsu32org/j6gjquw3gv0n1ayzeidr/FY27FinalWarnedBudget.pdf | 99.6 KB | yes |
| 2027 | FY 27 Final Detail Budget Sheet (5-school itemization, 4 pp.) | https://resources.finalsite.net/images/v1771623237/wcsu32org/nnzb4ifjwod0e85dp5ow/WCUUSDBudgetFY26-27Final2-11-26DETAIL.pdf | 132 KB | no (one extra document was enough; downloadable) |
| 2027 | FY 27 Final Summary Sheet, Tri-Fold, Quick Facts (jpg), presentations, drafts | district /budget-info | small | no |
| 2027 | Certification of Final Votes, March 3, 2026 (image-only, 4 pp.) | https://resources.finalsite.net/images/v1772631374/wcsu32org/z90f8s5pmgvhy7meh8p2/Voteresults3326_1.pdf | small | no (not a budget document; read for the vote result) |
| 2020-2025 | Annual reports | /budget-info/annual-reports (2023 and 2024 links are malformed) | — | no |

Neither server sent Content-Disposition; files are saved under the last URL path segment (noted in provenance).

## Staged
- intake/su-washington-central/fy2027/{46f4928c9c8eee7638f458e92d07180fc50d5d1a.pdf, FY27FinalWarnedBudget.pdf, provenance.yaml}
- warehouse/su-washington-central/fy2027-warned, fy2026-approved, fy2025-approved, fy2024-approved (all from the annual report's AOE form, PDF p. 31; CLAs from p. 33)
- collectors/config.yaml

## Headline FY2027 (annual report AOE form p. 31; matches p. 32 and the Final Warned Budget)
- Warned budget $43,271,845; offsetting revenues $6,934,032; **education spending $36,337,813**; LTWADM 2,219.40; per pupil $16,372.81 (+7.21% over FY26's $15,271.51 / $15,272 printed); equalized homestead rate $1.7773; income cap 2.58%.
- Town rates (p. 31) / CLAs (p. 33): Berlin 1.9437 / 91.44%; Calais 2.3100 / 76.94%; East Montpelier 2.3016 / 77.22%; Middlesex 2.2136 / 80.29%; Worcester 1.2084 / 147.08%.
- **Vote: approved March 3, 2026, 1,684 yes – 1,379 no** (district clerk's certification, image read, Article 5). Also reported at https://thebridgevt.org/2026/03/voters-approve-washington-central-school-budget/ . FY27 record stays `warned` with adopted_date null because the staged document predates the vote.
- Prior years on the form: FY26 ES $36,203,852 (2,370.68); FY25 $34,180,343 (2,376.88); FY24 $31,697,238 (1,376.82 equalized pupils — not comparable). All arithmetic re-added and matches.

## Discrepancies / flags (details in lines_flagged)
- AOE form is stamped PRELIMINARY ESTIMATES ONLY (Jan 21, 2026 Education Fund Outlook); cent discount line 28 blank.
- Annual report p. 33 tax-rate table has its FY25-26 / FY26-27 column headings reversed relative to the values.
- Worcester FY26 rate $1.2483 does not reproduce from its printed FY26 CLA (80.97% → $2.1941); the other four towns do. Worcester FY27 CLA 147.08% (reappraisal) reproduces.
- Annual report itemizes the budget for 3 elementary schools; the later Final Detail Sheet (not staged) shows the same total for 5 schools.
- FY25 column may be a revote amount (the district page has FY25 revote material); form does not say.
- ADM grade bands not printed (one weighted count) → left_null.

## Needs a human / ask the district
- Whether the AOE form figures were later superseded post-legislative session (final FY27 rates).
- Optional: stage the Final Detail Budget Sheet if the five-school itemization is wanted.

## Not read
Pages of the annual report other than 24 (warning), 26-33 were not read in full; the Final Detail Sheet and Summary Sheet were only skimmed (summary sheet, 5-school version, totals identical). Vote certification pp. 3-4 not viewed. Third-party site hungermountaini.com was used only as a pointer, not as a source.
