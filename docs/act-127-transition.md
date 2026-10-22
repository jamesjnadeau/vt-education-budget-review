# The Act 127 tax-rate transition (Act 84 of 2024, as amended)

When Act 127 of 2022 replaced equalized pupils with weighted long-term membership, some
districts' share of the statewide pupil count fell, which raises their per-pupil spending and
so their tax rate. Act 84 of 2024 gives those districts a homestead rate decrease in fiscal
year 2025 that phases out over four more years. This page records what the law says, how the
engine applies it, and what the FY2026 rate table showed before and after.

It answers the questions in [act-127-transition-plan.md](act-127-transition-plan.md), Step 2.

## Sources on file

| What | Where |
|---|---|
| 2024 Acts and Resolves No. 84 (H.850), Secs. 3 and 5, verbatim | [`model/statute/2026-10-22/act-2024-084-secs-3-5.txt`](../model/statute/2026-10-22/act-2024-084-secs-3-5.txt) |
| 2024 Acts and Resolves No. 183 (H.887), Secs. 16, 17 and 25, verbatim | [`model/statute/2026-10-22/act-2024-183-secs-16-17-25.txt`](../model/statute/2026-10-22/act-2024-183-secs-16-17-25.txt) |
| Both acts as enacted (PDF and full text extraction) | [`intake/vt-legislature/2024-acts/`](../intake/vt-legislature/2024-acts/) |
| AOE's per-district FY2025 decrease worksheet, 2024-02-08 | [`intake/aoe-guidance/2024-02-08-act-84-tax-rate-discount/`](../intake/aoe-guidance/2024-02-08-act-84-tax-rate-discount/) |

All were fetched from `legislature.vermont.gov` with `npm run vt:fetch` on 2026-10-22, with
provenance records beside them. The operative text is Act 84, Sec. 3, an uncodified
session-law section. It is not in the Vermont Statutes Online, so it is cited to the act.

## The rule

**Who gets a decrease and how big.** For each district, AOE computes its share of statewide
FY2025 weighted membership twice: under the FY2024 formula and under Act 127's formula
(Sec. 3(a)). The relative change between the two shares is the district's percentage (Sec. 3(b)).
Then Sec. 3(c):

> a school district shall receive a decrease to its homestead property tax rate in fiscal year
> 2025 equal to $0.01 for every relative percent decrease calculated under subsection (b)

As amended by Act 183 (below), the sentence ends "divided by the statewide adjustment, rounded
to the nearest whole cent." A district whose share rose gets nothing
(Sec. 3(f)). The rule is one-sided, which is why the published rates were only ever below the
chain and never above it.

**The phase-out.** Sec. 3(c)(1)–(4) give the district a decrease of 80, 60, 40 and 20 percent of
its FY2025 decrease in fiscal years 2026, 2027, 2028 and 2029. Nothing applies from FY2030 on.

**Divided by the statewide adjustment.** Act 183, Sec. 16 rewrote Sec. 3(c) to insert "divided
by the statewide adjustment" after "relative percent decrease calculated under subsection (b)
of this section", ahead of the rounding. Act 183, Sec. 25(b) makes Sec. 16
effective July 1, 2025, so the division applies from FY2026. The statewide adjustment entered
the billed-rate formula in the same year, as the divisor in CLA ÷ SA. Dividing the decrease by
SA keeps its dollar effect on a bill about where the FY2025 figure put it.

**The floor.** Sec. 3(d): if the decrease would take a district below $1.00, "the rate shall
instead be $1.00."

**Mergers.** Act 183, Sec. 17 adds Sec. 3(g), effective on passage:

- A merged district takes the greatest decrease available to any of its predecessors.
- A district that withdraws from a district with a decrease gets none, and the district it
  leaves keeps its decrease.
- A dissolved district's successors get none.

**Income percentage.** Under Sec. 3(e), a district's income percentage "shall be calculated
according to the decrease under this section." This is **not modelled** (see the gaps below).

## Answers to the plan's questions

