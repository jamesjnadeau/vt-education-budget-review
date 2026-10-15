/**
 * "SY25" means the 2024-2025 count year, which feeds the FY2026 determination,
 * the same two-years-ahead convention warehouse/aoe-adm uses (count_year
 * 2022-2023 is adm_label 24 and fiscal_year 2024 there -- the label names the
 * fiscal year of the count's second half, and the determination year is one
 * more). Kept in one place so the three records cannot disagree.
 */

import type { SchoolYear } from './parse.ts';

export interface YearLabels {
  readonly school_year: SchoolYear;
  readonly count_year: string;
  readonly fiscal_year: number;
}

export function labelsFor(schoolYear: SchoolYear): YearLabels {
  const two = Number(schoolYear.slice(2));
  if (!Number.isInteger(two) || two < 15 || two > 99) {
    throw new Error(`"${schoolYear}" is not a school-year label this project knows how to date`);
  }
  const end = 2000 + two;
  return {
    school_year: schoolYear,
    count_year: `${end - 1}-${end}`,
    fiscal_year: end + 1,
  };
}
