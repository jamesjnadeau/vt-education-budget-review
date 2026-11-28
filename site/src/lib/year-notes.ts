/**
 * The words a journey page needs about its year: the student label, and the
 * short notes that say when a year's figures are not like its neighbours'.
 */
import type { Journey, JourneyYearRecord } from './journey.ts';
import { DEFAULT_YEAR } from './years.ts';

type StudentsSource = JourneyYearRecord['students_source'];

/** Where the Agency of Education lists its resident district reports. */
export const AOE_ADM_PAGE =
  'https://education.vermont.gov/accountability-data/school-reports/average-daily-membership';

/** "Students counted by the state (2024-2025 school year)". */
export function studentsLabel(source: StudentsSource, combined = false): string {
  const lead = combined ? 'Students, combined' : 'Students counted by the state';
  return source ? `${lead} (${source.count_year} school year)` : lead;
}

export interface YearNotes {
  /** Shown on years before the default: memberships are today's. */
  membership: string | null;
  /** Shown when the count is the resident district report. */
  studentsSource: { text: string; url: string } | null;
  /** Shown on the two years either side of the change of student count. */
  countChange: string | null;
  /** Shown when the state has not settled the year's count. */
  preliminary: string | null;
}

/**
 * `kinds` maps each fiscal year on file to the kind of student count it uses,
 * so a page can tell whether the year next to it counts students differently.
 */
export function yearNotes(
  journey: Pick<Journey, 'year' | 'studentsSource'>,
  kinds: ReadonlyMap<number, string | null>,
): YearNotes {
  const { year, studentsSource: source } = journey;
  const mine = source?.kind ?? null;
  const differs = (other: number): boolean => {
    const k = kinds.get(other);
    return mine !== null && k !== undefined && k !== null && k !== mine;
  };
  const firstNew = differs(year - 1) ? year : differs(year + 1) ? year + 1 : null;
  return {
    membership:
      year < DEFAULT_YEAR ? 'Districts, unions and groups are shown as they are today, not as they were that year.' : null,
    studentsSource:
      source?.kind === 'resident_district_report'
        ? {
            text: `Student count source: Vermont Agency of Education, Resident District Report for the ${source.count_year} school year.`,
            url: AOE_ADM_PAGE,
          }
        : null,
    countChange:
      firstNew === null
        ? null
        : `The student figures from fiscal year ${firstNew} on come from a different state count than the years before, so the two do not line up exactly.`,
    preliminary: source?.preliminary ? "The state's student count for this year is preliminary and may change." : null,
  };
}