1. **What is adjusted?** The district's equalized homestead rate. The decrease is subtracted
   after the spending adjustment and before the CLA ÷ SA division into billed rates.
2. **Compared against what?** The district's own share of FY2025 weighted membership under the
   old and new formulas. AOE computes this once; the engine takes the resulting FY2025 decrease
   as an input.
3. **One- or two-sided?** One-sided (Sec. 3(f)).
4. **Schedule.** FY2025 is the full decrease, then 80, 60, 40 and 20 percent for FY2026–FY2029.
   These are the parameter `tax.transition.phase_out_share` in `model/parameters/fy2025.yaml`
   (1), `fy2026.yaml` (0.8) and `fy2027.yaml` (0.6).
5. **Order with excess spending.** The decrease comes off the finished equalized rate, so it is
   applied after the § 5401(12) excess is added. Marlboro (over the threshold, no decrease)
   still reproduces. Norwich (over the threshold, decrease 0.19) does not; see the residuals.
6. **The floor of one.** Both apply, in order: the § 5401(13)(A) floor on the spending
   adjustment, then the decrease, then Sec. 3(d)'s $1.00 floor on the result. Buels Gore's
   1.0000 is neither. AOE's worksheet notes that unorganized towns and gores are not eligible
   and that 16 V.S.A. § 4031 sets their rate at one.
7. **Scope.** Every district AOE listed: towns and unions alike, with the merger and withdrawal
   rules of Sec. 3(g).
8. **Inputs.** One per district: **the FY2025 decrease**, in dollars. AOE's worksheet is the
   only published per-district list found, and it lists only eligible districts. A district not
   on it is taken as 0, and the fixtures say so in their `source`.

## How the engine applies it

`transitionRate` in [`model/src/tax.ts`](../model/src/tax.ts), called from `townRate`:

```
decrease  = round( FY2025 decrease × phase_out_share / statewide_adjustment , 3 places )
rate      = max( equalized rate − decrease , rate_floor )
billed    = rate / (CLA / SA)                       (unchanged)
```

- The step is skipped (`transitionDecrease: null`) for fiscal years whose parameter file has no
  `tax.transition.phase_out_share`, which is how the step ends after FY2029.
- An FY2025 decrease that is not supplied makes the rate `not_computable`. The engine does not
  assume zero, because zero is wrong for about half of Vermont's districts.
- The modelling page has an optional field for it, "Act 84 transition decrease". The share-link
  parameter is `act84_decrease`.

### The three-place rounding is a convention, not statute

Read literally, the amended Sec. 3(c) divides the per-percent figure by the statewide
adjustment, rounds that to the nearest whole cent, and then takes 80 percent of it for FY2026,
unrounded. That reading reproduces only 57 districts. Read the other way, with the division and
the 80 percent applied to the FY2025 cents AOE already published, the text says nothing about
rounding the result. The candidates were tried against the FY2026 table with no
district-specific tuning:

| Rounding of FY2025 decrease × 0.8 ÷ 0.7236 | Districts reproduced, of 97 |
|---|---:|
| Unrounded | 61 |
| To four places | 61 |
| To two places (whole cents) | 54 |
| 0.8 × (FY2025 ÷ SA, rounded to cents): the literal reading | 57 |
| **To three places** | **86** |

Three places is what the Tax Department evidently does, and it is the only candidate that is
not contradicted by most of the table. The engine follows it and the node's note says it is a
convention. This is the one point where the table, not the text, chose between readings. It should be confirmed with the Department (or in its rate letter) before
anyone countersigns the parameter files. The difference is at most half a tenth of a cent on
the equalized rate.

## What the FY2026 table showed

Before: the plain chain reproduced 51 of the 97 one-to-one districts to four places. (The
first run reported 50; the recount uses the same 0.0001 tolerance as the fixtures.) The
published rate was lower than the chain for 42 and higher for 4.

After: 86 of 97 are reproduced, with the FY2025 decreases taken from AOE's worksheet and 0
for every district not on it. That includes all 51 earlier matches, unchanged. All 37 worksheet
districts that join one-to-one are among the 97; two worksheet rows (North Bennington ID and
Windsor Central UUSD) do not join one-to-one and are not counted. The remaining 11:

