# Small / sparse fixtures

Read the first section before adding anything here.

## These are not the same kind of golden as `../`

The fixtures in the parent directory make this project's strongest claim: *the engine
reproduces the state's published figures, and here are the tests*.

**This layer cannot make that claim, and these fixtures do not.** There are no published
necessity determinations to reproduce, because AOE has published none and the rules that would
govern them are unwritten. Nothing here is a state figure. Every expected value below is hand
arithmetic, computed against thresholds that are *hypotheses* and clearly marked as such.

The methodology page has to say so rather than letting a reader assume this layer carries the
same validation as the rest. If someone later cites a green test run here as evidence that the
small/sparse figures are right, they have been misled — and the fault will be in how this file
was written.

## What they do defend

Four things, each of which is a real way to get this layer silently wrong:

1. **Boundary arithmetic.** A school at exactly the enrollment threshold, and a town at exactly
   the density threshold. `lt` and `lte` decide these differently and Vermont has schools at
   exactly 100 pupils.
2. **Land area against total area.** A lakeside town whose land and total areas diverge sharply.
   The fixture fails if anyone swaps the measure — which is the kind of change that looks like a
   tidy-up and moves towns into eligibility.
3. **Partial data.** A school with one published enrollment year and one missing. A missing year
   is missing, never zero; averaging over what happens to be present answers a different and
   more convenient question.
4. **Basis sensitivity.** Which schools change status between the two enrollment bases, and
   between the two population series. These double as publishable findings: the statute's basis
   is unread, and the set of schools whose answer depends on the reading is itself the story.

## Fixture format

```yaml
name: a school exactly at the enrollment threshold
why: |
  What this fixture would catch if it broke, in a sentence. Not optional --
  a fixture nobody can explain is a fixture nobody dares delete.

# Hypothesis thresholds, NOT statute. The shipped parameter file's values are all
# null and stay null until someone reads the enacted acts. The runner injects
# these through the synthetic parameter set, whose citation field reads
# "SYNTHETIC TEST FIXTURE -- not a statutory value and not Vermont law", so a
# value copied out of here announces what it is wherever it lands.
thresholds:
  enrollment: { threshold: 100, comparator: lt }
  density: { threshold: 55, comparator: lt }

school:
  grade_span: { low: 0, high: 6 }
  school_type: public
  municipality_basis: census_geocoder_point_in_polygon

inputs:
  enrollment_by_year: { 2028: 100, 2029: 100 }
  municipality:
    population: 1000
    land_area_sq_mi: 40
    # Carried so the land-versus-total distinction is visible in the fixture.
    # Nothing divides by it; a fixture that expects it to be ignored is the point.
    water_area_sq_mi: 0
    series: decennial_2020

options:
  fiscal_year: 2030
  enrollment_basis: two_year_average

expected:
  enrollment_value: 100
  small_screen_met: false
  density_value: 25
  sparse_screen_met: true
  # Always null. If this ever needs a number, something has gone wrong upstream.
  grant_amount: null
```

`expected.grant_amount` is asserted null in every fixture and there is no way to write one that
expects otherwise. That is deliberate: no fixture in this directory may be the thing that
teaches the suite a dollar figure is acceptable output.

## When the acts are read

Replace nothing here. Add fixtures using the *verified* thresholds alongside these, and delete a
hypothesis fixture only when a verified one covers the same boundary. Until then, a passing run
of this directory means the arithmetic is right given a guess — which is worth having, and is
not worth more than it is.
