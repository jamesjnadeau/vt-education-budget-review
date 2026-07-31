/**
 * Tests for the small / sparse layer.
 *
 * Two things are being defended here and they are not the same thing.
 *
 * The arithmetic tests run against `syntheticParameters()` -- arbitrary values,
 * not Vermont's -- and prove that the screens, the boundary comparators and the
 * roll-up behave. They cannot tell you the thresholds are right, and are not
 * meant to.
 *
 * The gate tests prove that no combination of inputs produces a dollar figure
 * while eligibility is unassumed, and that the shipped parameter file computes
 * nothing at all. Those are the load-bearing ones. If someone later "fixes" the
 * suppression as though it were a bug, the property test below is what stops it
 * reaching a published page.
 */

import { describe, expect, it } from 'vitest';

import { loadParameterFile } from './parameters/load-node.ts';
import { createContext } from './node.ts';
import {
  computeGrantLines,
  densityScreen,
  enrollmentScreen,
  evaluateSmallSparse,
  gradeSpanClassOf,
  nonComputableCriteria,
  normalizeGradeSpan,
  rollUpToDistrict,
  travelCriterion,
  UNDETERMINED_REASON,
  UNVERIFIED_RATE_REASON,
  type AssumptionBasis,
  type EnrollmentBasis,
  type MunicipalityDemographics,
  type NearestSameSpanResult,
  type SchoolRef,
  type ScreenOptions,
} from './small-sparse.ts';
import { syntheticParameters } from './testing/synthetic.ts';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHIPPED_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'parameters',
  'fy2030-small-sparse.yaml',
);

const school = (over: Partial<SchoolRef> = {}): SchoolRef => ({
  id: 'school/example',
  name: 'Example School',
  municipality: 'town/example',
  municipalityBasis: 'census_geocoder_point_in_polygon',
  gradeSpan: { low: 0, high: 6 },
  gradeSpanClass: 'elementary',
  schoolType: 'public',
  location: { latitude: 44, longitude: -72.5, precision: 'rooftop' },
  ...over,
});

const demographics = (over: Partial<MunicipalityDemographics> = {}): MunicipalityDemographics => ({
  municipality: 'town/example',
  population: 1000,
  populationSeries: 'decennial_2020',
  landAreaSqMi: 40,
  ...over,
});

const options = (over: Partial<ScreenOptions> = {}): ScreenOptions => ({
  fiscalYear: 2030,
  enrollmentBasis: 'two_year_average',
  populationSeries: 'decennial_2020',
  ...over,
});

const nearest = (over: Partial<NearestSameSpanResult> = {}): NearestSameSpanResult => ({
  targetSchool: 'school/other',
  roadMiles: 20,
  estimatedOneWayMinutes: null,
  travelTimeMethod: 'school_to_school_only',
  routingRunRef: 'derived/routing/run-1',
  ...over,
});

// --------------------------------------------------------------------------
// Statutory screen 1 -- enrollment
// --------------------------------------------------------------------------

