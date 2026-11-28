/**
 * The fiscal years the "My journey" pages are built for, and how a year is
 * written out in dates.
 *
 * A Vermont fiscal year N runs from July 1 of N-1 to June 30 of N, and is the
 * budget year for the school year that starts that autumn. This is the one
 * place the list of years and the default live.
 */

export const YEARS: readonly number[] = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027];

/** The year a visitor lands on. FY2027 figures are not complete yet. */
export const DEFAULT_YEAR = 2026;

export function isYear(value: unknown): value is number {
  return typeof value === 'number' && YEARS.includes(value);
}

export interface FiscalYearDates {
  /** "July 1, 2025" */
  start: string;
  /** "June 30, 2026" */
  end: string;
  /** "July 2025 to June 2026" */
  short: string;
  /** "2025-2026" */
  schoolYear: string;
}

export function fiscalYearDates(year: number): FiscalYearDates {
  return {
    start: `July 1, ${year - 1}`,
    end: `June 30, ${year}`,
    short: `July ${year - 1} to June ${year}`,
    schoolYear: `${year - 1}-${year}`,
  };
}

/** One plain sentence saying what a fiscal year is and when this one runs. */
export function fiscalYearSentence(year: number): string {
  const d = fiscalYearDates(year);
  return `Fiscal year (FY) ${year} is the school budget year from ${d.start} to ${d.end}.`;
}

/** The longer explanation, for hover text and screen readers. */
export function fiscalYearHelp(year: number): string {
  const d = fiscalYearDates(year);
  return (
    `A fiscal year (FY) is the budget year for the State and its schools. Fiscal year ${year} runs from ` +
    `${d.start} to ${d.end}. It pays for the ${d.schoolYear} school year, and its tax rate is on the ` +
    `bills towns sent in summer ${year - 1}.`
  );
}

export type JourneyKind = 'town' | 'district' | 'union' | 'grouping';

/** The address of a journey page, without the site's base prefix: "/my/2026/town/addison/". */
export function myHref(year: number, kind: JourneyKind, slug: string | number): string {
  return `/my/${year}/${kind}/${slug}/`;
}
