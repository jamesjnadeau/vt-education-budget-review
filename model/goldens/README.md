# Golden tests

Fixtures that check the engine against figures the State of Vermont has already published.

**Two fixtures reproduce the Tax Department's FY2026 rates. One records a disagreement the
engine cannot yet close.** Each is listed below with what it proves and what it does not.

## Why these matter more than the unit tests

The unit tests in `../src/engine.test.ts` prove the arithmetic is right *given* a set of
weights. They run against deliberately arbitrary weights and cannot tell you whether the
weights, or the structure they are plugged into, match Vermont law. A suite of passing unit
tests is entirely compatible with publishing confidently wrong numbers.

Golden tests close that gap by requiring the engine to reproduce the State's own published
figures, for real districts, to within rounding.

"Our model reproduces the state's published figures, and here are the tests" is the strongest
credibility claim this project can make. It is also the one claim that cannot be made
prematurely — which is why the harness fails the build if any parameter file declares itself
verified while no fixture in this directory passes.

## The fixtures

| Fixture | Shape | Proves | Does not prove |
|---|---|---|---|
| `ud-slate-valley-62-fy2026.yaml` | Six-town union district, CLAs from 0.60 to 1.04, one town reappraised | Per-pupil spending, the § 5401(13)(A) spending adjustment, the § 5402(a)(2) equalized rate, and six § 5402(b)(1) billed rates from one district rate, using the FY2026 property yield and statewide adjustment | Anything about weighted membership |
| `town-marlboro-fy2026.yaml` | Single-town district $429 per pupil **over** the excess spending threshold | The § 5401(12) excess spending rule, the reimplemented Act 183 base ($13,497 × 1.18), and that the overage goes into the numerator | Same |
| `ud-addison-central-55-fy2026.yaml` | Seven-town union district, **known disagreement** | That the engine is wrong here, and by how much: the published district rate is 1.6105; the engine gives 1.7545. See the file for the statewide pattern and the likely rule | — |

Both passing fixtures take AOE's published long-term weighted ADM as an input
(`weighted_membership_published`) rather than recomputing it from raw ADM. They therefore test
the tax chain from the State's pupil count onward and say nothing about the membership engine.
A membership fixture needs AOE's weighted long-term membership report with its grade-band
inputs, which is not yet on file.

### What the first run found

Joining AOE's FY2026 spending workbook with the Tax Department's FY2026 rate table, town by
town, the engine's chain reproduces the Tax Department's district rate to four places for 50
of the 97 districts that match one-to-one. For the other 47 the published rate is **lower**
than the chain gives, by an amount that differs district by district and is never in the other
direction. That is the shape of a transition rule, and Act 127 of 2022's tax-rate transition
as rewritten by Act 183 of 2024 is the place to read. It is not modelled from memory: the
session-law text has to be fetched, snapshotted under `../statute/`, cited, and then
implemented. Until then the engine is right for roughly half of Vermont's districts and
silently high for the rest.

Two smaller findings from the same join, both already acted on:

- `tax.statewide_adjustment` in `../parameters/fy2026.yaml` was 0.703, the FY2027 figure. The
  FY2026 table prints 0.7236 on every row. Corrected, cited to the table, awaiting
  countersignature.
- The Tax Department rounds CLA ÷ SA to four places before dividing. Dividing by the unrounded
  quotient reproduces only 150 of 260 published homestead rates to the fourth place; dividing
  by the rounded column reproduces all 260. The engine divides unrounded, so the fixtures allow
  one unit in the fourth place and say so.

## Fixture format

One YAML file per district-fiscal-year, named `<entity-slug>-fy<year>.yaml`. The passing
fixtures above are the reference; the shape is:

```yaml
entity: ud/example-55
fiscal_year: 2026

# Where the state's figures came from. Not optional: a golden test whose expected
# values have no provenance is just a second copy of our own arithmetic.
source:
  publisher: Vermont Agency of Education and Vermont Department of Taxes
  document: "which workbook, which tab, which intake artifact"
  url: https://tax.vermont.gov/...
  retrieved: "2026-10-22"
  retrieved_by: who

inputs:
  # EITHER the State's published weighted membership, used as the divisor directly...
  weighted_membership_published: 0
  # ...OR raw ADM by grade band and the demographic inputs, to test the membership engine:
  # adm_years:
  #   - { fiscal_year: 2025, prekindergarten: 0, kindergarten_through_5: 0, grades_6_through_8: 0, grades_9_through_12: 0 }
  #   - { fiscal_year: 2026, ... }
  # state_placed_fte: 0
  # poverty_185_fpl: 0
  # english_learners: 0
  # persons_per_square_mile: 0
  # small_schools: []
  education_spending: 0
  statewide_average_per_pupil: 0      # the Secretary's determination, for excess spending
  towns:
    - { town: town/example, cla: 0.0 }

# What the state published. The engine must reproduce these.
expected:
  weighted_membership: 0              # checked only when adm_years is given
  per_weighted_pupil: 0
  equalized_homestead_rate: 0         # the Tax Department's "District Rate"
  town_rates:
    - { town: town/example, billed_rate: 0 }

tolerance:
  # Absolute: |engine - published| <= tolerance. Published figures are rounded,
  # so state the tolerance explicitly rather than letting a loose default hide
  # a real disagreement.
  weighted_membership: 0.01
  rates: 0.0001

# Only when the engine is known not to reproduce the rates and the reason is
# understood. The rate assertions then run as expected failures: the suite stays
# green while the gap is open, and goes red the moment the engine starts
# reproducing the figures, which is the signal to delete this block. A fixture
# carrying this block does not count toward the publication gate.
# known_disagreement:
#   reason: "..."
```

## Building more fixtures

1. The FY parameter file must be verified first — see `../../docs/parameter-verification.md`.
   Golden tests against unverified parameters test nothing, because the engine correctly
   refuses to compute at all.
2. Get the State's published figures and record where each came from. For the tax chain,
   AOE's EdSpend workbook (`warehouse/aoe-edspend/`) and the Tax Department's rate table
   (`intake/tax-rates/`) together cover every district and every town.
3. Prefer districts of deliberately different shapes: one over the excess spending threshold,
   one with a sparsity or small-school weight, one that tuitions its secondary students, one
   spanning towns with markedly different CLAs. Similar districts pass together and fail
   together, which teaches you nothing.
4. Expect a new fixture to disagree. Investigate before adjusting anything — a disagreement is
   more likely to be a wrong reading of the statute's structure than a rounding artifact, and
   widening the tolerance to make a test pass converts a real finding into a hidden bug. If
   the cause is understood but not yet modelled, keep the fixture and add `known_disagreement`.
5. When they pass, say so on the methodology page with a link to these files.

## Failures worth expecting

- **Tax-rate transition.** The open one, above. Any district the Act 127 transition touches
  will come in low against the plain § 5401(13)(A) chain.
- **Averaging window.** Whether long-term membership averages two years or three, and which
  years, moves every downstream figure.
- **Weight stacking.** Whether a pupil can attract several additional weights at once, and
  whether those weights multiply a base or add to a total.
- **Sparsity and small-school scope.** Whether they apply to the whole weighted membership or
  to some subset.
- **Excess spending threshold.** A district just over the line behaves very differently from
  one just under it. Marlboro is over it and reproduces; that is one data point.
- **CLA vintage and rounding.** Which year's common level of appraisal applies to which year's
  rate, and that the Department divides by CLA ÷ SA rounded to four places.