describe('the enrollment screen', () => {
  it('averages the two most recent years and compares against the threshold', () => {
    const ctx = createContext(syntheticParameters());
    const result = enrollmentScreen(ctx, school(), { byYear: { 2028: 80, 2029: 90 } }, options());

    expect(result.value).toBe(85);
    expect(result.threshold).toBe(100);
    expect(result.meets).toBe(true);
    expect(result.node.status).toBe('ok');
  });

  it('uses a single year when that basis is chosen, and can disagree with the average', () => {
    const ctx = createContext(syntheticParameters());
    const enrolment = { byYear: { 2028: 80, 2029: 130 } };

    const averaged = enrollmentScreen(ctx, school(), enrolment, options());
    const single = enrollmentScreen(ctx, school(), enrolment, options({ enrollmentBasis: 'single_year' }));

    // 105 on a two-year average, 130 on the latest year. The statute's basis is
    // unread and this is exactly the school whose status the reading decides.
    expect(averaged.value).toBe(105);
    expect(single.value).toBe(130);
    expect(averaged.meets).toBe(false);
    expect(single.meets).toBe(false);
  });

  it('is decided by the comparator at exactly the threshold', () => {
    // Vermont has schools at exactly 100 pupils. `lt` and `lte` decide them
    // differently, which is why the comparator is a parameter and not a
    // convention.
    const strict = createContext(syntheticParameters());
    const inclusive = createContext(
      syntheticParameters({
        overrides: { 'statutory.screens.small_enrollment.comparator': 'lte' },
      }),
    );

    const at100 = { byYear: { 2028: 100, 2029: 100 } };
    expect(enrollmentScreen(strict, school(), at100, options()).meets).toBe(false);
    expect(enrollmentScreen(inclusive, school(), at100, options()).meets).toBe(true);
  });

  it('treats a year with no published figure as missing, never as zero', () => {
    const ctx = createContext(syntheticParameters());
    const result = enrollmentScreen(ctx, school(), { byYear: { 2028: 80, 2029: null } }, options());

    // 80 and a zero would average to 40 and pass the screen comfortably. That is
    // the specific wrong answer this guards against.
    expect(result.value).toBeNull();
    expect(result.meets).toBeNull();
    expect(result.node.status).toBe('missing_input');
  });

  it('declines when the threshold is unverified, and says whose problem that is', () => {
    const ctx = createContext(
      syntheticParameters({ unverified: ['statutory.screens.small_enrollment.threshold'] }),
    );
    const result = enrollmentScreen(ctx, school(), { byYear: { 2028: 10, 2029: 10 } }, options());

    expect(result.value).toBeNull();
    expect(result.meets).toBeNull();
    expect(result.node.status).toBe('unverified');
  });

  it('declines when the comparator alone is unverified', () => {
    // A threshold without a comparator is not a test. An unread comparator has
    // to block the screen exactly as an unread threshold does.
    const ctx = createContext(
      syntheticParameters({ unverified: ['statutory.screens.small_enrollment.comparator'] }),
    );
    const result = enrollmentScreen(ctx, school(), { byYear: { 2028: 10, 2029: 10 } }, options());

    expect(result.meets).toBeNull();
    expect(result.node.status).toBe('unverified');
  });
});

// --------------------------------------------------------------------------
// Statutory screen 2 -- density
// --------------------------------------------------------------------------

describe('the density screen', () => {
  it('divides population by LAND area and compares against the threshold', () => {
    const ctx = createContext(syntheticParameters());
    const result = densityScreen(ctx, school(), demographics({ population: 1000, landAreaSqMi: 40 }));

    expect(result.value).toBe(25);
    expect(result.meets).toBe(true);
  });

  it('regression: land area, never total area', () => {
    // The land-versus-total distinction is the one that silently changes
    // answers. A lakeside town: 60 square miles of land, 40 of water. On land
    // area it is at 50 per square mile and sparse; on total area it would come
    // out at 30 and look sparser still -- and a town just above the line would
    // be pulled INTO eligibility the same way. The screen must never see the
    // water.
    const ctx = createContext(syntheticParameters());
    const land = 60;
    const water = 40;
    const population = 3000;

    const result = densityScreen(ctx, school(), demographics({ population, landAreaSqMi: land }));
    expect(result.value).toBe(50);
    expect(result.meets).toBe(true);

    const ifTotalAreaWereUsed = population / (land + water);
    expect(ifTotalAreaWereUsed).toBe(30);
    expect(result.value).not.toBe(ifTotalAreaWereUsed);
  });

  it('does not resolve when the municipality is known only from a mailing address', () => {
    // A postal city is not a municipality. Vermont post office names routinely
    // cover parts of several towns, so a mailing address cannot decide which
    // town's density governs a school.
    const ctx = createContext(syntheticParameters());
    const result = densityScreen(
      ctx,
      school({ municipality: 'town/example', municipalityBasis: 'aoe_mailing_city' }),
      demographics(),
    );

    expect(result.value).toBeNull();
    expect(result.meets).toBeNull();
    expect(result.node.status).toBe('missing_input');
  });

  it('does not resolve when the population series was not retrieved', () => {
    const ctx = createContext(syntheticParameters());
    const result = densityScreen(ctx, school(), demographics({ population: null }));

    expect(result.meets).toBeNull();
    expect(result.node.status).toBe('missing_input');
  });
});

