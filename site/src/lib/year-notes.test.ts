import { describe, expect, it } from 'vitest';
import { studentsLabel, yearNotes } from './year-notes.ts';

const report = { kind: 'resident_district_report' as const, count_year: '2022-2023', title: 'ADM-24', preliminary: false };
const file = { kind: 'town_file' as const, count_year: '2024-2025', title: null, preliminary: false };
const kinds = new Map<number, string | null>([
  [2023, 'resident_district_report'],
  [2024, 'resident_district_report'],
  [2025, 'town_file'],
  [2026, 'town_file'],
  [2027, 'town_file'],
]);

describe('studentsLabel', () => {
  it('names the school year the students were counted in', () => {
    expect(studentsLabel(file)).toBe('Students counted by the state (2024-2025 school year)');
    expect(studentsLabel(report, true)).toBe('Students, combined (2022-2023 school year)');
    expect(studentsLabel(null)).toBe('Students counted by the state');
  });
});

describe('yearNotes', () => {
  it('says nothing extra on the default year', () => {
    expect(yearNotes({ year: 2026, studentsSource: file }, kinds)).toEqual({
      membership: null, studentsSource: null, countChange: null, preliminary: null,
    });
  });

  it('says memberships are today\'s on an earlier year, and names the report', () => {
    const n = yearNotes({ year: 2023, studentsSource: report }, kinds);
    expect(n.membership).toContain('as they are today');
    expect(n.studentsSource?.text).toContain('Resident District Report for the 2022-2023 school year');
    expect(n.countChange).toBeNull();
  });

  it('flags the change of count on both years either side of it, naming the same year', () => {
    const before = yearNotes({ year: 2024, studentsSource: report }, kinds).countChange;
    const after = yearNotes({ year: 2025, studentsSource: { ...file, count_year: '2023-2024' } }, kinds).countChange;
    expect(before).toContain('fiscal year 2025 on');
    expect(after).toBe(before);
  });

  it('marks a preliminary count', () => {
    expect(yearNotes({ year: 2027, studentsSource: { ...file, preliminary: true } }, kinds).preliminary).toContain('preliminary');
  });

  it('flags nothing when a year has no student source', () => {
    expect(yearNotes({ year: 2024, studentsSource: null }, kinds).countChange).toBeNull();
  });
});
