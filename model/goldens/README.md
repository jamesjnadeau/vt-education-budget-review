# Golden tests

Fixtures that check the engine against figures the State of Vermont has already published.

**There are none yet.** That is why nothing on this site publishes a computed figure.

## Why these matter more than the unit tests

The unit tests in `../src/engine.test.ts` prove the arithmetic is right *given* a set of
weights. They run against deliberately arbitrary weights and cannot tell you whether the
weights, or the structure they are plugged into, match Vermont law. A suite of passing unit
tests is entirely compatible with publishing confidently wrong numbers.

Golden tests close that gap by requiring the engine to reproduce AOE's own published weighted
membership and the Tax Department's announced homestead rates, for real districts, to within
rounding.

"Our model reproduces the state's published figures, and here are the tests" is the strongest
credibility claim this project can make. It is also the one claim that cannot be made
prematurely — which is why the harness fails the build if any parameter file declares itself
verified while this directory is empty.

## Fixture format

One YAML file per district-fiscal-year, named `<entity-slug>-fy<year>.yaml`:

```yaml
entity: ud/example-55
fiscal_year: 2026

# Where the state's figures came from. Not optional: a golden test whose expected
# values have no provenance is just a second copy of our own arithmetic.
source:
  publisher: Vermont Agency of Education
  document: "FY2026 Weighted Long-Term Membership Report"
  url: https://education.vermont.gov/...
  retrieved: 2026-08-14
  retrieved_by: jn

# Inputs, as the state reports them.
inputs:
  adm_years:
    - { fiscal_year: 2024, prek: 0, elementary: 0, secondary: 0 }
    - { fiscal_year: 2025, prek: 0, elementary: 0, secondary: 0 }
  economically_deprived: 0
  english_learners:
    - { category: level_1, count: 0 }
  sparsity_eligible: false
  small_school_eligible: false
  education_spending: 0
  towns:
    - { town: town/example, cla: 0.0 }

# What the state published. The engine must reproduce these.
expected:
  weighted_membership: 0
  per_weighted_pupil: 0
  equalized_homestead_rate: 0
  town_rates:
    - { town: town/example, billed_rate: 0 }

tolerance:
  # Published figures are rounded. State the tolerance explicitly rather than
  # letting a loose default hide a real disagreement.
  weighted_membership: 0.01
  rates: 0.0001
```

## Building the first fixtures

1. Verify the FY parameter file first — see `../../docs/parameter-verification.md`. Golden
   tests against unverified parameters test nothing, because the engine correctly refuses to
   compute at all.
2. Get AOE's published weighted membership report for the fiscal year, and the Tax
   Department's announced rates. Record where each came from.
3. Start with five districts of deliberately different shapes: one with a high economically
   deprived count, one that qualifies for sparsity, one large K–12 district, one that
   tuitions its secondary students, and one union district spanning several towns with
   markedly different CLAs. Similar districts pass together and fail together, which teaches
   you nothing.
4. Expect the first run to disagree. Investigate before adjusting anything — a disagreement is
   more likely to be a wrong reading of the statute's structure than a rounding artifact, and
   widening the tolerance to make a test pass converts a real finding into a hidden bug.
5. When they pass, say so on the methodology page with a link to these files.

## Failures worth expecting

- **Averaging window.** Whether long-term membership averages two years or three, and which
  years, moves every downstream figure.
- **Weight stacking.** Whether a pupil can attract several additional weights at once, and
  whether those weights multiply a base or add to a total.
- **Sparsity and small-school scope.** Whether they apply to the whole weighted membership or
  to some subset.
- **Excess spending threshold.** A district just over the line behaves very differently from
  one just under it.
- **CLA vintage.** Which year's common level of appraisal applies to which year's rate.