// --------------------------------------------------------------------------
// Necessity
// --------------------------------------------------------------------------

describe('the necessity criteria', () => {
  it('reports distance above the top of the range as a screen met, not as eligibility', () => {
    const ctx = createContext(syntheticParameters());
    const result = travelCriterion(ctx, school(), nearest({ roadMiles: 20 }));

    expect(result.status).toBe('screen_met');
    expect(result.explanation).toContain('PROPOSED standard');
    expect(result.explanation).toContain('not a determination');
  });

  it('returns indeterminate inside the 10-to-15 mile range rather than splitting it', () => {
    const ctx = createContext(syntheticParameters());
    expect(travelCriterion(ctx, school(), nearest({ roadMiles: 12.5 })).status).toBe('indeterminate');
  });

  it('returns indeterminate at municipality-centroid precision', () => {
    const ctx = createContext(syntheticParameters());
    const result = travelCriterion(
      ctx,
      school({ location: { latitude: 44, longitude: -72.5, precision: 'municipality_centroid' } }),
      nearest({ roadMiles: 20 }),
    );
    expect(result.status).toBe('indeterminate');
  });

  it('applies the stricter elementary threshold to a straddling span and says so', () => {
    const ctx = createContext(syntheticParameters());
    const result = travelCriterion(
      ctx,
      school({ gradeSpan: { low: 0, high: 12 }, gradeSpanClass: 'combined' }),
      nearest({ roadMiles: 12, estimatedOneWayMinutes: 50 }),
    );

    // 50 minutes clears the elementary threshold of 45 but not the secondary
    // threshold of 60. Choosing the secondary one would have produced the more
    // convenient answer for a K-12 school, which is why the choice is flagged.
    expect(result.status).toBe('screen_met');
    expect(result.explanation).toContain("grade 7 split");
  });

  it('marks the other four criteria not_computable rather than outstanding', () => {
    const ctx = createContext(syntheticParameters());
    const criteria = nonComputableCriteria(ctx, school());

    expect(criteria).toHaveLength(4);
    for (const criterion of criteria) {
      expect(criterion.node.status).toBe('not_computable');
      expect(criterion.node.blockers.every((b) => b.kind === 'not_computable')).toBe(true);
    }
  });

  it('offers no aggregate over the five criteria', async () => {
    // The framework proposes no scoring and the engine must not invent one. A
    // composite would be an editorial judgment wearing a computation's clothes.
    const module = await import('./small-sparse.ts');
    const names = Object.keys(module);
    expect(names.filter((n) => /score|rank|composite|overall|aggregate/i.test(n))).toEqual([]);
  });
});

// --------------------------------------------------------------------------
// The gate. These are the load-bearing tests.
// --------------------------------------------------------------------------

