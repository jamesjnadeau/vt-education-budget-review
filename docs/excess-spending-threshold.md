# The excess spending threshold and the education tax rate

This document exists because the modeling tool consumes one figure it cannot verify
on its own — the **statewide average district per pupil education spending** used in the
excess spending calculation (32 V.S.A. § 5401(12)) — and because the rule that turns that
figure into a tax consequence has changed twice recently: it was **suspended for
FY2022–FY2025** and then **reimplemented and rebased by Act 183 of 2024**, effective FY2026.
A figure entered without knowing that history would be wrong in a way that looks right.

It maps the authoritative sources below onto the model's parameters and the `inputs:`
blocks in `model/parameters/fyNNNN.yaml`, so whoever fills in a value knows exactly what
it means and where it came from.

## Sources

All retrieved 2026-08-02. The Agency pages and the Tax FAQ change from year to year, so
treat the retrieval date as the "as of."

1. **Excess Spending Threshold Summary and Tax Rate Impact** — Vermont Agency of
   Education, **issue date August 19, 2024** (`edu-excess-spending-threshold-summary-and-tax-rate-impact.pdf`),
   from <https://education.vermont.gov/data-and-reporting/financial-reports/excess-spending-threshold>.
   This is the authoritative statement of the current formula.
2. **Historical Excess Spending Threshold, FY12–FY25** — Agency of Education spreadsheet
   (`edu-historical-excess-spending-threshold-fy12-fy25.xlsx`), same page. Source of the
   [historical table](#historical-threshold).
3. **Education Tax Rate Calculations — FAQ** — Vermont Department of Taxes,
   <https://tax.vermont.gov/property-owners/understanding-property-taxes/education-tax-rates/faqs>.
   Source of the $16,470 FY2027 threshold and the [tax-rate mechanics](#how-the-tax-rate-is-built).
4. **Classifying School Districts by Size and Type of Education Offered: FY2026** — Agency
   of Education per-pupil spending cohort report (`edu-fy26-cohort-spending-by-school-type.xlsx`),
   from <https://education.vermont.gov/data-and-reporting/financial-reports/pupil-spending>.
   Source of the FY2026 statewide averages in [§ FY2026 actuals](#fy2026-actuals).

Only the statute is authority for a *rule*. These State documents are authority for a
*published figure* (an input). Parameters still follow `docs/parameter-verification.md`:
a parameter goes `verified: true` only against the operative sentence of current statute.

<a id="historical-threshold"></a>
## Historical threshold — and the FY2022–FY2025 suspension

Source #2 publishes the **threshold** (the per-pupil level above which the penalty bites),
not the underlying average. Before FY2022 the threshold was 118% of that year's own
statewide average, so the average can be recovered as `threshold ÷ 1.18`.

| Fiscal year | Excess spending threshold |
|---|---|
| FY2012 | $14,733 |
| FY2013 | $14,841 |
| FY2014 | $15,456 |
| FY2015 | $16,166 |
| FY2016 | $17,103 |
| FY2017 | $16,905 |
| FY2018 | $17,386 |
| FY2019 | $17,816 |
| FY2020 | $18,311 |
| FY2021 | $18,756 |
| FY2022 – FY2025 | **Suspended** |

**The threshold was suspended for FY2022 through FY2025.** In those years there was no
excess spending penalty at all. For the model this means the honest state of
`excessSpending` for **FY2025** is not "a figure the State has not published" — it is "the
penalty did not apply." Those are different blanks (see the four-kind blank distinction in
`model/src/types.ts`), so the FY2025 `inputs:` block says so rather than inviting a value
that would compute a suspended threshold.

## How excess spending works now (Act 183 of 2024)

Source #1 states it exactly. Reimplemented **effective July 1, 2025 (FY2026)**, the
threshold is **rebased and frozen onto FY2025**:

> **Excess Spending Threshold = PPS_State × 118% × NEEP_FY25→current FY**

where:

- **PPS_State** is the **FY2025** average statewide per pupil spending — a *frozen* base,
  not each year's own average;
- **118%** is the multiplier — this is the model parameter
  `tax.excess_spending_threshold_ratio` (`1.18`);
- **NEEP** is **New England Economic Project** inflation from FY2025 to the year in
  question. (Not the NIPA deflator — an earlier draft of this note had that wrong; the
  Agency's guidance specifies NEEP.)

Two further rules from Source #1, which the model does **not** yet capture (noted as known
gaps, not silently dropped):

- **District per pupil spending**, the figure compared to the threshold, is current-year
  per pupil spending **plus 150% of capital reserve funds more than 5 years old** that were
  previously excluded (24 V.S.A. § 2804(b)).
- All prior statutory exemptions were repealed (16 V.S.A. § 4001(6)(B)) and replaced by a
  single exclusion: **principal and interest on voter-approved bonds approved before
  July 1, 2024** are not counted in education spending for the excess spending calculation.
  The overage is what gets double-counted; the exclusion shrinks the overage, it does not
  reduce unadjusted education spending.

### What the model input should hold

The model computes `excessSpending` as `statewide_average_per_pupil × 1.18`
(`model/src/tax.ts`). The input therefore is **PPS_State × NEEP_FY25→FY** — precisely the
"statewide average district per pupil education spending, increased by inflation" the input
is named for — i.e. **the published threshold ÷ 1.18**:

| Fiscal year | Threshold (published) | Model input = threshold ÷ 1.18 | Status |
|---|---|---|---|
| FY2025 | Suspended | — | penalty did not apply |
| FY2026 | *not in hand* | *threshold ÷ 1.18* | reimplemented; needs the FY2026 threshold |
| FY2027 | $16,470 (Source #3) | **≈ $13,958** | entered `verified: false`; confirm base × NEEP |

The FY2027 input (`13958`) is **derived**: `16470 ÷ 1.18 = 13957.6`, rounded to whole
dollars to match the Agency's convention, and `13958 × 1.18 = 16470` reproduces the
published threshold. It is entered with `verified: false` because it is derived from the
threshold rather than read as `PPS_State(FY25) × NEEP` directly. To make it exact — and to
fill in **FY2026**, which we do not yet have a threshold for — two figures are needed:

- **PPS_State(FY25)**: the FY2025 statewide average per pupil spending, from the FY2025
  edition of the pupil-spending cohort report (Source #4 is the FY2026 edition);
- the **NEEP inflation factors** FY25→FY26 and FY25→FY27 (Agency / Joint Fiscal Office).

Then each year's input is `PPS_State(FY25) × NEEP_FY25→FY`, and no division rounding is
involved.

<a id="fy2026-actuals"></a>
## FY2026 statewide actuals (context, not the excess base)

Source #4 gives FY2026 **actual** spending, statewide ("All towns, gores & unorganized
towns"):

| FY2026 statewide figure | Value |
|---|---|
| Education spending per LTW ADM (equalized pupil) | **$13,947** |
| Budgeted expenditures per LTW ADM | $16,650 |
| Total education spending | $1,988,399,661 |
| Total long-term weighted ADM | 142,564.12 |

These are the **FY2026 actual** averages, **not** the excess spending base. The excess base
is frozen at FY2025 and inflated (above); do not use $13,947 as the FY2026 excess input.
The figure is recorded here because it is the real statewide average a reader is likely to
look for, and because it is a useful sanity check on the model's per-weighted-pupil output.

<a id="how-the-tax-rate-is-built"></a>
## How the tax rate is built (Source #3), mapped to the model

Each step of the FAQ's homestead-rate walk corresponds to a node the tool already produces
(`model/src/tax.ts`, `model/src/membership.ts`):

| FAQ concept | What it is | Model parameter / function |
|---|---|---|
| Equalized pupils | Weighted long-term membership; the divisor for per-pupil spending | `computeWeightedMembership`, `weights.*` (16 V.S.A. § 4010) |
| Property dollar equivalent yield | Per-pupil spending a $1.00 homestead rate funds (Act 46 of 2015) | `yield.property_dollar_equivalent` |
| Income yield | The income-based counterpart | `yield.income_dollar_equivalent`, `tax.income_percentage_target` |
| Spending adjustment | `(per-pupil + excess) ÷ property yield`, floored (§ 5401(13)(A)) | `spendingAdjustment`, `tax.spending_adjustment_floor` |
| Equalized homestead rate | `base rate × spending adjustment` (§ 5402(a)(2)) | `equalizedHomesteadRate`, `tax.homestead_base_rate` |
| Common Level of Appraisal (CLA) | Restates local assessed values to fair market value (Act 60 of 1997) | `cla` input to `billedHomesteadRate` |
| **Statewide Adjustment (SA)** | **New in FY2026.** Billed rate divides by `CLA ÷ SA`, not CLA alone; shown as "CLA ÷ SA" on bills | `tax.statewide_adjustment`, `billedHomesteadRate` |
| Excess spending penalty | Per-pupil above the threshold (§ 5401(12)); overage double-counted | `excessSpending`, `tax.excess_spending_threshold_ratio` |

The **Statewide Adjustment is genuinely new for FY2026** and is a reason a bill can move
when district spending did not. The model already divides by CLA-over-statewide-adjustment
in `billedHomesteadRate`, so the FY2026+ files need a real `tax.statewide_adjustment` (the
state average CLA) from the Department of Taxes, not a placeholder.

## What this means for the parameter files — checklist

- **FY2025** (`fy2025.yaml`): threshold *suspended*. Do not enter a value that would compute
  a threshold; the null records "the penalty did not apply."
- **FY2026** (`fy2026.yaml`): enter `statewide_average_per_pupil = FY2026 threshold ÷ 1.18`
  once the FY2026 threshold is in hand (or `PPS_State(FY25) × NEEP_FY25→FY26`). Still null.
- **FY2027** (`fy2027.yaml`): entered as **13958** (`= 16470 ÷ 1.18`), `verified: false`.
  Confirm against `PPS_State(FY25) × NEEP_FY25→FY27` and countersign per
  `docs/parameter-verification.md`.
- **Multiplier**: `tax.excess_spending_threshold_ratio = 1.18` is confirmed 118% by Source #1.
- **Statewide Adjustment**: give FY2026+ a real `tax.statewide_adjustment` from the Tax
  Department's annual rate letter.
- **Not yet modeled** (known gaps): the pre-July-2024 bond exclusion and the 150%
  capital-reserve add-on to district per pupil spending. Track these before claiming the
  excess spending figure is complete for a real district.
