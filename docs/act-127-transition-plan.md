# Plan: read and model the Act 127 tax-rate transition

A hand-off for an agent or person with working access to `legislature.vermont.gov`,
`tax.vermont.gov` and `education.vermont.gov`. The session that wrote this could reach none of
them from its container, so everything below that calls for reading a document is still to do.
Everything that calls for arithmetic has been done once and is reproducible from files in the
repository.

## The problem, in numbers

The engine's homestead-rate chain (`model/src/tax.ts`) is, per 32 V.S.A. § 5401(13)(A) and
§ 5402: spending adjustment = max(1, (per pupil spending + excess spending) / property yield);
equalized rate = $1.00 × adjustment; billed rate = equalized rate / (CLA / SA).

Joining AOE's FY2026 EdSpend record (`warehouse/aoe-edspend/fy2026.yaml`: spending, LTWADM,
per-pupil for every district) with the Department of Taxes' FY2026 rate table
(`intake/tax-rates/fy2026/FY26EdTaxRates_081825.xlsx`: CLA, SA, district rate, billed rates for
every town) gives, for the 97 districts that match one-to-one (towns in two union districts
excluded):

| | Districts |
|---|---:|
| Chain reproduces the published district rate to four places | 50 |
| Published rate **below** the chain, by a district-specific amount | 47 |
| Published rate above the chain | 0 |

The full table is at the end of this document. The shortfall is one-sided and varies from
1.3% (Mt. Abraham) to 22.8% (Norwich, which is also over the excess spending threshold).
That is the footprint of a transition rule: districts whose per-pupil spending rose when
Act 127 of 2022 replaced equalized pupils with weighted ADM get a temporary reduction; the
rest get nothing. The engine does not model it, so it is right for half the state and
silently high for the other half. Three golden fixtures record this:
`model/goldens/ud-slate-valley-62-fy2026.yaml` and `town-marlboro-fy2026.yaml` pass;
`ud-addison-central-55-fy2026.yaml` is a `known_disagreement` whose rate assertions run as
expected failures.

**Done means:** the Addison Central fixture passes with its `known_disagreement` block deleted;
Slate Valley and Marlboro still pass unchanged; two or three more transition districts have
fixtures that pass; every rule the engine applies is cited to statute text snapshotted in
`model/statute/`; and nothing was fitted to the Tax Department's table.

## Rules of the road (from the README and docs/parameter-verification.md)

- Nothing goes into a parameter file or the engine from memory. The session that wrote this
  can recall several plausible versions of the transition rule and declined to pick one; the
  repeal of Act 127's original 5 percent cap by Act 183 of 2024 is exactly the kind of change
  a recollection gets wrong.
- Raw documents land in `intake/` or `model/statute/` exactly as released, with a provenance
  record (`provenance.yaml`, SHA-256, URL, date, method, who). CI verifies hashes. Never edit
  an artifact.
- A parameter carries a `citation` block with the operative sentence quoted. `verified: true`
  is set only against current statute or session-law text. Agency tables are evidence for a
  published *figure*, never for a *rule*.
- Do not widen golden tolerances. `rates: 0.0001` is one unit in the last published digit. A
  fixture that will not pass at that tolerance is a finding.
- Do not fit per-district correction factors. A rule that reproduces all 97 rates because it
  was tuned to them teaches nothing and breaks the moment inputs change.

## Step 1 — get the law on file

Fetch with the repo's own tool so the chain repair and user agent are right:

```bash
npm run vt:fetch -- <url> --out model/statute/2026-MM-DD/
```

(Check `tools/src/cli/statute-sync.ts` for how the existing `model/statute/2026-07-29/`
snapshot names files and whether it should be extended to cover session laws; if so, do that
rather than inventing a parallel layout.)

Documents to obtain, in priority order:

1. **Act 183 of 2024 (H.887), as enacted.** The FY2025 yield bill. It repealed Act 127's
   original homestead-rate cap and wrote the transition now in force. Expected location:
   `https://legislature.vermont.gov/Documents/2024/Docs/ACTS/ACT183/ACT183 As Enacted.pdf`
   (verify; the pattern is the Legislature's usual one). Find the section that amends
   2022 Acts and Resolves No. 127, Sec. 7 (the transition), and any section amending
   16 V.S.A. § 4010 or 32 V.S.A. § 5401/5402 with effective dates inside FY2025–FY2029.
2. **Act 127 of 2022 (S.287), as enacted**, Sec. 7 and any other "transition" or
   "implementation" section. Expected:
   `https://legislature.vermont.gov/Documents/2022/Docs/ACTS/ACT127/ACT127 As Enacted.pdf`.
   Needed to read what Act 183 amended, not as the rule itself.
3. **Act 73 of 2025 (H.454)** and **Act 170 of 2026**: search each for amendments to the
   same transition section. Either could have moved the schedule.
4. **The codified notes** under 16 V.S.A. § 4010 and 32 V.S.A. § 5402 on
   `legislature.vermont.gov/statutes/` often reproduce uncodified transition language.
   Cheap to check and already in the fetcher's allowlist.
5. **Agency implementation, for cross-checking only:** the Department of Taxes'
   FY2026 education tax rate letter (December 2024) and FAQ
   (`https://tax.vermont.gov/property/education-property-tax-rates/faqs`), and AOE's FY2026
   tax rate calculation guidance or the "FY26 tax rate" spreadsheet AOE circulates to
   business managers. These show how the State *applied* the rule and which per-district
   inputs it used. They are not authority for the rule.

Record each in provenance before reading it.

## Step 2 — read, and answer these before writing code

Write the answers into a short section of `docs/excess-spending-threshold.md`'s sibling, a new
`docs/act-127-transition.md`, with the operative sentences quoted. The structure matters more
than the numbers.

1. **What is adjusted?** The district's per pupil education spending before the yield
   division, the spending adjustment itself, the equalized rate, or the billed rate?
2. **What is it compared against?** The rate or per-pupil figure the district would have had
   under pre-Act 127 equalized pupils? Its own prior-year rate? A fixed base year?
3. **One-sided or two-sided?** The data show only reductions. Confirm the text does not also
   raise districts that gained weight (if it does, the 50 exact matches need explaining).
4. **The schedule.** Which fiscal years, and what share applies in each (FY2025 through
   FY2029 is the Act 127 implementation window). FY2026 is the year in hand; FY2025 and
   FY2027 parameter files will need their own values.
5. **Order of operations with excess spending.** Is the transition applied before or after the
   § 5401(12) excess is added? Norwich is over the threshold and 22.8% short; Marlboro is over
   the threshold and exact. Whatever the rule is must produce both.
6. **Interaction with the floor of one** in § 5401(13)(A). Buels Gore prints a district rate
   of exactly 1.0000; confirm whether that is the floor, a gore-specific rule, or missing data
   (the sheet's footnote "B" marks missing spending data).
7. **Scope.** Union districts, town districts, both? Any carve-outs (interstate districts,
   districts in merger, districts with tuition-only secondary)?
8. **Inputs per district.** Whatever the rule compares against is a number the engine does
   not have. Name it exactly and find where the State publishes it (AOE's equalized-pupil
   counts for the base year, a prior-year rate table, a transition worksheet). That becomes a
   warehouse record with its own intake artifact, or an engine input the modelling tool asks
   the user for, with `not_computable` as the honest state when it is unknown.

## Step 3 — test the reading against the table before coding

Reproduce the join (the scratch script is not in the repo; it is ten lines on top of
`read-excel-file` and `yaml`, both dependencies): for each FY2026 district, AOE's per-pupil
and LTWADM, the Tax Department's district rate, and the per-pupil the published rate implies
(rate × $8,596, net of excess). Then apply the rule as read, by hand or in a scratch script,
to the 47 shortfall districts **and** the 50 exact ones. The rule is right when it reproduces
all 97 to four places with no district-specific tuning, and is a no-op for the 50. If it
reproduces only some, the reading is wrong somewhere in Step 2; go back to the text, not to
the numbers.

If the rule needs an input not yet on file (Step 2, item 8), fetch that first and record it;
do not back it out of the published rates.

## Step 4 — parameters and statute snapshot

- Add the rule's constants to `model/parameters/fy2026.yaml` (and FY2025, FY2027 as the
  schedule dictates) with full `citation` blocks quoting the snapshot, `verified: true`, and
  `verified_by` saying who read it. Follow the key naming in the file (`tax.*`).
- Add the schema entries if the parameter schema enumerates keys
  (`schemas/parameters-1.0.schema.json`; check).
- `npm run params` should list them; `npm run validate` must pass.

## Step 5 — implement in the engine

- In `model/src/tax.ts`, add the step as its own node(s) with a plain-language `explain`,
  built through the node machinery (`derive`, `product`, `quotient`, `greaterOf`, `lesserOf`
  if needed; see `model/src/node.ts`) so blockers propagate and the walkthrough shows the step.
  Thread any new per-district input through `townRate` as an optional input that defaults to
  "not supplied", in which case the node reports `not_computable` rather than assuming zero
  transition. Mirror how `ExcessSpendingAdjustments` is done.
- Add unit tests in `model/src/engine.test.ts` with arbitrary weights for the arithmetic,
  including the no-op case and the order-of-operations case from Step 2 item 5.
- Extend the golden harness (`model/src/goldens.test.ts`, `Golden.inputs`) for the new input
  and pass it through to `townRate`.
- Update `model/goldens/ud-addison-central-55-fy2026.yaml`: add the new input with its source,
  delete `known_disagreement`. Add fixtures for two or three more shortfall districts of
  different shapes from the table below (suggested: Champlain Valley, a large five-town union;
  Norwich, over the excess threshold; Mt. Abraham, a small shortfall). Slate Valley and Marlboro
  must pass unchanged.
- The site: `site/src/scripts/model-tool.ts` and the model page expose inputs to the user;
  add the new input there with its own rationale text, defaulting to "not supplied".

## Step 6 — write it down

- `docs/act-127-transition.md`: the rule, the sentences, the schedule, the inputs, and what the
  join showed before and after.
- `model/goldens/README.md`: move "Tax-rate transition" from open to closed, update the table.
- `README.md` known gaps and current-state table; `handoff.md`.
- `docs/fy2027-readiness.md`: if FY2027 needs a transition value, add the item.

## While you are there (optional, same access)

- `tax.statewide_adjustment` for FY2027 is null. The FY2027 rate page prints SA 70.33%.
  Fetch the FY2027 table (`https://tax.vermont.gov/ed-rates`, snapshot dated 2026-07-29) into
  `intake/tax-rates/fy2027/` with provenance and enter 0.7033 cited to it. Same for the
  FY2027 yields if the yield act has passed (the FAQ page prints a $9,401 homestead yield).
- Countersigning stays human. Leave `status: draft` on every parameter file unless a person
  has read the snapshots against it.

## Appendix: FY2026 districts, published vs chain

Source: `warehouse/aoe-edspend/fy2026.yaml` (LTWADM, spending, per pupil) joined to
`intake/tax-rates/fy2026/FY26EdTaxRates_081825.xlsx` (district rate) by town name; towns in
more than one union district excluded. Chain rate = max(1, (per pupil + excess) / 8,596) with
excess = max(0, per pupil − 13,497 × 1.18). Implied per pupil = published rate × 8,596 − excess.
Shortfall = (AOE per pupil − implied) / AOE per pupil. Buels Gore is an unorganized gore printing
a district rate of exactly 1.0000 and is probably not a transition case.

| District | Registry slug | Towns | LTWADM | Education spending | Per pupil (AOE) | Chain rate | Published district rate | Implied per pupil | Shortfall |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Buels Gore | `town/buels-gore` | 1 | 5.23 | 82,549 | 15783.75 | 1.8362 | 1.0000 | 8,596 | 45.54% |
| Norwich | `town/norwich` | 1 | 816.35 | 14,935,099 | 18294.97 | 2.4038 | 1.9183 | 14,121 | 22.81% |
| Rutland Town | `town/rutland-town` | 1 | 794.96 | 10,759,251 | 13534.33 | 1.5745 | 1.3865 | 11,918 | 11.94% |
| Stratton | `town/stratton` | 1 | 64.1 | 741,743 | 11571.65 | 1.3462 | 1.1912 | 10,240 | 11.51% |
| Champlain Valley USD | `ud/champlain-valley-56` | 5 | 5683.51 | 88,294,084 | 15535.13 | 1.8073 | 1.6193 | 13,920 | 10.40% |
| Fairfax | `town/fairfax` | 1 | 1231.45 | 17,874,638 | 14515.11 | 1.6886 | 1.5336 | 13,183 | 9.18% |
| Thetford | `town/thetford` | 1 | 566.72 | 9,800,193 | 17292.83 | 2.1707 | 1.9937 | 15,771 | 8.80% |
| Winhall | `town/winhall` | 1 | 327.67 | 4,619,781 | 14098.88 | 1.6402 | 1.4962 | 12,861 | 8.78% |
| Mt. Mansfield UUSD | `ud/mount-mansfield-401` | 4 | 3515.25 | 50,496,414 | 14364.96 | 1.6711 | 1.5271 | 13,127 | 8.62% |
| Georgia | `town/georgia` | 1 | 1200.54 | 17,799,256 | 14826.04 | 1.7248 | 1.5808 | 13,589 | 8.35% |
| Addison Central USD | `ud/addison-central-55` | 7 | 2743.2 | 41,372,610 | 15081.88 | 1.7545 | 1.6105 | 13,844 | 8.21% |
| West River Modified Union Education District B | `ud/west-river-valley-union-education-district-b-72` | 1 | 429.16 | 6,849,304 | 15959.79 | 1.8605 | 1.7207 | 14,758 | 7.53% |
| Pittsfield | `town/pittsfield` | 1 | 72.07 | 742,539 | 10303.02 | 1.1986 | 1.1106 | 9,547 | 7.34% |
| Stowe | `town/stowe` | 1 | 1101.75 | 16,976,196 | 15408.39 | 1.7925 | 1.6705 | 14,360 | 6.81% |
| Montpelier Roxbury School District | `ud/montpelier-roxbury-71` | 2 | 1873.76 | 27,725,667 | 14796.81 | 1.7214 | 1.6104 | 13,843 | 6.45% |
| Essex-Westford ECUUSD | `ud/essex-westford-educational-community-unified-union-sd-51` | 3 | 5441.46 | 76,570,171 | 14071.62 | 1.6370 | 1.5370 | 13,212 | 6.11% |
| Harwood UUSD | `ud/harwood-60` | 6 | 2659.72 | 41,188,115 | 15485.88 | 1.8015 | 1.7015 | 14,626 | 5.55% |
| Vernon | `town/vernon` | 1 | 457.21 | 7,198,025 | 15743.37 | 1.8315 | 1.7315 | 14,884 | 5.46% |
| Colchester | `town/colchester` | 1 | 3653.26 | 52,542,808 | 14382.44 | 1.6732 | 1.5852 | 13,626 | 5.26% |
| Milton | `town/milton` | 1 | 2417.47 | 33,266,933 | 13761.05 | 1.6009 | 1.5239 | 13,099 | 4.81% |
| Mountain Views School District | `ud/mountain-views` | 7 | 1465.41 | 25,427,881 | 17352.06 | 2.1845 | 2.0936 | 16,571 | 4.50% |
| South Hero | `town/south-hero` | 1 | 339.68 | 5,314,295 | 15645.00 | 1.8200 | 1.7430 | 14,983 | 4.23% |
| Hartford | `town/hartford` | 1 | 2152.34 | 34,513,512 | 16035.34 | 1.8781 | 1.7994 | 15,359 | 4.22% |
| North Country Sr UHSD | `ud/north-country-union-high` | 5 | 1444.18 | 18,445,900 | 12772.58 | 1.4859 | 1.4251 | 12,250 | 4.09% |
| South Burlington | `town/south-burlington` | 1 | 4063.19 | 58,770,072 | 14464.02 | 1.6826 | 1.6167 | 13,897 | 3.92% |
| Champlain Islands UUSD | `ud/champlain-islands-66` | 3 | 699.69 | 10,696,720 | 15287.80 | 1.7785 | 1.7125 | 14,721 | 3.71% |
| Mount Ascutney School District | `ud/mount-ascutney-86` | 2 | 924.11 | 14,147,919 | 15309.78 | 1.7810 | 1.7150 | 14,742 | 3.71% |
| Weathersfield | `town/weathersfield` | 1 | 566.36 | 8,891,228 | 15698.90 | 1.8263 | 1.7713 | 15,226 | 3.01% |
| Taconic & Green Regional USD | `ud/taconic-and-green-regional-63` | 8 | 2902.53 | 36,809,483 | 12681.86 | 1.4753 | 1.4313 | 12,303 | 2.98% |
| Hartland | `town/hartland` | 1 | 641.19 | 11,225,926 | 17507.96 | 2.2207 | 2.1658 | 17,036 | 2.70% |
| Strafford | `town/strafford` | 1 | 301.14 | 4,279,353 | 14210.51 | 1.6532 | 1.6092 | 13,833 | 2.66% |
| Quarry Valley UUSD | `ud/quarry-valley-70` | 3 | 1724.09 | 19,293,983 | 11190.82 | 1.3019 | 1.2689 | 10,907 | 2.53% |
| Barre UUSD | `ud/barre-97` | 2 | 3767.88 | 43,239,188 | 11475.73 | 1.3350 | 1.3020 | 11,192 | 2.47% |
| Maple Run USD | `ud/maple-run-57` | 3 | 3915.92 | 58,751,223 | 15003.17 | 1.7454 | 1.7124 | 14,720 | 1.89% |
| Canaan | `town/canaan` | 1 | 258.37 | 4,382,554 | 16962.32 | 2.0938 | 2.0638 | 16,705 | 1.52% |
| Sharon | `town/sharon` | 1 | 511.63 | 6,591,139 | 12882.63 | 1.4987 | 1.4767 | 12,694 | 1.47% |
| Lincoln | `town/lincoln` | 1 | 330.08 | 4,441,395 | 13455.51 | 1.5653 | 1.5433 | 13,266 | 1.41% |
| Mt. Abraham USD | `ud/mt-abraham-61` | 4 | 1938.61 | 28,534,233 | 14718.91 | 1.7123 | 1.6903 | 14,530 | 1.28% |
| Addison NW USD | `ud/addison-northwest-54` | 5 | 1525.58 | 23,116,750 | 15152.76 | 1.7628 | 1.7408 | 14,964 | 1.25% |
| Granville-Hancock Unified District | `ud/granville-hancock` | 2 | 192.43 | 2,269,611 | 11794.48 | 1.3721 | 1.3611 | 11,700 | 0.80% |
| Mettawee School District | `ud/mettawee-84` | 2 | 502.9 | 6,620,380 | 13164.41 | 1.5315 | 1.5205 | 13,070 | 0.72% |
| St. Johnsbury | `town/st-johnsbury` | 1 | 1869 | 24,967,147 | 13358.56 | 1.5540 | 1.5430 | 13,264 | 0.71% |
| Slate Valley UUSD | `ud/slate-valley-62` | 6 | 2341.66 | 27,080,580 | 11564.69 | 1.3454 | 1.3454 | 11,565 | 0.00% |
| Arlington | `town/arlington` | 1 | 635.53 | 8,527,491 | 13417.92 | 1.5609 | 1.5609 | 13,417 | 0.00% |
| Sandgate | `town/sandgate` | 1 | 127.46 | 1,245,463 | 9771.40 | 1.1367 | 1.1367 | 9,771 | 0.00% |
| Caledonia Cooperative UUSD | `ud/caledonia-cooperative-78` | 3 | 1043.74 | 15,888,706 | 15222.86 | 1.7709 | 1.7709 | 15,223 | 0.00% |
| Cabot | `town/cabot` | 1 | 312.75 | 4,479,739 | 14323.71 | 1.6663 | 1.6663 | 14,324 | 0.00% |
| Danville | `town/danville` | 1 | 517.96 | 7,797,467 | 15054.19 | 1.7513 | 1.7513 | 15,054 | 0.00% |
| Twinfield USD | `ud/twinfield-33` | 2 | 596.48 | 8,239,777 | 13814.00 | 1.6070 | 1.6070 | 13,814 | 0.00% |
| Peacham | `town/peacham` | 1 | 174.81 | 2,782,362 | 15916.49 | 1.8516 | 1.8516 | 15,916 | 0.00% |
| Burlington | `town/burlington` | 1 | 6972.03 | 103,360,823 | 14825.07 | 1.7246 | 1.7247 | 14,826 | 0.00% |
| Winooski ID | `town/winooski` | 1 | 2005.63 | 30,597,445 | 15255.78 | 1.7748 | 1.7748 | 15,256 | 0.00% |
| Northeast Kingdom Choice USD | `ud/northeast-kingdom-choice` | 10 | 539.03 | 7,629,243 | 14153.65 | 1.6465 | 1.6465 | 14,153 | 0.00% |
| Northern Mountain Valley UUSD | `ud/northern-mountain-valley-85` | 4 | 2061.22 | 24,153,776 | 11718.19 | 1.3632 | 1.3632 | 11,718 | 0.00% |
| Enosburgh-Richford UUSD | `ud/enosburgh-richford-88` | 2 | 1642.87 | 18,300,146 | 11139.13 | 1.2959 | 1.2959 | 11,140 | 0.00% |
| Missisquois Valley School District | `ud/missisquoi-valley-89` | 3 | 3255.49 | 39,683,045 | 12189.58 | 1.4181 | 1.4181 | 12,190 | 0.00% |
| Fletcher | `town/fletcher` | 1 | 354.22 | 4,357,957 | 12302.97 | 1.4312 | 1.4312 | 12,303 | 0.00% |
| Alburgh | `town/alburgh` | 1 | 553.17 | 7,248,323 | 13103.25 | 1.5243 | 1.5243 | 13,103 | 0.00% |
| Elmore-Morristown UUSD | `ud/elmore-morristown-90` | 2 | 1383.25 | 16,778,678 | 12129.90 | 1.4111 | 1.4111 | 12,130 | 0.00% |
| Oxbow UUSD | `ud/oxbow-91` | 2 | 1236.76 | 16,365,424 | 13232.50 | 1.5394 | 1.5394 | 13,233 | 0.00% |
| Waits River Valley School District | `ud/waits-river-union-high-district-36` | 2 | 787.19 | 8,694,232 | 11044.64 | 1.2849 | 1.2849 | 11,045 | 0.00% |
| Blue Mountain USD | `ud/blue-mountain-21` | 3 | 811.84 | 10,822,015 | 13330.23 | 1.5507 | 1.5507 | 13,330 | 0.00% |
| Orange Southwest USD | `ud/orange-southwest-59` | 3 | 1384.21 | 21,775,142 | 15731.10 | 1.8300 | 1.8300 | 15,731 | 0.00% |
| White River Unified District | `ud/white-river-79` | 2 | 1117.56 | 13,692,476 | 12252.12 | 1.4253 | 1.4253 | 12,252 | 0.00% |
| First Branch USD | `ud/first-branch-82` | 2 | 675.77 | 8,704,725 | 12881.19 | 1.4985 | 1.4985 | 12,881 | 0.00% |
| Rochester-Stockbridge USD | `ud/rochester-stockbridge-81` | 2 | 363.57 | 4,492,634 | 12357.00 | 1.4375 | 1.4375 | 12,357 | 0.00% |
| Coventry | `town/coventry` | 1 | 337.14 | 4,891,216 | 14507.97 | 1.6878 | 1.6878 | 14,508 | 0.00% |
| Washington Central UUSD | `ud/washington-central-92` | 5 | 2370.68 | 36,203,852 | 15271.51 | 1.7766 | 1.7766 | 15,272 | 0.00% |
| Mill River UUSD | `ud/mill-river-52` | 4 | 1273.42 | 17,287,875 | 13575.94 | 1.5793 | 1.5793 | 13,576 | 0.00% |
| Craftsbury | `town/craftsbury` | 1 | 331.86 | 5,269,535 | 15878.79 | 1.8472 | 1.8472 | 15,879 | 0.00% |
| Wolcott | `town/wolcott` | 1 | 442.91 | 5,926,711 | 13381.30 | 1.5567 | 1.5567 | 13,381 | 0.00% |
| Otter Valley UUSD | `ud/otter-valley-53` | 6 | 2030.42 | 27,440,152 | 13514.52 | 1.5722 | 1.5722 | 13,515 | 0.00% |
| Barstow UUSD | `ud/barstow-49` | 2 | 433.67 | 6,173,236 | 14234.87 | 1.6560 | 1.6560 | 14,235 | 0.00% |
| Rutland City | `town/rutland-city` | 1 | 3554.77 | 43,356,000 | 12196.57 | 1.4189 | 1.4189 | 12,197 | 0.00% |
| River Valleys USD | `ud/river-valleys-73` | 2 | 402.3 | 6,397,169 | 15901.49 | 1.8499 | 1.8499 | 15,902 | 0.00% |
| Marlboro | `town/marlboro` | 1 | 219.73 | 3,593,846 | 16355.74 | 1.9527 | 1.9527 | 16,356 | 0.00% |
| Windham Southeast School District | `ud/windham-southeast-96` | 4 | 3807 | 60,345,162 | 15851.11 | 1.8440 | 1.8440 | 15,851 | 0.00% |
| Halifax | `town/halifax` | 1 | 178.49 | 2,274,705 | 12744.16 | 1.4826 | 1.4826 | 12,744 | 0.00% |
| Readsboro | `town/readsboro` | 1 | 118.43 | 1,674,935 | 14142.83 | 1.6453 | 1.6453 | 14,143 | 0.00% |
| Searsburg | `town/searsburg` | 1 | 46.53 | 603,930 | 12979.37 | 1.5099 | 1.5099 | 12,979 | 0.00% |
| Stamford | `town/stamford` | 1 | 187.71 | 2,258,291 | 12030.74 | 1.3996 | 1.3996 | 12,031 | 0.00% |
| Twin Valley USD | `ud/twin-valley-75` | 2 | 686.27 | 9,786,619 | 14260.60 | 1.6590 | 1.6590 | 14,261 | 0.00% |
| Springfield | `town/springfield` | 1 | 2257.4 | 31,380,696 | 13901.26 | 1.6172 | 1.6172 | 13,901 | 0.00% |
| Green Mountain USD | `ud/green-mountain-77` | 4 | 1184.09 | 17,293,122 | 14604.57 | 1.6990 | 1.6990 | 14,605 | 0.00% |
| Ludlow-Mt. Holly UUSD | `ud/ludlow-mt-holly-83` | 1 | 624.84 | 9,828,315 | 15729.33 | 1.8298 | 1.8298 | 15,729 | 0.00% |
| Rivendell Interstate School District | `ud/rivendell-interstate` | 3 | 551.18 | 7,989,100 | 14494.54 | 1.6862 | 1.6862 | 14,495 | 0.00% |
| Ira | `town/ira` | 1 | 82.45 | 786,223 | 9535.76 | 1.1093 | 1.1093 | 9,536 | 0.00% |
| Wells Spring Unified Union District | `ud/wells-spring-69` | 2 | 477.66 | 6,123,018 | 12818.78 | 1.4912 | 1.4912 | 12,818 | 0.00% |
| Kingdom East USD | `ud/kingdom-east-64` | 8 | 3255.81 | 44,824,278 | 13767.47 | 1.6016 | 1.6016 | 13,767 | 0.00% |
| Paine Mountain School District | `ud/paine-mountain-68` | 2 | 1715.12 | 23,251,106 | 13556.55 | 1.5771 | 1.5771 | 13,557 | 0.00% |
| Echo Valley Community School District | `ud/echo-valley-community-67` | 2 | 584.31 | 6,808,871 | 11652.84 | 1.3556 | 1.3556 | 11,653 | 0.00% |
| Orleans Southwest UESD | `ud/mountain-view-union-elementary-94` | 1 | 542.84 | 8,458,750 | 15582.40 | 1.8128 | 1.8195 | 15,640 | -0.37% |
| Bellows Falls UHSD | `ud/bellows-falls-union-high-27` | 2 | 653.77 | 8,317,622 | 12722.55 | 1.4801 | 1.4886 | 12,796 | -0.58% |
| Mt. Anthony UHSD | `ud/mount-anthony-union-high-14` | 1 | 2935.85 | 31,948,964 | 10882.36 | 1.2660 | 1.3044 | 11,213 | -3.03% |
| Lamoille North MUSD B | `ud/lamoille-north-modified-b-058` | 1 | 1586.58 | 19,452,670 | 12260.76 | 1.4263 | 1.5241 | 13,101 | -6.85% |
| Ferdinand | `town/ferdinand` | 1 | 1.54 | 0 | 0.00 | 1.0000 | 1.0000 | 8,596 | -Infinity% |
| Somerset | `town/somerset` | 1 | 1.15 | 0 | 0.00 | 1.0000 | 1.0000 | 8,596 | -Infinity% |
