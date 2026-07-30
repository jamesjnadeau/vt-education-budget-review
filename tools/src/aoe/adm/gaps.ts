/**
 * What § 4010 needs, and what this source actually supplies.
 *
 * The point is to make a null explicable. The site renders this so the "show
 * your work" walkthrough can say WHY a weighted-membership figure is absent
 * instead of rendering a blank, and so nobody re-derives the answer to "why
 * can't we just compute it" a year from now.
 *
 * Every citation below was read off the snapshot in
 * `model/statute/2026-07-29/16-vsa-4010.txt` and `16-vsa-4001.txt` rather than
 * recalled, per `docs/parameter-verification.md`. Two structural facts about the
 * section drive how they are written:
 *
 *   § 4010(b)(1) is where the Secretary LISTS each count, so it is the citation
 *   that says what a data source has to carry. § 4010(d) is where each count is
 *   WEIGHTED. An input therefore has two homes, and naming only the weight
 *   leaves the reader unable to find the requirement that the number exist.
 *
 *   Kindergarten through grade five is deliberately absent from (d)(1). It is
 *   the unweighted baseline -- every pupil counts as one before any grade weight
 *   applies -- so it has a listing citation and no weight citation, and that is
 *   not an omission.
 */

export interface GapEntry {
  readonly input: string;
  readonly statute: string;
  readonly supplied: boolean;
  readonly note: string;
}

const ENTRIES: readonly GapEntry[] = [
  {
    input: 'adm.kindergarten_through_5',
    statute: '16 V.S.A. § 4010(b)(1)(B)',
    supplied: true,
    note:
      'Published, in reports whose bands match the current statutory bands. Carries no ' +
      'grade weight of its own: under (d)(1) each pupil counts as one and only ' +
      'prekindergarten, grades 6-8 and grades 9-12 are multiplied, so K-5 is the baseline ' +
      'the other weights are measured against.',
  },
  {
    input: 'adm.grades_6_through_8',
    statute: '16 V.S.A. § 4010(b)(1)(C), weighted under (d)(1)(B)',
    supplied: true,
    note: 'Published, in reports whose bands match the current statutory bands.',
  },
  {
    input: 'adm.grades_9_through_12',
    statute: '16 V.S.A. § 4010(b)(1)(D), weighted under (d)(1)(C)',
    supplied: true,
    note: 'Published, in reports whose bands match the current statutory bands.',
  },
  {
    input: 'adm.prekindergarten',
    statute: '16 V.S.A. § 4010(b)(1)(A), weighted under (d)(1)(A)',
    supplied: false,
    note:
      'No AOE resident-district report publishes a prekindergarten column at all. The ' +
      'value is null, never zero, and the absence is confirmed against the artifact. ' +
      'Separately, (d)(1)(A) exists in two versions -- negative 0.54 until the Act 73 ' +
      'contingency is met, repealed in the version effective July 1 2026 if it is -- so ' +
      'even a published count would not currently yield a usable weight.',
  },
  {
    input: 'state_placed_fte',
    statute: '16 V.S.A. § 4001(7)(B)',
    supplied: false,
    note:
      'Not in this report. State-placed students are excluded from the two-year average ' +
      'and added at their most recent count, so this is a distinct input rather than a ' +
      'subset of ADM.',
  },
  {
    input: 'poverty_185_fpl',
    statute: '16 V.S.A. § 4010(b)(1)(E), weighted under (d)(2)',
    supplied: false,
    note: 'Not in this report. A separate AOE source with its own provenance.',
  },
  {
    input: 'english_learners',
    statute: '16 V.S.A. § 4010(b)(1)(F), weighted under (d)(3)',
    supplied: false,
    note: 'Not in this report. A separate AOE source with its own provenance.',
  },
  {
    input: 'persons_per_square_mile',
    statute: '16 V.S.A. § 4010(b)(2), weighted under (d)(4)',
    supplied: false,
    note:
      'Not in this report. Also gates the small-school weight under (d)(5), which applies ' +
      'only where density is 55 or fewer persons per square mile, so its absence blocks ' +
      'two weights rather than one. The statute requires U.S. Census data supplied by the ' +
      'Vermont Center for Geographic Information, so it is not derivable from ADM at all.',
  },
  {
    input: 'small_school.average_two_year_enrollment',
    statute: '16 V.S.A. § 4010(b)(3)(A)-(C), weighted under (d)(5)',
    supplied: false,
    note:
      'Not in this report. Per-school, not per-town, so it cannot be derived from ADM. ' +
      '(b)(3)(B) defines it as the average enrollment of the two most recently completed ' +
      'school years, counted on October 1.',
  },
];

export function buildGapRegister(
  reports: ReadonlyArray<{
    readonly fiscal_year: number;
    readonly maps_to_statutory_bands: boolean;
  }>,
): {
  readonly generated_from: ReadonlyArray<number>;
  readonly engine_eligible_years: ReadonlyArray<number>;
  readonly entries: ReadonlyArray<GapEntry>;
  readonly weighted_membership_blocked_because: ReadonlyArray<string>;
} {
  const eligible = reports
    .filter((r) => r.maps_to_statutory_bands)
    .map((r) => r.fiscal_year)
    .sort((a, b) => a - b);

  return {
    generated_from: reports.map((r) => r.fiscal_year).sort((a, b) => a - b),
    engine_eligible_years: eligible,
    entries: ENTRIES,
    weighted_membership_blocked_because: [
      'Long-term membership under § 4001(7) is a two-year average, and the published ' +
        'reports change grade bands at the Act 127 boundary of July 1 2024. K-6 / 7-12 ' +
        'cannot be reduced to K-5 / 6-8 / 9-12 because grade 6 and grades 7-8 fall on ' +
        'opposite sides and no report publishes grade-level detail, so no two consecutive ' +
        'years share a band regime.',
      'The report publishes no prekindergarten column, so that band is null for every year.',
      'Four further § 4010 inputs come from sources not yet imported: state-placed FTE, ' +
        'pupils at or below 185 percent of FPL, English learner counts, and district ' +
        'population density.',
      'The prekindergarten weight itself is unverifiable while the Act 73 contingency ' +
        'stands, so the engine already declines to total on it independently.',
    ],
  };
}