describe('the grant gate', () => {
  const BASES: AssumptionBasis[] = ['none', 'agency_determination', 'explicit_user_assumption'];
  const OUTCOMES: Array<boolean | null> = [true, false, null];
  const COUNTS: Array<number | null> = [null, 0, 1, 99.5, 1_000_000];
  const ENROLMENT_BASES: EnrollmentBasis[] = ['two_year_average', 'single_year'];

  it('produces no figure under ANY input while the eligibility assumption is none', () => {
    // The most important test in this layer. If someone later reads the
    // suppression as a bug and "fixes" it, this is what has to fail, loudly,
    // before a dollar figure reaches a page.
    for (const smallScreenMet of OUTCOMES) {
      for (const sparseScreenMet of OUTCOMES) {
        for (const pupilCount of COUNTS) {
          for (const basis of ENROLMENT_BASES) {
            const ctx = createContext(syntheticParameters());
            const lines = computeGrantLines(
              ctx,
              school(),
              { smallScreenMet, sparseScreenMet },
              pupilCount,
              basis,
              { basis: 'none', note: null },
            );

            expect(lines.small.amount).toBeNull();
            expect(lines.sparse.amount).toBeNull();
            expect(lines.small.suppressedReason).toBe(UNDETERMINED_REASON);
            expect(lines.small.node.status).toBe('undetermined');
            expect(lines.sparse.node.status).toBe('undetermined');
          }
        }
      }
    }
  });

  it('never returns a total, under any assumption basis', () => {
    // Whether the grants add or a school takes the greater is unread. A total
    // would be a 60% guess on the line item for exactly the schools most exposed
    // in the March 2028 votes.
    for (const basis of BASES) {
      const ctx = createContext(syntheticParameters());
      const result = evaluateSmallSparse(ctx, {
        school: school(),
        enrollment: { byYear: { 2028: 50, 2029: 50 } },
        demographics: demographics(),
        nearest: nearest(),
        options: options(),
        assumption: { basis, note: basis === 'explicit_user_assumption' ? 'assumed for testing' : null },
        determinationStatus: 'undetermined',
      });
      expect(result.grant.total).toBeNull();
    }
  });

  it('computes only when an assumption is supplied AND the screen is met', () => {
    const ctx = createContext(syntheticParameters());
    const lines = computeGrantLines(
      ctx,
      school(),
      { smallScreenMet: true, sparseScreenMet: false },
      50,
      'two_year_average',
      { basis: 'explicit_user_assumption', note: 'Assumed eligible for illustration.' },
    );

    expect(lines.small.amount).toBe(50_000);
    expect(lines.small.node.notes.join(' ')).toContain('Assumed eligible for illustration.');
    // The sparse screen was not met, so its line stays undetermined rather than
    // becoming a zero. A zero would read as "this school gets nothing", which is
    // a different and unearned claim.
    expect(lines.sparse.amount).toBeNull();
    expect(lines.sparse.suppressedKind).toBe('undetermined');
  });

  it('keeps the two suppression reasons distinct', () => {
    // One is a decision the State has not made; the other is a statute we have
    // not read. Collapsing them tells the reader nothing about who has to act.
    const ctx = createContext(
      syntheticParameters({ unverified: ['statutory.grants.small_school.per_pupil'] }),
    );
    const lines = computeGrantLines(
      ctx,
      school(),
      { smallScreenMet: true, sparseScreenMet: true },
      50,
      'two_year_average',
      { basis: 'agency_determination', note: null },
    );

    expect(lines.small.suppressedReason).toBe(UNVERIFIED_RATE_REASON);
    expect(lines.small.suppressedKind).toBe('unverified');
    expect(lines.small.node.status).toBe('unverified');
    expect(lines.sparse.amount).toBe(25_000);
    expect(UNVERIFIED_RATE_REASON).not.toBe(UNDETERMINED_REASON);
  });

  it('refuses an explicit user assumption with no note', () => {
    const ctx = createContext(syntheticParameters());
    expect(() =>
      computeGrantLines(ctx, school(), { smallScreenMet: true, sparseScreenMet: true }, 50, 'two_year_average', {
        basis: 'explicit_user_assumption',
        note: '   ',
      }),
    ).toThrow(/requires a note/);
  });

  it('treats a non-public school as not applicable and suppresses regardless', () => {
    const ctx = createContext(syntheticParameters());
    const result = evaluateSmallSparse(ctx, {
      school: school({ schoolType: 'approved_independent' }),
      enrollment: { byYear: { 2028: 20, 2029: 20 } },
      demographics: demographics(),
      nearest: nearest(),
      options: options(),
      assumption: { basis: 'agency_determination', note: null },
      determinationStatus: 'agency_determined_eligible',
    });

    expect(result.necessity.determinationStatus).toBe('not_applicable');
    expect(result.necessity.criteria).toHaveLength(0);
    expect(result.grant.small.amount).toBeNull();
    expect(result.grant.assumptionBasis).toBe('none');
  });
});

// --------------------------------------------------------------------------
// The shipped file
// --------------------------------------------------------------------------