| District | Chain | Published | Why, as far as is known |
|---|---:|---:|---|
| Buels Gore | 1.8362 | 1.0000 | Unorganized gore; 16 V.S.A. § 4031 sets the rate at one. Not a transition case. |
| Norwich | 2.4038 | 1.9183 | Decrease 0.19 accounts for 0.21. The rest is consistent with a bond or other exclusion from excess spending; § 5401(12) exclusions are not entered. |
| Hartford | 1.8781 | 1.7994 | Decrease 0.06 accounts for 0.066 of 0.0787. Same likely cause as Norwich. |
| West River Modified Union Education District B | 1.8605 | 1.7207 | Not on the worksheet; the district postdates it. Possibly a Sec. 3(g) merger successor. |
| Mountain Views School District | 2.1845 | 2.0936 | Not on the worksheet; a successor district. Possibly Sec. 3(g). |
| North Country Sr UHSD | 1.4859 | 1.4251 | Not on the worksheet under this name. Possibly Sec. 3(g). |
| Canaan | 2.0938 | 2.0638 | Not on the worksheet; 0.03 lower. Unexplained. |
| Orleans Southwest UESD | 1.8128 | 1.8195 | Published **above** the chain. Not a transition effect. |
| Bellows Falls UHSD | 1.4801 | 1.4886 | Published above the chain. |
| Mt. Anthony UHSD | 1.2660 | 1.3044 | Published above the chain. |
| Lamoille North MUSD B | 1.4263 | 1.5241 | Published above the chain. |

The last four are probably not about the transition at all. Each is a modified or high-school
union where AOE's per-pupil figure and the Tax Department's district rate may not describe the
same entity. None of the 11 has a fixture; each needs a reason read from a document before it
gets one.

## Golden fixtures

| Fixture | FY2025 decrease | FY2026 decrease | Checks |
|---|---:|---:|---|
| [`ud-addison-central-55-fy2026.yaml`](../model/goldens/ud-addison-central-55-fy2026.yaml) | 0.13 | 0.144 | District rate and all seven town rates |
| [`ud-champlain-valley-56-fy2026.yaml`](../model/goldens/ud-champlain-valley-56-fy2026.yaml) | 0.17 | 0.188 | District rate and four of five town rates |
| [`ud-mt-abraham-61-fy2026.yaml`](../model/goldens/ud-mt-abraham-61-fy2026.yaml) | 0.02 | 0.022 | District rate and all four town rates |
| [`town-colchester-fy2026.yaml`](../model/goldens/town-colchester-fy2026.yaml) | 0.08 | 0.088 | District rate only |
| `ud-slate-valley-62`, `town-marlboro` | 0 (not listed) | 0 | Unchanged |

Williston and Colchester's billed rates are left out of the fixtures, and the tolerance was not
widened to fit them. Both miss by just over one unit in the fourth place because the Tax
Department divides by CLA ÷ SA rounded to four places, which the engine does not. That decision
is open in [`handoff.md`](../handoff.md); it is unrelated to the transition.

## Gaps

- **Income percentage (Sec. 3(e)).** The income-sensitized rate for households claiming the
  income adjustment should reflect the decrease. `incomeBasedRate` does not yet take it.
- **Sec. 3(g) mergers and withdrawals.** Not modelled as a rule. The user supplies the
  district's FY2025 decrease; for a successor district, that number has to come from applying
  3(g) by hand to its predecessors' worksheet rows.
- **FY2028 and FY2029.** No parameter files exist yet. Each needs `phase_out_share` (0.4 and
  0.2) cited to Sec. 3(c)(3)–(4). From FY2030 the key is simply absent.
- **The FY2025 decrease is an AOE figure.** It is an input with a source, never a parameter.
  The worksheet's FY2026–FY2029 columns predate Act 183 and are not divided by the statewide
  adjustment. Do not use them.