describe('the shipped small/sparse parameter file', () => {
  const set = loadParameterFile(SHIPPED_FILE);

  it('holds no verified statutory value', () => {
    const statutory = [...set.parameters.values()].filter((p) => p.key.startsWith('statutory.'));
    expect(statutory.length).toBeGreaterThan(0);
    expect(statutory.every((p) => !p.citation.verified)).toBe(true);
    expect(statutory.every((p) => p.value === null)).toBe(true);
  });

  it('marks every framework parameter as not law', () => {
    const framework = [...set.parameters.values()].filter((p) => p.key.startsWith('framework.'));
    expect(framework.length).toBeGreaterThan(0);
    expect(framework.every((p) => p.is_law === false)).toBe(true);
  });

  it('computes nothing at all for a real school', () => {
    // The whole layer against the real file: every screen unverified, every
    // grant suppressed. This is the correct output as of drafting, and the test
    // exists so that the day it changes, it changes because someone read an act.
    const ctx = createContext(set);
    const result = evaluateSmallSparse(ctx, {
      school: school(),
      enrollment: { byYear: { 2028: 42, 2029: 44 } },
      demographics: demographics(),
      nearest: nearest(),
      options: options(),
      assumption: { basis: 'none', note: null },
      determinationStatus: 'undetermined',
    });

    expect(result.statutory.smallScreenMet).toBeNull();
    expect(result.statutory.sparseScreenMet).toBeNull();
    expect(result.statutory.enrollment.node.status).toBe('unverified');
    expect(result.statutory.density.node.status).toBe('unverified');
    expect(result.grant.small.amount).toBeNull();
    expect(result.grant.sparse.amount).toBeNull();
    expect(result.grant.total).toBeNull();
    expect(result.necessity.determinationStatus).toBe('undetermined');
  });
});

// --------------------------------------------------------------------------
// Roll-up
// --------------------------------------------------------------------------

describe('the district roll-up', () => {
  const evaluate = (name: string, enrolled: number, basis: AssumptionBasis) => {
    const ctx = createContext(syntheticParameters());
    return evaluateSmallSparse(ctx, {
      school: school({ id: `school/${name}`, name }),
      enrollment: { byYear: { 2028: enrolled, 2029: enrolled } },
      demographics: demographics(),
      nearest: nearest(),
      options: options(),
      assumption: { basis, note: basis === 'explicit_user_assumption' ? 'assumed' : null },
      determinationStatus: 'undetermined',
    });
  };

  it('returns no amount when every school is undetermined', () => {
    const rolled = rollUpToDistrict([evaluate('a', 50, 'none'), evaluate('b', 60, 'none')]);
    expect(rolled.amount).toBeNull();
    expect(rolled.suppressedCount).toBe(2);
    expect(rolled.note).toBe(UNDETERMINED_REASON);
  });

  it('states the total is a floor when some schools are suppressed', () => {
    const rolled = rollUpToDistrict([
      evaluate('a', 50, 'agency_determination'),
      evaluate('b', 60, 'none'),
    ]);

    // School a: 50 pupils, small at 1000 and sparse at 500 -- 75,000.
    expect(rolled.amount).toBe(75_000);
    expect(rolled.suppressedCount).toBe(1);
    expect(rolled.note).toContain('floor');
  });
});

// --------------------------------------------------------------------------
// Grade spans
// --------------------------------------------------------------------------

describe('grade span normalization', () => {
  it('maps prekindergarten below kindergarten and keeps the stated form', () => {
    expect(normalizeGradeSpan(['K', '1', '2', 'PK', 'EE'])).toEqual({
      low: -1,
      high: 2,
      as_stated: 'K,1,2,PK,EE',
    });
  });

  it('returns null rather than a span for a school with no usable grades', () => {
    expect(normalizeGradeSpan([])).toBeNull();
    expect(normalizeGradeSpan(['ungraded'])).toBeNull();
  });

  it('classifies spans, preserving the ambiguity where the framework has one', () => {
    expect(gradeSpanClassOf({ low: 0, high: 6 })).toBe('elementary');
    expect(gradeSpanClassOf({ low: 7, high: 8 })).toBe('middle');
    expect(gradeSpanClassOf({ low: 9, high: 12 })).toBe('secondary');
    expect(gradeSpanClassOf({ low: 7, high: 12 })).toBe('middle_secondary');
    // The two the framework does not address.
    expect(gradeSpanClassOf({ low: 0, high: 8 })).toBe('elementary_middle');
    expect(gradeSpanClassOf({ low: -1, high: 12 })).toBe('combined');
    expect(gradeSpanClassOf(null)).toBeNull();
  });
});
